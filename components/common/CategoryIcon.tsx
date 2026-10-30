import {
  Beef,
  Beer,
  Camera,
  Coffee,
  CookingPot,
  Croissant,
  Drumstick,
  Fish,
  IceCreamCone,
  Landmark,
  MapPin,
  Pizza,
  Salad,
  Sandwich,
  Soup,
  Trees,
  Utensils,
  UtensilsCrossed,
  type LucideIcon,
} from "lucide-react";

const ICONS: Record<string, LucideIcon> = {
  utensils: Utensils,
  coffee: Coffee,
  trees: Trees,
  landmark: Landmark,
  camera: Camera,
  // 세부 업종 그룹(lib/data/poi-style.ts)
  soup: Soup,
  beef: Beef,
  sandwich: Sandwich,
  drumstick: Drumstick,
  pizza: Pizza,
  "cooking-pot": CookingPot,
  "utensils-crossed": UtensilsCrossed,
  fish: Fish,
  salad: Salad,
  beer: Beer,
  croissant: Croissant,
  "ice-cream": IceCreamCone,
};

/** categories.json(또는 세부 업종 그룹)의 icon 이름을 아이콘으로 바꿉니다. 모르는 이름이면 핀 아이콘. */
export function CategoryIcon({ name, className }: { name?: string; className?: string }) {
  const Icon = (name && ICONS[name]) || MapPin;
  return <Icon className={className} aria-hidden="true" />;
}
