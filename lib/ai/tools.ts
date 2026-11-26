/**
 * ChatGPT 지도 도우미가 호출할 수 있는 도구(OpenAI function calling).
 * 도구는 서버에서만 정의하고(클라이언트가 임의 도구를 끼워 넣지 못하게), 실행은 브라우저가 화면 상태를 바꾸는 방식입니다.
 */
export const AI_TOOL_NAMES = [
  "get_state",
  "search_places",
  "reset_filters",
  "select_place",
  "close_place",
  "fly_to",
  "zoom",
  "show_tab",
  "open_route",
  "my_route",
  "favorites",
  "set_sort",
  "set_language",
] as const;
export type AiToolName = (typeof AI_TOOL_NAMES)[number];

const fn = (name: AiToolName, description: string, properties: Record<string, unknown> = {}, required: string[] = []) => ({
  type: "function" as const,
  function: { name, description, parameters: { type: "object", properties, required, additionalProperties: false } },
});

export const AI_TOOLS = [
  fn("get_state", "현재 화면 상태(지도 위치, 필터, 목록 상위 장소, 선택 장소, 코스)를 다시 읽습니다."),
  fn(
    "search_places",
    "장소 탐색 탭에서 검색어·카테고리·세부 업종 필터를 설정합니다(지정하지 않은 값은 해제). 결과 목록과 지도가 갱신됩니다. 전국 모드에서는 검색어가 있으면 일치하는 장소들의 범위로 지도가 이동합니다.",
    {
      query: { type: "string", description: "장소명·태그 검색어. 빈 문자열이면 검색어 없음" },
      category: { type: ["string", "null"], description: "카테고리 id (상태의 categories 참고). null 이면 전체" },
      subtype: { type: ["string", "null"], description: "세부 업종 이름 (상태의 subtypes 참고). category 와 함께 사용" },
    },
  ),
  fn("reset_filters", "검색어·카테고리·세부 업종·찜 필터를 모두 해제합니다."),
  fn("select_place", "장소 상세를 열고 지도를 그 장소로 이동합니다.", { placeId: { type: "string" } }, ["placeId"]),
  fn("close_place", "열려 있는 장소 상세를 닫습니다."),
  fn(
    "fly_to",
    "지도를 특정 좌표로 이동합니다. 동네/역 이름으로 이동하려면 아는 좌표(WGS84)를 사용하세요. 전국 모드에서는 이동한 화면의 장소가 목록에 나타납니다.",
    {
      lng: { type: "number", description: "경도" },
      lat: { type: "number", description: "위도" },
      zoom: { type: "number", description: "줌 레벨 5~19 (동네 15~16, 골목 17)" },
    },
    ["lng", "lat"],
  ),
  fn("zoom", "지도를 한 단계 확대/축소합니다.", { direction: { type: "string", enum: ["in", "out"] } }, ["direction"]),
  fn("show_tab", "탭을 바꿉니다: places(장소 탐색) 또는 routes(추천 코스 목록).", { tab: { type: "string", enum: ["places", "routes"] } }, ["tab"]),
  fn("open_route", "추천 코스를 엽니다(지도에 방문 순서와 경로 표시).", { routeId: { type: "string" } }, ["routeId"]),
  fn(
    "my_route",
    "'내 코스'(사용자가 직접 만드는 방문 순서, 최대 25곳)를 조작합니다. add/remove 는 placeIds 필요. open 은 내 코스 화면을 엽니다. optimize 는 가까운 순으로 순서를 정리합니다.",
    {
      action: { type: "string", enum: ["add", "remove", "clear", "optimize", "open"] },
      placeIds: { type: "array", items: { type: "string" } },
    },
    ["action"],
  ),
  fn(
    "favorites",
    "찜 목록을 조작합니다. add/remove 는 placeId 필요. show 는 찜한 장소만 보기, hide 는 찜 필터 해제.",
    { action: { type: "string", enum: ["add", "remove", "show", "hide"] }, placeId: { type: "string" } },
    ["action"],
  ),
  fn("set_sort", "목록 정렬을 바꿉니다.", { key: { type: "string", enum: ["distance", "name", "recommended"] } }, ["key"]),
  fn("set_language", "화면 언어를 바꿉니다.", { lang: { type: "string", enum: ["ko", "en"] } }, ["lang"]),
];

export const AI_SYSTEM_PROMPT = `당신은 여행 지도 웹서비스 LOCAL ATLAS 의 오른쪽 패널에 있는 지도 도우미입니다.
사용자의 요청을 도구 호출로 실제 화면(지도·목록·코스)에 반영하고, 결과를 짧게 알려 주세요.

규칙:
- 장소 id·코스 id 는 반드시 상태(state)나 도구 결과에 나온 값만 사용하세요. 지어내지 마세요.
- 특정 장소를 언급하려면 먼저 search_places 등으로 찾아 id 를 확인한 뒤 select_place 하세요.
- 도구 결과에는 실행 후의 화면 상태가 담겨 있습니다. 그 내용을 근거로 답하세요(목록에 없는 영업시간·평점 등은 추측하지 마세요).
- "전국 모드"에서는 지도 화면 범위의 장소만 목록에 나옵니다. 다른 동네를 원하면 fly_to 로 먼저 이동하세요.
- "동네 모드"는 설정된 한 지역의 데이터만 있습니다. 그 밖의 지역은 데이터가 없다고 알려 주세요.
- 답변은 사용자의 언어로, 2~4문장 이내로 간결하게. 장소를 나열할 때는 이름만 짧게.`;
