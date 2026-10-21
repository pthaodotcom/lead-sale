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
    .filter((f) => /^1[0-4]_/.test(f))
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
describe("PostgreSQL commands, RLS and transactions", () => {
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
    expect((await snapshot()).assignments).toHaveLength(1);
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
