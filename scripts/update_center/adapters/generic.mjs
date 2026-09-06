// scripts/update_center/adapters/generic.mjs
//
// 데이터셋 전용 어댑터가 없을 때 쓰는 통과(passthrough) 어댑터.
//
// - JSON 레코드 배열이 들어오면 컬럼 합집합을 헤더로 하는 CSV로 평탄화한다
//   (중첩 객체/배열은 JSON 문자열로 보존 — 값을 만들어내거나 버리지 않는다).
// - 원본이 이미 CSV 텍스트면 그대로 통과시킨다.
//
// 통과 어댑터의 산출물은 requiredColumns 를 선언하지 않으므로, 품질검사가
// 알려진 계약(시설/지정학교/GeoJSON/컨텍스트)을 감지하지 못하면 "unsupported"
// (검토 전용 · 승인 불가)로 남는다 — 정규화가 없다는 사실이 승인 게이트에서
// 숨겨지지 않게 하려는 의도적 설계다.

export const dataset = "*";

export const outputName = null; // 소스의 local_file 이름을 그대로 쓴다

export const columns = null;

export const requiredColumns = [];

export const primaryKey = [];

function csvField(value) {
  const s = value === null || value === undefined ? "" : String(value);
  return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

function flattenValue(value) {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value);
}

/**
 * @param {object[]|string} raw
 * @returns {{text: string, rows: object[], skipped: number, note: string}}
 */
export function normalize(raw) {
  if (typeof raw === "string") {
    return {
      text: raw,
      rows: [],
      skipped: 0,
      note: "통과 어댑터 — 원본 텍스트를 변형 없이 후보로 사용했습니다(정규화 없음).",
    };
  }
  const records = Array.isArray(raw) ? raw.filter((r) => r && typeof r === "object") : [];
  const skipped = (Array.isArray(raw) ? raw.length : 0) - records.length;
  const columnSet = [];
  const seen = new Set();
  for (const rec of records) {
    for (const key of Object.keys(rec)) {
      if (!seen.has(key)) {
        seen.add(key);
        columnSet.push(key);
      }
    }
  }
  const header = columnSet.join(",");
  const body = records.map((r) => columnSet.map((c) => csvField(flattenValue(r[c]))).join(","));
  return {
    text: [header, ...body].join("\r\n") + "\r\n",
    rows: records,
    skipped,
    note:
      `통과 어댑터 — ${records.length}건을 컬럼 합집합(${columnSet.length}열) CSV로 평탄화했습니다. ` +
      "데이터셋 전용 정규화 규칙이 없으므로 품질검사가 알려진 계약을 감지하지 못하면 승인이 차단됩니다.",
  };
}
