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
    .sort())
    await db.exec(await readFile("backend/supabase/schemas/" + file, "utf8"));
  for (const [key, role] of Object.entries({
    admin: "admin",
    intake: "intake",
    sale: "telesale",
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
for (const status of ["Activated", "Onboarded"]) {
  it(
    "closes " + status + " preserving milestones, history and version checks",
    async () => {
      const original = await setup(status);
      await review("closed");
      let snap = await snapshot();
      expect(snap.leads[0]).toMatchObject({ ...original, status: "Closed" });
      expect(snap.reviews[0]).toMatchObject({
        result: "closed",
        reviewedBy: members.intake,
        version: 2,
      });
      expect(snap.audit.some((a: any) => a.action === "review")).toBe(true);
      await db.exec("savepoint stale");
      await expect(review("closed")).rejects.toThrow(/đã thay đổi/);
      await db.exec("rollback to savepoint stale");
      await db.exec("savepoint reopen");
      await expect(review("eligible", 2, "amendReview")).rejects.toThrow(
        /không thể đưa về/,
      );
      await db.exec("rollback to savepoint reopen");
      await review("closed", 2, "amendReview");
      snap = await snapshot();
      expect(
        snap.reviews[0].history.some((r: any) => r.result === "closed"),
      ).toBe(true);
      expect(snap.leads[0]).toMatchObject({ ...original, status: "Closed" });
    },
  );
  it("still rejects reassignment of " + status, async () => {
    await setup(status);
    await expect(review("eligible")).rejects.toThrow(/không thể đưa về/);
  });
}
it("still rejects closure with an active ticket", async () => {
  await setup("Activated");
  await db.exec("reset role");
  await db.exec(
    'update public.lead_assignments set data=data||\'{"status":"Open"}\'::jsonb',
  );
  await act("intake");
  await expect(review("closed")).rejects.toThrow(/phiếu hiệu lực/);
});
it("still rejects review by Telesale", async () => {
  await setup("Activated");
  await act("sale");
  await expect(review("closed")).rejects.toThrow(/Chỉ tiếp nhận/);
});
