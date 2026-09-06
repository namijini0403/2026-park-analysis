// scripts/update_center/onboarding.mjs
//
// 신규 데이터 레이어 온보딩 — "사람이 판단해야 하는 것만 객관식으로 묻고, 나머지는 자동".
//
//   POST /onboarding          -> 설계 초안 + 이 파일의 QUESTIONS 를 함께 반환
//   POST /onboarding/answer   -> 답변을 YAML 초안에 결정론적으로 병합 + 계약 재검사
//   POST /onboarding/register -> modules/<slug>.yaml 기록 + data_sources.yaml 항목 추가
//                                + LAYER_REGISTRY 스니펫 반환(index.html 은 자동 편집하지 않음)
//
// 병합은 전적으로 결정론적이다 — AI 없이도 같은 답변이면 항상 같은 YAML 이 나온다.
// AI 는 초안의 설명 문구를 채우는 데만 쓰이고, 여기서의 판정/병합에는 관여하지 않는다.

import fs from "node:fs";
import path from "node:path";
import yaml from "js-yaml";

import { modulesDir, sourcesPath, applyRoot, ensureDir, assertSafeRelPath } from "./paths.mjs";

export const SENTINEL = "추가 확인 필요";

/** 사람이 결정해야 하는 지점만 객관식으로. 각 항목에 default 가 있어 답변 누락 시에도 진행 가능. */
export const QUESTIONS = [
  {
    id: "source_location",
    text: "이 데이터의 원천은 어디에 있습니까?",
    options: [
      { value: "portal_url_known", label: "공공데이터포털 등 URL을 알고 있음", hint: "source_url 을 함께 입력하면 자동 감시 대상으로 등록됩니다." },
      { value: "local_file", label: "이미 정규화된 로컬 파일이 있음", hint: "data/context_sources/ 또는 data_processed/ 아래 상대경로를 입력하세요." },
      { value: "unknown", label: "아직 모름 / 확인 필요", hint: "검색 키워드만 등록하고 자동 폴링은 하지 않습니다(manual)." },
    ],
    default: "unknown",
    required: true,
  },
  {
    id: "join_key",
    text: "학교와 어떤 키로 결합합니까?",
    options: [
      { value: "school_id", label: "학교ID (권장)", hint: "가장 안전한 결합. schools.csv 의 학교ID 와 1:1." },
      { value: "school_name_exact", label: "학교명 완전일치", hint: "동명 학교/분교 처리 규칙을 별도로 확인해야 합니다." },
      { value: "coordinate", label: "좌표(위도·경도)", hint: "등시권 포함 여부로 결합. 좌표 결측 행의 커버리지 표기가 필요합니다." },
      { value: "address_geocode", label: "주소 → 지오코딩", hint: "지오코딩 실패분을 0건으로 위장하지 않도록 결측 상태를 반드시 남겨야 합니다." },
    ],
    default: "school_id",
    required: true,
  },
  {
    id: "geometry",
    text: "이 레이어의 도형 형태는 무엇입니까?",
    options: [
      { value: "point", label: "점(시설 위치)", hint: "위도/경도 컬럼이 필요합니다." },
      { value: "polygon", label: "면(구역/경계)", hint: "GeoJSON Polygon/MultiPolygon 으로 보관합니다." },
      { value: "tabular", label: "도형 없음(표 데이터)", hint: "지도에 그리지 않고 패널 지표로만 씁니다." },
    ],
    default: "point",
    required: true,
  },
  {
    id: "usage",
    text: "이 데이터를 어떻게 씁니까?",
    options: [
      { value: "reference_only", label: "참고 맥락만 (지도/패널 표시)", hint: "격차 점수·우선순위에 반영하지 않습니다." },
      { value: "gap_metric", label: "격차 판정 지표로 사용", hint: "도보 네트워크 기준 도달성으로 계산 가능해야 합니다." },
    ],
    default: "reference_only",
    required: true,
  },
  {
    id: "refresh_cycle",
    text: "원천 데이터의 갱신 주기는?",
    options: [
      { value: "annual", label: "연간" },
      { value: "quarterly", label: "분기" },
      { value: "adhoc", label: "수시" },
      { value: "unknown", label: "미상" },
    ],
    default: "unknown",
    required: true,
  },
  {
    id: "coverage",
    text: "수집 범위는 어디까지입니까?",
    options: [
      { value: "incheon_all", label: "인천 전체" },
      { value: "partial_gu", label: "일부 구만", hint: "미수집 구는 unknown 으로 표기하고 0건으로 표시하지 않습니다." },
      { value: "unknown", label: "미상" },
    ],
    default: "unknown",
    required: true,
  },
  {
    id: "sensitivity",
    text: "학교 낙인·서열화 위험이 있는 내용입니까?",
    options: [
      { value: "stigma_risk", label: "있음 — 참고 전용으로 강제", hint: "선택 시 usage 답변과 무관하게 참고 전용으로 고정됩니다." },
      { value: "no_risk", label: "없음" },
    ],
    default: "stigma_risk",
    required: true,
  },
];

