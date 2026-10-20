import { CategoryIcon } from "@/components/common/CategoryIcon";

/**
 * 마커 버튼 안에 그려지는 내용. 버튼(HTML 요소)은 MapView 가 MapLibre Marker 로 만들고,
 * 이 컴포넌트는 React Portal 로 그 안에 아이콘 또는 방문 순서 번호를 렌더링합니다.
 */
export function PlaceMarkerContent({ order, icon }: { order?: number; icon?: string }) {
  return (
    <span className="atlas-marker__inner" aria-hidden="true">
      {order ? order : <CategoryIcon name={icon} className="size-[1.125rem]" />}
    </span>
  );
}
