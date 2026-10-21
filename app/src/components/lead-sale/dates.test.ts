import { describe, expect, it } from "vitest";
import { serializeCommandDates } from "./dates";
describe("dates sent to PostgreSQL", () => {
  it("keeps UTC+7 times as the same instant, including appointment times", () => {
    const command = {
      type: "activity" as const,
      assignmentId: "ticket",
      input: {
        channel: "call" as const,
        at: "2026-10-21T10:30:00.123+07:00",
        outcome: "called" as const,
        decision: "agreed" as const,
        reason: "none" as const,
        note: "Đồng ý",
        appointmentAt: "2026-10-22T10:00:00+07:00",
        place: "Hà Nội",
      },
    };
    const result = serializeCommandDates(command);
    expect(result.type === "activity" && result.input.at).toBe(
      "2026-10-21T03:30:00.123Z",
    );
    expect(result.type === "activity" && result.input.appointmentAt).toBe(
      "2026-10-22T03:00:00.000Z",
    );
    expect(command.input.at).toContain("+07:00");
  });
  it("converts local input before the server interprets it in UTC", () => {
    const local = "2026-10-21T10:30:00.123";
    const result = serializeCommandDates({
      type: "reschedule",
      id: "appointment",
      at: local,
      place: "Hà Nội",
    });
    expect(result.type === "reschedule" && result.at).toBe(
      new Date(2026, 9, 21, 10, 30, 0, 123).toISOString(),
    );
    expect(() =>
      serializeCommandDates({
        type: "reschedule",
        id: "a",
        at: "invalid",
        place: "x",
      }),
    ).toThrow("Ngày giờ");
  });
});
