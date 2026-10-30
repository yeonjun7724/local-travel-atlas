import { loadAtlasData, loadNationwideRoutes } from "@/lib/data/load";
import { remoteEnabled } from "@/lib/server/places-db";
import AtlasApp from "@/components/AtlasApp";

// 데이터는 빌드/서버 시작 시 읽고 검증합니다. 문제가 있으면 오류 메시지와 함께 중단됩니다.
// DATABASE_URL 이 있으면 전국 모드: 장소는 브라우저가 화면 범위만 /api/places 로 받아 오고,
// 페이지에는 추천 코스(양재역 일대 + 전주)의 방문지만 담아 첫 로딩을 가볍게 합니다.
export default function Page() {
  const data = loadAtlasData();
  const routingEnabled = Boolean(process.env.ORS_API_KEY);
  if (!remoteEnabled()) return <AtlasApp data={data} routingEnabled={routingEnabled} />;

  const nw = loadNationwideRoutes();
  const routes = [...nw.routes, ...data.routes];
  const stopIds = new Set(routes.flatMap((r) => r.placeIds));
  const places = [...nw.places, ...data.places].filter((p) => stopIds.has(p.id));
  const routePaths =
    data.routePaths || nw.routePaths
      ? { ...(nw.routePaths ?? data.routePaths)!, routes: { ...nw.routePaths?.routes, ...data.routePaths?.routes } }
      : null;
  return <AtlasApp data={{ ...data, places, routes, routePaths }} routingEnabled={routingEnabled} remote />;
}
