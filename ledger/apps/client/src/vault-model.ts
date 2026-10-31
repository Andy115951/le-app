// Presentation only: integer cents in, bounded artwork out. No ledger writes.
const cabinets = [
  { name: "Ⅰ 轻巧柜", max: 9, cols: 3 },
  { name: "Ⅱ 加固柜", max: 30, cols: 5 },
  { name: "Ⅲ 金库", max: 48, cols: 6 },
] as const;

export function vaultPresentation(netMinor: number, visible: boolean) {
  // Return before deriving geometry or text: concealed output is constant.
  if (!visible) return null;
  const n = Math.max(0, netMinor);
  const tier = n >= 100_000_000 ? 2 : n >= 10_000_000 ? 1 : 0;
  const cabinet = cabinets[tier];
  const progress =
    tier === 0
      ? Math.min(1, Math.log10(1 + n / 10000) / Math.log10(1001))
      : tier === 1
        ? Math.min(1, (n - 10000000) / 90000000)
        : 1;
  const w =
    tier === 0 ? 170 + 54 * progress : tier === 1 ? 248 + 26 * progress : 326;
  const h =
    tier === 0 ? 120 + 65 * progress : tier === 1 ? 222 + 36 * progress : 326;
  const y = 270 - h * 0.9;
  const bars = Math.floor(n / 1000000);
  const coins = Math.floor((n % 1000000) / 100000);
  const grains = Math.floor((n % 100000) / 10000);
  const dust = n % 10000;
  const description = `${bars} 块金块 · ${coins} 枚金币 · ${grains} 颗金粒 · ${(dust / 100).toFixed(2)} 元金粉`;
  return {
    ...cabinet,
    tier,
    w,
    h,
    x: (330 - w) / 2,
    y,
    crop: Math.max(0, Math.floor(y + h * [0.13, 0.1, 0.06][tier] - 8)),
    bars,
    coins,
    grains,
    dust,
    shownBars: Math.min(bars, cabinet.max),
    description,
    note:
      netMinor < 0
        ? "净资产为负，暂不展示金子。"
        : n === 0
          ? "从第一笔积累开始。"
          : bars > cabinet.max
            ? `共 ${bars} 块金块，画面展示 ${cabinet.max} 块，其余收纳于内层。`
            : "",
  };
}
