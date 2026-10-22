import { lazy, Suspense, useEffect, useState } from "react";
import { PublicIntake } from "@/components/lead-sale/PublicIntake";
import { VoiceReceiver } from "@/components/lead-sale/VoiceReceiver";
const LeadSaleApp = lazy(() => import("@/components/lead-sale/LeadSaleApp"));

export default function App() {
  const [hash, setHash] = useState(window.location.hash);
  useEffect(() => {
    const change = () => setHash(window.location.hash);
    window.addEventListener("hashchange", change);
    return () => window.removeEventListener("hashchange", change);
  }, []);
  if (hash.split("?")[0].replace(/\/$/, "") === "#/nhan-cuoc-goi")
    return <VoiceReceiver key={hash} />;
  return hash.split("?")[0].replace(/\/$/, "") === "#/dang-ky-tai-xe" ? (
    <PublicIntake />
  ) : (
    <Suspense fallback={<p role="status">Đang tải Lead Sale…</p>}>
      <LeadSaleApp />
    </Suspense>
  );
}
