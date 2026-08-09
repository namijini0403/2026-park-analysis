import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import yaml from "js-yaml";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const MODULES_DIR = join(ROOT, "modules");
const REQUIRED = ["module", "resource_type", "location", "external_supply", "demand_unit", "policy_actions", "reference_date", "source", "layer"];
const LOCATION_KEYS = ["file", "lat_key", "lng_key", "name_key"];
const LAYER_KEYS = ["id", "button_label", "panel_label", "color"];
export const POLICY_ACTION_ENUM = new Set([
  "internal_investment", "external_supply_new", "institution_link", "mobile_service",
  "access_route_improvement", "shared_hub", "maintain_monitor"
]);

// checkModuleDoc(doc, { registryBlock } = {}) — pure per-document contract
// check, extracted so both this CLI's own loop and P5's onboarding API
// (scripts/update_center/... via api/update-center.js) can run the exact
// same rules against a parsed YAML doc, without duplicating the 7-action
// enum or required-field list anywhere else.
//
// registryBlock is the raw LAYER_REGISTRY array text sliced out of
// index.html by the CLI below. It is OPTIONAL: pass it to also check
// layer.id/button_label/panel_label parity against the live registry
// (what the CLI does for modules/*.yaml, which are all already registered).
// Omit it — as the onboarding API does — to skip that parity check, since a
// brand-new module proposal has no LAYER_REGISTRY entry yet and a
// placeholder layer.id is expected/fine at that stage.
//
// Returns { failures: string[], warnings: string[] } — never throws, never
// prints, never touches process.exit. Message text has no file-name prefix
// (the caller decides how to label/print each message).
export function checkModuleDoc(doc, { registryBlock } = {}) {
  const failures = [];
  const warnings = [];
  const fail = (msg) => failures.push(msg);

  for (const key of REQUIRED) {
    if (doc?.[key] === undefined || doc[key] === null) fail(`필수 필드 누락: ${key}`);
  }
  if (doc?.location && typeof doc.location === "object") {
    for (const k of LOCATION_KEYS) if (!doc.location[k]) fail(`location.${k} 누락`);
    if (doc.location.file && doc.location.file !== "추가 확인 필요") {
      if (!existsSync(join(ROOT, doc.location.file))) fail(`location.file 경로가 존재하지 않음: ${doc.location.file}`);
    }
  }
  if (doc?.layer && typeof doc.layer === "object") {
    for (const k of LAYER_KEYS) if (!doc.layer[k]) fail(`layer.${k} 누락`);
  }
  if (doc?.policy_actions !== undefined && !Array.isArray(doc.policy_actions)) {
    fail("policy_actions가 배열이 아님");
  } else if (Array.isArray(doc?.policy_actions)) {
    for (const action of doc.policy_actions) {
      if (!POLICY_ACTION_ENUM.has(action)) fail(`policy_actions에 enum 밖 값: ${action}`);
    }
    if (!doc.policy_actions.length) fail("policy_actions가 비어 있음");
  }
  if (doc?.external_supply !== undefined && !Array.isArray(doc.external_supply)) {
    fail("external_supply가 배열이 아님");
  } else if (Array.isArray(doc?.external_supply)) {
    doc.external_supply.forEach((row, i) => {
      if (!row?.metric || !row?.source) fail(`external_supply[${i}]에 metric/source 누락`);
    });
  }
  if (doc?.gap_type_actions !== undefined) {
    if (typeof doc.gap_type_actions !== "object" || Array.isArray(doc.gap_type_actions) || doc.gap_type_actions === null) {
      fail("gap_type_actions가 객체가 아님");
    } else {
      const values = Object.values(doc.gap_type_actions);
      for (const [gapType, action] of Object.entries(doc.gap_type_actions)) {
        if (!POLICY_ACTION_ENUM.has(action)) fail(`gap_type_actions.${gapType}에 enum 밖 값: ${action}`);
      }
      if (Array.isArray(doc.policy_actions)) {
        const actionSet = new Set(values);
        const policySet = new Set(doc.policy_actions);
        const missingFromActions = [...policySet].filter((a) => !actionSet.has(a));
        const extraInActions = [...actionSet].filter((a) => !policySet.has(a));
        if (missingFromActions.length || extraInActions.length) {
          fail(
            `gap_type_actions 값 집합이 policy_actions와 불일치 (policy_actions에만 있음: ${missingFromActions.join(", ") || "없음"}; gap_type_actions에만 있음: ${extraInActions.join(", ") || "없음"})`
          );
        }
      }
    }
  }
  if (doc?.source !== undefined && !Array.isArray(doc.source)) {
    fail("source가 배열이 아님");
  } else if (Array.isArray(doc?.source)) {
    doc.source.forEach((row, i) => {
      if (!row?.name || !row?.provider) fail(`source[${i}]에 name/provider 누락`);
    });
  }
  if (registryBlock && doc?.layer?.id) {
    if (!registryBlock.includes(`id: "${doc.layer.id}"`)) {
      fail(`layer.id "${doc.layer.id}"가 LAYER_REGISTRY에 없습니다`);
    } else {
      if (doc.layer.button_label && !registryBlock.includes(doc.layer.button_label)) {
        fail(`layer.button_label이 LAYER_REGISTRY와 불일치: ${doc.layer.button_label}`);
      }
      if (doc.layer.panel_label && !registryBlock.includes(doc.layer.panel_label)) {
        fail(`layer.panel_label이 LAYER_REGISTRY와 불일치: ${doc.layer.panel_label}`);
      }
    }
  }

  return { failures, warnings };
}

// ---------------------------------------------------------------------------
// CLI entry point (`npm run validate:modules` / `node scripts/validate_module_contract.mjs`)
// — reads every modules/*.yaml, runs checkModuleDoc() against each with
// registry parity enabled, and prints/exits exactly as before the export
// refactor. Guarded by isMainModule so importing this file for
// checkModuleDoc() alone (e.g. api/update-center.js's onboarding endpoint)
// never triggers CLI output or process.exit.
// ---------------------------------------------------------------------------

function runCli() {
  let totalFailures = 0;
  const fail = (file, msg) => { totalFailures += 1; console.error(`  FAIL [${file}] ${msg}`); };

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
    const { failures, warnings } = checkModuleDoc(doc, { registryBlock });
    for (const msg of failures) fail(file, msg);
    for (const msg of warnings) console.warn(`  WARN [${file}] ${msg}`);
  }

  if (totalFailures) { console.error(`\n계약 검증 실패: ${totalFailures}건`); process.exit(1); }
  console.log(`\n계약 검증 통과: ${files.length}개 모듈`);
}

const isMainModule = process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
if (isMainModule) runCli();
