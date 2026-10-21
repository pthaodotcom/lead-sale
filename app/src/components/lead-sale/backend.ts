import { createClient } from "@supabase/supabase-js";
import type { Command, Database, ReportData, ReportFilters } from "./types";
import { leadLabels } from "./domain";
import { serializeCommandDates, syncServerClock } from "./dates";
export const demoMode = import.meta.env.VITE_DEMO_MODE === "true";
export const supabase =
  !demoMode &&
  import.meta.env.VITE_SUPABASE_URL &&
  import.meta.env.VITE_SB_PUBLISHABLE_KEY
    ? createClient(
        import.meta.env.VITE_SUPABASE_URL,
        import.meta.env.VITE_SB_PUBLISHABLE_KEY,
      )
    : null;
export async function loadWorkspace(): Promise<
  Database & { actor: Database["members"][number] }
> {
  if (!supabase) throw new Error("Chưa cấu hình Supabase.");
  const requestStartedAt = Date.now();
  const { data, error } = await supabase.rpc("lead_snapshot");
  if (error) throw new Error(error.message);
  if (data.serverTime) syncServerClock(data.serverTime, requestStartedAt);
  for (const s of data.statusCatalog ?? [])
    if (s.code in leadLabels)
      leadLabels[s.code as keyof typeof leadLabels] = s.label;
  return data;
}
export async function registerMember(
  email: string,
  password: string,
  name: string,
) {
  if (!supabase) throw new Error("Cần kết nối Supabase để tạo tài khoản.");
  const separate = createClient(
    import.meta.env.VITE_SUPABASE_URL,
    import.meta.env.VITE_SB_PUBLISHABLE_KEY,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    },
  );
  try {
    const { data, error } = await separate.auth.signUp({
      email,
      password,
      options: { data: { name } },
    });
    if (error) throw error;
    if (!data.user) throw new Error("Không tạo được tài khoản.");
  } finally {
    separate.auth.stopAutoRefresh();
  }
}
export async function sendCommand(
  command: Command,
  db: Database,
  requestId: string = crypto.randomUUID(),
) {
  if (!supabase) throw new Error("Chưa cấu hình Supabase.");
  let version: number | undefined;
  if (
    "id" in command &&
    [
      "saveLead",
      "leadStatus",
      "archiveLead",
      "receiveLead",
      "correctMilestone",
    ].includes(command.type)
  )
    version = db.leads.find((l) => l.id === command.id)?.version;
  let ticketId: string | undefined;
  if ("assignmentId" in command) ticketId = command.assignmentId;
  if (command.type === "accept" || command.type === "ticketStatus")
    ticketId = command.id;
  if (
    command.type === "appointment" ||
    command.type === "reschedule" ||
    command.type === "correctAppointment"
  )
    ticketId = db.appointments.find((a) => a.id === command.id)?.assignmentId;
  if (command.type === "attachment")
    ticketId = db.activities.find(
      (a) => a.id === command.activityId,
    )?.assignmentId;
  if (command.type === "voidActivity")
    ticketId = db.activities.find((a) => a.id === command.id)?.assignmentId;
  if (ticketId)
    version = db.assignments.find((t) => t.id === ticketId)?.version;
  if (command.type === "review" || command.type === "amendReview")
    version = db.reviews.find((r) => r.id === command.id)?.version ?? 1;
  const { error } = await supabase.rpc("lead_command", {
    p_command: serializeCommandDates(command),
    p_request_id: requestId,
    p_expected_version: version ?? null,
  });
  if (error) throw new Error(error.message);
}
export async function loadReport(filters: ReportFilters): Promise<ReportData> {
  if (!supabase) throw new Error("Chưa cấu hình Supabase.");
  const { data, error } = await supabase.rpc("lead_report", {
    p_filters: filters,
  });
  if (error) throw new Error(error.message);
  return data;
}
export async function importBatch(command: Record<string, unknown>) {
  if (!supabase) throw new Error("Lô nhập cần kết nối Supabase.");
  const { data, error } = await supabase.rpc("lead_import", {
    p_command: command,
  });
  if (error) throw new Error(error.message);
  return data;
}
export async function uploadEvidence(
  file: File,
  actorId: string,
  ticketId: string,
) {
  if (!supabase) throw new Error("Tệp bằng chứng cần chế độ Supabase.");
  if (file.size > 20 * 1024 * 1024 || !file.size)
    throw new Error("Tệp cần có dữ liệu và không quá 20 MB.");
  const ext =
    file.name
      .split(".")
      .pop()
      ?.replace(/[^a-z0-9]/gi, "") ?? "bin";
  const path = `${actorId}/${ticketId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage
    .from("lead-evidence")
    .upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw new Error(error.message);
  return { path, name: file.name, type: file.type, size: file.size };
}
export async function evidenceUrl(path: string) {
  if (!supabase) throw new Error("Chưa kết nối Supabase.");
  const { data, error } = await supabase.storage
    .from("lead-evidence")
    .createSignedUrl(path, 60);
  if (error) throw new Error(error.message);
  return data.signedUrl;
}
