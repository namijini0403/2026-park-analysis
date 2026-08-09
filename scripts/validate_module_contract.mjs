import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import yaml from "js-yaml";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const MODULES_DIR = join(ROOT, "modules");
const REQUIRED = ["module", "resource_type", "location", "external_supply", "demand_unit", "policy_actions", "reference_date", "source", "layer"];
const LOCATION_KEYS = ["file", "lat_key", "lng_key", "name_key"];
const LAYER_KEYS = ["id", "button_label", "panel_label", "color"];
const POLICY_ACTION_ENUM = new Set([
  "internal_investment", "external_supply_new", "institution_link", "mobile_service",
  "access_route_improvement", "shared_hub", "maintain_monitor"
]);

let failures = 0;
const fail = (file, msg) => { failures += 1; console.error(`  FAIL [${file}] ${msg}`); };

const files = readdirSync(MODULES_DIR).filter((f) => f.endsWith(".yaml") || f.endsWith(".yml"));
if (!files.length) { console.error("modules/*.yaml 파일이 없습니다"); process.exit(1); }

const INDEX_HTML = readFileSync(join(ROOT, "index.html"), "utf8");
const registryMatch = INDEX_HTML.match(/const LAYER_REGISTRY = \[([\s\S]*?)\n    \];/);
const registryBlock = registryMatch ? registryMatch[1] : "";
if (!registryBlock) console.warn("경고: index.html에서 LAYER_REGISTRY 블록을 찾지 못해 parity 검사를 건너뜁니다");

for (const file of files) {
  console.log(`검사: modules/${file}`);
  // js-yaml@4의 load는 안전 로더(구 safeLoad)이며, CORE_SCHEMA로 명시해 임의 타입 생성을 차단
  const doc = yaml.load(readFileSync(join(MODULES_DIR, file), "utf8"), { schema: yaml.CORE_SCHEMA });
  for (const key of REQUIRED) {
    if (doc?.[key] === undefined || doc[key] === null) fail(file, `필수 필드 누락: ${key}`);
  }
  if (doc?.location && typeof doc.location === "object") {
    for (const k of LOCATION_KEYS) if (!doc.location[k]) fail(file, `location.${k} 누락`);
    if (doc.location.file && doc.location.file !== "추가 확인 필요") {
      if (!existsSync(join(ROOT, doc.location.file))) fail(file, `location.file 경로가 존재하지 않음: ${doc.location.file}`);
    }
  }
  if (doc?.layer && typeof doc.layer === "object") {
    for (const k of LAYER_KEYS) if (!doc.layer[k]) fail(file, `layer.${k} 누락`);
  }
  if (doc?.policy_actions !== undefined && !Array.isArray(doc.policy_actions)) {
    fail(file, "policy_actions가 배열이 아님");
  } else if (Array.isArray(doc?.policy_actions)) {
    for (const action of doc.policy_actions) {
      if (!POLICY_ACTION_ENUM.has(action)) fail(file, `policy_actions에 enum 밖 값: ${action}`);
    }
    if (!doc.policy_actions.length) fail(file, "policy_actions가 비어 있음");
  }
  if (doc?.external_supply !== undefined && !Array.isArray(doc.external_supply)) {
    fail(file, "external_supply가 배열이 아님");
  } else if (Array.isArray(doc?.external_supply)) {
    doc.external_supply.forEach((row, i) => {
      if (!row?.metric || !row?.source) fail(file, `external_supply[${i}]에 metric/source 누락`);
    });
  }
  if (doc?.source !== undefined && !Array.isArray(doc.source)) {
    fail(file, "source가 배열이 아님");
  } else if (Array.isArray(doc?.source)) {
    doc.source.forEach((row, i) => {
      if (!row?.name || !row?.provider) fail(file, `source[${i}]에 name/provider 누락`);
    });
  }
  if (registryBlock && doc?.layer?.id) {
    if (!registryBlock.includes(`id: "${doc.layer.id}"`)) {
      fail(file, `layer.id "${doc.layer.id}"가 LAYER_REGISTRY에 없습니다`);
    } else {
      if (doc.layer.button_label && !registryBlock.includes(doc.layer.button_label)) {
        fail(file, `layer.button_label이 LAYER_REGISTRY와 불일치: ${doc.layer.button_label}`);
      }
      if (doc.layer.panel_label && !registryBlock.includes(doc.layer.panel_label)) {
        fail(file, `layer.panel_label이 LAYER_REGISTRY와 불일치: ${doc.layer.panel_label}`);
      }
    }
  }
}

if (failures) { console.error(`\n계약 검증 실패: ${failures}건`); process.exit(1); }
console.log(`\n계약 검증 통과: ${files.length}개 모듈`);
