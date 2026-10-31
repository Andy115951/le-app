import React from "react";
import { View, Pressable } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { Text } from "./appearance";
import { styles as s } from "./theme";
export function LanScanner({
  onRead,
  onClose,
}: {
  onRead: (code: string) => void;
  onClose: () => void;
}) {
  const [permission, request] = useCameraPermissions();
  return (
    <View style={{ gap: 12 }}>
      {permission?.granted ? (
        <CameraView
          style={{ height: 280, borderRadius: 16, overflow: "hidden" }}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
          onBarcodeScanned={({ data }) => onRead(data)}
        />
      ) : (
        <>
          <Text style={s.text}>
            使用相机扫描桌面端的连接二维码；也可以直接粘贴连接码。
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => void request()}
            style={s.button}
          >
            <Text style={s.buttonText}>允许相机扫码</Text>
          </Pressable>
        </>
      )}
      <Pressable
        accessibilityRole="button"
        onPress={onClose}
        style={[s.button, s.secondary]}
      >
        <Text style={[s.buttonText, s.secondaryText]}>取消扫码</Text>
      </Pressable>
    </View>
  );
}
