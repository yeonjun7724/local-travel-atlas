import { loadAtlasData } from "@/lib/data/load";
import AtlasApp from "@/components/AtlasApp";

// 데이터는 빌드/서버 시작 시 읽고 검증합니다. 문제가 있으면 오류 메시지와 함께 중단됩니다.
export default function Page() {
  const data = loadAtlasData();
  const routingEnabled = Boolean(process.env.ORS_API_KEY);
  return <AtlasApp data={data} routingEnabled={routingEnabled} />;
}
