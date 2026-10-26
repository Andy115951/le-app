"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return <section className="empty card"><h2>这一页暂时没能打开</h2><p>已经保存的记录仍在云端，请重新试一次。</p><button className="button primary" onClick={reset}>重新打开</button></section>;
}
