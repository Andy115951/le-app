import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";

const tables = [
  "tarot_users",
  "tarot_sessions",
  "tarot_readings",
  "tarot_messages",
  "tarot_usage_counters",
];
const columns = ["id", "id", "id", "id", "subject_key"];
const migration = await readFile(
  new URL(
    "../supabase/migrations/202610260001_private_tarot_tables.sql",
    import.meta.url,
  ),
  "utf8",
);
const userId = "10000000-0000-4000-8000-000000000001";
const readingId = "20000000-0000-4000-8000-000000000001";

test("private Tarot tables: real PostgreSQL privileges and RLS, synthetic data only", async (t) => {
  const db = new PGlite();
  const rows = async (sql, params = []) => (await db.query(sql, params)).rows;
  const as = async (role) => {
    await db.exec("reset role");
    await db.exec(`set role ${role}`);
  };
  const denied = async (sql) => {
    await assert.rejects(db.query(sql), (e) => e.code === "42501");
  };
  const snapshot = async () =>
    Promise.all(tables.map((table) => rows(`select * from public.${table}`)));
  try {
    await db.exec(`
      create role anon;
      create role authenticated;
      create role service_role bypassrls;
      create role unrelated_client;
      grant usage on schema public to public;
    `);
    for (const file of [
      "20260910100000_candle_taro_init.sql",
      "20260911170000_oauth_users.sql",
      "20260914090000_silent_reveal.sql",
      "20260915100000_public_share_token.sql",
    ]) {
      const sql = await readFile(
        new URL(`../supabase/migrations/${file}`, import.meta.url),
        "utf8",
      );
      // PGlite omits the pgcrypto extension; gen_random_uuid() is built into the
      // PostgreSQL engine, so only this unrelated extension-install line is skipped.
      await db.exec(
        sql.replace(/^create extension if not exists pgcrypto;\s*$/m, ""),
      );
    }
    await db.query(
      "insert into public.tarot_users(id,username,password_hash) values ($1,'synthetic_user','synthetic_hash')",
      [userId],
    );
    await db.query(
      "insert into public.tarot_sessions(user_id,session_token_hash,expires_at) values ($1,'synthetic_token_hash',now()+interval '1 day')",
      [userId],
    );
    await db.query(
      `insert into public.tarot_readings(id,user_id,question,scene,spread_type,spread_result,status,public_share_token)
      values ($1,$2,'Synthetic question','custom','single','{"cards":[]}'::jsonb,'revealed','synthetic_share_token')`,
      [readingId, userId],
    );
    await db.query(
      "insert into public.tarot_messages(reading_id,role,content) values ($1,'assistant','Synthetic message')",
      [readingId],
    );
    await db.exec(
      "insert into public.tarot_usage_counters(subject_key,day) values ('synthetic_subject',current_date)",
    );
    for (const table of tables) {
      await db.exec(
        `grant all privileges on public.${table} to public, anon, authenticated`,
      );
      await db.exec(
        `create policy synthetic_open_policy on public.${table} for all to public using (true) with check (true)`,
      );
    }
    await db.exec(
      "grant select(password_hash) on public.tarot_users to anon; grant update(content) on public.tarot_messages to authenticated",
    );
    await db.exec(`create table public.other_app_probe(id int primary key, note text);
      insert into public.other_app_probe values (1,'synthetic unrelated data');
      alter table public.other_app_probe enable row level security;
      create policy other_app_probe_policy on public.other_app_probe for select to authenticated using(true);
      grant select on public.other_app_probe to authenticated;`);
    const otherSnapshot = async () =>
      rows(`select c.relacl::text, c.relrowsecurity, p.polname, p.polqual::text
      from pg_class c join pg_policy p on p.polrelid=c.oid where c.oid='public.other_app_probe'::regclass`);
    const otherBefore = await otherSnapshot();
    const dataBefore = await snapshot();

    await t.test(
      "reproduces the original anonymous count exposure before applying the actual migration",
      async () => {
        await as("anon");
        for (const table of tables)
          assert.equal(
            (await rows(`select count(*)::int as n from public.${table}`))[0].n,
            1,
          );
        await as("postgres");
        await db.exec(migration);
      },
    );
    await t.test(
      "all five tables enable RLS, remove policies and revoke table AND column ACLs",
      async () => {
        for (const table of tables) {
          const [info] = await rows(
            `select c.relrowsecurity, (select count(*)::int from pg_policy p where p.polrelid=c.oid) as policies
          from pg_class c where c.oid=$1::regclass`,
            [`public.${table}`],
          );
          assert.equal(info.relrowsecurity, true);
          assert.equal(info.policies, 0);
          for (const role of ["anon", "authenticated", "unrelated_client"]) {
            const [permissions] = await rows(
              `select has_table_privilege($1,$2,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') as table_access,
            has_any_column_privilege($1,$2,'SELECT,INSERT,UPDATE,REFERENCES') as column_access`,
              [role, `public.${table}`],
            );
            assert.deepEqual(permissions, {
              table_access: false,
              column_access: false,
            });
          }
        }
      },
    );
    await t.test(
      "anonymous and unrelated Supabase-authenticated users cannot read counts or write",
      async () => {
        for (const role of ["anon", "authenticated"]) {
          await as(role);
          for (const [i, table] of tables.entries()) {
            await denied(`select count(*) from public.${table}`);
            await denied(`select ${columns[i]} from public.${table}`);
            await denied(
              `insert into public.${table}(${columns[i]}) values(null)`,
            );
            await denied(
              `update public.${table} set ${columns[i]}=${columns[i]} where false`,
            );
            await denied(`delete from public.${table} where false`);
          }
        }
        await as("postgres");
        assert.deepEqual(await snapshot(), dataBefore);
      },
    );
    await t.test(
      "RLS still denies every row if a future accidental SELECT grant is added",
      async () => {
        for (const table of tables)
          await db.exec(
            `grant select on public.${table} to anon, authenticated`,
          );
        for (const role of ["anon", "authenticated"]) {
          await as(role);
          for (const table of tables)
            assert.equal(
              (await rows(`select count(*)::int as n from public.${table}`))[0]
                .n,
              0,
            );
        }
        await as("postgres");
        await db.exec(migration);
      },
    );
    await t.test(
      "service_role retains login, session, history, share and usage access plus CRUD",
      async () => {
        await as("service_role");
        assert.equal(
          (
            await rows(
              "select password_hash from public.tarot_users where username='synthetic_user'",
            )
          )[0].password_hash,
          "synthetic_hash",
        );
        assert.equal(
          (
            await rows(
              "select user_id from public.tarot_sessions where session_token_hash='synthetic_token_hash'",
            )
          )[0].user_id,
          userId,
        );
        assert.equal(
          (
            await rows(
              "select id from public.tarot_readings where user_id=$1",
              [userId],
            )
          )[0].id,
          readingId,
        );
        assert.equal(
          (
            await rows(
              "select id from public.tarot_readings where public_share_token='synthetic_share_token'",
            )
          )[0].id,
          readingId,
        );
        assert.equal(
          (
            await rows(
              "select content from public.tarot_messages where reading_id=$1",
              [readingId],
            )
          )[0].content,
          "Synthetic message",
        );
        const [user] = await rows(
          "insert into public.tarot_users(username,password_hash) values ('synthetic_extra','hash') returning id",
        );
        const [session] = await rows(
          "insert into public.tarot_sessions(user_id,session_token_hash,expires_at) values ($1,'extra_token',now()+interval '1 day') returning id",
          [user.id],
        );
        const [reading] = await rows(
          `insert into public.tarot_readings(user_id,question,scene,spread_type,spread_result,status)
        values ($1,'Synthetic extra','custom','single','{"cards":[]}'::jsonb,'revealed') returning id`,
          [user.id],
        );
        const [message] = await rows(
          "insert into public.tarot_messages(reading_id,role,content) values ($1,'user','Synthetic extra') returning id",
          [reading.id],
        );
        await db.exec(
          "insert into public.tarot_usage_counters(subject_key,day) values ('synthetic_extra',current_date)",
        );
        await db.query(
          "update public.tarot_users set display_name='Synthetic' where id=$1",
          [user.id],
        );
        await db.query(
          "update public.tarot_sessions set last_seen_at=now() where id=$1",
          [session.id],
        );
        await db.query(
          "update public.tarot_readings set public_share_token='extra_share',title='Synthetic title' where id=$1",
          [reading.id],
        );
        await db.query(
          "update public.tarot_messages set content='Synthetic updated' where id=$1",
          [message.id],
        );
        await db.exec(
          "update public.tarot_usage_counters set readings_count=1 where subject_key='synthetic_extra'",
        );
        await db.query("delete from public.tarot_messages where id=$1", [
          message.id,
        ]);
        await db.query("delete from public.tarot_readings where id=$1", [
          reading.id,
        ]);
        await db.query("delete from public.tarot_sessions where id=$1", [
          session.id,
        ]);
        await db.query("delete from public.tarot_users where id=$1", [user.id]);
        await db.exec(
          "delete from public.tarot_usage_counters where subject_key='synthetic_extra'",
        );
        await as("postgres");
        assert.deepEqual(await snapshot(), dataBefore);
      },
    );
    await t.test(
      "reruns preserve all synthetic records and other apps' policies, permissions and rows",
      async () => {
        await db.exec(migration);
        assert.deepEqual(await snapshot(), dataBefore);
        assert.deepEqual(await otherSnapshot(), otherBefore);
        await as("authenticated");
        assert.deepEqual(await rows("select * from public.other_app_probe"), [
          { id: 1, note: "synthetic unrelated data" },
        ]);
        await denied("select count(*) from public.tarot_users");
        await as("postgres");
      },
    );
    await t.test(
      "unexpected inherited permissions abort and roll back the entire migration",
      async () => {
        await db.exec(`create role inherited_reader;
        grant select on public.tarot_messages to inherited_reader;
        grant inherited_reader to authenticated;
        grant select on public.tarot_users to anon;
        alter table public.tarot_users disable row level security;`);
        await assert.rejects(db.exec(migration), (e) => e.code === "P0001");
        await db.exec("rollback");
        const [state] =
          await rows(`select c.relrowsecurity, has_table_privilege('anon',c.oid,'SELECT') as anon_select
        from pg_class c where c.oid='public.tarot_users'::regclass`);
        assert.deepEqual(state, { relrowsecurity: false, anon_select: true });
        await db.exec(`revoke inherited_reader from authenticated;
        revoke all on public.tarot_messages from inherited_reader;
        drop role inherited_reader;`);
        await db.exec(migration);
        assert.deepEqual(await snapshot(), dataBefore);
        assert.deepEqual(await otherSnapshot(), otherBefore);
      },
    );
  } finally {
    await db.close();
  }
});
