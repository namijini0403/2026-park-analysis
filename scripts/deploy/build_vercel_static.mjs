import { copyFileSync, cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "..", "..");
const outputDir = path.join(root, "vercel_public");


const requiredRootFiles = ["index.html", "logo.png", "update-center.html", "office-documents.html"];
const requiredDataFiles = [
  "school_priority_with_functional_park_layer.csv",
  "schools.csv",
  "student_trend.csv",
  "school_nearest_park.csv",
  "school_enrollment_forecast_20260418_model1.csv",
  "school_similar_schools_top5.csv",
  "candidate_barrier_routes_by_school.json",
  "candidate_panel_examples.json",
  "robust_candidate_recommendations.json",
  "robust_shap_candidate_explanations.json",
  "gu_summary.csv",
  "parks.csv",
  "school_isochrone_500m.geojson",
  "school_walkshed_500m_v3.geojson",
  "school_walkshed_500m_v3_report.csv",
  "school_buffer_500m.geojson",
  "redevelopment_geocoded.csv",
  "large_apt_complexes_2025.csv",
  "candidate_grid_final.geojson",
  "libraries.csv",
  "school_library_access.csv",
  "policy_action_cards.json",
  "school_walk_500m_apartment_adjustment_20260504.csv"
];

function assertExists(targetPath) {
  if (!existsSync(targetPath)) {
    throw new Error(`Missing required deployment file: ${path.relative(root, targetPath)}`);
  }
}

function copyFileToOutput(relativePath) {
  const source = path.join(root, relativePath);
  const destination = path.join(outputDir, relativePath);
  assertExists(source);
  mkdirSync(path.dirname(destination), { recursive: true });
  copyFileSync(source, destination);
}

function copyIndexHtml() {
  const source = path.join(root, "index.html");
  const destination = path.join(outputDir, "index.html");
  assertExists(source);
  mkdirSync(path.dirname(destination), { recursive: true });

  const html = readFileSync(source, "utf-8");
  writeFileSync(destination, html, "utf-8");
}

function copyDirectoryToOutput(relativePath) {
  const source = path.join(root, relativePath);
  const destination = path.join(outputDir, relativePath);
  assertExists(source);
  cpSync(source, destination, { recursive: true });
}

// The simple application has no iframe or frontend bundler dependency.
if (path.dirname(outputDir) !== root || path.basename(outputDir) !== "vercel_public") throw new Error("Unexpected build output path");

rmSync(outputDir, { recursive: true, force: true });
mkdirSync(outputDir, { recursive: true });

for (const file of requiredRootFiles) {
  if (file === "index.html") {
    copyIndexHtml();
  } else {
    copyFileToOutput(file);
  }
}

for (const file of requiredDataFiles) {
  copyFileToOutput(path.join("data_processed", file));
}
// Every chatbot source link must also exist in the static output.
const catalog = createRequire(import.meta.url)("../../api/_data_catalog.js");
for (const file of new Set(catalog.map(entry => entry.file))) copyFileToOutput(file);

// 학교 맥락 레이어 (지정·연구학교, 유흥·단란주점 인허가, 공사장 행정기록)
// — python scripts/build_context_layers.py 산출물
copyDirectoryToOutput(path.join("data_processed", "context"));
copyDirectoryToOutput(path.join("data_processed", "education"));
copyDirectoryToOutput(path.join("data_processed", "student_services"));
// 지도 레이어(공원·놀이터·도서관 등)와 출처 색인 — 첫 화면 레이어 패널과 출처 링크가 정적 출력에서도 동작해야 한다.
copyDirectoryToOutput(path.join("data_processed", "map_layers"));
copyDirectoryToOutput(path.join("data_processed", "source_provenance"));

copyDirectoryToOutput("rag");
copyDirectoryToOutput("assets");
copyDirectoryToOutput(path.join("outputs", "robust_xai"));

let fileCount = 0;
let totalBytes = 0;
const stack = [outputDir];
while (stack.length) {
  const current = stack.pop();
  const stats = statSync(current);
  if (stats.isDirectory()) {
    for (const child of readdirSync(current)) {
      stack.push(path.join(current, child));
    }
  } else {
    fileCount += 1;
    totalBytes += stats.size;
  }
}

console.log(`Vercel static export ready: ${path.relative(root, outputDir)}`);
console.log(`Files: ${fileCount}`);
console.log(`Size: ${(totalBytes / 1024 / 1024).toFixed(2)} MB`);
