// scripts/update_center/adapters/libraries.mjs
//
// 전국도서관표준데이터(data.go.kr pk=15013109) → data_processed/libraries.csv 정규화 어댑터.
//
// 입력: standard.json 의 모든 페이지를 이어붙인 원시 레코드 배열 (필드명은 포털 표준
// 컬럼명 그대로, 예: "도서관명", "도서관유형", "위도", "경도", "소재지도로명주소").
// 출력: libraries.csv 와 동일한 헤더/열 순서의 CSV 텍스트.
//
// 정규화 규칙 (scripts/reading_module/build_library_layer.py 의 매핑과 동일 계열):
//   - 인천광역시 소재 레코드만 남긴다 (주소 접두 또는 시도명 필드).
//   - 도서관유형 코드를 앱이 쓰는 유형 값으로 매핑한다(공공/어린이/작은/대학/전문/기타).
//   - 구(자치구)는 주소에서 "OO구/OO군"을 추출한다.
//   - 위/경도가 비어 있거나 숫자가 아니면 그 행은 좌표 결측으로 두되 삭제하지 않는다
//     (커버리지 공백을 조용히 지우지 않는다 — 품질검사의 좌표 규칙이 판정한다).
//
// 이 어댑터는 값을 만들어내지 않는다. 원본에 없는 값은 빈 문자열로 남기고, 기준일만
// 스캔 시각(YYYY-MM-DD)으로 채운다.

export const dataset = "libraries";

export const outputName = "libraries.csv";

export const columns = [
  "도서관명",
  "유형",
  "구",
  "위도",
  "경도",
  "장서수",
  "열람좌석수",
  "평일운영",
  "휴관일",
  "기준일",
  "좌표출처",
];

export const requiredColumns = columns;

export const primaryKey = ["도서관명", "구"];

const TYPE_MAP = new Map([
  ["공공도서관", "공공"],
  ["어린이도서관", "어린이"],
  ["작은도서관", "작은"],
  ["대학도서관", "대학"],
  ["전문도서관", "전문"],
  ["병영도서관", "기타"],
  ["학교도서관", "기타"],
  ["교도소도서관", "기타"],
  ["장애인도서관", "기타"],
]);

function pick(record, ...names) {
  for (const name of names) {
    const value = record[name];
    if (value !== undefined && value !== null && String(value).trim() !== "") return String(value).trim();
  }
  return "";
}

function normaliseType(raw) {
  const value = String(raw || "").trim();
  if (!value) return "기타";
  if (TYPE_MAP.has(value)) return TYPE_MAP.get(value);
  for (const [key, mapped] of TYPE_MAP) {
    if (value.includes(key.replace("도서관", ""))) return mapped;
  }
  return "기타";
}

function extractGu(address) {
  const m = String(address || "").match(/([가-힣]+(?:구|군))/);
  return m ? m[1] : "";
}

function isIncheon(record) {
  const address = pick(record, "소재지도로명주소", "소재지지번주소", "주소");
  const sido = pick(record, "시도명", "시도");
  return address.startsWith("인천") || sido.startsWith("인천");
}

function numericOrEmpty(value) {
  const s = String(value ?? "").trim();
  if (!s) return "";
  const n = Number(s.replace(/,/g, ""));
  return Number.isFinite(n) ? String(n) : "";
}

function csvField(value) {
  const s = value === null || value === undefined ? "" : String(value);
  return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

/**
 * @param {object[]} rawRecords  모든 페이지를 이어붙인 원시 레코드
 * @param {{referenceDate?: string}} [options]
 * @returns {{text: string, rows: object[], skipped: number, note: string}}
 */
export function normalize(rawRecords, options = {}) {
  const referenceDate = options.referenceDate || new Date().toISOString().slice(0, 10);
  const rows = [];
  let skipped = 0;
  for (const raw of rawRecords) {
    if (!raw || typeof raw !== "object") {
      skipped += 1;
      continue;
    }
    if (!isIncheon(raw)) {
      skipped += 1;
      continue;
    }
    const address = pick(raw, "소재지도로명주소", "소재지지번주소", "주소");
    const name = pick(raw, "도서관명", "시설명");
    if (!name) {
      skipped += 1;
      continue;
    }
    rows.push({
      도서관명: name,
      유형: normaliseType(pick(raw, "도서관유형", "유형")),
      구: extractGu(address),
      위도: numericOrEmpty(pick(raw, "위도", "latitude")),
      경도: numericOrEmpty(pick(raw, "경도", "longitude")),
      장서수: numericOrEmpty(pick(raw, "자료수(도서)", "장서수", "도서자료수")),
      열람좌석수: numericOrEmpty(pick(raw, "열람좌석수", "좌석수")),
      평일운영: pick(raw, "평일운영시작시각", "평일운영") && pick(raw, "평일운영종료시각")
        ? `${pick(raw, "평일운영시작시각", "평일운영")}~${pick(raw, "평일운영종료시각")}`
        : pick(raw, "평일운영"),
      휴관일: pick(raw, "휴관일", "정기휴관일"),
      기준일: pick(raw, "데이터기준일자", "기준일") || referenceDate,
      좌표출처: "원본",
    });
  }
  const header = columns.join(",");
  const body = rows.map((r) => columns.map((c) => csvField(r[c])).join(","));
  return {
    text: [header, ...body].join("\r\n") + "\r\n",
    rows,
    skipped,
    note:
      `인천 소재 ${rows.length}건 정규화, 비대상/불완전 ${skipped}건 제외. ` +
      "좌표 결측 행은 삭제하지 않고 빈 값으로 보존한다(커버리지 공백을 0건으로 위장하지 않음).",
  };
}
