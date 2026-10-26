import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Meal, Profile, Reading } from "@/lib/domain";
import type { MealPreset } from "@/lib/meal-presets";

export interface PublicCloudConfig {
  configured: boolean;
  registrationAvailable: boolean;
  url: string | null;
  anonKey: string | null;
}

export async function fetchPublicConfig(): Promise<PublicCloudConfig> {
  const response = await fetch("/api/config", { cache: "no-store", signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error("无法读取云端配置，请重试。食物查询和演示仍可使用。");
  return response.json();
}

export function createBrowserCloud(config: PublicCloudConfig): SupabaseClient | null {
  if (!config.configured || !config.url || !config.anonKey) return null;
  return createClient(config.url, config.anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
      // Only the authentication session is persisted. Health records stay in memory.
      storageKey: "glucose-auth-session-v1",
    },
    global: { fetch: timedFetch },
  });
}

async function timedFetch(input: RequestInfo | URL, init?: RequestInit) {
  return fetch(input, {
    ...init,
    cache: "no-store",
    signal: init?.signal
      ? AbortSignal.any([init.signal, AbortSignal.timeout(20000)])
      : AbortSignal.timeout(20000),
  });
}

type Row = Record<string, unknown>;
export function profileFromRow(row: Row): Profile {
  return {
    id: String(row.id), name: String(row.name), timezone: String(row.timezone),
    unit: row.unit as Profile["unit"], allergies: (row.allergies ?? []) as string[],
    avoidances: (row.avoidances ?? []) as string[], preferences: (row.preferences ?? []) as string[],
    maxCookingMinutes: row.max_cooking_minutes == null ? null : Number(row.max_cooking_minutes),
    targets: (row.targets ?? {}) as Profile["targets"],
  };
}

export function profileToRow(profile: Profile, userId: string) {
  return {
    id: profile.id, user_id: userId, name: profile.name, timezone: profile.timezone,
    unit: profile.unit, allergies: profile.allergies, avoidances: profile.avoidances,
    preferences: profile.preferences, max_cooking_minutes: profile.maxCookingMinutes,
    targets: profile.targets,
  };
}

export function readingFromRow(row: Row): Reading {
  return {
    id: String(row.id), profileId: String(row.profile_id),
    value: row.value == null ? null : Number(row.value), unit: row.unit as Reading["unit"],
    standardValue: row.value_mmol == null ? null : Number(row.value_mmol),
    special: (row.special ?? null) as Reading["special"], measuredAt: String(row.measured_at),
    context: row.context as Reading["context"], mealId: (row.meal_id ?? null) as string | null,
    postMealMinutes: row.post_meal_minutes == null ? null : Number(row.post_meal_minutes),
    intervalSource: row.timing_source as Reading["intervalSource"], notes: String(row.note ?? ""),
    createdAt: row.created_at as string | undefined, updatedAt: row.updated_at as string | undefined,
  };
}

export function readingToRow(reading: Reading, userId: string) {
  return {
    id: reading.id, user_id: userId, profile_id: reading.profileId, value: reading.value,
    unit: reading.unit, special: reading.special, measured_at: reading.measuredAt,
    context: reading.context, meal_id: reading.mealId, post_meal_minutes: reading.postMealMinutes,
    timing_source: reading.intervalSource, note: reading.notes,
  };
}

export function mealFromRow(row: Row): Meal {
  return {
    id: String(row.id), profileId: String(row.profile_id), type: row.meal_type as Meal["type"],
    startedAt: String(row.started_at), notes: String(row.note ?? ""),
    templateId: (row.template_id ?? null) as string | null, items: (row.items ?? []) as Meal["items"],
    createdAt: row.created_at as string | undefined, updatedAt: row.updated_at as string | undefined,
  };
}

export function mealToRow(meal: Meal, userId: string) {
  return {
    id: meal.id, user_id: userId, profile_id: meal.profileId, meal_type: meal.type,
    started_at: meal.startedAt, note: meal.notes, template_id: meal.templateId, items: meal.items,
  };
}

export function mealPresetFromRow(row: Row): MealPreset {
  return {
    id: String(row.id), profileId: String(row.profile_id), name: String(row.name),
    mealType: row.meal_type as MealPreset["mealType"],
    items: structuredClone((row.items ?? []) as MealPreset["items"]),
    createdAt: row.created_at as string | undefined, updatedAt: row.updated_at as string | undefined,
  };
}

export function mealPresetToRow(preset: MealPreset, userId: string) {
  return {
    id: preset.id, user_id: userId, profile_id: preset.profileId, name: preset.name.trim(),
    meal_type: preset.mealType, items: structuredClone(preset.items),
  };
}

export async function readProfileRecords(client: SupabaseClient, userId: string, profileId: string) {
  // Explicit pagination avoids silently truncating history at the PostgREST row cap.
  async function allRows(table: string, dateColumn: string) {
    const rows: Row[] = [];
    for (let from = 0; ; from += 500) {
      const { data, error } = await client.from(table).select("*").eq("user_id", userId)
        .eq("profile_id", profileId).order(dateColumn, { ascending: false }).order("id")
        .range(from, from + 499);
      if (error) throw error;
      rows.push(...(data ?? []));
      if ((data?.length ?? 0) < 500) return rows;
    }
  }
  const [readingRows, mealRows, presetRows, favoritesResult] = await Promise.all([
    allRows("glucose_readings", "measured_at"), allRows("glucose_meals", "started_at"),
    allRows("glucose_meal_presets", "created_at"),
    client.from("glucose_favorites").select("kind,reference_id").eq("user_id", userId).eq("profile_id", profileId),
  ]);
  if (favoritesResult.error) throw favoritesResult.error;
  return {
    readings: readingRows.map(readingFromRow), meals: mealRows.map(mealFromRow),
    mealPresets: presetRows.map(mealPresetFromRow),
    favorites: (favoritesResult.data ?? []).map(row => `${row.kind}:${row.reference_id}`),
  };
}

/** Never display raw database errors, which can include health data and internal SQL. */
export function cloudError(error: unknown, fallback = "云端操作未完成，请保留输入并重试。") {
  if (error instanceof Error && error.name === "AbortError") return "连接超时，尚未确认云端结果，请重试；相同记录不会重复新增。";
  const code = typeof error === "object" && error ? String((error as { code?: string }).code ?? "") : "";
  if (code === "42501" || code === "PGRST301" || code === "PGRST302") return "登录已过期或账号尚未开通，请重新登录并检查家庭开通状态。";
  if (code === "23503") return "关联的成员或餐饮记录已变化，请刷新后重试。";
  if (code === "23514" || code === "22P02") return "部分记录格式未通过检查，请核对数值、时间和单位。";
  if (code === "42P01" || code === "PGRST205") return "云端数据表尚未准备好，请联系维护者完成数据库迁移。";
  return fallback;
}
