import { useCallback, useEffect, useRef, useState } from "react";
import {
  VoiceTransport,
  VoiceRpcError,
  isVoiceLive,
  voiceGuest,
  voiceStaff,
  type VoiceInvite,
  type VoiceRoom,
} from "./voice";

export function useVoice(
  invite: VoiceInvite | null,
  client: string | null,
  enabled: boolean,
) {
  const [room, setRoom] = useState<VoiceRoom | null>(null);
  const [error, setError] = useState("");
  const [muted, setMuted] = useState(false);
  const [, tick] = useState(0);
  const [transport] = useState(() => new VoiceTransport());
  const current = useRef(room);
  const serverOffset = useRef(0);
  current.current = room;
  const request = useCallback(
    async (p: Record<string, unknown>) => {
      if (!invite) throw new Error("Chưa tạo link nhận cuộc gọi.");
      const next: VoiceRoom = client
        ? await voiceGuest(invite, client, p)
        : await voiceStaff({ ...p, inviteId: invite.id });
      if (next.serverTime)
        serverOffset.current = Date.parse(next.serverTime) - Date.now();
      setRoom((previous) =>
        !previous || !next.serverTime || next.serverTime >= previous.serverTime
          ? next
          : previous,
      );
      setError("");
      return next;
    },
    [invite, client],
  );
  useEffect(() => {
    setRoom(null);
  }, [invite?.id]);
  useEffect(() => {
    if (!enabled || !invite) return;
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        await request({ action: "poll" });
      } catch (e) {
        if (active) setError((e as Error).message);
        if (e instanceof VoiceRpcError && e.fatal) {
          transport.close();
          setRoom(null);
          active = false;
        }
      } finally {
        if (active) timer = setTimeout(() => void poll(), 1500);
      }
    };
    void poll();
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [enabled, invite, request, transport]);
  useEffect(() => {
    transport.onConnected = () => {
      const call = current.current?.call;
      if (isVoiceLive(call))
        void request({ action: "connected", callId: call!.id }).catch((e) =>
          setError(e.message),
        );
    };
    transport.onFailed = () => {
      const call = current.current?.call;
      if (isVoiceLive(call))
        void request({
          action: "fail",
          callId: call!.id,
          reason: "media_connection_failed",
        }).catch((e) => setError(e.message));
      transport.close();
    };
    return () => {
      transport.onConnected = () => {};
      transport.onFailed = () => {};
    };
  }, [transport, request]);
  useEffect(() => {
    if (room?.call && !isVoiceLive(room.call)) {
      transport.close();
      setMuted(false);
    }
  }, [room?.call?.id, room?.call?.status, transport]);
  useEffect(() => {
    if (client || !room?.call?.answer || !isVoiceLive(room.call)) return;
    void transport.applyAnswer(room.call.answer).catch(async (e) => {
      setError(e.message);
      transport.close();
      await request({
        action: "fail",
        callId: room.call!.id,
        reason: "answer_failed",
      }).catch(() => {});
    });
  }, [client, room?.call?.answer, room?.call?.id, transport, request]);
  useEffect(() => {
    const timer = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(timer);
  }, []);
  useEffect(
    () => () => {
      transport.dispose();
      const call = current.current?.call;
      if (isVoiceLive(call))
        void request({ action: "end", callId: call!.id }).catch(() => {});
    },
    [transport, request],
  );
  async function end() {
    const call = current.current?.call;
    transport.close();
    setMuted(false);
    if (isVoiceLive(call)) await request({ action: "end", callId: call!.id });
  }
  const toggleMute = () => {
    transport.mute(!muted);
    setMuted(!muted);
  };
  const call = room?.call;
  // Display estimates tick locally; the saved duration always comes from the DB.
  const duration = call?.endedAt
    ? call.durationSeconds
    : call?.connectedAt
      ? Math.max(
          0,
          Math.floor(
            (Date.now() + serverOffset.current - Date.parse(call.connectedAt)) /
              1000,
          ),
        )
      : 0;
  return {
    room,
    request,
    error,
    setError,
    transport,
    end,
    muted,
    toggleMute,
    duration,
  };
}
