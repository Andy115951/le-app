// Disposable PostgREST-shaped gateway backed by actual in-memory PostgreSQL.
// Only synthetic data; run explicitly, never against a cloud database.
import http from "node:http";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import bcrypt from "bcryptjs";

const db = new PGlite();
await db.exec(
  "create role anon;create role authenticated;create role service_role bypassrls;grant usage on schema public to public;",
);
for (const file of [
  "20260910100000_candle_taro_init.sql",
  "20260911170000_oauth_users.sql",
  "20260914090000_silent_reveal.sql",
  "20260915100000_public_share_token.sql",
  "202610260001_private_tarot_tables.sql",
  "202610270001_manual_draw.sql",
  "202610270002_manual_draw_conflicts.sql",
]) {
  const sql = await readFile(
    new URL(`../../supabase/migrations/${file}`, import.meta.url),
    "utf8",
  );
  await db.exec(
    sql.replace(/^create extension if not exists pgcrypto;\s*$/m, ""),
  );
}
await db.query(
  "insert into public.tarot_users(username,password_hash) values($1,$2)",
  ["manual_preview", await bcrypt.hash("manual_preview_123", 10)],
);
await db.exec("set role service_role");
const tables = new Set([
  "tarot_users",
  "tarot_sessions",
  "tarot_readings",
  "tarot_messages",
  "tarot_usage_counters",
]);
const quote = (name) => {
  if (!/^[a-z_]+$/.test(name)) throw new Error("Invalid column");
  return `"${name}"`;
};
let failNext = false,
  lostConfirm = false;
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://127.0.0.1:4127");
  const json = (status, data, headers = {}) => {
    res.writeHead(status, { "content-type": "application/json", ...headers });
    res.end(req.method === "HEAD" ? undefined : JSON.stringify(data));
  };
  let raw = "";
  for await (const chunk of req) raw += chunk;
  const body = raw ? JSON.parse(raw) : {};
  if (url.pathname === "/_fixture/fail-next-draw") {
    failNext = true;
    return json(200, { ok: true });
  }
  if (url.pathname === "/_fixture/lose-confirm-response") {
    lostConfirm = true;
    return json(200, { ok: true });
  }
  try {
    const object = req.headers.accept?.includes(
      "application/vnd.pgrst.object+json",
    );
    const resource = url.pathname.split("/").pop();
    if (url.pathname.startsWith("/rest/v1/rpc/")) {
      if (resource === "tarot_apply_draw" && failNext) {
        failNext = false;
        return json(500, { message: "synthetic failure" });
      }
      let result;
      if (resource === "tarot_create_manual_reading")
        result = await db.query(
          "select * from public.tarot_create_manual_reading($1::jsonb)",
          [JSON.stringify(body.p_input)],
        );
      else if (resource === "tarot_apply_draw")
        result = await db.query(
          "select * from public.tarot_apply_draw($1,$2,$3,$4,$5,$6,$7::integer[],$8::jsonb)",
          [
            body.p_id,
            body.p_user_id,
            body.p_anonymous_id,
            body.p_action,
            body.p_revision,
            body.p_cut_index,
            body.p_selected,
            body.p_candidates ? JSON.stringify(body.p_candidates) : null,
          ],
        );
      else if (resource === "tarot_increment_usage")
        result = await db.query(
          "select * from public.tarot_increment_usage($1,$2,$3)",
          [body.p_subject, body.p_kind, body.p_amount],
        );
      else return json(404, { message: "Unknown fixture function" });
      if (
        resource === "tarot_apply_draw" &&
        body.p_action === "confirm" &&
        lostConfirm
      ) {
        lostConfirm = false;
        return json(500, { message: "synthetic lost response after commit" });
      }
      return json(200, object ? result.rows[0] : result.rows);
    }
    if (!tables.has(resource))
      return json(404, { message: "Unknown fixture table" });
    const params = [],
      conditions = [];
    const parameter = (value) => {
      params.push(value);
      return `$${params.length}`;
    };
    for (const [key, value] of url.searchParams) {
      if (["select", "order", "limit", "offset"].includes(key)) continue;
      if (key === "or") {
        const match = value.match(
          /^\(title\.imatch\.("(?:\\.|[^"\\])*"),question\.imatch\.("(?:\\.|[^"\\])*")\)$/,
        );
        if (!match) throw new Error("Invalid fixture search");
        const needle = JSON.parse(match[1]);
        conditions.push(
          `(title ~* ${parameter(needle)} or question ~* ${parameter(needle)})`,
        );
        continue;
      }
      const column = quote(key);
      if (value === "is.null") conditions.push(`${column} is null`);
      else if (value === "not.is.null")
        conditions.push(`${column} is not null`);
      else if (value.startsWith("eq."))
        conditions.push(`${column}=${parameter(value.slice(3))}`);
      else if (value.startsWith("neq."))
        conditions.push(`${column}<>${parameter(value.slice(4))}`);
      else if (value.startsWith("gte."))
        conditions.push(`${column}>=${parameter(value.slice(4))}`);
      else if (value.startsWith("lt."))
        conditions.push(`${column}<${parameter(value.slice(3))}`);
      else if (value.startsWith("in.("))
        conditions.push(
          `${column} in (${value
            .slice(4, -1)
            .split(",")
            .map((v) => parameter(v))
            .join(",")})`,
        );
      else throw new Error("Unsupported fixture filter");
    }
    const where = conditions.length ? `where ${conditions.join(" and ")}` : "";
    let result;
    if (req.method === "POST") {
      const keys = Object.keys(body);
      const values = keys.map((k) =>
        body[k] && typeof body[k] === "object"
          ? JSON.stringify(body[k])
          : body[k],
      );
      result = await db.query(
        `insert into public.${resource}(${keys.map(quote).join(",")}) values(${keys.map((_, i) => `$${i + 1}`).join(",")}) returning *`,
        values,
      );
    } else if (req.method === "PATCH") {
      const sets = Object.keys(body).map(
        (k) =>
          `${quote(k)}=${parameter(body[k] && typeof body[k] === "object" ? JSON.stringify(body[k]) : body[k])}`,
      );
      result = await db.query(
        `update public.${resource} set ${sets.join(",")} ${where} returning *`,
        params,
      );
    } else if (req.method === "DELETE")
      result = await db.query(
        `delete from public.${resource} ${where} returning *`,
        params,
      );
    else {
      const total = Number(
        (
          await db.query(
            `select count(*)::int as n from public.${resource} ${where}`,
            params,
          )
        ).rows[0].n,
      );
      const offset = Number(url.searchParams.get("offset") || 0),
        limit = Number(url.searchParams.get("limit") || 1000);
      if (offset > 0 && offset >= total)
        return json(
          416,
          { code: "PGRST103", message: "Range not satisfiable" },
          { "content-range": `*/${total}` },
        );
      const order = url.searchParams
        .get("order")
        ?.split(",")
        .map((part) => {
          const [col, dir] = part.split(".");
          return `${quote(col)} ${dir === "desc" ? "desc" : "asc"}`;
        })
        .join(",");
      const projection = url.searchParams.get("select") || "*";
      const fields =
        projection === "*" ? "*" : projection.split(",").map(quote).join(",");
      result = await db.query(
        `select ${fields} from public.${resource} ${where} ${order ? `order by ${order}` : ""} limit ${limit} offset ${offset}`,
        params,
      );
      return json(200, object ? (result.rows[0] ?? null) : result.rows, {
        "content-range": `${offset}-${offset + result.rows.length - 1}/${total}`,
      });
    }
    return json(200, object ? (result.rows[0] ?? null) : result.rows);
  } catch (error) {
    return json(error.code === "P0002" ? 404 : 400, {
      code: error.code || "fixture_error",
      message: error.message,
    });
  }
});
server.listen(4127, "127.0.0.1", () =>
  console.log(
    "Disposable manual-draw PostgreSQL fixture on 127.0.0.1:4127 (synthetic data only)",
  ),
);
