import {
  beforeAll,
  beforeEach,
  afterEach,
  afterAll,
  describe,
  it,
  expect,
} from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFile, readdir } from "node:fs/promises";
import { randomUUID } from "node:crypto";
const db = new PGlite();
const users = {
  admin: randomUUID(),
  intake: randomUUID(),
  leader: randomUUID(),
  sale: randomUUID(),
  other: randomUUID(),
  viewer: randomUUID(),
};
const members: Record<string, string> = {};
let clock = "";
beforeAll(async () => {
  await db.exec(`create role anon; create role authenticated; create role service_role;
 create schema auth;create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}');
 create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
 create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table storage.objects(bucket_id text,name text,primary key(bucket_id,name));alter table storage.objects enable row level security;grant usage on schema storage,auth to authenticated;grant select,insert on storage.objects to authenticated;`);
  for (const f of (await readdir("backend/supabase/schemas"))
    .filter((f) => /^(1[0-46-9]|2[0-3])_/.test(f))
    .sort())
    await db.exec(await readFile("backend/supabase/schemas/" + f, "utf8"));
  for (const [key, id] of Object.entries(users)) {
    await db.query(
      "insert into auth.users(id,email,raw_user_meta_data) values($1,$2,$3)",
      [id, key + "@example.com", JSON.stringify({ name: key })],
    );
    const result = await db.query<{ id: number }>(
      "update public.sales set disabled=false,administrator=$1 where user_id=$2 returning id",
      [key === "admin", id],
    );
    members[key] = String(result.rows[0].id);
    await db.query(
      "insert into public.lead_user_roles(sales_id,role_code) values($1,$2)",
      [members[key], ["sale", "other"].includes(key) ? "telesale" : key],
    );
  }
});
afterAll(async () => {
  await db.close();
});
beforeEach(async () => {
  await db.exec("begin");
  clock = (await db.query<{ stamp: string }>("select now()::text as stamp"))
    .rows[0].stamp;
  await act("admin");
});
afterEach(async () => {
  await db.exec("rollback");
});
async function act(key: keyof typeof users) {
  await db.exec("set role authenticated");
  await db.query("select set_config('request.jwt.claim.sub',$1,true)", [
    users[key],
  ]);
}
async function command(
  c: object,
  version: number | null = null,
  request = randomUUID(),
) {
  return db.query(
    "select public.lead_command($1::jsonb,$2::uuid,$3::integer) as result",
    [JSON.stringify(c), request, version],
  );
}
async function snapshot() {
  return (
    await db.query<{ data: any }>("select public.lead_snapshot() as data")
  ).rows[0].data;
}
const publicInput = () => ({
  name: "Tài xế tự đăng ký",
  phone: "+84 912 345 678",
  city: "Hà Nội",
  vehicle: "Van",
  district: "Cầu Giấy",
  hasVehicle: "yes",
  callTime: "afternoon",
  documents: { cccd: true },
  note: "Tư vấn đăng ký",
  consent: true,
  website: "",
});
async function publicIntake(input: object, request = randomUUID()) {
  await db.exec("set role anon");
  return (
    await db.query<{ result: any }>(
      "select public.lead_public_intake($1::jsonb,$2::uuid) result",
      [JSON.stringify(input), request],
    )
  ).rows[0].result;
}

