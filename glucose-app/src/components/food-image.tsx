import Image from "next/image";
import { Utensils } from "lucide-react";
import type { FoodVisual } from "@/lib/food-visuals";

export function FoodImage({ visual, sizes = "(max-width: 680px) 44vw, (max-width: 1200px) 27vw, 230px" }: { visual: FoodVisual; sizes?: string }) {
  if (!visual.image) {
    return <span className="food-image-fallback"><Utensils size={26} /><span>{visual.label}</span></span>;
  }
  // The adjacent title or ingredient caption supplies the accessible name.
  return <Image className="food-image" src={visual.image} alt="" width={640} height={640} sizes={sizes} loading="lazy" />;
}