const OPTION_VALUES = new Map(QUESTIONS.map((q) => [q.id, new Set(q.options.map((o) => o.value))]));

const CYCLE_LABEL = { annual: "연간", quarterly: "분기", adhoc: "수시", unknown: SENTINEL };
const COVERAGE_LABEL = { incheon_all: "인천 전체", partial_gu: "인천 일부 구", unknown: SENTINEL };
const JOIN_LABEL = {
  school_id: "학교ID 완전일치",
  school_name_exact: "학교명 완전일치",
  coordinate: "좌표(등시권 포함 판정)",
  address_geocode: "주소 지오코딩",
};

export const SLUG_RE = /^[a-z][a-z0-9_]{1,30}$/;

export function validateSlug(slug) {
  if (!SLUG_RE.test(String(slug || ""))) {
    throw new Error(`slug 형식이 올바르지 않습니다(영소문자로 시작, 영소문자/숫자/_ 2~31자): ${slug}`);
  }
  return String(slug);
}

/** 답변 정규화: enum 밖 값은 default 로 되돌리고, 되돌린 사실을 남긴다. */
export function normaliseAnswers(answers = {}) {
  const normalised = {};
  const corrections = [];
  for (const q of QUESTIONS) {
    const raw = answers[q.id];
    const allowed = OPTION_VALUES.get(q.id);
    if (typeof raw === "string" && allowed.has(raw)) normalised[q.id] = raw;
    else {
      normalised[q.id] = q.default;
      if (raw !== undefined && raw !== null && raw !== "") {
        corrections.push(`${q.id}: 허용되지 않은 값 "${raw}" → 기본값 "${q.default}" 로 처리`);
      }
    }
  }
  return { answers: normalised, corrections };
}

function sanitizeText(value, fallback) {
  const s = typeof value === "string" ? value.trim() : "";
  return s ? s : fallback;
}

function sanitizeColor(value) {
  const s = typeof value === "string" ? value.trim() : "";
  return /^#[0-9A-Fa-f]{6}$/.test(s) ? s : "#6B7280";
}

/**
 * 답변 + 자유입력을 YAML 초안 문서에 결정론적으로 병합한다.
 *
 * @param {object} baseDoc      최초 제안의 YAML 초안을 파싱한 객체 (없으면 {})
 * @param {object} rawAnswers   QUESTIONS 의 id → 선택 value + 선택적 자유입력
 * @returns {{doc:object, source_entry:object, notes:string[], corrections:string[], forced:string[], slug:string}}
 */
