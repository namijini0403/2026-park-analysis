import { copyFileSync, cpSync, existsSync, mkdirSync, readdirSync, rmSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "..", "..");
const outputDir = path.join(root, "vercel_public");

const requiredRootFiles = ["index.html", "logo.png"];
const requiredDataFiles = [
  "school_priority_with_functional_park_layer.csv",
  "schools.csv",
  "student_trend.csv",
  "school_nearest_park.csv",
  "school_enrollment_forecast_20260418_model1.csv",
  "school_similar_schools_top5.csv",
  "candidate_barrier_routes_by_school.json",
  "gu_summary.csv",
  "parks.csv",
  "isochrone_valhalla.geojson",
  "school_buffer_500m.geojson",
  "redevelopment_geocoded.csv",
  "large_apt_complexes_2025.csv",
  "childcare_michuhol.csv",
  "candidate_grid_final.geojson"
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

function copyDirectoryToOutput(relativePath) {
  const source = path.join(root, relativePath);
  const destination = path.join(outputDir, relativePath);
  assertExists(source);
  cpSync(source, destination, { recursive: true });
}

rmSync(outputDir, { recursive: true, force: true });
mkdirSync(outputDir, { recursive: true });

for (const file of requiredRootFiles) {
  copyFileToOutput(file);
}

for (const file of requiredDataFiles) {
  copyFileToOutput(path.join("data_processed", file));
}

copyDirectoryToOutput(path.join("ui-preview", "dist"));

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
