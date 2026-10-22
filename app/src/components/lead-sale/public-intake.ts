import { demoMode, supabase } from "./backend";

export interface IntakeInput {
  name: string;
  phone: string;
  city: string;
  vehicle: "Motorbike" | "Van";
  district: string;
  hasVehicle: "yes" | "no" | "";
  callTime: "any" | "morning" | "afternoon" | "evening";
  documents: { cccd: boolean; license: boolean; registration: boolean };
  note: string;
  consent: boolean;
  website: string;
}

export const publicIntakeUrl = () =>
  !demoMode && import.meta.env.VITE_DRIVER_INTAKE_URL
    ? import.meta.env.VITE_DRIVER_INTAKE_URL
    : `${window.location.origin}${window.location.pathname}#/dang-ky-tai-xe`;

const demoReceipts = new Set<string>();
export async function submitIntake(input: IntakeInput, requestId: string) {
  if (!demoMode) {
    if (!supabase)
      throw new Error("Form chưa được kết nối. Vui lòng thử lại sau.");
    const { data, error } = await supabase.rpc("lead_public_intake", {
      p_input: input,
      p_request_id: requestId,
    });
    if (error) {
      if (error.code === "P0001") throw new Error(error.message);
      throw new Error(
        "Chưa gửi được đăng ký. Vui lòng thử lại; thông tin bạn nhập vẫn được giữ trên trang.",
      );
    }
    if (data?.accepted !== true)
      throw new Error("Chưa xác nhận được đăng ký. Vui lòng thử lại.");
    return;
  }
  if (demoReceipts.has(requestId)) return;
  const { receiveDemoIntake } = await import("./store");
  receiveDemoIntake(input);
  demoReceipts.add(requestId);
}
