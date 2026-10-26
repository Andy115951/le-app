import { useSyncExternalStore } from "react";

function subscribe(notify: () => void) {
  const viewport = window.visualViewport;
  viewport?.addEventListener("resize", notify);
  viewport?.addEventListener("scroll", notify);
  window.addEventListener("resize", notify);
  return () => {
    viewport?.removeEventListener("resize", notify);
    viewport?.removeEventListener("scroll", notify);
    window.removeEventListener("resize", notify);
  };
}
function inset() {
  const viewport = window.visualViewport;
  if (!viewport || viewport.scale !== 1) return 0;
  return Math.max(0, Math.round(window.innerHeight - viewport.height - viewport.offsetTop));
}
export function useKeyboardInset() { return useSyncExternalStore(subscribe, inset, () => 0); }
