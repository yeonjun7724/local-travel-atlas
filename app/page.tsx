import { loadAtlasData } from "@/lib/data/load";
import { remoteEnabled } from "@/lib/server/places-db";
import AtlasApp from "@/components/AtlasApp";

// 데이터는 빌드/서버 시작 시 읽고 검증합니다. 문제가 있으면 오류 메시지와 함께 중단됩니다.
// DATABASE_URL 이 있으면 전국 모드: 장소는 브라우저가 화면 범위만 /api/places 로 받아 오고,
// 페이지에는 추천 코스 방문지만 담아 첫 로딩을 가볍게 합니다.
export default function Page() {
  const data = loadAtlasData();
  const routingEnabled = Boolean(process.env.ORS_API_KEY);
  const remote = remoteEnabled();
  if (!remote) return <AtlasApp data={data} routingEnabled={routingEnabled} />;
  const routeIds = new Set(data.routes.flatMap((r) => r.placeIds));
  return <AtlasApp data={{ ...data, places: data.places.filter((p) => routeIds.has(p.id)) }} routingEnabled={routingEnabled} remote />;
}
