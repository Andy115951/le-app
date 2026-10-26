import { notFound } from "next/navigation";
import { FoodDetailScreen } from "@/components/screens";
import { FOODS } from "@/data/foods";
export function generateStaticParams() { return FOODS.map(food => ({ id: food.id })); }
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!FOODS.some(food => food.id === id)) notFound();
  return <FoodDetailScreen foodId={id} />;
}
