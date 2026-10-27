import type {
  DetailLevel,
  RitualSpeed,
  SceneId,
  SpreadType,
} from "@/data/scenes";
import { createDrawCandidates, positionsFor } from "@/lib/draw";
import { publicDrawState, type DrawAction } from "@/lib/manual-draw";
import { randomUUID } from "crypto";
import { nanoid } from "nanoid";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import type {
  Message,
  Reading,
  ReadingStatus,
  SpreadResult,
} from "@/lib/types";
import { normalizeQuestion } from "@/lib/normalize-question";
import { isReadingId } from "@/lib/reading-id";
import { isRelatedTheme, RELATED_THEME_WINDOW_MS } from "@/lib/related-theme";

export { normalizeQuestion };

function mapReading(row: Record<string, unknown>): Reading {
  return {
    id: row.id as string,
    userId: (row.user_id as string) ?? null,
    anonymousId: (row.anonymous_id as string) ?? null,
    title: (row.title as string) || "",
    question: row.question as string,
    scene: row.scene as SceneId,
    spreadType: row.spread_type as SpreadType,
    spreadResult: row.spread_result as SpreadResult,
    status: row.status as ReadingStatus,
    detailLevel: row.detail_level as DetailLevel,
    ritualSpeed: row.ritual_speed as RitualSpeed,
    silentReveal: Boolean(row.silent_reveal),
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
    deletedAt: (row.deleted_at as string) ?? null,
    publicShareToken: (row.public_share_token as string) ?? null,
    manualDraw: publicDrawState(row.draw_state),
    manuallyDrawn: Boolean(
      row.draw_state &&
        (row.draw_state as Record<string, unknown>).completed === true,
    ),
  };
}

function mapMessage(row: Record<string, unknown>): Message {
  return {
    id: row.id as string,
    readingId: row.reading_id as string,
    role: row.role as Message["role"],
    content: row.content as string,
    createdAt: row.created_at as string,
  };
}

export async function createReading(input: {
  requestId?: string;
  userId: string | null;
  anonymousId: string | null;
  question: string;
  scene: SceneId;
  spreadType: SpreadType;
  detailLevel: DetailLevel;
  ritualSpeed: RitualSpeed;
  silentReveal?: boolean;
}) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .rpc("tarot_create_manual_reading", {
      p_input: {
        id: input.requestId ?? randomUUID(),
        user_id: input.userId,
        anonymous_id: input.userId ? null : input.anonymousId,
        question: input.question.trim(),
        scene: input.scene,
        spread_type: input.spreadType,
        detail_level: input.detailLevel,
        ritual_speed: input.ritualSpeed,
        silent_reveal: Boolean(input.silentReveal),
        positions: positionsFor(input.spreadType),
      },
    })
    .single<Record<string, unknown>>();
  if (error) throw error;
  return mapReading(data);
}

export async function applyManualDraw(
  id: string,
  owner: { userId: string | null; anonymousId: string | null },
  action: DrawAction,
) {
  const { data, error } = await getSupabaseAdmin()
    .rpc("tarot_apply_draw", {
      p_id: id,
      p_user_id: owner.userId,
      p_anonymous_id: owner.userId ? null : owner.anonymousId,
      p_action: action.action,
      p_revision: action.revision,
      p_cut_index: action.action === "cut" ? action.cutIndex : null,
      p_selected: action.action === "select" ? action.selected : null,
      p_candidates: action.action === "select" ? createDrawCandidates() : null,
    })
    .single<Record<string, unknown>>();
  if (error) throw error;
  return mapReading(data);
}

export async function getReading(id: string) {
  if (!isReadingId(id)) return null;
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("tarot_readings")
    .select("*")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? mapReading(data) : null;
}

export async function listReadings(opts: {
  userId?: string | null;
  anonymousId?: string | null;
}) {
  const supabase = getSupabaseAdmin();
  let q = supabase
    .from("tarot_readings")
    .select("*")
    .is("deleted_at", null)
    .order("updated_at", { ascending: false })
    .limit(50);
  if (opts.userId) q = q.eq("user_id", opts.userId);
  else if (opts.anonymousId) q = q.eq("anonymous_id", opts.anonymousId);
  else return [];
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapReading);
}

