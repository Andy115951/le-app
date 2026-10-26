"use client";

import { useEffect, useRef } from "react";
import { Droplet, Pencil, Utensils, X } from "lucide-react";
import type { Meal } from "@/lib/domain";
import { readingsForMeal, timingFromMeal } from "@/lib/meal-review";
import { contexts, dayKey, displayValue, mealNames } from "@/lib/ui-utils";
import { useApp } from "./app-provider";
import type { EditorState } from "./record-dialog";

export function MealReviewDialog({ meal, close, edit }: { meal: Meal; close: () => void; edit: (state: EditorState) => void }) {
  const app = useApp();
  const profile = app.activeProfile!;
  const dialog = useRef<HTMLDialogElement>(null);
  const readings = readingsForMeal(meal, app.readings);
  const formatTime = (value: string) => new Intl.DateTimeFormat("zh-CN", { timeZone: profile.timezone, year: "numeric", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(value));
  useEffect(() => {
    dialog.current?.showModal();
    const previous = document.body.style.overflow; document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, []);
  const add = (context: "before-meal" | "after-meal") => edit({ kind: "reading", linkedMealId: meal.id, readingContext: context, selectedDay: dayKey(meal.startedAt, profile.timezone) });
  return <dialog ref={dialog} className="record-dialog meal-review-dialog" aria-labelledby="meal-review-title" onCancel={close} onClick={event => { if (event.target === event.currentTarget) close(); }}>
    <div className="dialog-inner">
      <div className="dialog-heading"><div className="dialog-icon"><Utensils size={23} /></div><div><h2 id="meal-review-title">同餐回看 · {mealNames[meal.type]}</h2><p>{profile.name} · {app.mode === "demo" ? "合成演示 · " : ""}时区 {profile.timezone}</p></div><button type="button" className="icon-button" aria-label="关闭同餐回看" onClick={close}><X size={20} /></button></div>
      <div className="dialog-body meal-review-body">
        <section><div className="section-heading"><div><h3>这餐吃了什么</h3><p>{formatTime(meal.startedAt)} 开始用餐</p></div><button type="button" className="text-link" disabled={app.busy} onClick={() => edit({ kind: "meal", meal })}><Pencil size={14} />修改这餐</button></div>
          <ul className="meal-review-foods">{meal.items.map(item => <li key={item.id}><span>{item.name}</span><strong>{item.quantity}{item.unit}{item.grams !== null && !/^(克|g)$/i.test(item.unit) ? `（${item.grams} 克）` : ""}</strong></li>)}</ul>
          {meal.notes && <p className="meal-review-notes">用餐备注：{meal.notes}</p>}
        </section>
        <section><div className="section-heading"><div><h3>关联实测 · {readings.length} 次</h3><p>按实际测量时间排列，包含跨日记录。</p></div></div>
          {!readings.length ? <p className="inline-note">这餐还没有关联血糖，可以补记餐前或餐后测量。</p> : <ol className="meal-review-readings">{readings.map(reading => <li key={reading.id}>
            <div className="meal-review-reading-top"><span><Droplet size={14} />{contexts[reading.context]}</span><strong>{displayValue(reading, profile.unit)} <small>{profile.unit}</small></strong><button type="button" className="text-link" disabled={app.busy} aria-label={`修改${formatTime(reading.measuredAt)}${contexts[reading.context]}测量`} onClick={() => edit({ kind: "reading", reading })}>修改</button></div>
            <p><time>{formatTime(reading.measuredAt)}</time> · {timingFromMeal(meal, reading)}</p>
            <small className="muted">原始读数：{reading.special || reading.value} {reading.unit}</small>
            {reading.notes && <p className="meal-review-notes">{reading.notes}</p>}
          </li>)}</ol>}
          <p className="muted">仅展示明确关联到这餐的记录，间隔按实际时间计算。</p>
        </section>
      </div>
      <div className="dialog-footer"><button type="button" className="button secondary" disabled={app.busy} onClick={() => add("before-meal")}>补记餐前</button><button type="button" className="button primary" disabled={app.busy} onClick={() => add("after-meal")}>补记餐后</button></div>
    </div>
  </dialog>;
}
