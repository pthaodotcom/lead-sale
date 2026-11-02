import { beforeAll, afterAll, beforeEach, afterEach, it, expect } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFile, readdir } from "node:fs/promises";
import { randomUUID } from "node:crypto";
const db = new PGlite();
const users: Record<string, string> = {},
  members: Record<string, string> = {};
beforeAll(async () => {
  await db.exec(
    `create role anon;create role authenticated;create role service_role;create schema auth;create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}');create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table storage.objects(bucket_id text,name text,metadata jsonb,primary key(bucket_id,name));alter table storage.objects enable row level security;grant usage on schema storage,auth to authenticated;grant select,insert on storage.objects to authenticated;`,
  );
  for (const file of (await readdir("backend/supabase/schemas"))
    .filter((f) => /^(1[0-46-9]|2[0-8])_/.test(f))
    .sort()) {
    await db.exec(await readFile("backend/supabase/schemas/" + file, "utf8"));
  }
  for (const [key, role] of Object.entries({
    admin: "admin",
    intake: "intake",
    sale: "telesale",
    leader: "leader",
    legacy: "viewer",
    new: "",
  })) {
    users[key] = randomUUID();
    await db.query(
      "insert into auth.users(id,email,raw_user_meta_data) values($1,$2,$3)",
      [users[key], key + "@example.com", JSON.stringify({ name: key })],
    );
    members[key] = String(
      (
        await db.query<{ id: number }>(
          "update public.sales set disabled=$1,administrator=$2 where user_id=$3 returning id",
          [key === "new", key === "admin", users[key]],
        )
      ).rows[0].id,
    );
    if (role)
      await db.query(
        "insert into public.lead_user_roles(sales_id,role_code) values($1,$2)",
        [members[key], role],
      );
  }
});
afterAll(() => db.close());
beforeEach(async () => {
  await db.exec("begin");
  await act("admin");
});
afterEach(() => db.exec("rollback"));
async function act(key: string) {
  await db.exec("set role authenticated");
  await db.query("select set_config('request.jwt.claim.sub',$1,true)", [
    users[key],
  ]);
}
async function snapshot() {
  return (await db.query<{ v: any }>("select public.lead_snapshot() v")).rows[0]
    .v;
}

async function setup(status: string) {
  await db.exec("reset role");
  const lead = {
    id: "L-CLOSE",
    name: "Tài xế thử nghiệm",
    phone: "0912345678",
    sourceId: "web",
    status,
    archived: false,
    city: "Hà Nội",
    vehicle: "Van",
    tags: [],
    activatedAt: "2026-10-24T01:00:00Z",
    activatedSource: "core",
  };
  if (status === "Onboarded")
    Object.assign(lead, {
      onboardedAt: "2026-10-25T01:00:00Z",
      onboardedSource: "core",
      firstOrderId: "ORDER-1",
    });
  await db.query("insert into public.leads(data) values($1::jsonb)", [
    JSON.stringify(lead),
  ]);
  await db.query(
    "insert into public.lead_assignments(data,expires_at) values($1::jsonb,now())",
    [
      JSON.stringify({
        id: "T-CLOSE",
        leadId: lead.id,
        assigneeId: members.sale,
        status: "Closed",
        teamId: "default",
        round: 1,
        version: 1,
      }),
    ],
  );
  await db.query(
    "insert into public.lead_closure_reviews(data) values($1::jsonb)",
    [
      JSON.stringify({
        id: "R-CLOSE",
        leadId: lead.id,
        assignmentId: "T-CLOSE",
        version: 1,
      }),
    ],
  );
  await act("intake");
  return lead;
}
async function review(result: string, version = 1, type = "review") {
  return db.query("select public.lead_command($1::jsonb,$2::uuid,$3)", [
    JSON.stringify({
      type,
      id: "R-CLOSE",
      result,
      note: "Hoàn tất hồ sơ",
      reason: "Đính chính kết quả",
    }),
    randomUUID(),
    version,
  ]);
}

