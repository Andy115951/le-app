import { AppState } from "react-native";
import { authStorage } from "../platform/auth-storage";
import { createCloud as createBrowserCloud, fetchPublicConfig } from "../platform/cloud-client";
import { createContext, useContext, useEffect, useEffectEvent, useRef, useState, type ReactNode } from "react";
import type { Session, SupabaseClient } from "@supabase/supabase-js";
import type { Meal, Profile, Reading } from "../core/domain";
import { convertGlucose, exportRecordsCsv, mealInterval } from "../core/domain";
import { createDemoData } from "../data/demo";
import { cloneMealItems, validateMealPreset, type MealPreset } from "../core/meal-presets";
import {
  cloudError, mealFromRow, mealToRow, mealPresetFromRow, mealPresetToRow,
  profileFromRow, profileToRow, readingFromRow, readingToRow, readProfileRecords,
} from "../core/cloud";

type Mode = "loading" | "signed-out" | "demo" | "cloud";
type AppUser = { id: string; email: string | null };
type DemoData = ReturnType<typeof createDemoData> & { favorites: Record<string, string[]>; mealPresets: MealPreset[] };

interface Snapshot {
  mode: Mode;
  user: AppUser | null;
  enrolled: boolean;
  profiles: Profile[];
  activeId: string | null;
  readings: Reading[];
  meals: Meal[];
  mealPresets: MealPreset[];
  favorites: string[];
  recordsReady: boolean;
}

export interface AppContextValue extends Omit<Snapshot, "activeId"> {
  configured: boolean;
  registrationAvailable: boolean;
  needsEnrollment: boolean;
  activeProfile: Profile | null;
  busy: boolean;
  error: string | null;
  notice: string | null;
  signIn(email: string, password: string): Promise<boolean>;
  signOut(): Promise<boolean>;
  enterDemo(): Promise<boolean>;
  setActiveProfile(id: string): void;
  refresh(): Promise<boolean>;
  saveProfile(profile: Profile): Promise<boolean>;
  deleteProfile(id: string): Promise<boolean>;
  saveReading(reading: Reading): Promise<boolean>;
  deleteReading(id: string): Promise<boolean>;
  saveMeal(meal: Meal): Promise<boolean>;
  deleteMeal(id: string): Promise<boolean>;
  saveMealPreset(preset: MealPreset): Promise<boolean>;
  deleteMealPreset(id: string): Promise<boolean>;
  toggleFavorite(kind: "food" | "template", referenceId: string): Promise<boolean>;
  exportData(): string;
  clearMessages(): void;
}

const empty = (mode: Mode = "signed-out"): Snapshot => ({
  mode, user: null, enrolled: false, profiles: [], activeId: null, readings: [], meals: [], mealPresets: [], favorites: [], recordsReady: false,
});
const AppContext = createContext<AppContextValue | null>(null);
class UserMessage extends Error {}