export async function updateReadingStatus(id: string, status: ReadingStatus) {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from("tarot_readings")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function renameReading(id: string, title: string) {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from("tarot_readings")
    .update({
      title: title.trim().slice(0, 40),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function softDeleteReading(id: string) {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from("tarot_readings")
    .update({
      deleted_at: new Date().toISOString(),
      public_share_token: null,
    })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function listMessages(readingId: string) {
  if (!isReadingId(readingId)) return [];
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("tarot_messages")
    .select("*")
    .eq("reading_id", readingId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapMessage);
}

export async function addMessage(
  readingId: string,
  role: Message["role"],
  content: string,
) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("tarot_messages")
    .insert({ reading_id: readingId, role, content })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  await supabase
    .from("tarot_readings")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", readingId);
  return mapMessage(data);
}

export async function canAccessReading(
  reading: Reading,
  userId: string | null,
  anonymousId: string | null,
) {
  if (userId && reading.userId === userId) return true;
  if (!userId && anonymousId && reading.anonymousId === anonymousId)
    return true;
  return false;
}

/** P50: look up a reading by opaque public share token (not deleted). */
export async function getReadingByPublicShareToken(token: string) {
  const clean = token.trim();
  if (!clean || clean.length > 64) return null;
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("tarot_readings")
    .select("*")
    .eq("public_share_token", clean)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? mapReading(data) : null;
}

/** Enable public share: mint opaque slug (rotates if already enabled). */
export async function enablePublicShare(readingId: string) {
  const supabase = getSupabaseAdmin();
  // Retry a few times on rare unique collisions
  for (let i = 0; i < 5; i++) {
    const token = nanoid(21);
    const { data, error } = await supabase
      .from("tarot_readings")
      .update({
        public_share_token: token,
        updated_at: new Date().toISOString(),
      })
      .eq("id", readingId)
      .is("deleted_at", null)
      .select("*")
      .maybeSingle();
    if (error) {
      if (error.code === "23505") continue;
      throw new Error(error.message);
    }
    if (!data) return null;
    return mapReading(data);
  }
  throw new Error("未能生成分享短链，请稍后再试");
}

/** Disable / invalidate public share link (clears token). */
export async function disablePublicShare(readingId: string) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("tarot_readings")
    .update({
      public_share_token: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", readingId)
    .is("deleted_at", null)
    .select("*")
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? mapReading(data) : null;
}

/** usage helpers */
export async function bumpUsage(
  subjectKey: string,
  kind: "reading" | "message",
  /** How many units to add (default 1). Used e.g. for symbolic chain = 3. */
  amount = 1,
) {
  const n = Math.max(1, Math.floor(amount));
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .rpc("tarot_increment_usage", {
      p_subject: subjectKey,
      p_kind: kind,
      p_amount: n,
    })
    .single<{ readings_count: number; messages_count: number }>();
  if (error) throw error;
  return { readings: data.readings_count, messages: data.messages_count };
}

export async function getUsage(subjectKey: string) {
  const supabase = getSupabaseAdmin();
  const day = new Date().toISOString().slice(0, 10);
  const { data } = await supabase
    .from("tarot_usage_counters")
    .select("*")
    .eq("subject_key", subjectKey)
    .eq("day", day)
    .maybeSingle();
  return {
    readings: data?.readings_count ?? 0,
    messages: data?.messages_count ?? 0,
  };
}

export const QUOTAS = {
  guest: { readings: 1, messages: 5 },
  user: { readings: 10, messages: 100 },
} as const;

/**
 * Most recent earlier reading with the same normalized question for this owner.
 * Ignores soft-deleted; requires spread_result; excludes excludeId.
 */
export async function findPriorReadingByQuestion(opts: {
  question: string;
  userId?: string | null;
  anonymousId?: string | null;
  excludeId: string;
}): Promise<Reading | null> {
  const normalized = normalizeQuestion(opts.question);
  if (!normalized) return null;

  const supabase = getSupabaseAdmin();
  let q = supabase
    .from("tarot_readings")
    .select("*")
    .is("deleted_at", null)
    .neq("id", opts.excludeId)
    .not("spread_result", "is", null)
    .neq("status", "drawing")
    .order("created_at", { ascending: false })
    .limit(80);

  if (opts.userId) q = q.eq("user_id", opts.userId);
  else if (opts.anonymousId) q = q.eq("anonymous_id", opts.anonymousId);
  else return null;

  const { data, error } = await q;
  if (error) throw new Error(error.message);

  const match = (data ?? []).find(
    (row) => normalizeQuestion(String(row.question ?? "")) === normalized,
  );
  return match ? mapReading(match) : null;
}

/**
 * Most recent earlier reading with a related theme in the last ~7 days (P49).
 * Not exact same question (that's P41); prefers same non-custom scene or soft
 * question overlap. Compact card/spread only — no AI text. Optional excludeIds
 * (e.g. same-question prior already used for priorHint).
 */
export async function findRelatedThemeReading(opts: {
  question: string;
  scene: SceneId;
  userId?: string | null;
  anonymousId?: string | null;
  excludeId: string;
  /** Extra ids to skip (e.g. P41 same-question prior). */
  excludeIds?: string[];
  /** Override look-back; default RELATED_THEME_WINDOW_MS. */
  windowMs?: number;
}): Promise<Reading | null> {
  const windowMs = opts.windowMs ?? RELATED_THEME_WINDOW_MS;
  const since = new Date(Date.now() - windowMs).toISOString();
  const skip = new Set<string>([opts.excludeId, ...(opts.excludeIds ?? [])]);

  const supabase = getSupabaseAdmin();
  let q = supabase
    .from("tarot_readings")
    .select("*")
    .is("deleted_at", null)
    .neq("id", opts.excludeId)
    .not("spread_result", "is", null)
    .neq("status", "drawing")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(40);

  if (opts.userId) q = q.eq("user_id", opts.userId);
  else if (opts.anonymousId) q = q.eq("anonymous_id", opts.anonymousId);
  else return null;

  const { data, error } = await q;
  if (error) throw new Error(error.message);

  const current = { question: opts.question, scene: opts.scene };
  const match = (data ?? []).find((row) => {
    const id = String(row.id ?? "");
    if (skip.has(id)) return false;
    const reading = mapReading(row);
    return isRelatedTheme(current, {
      question: reading.question,
      scene: reading.scene,
    });
  });
  return match ? mapReading(match) : null;
}
