import { useCallback, useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import {
  Copy,
  ExternalLink,
  Mic,
  MicOff,
  PhoneCall,
  PhoneOff,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useWorkspace } from "./context";
import { formatDate, memberName } from "./shared";
import { useVoice } from "./useVoice";
import {
  isVoiceLive,
  voiceLabels,
  voiceLink,
  voiceStaff,
  voiceTime,
  type VoiceInvite,
  type VoiceLog,
} from "./voice";
import "./voice.css";

export function VoicePanel({
  leadId,
  ticketId,
  canCall,
}: {
  leadId: string;
  ticketId?: string;
  canCall: boolean;
}) {
  const { db, cloud } = useWorkspace();
  const [invite, setInvite] = useState<VoiceInvite | null>(null);
  const [history, setHistory] = useState<VoiceLog[]>([]);
  const [historyError, setHistoryError] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
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
  } = useVoice(invite, null, !!invite);
  const refresh = useCallback(async () => {
    if (!cloud) return;
    try {
      const data = await voiceStaff({ action: "history", leadId, ticketId });
      setHistory(data.calls);
      setHistoryError("");
    } catch (e) {
      setHistoryError((e as Error).message);
    }
  }, [cloud, leadId, ticketId]);
  useEffect(() => {
    void refresh();
  }, [refresh, room?.call?.status]);
  const call = room?.call;
  const active = isVoiceLive(call);
  async function prepare() {
    setBusy(true);
    setError("");
    try {
      setInvite(await voiceStaff({ action: "prepare", leadId, ticketId }));
      setCopied(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function dial() {
    setBusy(true);
    setError("");
    try {
      const sdp = await transport.offer();
      await request({ action: "start", sdp });
    } catch (e) {
      transport.close();
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="panel voice-panel" aria-label="Cuộc gọi Internet">
      <div className="panel-head">
        <h2>
          <PhoneCall size={17} /> Cuộc gọi Internet
        </h2>
        <span>Âm thanh thật · Không ghi âm</span>
      </div>
      <div className="panel-body">
        {!cloud ? (
          <p className="muted">
            Cuộc gọi thật dùng bản CRM kết nối Supabase. Bản xem thử không gọi
            ra điện thoại.
          </p>
        ) : (
          <>
            {canCall && !invite && (
              <div className="voice-intro">
                <p>
                  Điện thoại mở link riêng để nhận cuộc gọi từ laptop. Giữ trang
                  nhận mở và cho phép micro trên cả hai máy.
                </p>
                <Button onClick={() => void prepare()} disabled={busy}>
                  <PhoneCall />{" "}
                  {busy ? "Đang tạo link…" : "Tạo link nhận cuộc gọi"}
                </Button>
              </div>
            )}
            {canCall && invite && (
              <>
                <div className="voice-pair">
                  <QRCodeSVG
                    value={voiceLink(invite)}
                    size={144}
                    marginSize={2}
                    title="Quét để nhận cuộc gọi trên điện thoại"
                  />
                  <div>
                    <strong>Quét mã bằng điện thoại</strong>
                    <p>
                      Mở link HTTPS, cho phép micro rồi bấm{" "}
                      <b>Sẵn sàng nhận cuộc gọi</b>. Giữ trang mở trong lúc thử.
                    </p>
                  </div>
                </div>
                <div className="voice-link">
                  <label htmlFor={`voice-link-${leadId}`}>
                    Link mở trên điện thoại · hiệu lực 2 giờ
                  </label>
                  <div>
                    <input
                      id={`voice-link-${leadId}`}
                      readOnly
                      value={voiceLink(invite)}
                      onFocus={(e) => e.currentTarget.select()}
                    />
                    <Button
                      variant="outline"
                      onClick={() => {
                        if (navigator.clipboard)
                          void navigator.clipboard
                            .writeText(voiceLink(invite))
                            .then(
                              () => setCopied(true),
                              () =>
                                setError(
                                  "Chọn đường link rồi sao chép thủ công.",
                                ),
                            );
                        else setError("Chọn đường link rồi sao chép thủ công.");
                      }}
                    >
                      <Copy />
                      {copied ? "Đã sao chép" : "Sao chép"}
                    </Button>
                    <Button asChild variant="outline">
                      <a
                        href={voiceLink(invite)}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <ExternalLink />
                        Mở trang nhận
                      </a>
                    </Button>
                  </div>
                </div>
                <div className="voice-controls">
                  <span
                    className={`voice-ready ${room?.receiverReady ? "online" : ""}`}
                  >
                    <i />
                    {room?.receiverReady
                      ? "Điện thoại đã sẵn sàng"
                      : "Đợi điện thoại mở link và bấm Sẵn sàng nhận cuộc gọi"}
                  </span>
                  {!active && (
                    <Button
                      disabled={busy || !room?.receiverReady}
                      onClick={() => void dial()}
                    >
                      <PhoneCall />
                      {busy ? "Đang chuẩn bị micro…" : "Gọi ngay"}
                    </Button>
                  )}
                  {active && (
                    <>
                      <Button variant="outline" onClick={toggleMute}>
                        {muted ? <MicOff /> : <Mic />}
                        {muted ? "Bật micro" : "Tắt micro"}
                      </Button>
                      <Button
                        variant="destructive"
                        onClick={() =>
                          void end().catch((e) => setError(e.message))
                        }
                      >
                        <PhoneOff />
                        Kết thúc
                      </Button>
                    </>
                  )}
                </div>
                {call && (
                  <div className={`voice-status ${call.status}`} role="status">
                    <strong>{voiceLabels[call.status]}</strong>
                    <span>
                      {call.connectedAt
                        ? `Thời lượng ${voiceTime(duration)}`
                        : call.status === "ringing"
                          ? "Chờ nghe máy tối đa 45 giây"
                          : "Chưa có thời gian trò chuyện"}
                    </span>
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
                  aria-label="Âm thanh cuộc gọi"
                />
              </>
            )}
            {error && (
              <p role="alert" className="callout">
                {error}
              </p>
            )}
            <div className="voice-history-head">
              <strong>Nhật ký cuộc gọi</strong>
              <Button variant="ghost" size="sm" onClick={() => void refresh()}>
                <RefreshCw />
                Làm mới
              </Button>
            </div>
            {historyError && (
              <p className="callout" role="alert">
                {historyError}
              </p>
            )}
            {!history.length && !historyError ? (
              <p className="muted">
                Chưa có cuộc gọi Internet. Kết quả tư vấn được ghi riêng ở phần
                Ghi nhận liên hệ.
              </p>
            ) : (
              <div className="table-scroll">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Bắt đầu</th>
                      <th>Người gọi</th>
                      <th>Trạng thái</th>
                      <th>Thời lượng trò chuyện</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((row) => (
                      <tr key={row.id}>
                        <td>{formatDate(row.started_at, true)}</td>
                        <td>{memberName(db, String(row.actor_id))}</td>
                        <td>{voiceLabels[row.status]}</td>
                        <td>
                          {row.connected_at
                            ? voiceTime(row.duration_seconds)
                            : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}
