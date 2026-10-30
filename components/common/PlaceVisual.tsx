import { CategoryIcon } from "@/components/common/CategoryIcon";
import type { Category, Place } from "@/lib/validation/schemas";

interface Props {
  place: Place;
  category?: Category;
  alt: string;
  variant: "thumb" | "hero";
  noImageLabel?: string;
}

/**
 * 장소 대표 이미지. 이미지 데이터가 없으면 카테고리 색을 입힌 플레이스홀더를 보여 줍니다.
 * (이미지·평점 등을 임의로 만들어 내지 않습니다.)
 */
export function PlaceVisual({ place, category, alt, variant, noImageLabel }: Props) {
  const color = category?.color ?? "#566260";
  const box = variant === "thumb" ? "size-[4.5rem] shrink-0 rounded-xl" : "h-48 w-full rounded-[var(--radius-card)] sm:h-56";
  if (place.imageUrl) {
    // 외부 이미지 도메인은 사전에 알 수 없으므로 일반 img 사용 (직접 촬영/허가된 이미지 권장)
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={place.imageUrl} alt={alt} loading="lazy" decoding="async" className={`${box} object-cover`} />;
  }
  return (
    <div
      role="img"
      aria-label={noImageLabel ?? alt}
      className={`${box} relative grid place-items-center overflow-hidden`}
      style={{ background: `color-mix(in srgb, ${color} 14%, white)`, color }}
    >
      <CategoryIcon name={category?.icon} className={variant === "thumb" ? "size-8" : "size-14 opacity-90"} />
      {variant === "hero" && (
        <>
          <span aria-hidden="true" className="absolute -right-8 -top-8 size-32 rounded-full opacity-10" style={{ background: color }} />
          <span aria-hidden="true" className="absolute -bottom-10 -left-6 size-28 rounded-full opacity-10" style={{ background: color }} />
        </>
      )}
    </div>
  );
}
