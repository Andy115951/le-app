import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import QRCode from 'react-native-qrcode-svg';
import { exchange, localDate, parseBundle, parsePairing, validDate, type Bundle, type Entry } from './src/core';
import { download, localApi, pickBackup, random, store } from './src/platform';
import { Session } from './src/session';
import Scanner from './src/Scanner';

type Tab = 'write' | 'history' | 'sync';
type Draft = { id?: string; parents: string[]; text: string; date: string; saved: string };
const fresh = (): Draft => ({ parents: [], text: '', date: localDate(), saved: '' });
const fingerprint = (d: Draft) => JSON.stringify([d.text, d.date]);
const Ink = '#264e40';
function Button({ title, onPress, secondary = false, disabled = false }: { title: string; onPress: () => void; secondary?: boolean; disabled?: boolean }) {
  return <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={({ pressed }) => [s.button, secondary && s.secondary, (disabled || pressed) && { opacity: 0.55 }]}>
    <Text style={[s.buttonText, secondary && { color: Ink }]}>{title}</Text>
  </Pressable>;
}
function Field(props: React.ComponentProps<typeof TextInput>) {
  return <TextInput placeholderTextColor="#92968c" {...props} style={[s.input, props.style]} />;
}
export default function App() { return <SafeAreaProvider><Diary /><StatusBar style="dark" /></SafeAreaProvider>; }

