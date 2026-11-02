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
    .filter((f) => /^(1[0-46-9]|2[0-7])_/.test(f))
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
async function command(payload: object, request = randomUUID()) {
  return db.query("select public.lead_command($1::jsonb,$2::uuid,null)", [
    JSON.stringify(payload),
    request,
  ]);
}
async function deny(payload: object, pattern: RegExp) {
  await db.exec("savepoint rejected");
  await expect(command(payload)).rejects.toThrow(pattern);
  await db.exec("rollback to savepoint rejected");
}
async function snapshot() {
  return (await db.query<{ v: any }>("select public.lead_snapshot() v")).rows[0]
    .v;
}

it("provisions a disabled new profile with role, team and access together", async () => {
  await command({
    type: "member",
    id: members.new,
    name: "Nguyễn Hoàng Anh",
    role: "telesale",
    active: true,
    teamId: "default",
    expected: { name: "new", role: "viewer", active: false, teamId: "default" },
  });
  const person = (await snapshot()).members.find(
    (m: any) => m.id === members.new,
  );
  expect(person).toMatchObject({
    name: "Nguyễn Hoàng Anh",
    role: "telesale",
    active: true,
    teamId: "default",
  });
});
it("updates profile and access atomically, retries idempotently and exposes account history only", async () => {
  const payload = {
    type: "member",
    id: members.intake,
    name: "Lê Thanh Hà",
    role: "leader",
    active: true,
    expected: {
      name: "intake",
      role: "intake",
      active: true,
      teamId: "default",
    },
  };
  const request = randomUUID();
  await command(payload, request);
  await command(payload, request);
  const snap = await snapshot();
  expect(snap.members.find((m: any) => m.id === members.intake)).toMatchObject({
    name: "Lê Thanh Hà",
    role: "leader",
  });
  expect(snap.audit).toHaveLength(1);
  expect(snap.audit[0].action).toBe("member");
  expect(snap.leads).toEqual([]);
  expect(snap.assignments).toEqual([]);
});
it("rejects stale forms without changing the name or access", async () => {
  await deny(
    {
      type: "member",
      id: members.intake,
      name: "Không được lưu",
      role: "leader",
      active: false,
      expected: {
        name: "Tên cũ",
        role: "intake",
        active: true,
        teamId: "default",
      },
    },
    /đã thay đổi/,
  );
  expect(
    (await snapshot()).members.find((m: any) => m.id === members.intake),
  ).toMatchObject({ name: "intake", role: "intake", active: true });
});
it("rejects legacy role grants, invalid groups, self-locking and unauthorized edits", async () => {
  await deny(
    { type: "member", id: members.intake, role: "viewer", active: true },
    /bốn vai trò/,
  );
  await deny(
    {
      type: "member",
      id: members.intake,
      role: "leader",
      active: true,
      teamId: "missing",
    },
    /nhóm/,
  );
  await deny(
    { type: "member", id: members.admin, role: "intake", active: false },
    /tài khoản khác/,
  );
  await act("intake");
  await deny(
    { type: "member", id: members.sale, role: "admin", active: true },
    /quản trị/,
  );
});
it("preserves the name when deactivation is rejected for outstanding tickets", async () => {
  await db.exec("reset role");
  await db.query(`insert into public.leads(data) values($1::jsonb)`, [
    JSON.stringify({
      id: "L",
      phone: "0901234567",
      name: "Tài xế",
      sourceId: "web",
      status: "New",
      archived: false,
      city: "Hà Nội",
      vehicle: "Motorbike",
      tags: [],
    }),
  ]);
  const expires = new Date(Date.now() + 86400000).toISOString();
  await db.query(
    "insert into public.lead_assignments(data,expires_at) values($1::jsonb,$2)",
    [
      JSON.stringify({
        id: "T",
        leadId: "L",
        assigneeId: members.sale,
        teamId: "default",
        status: "Open",
        expiresAt: expires,
        createdAt: new Date().toISOString(),
        round: 1,
      }),
      expires,
    ],
  );
  await act("admin");
  await deny(
    {
      type: "member",
      id: members.sale,
      name: "Tên không được lưu",
      role: "telesale",
      active: false,
    },
    /phiếu đang hiệu lực/,
  );
  expect(
    (await snapshot()).members.find((m: any) => m.id === members.sale),
  ).toMatchObject({ name: "sale", active: true });
});
it("disabled accounts cannot use existing sessions and account history excludes lead records", async () => {
  await command({
    type: "member",
    id: members.intake,
    role: "intake",
    active: false,
  });
  await act("intake");
  await expect(snapshot()).rejects.toThrow(/tạm ngưng/);
});

it('Admin cannot read operational reports directly through the API', async () => {
  await expect(db.query("select public.lead_report('{}'::jsonb)")).rejects.toThrow(/chỉ quản lý tài khoản/);
});
