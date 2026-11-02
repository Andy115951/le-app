import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
export default function Scanner({ onScan, onCancel }: { onScan: (text: string) => void; onCancel: () => void }) {
  const [permission, request] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  return <View style={{ gap: 20 }}>
    <Text style={{ fontSize: 22, color: '#284b3e' }}>扫描电脑上的配对二维码</Text>
    {permission?.granted ? <CameraView style={{ height: 330, borderRadius: 20 }} barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
      onBarcodeScanned={scanned ? undefined : ({ data }) => { setScanned(true); onScan(data); }} /> :
      <Pressable onPress={request} style={styles.button}><Text>允许使用相机</Text></Pressable>}
    <Pressable onPress={onCancel} style={styles.button}><Text>返回</Text></Pressable>
  </View>;
}
const styles = StyleSheet.create({ button: { padding: 18, backgroundColor: '#e8ede5', borderRadius: 12 } });