function Diary() {
  const wide = useWindowDimensions().width >= 880;
  const [loaded, setLoaded] = useState(false);
  const [vault, setVault] = useState<Bundle | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const sessionRef = useRef<Session | null>(null);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [tab, setTab] = useState<Tab>('write');
  const [draft, setDraft] = useState<Draft>(fresh);
  const draftRef = useRef(draft);
  const [list, setList] = useState<Entry[]>([]);
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [saveState, setSaveState] = useState('尚未输入');
  const [pairText, setPairText] = useState('');
  const [pairToken, setPairToken] = useState('');
  const [addresses, setAddresses] = useState<string[]>([]);
  const [address, setAddress] = useState('');
  const [expiry, setExpiry] = useState(0);
  const [scan, setScan] = useState(false);
  const [covered, setCovered] = useState(false);
  const [exportConfirm, setExportConfirm] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const jobs = useRef<Promise<unknown>>(Promise.resolve());
  const operations = useRef(0);
  const lockAfterOperation = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const refresh = (ss = sessionRef.current) => { if (ss) { setList(ss.entries); setVault(ss.bundle); } };
  const updateDraft = (next: Draft) => { draftRef.current = next; setDraft(next); };
  const run = async (job: () => Promise<void>) => {
    operations.current++;
    setBusy(true); setError(''); setNotice('');
    try { await job(); } catch (e) { setError(e instanceof Error ? e.message : '操作失败，请重试'); }
    finally {
      operations.current--; setBusy(operations.current > 0);
      if (lockAfterOperation.current && operations.current === 0) {
        lockAfterOperation.current = false;
        try { await lock(); } catch { setError('锁定前保存失败，请重试保存'); }
        finally { setCovered(false); }
      }
    }
  };
  useEffect(() => { store.load().then(setVault).catch(() => setError('本机存储不可用，请按 README 启动电脑服务。')).finally(() => setLoaded(true)); }, []);
  const flush = useCallback((): Promise<void> => {
    clearTimeout(timer.current);
    const next = jobs.current.catch(() => {}).then(async () => {
      const ss = sessionRef.current;
      const d = draftRef.current;
      if (!ss || !d.id && !d.text.trim() || fingerprint(d) === d.saved) return;
      if (!validDate(d.date)) throw new Error('日期需为有效的 YYYY-MM-DD，正文仍保留在编辑框中');
      setSaveState('正在加密保存…');
      const snapshot = { ...d };
      const r = await ss.save({ date: snapshot.date, text: snapshot.text, deleted: false, updatedAt: new Date().toISOString() }, snapshot.id, snapshot.parents);
      const current = draftRef.current;
      // UI navigation waits for this queue, so the editor still refers to this entry.
      updateDraft({ ...current, id: r.entryId, parents: [r.id], saved: fingerprint(snapshot) });
      refresh(ss); setSaveState('已加密保存到本机');
    });
    jobs.current = next;
    return next;
  }, []);
  const lock = useCallback(async () => {
    await flush();
    sessionRef.current?.lock(); sessionRef.current = null; setSession(null);
    updateDraft(fresh()); setList([]); setQuery(''); setPassword(''); setConfirm(''); setPairText(''); setPairToken(''); setScan(false); setExportConfirm(false); setDeleteConfirm(false); setNotice(''); setError('');
    if (Platform.OS === 'web') await localApi('/api/pair', 'DELETE').catch(() => {});
  }, [flush]);
  useEffect(() => {
    const sub = AppState.addEventListener('change', state => {
      if (state === 'background' && sessionRef.current && Platform.OS !== 'web') {
        setCovered(true);
        if (operations.current > 0) { lockAfterOperation.current = true; return; }
        lock().catch(() => setError('锁定前保存失败，请返回后重试保存')).finally(() => setCovered(false));
      }
    });
    return () => sub.remove();
  }, [lock]);
  useEffect(() => {
    if (Platform.OS !== 'web' || !session) return;
    let timeout: ReturnType<typeof setTimeout>;
    const arm = () => { clearTimeout(timeout); timeout = setTimeout(() => lock().catch(() => setError('锁定前保存失败，请先保存')), 5 * 60000); };
    const unload = (event: BeforeUnloadEvent) => {
      const d = draftRef.current;
      if ((d.id || d.text.trim()) && fingerprint(d) !== d.saved) { event.preventDefault(); event.returnValue = ''; }
    };
    arm(); document.addEventListener('pointerdown', arm); document.addEventListener('keydown', arm); window.addEventListener('beforeunload', unload);
    return () => { clearTimeout(timeout); document.removeEventListener('pointerdown', arm); document.removeEventListener('keydown', arm); window.removeEventListener('beforeunload', unload); };
  }, [session, lock]);
  const changed = (patch: Partial<Draft>) => {
    updateDraft({ ...draftRef.current, ...patch });
    setError(''); setSaveState('等待保存…'); clearTimeout(timer.current);
    timer.current = setTimeout(() => flush().catch(e => { setSaveState('保存失败'); setError(e.message); }), 900);
  };
  const authenticate = () => run(async () => {
    if (!vault && password !== confirm) throw new Error('两次口令不一致');
    const ss = vault ? await Session.open(vault, password, store, random) : await Session.create(password, store, random);
    if (Platform.OS !== 'web' && AppState.currentState === 'background') {
      setVault(ss.bundle); ss.lock(); setPassword(''); setConfirm(''); return;
    }
    sessionRef.current = ss; setSession(ss); setPassword(''); setConfirm(''); setTab('write'); refresh(ss); updateDraft(fresh()); setSaveState('尚未输入');
  });
  const changeTab = (next: Tab) => run(async () => { await flush(); await sessionRef.current?.refresh(); refresh(); setTab(next); setDeleteConfirm(false); });
  const importFile = () => run(async () => {
    await flush(); const text = await pickBackup(); if (!text) return;
    const incoming = parseBundle(text);
    if (sessionRef.current) { await sessionRef.current.import(incoming); refresh(); setNotice('导入完成，重复条目已自动去重。'); }
    else { setVault(incoming); setNotice('请输入这份备份的口令，验证成功后才会存入本机。'); }
  });
  const sync = (text = pairText) => run(async () => {
    await flush();
    const pairing = parsePairing(text);
    const ss = sessionRef.current;
    // First pull, authenticate locally, then upload. An unrelated vault is never pushed.
    const remote = await exchange(pairing, null, random);
    if (!ss) {
      if (!remote) throw new Error('电脑端还是空白，请先在一端创建日记本。');
      setVault(remote); setPairText(''); setScan(false); setNotice('已接收加密日记本，请输入原口令解锁。'); return;
    }
    if (remote) await ss.import(remote);
    const combined = await exchange(pairing, ss.bundle, random);
    if (combined) await ss.import(combined);
    refresh(ss); setPairText(''); setScan(false); setNotice('双方条目已交换并保存。手机保留完整副本。');
  });
  const openEntry = (entry: Entry, headIndex: number, resolve = false) => run(async () => {
    await flush(); const head = entry.heads[headIndex];
    const d: Draft = { id: entry.id, parents: resolve ? entry.heads.map(h => h.id) : [head.id], date: head.content.date, text: head.content.text, saved: '' };
    // A conflict resolution is explicitly saved, even if the chosen text stays the same.
    d.saved = resolve ? '' : fingerprint(d); updateDraft(d); setTab('write'); setSaveState(resolve ? '已选定此版本，点击保存完成合并' : '已加密保存到本机');
  });
  const activeEntries = list.filter(e => e.heads.some(h => !h.content.deleted));
  const conflicts = list.filter(e => e.heads.length > 1);
  const pairJson = pairToken && address ? JSON.stringify({ url: address, token: pairToken }) : '';
  const alert = <>{error ? <Text accessibilityRole="alert" style={s.error}>{error}</Text> : null}{notice ? <Text accessibilityLiveRegion="polite" style={s.notice}>{notice}</Text> : null}</>;
  if (!loaded) return <View style={s.loading}><ActivityIndicator color={Ink} /><Text style={s.muted}>打开本机日记本…</Text></View>;
  if (covered) return <View style={s.loading}><Text style={s.brand}>留一句</Text><Text style={s.muted}>正在保存并锁定</Text></View>;
  if (!session) return <SafeAreaView style={s.root}><ScrollView contentContainerStyle={s.gateWrap} keyboardShouldPersistTaps="handled"><View style={s.gate}>
    <Text style={s.eyebrow}>A LITTLE ROOM FOR YOUR DAY</Text><Text style={s.gateTitle}>留一句</Text>
    <Text style={s.subtitle}>一句也算日记。{ '\n' }今天，留一点给自己。</Text>
    <View style={s.line} />
    {scan ? <Scanner onScan={t => { setScan(false); setPairText(t); void sync(t); }} onCancel={() => setScan(false)} /> : <>
      <Text style={s.sectionTitle}>{vault ? '解锁你的日记本' : '从一本只属于你的日记开始'}</Text>
      <Text style={s.muted}>{vault ? '口令只在当前设备解密，不会发给电脑或服务器。' : '使用至少 12 个字符的独立长口令。请妥善记住，遗忘后无法找回。另一台设备请导入同一本日记。'}</Text>
      <Field accessibilityLabel="日记本口令" secureTextEntry autoCapitalize="none" autoCorrect={false} placeholder={vault ? '输入日记本口令' : '设置长口令（至少 12 个字符）'} value={password} onChangeText={setPassword} onSubmitEditing={authenticate} />
      {!vault && <Field accessibilityLabel="再次输入口令" secureTextEntry autoCapitalize="none" autoCorrect={false} placeholder="再输入一次" value={confirm} onChangeText={setConfirm} onSubmitEditing={authenticate} />}
      <Button title={busy ? '正在处理…' : vault ? '解锁日记本' : '创建日记本'} disabled={busy || !password} onPress={authenticate} />
      <Button secondary title="导入加密备份" onPress={importFile} disabled={busy} />
      {Platform.OS !== 'web' && <><Button secondary title="扫描电脑二维码，接收已有日记本" disabled={busy} onPress={() => setScan(true)} />
        <Field placeholder="也可以粘贴电脑配对信息" accessibilityLabel="配对信息" value={pairText} onChangeText={setPairText} multiline />
        {!!pairText && <Button title="从电脑接收" onPress={() => sync()} disabled={busy} />}</>}
    </>}
    {alert}<Text style={s.footer}>本地 SQLite · 正文加密 · 无云端账号</Text>
  </View></ScrollView></SafeAreaView>;

  return <SafeAreaView style={s.root}><KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
    <View style={[s.app, !wide && { flexDirection: 'column' }]}>
      <View style={[s.sidebar, !wide && s.mobileHeader]}>
        <View><Text style={s.brand}>留一句<Text style={s.brandDot}> ·</Text></Text><Text style={s.brandCaption}>你的日记收件箱</Text></View>
        <View style={[s.nav, !wide && s.mobileNav]}>{([['write', '随手记', '01'], ['history', '日记本', '02'], ['sync', '设备与备份', '03']] as const).map(([key, label, index]) =>
          <Pressable accessibilityRole="tab" accessibilityState={{ selected: tab === key }} key={key} disabled={busy} onPress={() => changeTab(key)} style={[s.navItem, tab === key && s.navActive, !wide && { flex: 1, padding: 12 }]}>
            {wide && <Text style={s.navNumber}>{index}</Text>}<Text style={[s.navText, tab === key && { color: Ink, fontWeight: '700' }]}>{label}</Text>
          </Pressable>)}</View>
        {wide && <View style={s.sideFoot}><Text style={s.muted}>不必写满一天。{ '\n' }记得的一瞬间就很好。</Text><Text style={s.localBadge}>● 只存于自己的设备</Text></View>}
        <Pressable accessibilityRole="button" disabled={busy} onPress={() => run(lock)} style={[{ paddingVertical: 10 }, !wide && { position: 'absolute', top: 24, right: 20 }]}><Text style={s.lockText}>锁定日记本 ↗</Text></Pressable>
      </View>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={[s.main, !wide && { padding: 22 }]} keyboardShouldPersistTaps="handled">
        {alert}
        {tab === 'write' && <>
          <View style={s.row}><Text style={s.eyebrow}>A MOMENT, KEPT.</Text><Text style={s.pill}>本机加密</Text></View>
          <Text style={s.pageTitle}>今天，有什么想留下？</Text><Text style={s.subtitle}>不用补昨天，也不用写很多。</Text>
          <View style={s.paper}>
            <View style={s.row}><Field accessibilityLabel="日记日期" value={draft.date} onChangeText={t => changed({ date: t })} style={s.dateInput} placeholder="YYYY-MM-DD" maxLength={10} editable={!busy} /><Text style={s.muted}>{draft.id ? '继续这一页' : '新的一页'}</Text></View>
            <View style={s.line} />
            <Field accessibilityLabel="日记正文" multiline textAlignVertical="top" value={draft.text} editable={!busy} onChangeText={text => changed({ text })} placeholder={'从一句话开始…\n\n今天的小事、此刻的心情，\n或者一个不想忘记的念头。'} style={s.editor} maxLength={50000} />
            <View style={s.row}><Text style={s.saveText}>{saveState}</Text><Text style={s.muted}>{draft.text.length} 字</Text></View>
          </View>
          <View style={s.actions}><Button title="保存这一刻" disabled={busy || !draft.text.trim()} onPress={() => run(flush)} />
            <Button title="另起一条" secondary disabled={busy} onPress={() => run(async () => { await flush(); updateDraft(fresh()); setSaveState('尚未输入'); })} />
            {draft.id && <Button title="删除这条" secondary disabled={busy} onPress={() => setDeleteConfirm(true)} />}</View>
          {deleteConfirm && <View style={s.warning}><Text style={s.body}>删除会同步到其他设备，历史版本仍保留在加密备份中。</Text><View style={s.actions}><Button title="确认删除" onPress={() => run(async () => {
            await flush(); const d = draftRef.current;
            await session.save({ date: d.date, text: '', deleted: true, updatedAt: new Date().toISOString() }, d.id, d.parents);
            refresh(); updateDraft(fresh()); setDeleteConfirm(false); setNotice('已标记删除，其他设备下次同步时生效。');
          })} disabled={busy} /><Button title="取消" secondary onPress={() => setDeleteConfirm(false)} /></View></View>}
          {!!conflicts.length && <Pressable onPress={() => changeTab('history')} style={s.warning}><Text style={s.body}>有 {conflicts.length} 条日记存在多个版本，去日记本选择或合并 →</Text></Pressable>}
          <Text style={s.footer}>输入停顿后自动保存。同步和备份在「设备与备份」中手动进行。</Text>
        </>}
        {tab === 'history' && <>
          <Text style={s.eyebrow}>THE DAYS YOU KEPT</Text><Text style={s.pageTitle}>日子，一页一页。</Text>
          <Text style={s.subtitle}>{activeEntries.length} 条记录 · {conflicts.length} 条待合并</Text>
          <Field accessibilityLabel="搜索日记" placeholder="搜一段文字，或一个日期" value={query} onChangeText={setQuery} />
          {list.filter(e => e.heads.some(h => (!h.content.deleted || e.heads.length > 1) && `${h.content.date} ${h.content.text}`.includes(query))).map(e => <View key={e.id} style={s.entry}>
            {e.heads.length > 1 && <Text style={s.conflict}>两端都修改过 · 所有版本已保留</Text>}
            {e.heads.map((h, i) => <View key={h.id} style={{ gap: 12, paddingVertical: 8 }}><View style={s.row}><Text style={s.entryDate}>{h.content.date}</Text><Text style={s.muted}>{e.heads.length > 1 ? `版本 ${i + 1}` : '本地保存'}</Text></View>
              <Text style={s.entryText} numberOfLines={4}>{h.content.deleted ? '此版本已删除' : h.content.text}</Text>
              <View style={s.actions}>{!h.content.deleted && <Button title={e.heads.length > 1 ? '以此版本为基础合并' : '打开这一页'} secondary disabled={busy} onPress={() => openEntry(e, i, e.heads.length > 1)} />}
              {h.content.deleted && e.heads.length > 1 && <Button title="确认保留删除结果" secondary disabled={busy} onPress={() => run(async () => {
                await session.save(h.content, e.id, e.heads.map(r => r.id)); refresh();
              })} />}</View>
            </View>)}
          </View>)}
          {!activeEntries.length && !conflicts.length && <View style={s.empty}><Text style={s.emptyGlyph}>—</Text><Text style={s.sectionTitle}>还没有留下的片刻</Text><Text style={s.muted}>去写一句吧。很短也没关系。</Text><Button title="写下第一句" secondary onPress={() => changeTab('write')} /></View>}
        </>}
        {tab === 'sync' && <>
          <Text style={s.eyebrow}>YOUR WORDS, YOUR DEVICES</Text><Text style={s.pageTitle}>只在你手中流转。</Text><Text style={s.subtitle}>电脑不用一直开着。连接时，再把这些日子带过去。</Text>
          <View style={s.card}><Text style={s.sectionTitle}>01 / 局域网同步</Text><Text style={s.body}>手机与电脑连同一个 Wi-Fi。配对有效期 5 分钟，每次手动同步会交换双方条目，不会删除手机副本。</Text>
            {Platform.OS === 'web' ? <>
              <Text style={s.muted}>电脑需以 npm run desktop:lan 启动，并允许防火墙的专用网络访问。</Text>
              <View style={s.actions}><Button title="生成临时配对码" disabled={busy} onPress={() => run(async () => {
                await flush(); const result = await localApi('/api/pair', 'POST'); setPairToken(result.token); setExpiry(result.expires); setAddresses(result.urls); setAddress(result.urls[0] ?? '');
              })} /><Button title="关闭配对" secondary disabled={busy} onPress={() => run(async () => { await localApi('/api/pair', 'DELETE'); setPairToken(''); })} />
              <Button title="刷新电脑收到的日记" secondary disabled={busy} onPress={() => run(async () => { await session.refresh(); refresh(); setNotice('已从本机 SQLite 重新载入。'); })} /></View>
              {!!pairToken && <><Text style={s.muted}>选择与手机同网段的电脑地址；到期后重新生成。</Text><View style={s.actions}>{addresses.map(a => <Button key={a} title={a} secondary={address !== a} onPress={() => setAddress(a)} />)}</View>
                <Field accessibilityLabel="电脑局域网地址" value={address} autoCapitalize="none" onChangeText={setAddress} />
                {!!pairJson && <View style={s.qr}><QRCode value={pairJson} size={200} color={Ink} backgroundColor="#ffffff" /></View>}
                <Text style={s.muted}>有效至 {new Date(expiry).toLocaleTimeString()} · 配对信息等同临时钥匙，请勿转发</Text>
                <Field accessibilityLabel="可复制的配对信息" value={pairJson} editable={false} multiline style={{ fontSize: 12 }} /></>}
            </> : <>{scan ? <Scanner onScan={t => { setScan(false); setPairText(t); void sync(t); }} onCancel={() => setScan(false)} /> : <Button title="扫描电脑二维码并同步" disabled={busy} onPress={() => setScan(true)} />}
              <Field accessibilityLabel="配对信息" placeholder="或粘贴电脑上的配对信息" multiline autoCapitalize="none" autoCorrect={false} value={pairText} onChangeText={setPairText} />
              <Button title="连接电脑并同步" secondary disabled={busy || !pairText} onPress={() => sync()} /></>}
          </View>
          <View style={s.card}><Text style={s.sectionTitle}>02 / 加密备份与文件同步</Text><Text style={s.body}>导出完整的加密日记本，保存在自己的存储中。导入会按条目合并，重复导入不产生副本。首次在另一台设备使用时，导入此备份并用相同口令解锁。</Text>
            <View style={s.actions}><Button title="导出加密备份" disabled={busy} onPress={() => run(async () => { await flush(); await session.refresh(); await download(JSON.stringify(session.bundle), `diary-${localDate()}.diary`, 'application/json'); setNotice('加密备份已交给文件保存窗口，请确认保存完成。'); })} />
              <Button title="导入并合并" secondary disabled={busy} onPress={importFile} /></View>
            <Text style={s.muted}>同步不能替代备份。请保留多份独立备份；本版本不提供口令重置。</Text>
          </View>
          <View style={s.card}><Text style={s.sectionTitle}>03 / 带回 eDiary</Text><Text style={s.body}>导出按日期分段的 Markdown，再在 eDiary 中手动导入。具体日期识别取决于 eDiary 版本，此处不提供自动导入或反向同步。</Text>
            {!exportConfirm ? <Button title="导出 Markdown…" secondary disabled={busy} onPress={() => setExportConfirm(true)} /> : <View style={s.warning}><Text style={s.body}>这份文件包含未加密的日记正文。仅保存到你信任的位置。</Text><View style={s.actions}>
              <Button title="确认导出明文" disabled={busy} onPress={() => run(async () => { await flush(); await session.refresh(); await download(session.markdown(), `diary-${localDate()}.md`, 'text/markdown'); setExportConfirm(false); })} />
              <Button title="取消" secondary onPress={() => setExportConfirm(false)} /></View></View>}
          </View>
          <Text style={s.footer}>日记正文、日期与删除标记均加密；记录数量、随机版本编号与关联关系可见。安卓切至后台会保存并锁定，电脑闲置 5 分钟后锁定。</Text>
        </>}
      </ScrollView>
    </View>
  </KeyboardAvoidingView></SafeAreaView>;
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f7f7f0' }, loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 20, backgroundColor: '#f7f7f0' },
  gateWrap: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 26 }, gate: { width: '100%', maxWidth: 480, gap: 18, paddingVertical: 30 },
  eyebrow: { color: '#7c8c76', fontSize: 10, fontWeight: '700', letterSpacing: 2.8 }, gateTitle: { color: Ink, fontSize: 54, fontWeight: '600', letterSpacing: 5 },
  subtitle: { color: '#858779', fontSize: 15, lineHeight: 27, marginBottom: 8 }, sectionTitle: { color: Ink, fontSize: 20, fontWeight: '600', lineHeight: 29 },
  muted: { color: '#8b8f81', fontSize: 12, lineHeight: 21 }, body: { color: '#65705f', fontSize: 14, lineHeight: 25 },
  input: { borderWidth: 1, borderColor: '#dcdfd3', backgroundColor: '#fffefa', borderRadius: 12, padding: 15, color: Ink, fontSize: 15, minHeight: 50 },
  button: { backgroundColor: Ink, borderRadius: 10, paddingHorizontal: 22, paddingVertical: 14, alignItems: 'center', justifyContent: 'center', minHeight: 48 },
  secondary: { backgroundColor: '#e9ede2' }, buttonText: { color: '#fffef6', fontSize: 13, fontWeight: '600' },
  line: { height: 1, backgroundColor: '#e3e4d8', marginVertical: 10 }, footer: { color: '#999b8c', fontSize: 11, lineHeight: 21, marginTop: 12 },
  app: { flex: 1, flexDirection: 'row' }, sidebar: { width: 236, padding: 30, backgroundColor: '#eeefe5', borderRightWidth: 1, borderColor: '#e1e4d7', gap: 24 },
  mobileHeader: { width: '100%', padding: 18, gap: 12, borderRightWidth: 0, borderBottomWidth: 1, flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  brand: { color: Ink, fontSize: 29, fontWeight: '600', letterSpacing: 3 }, brandDot: { color: '#af9c6c' }, brandCaption: { color: '#929780', fontSize: 11, marginTop: 8, letterSpacing: 2 },
  nav: { gap: 9, marginTop: 36 }, mobileNav: { flexDirection: 'row', width: '100%', marginTop: 0 },
  navItem: { flexDirection: 'row', alignItems: 'center', gap: 18, padding: 16, borderRadius: 10 }, navActive: { backgroundColor: '#dde5d6' },
  navNumber: { fontSize: 10, color: '#97a18b' }, navText: { color: '#7f8875', fontSize: 13 }, sideFoot: { flex: 1, justifyContent: 'flex-end', gap: 24 },
  localBadge: { color: '#789066', fontSize: 10 }, lockText: { color: '#849276', fontSize: 12 },
  main: { width: '100%', maxWidth: 940, alignSelf: 'center', padding: 52, gap: 18, paddingBottom: 70 },
  pageTitle: { color: Ink, fontSize: 30, fontWeight: '500', lineHeight: 44, letterSpacing: 0.4, marginTop: 9 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' },
  pill: { backgroundColor: '#e8edde', color: '#859672', fontSize: 10, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  paper: { backgroundColor: '#fffef9', borderWidth: 1, borderColor: '#e1e3d6', borderRadius: 18, padding: 24, minHeight: 360, gap: 8 },
  dateInput: { borderWidth: 0, backgroundColor: 'transparent', padding: 0, minHeight: 34, width: 155, fontSize: 15, letterSpacing: 1 },
  editor: { borderWidth: 0, backgroundColor: 'transparent', padding: 0, minHeight: 260, fontSize: 17, lineHeight: 32, flexGrow: 1 },
  saveText: { color: '#8a9b78', fontSize: 11 }, actions: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  error: { padding: 16, backgroundColor: '#f5e8df', color: '#9b4b35', borderRadius: 12, lineHeight: 23, fontSize: 13 },
  notice: { padding: 16, backgroundColor: '#e8efde', color: '#59734b', borderRadius: 12, lineHeight: 23, fontSize: 13 },
  warning: { padding: 18, backgroundColor: '#eee9d7', borderRadius: 12, gap: 14 },
  entry: { padding: 24, borderWidth: 1, borderColor: '#e0e3d4', borderRadius: 16, backgroundColor: '#fffef9', gap: 16 },
  entryDate: { fontSize: 16, color: Ink, letterSpacing: 1 }, entryText: { fontSize: 15, lineHeight: 27, color: '#6a725f' }, conflict: { color: '#9a7943', fontSize: 12 },
  empty: { alignItems: 'center', paddingVertical: 40, gap: 18 }, emptyGlyph: { color: '#bcc5aa', fontSize: 48 },
  card: { padding: 24, backgroundColor: '#fffef9', borderWidth: 1, borderColor: '#e1e3d6', borderRadius: 16, gap: 18 }, qr: { padding: 20, backgroundColor: '#fff', alignSelf: 'flex-start', borderRadius: 12 }
});
