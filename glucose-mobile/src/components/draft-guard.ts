import { useEffect } from "react";
import { Platform } from "react-native";
import { useNavigation, usePreventRemove } from "expo-router/react-navigation";
import { useConfirm } from "./confirmation";
export function useDraftGuard(dirty: boolean, saving: boolean) {
  const navigation = useNavigation();
  const ask = useConfirm();
  usePreventRemove(dirty || saving, ({ data }) => {
    if (saving) return;
    void ask({ title: "还有未保存的内容", message: "离开后，这次填写的内容会丢失。要放弃更改吗？", confirmText: "放弃更改", cancelText: "继续填写" })
      .then(ok => { if (ok) navigation.dispatch(data.action); });
  });
  useEffect(() => {
    if (Platform.OS !== "web" || (!dirty && !saving)) return;
    const handler = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty, saving]);
}
