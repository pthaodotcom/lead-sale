import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import { PublicIntake } from "./components/lead-sale/PublicIntake";
import { VoiceReceiver } from "./components/lead-sale/VoiceReceiver";

function PublicLanding() {
  const [hash, setHash] = useState(location.hash);
  useEffect(() => {
    const change = () => setHash(location.hash);
    window.addEventListener("hashchange", change);
    return () => window.removeEventListener("hashchange", change);
  }, []);
  return hash.startsWith("#/nhan-cuoc-goi") ? (
    <VoiceReceiver key={hash} />
  ) : (
    <PublicIntake />
  );
}
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <PublicLanding />
  </StrictMode>,
);
