"use client";

import { useRef, useState, type CSSProperties } from "react";
import { TarotCardBack } from "@/components/reading/tarot-card-face";

const LAST_CUT = 77;
const DRAG_STEP = 6;
const clamp = (value: number) => Math.max(1, Math.min(LAST_CUT, value));

export function CutDeck({
  value,
  onChange,
  disabled,
}: {
  value: number;
  onChange: (value: number) => void;
  disabled: boolean;
}) {
  const gesture = useRef<{
    id: number;
    x: number;
    y: number;
    value: number;
    horizontal: boolean;
  } | null>(null);
  const [preview, setPreview] = useState<number | null>(null);
  const position = preview ?? value;
  const first = Math.max(1, Math.floor(position) - 5);
  const last = Math.min(LAST_CUT, Math.ceil(position) + 5);
  const cards = Array.from({ length: last - first + 1 }, (_, i) => {
    const index = first + i;
    const offset = index - position;
    const distance = Math.abs(offset);
    const scale = 1 - distance * 0.035;
    const angle = offset * 4;
    const radians = angle * Math.PI / 180;
    // Match the 8rem × 11rem back and its center/90% transform origin.
    const centerX = offset * 1.125 + Math.sin(radians) * scale * 4.4;
    const halfWidth = scale * (
      Math.abs(Math.cos(radians)) * 4 + Math.abs(Math.sin(radians)) * 5.5
    );
    return {
      index, offset, distance, scale, angle,
      left: centerX - halfWidth,
      right: centerX + halfWidth,
    };
  });
  // Center only the real visible cards; never add backs beyond either end.
  const center = (
    Math.min(...cards.map(card => card.left)) +
    Math.max(...cards.map(card => card.right))
  ) / 2;

  return (
    <div className="mx-auto my-5 max-w-sm">
      <div
        role="slider"
        tabIndex={disabled ? -1 : 0}
        aria-label="拖动牌堆选择切牌位置"
        aria-describedby="cut-deck-hint"
        aria-valuemin={1}
        aria-valuemax={LAST_CUT}
        aria-valuenow={value}
        aria-valuetext={`第 ${value} 张，右拖靠近牌顶，左拖靠近牌底`}
        aria-orientation="horizontal"
        aria-disabled={disabled}
        className="manual-cut-deck relative h-60 select-none overflow-hidden rounded-xl outline-offset-4 focus-visible:outline-2 focus-visible:outline-primary"
        data-dragging={preview !== null}
        onPointerDown={(event) => {
          if (disabled || !event.isPrimary || event.button !== 0) return;
          gesture.current = {
            id: event.pointerId,
            x: event.clientX,
            y: event.clientY,
            value,
            horizontal: false,
          };
          event.currentTarget.focus({ preventScroll: true });
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          const start = gesture.current;
          if (disabled || !start || start.id !== event.pointerId) return;
          const delta = event.clientX - start.x;
          if (!start.horizontal) {
            const vertical = Math.abs(event.clientY - start.y);
            if (vertical > Math.abs(delta) && vertical >= 6) {
              event.currentTarget.releasePointerCapture(event.pointerId);
              return;
            }
            if (Math.abs(delta) < 4) return;
            start.horizontal = true;
          }
          // Pulling right decreases the cut while backs roll inside a fixed center.
          const next = clamp(start.value - delta / DRAG_STEP);
          setPreview(next);
          onChange(Math.round(next));
        }}
        onPointerUp={(event) => {
          if (gesture.current?.id !== event.pointerId) return;
          gesture.current = null;
          setPreview(null);
          if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
          }
        }}
        onLostPointerCapture={() => {
          gesture.current = null;
          setPreview(null);
        }}
        onPointerCancel={() => {
          gesture.current = null;
          setPreview(null);
        }}
        onKeyDown={(event) => {
          if (disabled) return;
          let next = value;
          if (event.key === "ArrowLeft" || event.key === "ArrowDown") next -= 1;
          else if (event.key === "ArrowRight" || event.key === "ArrowUp") next += 1;
          else if (event.key === "PageDown") next -= 10;
          else if (event.key === "PageUp") next += 10;
          else if (event.key === "Home") next = 1;
          else if (event.key === "End") next = LAST_CUT;
          else return;
          event.preventDefault();
          onChange(clamp(next));
        }}
      >
        <div
          className="manual-cut-track pointer-events-none absolute inset-0"
          style={{ "--cut-center": `${-center}rem` } as CSSProperties}
          aria-hidden
        >
          {cards.map(({ index, offset, distance, scale, angle }) => {
            return (
              <div
                key={index}
                className="manual-cut-card absolute left-1/2 top-8 h-44 w-32"
                style={{
                  "--cut-x": `${offset * 1.125}rem`,
                  "--cut-y": `${distance * 5}px`,
                  "--cut-angle": `${angle}deg`,
                  "--cut-scale": scale,
                  opacity: Math.max(0, 1 - distance / 6),
                  zIndex: 20 - Math.round(distance * 2),
                } as CSSProperties}
              >
                <TarotCardBack className="h-full" />
              </div>
            );
          })}
        </div>
      </div>
      <p id="cut-deck-hint" className="text-xs leading-6 text-muted-foreground">
        右拖靠近牌顶 · 左拖靠近牌底
      </p>
    </div>
  );
}