describe("public driver intake", () => {
  it("accepts anonymous intake, ignores forged CRM fields and hides profile identifiers", async () => {
    expect(
      await publicIntake({
        ...publicInput(),
        status: "Onboarded",
        sourceId: "hotline",
        actorId: members.admin,
        archived: true,
      }),
    ).toEqual({ accepted: true });
    await act("admin");
    const s = await snapshot();
    expect(s.leads).toHaveLength(1);
    expect(s.leads[0]).toMatchObject({
      phone: "0912345678",
      sourceId: "web",
      status: "New",
      archived: false,
      profile: {
        district: "Cầu Giấy",
        callTime: "afternoon",
        documents: { cccd: true },
      },
    });
    expect(s.receptions[0]).toMatchObject({
      actorId: "public-form",
      consentVersion: "driver-intake-v1",
    });
    expect(s.receptions[0].consentAt).toBeTruthy();
    expect(s.notices.some((n: any) => n.title.includes("form website"))).toBe(
      true,
    );
  });
  it("keeps existing archived profiles unchanged and records repeat submissions", async () => {
    const lead = await createLead();
    await command({ type: "archiveLead", id: lead.id }, lead.version);
    const before = (await snapshot()).leads[0];
    expect(await publicIntake({ ...publicInput(), phone: lead.phone })).toEqual(
      { accepted: true },
    );
    await act("admin");
    const s = await snapshot();
    expect(s.leads).toEqual([before]);
    expect(s.receptions).toHaveLength(2);
    expect(
      s.receptions.find((r: any) => r.actorId === "public-form").note,
    ).toContain("Buổi chiều");
  });
  it("retries with the same request ID do not create extra receptions", async () => {
    const request = randomUUID();
    await publicIntake(publicInput(), request);
    await publicIntake(publicInput(), request);
    await act("admin");
    const s = await snapshot();
    expect(s.leads).toHaveLength(1);
    expect(s.receptions).toHaveLength(1);
    await expect(
      publicIntake({ ...publicInput(), name: "Khác tên" }, request),
    ).rejects.toThrow("Mã gửi");
  });
  it.each([
    [{ consent: false }, "đồng ý"],
    [{ phone: "123" }, "10 chữ số"],
    [{ name: " " }, "họ và tên"],
    [{ city: " " }, "thành phố"],
    [{ vehicle: "Truck" }, "xe máy"],
    [{ website: "bot.example" }, "đồng ý"],
    [{ documents: { cccd: "true" } }, "giấy tờ"],
    [{ name: null }, "họ và tên"],
  ])(
    "rejects invalid or unconsented submissions %j",
    async (patch, message) => {
      await expect(
        publicIntake({ ...publicInput(), ...patch }),
      ).rejects.toThrow(message);
    },
  );
  it("limits repeated phone submissions server-side", async () => {
    for (let i = 0; i < 3; i++) await publicIntake(publicInput());
    await expect(publicIntake(publicInput())).rejects.toThrow("nhiều đăng ký");
  });
  it("does not grant anonymous access to leads, receipts or staff commands", async () => {
    await db.exec("reset role");
    const permission = await db.query<{
      leads: boolean;
      receipts: boolean;
      command: boolean;
    }>(
      `select has_table_privilege('anon','public.leads','select') leads, has_table_privilege('anon','private.lead_public_requests','select') receipts, has_function_privilege('anon','public.lead_command(jsonb,uuid,integer)','execute') command`,
    );
    expect(permission.rows[0]).toEqual({
      leads: false,
      receipts: false,
      command: false,
    });
  });
  it("disabling the web source pauses intake without saving a profile", async () => {
    await db.exec(
      "reset role; update public.lead_sources set data=data||'{\"active\":false}' where id='web'",
    );
    await expect(publicIntake(publicInput())).rejects.toThrow("tạm ngưng");
  });
});
async function attempt(c: object, version: number | null = null) {
  await db.exec("savepoint denial");
  try {
    await command(c, version);
    await db.exec("release savepoint denial");
    return "";
  } catch (e) {
    await db.exec("rollback to savepoint denial");
    return (e as Error).message;
  }
}
async function voice(p: object) {
  return (
    await db.query<{ result: any }>(
      "select public.lead_voice_staff($1::jsonb) result",
      [JSON.stringify(p)],
    )
  ).rows[0].result;
}
async function guest(
  invite: { id: string; token: string },
  client: string,
  p: object,
) {
  await db.exec("set role anon");
  return (
    await db.query<{ result: any }>(
      "select public.lead_voice_guest($1::uuid,$2,$3::uuid,$4::jsonb) result",
      [invite.id, invite.token, client, JSON.stringify(p)],
    )
  ).rows[0].result;
}
const testSdp = "v=0\r\no=- 123456789 1 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\n";
describe("browser voice calls", () => {
  it("records accepted connection and duration without changing consultation results", async () => {
    const lead = await createLead();
    const invite = await voice({ action: "prepare", leadId: lead.id });
    const phone = randomUUID();
    expect(invite.token).toHaveLength(64);
    expect(await guest(invite, phone, { action: "info" })).toHaveProperty(
      "expiresAt",
    );
    await guest(invite, phone, { action: "ready" });
    await act("admin");
    const ringing = await voice({
      action: "start",
      inviteId: invite.id,
      sdp: testSdp,
    });
    expect(ringing.call.status).toBe("ringing");
    const callId = ringing.call.id;
    expect(
      (await guest(invite, phone, { action: "accept", callId })).call.status,
    ).toBe("connecting");
    await guest(invite, phone, { action: "answer", callId, sdp: testSdp });
    await guest(invite, phone, { action: "connected", callId });
    await act("admin");
    expect(
      (await voice({ action: "connected", inviteId: invite.id, callId })).call
        .status,
    ).toBe("connected");
    await db.exec("reset role");
    await db.query(
      "update public.lead_voice_calls set connected_at=clock_timestamp()-interval '3 seconds' where id=$1",
      [callId],
    );
    const ended = await guest(invite, phone, { action: "end", callId });
    expect(ended.call.status).toBe("completed");
    expect(ended.call.durationSeconds).toBeGreaterThanOrEqual(3);
    expect(
      (await guest(invite, phone, { action: "end", callId })).call.endedAt,
    ).toBe(ended.call.endedAt);
    await act("admin");
    expect((await snapshot()).activities).toHaveLength(0);
    expect(
      (await voice({ action: "history", leadId: lead.id })).calls[0],
    ).not.toHaveProperty("offer");
  });
  it("rejects wrong tokens, private reads and concurrent receiver claims", async () => {
    const lead = await createLead();
    const invite = await voice({ action: "prepare", leadId: lead.id });
    const phone = randomUUID();
    await guest(invite, phone, { action: "ready" });
    await db.exec("savepoint wrong_phone");
    await expect(
      guest(invite, randomUUID(), { action: "ready" }),
    ).rejects.toThrow("thiết bị khác");
    await db.exec("rollback to savepoint wrong_phone");
    await db.exec("savepoint wrong_token");
    await expect(
      guest({ ...invite, token: "x".repeat(64) }, phone, { action: "poll" }),
    ).rejects.toThrow("Link không hợp lệ");
    await db.exec("rollback to savepoint wrong_token");
    await db.exec("reset role");
    const permissions = await db.query<{ read: boolean; staff: boolean }>(
      "select has_table_privilege('anon','public.lead_voice_calls','select') read,has_function_privilege('anon','public.lead_voice_staff(jsonb)','execute') staff",
    );
    expect(permissions.rows[0]).toEqual({ read: false, staff: false });
  });
  it("requires a ready phone and forbids viewers from creating calls", async () => {
    const lead = await createLead();
    const invite = await voice({ action: "prepare", leadId: lead.id });
    await db.exec("savepoint offline");
    await expect(
      voice({ action: "start", inviteId: invite.id, sdp: testSdp }),
    ).rejects.toThrow("chưa sẵn sàng");
    await db.exec("rollback to savepoint offline");
    await act("viewer");
    await expect(voice({ action: "prepare", leadId: lead.id })).rejects.toThrow(
      "không có quyền",
    );
  });
  it("records rejection and no answer with zero talk duration", async () => {
    const lead = await createLead();
    const invite = await voice({ action: "prepare", leadId: lead.id });
    const phone = randomUUID();
    await guest(invite, phone, { action: "ready" });
    await act("admin");
    const first = await voice({
      action: "start",
      inviteId: invite.id,
      sdp: testSdp,
    });
    const rejected = await guest(invite, phone, {
      action: "end",
      callId: first.call.id,
    });
    expect(rejected.call.status).toBe("rejected");
    expect(rejected.call.durationSeconds).toBe(0);
    await act("admin");
    const second = await voice({
      action: "start",
      inviteId: invite.id,
      sdp: testSdp,
    });
    await db.exec("reset role");
    await db.query(
      "update public.lead_voice_calls set started_at=clock_timestamp()-interval '1 minute' where id=$1",
      [second.call.id],
    );
    await act("admin");
    await voice({ action: "poll", inviteId: invite.id });
    const timeout = await db.query<{
      status: string;
      duration_seconds: number;
    }>(
      "select status,duration_seconds from public.lead_voice_calls where id=$1",
      [second.call.id],
    );
    expect(timeout.rows[0].status).toBe("no_answer");
    expect(timeout.rows[0].duration_seconds).toBe(0);
  });
  it("refuses a new call after its assigned ticket is closed", async () => {
    const ticket = await accepted();
    const invite = await voice({
      action: "prepare",
      leadId: ticket.leadId,
      ticketId: ticket.id,
    });
    await guest(invite, randomUUID(), { action: "ready" });
    await db.exec("reset role");
    await db.query(
      'update public.lead_assignments set data=data||\'{"status":"Closed"}\' where id=$1',
      [ticket.id],
    );
    await act("sale");
    await expect(
      voice({ action: "start", inviteId: invite.id, sdp: testSdp }),
    ).rejects.toThrow();
  });
});
async function createLead() {
  await command({
    type: "saveLead",
    input: {
      name: "Tài xế kiểm thử",
      phone: "0901234567",
      city: "Hà Nội",
      vehicle: "Motorbike",
      sourceId: "web",
      tags: [],
      note: "",
    },
  });
  return (await snapshot()).leads[0];
}
async function assign() {
  const l = await createLead();
  await command({ type: "assign", leadId: l.id, assigneeId: members.sale });
  return (await snapshot()).assignments[0];
}
async function accepted() {
  const t = await assign();
  await act("sale");
  await command({ type: "accept", id: t.id }, 1);
  return (await snapshot()).assignments[0];
}
const activity = () => ({
  channel: "call",
  at: clock,
  outcome: "no_answer",
  decision: "none",
  reason: "none",
  note: "Không nghe máy",
});
async function simulator(c: object) {
  return (
    await db.query<{ result: any }>(
      "select public.lead_simulator($1::jsonb) result",
      [JSON.stringify(c)],
    )
  ).rows[0].result;
}
async function receive(event: object) {
  await db.exec("reset role");
  const result = (
    await db.query<{ result: any }>(
      "select private.lead_core_receive($1::jsonb) result",
      [JSON.stringify(event)],
    )
  ).rows[0].result;
  await act("admin");
  return result;
}
async function source(link = true) {
  const l = await createLead();
  const d = await simulator({
    type: "createDriver",
    name: l.name,
    phone: l.phone,
  });
  if (link)
    await simulator({ type: "link", driverId: d.driverId, leadId: l.id });
  return { l, driverId: d.driverId };
}
async function event(driverId: string, eventType: string, extra: object = {}) {
  return (
    await simulator({
      type: "emit",
      driverId,
      eventType,
      occurredAt: clock,
      orderId: "ORDER-TEST",
      ...extra,
    })
  ).event;
}
describe("Simulator source, trusted receiver and milestones", () => {
  it.each([
    "account_created",
    "registration_pending",
    "order_received",
    "order_cancelled",
  ])("%s does not create milestones", async (type) => {
    const { driverId } = await source();
    expect((await receive(await event(driverId, type))).status).toBe("ignored");
    expect((await snapshot()).leads[0].status).toBe("New");
  });
  it("registration/first-order events update exactly one Lead, preserve actual dates, survive reload and solve pending work", async () => {
    const t = await assign();
    await command(
      {
        type: "activity",
        assignmentId: t.id,
        input: {
          ...activity(),
          outcome: "called",
          decision: "agreed",
          appointmentAt: new Date(
            new Date(clock).getTime() + 3600000,
          ).toISOString(),
          place: "Văn phòng thử",
        },
      },
      t.version,
    );
    let s = await snapshot();
    const d = await simulator({
      type: "createDriver",
      name: s.leads[0].name,
      phone: s.leads[0].phone,
    });
    await simulator({ type: "link", driverId: d.driverId, leadId: t.leadId });
    const past = new Date(new Date(clock).getTime() - 86400000).toISOString();
    const reg = await event(d.driverId, "registration_completed", {
      occurredAt: past,
    });
    expect((await receive(reg)).status).toBe("processed");
    s = await snapshot();
    expect(s.leads[0].status).toBe("Activated");
    expect(new Date(s.leads[0].activatedAt).toISOString()).toBe(past);
    expect(s.leads[0].activatedSource).toBe("simulator");
    expect(s.assignments[0].status).toBe("Solved");
    expect(s.activities).toHaveLength(1);
    expect(s.appointments[0].status).toBe("cancelled");
    expect((await receive(reg)).status).toBe("processed");
    expect((await snapshot()).leads[0].version).toBe(s.leads[0].version);
    expect((await receive({ ...reg, phone: "0909999999" })).status).toBe(
      "id_collision",
    );
    expect(
      (await receive(await event(d.driverId, "first_order_completed"))).status,
    ).toBe("processed");
    s = await snapshot();
    expect(s.leads[0].status).toBe("Onboarded");
    expect(s.report.registered).toBe(1);
    expect(s.report.onboarded).toBe(1);
    const data = await simulator({ type: "snapshot" });
    expect(data.events).toHaveLength(2);
    expect(data.attempts.some((x: any) => x.status === "id_collision")).toBe(
      true,
    );
  });
  it("waits for mapping, then retries the immutable source event", async () => {
    const { l, driverId } = await source(false);
    const reg = await event(driverId, "registration_completed");
    expect((await receive(reg)).status).toBe("waiting_link");
    expect((await snapshot()).leads[0].status).toBe("New");
    await simulator({ type: "link", driverId, leadId: l.id });
    expect((await receive(reg)).status).toBe("processed");
  });
  it("waits for late registration without inventing a registration date", async () => {
    const { driverId } = await source();
    const first = await event(driverId, "first_order_completed");
    expect((await receive(first)).status).toBe("waiting_registration");
    await receive(
      await event(driverId, "registration_completed", {
        occurredAt: new Date(new Date(clock).getTime() - 60000).toISOString(),
      }),
    );
    expect((await snapshot()).leads[0].status).toBe("Onboarded");
  });
  it("rejects identity mismatch and actual first-order time before registration", async () => {
    const { driverId } = await source();
    const reg = await event(driverId, "registration_completed");
    expect(
      (await receive({ ...reg, eventId: randomUUID(), phone: "0909999999" }))
        .status,
    ).toBe("conflict");
    await receive(reg);
    expect(
      (
        await receive(
          await event(driverId, "first_order_completed", {
            occurredAt: new Date(
              new Date(clock).getTime() - 60000,
            ).toISOString(),
          }),
        )
      ).status,
    ).toBe("conflict");
  });
  it("does not reopen Closed or overwrite a correction", async () => {
    const { l, driverId } = await source();
    await command(
      { type: "leadStatus", id: l.id, status: "Closed", reason: "Ngừng" },
      1,
    );
    expect(
      (await receive(await event(driverId, "registration_completed"))).status,
    ).toBe("conflict");
    await command(
      {
        type: "correctMilestone",
        id: l.id,
        status: "New",
        reason: "Đính chính",
      },
      2,
    );
    expect(
      (await receive(await event(driverId, "registration_completed"))).status,
    ).toBe("conflict");
  });
  it("keeps archived Leads and invalid future events unchanged with a retained rejection", async () => {
    const { l, driverId } = await source();
    await command({ type: "archiveLead", id: l.id }, 1);
    const e = await event(driverId, "registration_completed");
    expect((await receive(e)).status).toBe("conflict");
    expect(
      (
        await receive({
          ...e,
          eventId: randomUUID(),
          occurredAt: "2100-01-01T00:00:00Z",
        })
      ).status,
    ).toBe("rejected");
    expect((await snapshot()).leads[0].status).toBe("New");
    expect((await simulator({ type: "snapshot" })).inbox).toHaveLength(2);
  });
  it("denies non-admin simulation and direct receiver calls from authenticated clients", async () => {
    await source();
    await act("sale");
    await db.exec("savepoint denied");
    await expect(
      simulator({ type: "createDriver", name: "X", phone: "0909999999" }),
    ).rejects.toThrow("Admin/Tiếp nhận");
    await db.exec("rollback to savepoint denied");
    await expect(
      db.query("select private.lead_core_receive('{}'::jsonb)"),
    ).rejects.toThrow("permission denied");
    await db.exec("rollback to savepoint denied");
    await act("intake");
    await expect(
      simulator({ type: "createDriver", name: "X", phone: "0909999999" }),
    ).rejects.toThrow("Chỉ Admin");
  });
});
describe("PostgreSQL commands, RLS and transactions", () => {
  it("appointment correction voids the derived missed count without reopening the appointment", async () => {
    const t = await accepted();
    await command(
      {
        type: "activity",
        assignmentId: t.id,
        input: {
          ...activity(),
          outcome: "called",
          decision: "agreed",
          appointmentAt: new Date(
            new Date(clock).getTime() + 3600000,
          ).toISOString(),
          place: "Văn phòng",
        },
      },
      t.version,
    );
    let s = await snapshot();
    const ap = s.appointments[0];
    await db.exec("reset role");
    await db.query(
      "update public.lead_appointments set due_at=now(),data=data||jsonb_build_object('at',now()) where id=$1",
      [ap.id],
    );
    await act("sale");
    await command(
      { type: "appointment", id: ap.id, status: "missed" },
      s.assignments[0].version,
    );
    s = await snapshot();
    await command(
      {
        type: "correctAppointment",
        id: ap.id,
        status: "attended",
        reason: "Nhân viên xác nhận đã đến",
      },
      s.assignments[0].version,
    );
    s = await snapshot();
    expect(s.appointments[0].status).toBe("attended");
    expect(
      s.activities.find((a: any) => a.appointmentId === ap.id).voidedAt,
    ).toBeTruthy();
  });
  it("persistent import batches resume without duplicate Leads and flag duplicates inside one file", async () => {
    const batch = async (c: object) =>
      (
        await db.query<{ result: any }>(
          "select public.lead_import($1::jsonb) result",
          [JSON.stringify(c)],
        )
      ).rows[0].result;
    const id = randomUUID(),
      input = {
        name: "Lô nhập",
        phone: "0901111111",
        city: "Hà Nội",
        vehicle: "Motorbike",
        sourceId: "web",
        tags: [],
        note: "",
        receivedAt: "2026-01-01T09:00:00+07:00",
      };
    await batch({
      type: "create",
      id,
      fileName: "test.csv",
      rows: [
        input,
        { ...input, phone: "+84901111111" },
        { ...input, phone: "bad" },
      ],
    });
    expect((await batch({ type: "row", id, index: 0 })).status).toBe("saved");
    expect((await batch({ type: "row", id, index: 0 })).status).toBe("saved");
    expect((await batch({ type: "row", id, index: 1 })).status).toBe("skipped");
    expect((await batch({ type: "row", id, index: 2 })).status).toBe("failed");
    expect((await snapshot()).leads).toHaveLength(1);
    expect(new Date((await snapshot()).leads[0].receivedAt).toISOString()).toBe(
      "2026-01-01T02:00:00.000Z",
    );
    expect(
      Object.keys((await batch({ type: "get", id })).results),
    ).toHaveLength(3);
    await act("sale");
    await expect(batch({ type: "get", id })).rejects.toThrow("Chỉ tiếp nhận");
  });
  it("amended review retains prior result and requires a fresh version", async () => {
    const t = await assign();
    await command(
      { type: "ticketStatus", id: t.id, status: "Closed", reason: "Bàn giao" },
      t.version,
    );
    const r = (await snapshot()).reviews[0];
    await command(
      { type: "review", id: r.id, note: "Cần đối soát", result: "follow_up" },
      1,
    );
    expect(
      await attempt({
        type: "assign",
        leadId: t.leadId,
        assigneeId: members.other,
      }),
    ).toContain("chưa đủ điều kiện");
    expect(
      await attempt(
        {
          type: "amendReview",
          id: r.id,
          note: "Đủ điều kiện",
          result: "eligible",
          reason: "Đã kiểm tra",
        },
        1,
      ),
    ).toContain("thay đổi");
    await command(
      {
        type: "amendReview",
        id: r.id,
        note: "Đủ điều kiện",
        result: "eligible",
        reason: "Đã kiểm tra",
      },
      2,
    );
    const s = await snapshot();
    expect(s.reviews[0].history[0].result).toBe("follow_up");
    await command({
      type: "assign",
      leadId: t.leadId,
      assigneeId: members.other,
    });
  });
  it("editing does not create a reception; explicit reception and historical creation preserve first source/date", async () => {
    const l = await createLead();
    await command(
      { type: "saveLead", id: l.id, input: { ...l, city: "HCM" } },
      l.version,
    );
    let s = await snapshot();
    expect(s.receptions).toHaveLength(1);
    await command(
      {
        type: "receiveLead",
        id: l.id,
        sourceId: "hotline",
        reason: "Liên hệ lại",
      },
      s.leads[0].version,
    );
    s = await snapshot();
    expect(s.receptions).toHaveLength(2);
    expect(s.leads[0].sourceId).toBe("web");
  });
  it("chat unresponsive does not count as missed calls and preserves backdated activity identity", async () => {
    let t = await accepted();
    for (let n = 0; n < 3; n++) {
      await command(
        {
          type: "activity",
          assignmentId: t.id,
          input: { ...activity(), channel: "zalo", outcome: "unresponsive" },
        },
        t.version,
      );
      t = (await snapshot()).assignments[0];
    }
    expect(t.status).toBe("Open");
    expect(
      (await snapshot()).activities.every(
        (a: any) => a.outcome === "unresponsive",
      ),
    ).toBe(true);
    expect(
      await attempt(
        {
          type: "activity",
          assignmentId: t.id,
          input: { ...activity(), channel: "zalo" },
        },
        t.version,
      ),
    ).toContain("Chưa phản hồi");
  });
  it("review cannot be overwritten, and pending handover blocks reassignment", async () => {
    const t = await assign();
    await command(
      { type: "ticketStatus", id: t.id, status: "Closed", reason: "Rà soát" },
      t.version,
    );
    const r = (await snapshot()).reviews[0];
    expect(
      await attempt({
        type: "assign",
        leadId: t.leadId,
        assigneeId: members.other,
      }),
    ).toContain("bàn giao");
    await command(
      { type: "review", id: r.id, note: "Đủ điều kiện", result: "eligible" },
      1,
    );
    expect(
      await attempt({ type: "review", id: r.id, note: "Ghi đè" }, 1),
    ).toContain("đã được xác nhận");
    await command({
      type: "assign",
      leadId: t.leadId,
      assigneeId: members.other,
    });
    expect((await snapshot()).reviews[0].note).toBe("Đủ điều kiện");
  });
  it("voiding preserves history and counts without silently reopening Solved", async () => {
    let t = await accepted();
    for (let n = 0; n < 3; n++) {
      await command(
        { type: "activity", assignmentId: t.id, input: activity() },
        t.version,
      );
      t = (await snapshot()).assignments[0];
    }
    const activityId = (await snapshot()).activities[0].id;
    await command(
      { type: "voidActivity", id: activityId, reason: "Nhập nhầm" },
      t.version,
    );
    const s = await snapshot();
    expect(s.activities).toHaveLength(3);
    expect(
      s.activities.find((a: any) => a.id === activityId).voidedAt,
    ).toBeTruthy();
    expect(s.assignments[0].status).toBe("Solved");
  });
  it("milestone correction removes invalid dates and keeps closed tickets closed", async () => {
    const t = await assign();
    await command(
      {
        type: "leadStatus",
        id: t.leadId,
        status: "Activated",
        reason: "Thủ công",
      },
      1,
    );
    await command(
      {
        type: "correctMilestone",
        id: t.leadId,
        status: "New",
        reason: "Sai hồ sơ",
      },
      2,
    );
    const s = await snapshot();
    expect(s.leads[0].activatedAt).toBeUndefined();
    expect(s.leads[0].coreCorrectionAt).toBeTruthy();
    expect(s.assignments[0].status).toBe("Solved");
    expect(s.report.registered).toBe(0);
  });
  it("creates one Lead, reception and audit; rejects normalized duplicate", async () => {
    const l = await createLead();
    expect(l.status).toBe("New");
    expect((await snapshot()).receptions).toHaveLength(1);
    expect(
      await attempt({
        type: "saveLead",
        input: { ...l, phone: "+84901234567" },
      }),
    ).toContain("đã có");
    expect((await snapshot()).leads).toHaveLength(1);
  });
  it("rejects direct table writes even with an authenticated account", async () => {
    await createLead();
    await db.exec("savepoint direct_write");
    try {
      await db.exec(
        'update public.leads set data=data||\'{"status":"Activated"}\'',
      );
      throw new Error("Unexpected write access");
    } catch (e) {
      await db.exec("rollback to savepoint direct_write");
      expect((e as Error).message).toContain("permission denied");
    }
  });
  it("viewer gets aggregate report and no raw Lead data", async () => {
    await assign();
    await act("viewer");
    const view = await snapshot();
    expect(view.leads).toEqual([]);
    expect(view.assignments).toEqual([]);
    expect(view.report.total).toBe(1);
    expect(JSON.stringify(view.report)).not.toContain("0901234567");
    expect(await attempt({ type: "source", name: "Forbidden" })).toContain(
      "quản trị",
    );
  });
  it("requires acceptance and denies another assignee", async () => {
    const t = await assign();
    await act("sale");
    expect(
      await attempt(
        { type: "activity", assignmentId: t.id, input: activity() },
        1,
      ),
    ).toContain("Nhận việc");
    await act("other");
    expect((await snapshot()).assignments).toEqual([]);
    expect(await attempt({ type: "accept", id: t.id }, 1)).toContain("quyền");
  });
  it("solves at three, rejects a fourth, reopens a clean round", async () => {
    let t = await accepted();
    for (let n = 1; n <= 3; n++) {
      await command(
        { type: "activity", assignmentId: t.id, input: activity() },
        t.version,
      );
      t = (await snapshot()).assignments[0];
      expect(t.status).toBe(n < 3 ? "Open" : "Solved");
    }
    expect(
      await attempt(
        { type: "activity", assignmentId: t.id, input: activity() },
        t.version,
      ),
    ).toContain("đang xử lý");
    await command(
      {
        type: "ticketStatus",
        id: t.id,
        status: "Open",
        reason: "Tài xế muốn liên hệ lại",
      },
      t.version,
    );
    t = (await snapshot()).assignments[0];
    expect(t.round).toBe(2);
    await command(
      { type: "activity", assignmentId: t.id, input: activity() },
      t.version,
    );
    expect((await snapshot()).assignments[0].status).toBe("Open");
    expect((await snapshot()).activities).toHaveLength(4);
  });
  it("replays identical request once and rejects stale versions", async () => {
    const t = await accepted();
    const c = { type: "activity", assignmentId: t.id, input: activity() },
      key = randomUUID();
    await command(c, t.version, key);
    await command(c, t.version, key);
    expect((await snapshot()).activities).toHaveLength(1);
    expect(await attempt(c, t.version)).toContain("đã thay đổi");
  });
  it("rolls back Activity and appointment together when the appointment is invalid", async () => {
    const t = await accepted();
    expect(
      await attempt(
        {
          type: "activity",
          assignmentId: t.id,
          input: {
            ...activity(),
            outcome: "called",
            decision: "agreed",
            appointmentAt: "2020-01-01T00:00:00Z",
            place: "Văn phòng",
          },
        },
        t.version,
      ),
    ).toContain("Lịch hẹn");
    expect((await snapshot()).activities).toEqual([]);
    expect((await snapshot()).assignments[0].version).toBe(t.version);
  });
  it("transfer closes old ticket, preserves history and revokes old assignee access", async () => {
    const t = await accepted();
    await command(
      { type: "activity", assignmentId: t.id, input: activity() },
      t.version,
    );
    await act("admin");
    await command({
      type: "assign",
      leadId: t.leadId,
      assigneeId: members.other,
      transfer: true,
    });
    const s = await snapshot();
    expect(s.assignments).toHaveLength(2);
    expect(s.reviews).toHaveLength(1);
    expect(s.activities).toHaveLength(1);
    await act("sale");
    expect((await snapshot()).leads).toEqual([]);
    expect((await snapshot()).activities).toEqual([]);
    await act("other");
    expect((await snapshot()).assignments).toHaveLength(2);
  });
  it("activation solves the ticket without making Lead Closed", async () => {
    const t = await assign();
    await act("intake");
    await command(
      {
        type: "leadStatus",
        id: t.leadId,
        status: "Activated",
        reason: "Đã đối chiếu đăng ký",
      },
      1,
    );
    const s = await snapshot();
    expect(s.leads[0].status).toBe("Activated");
    expect(s.assignments[0].status).toBe("Solved");
    expect(s.report.registered).toBe(1);
  });
  it("closes expired tickets once and keeps Lead New", async () => {
    const t = await assign();
    await db.exec("reset role");
    await db.query(
      "update public.lead_assignments set data=data||jsonb_build_object('expiresAt',now()-interval '1 second'),expires_at=now()-interval '1 second' where id=$1",
      [t.id],
    );
    await db.exec(
      "select public.lead_run_jobs();select public.lead_run_jobs();",
    );
    await act("admin");
    const s = await snapshot();
    expect(s.assignments[0].status).toBe("Closed");
    expect(s.reviews).toHaveLength(1);
    expect(s.leads[0].status).toBe("New");
    await act("sale");
    expect((await snapshot()).assignments).toEqual([]);
  });
  it("does not let public signup grant a role to itself", async () => {
    await db.exec("reset role");
    const user = randomUUID();
    await db.query("insert into auth.users(id,email) values($1,$2)", [
      user,
      "pending@example.com",
    ]);
    await db.exec("set role authenticated");
    await db.query("select set_config('request.jwt.claim.sub',$1,true)", [
      user,
    ]);
    expect(
      await attempt({ type: "source", name: "Privilege escalation" }),
    ).toContain("chưa được cấp quyền");
  });
  it("keeps a Solved ticket before expiry and closes it exactly at expiry", async () => {
    const t = await accepted();
    await command(
      {
        type: "ticketStatus",
        id: t.id,
        status: "Solved",
        reason: "Kết thúc chăm sóc",
      },
      t.version,
    );
    await db.exec("reset role");
    await db.query(
      "update public.lead_assignments set expires_at=now()+interval '1 millisecond',data=data||jsonb_build_object('expiresAt',now()+interval '1 millisecond') where id=$1",
      [t.id],
    );
    await db.exec("select public.lead_run_jobs()");
    await act("admin");
    expect((await snapshot()).assignments[0].status).toBe("Solved");
    await db.exec("reset role");
    await db.query(
      "update public.lead_assignments set expires_at=now(),data=data||jsonb_build_object('expiresAt',now()) where id=$1",
      [t.id],
    );
    await db.exec(
      "select public.lead_run_jobs();select public.lead_run_jobs()",
    );
    await act("admin");
    const s = await snapshot();
    expect(s.assignments[0].status).toBe("Closed");
    expect(s.reviews).toHaveLength(1);
  });
  it("rejects concurrent assignments instead of creating two live tickets", async () => {
    const t = await assign();
    expect(
      await attempt({
        type: "assign",
        leadId: t.leadId,
        assigneeId: members.other,
      }),
    ).toContain("đang hiệu lực");
    expect((await snapshot()).assignments).toHaveLength(1);
  });
  it("leader sees its team but cannot assign to another team", async () => {
    const l = await createLead();
    await db.exec("reset role");
    await db.exec(
      "insert into public.lead_teams(id,name) values('other-team','Other team')",
    );
    await db.query(
      "update public.lead_user_roles set team_id='other-team' where sales_id=$1",
      [members.other],
    );
    await act("leader");
    expect((await snapshot()).leads).toHaveLength(1);
    expect(
      await attempt({
        type: "assign",
        leadId: l.id,
        assigneeId: members.other,
      }),
    ).toContain("trong nhóm");
    await act("admin");
    await command({ type: "assign", leadId: l.id, assigneeId: members.other });
    await act("leader");
    expect((await snapshot()).leads).toEqual([]);
    expect((await snapshot()).report.total).toBe(0);
  });
  it("counts each missed appointment once and solves after the third", async () => {
    let t = await accepted();
    for (let n = 1; n <= 3; n++) {
      await command(
        {
          type: "activity",
          assignmentId: t.id,
          input: {
            ...activity(),
            outcome: "called",
            decision: "agreed",
            appointmentAt: new Date(Date.parse(clock) + 3600000).toISOString(),
            place: "Văn phòng",
          },
        },
        t.version,
      );
      let s = await snapshot();
      t = s.assignments[0];
      const ap = s.appointments.find((a: any) => a.status === "scheduled");
      expect(
        await attempt(
          { type: "appointment", id: ap.id, status: "missed" },
          t.version,
        ),
      ).toContain("chưa đến giờ");
      await db.exec("reset role");
      await db.query(
        "update public.lead_appointments set due_at=now()-interval '1 minute',data=data||jsonb_build_object('at',now()-interval '1 minute') where id=$1",
        [ap.id],
      );
      await act("sale");
      await command(
        { type: "appointment", id: ap.id, status: "missed" },
        t.version,
      );
      s = await snapshot();
      t = s.assignments[0];
      expect(t.status).toBe(n < 3 ? "Open" : "Solved");
      expect(
        s.activities.filter((a: any) => a.outcome === "overdue"),
      ).toHaveLength(n);
      expect(
        await attempt(
          { type: "appointment", id: ap.id, status: "missed" },
          t.version,
        ),
      ).toContain("quyền xử lý");
    }
  });
  it("rescheduling preserves cancelled history and jobs send each notice once", async () => {
    let t = await accepted();
    await command(
      {
        type: "activity",
        assignmentId: t.id,
        input: {
          ...activity(),
          outcome: "called",
          decision: "agreed",
          appointmentAt: new Date(Date.parse(clock) + 7200000).toISOString(),
          place: "Văn phòng cũ",
        },
      },
      t.version,
    );
    let s = await snapshot();
    t = s.assignments[0];
    const original = s.appointments[0];
    await command(
      {
        type: "reschedule",
        id: original.id,
        at: new Date(Date.parse(clock) + 10800000).toISOString(),
        place: "Văn phòng mới",
      },
      t.version,
    );
    s = await snapshot();
    expect(s.appointments).toHaveLength(2);
    expect(s.appointments.find((a: any) => a.id === original.id).status).toBe(
      "cancelled",
    );
    const current = s.appointments.find((a: any) => a.status === "scheduled");
    expect(current.previousId).toBe(original.id);
    await db.exec("reset role");
    await db.query(
      "update public.lead_appointments set due_at=now()+interval '30 minutes',data=data||jsonb_build_object('at',now()+interval '30 minutes','createdAt',now()-interval '2 hours') where id=$1",
      [current.id],
    );
    await db.exec(
      "select public.lead_run_jobs();select public.lead_run_jobs()",
    );
    await act("sale");
    expect((await snapshot()).notices).toHaveLength(1);
    await db.exec("reset role");
    await db.query(
      "update public.lead_appointments set due_at=now()-interval '1 minute',data=data||jsonb_build_object('at',now()-interval '1 minute') where id=$1",
      [current.id],
    );
    await db.exec(
      "select public.lead_run_jobs();select public.lead_run_jobs()",
    );
    await act("sale");
    expect((await snapshot()).notices).toHaveLength(2);
  });
  it("evidence requires a live assignment and the old owner loses file access", async () => {
    let t = await accepted();
    await command(
      { type: "activity", assignmentId: t.id, input: activity() },
      t.version,
    );
    const s = await snapshot();
    t = s.assignments[0];
    const attachment = {
      path: `${members.sale}/${t.id}/test.png`,
      name: "test.png",
      type: "image/png",
      size: 1,
    };
    await db.query(
      "insert into storage.objects(bucket_id,name) values('lead-evidence',$1)",
      [attachment.path],
    );
    await command(
      { type: "attachment", activityId: s.activities[0].id, attachment },
      t.version,
    );
    expect(
      (await db.query("select name from storage.objects")).rows,
    ).toHaveLength(1);
    await act("other");
    expect(
      (await db.query("select name from storage.objects")).rows,
    ).toHaveLength(0);
    await act("admin");
    await command({
      type: "assign",
      leadId: t.leadId,
      assigneeId: members.other,
      transfer: true,
    });
    await act("sale");
    expect(
      (await db.query("select name from storage.objects")).rows,
    ).toHaveLength(0);
  });
  it("report filters reject reversed dates and avoid double counting a transferred Lead", async () => {
    const t = await assign();
    await command({
      type: "assign",
      leadId: t.leadId,
      assigneeId: members.other,
      transfer: true,
    });
    const report = async (filters: object) =>
      (
        await db.query<{ data: any }>(
          "select public.lead_report($1::jsonb) as data",
          [JSON.stringify(filters)],
        )
      ).rows[0].data;
    expect((await report({})).total).toBe(1);
    expect((await report({ member: members.sale })).total).toBe(0);
    expect((await report({ member: members.other })).total).toBe(1);
    await expect(
      report({ from: "2026-10-22", to: "2026-10-21" }),
    ).rejects.toThrow("Ngày kết thúc");
  });
});
