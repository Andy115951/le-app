import Link from "next/link";
export default function NotFound() {
  return <section className="empty card"><h2>没有找到这一页</h2><p>回到今天，继续记录生活。</p><Link className="button primary" href="/">回到今日</Link></section>;
}