export function mergeAnswers(baseDoc, rawAnswers = {}) {
  const { answers, corrections } = normaliseAnswers(rawAnswers);
  const notes = [];
  const forced = [];

  const slug = validateSlug(sanitizeText(rawAnswers.slug, baseDoc?.layer?.id || baseDoc?.module || ""));
  const doc = JSON.parse(JSON.stringify(baseDoc && typeof baseDoc === "object" ? baseDoc : {}));

  // --- 민감도: 낙인 위험이 있으면 usage 답변을 무시하고 참고 전용으로 강제한다.
  let usage = answers.usage;
  if (answers.sensitivity === "stigma_risk" && usage !== "reference_only") {
    usage = "reference_only";
    forced.push("민감도 = 낙인 위험 있음 → usage 를 '참고 맥락만'으로 강제했습니다(학교 서열화 방지).");
  }

  doc.module = slug;
  doc.resource_type = sanitizeText(rawAnswers.resource_type, doc.resource_type || SENTINEL);

  // --- 위치/도형
  const localFileRaw = sanitizeText(rawAnswers.local_file, "");
  let locationFile = SENTINEL;
  if (answers.source_location === "local_file" && localFileRaw) {
    const rel = assertSafeRelPath(localFileRaw);
    if (!fs.existsSync(path.join(applyRoot(), rel))) {
      throw new Error(`local_file 경로가 존재하지 않습니다: ${rel}`);
    }
    locationFile = rel;
  }
  const nameKey = sanitizeText(rawAnswers.name_key, SENTINEL);
  doc.location = {
    file: locationFile,
    lat_key: answers.geometry === "point" ? sanitizeText(rawAnswers.lat_key, "위도") : SENTINEL,
    lng_key: answers.geometry === "point" ? sanitizeText(rawAnswers.lng_key, "경도") : SENTINEL,
    name_key: nameKey,
  };
  doc.geometry_kind = answers.geometry;
  doc.join_key = JOIN_LABEL[answers.join_key];

  // --- 공급 지표 / 수요 단위
  if (!Array.isArray(doc.external_supply) || !doc.external_supply.length) {
    doc.external_supply = [{ metric: SENTINEL, source: locationFile }];
  } else {
    doc.external_supply = doc.external_supply.map((row) => ({
      metric: row && row.metric ? row.metric : SENTINEL,
      source: row && row.source && row.source !== SENTINEL ? row.source : locationFile,
    }));
  }
  doc.demand_unit = sanitizeText(rawAnswers.demand_unit, doc.demand_unit || "예측 수혜 학생 수 (predicted_beneficiaries)");

  // --- 정책 행동 (7-action enum 안에서만)
  doc.policy_actions =
    usage === "gap_metric"
      ? ["external_supply_new", "access_route_improvement", "maintain_monitor"]
      : ["maintain_monitor"];

  // --- 제약 (원칙을 데이터에 박아 넣는다)
  const constraints = [];
  if (usage === "reference_only") {
    constraints.push("참고 맥락 전용 — 격차 점수·우선순위 산정에 반영 금지");
  } else {
    constraints.push("도달성 지표는 직선거리가 아닌 도보 네트워크(등시권) 기준으로만 산출");
  }
  if (answers.sensitivity === "stigma_risk") {
    constraints.push("학교 서열화·낙인 위험 — 학교 단위 순위/등급 표시 금지, 맥락 표시만 허용");
  }
  if (answers.coverage !== "incheon_all") {
    constraints.push("커버리지 공백은 unknown 으로 표기 — 미수집을 0건으로 표시 금지");
  }
  if (answers.join_key === "address_geocode") {
    constraints.push("지오코딩 실패분은 삭제하지 않고 결측 상태(coordinate_status)로 보존");
  }
  doc.constraints = constraints;

  doc.reference_date = sanitizeText(rawAnswers.reference_date, new Date().toISOString().slice(0, 10));
  doc.coverage = COVERAGE_LABEL[answers.coverage];
  doc.update_cycle = CYCLE_LABEL[answers.refresh_cycle];

  // 초안이 격차 유형별 정책 행동(gap_type_actions)을 제안했더라도, 위에서
  // policy_actions 를 답변 기준으로 다시 정했으므로 두 집합이 정확히 일치할 때만
  // 남긴다. 일치하지 않으면 지어내지 않고 지운다 — 매핑은 사람이 정할 판단이다.
  if (doc.gap_type_actions && typeof doc.gap_type_actions === "object" && !Array.isArray(doc.gap_type_actions)) {
    const mapped = new Set(Object.values(doc.gap_type_actions));
    const allowed = new Set(doc.policy_actions);
    const sameSet = mapped.size === allowed.size && [...mapped].every((v) => allowed.has(v));
    if (!sameSet) {
      delete doc.gap_type_actions;
      notes.push(
        "격차 유형별 정책 행동(gap_type_actions) 초안이 확정된 policy_actions 와 달라 제거했습니다 — " +
          "매핑은 사람이 직접 정의해야 합니다."
      );
    }
  }

  const sourceUrl = sanitizeText(rawAnswers.source_url, "");
  const draftSourceName = doc.source?.[0]?.name;
  const draftProvider = doc.source?.[0]?.provider;
  doc.source = [
    {
      name: sanitizeText(
        rawAnswers.source_name,
        draftSourceName && draftSourceName !== SENTINEL ? draftSourceName : doc.resource_type || SENTINEL
      ),
      provider: sanitizeText(rawAnswers.provider, draftProvider || SENTINEL),
      ...(sourceUrl ? { url: sourceUrl } : {}),
    },
  ];

  doc.layer = {
    id: slug,
    button_label: sanitizeText(rawAnswers.button_label, doc.layer?.button_label || doc.resource_type || slug),
    panel_label: sanitizeText(rawAnswers.panel_label, doc.layer?.panel_label || doc.resource_type || slug),
    color: sanitizeColor(rawAnswers.color || doc.layer?.color),
  };

  // --- data_sources.yaml 항목
  const keywords = Array.isArray(rawAnswers.search_keywords)
    ? rawAnswers.search_keywords.filter((k) => typeof k === "string" && k.trim()).slice(0, 5)
    : [];
  const entry = {
    dataset: slug,
    local_file: locationFile,
    portal_pk: sanitizeText(rawAnswers.portal_pk, null),
    provider: doc.source[0].provider,
    license: sanitizeText(rawAnswers.license, SENTINEL),
    update_cycle: CYCLE_LABEL[answers.refresh_cycle],
    coverage: COVERAGE_LABEL[answers.coverage],
    source_url: sourceUrl || SENTINEL,
    check:
      answers.source_location === "portal_url_known" && sourceUrl
        ? { type: "file_head", urls: { head: sourceUrl } }
        : { type: "manual" },
    search_keywords: keywords.length ? keywords : [doc.resource_type !== SENTINEL ? doc.resource_type : slug],
    // 신규 레이어의 안전 기본값 — 자동 반영은 사람이 확인 플래그를 줄 때만.
    never_auto_apply: true,
    notes:
      `온보딩(${new Date().toISOString().slice(0, 10)})으로 등록. 결합키=${JOIN_LABEL[answers.join_key]}, ` +
      `용도=${usage === "gap_metric" ? "격차 판정 지표" : "참고 맥락 전용"}, 범위=${COVERAGE_LABEL[answers.coverage]}.`,
  };
  if (entry.portal_pk === null) delete entry.portal_pk;

  notes.push(`결합키: ${JOIN_LABEL[answers.join_key]}`);
  notes.push(`용도: ${usage === "gap_metric" ? "격차 판정 지표" : "참고 맥락 전용"}`);
  notes.push(`갱신주기: ${CYCLE_LABEL[answers.refresh_cycle]} / 범위: ${COVERAGE_LABEL[answers.coverage]}`);
  if (answers.source_location === "local_file") notes.push(`로컬 파일: ${locationFile}`);
  if (locationFile === SENTINEL) {
    notes.push("원천 파일 경로 미확정 — location.file 은 '추가 확인 필요' 로 남습니다(계약상 허용 sentinel).");
  }

  return { doc, source_entry: entry, notes, corrections, forced, slug, answers, usage };
}

