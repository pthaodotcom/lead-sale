import { supabase, demoMode } from "./backend";

export type VoiceStatus =
  | "ringing"
  | "connecting"
  | "connected"
  | "completed"
  | "no_answer"
  | "rejected"
  | "cancelled"
  | "failed";
export interface VoiceCall {
  id: string;
  status: VoiceStatus;
  startedAt: string;
  acceptedAt: string | null;
  connectedAt: string | null;
  endedAt: string | null;
  durationSeconds: number;
  endReason: string;
  offer?: string;
  answer?: string;
}
export interface VoiceRoom {
  serverTime: string;
  receiverReady: boolean;
  expiresAt: string;
  call: VoiceCall | null;
}
export interface VoiceInvite {
  id: string;
  token: string;
  expiresAt: string;
}
export interface VoiceLog {
  id: string;
  actor_id: number;
  status: VoiceStatus;
  started_at: string;
  duration_seconds: number;
  connected_at: string | null;
  ended_at: string | null;
  end_reason: string;
}
export const voiceLabels: Record<VoiceStatus, string> = {
  ringing: "Đang đổ chuông",
  connecting: "Đang kết nối âm thanh",
  connected: "Đang trò chuyện",
  completed: "Đã nghe máy · Kết thúc",
  no_answer: "Không nghe máy",
  rejected: "Đã từ chối",
  cancelled: "Đã hủy cuộc gọi",
  failed: "Lỗi kết nối",
};
export const isVoiceLive = (call?: VoiceCall | null) =>
  !!call && ["ringing", "connecting", "connected"].includes(call.status);
export const voiceTime = (seconds: number) =>
  `${Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0")}:${(seconds % 60).toString().padStart(2, "0")}`;
export class VoiceRpcError extends Error {
  readonly fatal: boolean;
  constructor(message: string, code: string) {
    super(message);
    this.fatal = ["P0001", "42501", "PGRST301", "PGRST302"].includes(code);
  }
}
export async function voiceStaff(p: Record<string, unknown>) {
  if (demoMode || !supabase)
    throw new Error(
      "Cuộc gọi thật cần bản kết nối Supabase. Mở CRM ở chế độ dữ liệu thật.",
    );
  const { data, error } = await supabase.rpc("lead_voice_staff", { p });
  if (error)
    throw new VoiceRpcError(
      error.code === "P0001"
        ? error.message
        : "Chưa kết nối được dịch vụ gọi. Kiểm tra mạng và thử lại.",
      error.code,
    );
  return data;
}
export async function voiceGuest(
  invite: VoiceInvite,
  client: string,
  p: Record<string, unknown>,
) {
  if (!supabase) throw new Error("Trang nhận cuộc gọi chưa kết nối máy chủ.");
  const { data, error } = await supabase.rpc("lead_voice_guest", {
    p_invite: invite.id,
    p_token: invite.token,
    p_client: client,
    p,
  });
  if (error)
    throw new VoiceRpcError(
      error.code === "P0001"
        ? error.message
        : "Mất kết nối với máy chủ. Kiểm tra mạng rồi thử lại.",
      error.code,
    );
  return data;
}
export function voiceLink(invite: VoiceInvite) {
  const base =
    import.meta.env.VITE_DRIVER_INTAKE_URL ||
    `${location.origin}${location.pathname}`;
  return `${base.split("#")[0]}#/nhan-cuoc-goi?id=${encodeURIComponent(invite.id)}&key=${encodeURIComponent(invite.token)}`;
}

