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
const users: Record<string, string> = {},
  members: Record<string, string> = {};
beforeAll(async () => {
  await db.exec(
    `create role anon; create role authenticated; create role service_role; create schema auth; create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}');create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table storage.objects(bucket_id text,name text,metadata jsonb,primary key(bucket_id,name));alter table storage.objects enable row level security;grant usage on schema storage,auth to authenticated;grant select,insert on storage.objects to authenticated;`,
  );
  for (const f of (await readdir("backend/supabase/schemas"))
    .filter((f) => /^(1[0-46-9]|2[0-5])_/.test(f))
    .sort())
    await db.exec(await readFile("backend/supabase/schemas/" + f, "utf8"));
  for (const [key, role] of Object.entries({
    admin: "admin",
    intake: "intake",
    leader: "leader",
    sale: "telesale",
    other: "telesale",
  })) {
    users[key] = randomUUID();
    await db.query(
      "insert into auth.users(id,email,raw_user_meta_data) values($1,$2,$3)",
      [users[key], key + "@example.com", JSON.stringify({ name: key })],
    );
    members[key] = String(
      (
        await db.query<{ id: number }>(
          "update public.sales set disabled=false where user_id=$1 returning id",
          [users[key]],
        )
      ).rows[0].id,
    );
    await db.query(
      "insert into public.lead_user_roles(sales_id,role_code) values($1,$2)",
      [members[key], role],
    );
  }
});
afterAll(() => db.close());
beforeEach(async () => {
  await db.exec("begin");
  await act("intake");
});
afterEach(() => db.exec("rollback"));
async function act(key: string) {
  await db.exec("set role authenticated");
  await db.query("select set_config('request.jwt.claim.sub',$1,true)", [
    users[key],
  ]);
}
async function snap() {
  return (await db.query<{ v: any }>("select public.lead_snapshot() v")).rows[0]
    .v;
}
async function command(
  c: object,
  version: number | null = null,
  request = randomUUID(),
) {
  return db.query(
    "select public.lead_command($1::jsonb,$2::uuid,$3::integer)",
    [JSON.stringify(c), request, version],
  );
}
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
async function setup() {
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
  const l = (await snap()).leads[0];
  await act("leader");
  await command({ type: "assign", leadId: l.id, assigneeId: members.sale });
  const t = (await snap()).assignments[0];
  await act("sale");
  await command({ type: "accept", id: t.id }, 1);
  return { l, t: { ...t, version: 2 } };
}
async function evidence(ticket: string) {
  const path = `${members.sale}/${ticket}/call.wav`;
  await db.exec("reset role");
  await db.query("insert into storage.objects values('lead-evidence',$1,$2)", [
    path,
    JSON.stringify({ mimetype: "audio/wav", size: 20 }),
  ]);
  await act("sale");
  return { path, name: "call.wav", type: "audio/wav", size: 20 };
}
async function input() {
  return {
    channel: "call",
    at: (await db.query<{ v: string }>("select now()::text v")).rows[0].v,
    outcome: "called",
    decision: "none",
    reason: "none",
    note: "Đã trao đổi",
    ticketStatus: "Open",
  };
}
async function appointmentFixture(t: any, l: any) {
  await db.exec("reset role");
  await db.query(
    "update public.lead_assignments set data=data||jsonb_build_object('expiresAt','2030-01-01T00:00:00Z'),expires_at='2030-01-01T00:00:00Z' where id=$1",
    [t.id],
  );
  const aid = "fixture-activity";
  await db.query("insert into public.lead_activities(data) values($1)", [
    JSON.stringify({
      id: aid,
      assignmentId: t.id,
      leadId: l.id,
      round: 1,
      actorId: members.sale,
      channel: "call",
      at: "2026-10-24T01:00:00Z",
      outcome: "called",
      decision: "agreed",
      reason: "none",
      note: "Fixture",
    }),
  ]);
  await db.query(
    "insert into public.lead_appointments(data,due_at) values($1,'2026-10-24T03:00:00Z')",
    [
      JSON.stringify({
        id: "fixture-appointment",
        assignmentId: t.id,
        leadId: l.id,
        activityId: aid,
        actorId: members.sale,
        at: "2026-10-24T03:00:00Z",
        place: "văn phòng HN1",
        status: "scheduled",
        round: 1,
      }),
    ],
  );
}
describe("Reviewed workflow and server authorization", () => {
  it("Admin has no business records or commands; intake cannot read care evidence", async () => {
    const { l, t } = await setup();
    await act("admin");
    const s = await snap();
    expect(s.leads).toEqual([]);
    expect(s.assignments).toEqual([]);
    expect(
      await attempt({
        type: "assign",
        leadId: l.id,
        assigneeId: members.other,
      }),
    ).toContain("chỉ quản lý tài khoản");
    expect((await db.query("select * from public.leads")).rows).toHaveLength(0);
    await act("intake");
    expect(
      (await db.query("select * from public.lead_assignments")).rows,
    ).toHaveLength(0);
    await act("sale");
    expect((await snap()).assignments[0].id).toBe(t.id);
  });
  it("requires evidence and a status atomically; authenticates actual storage metadata", async () => {
    const { t } = await setup();
    const i = await input();
    expect(
      await attempt({ type: "activity", assignmentId: t.id, input: i }, 2),
    ).toContain("bằng chứng");
    const f = await evidence(t.id);
    expect(
      await attempt(
        {
          type: "activity",
          assignmentId: t.id,
          input: { ...i, ticketStatus: "", attachments: [f] },
        },
        2,
      ),
    ).toContain("trạng thái");
    expect(
      await attempt(
        {
          type: "activity",
          assignmentId: t.id,
          input: { ...i, attachments: [{ ...f, type: "image/png" }] },
        },
        2,
      ),
    ).toContain("Tệp chưa tải");
    const req = randomUUID(),
      c = {
        type: "activity",
        assignmentId: t.id,
        input: { ...i, attachments: [f] },
      };
    await command(c, 2, req);
    await command(c, 2, req);
    const s = await snap();
    expect(s.activities).toHaveLength(1);
    expect(s.activities[0].attachments).toEqual([f]);
    expect(s.assignments[0].status).toBe("Open");
    expect(
      await attempt(
        { type: "voidActivity", id: s.activities[0].id, reason: "test" },
        3,
      ),
    ).toContain("không còn");
  });
  it("Activated contact does not grant Telesale permission to change the Lead", async () => {
    const { l, t } = await setup();
    const f = await evidence(t.id);
    await command(
      {
        type: "activity",
        assignmentId: t.id,
        input: { ...(await input()), outcome: "activated", attachments: [f] },
      },
      2,
    );
    expect((await snap()).leads[0].status).toBe("New");
    expect(
      await attempt(
        { type: "leadStatus", id: l.id, status: "Activated", reason: "test" },
        1,
      ),
    ).toContain("Không có quyền");
  });
  it("waits after due time; settles at 08:00 once, even after job catch-up", async () => {
    const { l, t } = await setup();
    await appointmentFixture(t, l);
    await db.query(
      "select private.lead_settle_appointments('2026-10-24T03:00:00Z')",
    );
    expect(
      (
        await db.query<{ status: string }>(
          "select status from public.lead_appointments",
        )
      ).rows[0].status,
    ).toBe("waiting");
    await db.query(
      "select private.lead_settle_appointments('2026-10-25T00:59:59Z')",
    );
    expect(
      (
        await db.query(
          "select * from public.lead_activities where appointment_id is not null",
        )
      ).rows,
    ).toHaveLength(0);
    await db.query(
      "select private.lead_settle_appointments('2026-10-25T01:00:00Z')",
    );
    await db.query(
      "select private.lead_settle_appointments('2026-10-26T01:00:00Z')",
    );
    expect(
      (
        await db.query<{ status: string }>(
          "select status from public.lead_appointments",
        )
      ).rows[0].status,
    ).toBe("failed");
    expect(
      (
        await db.query(
          "select * from public.lead_activities where appointment_id is not null",
        )
      ).rows,
    ).toHaveLength(1);
  });
  it("uses actual registration date; preserves cancelled appointments", async () => {
    const { l, t } = await setup();
    await appointmentFixture(t, l);
    await db.query(
      'update public.leads set data=data||\'{"activatedAt":"2026-10-24T05:00:00Z","status":"Activated"}\' where id=$1',
      [l.id],
    );
    await db.query(
      "select private.lead_settle_appointments('2026-10-25T01:00:00Z')",
    );
    expect(
      (
        await db.query<{ status: string }>(
          "select status from public.lead_appointments",
        )
      ).rows[0].status,
    ).toBe("succeeded");
    await db.query(
      'update public.lead_appointments set data=data||\'{"status":"cancelled"}\'',
    );
    await db.query(
      "select private.lead_settle_appointments('2026-10-26T01:00:00Z')",
    );
    expect(
      (
        await db.query<{ status: string }>(
          "select status from public.lead_appointments",
        )
      ).rows[0].status,
    ).toBe("cancelled");
  });
  it("keeps only the former assignee's own ticket history after a transfer", async () => {
    const { l, t } = await setup();
    await act("leader");
    await command({
      type: "assign",
      leadId: l.id,
      assigneeId: members.other,
      transfer: true,
    });
    await act("sale");
    const old = await snap();
    expect(old.leads).toHaveLength(0);
    expect(old.assignments).toHaveLength(1);
    expect(old.assignments[0].id).toBe(t.id);
    expect(old.assignments[0].leadSnapshot.phone).toBe(l.phone);
    await act("other");
    const next = await snap();
    expect(next.assignments).toHaveLength(1);
    expect(next.assignments[0].assigneeId).toBe(members.other);
  });
  it("review updates the Lead with exactly two outcomes; rejects downgrading successful Leads", async () => {
    const { t } = await setup();
    await act("leader");
    await command(
      {
        type: "ticketStatus",
        id: t.id,
        status: "Closed",
        reason: "Không còn nhu cầu",
      },
      2,
    );
    await act("intake");
    let s = await snap();
    const r = s.reviews[0];
    expect(
      await attempt(
        { type: "review", id: r.id, note: "test", result: "follow_up" },
        1,
      ),
    ).toContain("Đủ điều kiện");
    await command(
      { type: "review", id: r.id, note: "Không còn nhu cầu", result: "closed" },
      1,
    );
    s = await snap();
    expect(s.leads[0].status).toBe("Closed");
    expect(s.reviews[0].result).toBe("closed");
    await db.exec("reset role");
    await db.query(
      "update public.leads set data=data||jsonb_build_object('status','Activated','activatedAt',now())",
    );
    await act("intake");
    expect(
      await attempt(
        {
          type: "amendReview",
          id: r.id,
          note: "test",
          result: "eligible",
          reason: "test",
        },
        2,
      ),
    ).toContain("đã thành công");
  });
  it("returns scoped analytics with zero-safe counts and city filtering", async () => {
    await setup();
    await act("leader");
    const r = (
      await db.query<{ v: any }>(
        'select public.lead_report(\'{"city":"Hà Nội"}\') v',
      )
    ).rows[0].v;
    expect(r.analytics.totals.total).toBe(1);
    expect(r.analytics.performance[0].total).toBe(1);
    const empty = (
      await db.query<{ v: any }>(
        'select public.lead_report(\'{"city":"Đà Nẵng"}\') v',
      )
    ).rows[0].v;
    expect(empty.analytics.totals.total).toBe(0);
  });
});
