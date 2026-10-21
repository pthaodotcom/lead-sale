import type { Command } from "./types";
let serverOffsetMs = 0;
export const serverNow = () => new Date(Date.now() + serverOffsetMs);
export function syncServerClock(serverTime: string, requestStartedAt: number) {
  const stamp = Date.parse(serverTime);
  if (Number.isFinite(stamp))
    serverOffsetMs = stamp - (requestStartedAt + Date.now()) / 2;
}
/** datetime-local has no offset: interpret it on the browser, then send UTC. */
export function serializeCommandDates(command: Command): Command {
  const iso = (value: string) => {
    const date = new Date(value);
    if (!Number.isFinite(date.getTime()))
      throw new Error("Ngày giờ không hợp lệ.");
    return date.toISOString();
  };
  if (command.type === "activity")
    return {
      ...command,
      input: {
        ...command.input,
        at: iso(command.input.at),
        ...(command.input.appointmentAt
          ? { appointmentAt: iso(command.input.appointmentAt) }
          : {}),
      },
    };
  if (command.type === "reschedule") return { ...command, at: iso(command.at) };
  if (command.type === "leadStatus" && command.occurredAt)
    return { ...command, occurredAt: iso(command.occurredAt) };
  if (command.type === "correctMilestone")
    return {
      ...command,
      ...(command.activatedAt ? { activatedAt: iso(command.activatedAt) } : {}),
      ...(command.onboardedAt ? { onboardedAt: iso(command.onboardedAt) } : {}),
    };
  if (command.type === "saveLead" && command.input.receivedAt)
    return {
      ...command,
      input: { ...command.input, receivedAt: iso(command.input.receivedAt) },
    };
  return command;
}
