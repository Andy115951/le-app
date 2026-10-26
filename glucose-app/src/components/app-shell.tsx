"use client";

import { GuardedLink as Link, useUnsavedChanges } from "./unsaved-changes";
import { MealReviewDialog } from "./meal-review-dialog";
import type { Meal } from "@/lib/domain";
import { usePathname } from "next/navigation";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import { Activity, ArrowUpRight, BookOpen, ChevronDown, CircleHelp, Cloud, Droplet, Home, Leaf, LogIn, Plus, Settings2, Sprout, Utensils, X } from "lucide-react";
import { useApp } from "./app-provider";
import { RecordDialog, type EditorState } from "./record-dialog";

const EditorContext = createContext<(state: EditorState) => void>(() => {});
const MealReviewContext = createContext<(meal: Meal) => void>(() => {});
export const useMealReview = () => useContext(MealReviewContext);
export const useEditor = () => useContext(EditorContext);
const navigation = [ { href: "/", label: "今日概览", mobile: "今日", icon: Home }, { href: "/foods", label: "食物图鉴", mobile: "查食物", icon: BookOpen }, { href: "/suggestions", label: "今天吃什么", mobile: "吃什么", icon: Sprout }, { href: "/history", label: "记录与趋势", mobile: "历史", icon: Activity } ];

