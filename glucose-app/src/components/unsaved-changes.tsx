"use client";

import NextLink from "next/link";
import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ComponentProps, type ReactNode } from "react";

type DraftGuard = { dirty: boolean; saving: boolean; discard: () => void };
const GuardContext = createContext({
  register: (_guard: DraftGuard | null) => {},
  leave: (action: () => void) => { action(); },
});
export const useUnsavedChanges = () => useContext(GuardContext);

export function UnsavedChangesProvider({ children }: { children: ReactNode }) {
  const current = useRef<DraftGuard | null>(null);
  const [pending, setPending] = useState<(() => void) | null>(null);
  const confirmation = useRef<HTMLDialogElement>(null);
  const register = useCallback((guard: DraftGuard | null) => { current.current = guard; }, []);
  const leave = useCallback((action: () => void) => {
    if (current.current?.saving) return;
    if (current.current?.dirty) setPending(() => action);
    else { current.current?.discard(); action(); }
  }, []);
  useEffect(() => {
    function beforeUnload(event: BeforeUnloadEvent) {
      if (!current.current?.dirty && !current.current?.saving) return;
      event.preventDefault(); event.returnValue = "";
    }
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, []);
  useEffect(() => { if (pending) confirmation.current?.showModal(); }, [pending]);
  function discard() {
    const action = pending;
    // Clear the guard before unmount/navigation so this departure asks only once.
    const draft = current.current; current.current = null;
    setPending(null); draft?.discard(); action?.();
  }
  return <GuardContext.Provider value={{ register, leave }}>{children}{pending &&
    <dialog ref={confirmation} className="discard-dialog" aria-labelledby="discard-title" aria-describedby="discard-description" onCancel={event => { event.preventDefault(); setPending(null); }}>
      <h2 id="discard-title">还有未保存的内容</h2>
      <p id="discard-description">离开后，这次填写的内容会丢失。要继续填写吗？</p>
      <div className="button-row"><button type="button" className="button secondary" onClick={discard}>放弃更改</button><button autoFocus type="button" className="button primary" onClick={() => setPending(null)}>继续填写</button></div>
    </dialog>}
  </GuardContext.Provider>;
}

/** Next's onNavigate covers normal in-app links, retaining new-tab/download semantics. */
export function GuardedLink(props: Omit<ComponentProps<typeof NextLink>, "href" | "onNavigate"> & { href: string }) {
  const { leave } = useUnsavedChanges();
  const router = useRouter();
  return <NextLink {...props} onNavigate={event => {
    event.preventDefault();
    leave(() => {
      const href = props.href;
      if (props.replace) router.replace(href, { scroll: props.scroll });
      else router.push(href, { scroll: props.scroll });
    });
  }} />;
}
