import { Camera, Coffee, Landmark, MapPin, Trees, Utensils, type LucideIcon } from "lucide-react";

const ICONS: Record<string, LucideIcon> = {
  utensils: Utensils,
  coffee: Coffee,
  trees: Trees,
  landmark: Landmark,
  camera: Camera,
};

/** categories.json 의 icon 이름을 아이콘으로 바꿉니다. 모르는 이름이면 핀 아이콘. */
export function CategoryIcon({ name, className }: { name?: string; className?: string }) {
  const Icon = (name && ICONS[name]) || MapPin;
  return <Icon className={className} aria-hidden="true" />;
}
