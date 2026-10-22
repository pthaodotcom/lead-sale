import { useEffect, useState } from "react";
import {
  CheckCircle2,
  Mic,
  MicOff,
  PhoneCall,
  PhoneOff,
  Volume2,
} from "lucide-react";
import { useVoice } from "./useVoice";
import {
  isVoiceLive,
  voiceGuest,
  voiceLabels,
  voiceTime,
  type VoiceInvite,
} from "./voice";
import "./lead-sale.css";
import "./voice.css";

function receiverParameters(): VoiceInvite | null {
  const parameters = new URLSearchParams(location.hash.split("?")[1] ?? "");
  const id = parameters.get("id") ?? "";
  const token = parameters.get("key") ?? "";
  return /^[0-9a-f-]{36}$/i.test(id) && /^[0-9a-f]{64}$/i.test(token)
    ? { id, token, expiresAt: "" }
    : null;
}
export function VoiceReceiver() {
  const [invite] = useState(receiverParameters);
  const [client] = useState(() => {
    const key = `lead-voice-client-${invite?.id}`;
    let value = sessionStorage.getItem(key);
    if (!value) {
      value = crypto.randomUUID();
      sessionStorage.setItem(key, value);
    }
    return value;
  });
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [valid, setValid] = useState(false);
  const {
    room,
    request,
    error,
    setError,
    transport,
    end,
    muted,
    toggleMute,
    duration,
  } = useVoice(invite, client, ready);
  const call = room?.call;
  const active = isVoiceLive(call);
  useEffect(() => {
    const old = document.title;
    document.title = "Nhận cuộc gọi · AhaMove";
    return () => {
      document.title = old;
    };
  }, []);
  useEffect(() => {
    let mounted = true;
    if (!invite) {
      setError("Link nhận cuộc gọi không hợp lệ. Xin nhân viên gửi lại link.");
      return;
    }
    void voiceGuest(invite, client, { action: "info" }).then(
      () => {
        if (mounted) setValid(true);
      },
      (e) => {
        if (mounted) setError(e.message);
      },
    );
    return () => {
      mounted = false;
    };
  }, [invite, client, setError]);
  useEffect(() => {
    if (call?.status === "ringing") transport.ring();
    else transport.stopRing();
    return () => transport.stopRing();
  }, [call?.status, call?.id, transport]);
  async function enable() {
    setBusy(true);
    try {
      transport.unlockTone();
      await transport.prepare();
      await request({ action: "ready" });
      setReady(true);
    } catch (e) {
      transport.close();
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function answer() {
    if (!call?.offer) return;
    setBusy(true);
    transport.stopRing();
    try {
      await request({ action: "accept", callId: call.id });
      const sdp = await transport.answer(call.offer);
      await request({ action: "answer", callId: call.id, sdp });
    } catch (e) {
      transport.close();
      setError((e as Error).message);
      await request({
        action: "fail",
        callId: call.id,
        reason: "microphone_or_connection_failed",
      }).catch(() => {});
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="voice-receiver">
      <header>
        <img src="/ahamove-logo.png" width={130} alt="AhaMove" />
        <span>Cuộc gọi tư vấn tài xế</span>
      </header>
      <main>
        <div
          className={`voice-avatar ${call?.status === "ringing" ? "ringing" : ""}`}
        >
          <PhoneCall size={36} />
        </div>
        <h1>
          {call
            ? voiceLabels[call.status]
            : ready
              ? "Đã sẵn sàng nhận cuộc gọi"
              : "Nhận cuộc gọi từ laptop"}
        </h1>
        <p>
          {call?.status === "ringing"
            ? "Nhân viên đang gọi cho bạn. Bấm Nghe máy để bắt đầu trò chuyện."
            : call?.status === "connected"
              ? "Cuộc gọi thoại qua Internet đang kết nối."
              : ready
                ? "Giữ trang này mở. Nhân viên có thể bấm Gọi ngay trên CRM."
                : "Mở link này trên điện thoại, cho phép micro rồi bấm Sẵn sàng nhận cuộc gọi."}
        </p>
        {call?.connectedAt && (
          <div className="voice-duration" aria-label="Thời lượng trò chuyện">
            {voiceTime(duration)}
          </div>
        )}
        {error && (
          <div className="voice-receiver-error" role="alert">
            {error}
          </div>
        )}
        {!ready && (
          <button
            className="voice-button"
            disabled={!valid || busy}
            onClick={() => void enable()}
          >
            <Mic size={20} />
            {busy ? "Đang bật micro…" : "Sẵn sàng nhận cuộc gọi"}
          </button>
        )}
        {ready && !active && (
          <div className="voice-listening">
            <CheckCircle2 size={18} /> Đang chờ cuộc gọi
          </div>
        )}
        {call?.status === "ringing" && (
          <div className="voice-receiver-actions">
            <button
              className="voice-button"
              disabled={busy}
              onClick={() => void answer()}
            >
              <PhoneCall size={20} />
              {busy ? "Đang kết nối…" : "Nghe máy"}
            </button>
            <button
              className="voice-button danger"
              onClick={() => void end().catch((e) => setError(e.message))}
            >
              <PhoneOff size={20} />
              Từ chối
            </button>
          </div>
        )}
        {active && call?.status !== "ringing" && (
          <div className="voice-receiver-actions">
            <button className="voice-button secondary" onClick={toggleMute}>
              {muted ? <MicOff size={20} /> : <Mic size={20} />}{" "}
              {muted ? "Bật micro" : "Tắt micro"}
            </button>
            <button
              className="voice-button danger"
              onClick={() => void end().catch((e) => setError(e.message))}
            >
              <PhoneOff size={20} />
              Kết thúc
            </button>
          </div>
        )}
        <audio
          className={active ? "voice-audio" : "voice-audio idle"}
          ref={(element) => {
            transport.audio = element;
          }}
          autoPlay
          playsInline
          controls
          aria-label="Âm thanh người gọi"
        />
        {active && (
          <button
            className="voice-speaker"
            onClick={() =>
              void transport.audio
                ?.play()
                .catch(() =>
                  setError("Bấm nút phát trên thanh âm thanh để bật loa."),
                )
            }
          >
            <Volume2 size={17} />
            Bật loa nếu chưa nghe được
          </button>
        )}
        <div className="voice-receiver-note">
          Cuộc gọi dùng Internet, không gọi vào SIM. Không ghi âm. Khi rời trang
          hoặc khóa màn hình, bạn có thể mất kết nối. Lần đầu nên thử cùng
          Wi-Fi.
        </div>
      </main>
      <footer>AhaMove · Kết nối và tư vấn tài xế</footer>
    </div>
  );
}