export function AppShell({ children }: { children: React.ReactNode }) {
  const app = useApp();
  const pathname = usePathname();
  const guard = useUnsavedChanges();
  const [review, setReview] = useState<{ id: string; ownerProfileId: string } | null>(null);
  const reviewMeal = review && review.ownerProfileId === app.activeProfile?.id ? app.meals.find(meal => meal.id === review.id && meal.profileId === review.ownerProfileId) : undefined;
  const [editor, setEditor] = useState<(EditorState & { ownerProfileId: string; instance: number }) | null>(null);
  const editorInstance = useRef(0);
  useEffect(() => { setEditor(null); setReview(null); }, [app.activeProfile?.id, app.user?.id, app.mode]);
  useEffect(() => { setReview(null); }, [pathname]);
  const open = (state: EditorState) => {
    if (!app.activeProfile) { window.location.href = "/settings"; return; }
    const profileId = app.activeProfile.id;
    if ([state.reading, state.meal, state.preset].some(record => record && record.profileId !== profileId)) return;
    if (state.linkedMealId && !app.meals.some(meal => meal.id === state.linkedMealId && meal.profileId === profileId)) return;
    guard.leave(() => setEditor({ ...state, ownerProfileId: profileId, instance: ++editorInstance.current }));
  };
  const openReview = (meal: Meal) => {
    if (meal.profileId === app.activeProfile?.id && app.recordsReady) guard.leave(() => setReview({ id: meal.id, ownerProfileId: meal.profileId }));
  };
  return <EditorContext.Provider value={open}><MealReviewContext.Provider value={openReview}>
    <a className="skip-link" href="#main">跳转到主要内容</a>
    <aside className="sidebar">
      <Link className="brand" href="/"><span className="brand-mark"><Droplet size={25} strokeWidth={1.6} /></span><span>糖记<small>SUGAR NOTES</small></span></Link>
      <div className="sidebar-caption">每一天，都值得好好照顾</div>
      <nav aria-label="主要导航">{navigation.map(({ href, label, icon: Icon }) => <Link key={href} className={`nav-link ${pathname === href || href !== "/" && pathname.startsWith(href) ? "active" : ""}`} href={href}><Icon size={20} /><span>{label}</span>{pathname === href && <span className="nav-dot" />}</Link>)}</nav>
      <div className="sidebar-note"><Leaf size={25} /><p>好好吃饭，<br />慢慢记录。</p><small>从了解自己开始，<br />找到适合自己的生活节奏。</small></div>
      <Link className={`nav-link settings-link ${pathname === "/settings" ? "active" : ""}`} href="/settings"><Settings2 size={20} />我的与家人</Link>
      <div className="sidebar-footer"><span className="status-dot" /> 为自己，也为在意的人</div>
    </aside>
    <div className="workspace">
      <header className="topbar"><Link className="mobile-brand" href="/"><Droplet size={21} />糖记</Link><span className="topbar-label">一点点记录，一点点了解自己</span><div className="topbar-right"><span className={`sync-state ${app.mode === "demo" ? "demo" : ""}`}><Cloud size={15} />{app.mode === "demo" ? "演示数据 · 仅本次体验" : app.mode === "cloud" ? "云端记录" : "你的健康小手账"}</span>{app.activeProfile ? <label className="profile-picker"><span className="avatar">{app.activeProfile.name.slice(0, 1)}</span><select aria-label="切换记录成员" value={app.activeProfile.id} onChange={e => { const id = e.target.value; guard.leave(() => app.setActiveProfile(id)); }}>{app.profiles.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select><ChevronDown size={13} /></label> : <Link className="login-link" href="/settings"><LogIn size={16} />登录</Link>}</div></header>
      <main id="main" className="main-content">
        {app.mode === "demo" && <div className="demo-banner"><span>你正在体验演示版，示例和修改仅在本次页面会话中保留。</span><Link href="/settings">登录并开启云同步 <ArrowUpRight size={14} /></Link></div>}
        {(app.error || app.notice) && <div role={app.error ? "alert" : "status"} className={`message ${app.error ? "error" : "success"}`}><span>{app.error || app.notice}</span>{app.error && <button onClick={() => void app.refresh()} disabled={app.busy}>刷新云端记录</button>}<button className="icon-button" aria-label="关闭提示" onClick={app.clearMessages}><X size={16} /></button></div>}
        {children}
        <footer className="page-footer"><Leaf size={13} /><span>认真记录，温柔照顾自己。</span><span className="footer-disclaimer">用于饮食学习与日常记录，诊疗与目标请遵循医疗团队建议。</span></footer>
      </main>
    </div>
    <nav className="mobile-nav" aria-label="手机导航">{navigation.filter(n => n.href !== "/history").map(({ href, mobile, icon: Icon }) => <Link key={href} href={href} className={pathname === href || href !== "/" && pathname.startsWith(href) ? "active" : ""}><Icon size={21} /><span>{mobile}</span></Link>)}<Link href="/settings" className={pathname === "/settings" ? "active" : ""}><Settings2 size={21} /><span>我的</span></Link></nav>
    {!editor && reviewMeal && <MealReviewDialog meal={reviewMeal} close={() => setReview(null)} edit={open} />}
    {editor && app.activeProfile && editor.ownerProfileId === app.activeProfile.id && <RecordDialog key={`${app.activeProfile.id}-${editor.instance}`} state={editor} close={() => setEditor(null)} />}
  </MealReviewContext.Provider></EditorContext.Provider>;
}

export function PageHeading({ eyebrow, title, description, actions }: { eyebrow: string; title: string; description: string; actions?: React.ReactNode }) {
  return <div className="page-heading"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1><p>{description}</p></div>{actions && <div className="heading-actions">{actions}</div>}</div>;
}
export function RecordButtons({ selectedDay }: { selectedDay?: string }) {
  const open = useEditor();
  const app = useApp();
  const disabled = app.busy || (!!app.activeProfile && !app.recordsReady);
  return <><button className="button secondary" disabled={disabled} onClick={() => open({ kind: "meal", selectedDay })}><Utensils size={17} />记饮食</button><button className="button primary" disabled={disabled} onClick={() => open({ kind: "reading", selectedDay })}><Plus size={18} />记血糖</button></>;
}
export function SignInPrompt() {
  const app = useApp();
  if (app.mode === "loading") return <div className="empty card"><div className="loading-dot" /><p>正在打开你的小手账…</p></div>;
  if (app.mode === "cloud") return <section className="welcome-card card"><div className="welcome-art"><UsersIcon /></div><div><span className="eyebrow">准备好你的小手账</span><h2>{app.enrolled ? "先添加一位成员吧" : "输入家庭码，开启记录"}</h2><p>{app.enrolled ? "可以先建「本人」，也可以为家人各建一份档案。" : "账号已登录，开通这本手账后就能保存私人记录。"}</p><Link className="button primary" href="/settings">{app.enrolled ? "创建成员档案" : "开通手账访问"}<ArrowUpRight size={16} /></Link></div></section>;
  return <section className="welcome-card card"><div className="welcome-art"><Droplet size={48} /><Leaf size={26} /></div><div><span className="eyebrow">从今天这一餐开始</span><h2>给健康留一点记录的时间</h2><p>查查常吃的食物，记下每一餐与实测血糖。<br />属于你和家人的记录，登录后会安全同步。</p><div className="button-row"><Link className="button primary" href="/settings">登录 / 开通手账 <ArrowUpRight size={16} /></Link><button className="button secondary" onClick={() => app.enterDemo()}>先体验一下</button></div></div><div className="welcome-features"><span><Droplet size={16} />每次测量，都有迹可循</span><span><Utensils size={16} />把饮食与血糖放在一起看</span><span><CircleHelp size={16} />了解食物，也了解自己</span></div></section>;
}

function UsersIcon() { return <Leaf size={48} />; }
