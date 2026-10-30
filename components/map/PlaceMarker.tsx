import { CategoryIcon } from "@/components/common/CategoryIcon";

/**
 * 지도 핀(버튼) 안의 내용. 버튼 요소는 MapView 가 MapLibre Marker 로 만들고,
 * 이 컴포넌트는 React Portal 로 아이콘(또는 방문 순서 번호)과 장소 이름을 렌더링합니다.
 * 이름 라벨은 확대했을 때·선택했을 때·코스일 때만 CSS 로 표시됩니다.
 */
export function PlaceMarkerContent({ order, icon, label }: { order?: number; icon?: string; label: string }) {
  return (
    <>
      <span className="atlas-pin__icon" aria-hidden="true">
        {order ? order : <CategoryIcon name={icon} className="size-3.5" />}
      </span>
      <span className="atlas-pin__label" aria-hidden="true">
        {label}
      </span>
    </>
  );
}
