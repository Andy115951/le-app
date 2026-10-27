import { NewReadingForm } from "./new-reading-form";

export default async function NewReadingPage({
  searchParams,
}: {
  searchParams: Promise<{ scene?: string }>;
}) {
  const sp = await searchParams;
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">新占卜</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          选好场景，把问题轻轻放下；洗牌、切牌后亲手选牌，选满再揭晓。
        </p>
      </div>
      <NewReadingForm initialSceneId={sp.scene} />
    </div>
  );
}