export function dumpYaml(doc) {
  return yaml.dump(doc, { schema: yaml.CORE_SCHEMA, lineWidth: -1, noRefs: true });
}

// ---------------------------------------------------------------------------
// registry snippet (index.html 은 절대 자동 편집하지 않는다 — 붙여넣기용 조각만 제공)
// ---------------------------------------------------------------------------

function toCamelSuffix(slug) {
  return slug
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
}

export function buildRegistrySnippet(doc, geometryKind) {
  const slug = doc.layer.id;
  const suffix = toCamelSuffix(slug);
  const kind = geometryKind === "polygon" ? "geojson" : geometryKind === "tabular" ? "external" : "point";
  const lines = [
    "      {",
    `        id: ${JSON.stringify(slug)}, buttonLabel: ${JSON.stringify(doc.layer.button_label)}, panelLabel: ${JSON.stringify(doc.layer.panel_label)},`,
    `        toggleId: ${JSON.stringify(`toggle${suffix}`)}, overlayKey: ${JSON.stringify(`${slug}Overlays`)},`,
    `        kind: ${JSON.stringify(kind)}, datasetKey: ${JSON.stringify(slug)}, defaultOn: false,`,
    `        cssColor: ${JSON.stringify(doc.layer.color)}${kind === "point" ? "," : ""}`,
  ];
  if (kind === "point") {
    lines.push(
      `        point: { latKey: ${JSON.stringify(doc.location.lat_key)}, lngKey: ${JSON.stringify(doc.location.lng_key)}, ` +
        `titleKey: ${JSON.stringify(doc.location.name_key)}, fallbackTitle: ${JSON.stringify(doc.layer.panel_label)}, color: ${JSON.stringify(doc.layer.color)} }`
    );
  }
  lines.push("      }");
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// register: modules/<slug>.yaml + data_sources.yaml 항목 추가
// ---------------------------------------------------------------------------

export function moduleFilePath(slug) {
  return path.join(modulesDir(), `${validateSlug(slug)}.yaml`);
}

export function registerModule({ doc, sourceEntry, overwrite = false }) {
  const slug = validateSlug(doc?.layer?.id || doc?.module);
  const target = moduleFilePath(slug);
  if (fs.existsSync(target) && !overwrite) {
    throw new Error(`이미 존재하는 모듈 파일입니다: modules/${slug}.yaml (덮어쓰려면 overwrite: true)`);
  }
  ensureDir(path.dirname(target));

  const header =
    `# ${slug} — 업데이트 센터 온보딩으로 생성 (${new Date().toISOString().slice(0, 10)})\n` +
    "# 이 파일은 POST /api/update-center/onboarding/register 가 기록했습니다.\n" +
    "# LAYER_REGISTRY(index.html)는 자동 편집되지 않습니다 — 반환된 스니펫을 사람이 붙여넣습니다.\n";
  fs.writeFileSync(target, header + dumpYaml(doc), "utf-8");

  let sourcesAppended = false;
  let sourcesPathUsed = null;
  if (sourceEntry) {
    sourcesPathUsed = sourcesPath();
    const raw = fs.existsSync(sourcesPathUsed) ? fs.readFileSync(sourcesPathUsed, "utf-8") : "version: 1\nsources: []\n";
    const parsed = yaml.load(raw) || {};
    const sources = Array.isArray(parsed.sources) ? parsed.sources : [];
    if (sources.some((s) => s && s.dataset === sourceEntry.dataset)) {
      throw new Error(`data_sources.yaml 에 이미 같은 dataset 항목이 있습니다: ${sourceEntry.dataset}`);
    }
    // 기존 파일의 주석/서식을 파괴하지 않도록 새 항목만 append 한다.
    const appended =
      `\n  # --- 온보딩 등록 (${new Date().toISOString().slice(0, 10)}) ---\n` +
      yaml
        .dump([sourceEntry], { schema: yaml.CORE_SCHEMA, lineWidth: -1, noRefs: true })
        .split("\n")
        .map((line) => (line ? `  ${line}` : line))
        .join("\n");
    fs.writeFileSync(sourcesPathUsed, raw.replace(/\s*$/, "\n") + appended.replace(/\s*$/, "\n"), "utf-8");
    sourcesAppended = true;
  }

  return {
    slug,
    module_file: path.relative(applyRoot(), target).split(path.sep).join("/"),
    data_sources_appended: sourcesAppended,
    data_sources_file: sourcesPathUsed ? path.relative(applyRoot(), sourcesPathUsed).split(path.sep).join("/") : null,
  };
}
