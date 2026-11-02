import React from 'react';
import { Text, Pressable } from 'react-native';
// Metro selects Scanner.native.tsx on Android; desktop does not request a camera.
export default function Scanner(_props: { onScan: (text: string) => void; onCancel: () => void }) {
  return <Pressable onPress={_props.onCancel}><Text>请用安卓端扫描电脑二维码，或手动粘贴配对信息。点击返回。</Text></Pressable>;
}
