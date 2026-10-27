"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Check, Scissors } from "lucide-react";
import type { Reading } from "@/lib/types";
import type { DrawAction } from "@/lib/manual-draw";
import { Button } from "@/components/ui/button";
import { TarotCardBack } from "@/components/reading/tarot-card-face";
import { CutDeck } from "@/components/reading/cut-deck";

const FAN_STEP = 44;
export function ManualDrawStage({
  reading,
  onChange,
}: {
  reading: Reading;
  onChange: (reading: Reading) => void;
}) {
  const draw = reading.manualDraw!;
  const [phase, setPhase] = useState(
    draw.cutIndex === null ? "rest" : "selecting",
  );
  const [cutIndex, setCutIndex] = useState(39);
  const [fanCenter, setFanCenter] = useState(2.5);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [optimistic, setOptimistic] = useState<number[] | null>(null);
  const requestInFlight = useRef(false);
  const fanRef = useRef<HTMLDivElement>(null);
  const pointer = useRef<{ x: number; y: number; scroll: number; mouse: boolean } | null>(null);
  const swiped = useRef(false);
  const selected = optimistic ?? draw.selected;
  const count = draw.positions.length;
  const cutting = draw.cutIndex === null;
  const fan = Array.from({ length: draw.cardCount }, (_, i) => i);

  useEffect(() => {
    const element = fanRef.current;
    if (!element) return;
    const observer = new ResizeObserver(() => setFanCenter((element.scrollLeft + element.clientWidth / 2 - 36 - 39) / FAN_STEP));
    observer.observe(element);
    return () => observer.disconnect();
  }, [cutting]);

  useEffect(() => {
    if (phase !== "shuffling") return;
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const duration = reduced
      ? 200
      : reading.ritualSpeed === "slow"
        ? 1900
        : reading.ritualSpeed === "fast"
          ? 700
          : 1250;
    const timer = window.setTimeout(() => setPhase("cutting"), duration);
    return () => window.clearTimeout(timer);
  }, [phase, reading.ritualSpeed]);

  async function send(action: DrawAction) {
    if (requestInFlight.current) return;
    requestInFlight.current = true;
    setBusy(true);
    setError("");
    if (action.action === "select") setOptimistic(action.selected);
    try {
      const response = await fetch(`/api/readings/${reading.id}/draw`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(action),
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.error || "操作没能保存，请再试一次。");
      onChange(result.reading);
    } catch (e) {
      setError(e instanceof Error ? e.message : "连接暂时中断，请重试。");
      // A response can be lost after the server committed. Recover its saved
      // revision instead of drawing a second card or charging again.
      try {
        const response = await fetch(`/api/readings/${reading.id}`, {
          cache: "no-store",
        });
        if (response.ok) {
          const result = await response.json();
          onChange(result.reading);
        }
      } catch {
        /* Keep the last saved state and the retryable error. */
      }
    } finally {
      setOptimistic(null);
      setBusy(false);
      requestInFlight.current = false;
    }
  }
  function choose(index: number) {
    if (requestInFlight.current) return;
    const next = selected.includes(index)
      ? selected.filter((i) => i !== index)
      : [...selected, index];
    if (next.length <= count)
      void send({ action: "select", revision: draw.revision, selected: next });
  }

  return (
    <section
      className="manual-draw overflow-hidden rounded-2xl border border-primary/25 bg-card/50"
      aria-label="手动抽牌仪式"
      aria-busy={busy}
    >
      <div className="px-4 pt-6 text-center sm:px-8">
        <p className="text-[10px] tracking-[0.45em] text-primary/65">
          CANDLE · THE DRAW
        </p>
        <h2 className="mt-3 font-serif text-2xl tracking-wide text-foreground">
          {cutting
            ? phase === "rest"
              ? "先把问题，放在心里"
              : phase === "shuffling"
                ? "让牌慢慢洗匀"
                : "在这里，轻轻切一刀"
            : "这一次，由你来抽"}
        </h2>
        <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-muted-foreground">
          {cutting
            ? "不必急着寻找答案。让呼吸慢一点，把眼前的问题交给这副牌。"
            : "左右拨动牌堆，选出让你想停留的牌。翻开之前，都可以轻点放回。"}
        </p>
      </div>

      {cutting ? (
        <div className="px-5 pb-7 text-center sm:px-10">
          {phase === "cutting" ? (
            <CutDeck value={cutIndex} onChange={setCutIndex} disabled={busy} />
          ) : (
            <div
              className={`manual-pile relative mx-auto my-8 h-48 w-36 ${phase === "shuffling" ? "manual-pile--shuffle" : ""}`}
              aria-hidden
            >
              {Array.from({ length: 7 }, (_, i) => (
                <div
                  key={i}
                  className="manual-pile-layer absolute inset-0"
                  style={{ "--layer": i } as CSSProperties}
                >
                  <TarotCardBack className="h-full" />
                </div>
              ))}
            </div>
          )}
          {phase === "rest" ? (
            <Button
              size="lg"
              onClick={() => setPhase("shuffling")}
              className="min-w-40"
            >
              开始洗牌
            </Button>
          ) : phase === "shuffling" ? (
            <p
              role="status"
              className="text-sm tracking-widest text-primary/80"
            >
              牌正在交错，先静心片刻…
            </p>
          ) : (
            <div className="mx-auto max-w-sm space-y-4">
              <label
                htmlFor="draw-cut"
                className="block text-xs text-muted-foreground"
              >
                在第 {cutIndex} 张切开 · 牌顶 {cutIndex} 张 / 牌底 {78 - cutIndex} 张
              </label>
              <input
                id="draw-cut"
                className="h-11 w-full cursor-pointer accent-amber-400"
                type="range"
                min="1"
                max="77"
                value={cutIndex}
                disabled={busy}
                onChange={(e) => setCutIndex(Number(e.target.value))}
              />
              <Button
                size="lg"
                disabled={busy}
                onClick={() =>
                  void send({
                    action: "cut",
                    revision: draw.revision,
                    cutIndex,
                  })
                }
                className="min-w-40"
              >
                <Scissors className="size-4" />
                {busy ? "正在切牌…" : "从这里切牌"}
              </Button>
            </div>
          )}
        </div>
      ) : (
        <>
          <div
            className={`manual-slots mt-6 flex gap-3 overflow-x-auto px-4 pb-4 sm:px-8 ${count <= 5 ? "sm:justify-center" : ""}`}
            aria-label="已选牌位"
          >
            {draw.positions.map((position, i) => {
              const index = selected[i];
              const filled = index !== undefined;
              return (
                <button
                  key={position.position}
                  type="button"
                  className={`manual-slot relative flex w-[82px] shrink-0 flex-col items-center gap-2 rounded-xl p-1 outline-offset-4 focus-visible:outline-2 focus-visible:outline-primary ${filled ? "manual-slot--filled" : ""}`}
                  disabled={!filled || busy}
                  aria-label={
                    filled
                      ? `放回${position.positionLabel}的牌，第 ${index + 1} 张`
                      : `${position.positionLabel}，等待选牌`
                  }
                  onClick={() => choose(index)}
                >
                  {filled ? (
                    <TarotCardBack compact className="!h-28 w-full" />
                  ) : (
                    <span className="flex h-28 w-full items-center justify-center rounded-lg border border-dashed border-primary/25 text-xl text-primary/35">
                      {i + 1}
                    </span>
                  )}
                  <span className="max-w-full truncate text-[11px] text-primary/80">
                    {position.positionLabel}
                  </span>
                </button>
              );
            })}
          </div>
          <p
            className="text-center text-xs tracking-wide text-primary/80"
            role="status"
            aria-live="polite"
          >
            {busy ? "正在保存这一张…" : `已选 ${selected.length} / ${count} 张`}
          </p>
          <div
            ref={fanRef}
            className="manual-fan relative mt-1 h-60 select-none overflow-x-auto overflow-y-hidden"
            role="group"
            tabIndex={0}
            aria-label={`扇形牌堆，共 ${draw.cardCount} 张，可连续左右滑动`}
            onKeyDown={(e) => {
              if (e.target !== e.currentTarget) return;
              const element = e.currentTarget;
              if (e.key === "ArrowLeft") element.scrollLeft -= FAN_STEP;
              else if (e.key === "ArrowRight") element.scrollLeft += FAN_STEP;
              else if (e.key === "Home") element.scrollLeft = 0;
              else if (e.key === "End") element.scrollLeft = element.scrollWidth;
              else return;
              e.preventDefault();
            }}
            onScroll={e => setFanCenter((e.currentTarget.scrollLeft + e.currentTarget.clientWidth / 2 - 36 - 39) / FAN_STEP)}
            onPointerDown={(e) => {
              pointer.current = { x: e.clientX, y: e.clientY, scroll: e.currentTarget.scrollLeft, mouse: e.pointerType === "mouse" };
              swiped.current = false;
            }}
            onPointerMove={e => {
              const start = pointer.current;
              if (!start?.mouse || Math.abs(e.clientX - start.x) < 6) return;
              swiped.current = true;
              e.currentTarget.setPointerCapture(e.pointerId);
              e.currentTarget.scrollLeft = start.scroll - (e.clientX - start.x);
              e.preventDefault();
            }}
            onPointerUp={(e) => {
              const start = pointer.current;
              pointer.current = null;
              if (start && Math.abs(e.clientX - start.x) > 10) swiped.current = true;
              if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
            }}
            onPointerCancel={() => {
              pointer.current = null;
              swiped.current = true;
            }}
          >
            <div className="relative h-full" style={{ width: (draw.cardCount - 1) * FAN_STEP + 78 + 72 }}>
              <div
                className="manual-fan-glow pointer-events-none absolute inset-0"
                aria-hidden
              />
              {fan.map((index, i) => {
                const offset = Math.max(-6, Math.min(6, index - fanCenter));
                const chosen = selected.indexOf(index);
                return (
                  <button
                    key={index}
                    type="button"
                    className="manual-fan-card absolute top-12 w-[78px] rounded-lg outline-offset-4 focus-visible:outline-2 focus-visible:outline-primary"
                    style={
                      {
                        left: 36 + index * FAN_STEP,
                        "--fan-angle": `${offset * 5}deg`,
                        "--fan-y": `${Math.abs(offset) * 5}px`,
                        zIndex: i + 1,
                      } as CSSProperties
                    }
                    data-selected={chosen >= 0}
                    aria-pressed={chosen >= 0}
                    aria-label={`第 ${index + 1} 张背面牌${chosen >= 0 ? `，已选为第 ${chosen + 1} 张` : ""}`}
                    disabled={busy || (selected.length >= count && chosen < 0)}
                    onClick={(e) => {
                      if (e.detail === 0 || !swiped.current) choose(index);
                    }}
                  >
                    <TarotCardBack className="!min-h-0 !h-36" />
                    {chosen >= 0 ? (
                      <span className="absolute inset-0 flex items-center justify-center rounded-lg border border-primary bg-background/65">
                        <span className="flex size-9 items-center justify-center rounded-full bg-primary text-primary-foreground">
                          <Check className="size-5" />
                        </span>
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>
          <p className="px-4 py-4 text-center text-xs text-muted-foreground">共 {draw.cardCount} 张 · 连续左右滑动，随手停留</p>
          <div className="border-t border-primary/10 bg-background/35 px-4 py-5 text-center sm:px-8">
            <Button
              size="lg"
              className="w-full sm:w-auto sm:min-w-48"
              disabled={busy || selected.length !== count}
              onClick={() =>
                void send({ action: "confirm", revision: draw.revision })
              }
            >
              {busy
                ? "正在保存…"
                : selected.length === count
                  ? "就这几张，翻开牌面"
                  : `还需要选 ${count - selected.length} 张`}
            </Button>
            <p className="mt-3 text-[11px] leading-5 text-muted-foreground">
              点击时随机抽牌，已抽出的牌会保存。确认后揭晓，刷新不会重抽。
            </p>
          </div>
        </>
      )}
      {error ? (
        <p
          className="px-5 pb-5 text-center text-sm text-destructive"
          role="alert"
        >
          {error}
        </p>
      ) : null}
    </section>
  );
}
