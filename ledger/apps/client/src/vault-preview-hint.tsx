import { useCallback, useEffect, useRef, useState } from "react";
import {
  loadVaultPreviewDiscovery,
  saveVaultPreviewDiscovered,
} from "./platform";

/** Device-local discovery only; never stores amounts or enters ledger backups. */
export function useVaultPreviewHint(active: boolean) {
  const [eligible, setEligible] = useState(false);
  const [visible, setVisible] = useState(false);
  const consumed = useRef(false);
  useEffect(() => {
    let mounted = true;
    void loadVaultPreviewDiscovery()
      .then((value) => {
        // Old "true" meant merely displayed, which could be missed. Only an
        // explicit acknowledgement now completes discovery.
        if (mounted && !consumed.current) setEligible(value !== "acknowledged");
      })
      .catch(() => {}); // Optional discovery stays quiet if preferences are unavailable.
    return () => {
      mounted = false;
    };
  }, []);
  useEffect(() => {
    if (!active) {
      setVisible(false);
      return;
    }
    if (!eligible || consumed.current) return;
    setVisible(true);
  }, [active, eligible]);
  const dismiss = useCallback(() => {
    consumed.current = true;
    setEligible(false);
    setVisible(false);
    void saveVaultPreviewDiscovered().catch(() => {});
  }, []);
  return { visible: active && visible, dismiss };
}