beforeAll(async () => {
  await setup("Onboarded");
  await db.exec("reset role");
  await db.query(
    "insert into public.lead_care_rounds(assignment_id,round_no,actor_id,reason) values('T-CLOSE',1,$1,'Fixture')",
    [members.sale],
  );
  for (const channel of ["call", "zalo"])
    await db.query("insert into public.lead_activities(data) values($1)", [
      JSON.stringify({
        id: "ACT-" + channel,
        leadId: "L-CLOSE",
        assignmentId: "T-CLOSE",
        actorId: members.sale,
        channel,
        at: "2026-10-24T01:00:00Z",
        outcome: "called",
        decision: "agreed",
        reason: "none",
        note: "Liên hệ",
        round: 1,
      }),
    ]);
  await db.query(
    "insert into public.lead_appointments(data,due_at) values($1,$2)",
    [
      JSON.stringify({
        id: "AP-CLOSE",
        assignmentId: "T-CLOSE",
        leadId: "L-CLOSE",
        actorId: members.sale,
        activityId: "ACT-call",
        at: "2026-10-24T02:00:00Z",
        place: "văn phòng HN1",
        status: "failed",
      }),
      "2026-10-24T02:00:00Z",
    ],
  );
  await db.exec(
    await readFile(
      "backend/supabase/schemas/29_lead_sale_relational.sql",
      "utf8",
    ),
  );
});
it("backfills relational keys, separate contact tables and nullable unknown facts without losing API data", async () => {
  await act("intake");
  const snap = await snapshot();
  expect(snap.leads[0]).toMatchObject({
    id: "L-CLOSE",
    status: "Onboarded",
    firstOrderId: "ORDER-1",
  });
  const lead = (await db.query<any>("select * from public.leads")).rows[0];
  expect(lead).toMatchObject({
    legacy_id: "L-CLOSE",
    name: "Tài xế thử nghiệm",
    status: "Onboarded",
    first_order_id: "ORDER-1",
  });
  expect(lead.lead_id).toBeDefined();
  expect(lead.vehicle_id).toBeDefined();
  expect(lead.city_id).toBeDefined();
  await act("sale");
  expect(
    (await db.query("select * from public.lead_assignment_ticket_calls")).rows,
  ).toHaveLength(1);
  expect(
    (await db.query("select * from public.lead_assignment_ticket_inbox")).rows,
  ).toHaveLength(1);
  const call = (
    await db.query<any>("select * from public.lead_assignment_ticket_calls")
  ).rows[0];
  expect(call.call_direction).toBeNull();
  expect(call.call_duration_seconds).toBeNull();
  expect(call.decision_place).toBe("văn phòng HN1");
  await act("intake");
  expect(
    (await db.query<any>("select * from public.lead_closed_ticket_reviews"))
      .rows[0].reviewed_at,
  ).toBeNull();
});
it("keeps closure RPC, milestones, relational review and genuine before after history in one transaction", async () => {
  await act("intake");
  await review("closed");
  expect((await snapshot()).leads[0].status).toBe("Closed");
  const l = (await db.query<any>("select * from public.leads")).rows[0];
  expect(l.status).toBe("Closed");
  expect(l.first_order_id).toBe("ORDER-1");
  expect(
    (await db.query<any>("select * from public.lead_closed_ticket_reviews"))
      .rows[0],
  ).toMatchObject({ review_result: "closed", review_basis: "Hoàn tất hồ sơ" });
  expect(
    (
      await db.query<any>(
        "select old_status,new_status from public.leads_profile_update_status",
      )
    ).rows,
  ).toEqual([{ old_status: "Onboarded", new_status: "Closed" }]);
});
it("syncs intake note and account changes without changing the public RPC contract", async () => {
  await act("intake");
  await db.query("select public.lead_command($1,$2,null)", [
    JSON.stringify({ type: "leadNote", id: "L-CLOSE", note: "Ghi chú mới" }),
    randomUUID(),
  ]);
  expect(
    (await db.query<any>("select note from public.leads")).rows[0].note,
  ).toBe("Ghi chú mới");
  expect(
    (
      await db.query<any>(
        "select note_content from public.leads_profile_update_note",
      )
    ).rows[0].note_content,
  ).toBe("Ghi chú mới");
  await act("admin");
  await db.query("select public.lead_command($1,$2,null)", [
    JSON.stringify({
      type: "member",
      id: members.intake,
      name: "Tên mới",
      role: "intake",
      active: true,
    }),
    randomUUID(),
  ]);
  expect(
    (
      await db.query<any>("select name from public.users where user_id=$1", [
        members.intake,
      ])
    ).rows[0].name,
  ).toBe("Tên mới");
});
it("preserves row scope and denies direct normalized writes and anonymous access", async () => {
  await act("admin");
  expect((await db.query("select * from public.leads")).rows).toHaveLength(0);
  await act("sale");
  expect((await db.query("select * from public.leads")).rows).toHaveLength(0);
  await db.exec("savepoint denied");
  await expect(
    db.exec("update public.leads set note='forged'"),
  ).rejects.toThrow(/permission denied/);
  await db.exec("rollback to savepoint denied");
  await db.exec("set role anon");
  await expect(db.query("select * from public.leads")).rejects.toThrow(
    /permission denied/,
  );
});
it("new registrations still pass through Auth and appear as disabled accounts without stored passwords", async () => {
  await db.exec("reset role");
  const uid = randomUUID();
  await db.query("insert into auth.users(id,email) values($1,$2)", [
    uid,
    "new-normalized@example.com",
  ]);
  expect(
    (
      await db.query<any>(
        "select status from public.users where auth_user_id=$1",
        [uid],
      )
    ).rows[0].status,
  ).toBe("suspended");
  expect(
    (
      await db.query(
        "select column_name from information_schema.columns where table_schema='public' and table_name='users' and column_name='password'",
      )
    ).rows,
  ).toHaveLength(0);
});
it("new intake, assignment, ticket closure and reports continue after normalization", async () => {
  await act("intake");
  await db.query("select public.lead_command($1,$2,null)", [
    JSON.stringify({
      type: "saveLead",
      input: {
        name: "Tài xế mới",
        phone: "0987654321",
        city: "Đà Nẵng",
        vehicle: "Van",
        sourceId: "web",
        tags: [],
        note: "Đăng ký mới",
      },
    }),
    randomUUID(),
  ]);
  await act("intake");
  let snap = await snapshot();
  const l = snap.leads.find((x: any) => x.phone === "0987654321");
  expect(l).toBeDefined();
  expect(
    (
      await db.query<any>("select name from public.leads where legacy_id=$1", [
        l.id,
      ])
    ).rows[0].name,
  ).toBe("Tài xế mới");
  await act("leader");
  await db.query("select public.lead_command($1,$2,null)", [
    JSON.stringify({ type: "assign", leadId: l.id, assigneeId: members.sale }),
    randomUUID(),
  ]);
  await act("sale");
  snap = await snapshot();
  const t = snap.assignments.find((x: any) => x.leadId === l.id);
  expect(t).toBeDefined();
  await act("leader");
  await db.query("select public.lead_command($1,$2,$3)", [
    JSON.stringify({
      type: "ticketStatus",
      id: t.id,
      status: "Closed",
      reason: "Bàn giao",
    }),
    randomUUID(),
    t.version,
  ]);
  expect(
    (
      await db.query<any>(
        "select status from public.lead_assignment_tickets where legacy_id=$1",
        [t.id],
      )
    ).rows[0].status,
  ).toBe("Closed");
  await act("intake");
  expect(
    (await db.query("select * from public.lead_closed_ticket_reviews")).rows,
  ).toHaveLength(2);
  expect(
    (await db.query("select public.lead_report($1)", [JSON.stringify({})]))
      .rows,
  ).toHaveLength(1);
});
it("tracks edits to non status fields with real old and new values", async () => {
  await db.exec("reset role");
  await db.query(
    "update private.compat_leads set data=data||$1::jsonb where id='L-CLOSE'",
    [
      JSON.stringify({
        name: "Tên sau sửa",
        updatedAt: new Date().toISOString(),
      }),
    ],
  );
  const change = (
    await db.query<any>(
      "select old_value,new_value from public.leads_profile_update_detail where field_name='name'",
    )
  ).rows[0];
  expect(JSON.parse(change.old_value)).toBe("Tài xế thử nghiệm");
  expect(JSON.parse(change.new_value)).toBe("Tên sau sửa");
});