export function AppProvider({ children }: { children: ReactNode }) {
  const [snapshot, setSnapshot] = useState<Snapshot>(() => empty("loading"));
  const [configured, setConfigured] = useState(false);
  const [registrationAvailable, setRegistrationAvailable] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const state = useRef(snapshot);
  const clientRef = useRef<SupabaseClient | null>(null);
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const demoRef = useRef<DemoData | null>(null);
  const authGeneration = useRef(0);
  const profileGeneration = useRef(0);
  const pending = useRef(0);
  const mutationLock = useRef(false);
  const mounted = useRef(true);

  function replace(next: Snapshot) {
    state.current = next;
    if (mounted.current) setSnapshot(next);
  }
  function patch(changes: Partial<Snapshot>) { replace({ ...state.current, ...changes }); }
  function begin() { pending.current += 1; if (mounted.current) setBusy(true); }
  function finish() { pending.current = Math.max(0, pending.current - 1); if (mounted.current) setBusy(pending.current > 0); }
  function clearMessages() { setError(null); setNotice(null); }
  function wipe(mode: Mode = "signed-out") {
    authGeneration.current += 1;
    profileGeneration.current += 1;
    demoRef.current = null;
    replace(empty(mode));
  }

  async function run(work: () => Promise<void>, success?: string): Promise<boolean> {
    if (mutationLock.current) { setNotice("上一项操作正在处理中，请稍候再试。"); return false; }
    mutationLock.current = true;
    clearMessages();
    begin();
    try {
      await work();
      if (success) setNotice(success);
      return true;
    } catch (caught) {
      setError(caught instanceof UserMessage ? caught.message : cloudError(caught));
      return false;
    } finally { mutationLock.current = false; finish(); }
  }

  async function loadProfile(profileId: string, generation = authGeneration.current) {
    const request = ++profileGeneration.current;
    patch({ activeId: profileId, readings: [], meals: [], mealPresets: [], favorites: [], recordsReady: false });
    if (state.current.mode === "demo") {
      const demo = demoRef.current;
      if (demo) patch({
        readings: demo.readings.filter(item => item.profileId === profileId),
        meals: demo.meals.filter(item => item.profileId === profileId),
        mealPresets: demo.mealPresets.filter(item => item.profileId === profileId),
        favorites: demo.favorites[profileId] ?? [],
        recordsReady: true,
      });
      return;
    }
    const client = clientRef.current;
    const userId = state.current.user?.id;
    if (!client || !userId || !state.current.enrolled) return;
    begin();
    try {
      const records = await readProfileRecords(client, userId, profileId);
      if (mounted.current && generation === authGeneration.current && request === profileGeneration.current)
        patch({ ...records, recordsReady: true });
    } catch (caught) {
      if (mounted.current && generation === authGeneration.current && request === profileGeneration.current)
        setError(cloudError(caught, "成员记录读取失败，请点击刷新重试。"));
      throw caught;
    } finally { finish(); }
  }

  async function loadAccount(userId: string, generation: number, preferredId?: string | null) {
    const client = clientRef.current;
    const selectedAtStart = profileGeneration.current;
    if (!client) throw new UserMessage("云连接尚未配置，请刷新重试。");
    const account = await client.from("glucose_accounts").select("status").eq("user_id", userId).maybeSingle();
    if (account.error) throw account.error;
    if (generation !== authGeneration.current || !mounted.current) return;
    if (account.data?.status !== "active") {
      ++profileGeneration.current;
      patch({ enrolled: false, profiles: [], activeId: null, readings: [], meals: [], mealPresets: [], favorites: [], recordsReady: false });
      if (account.data?.status === "suspended") setError("此账号的应用访问已停用，请联系维护者。");
      return;
    }
    const result = await client.from("glucose_profiles").select("*").eq("user_id", userId).order("created_at");
    if (result.error) throw result.error;
    if (generation !== authGeneration.current || !mounted.current) return;
    const profiles = (result.data ?? []).map(profileFromRow);
    patch({ enrolled: true, profiles });
    const preferred = selectedAtStart === profileGeneration.current ? preferredId : state.current.activeId;
    const chosen = profiles.find(profile => profile.id === preferred) ?? profiles[0];
    if (chosen) await loadProfile(chosen.id, generation);
    else { ++profileGeneration.current; patch({ activeId: null, readings: [], meals: [], mealPresets: [], favorites: [], recordsReady: false }); }
  }

  async function acceptSession(session: Session | null) {
    if (!mounted.current) return;
    if (!session) {
      if (state.current.mode !== "demo") wipe();
      return;
    }
    if (state.current.mode === "cloud" && state.current.user?.id === session.user.id) {
      patch({ user: { id: session.user.id, email: session.user.email ?? null } });
      return;
    }
    wipe("cloud");
    const generation = authGeneration.current;
    patch({ user: { id: session.user.id, email: session.user.email ?? null } });
    begin();
    try { await loadAccount(session.user.id, generation); }
    catch (caught) { if (generation === authGeneration.current) setError(cloudError(caught, "登录成功，但云端档案读取失败，请点击刷新重试。")); }
    finally { finish(); }
  }

  async function connect(isCurrent: () => boolean = () => mounted.current) {
    const config = await fetchPublicConfig();
    if (!isCurrent()) return;
    setConfigured(config.configured);
    setRegistrationAvailable(config.registrationAvailable);
    if (clientRef.current) return;
    const client = createBrowserCloud(config);
    clientRef.current = client;
    if (!client) { if (state.current.mode === "loading") replace(empty()); return; }
    const subscription = client.auth.onAuthStateChange((event, session) => {
      // Auth callbacks stay synchronous; data fetching runs after the SDK's auth lock is released.
      if (event === "INITIAL_SESSION") return;
      setTimeout(() => { if (mounted.current && clientRef.current === client) void acceptSession(session); }, 0);
    });
    unsubscribeRef.current = () => subscription.data.subscription.unsubscribe();
    const restored = await client.auth.getSession();
    if (!isCurrent()) return;
    if (restored.error) throw new UserMessage("无法恢复登录，请重新登录或点击刷新重试。");
    await acceptSession(restored.data.session);
  }

  useEffect(() => {
    mounted.current = true;
    let current = true;
    begin();
    void connect(() => current && mounted.current).catch(() => {
      if (!current) return;
      if (state.current.mode === "loading") replace(empty());
      setError("云连接暂时不可用，请点击刷新重试；也可以进入演示。");
    }).finally(finish);
    return () => {
      current = false;
      mounted.current = false;
      authGeneration.current += 1;
      profileGeneration.current += 1;
      unsubscribeRef.current?.();
      unsubscribeRef.current = null;
      clientRef.current = null;
    };
    // The connection and auth subscription are owned by the provider's lifetime.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onAppState = useEffectEvent((next: string) => {
      if (next === "active") {
        clientRef.current?.auth.startAutoRefresh();
        if (state.current.mode === "cloud" && !mutationLock.current) void refresh();
      } else clientRef.current?.auth.stopAutoRefresh();
  });
  useEffect(() => {
    const sub = AppState.addEventListener("change", onAppState);
    return () => sub.remove();
  }, []);

  function cloudIdentity() {
    const current = state.current;
    if (current.mode !== "cloud" || !clientRef.current || !current.user)
      throw new UserMessage("请先登录，或进入明确标记的演示模式。");
    if (!current.enrolled) throw new UserMessage("此账号尚未开通，请在「我的」中输入家庭开通码。");
    return { client: clientRef.current, userId: current.user.id, generation: authGeneration.current };
  }
  function requireProfile(profileId: string) {
    if (!state.current.profiles.some(profile => profile.id === profileId)) throw new UserMessage("成员不存在，请刷新后重试。");
    if (state.current.activeId !== profileId) throw new UserMessage("当前成员已变化，请切回原成员后重新提交。");
  }

  function signIn(email: string, password: string) {
    return run(async () => {
      if (!clientRef.current) await connect();
      const client = clientRef.current;
      if (!client) throw new UserMessage("云连接尚未配置，可以先使用演示和公共食物查询。");
      // A cloud login attempt always leaves demo mode; failed login never masquerades as demo.
      if (state.current.mode === "demo") wipe();
      const result = await client.auth.signInWithPassword({ email: email.trim(), password });
      if (result.error || !result.data.session) throw new UserMessage("登录未成功，请核对邮箱和密码，或稍后重试。");
      await acceptSession(result.data.session);
    });
  }

  async function signOut(): Promise<boolean> {
    // Clear private data immediately, even if the network request to revoke the session fails.
    clearMessages();
    wipe();
    begin();
    try {
      const result = await clientRef.current?.auth.signOut({ scope: "local" });
      if (result?.error) throw result.error;
      setNotice("已退出，当前设备内存中的健康记录已清空。");
      return true;
    } catch {
      // This is our app's auth key only; never clear another app's localStorage.
      try { await authStorage.removeItem("glucose-expo-auth-v1"); } catch { /* storage may be disabled */ }
      setError("本页健康记录已清空；退出请求未获确认，请刷新后检查登录状态。");
      return false;
    } finally { finish(); }
  }

  async function enterDemo(): Promise<boolean> {
    if (state.current.user) { setError("请先退出云端账号，再进入演示。"); return false; }
    clearMessages();
    wipe("demo");
    const demo: DemoData = { ...createDemoData(), favorites: {}, mealPresets: [] };
    demoRef.current = demo;
    patch({ profiles: demo.profiles });
    if (demo.profiles[0]) await loadProfile(demo.profiles[0].id);
    setNotice("正在使用演示数据。修改仅保存在本次页面内存中，退出或刷新即清空。");
    return true;
  }

  function setActiveProfile(id: string) {
    if (!state.current.profiles.some(profile => profile.id === id)) return;
    clearMessages();
    void loadProfile(id).catch(() => { /* loadProfile already exposes a retryable message */ });
  }

  function refresh() {
    return run(async () => {
      if (!clientRef.current) await connect();
      const current = state.current;
      if (current.mode === "cloud" && current.user)
        await loadAccount(current.user.id, authGeneration.current, current.activeId);
      else if (current.mode === "demo" && current.activeId) await loadProfile(current.activeId);
      else if (clientRef.current) {
        const restored = await clientRef.current.auth.getSession();
        if (restored.error) throw new UserMessage("无法恢复登录，请重新登录或稍后再次刷新。");
        await acceptSession(restored.data.session);
      }
    });
  }

  function saveProfile(profile: Profile) {
    return run(async () => {
      if (!profile.name.trim() || profile.name.length > 80) throw new UserMessage("请输入 1–80 字的成员昵称。");
      try { new Intl.DateTimeFormat("zh-CN", { timeZone: profile.timezone }).format(); }
      catch { throw new UserMessage("成员时区无效，请重新选择。"); }
      let saved = profile;
      if (state.current.mode === "demo" && demoRef.current) {
        demoRef.current.profiles = [...demoRef.current.profiles.filter(item => item.id !== profile.id), profile];
      } else {
        const { client, userId, generation } = cloudIdentity();
        const result = await client.from("glucose_profiles").upsert(profileToRow(profile, userId), { onConflict: "id" }).select().single();
        if (result.error) throw result.error;
        if (generation !== authGeneration.current) return;
        saved = profileFromRow(result.data);
      }
      patch({ profiles: [...state.current.profiles.filter(item => item.id !== saved.id), saved] });
      if (!state.current.activeId) await loadProfile(saved.id);
    }, state.current.mode === "demo" ? "演示成员已更新，仅保存在本次页面。" : "成员档案已保存到云端。");
  }

  function deleteProfile(id: string) {
    return run(async () => {
      requireProfile(id);
      if (state.current.mode === "demo" && demoRef.current) {
        demoRef.current.profiles = demoRef.current.profiles.filter(item => item.id !== id);
        demoRef.current.readings = demoRef.current.readings.filter(item => item.profileId !== id);
        demoRef.current.meals = demoRef.current.meals.filter(item => item.profileId !== id);
        demoRef.current.mealPresets = demoRef.current.mealPresets.filter(item => item.profileId !== id);
        delete demoRef.current.favorites[id];
      } else {
        const { client, userId, generation } = cloudIdentity();
        const result = await client.from("glucose_profiles").delete().eq("id", id).eq("user_id", userId).select("id");
        if (result.error) throw result.error;
        if (!result.data?.length) throw new UserMessage("删除结果未获确认，请刷新成员列表后重试。");
        if (generation !== authGeneration.current) return;
      }
      const profiles = state.current.profiles.filter(item => item.id !== id);
      ++profileGeneration.current;
      patch({ profiles, activeId: null, readings: [], meals: [], mealPresets: [], favorites: [], recordsReady: false });
      if (profiles[0]) await loadProfile(profiles[0].id);
    }, "成员及其健康记录已删除。");
  }

  function saveReading(reading: Reading) {
    return run(async () => {
      requireProfile(reading.profileId);
      let saved = { ...reading };
      if (!Number.isFinite(new Date(saved.measuredAt).getTime())) throw new UserMessage("测量时间无效，请重新选择。");
      if (saved.special) { saved.value = null; saved.standardValue = null; }
      else if (saved.value === null || !Number.isFinite(saved.value) || saved.value <= 0) throw new UserMessage("请输入大于 0 的血糖读数，或 HI / LO。");
      else saved.standardValue = convertGlucose(saved.value, saved.unit, "mmol/L");
      if (saved.mealId) {
        const meal = state.current.meals.find(item => item.id === saved.mealId && item.profileId === saved.profileId);
        if (!meal) throw new UserMessage("请选择当前成员的餐饮记录。");
        if (saved.context === "after-meal") {
          const interval = mealInterval(saved.measuredAt, meal.startedAt);
          saved.postMealMinutes = interval.minutes;
          saved.intervalSource = interval.source;
        }
      }
      if (saved.context !== "after-meal") { saved.postMealMinutes = null; saved.intervalSource = "unknown"; }
      if (state.current.mode === "demo" && demoRef.current) {
        demoRef.current.readings = [...demoRef.current.readings.filter(item => item.id !== saved.id), saved];
      } else {
        const { client, userId, generation } = cloudIdentity();
        const result = await client.from("glucose_readings").upsert(readingToRow(saved, userId), { onConflict: "id" }).select().single();
        if (result.error) throw result.error;
        if (generation !== authGeneration.current || state.current.activeId !== saved.profileId) return;
        saved = readingFromRow(result.data);
      }
      if (state.current.activeId === saved.profileId)
        patch({ readings: [...state.current.readings.filter(item => item.id !== saved.id), saved].sort((a, b) => b.measuredAt.localeCompare(a.measuredAt)) });
    }, state.current.mode === "demo" ? "演示血糖记录已保存，仅保存在本次页面。" : "血糖记录已保存到云端。");
  }

  function deleteReading(id: string) {
    return run(async () => {
      const reading = state.current.readings.find(item => item.id === id);
      if (!reading) throw new UserMessage("记录已变化，请刷新后重试。");
      requireProfile(reading.profileId);
      if (state.current.mode === "demo" && demoRef.current)
        demoRef.current.readings = demoRef.current.readings.filter(item => item.id !== id);
      else {
        const { client, userId, generation } = cloudIdentity();
        const result = await client.from("glucose_readings").delete().eq("id", id).eq("user_id", userId).eq("profile_id", reading.profileId).select("id");
        if (result.error) throw result.error;
        if (!result.data?.length) throw new UserMessage("删除结果未获确认，请刷新血糖记录后重试。");
        if (generation !== authGeneration.current || state.current.activeId !== reading.profileId) return;
      }
      patch({ readings: state.current.readings.filter(item => item.id !== id) });
    }, "血糖记录已删除。");
  }

  function saveMeal(meal: Meal) {
    return run(async () => {
      requireProfile(meal.profileId);
      if (!Number.isFinite(new Date(meal.startedAt).getTime())) throw new UserMessage("用餐时间无效，请重新选择。");
      if (!meal.items.length || meal.items.some(item => !item.name.trim() || !Number.isFinite(item.quantity) || item.quantity <= 0))
        throw new UserMessage("请至少填写一种食物，并核对名称与份量。");
      // Editing a meal may recompute linked intervals. Refuse a time that would precede its measurements.
      if (state.current.readings.some(item => item.mealId === meal.id && item.context === "after-meal" && new Date(item.measuredAt).getTime() < new Date(meal.startedAt).getTime()))
        throw new UserMessage("用餐时间晚于已关联的血糖测量，请先核对并修改关联记录。");
      let saved = meal;
      if (state.current.mode === "demo" && demoRef.current) {
        demoRef.current.meals = [...demoRef.current.meals.filter(item => item.id !== meal.id), meal];
        demoRef.current.readings = demoRef.current.readings.map(item => item.mealId === meal.id && item.context === "after-meal" ? { ...item, postMealMinutes: mealInterval(item.measuredAt, meal.startedAt).minutes, intervalSource: "calculated" } : item);
      } else {
        const { client, userId, generation } = cloudIdentity();
        const result = await client.from("glucose_meals").upsert(mealToRow(meal, userId), { onConflict: "id" }).select().single();
        if (result.error) throw result.error;
        if (generation !== authGeneration.current || state.current.activeId !== meal.profileId) return;
        saved = mealFromRow(result.data);
      }
      if (state.current.activeId === saved.profileId) {
        patch({
          meals: [...state.current.meals.filter(item => item.id !== saved.id), saved].sort((a, b) => b.startedAt.localeCompare(a.startedAt)),
          readings: state.current.readings.map(item => item.mealId === saved.id && item.context === "after-meal" ? { ...item, postMealMinutes: mealInterval(item.measuredAt, saved.startedAt).minutes, intervalSource: "calculated" } : item),
        });
      }
    }, state.current.mode === "demo" ? "演示餐饮记录已保存，仅保存在本次页面。" : "餐饮记录已保存到云端。");
  }

  function deleteMeal(id: string) {
    return run(async () => {
      const meal = state.current.meals.find(item => item.id === id);
      if (!meal) throw new UserMessage("餐饮记录已变化，请刷新后重试。");
      requireProfile(meal.profileId);
      // Retain the original interval and its provenance; deleting a meal is not a manual edit.
      const detach = (reading: Reading): Reading => reading.mealId === id ? { ...reading, mealId: null } : reading;
      if (state.current.mode === "demo" && demoRef.current) {
        demoRef.current.meals = demoRef.current.meals.filter(item => item.id !== id);
        demoRef.current.readings = demoRef.current.readings.map(detach);
      } else {
        const { client, userId, generation } = cloudIdentity();
        const result = await client.from("glucose_meals").delete().eq("id", id).eq("user_id", userId).eq("profile_id", meal.profileId).select("id");
        if (result.error) throw result.error;
        if (!result.data?.length) throw new UserMessage("删除结果未获确认，请刷新餐饮记录后重试。");
        if (generation !== authGeneration.current || state.current.activeId !== meal.profileId) return;
      }
      patch({ meals: state.current.meals.filter(item => item.id !== id), readings: state.current.readings.map(detach) });
    }, "餐饮记录已删除，相关血糖测量仍保留。");
  }

  function saveMealPreset(preset: MealPreset) {
    return run(async () => {
      requireProfile(preset.profileId);
      if (!state.current.recordsReady) throw new UserMessage("成员记录尚未加载完成，请稍候或刷新后再保存组合。");
      try { validateMealPreset(preset); }
      catch (caught) { throw new UserMessage(caught instanceof Error ? caught.message : "请核对组合名称与食物份量。"); }
      // Capture independent data before awaiting the network; later form/meal edits cannot change it.
      let saved: MealPreset = { ...preset, name: preset.name.trim(), items: cloneMealItems(preset.items) };
      const request = profileGeneration.current;
      if (state.current.mode === "demo" && demoRef.current) {
        const previous = demoRef.current.mealPresets.find(item => item.id === saved.id);
        if (previous && previous.profileId !== saved.profileId) throw new UserMessage("这个组合属于其他成员，请重新添加。");
        const now = new Date().toISOString();
        saved = { ...saved, createdAt: previous?.createdAt ?? now, updatedAt: now };
        demoRef.current.mealPresets = [...demoRef.current.mealPresets.filter(item => item.id !== saved.id), saved];
      } else {
        const { client, userId, generation } = cloudIdentity();
        const result = await client.from("glucose_meal_presets").upsert(mealPresetToRow(saved, userId), { onConflict: "id" }).select().single();
        if (result.error) throw result.error;
        if (generation !== authGeneration.current || request !== profileGeneration.current || state.current.activeId !== saved.profileId) return;
        saved = mealPresetFromRow(result.data);
      }
      patch({ mealPresets: [...state.current.mealPresets.filter(item => item.id !== saved.id), saved]
        .sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? "") || a.id.localeCompare(b.id)) });
    }, state.current.mode === "demo" ? "演示常吃组合已保存，仅保存在本次页面。" : "常吃组合已保存到云端，可在下次记录时使用。");
  }

  function deleteMealPreset(id: string) {
    return run(async () => {
      if (!state.current.recordsReady) throw new UserMessage("成员记录尚未加载完成，请稍候或刷新后再试。");
      const preset = state.current.mealPresets.find(item => item.id === id);
      if (!preset) throw new UserMessage("常吃组合已变化，请刷新后重试。");
      requireProfile(preset.profileId);
      const request = profileGeneration.current;
      if (state.current.mode === "demo" && demoRef.current)
        demoRef.current.mealPresets = demoRef.current.mealPresets.filter(item => item.id !== id);
      else {
        const { client, userId, generation } = cloudIdentity();
        const result = await client.from("glucose_meal_presets").delete().eq("id", id).eq("user_id", userId).eq("profile_id", preset.profileId).select("id");
        if (result.error) throw result.error;
        if (!result.data?.length) throw new UserMessage("删除结果未获确认，请刷新常吃组合后重试。");
        if (generation !== authGeneration.current || request !== profileGeneration.current || state.current.activeId !== preset.profileId) return;
      }
      patch({ mealPresets: state.current.mealPresets.filter(item => item.id !== id) });
    }, "常吃组合已删除，过去的餐饮记录仍保留。");
  }

  function toggleFavorite(kind: "food" | "template", referenceId: string) {
    return run(async () => {
      const profileId = state.current.activeId;
      if (!profileId) throw new UserMessage("请先登录并创建成员，或进入演示后再收藏。");
      const key = `${kind}:${referenceId}`;
      const exists = state.current.favorites.includes(key);
      if (state.current.mode === "demo" && demoRef.current) {
        demoRef.current.favorites[profileId] = exists ? state.current.favorites.filter(item => item !== key) : [...state.current.favorites, key];
      } else {
        const { client, userId, generation } = cloudIdentity();
        const result = exists
          ? await client.from("glucose_favorites").delete().eq("user_id", userId).eq("profile_id", profileId).eq("kind", kind).eq("reference_id", referenceId).select("reference_id")
          : await client.from("glucose_favorites").upsert({ user_id: userId, profile_id: profileId, kind, reference_id: referenceId }, { onConflict: "user_id,profile_id,kind,reference_id" }).select("reference_id");
        if (result.error) throw result.error;
        if (!result.data?.length) throw new UserMessage("收藏结果未获确认，请刷新当前成员后重试。");
        if (generation !== authGeneration.current || state.current.activeId !== profileId) return;
      }
      patch({ favorites: exists ? state.current.favorites.filter(item => item !== key) : [...state.current.favorites, key] });
    });
  }

  const activeProfile = snapshot.profiles.find(profile => profile.id === snapshot.activeId) ?? null;
  return <AppContext.Provider value={{
    ...snapshot, configured, registrationAvailable, needsEnrollment: snapshot.mode === "cloud" && !!snapshot.user && !snapshot.enrolled,
    activeProfile, busy, error, notice,
    signIn, signOut, enterDemo, setActiveProfile, refresh, saveProfile, deleteProfile,
    saveReading, deleteReading, saveMeal, deleteMeal, saveMealPreset, deleteMealPreset, toggleFavorite, clearMessages,
    exportData: () => activeProfile ? exportRecordsCsv(snapshot.readings, snapshot.meals, activeProfile) : "",
  }}>{children}</AppContext.Provider>;
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error("useApp 需要在 AppProvider 内使用。");
  return context;
}