/** Audio stays between peers. No recording or upload of microphone audio. */
export class VoiceTransport {
  peer: RTCPeerConnection | null = null;
  stream: MediaStream | null = null;
  audio: HTMLAudioElement | null = null;
  private generation = 0;
  private disconnectTimer: ReturnType<typeof setTimeout> | undefined;
  private toneTimer: ReturnType<typeof setInterval> | undefined;
  private toneContext: AudioContext | null = null;
  onConnected: () => void = () => {};
  onFailed: () => void = () => {};
  async prepare() {
    if (this.stream?.getAudioTracks().some((t) => t.readyState === "live"))
      return;
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia)
      throw new Error("Cần mở link HTTPS trên điện thoại để dùng micro.");
    const generation = this.generation;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
        video: false,
      });
      if (generation !== this.generation) {
        stream.getTracks().forEach((t) => t.stop());
        throw new Error("Cuộc gọi đã kết thúc.");
      }
      this.stream = stream;
    } catch (error) {
      if ((error as Error).name === "NotAllowedError")
        throw new Error(
          "Chưa được phép dùng micro. Cho phép micro trong trình duyệt rồi thử lại.",
        );
      if ((error as Error).name === "NotFoundError")
        throw new Error("Không tìm thấy micro. Kiểm tra thiết bị âm thanh.");
      throw error;
    }
  }
  private async create() {
    await this.prepare();
    // Optional ICE configuration is deployment-specific. Default STUN is enough
    // for many demo networks; TURN must be configured for restrictive NATs.
    let iceServers: RTCIceServer[] = [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun.cloudflare.com:3478" },
    ];
    if (import.meta.env.VITE_VOICE_ICE_SERVERS) {
      try {
        iceServers = JSON.parse(import.meta.env.VITE_VOICE_ICE_SERVERS);
      } catch {
        throw new Error("Cấu hình máy chủ âm thanh không hợp lệ.");
      }
    }
    const peer = new RTCPeerConnection({ iceServers });
    this.peer = peer;
    for (const track of this.stream!.getTracks())
      peer.addTrack(track, this.stream!);
    peer.ontrack = (event) => {
      if (this.audio) {
        this.audio.srcObject =
          event.streams[0] ?? new MediaStream([event.track]);
        void this.audio.play().catch(() => {});
      }
    };
    peer.onconnectionstatechange = () => {
      clearTimeout(this.disconnectTimer);
      if (peer !== this.peer) return;
      if (peer.connectionState === "connected") this.onConnected();
      if (peer.connectionState === "failed") this.onFailed();
      if (peer.connectionState === "disconnected")
        this.disconnectTimer = setTimeout(() => this.onFailed(), 8000);
    };
    return peer;
  }
  private async gather(peer: RTCPeerConnection) {
    if (peer.iceGatheringState !== "complete")
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          done();
        }, 8000);
        const done = () => {
          clearTimeout(timeout);
          peer.removeEventListener("icegatheringstatechange", changed);
          peer.removeEventListener("connectionstatechange", closed);
          resolve();
        };
        const changed = () => {
          if (peer.iceGatheringState === "complete") done();
        };
        const closed = () => {
          if (peer.connectionState === "closed") {
            done();
            reject(new Error("Cuộc gọi đã kết thúc."));
          }
        };
        peer.addEventListener("icegatheringstatechange", changed);
        peer.addEventListener("connectionstatechange", closed);
      });
    if (this.peer !== peer || !peer.localDescription?.sdp)
      throw new Error("Cuộc gọi đã kết thúc.");
    return peer.localDescription.sdp;
  }
  async offer() {
    const peer = await this.create();
    await peer.setLocalDescription(await peer.createOffer());
    return this.gather(peer);
  }
  async answer(sdp: string) {
    const peer = await this.create();
    await peer.setRemoteDescription({ type: "offer", sdp });
    await peer.setLocalDescription(await peer.createAnswer());
    return this.gather(peer);
  }
  async applyAnswer(sdp: string) {
    const peer = this.peer;
    if (peer?.signalingState === "have-local-offer")
      await peer.setRemoteDescription({ type: "answer", sdp });
  }
  mute(muted: boolean) {
    this.stream?.getAudioTracks().forEach((t) => {
      t.enabled = !muted;
    });
  }
  unlockTone() {
    try {
      this.toneContext ??= new AudioContext();
      void this.toneContext.resume();
    } catch {
      /* ringtone is optional */
    }
  }
  ring() {
    if (this.toneTimer) return;
    const beep = () => {
      const context = this.toneContext;
      if (!context || context.state !== "running") return;
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.frequency.value = 660;
      gain.gain.setValueAtTime(0.04, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.35);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start();
      oscillator.stop(context.currentTime + 0.4);
    };
    beep();
    this.toneTimer = setInterval(beep, 1600);
  }
  stopRing() {
    clearInterval(this.toneTimer);
    this.toneTimer = undefined;
  }
  close() {
    this.generation++;
    clearTimeout(this.disconnectTimer);
    this.stopRing();
    const peer = this.peer;
    this.peer = null;
    if (peer) {
      peer.onconnectionstatechange = null;
      peer.ontrack = null;
      peer.close();
    }
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    if (this.audio) this.audio.srcObject = null;
  }
  dispose() {
    this.close();
    void this.toneContext?.close();
    this.toneContext = null;
  }
}
