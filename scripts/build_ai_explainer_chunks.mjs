import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "..");
const docsDir = path.join(root, "docs", "ai_explainer");
const outputPath = path.join(root, "api", "ai_explainer_chunks.json");
const requiredDocs = [
  "01_glossary.md",
  "02_case_rules.md",
  "03_metrics.md",
  "04_decision_logic.md",
  "05_shap_explanation.md",
  "06_limitations.md",
];
const optionalDocs = ["README.md"];

function parseChunks(fileName) {
  const fullPath = path.join(docsDir, fileName);
  const text = readFileSync(fullPath, "utf-8");
  const lines = text.split(/\r?\n/);
  const chunks = [];
  let current = null;

  for (const line of lines) {
    const match = line.match(/^### \[chunk: ([^\]]+)\]\s*(.*)$/);
    if (match) {
      if (current) chunks.push(current);
      current = {
        id: match[1].trim(),
        source: fileName,
        title: match[2].trim(),
        tags: [],
        bodyLines: [],
      };
      continue;
    }

    if (!current) continue;
    const tagMatch = line.match(/^tags:\s*(.*)$/);
    if (tagMatch && current.bodyLines.length === 0) {
      current.tags = tagMatch[1]
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean);
      continue;
    }
    current.bodyLines.push(line);
  }

  if (current) chunks.push(current);
  return chunks.map((chunk) => ({
    id: chunk.id,
    source: chunk.source,
    title: chunk.title,
    tags: chunk.tags,
    body: chunk.bodyLines.join("\n").trim(),
  }));
}

if (!existsSync(docsDir)) {
  throw new Error(`Missing docs directory: ${path.relative(root, docsDir)}`);
}

const availableDocs = new Set(readdirSync(docsDir));
for (const doc of requiredDocs) {
  if (!availableDocs.has(doc)) {
    throw new Error(`Missing required AI explainer doc: ${doc}`);
  }
}

const docsToParse = [
  ...optionalDocs.filter((doc) => availableDocs.has(doc)),
  ...requiredDocs,
];
const chunks = docsToParse.flatMap(parseChunks);
const seen = new Set();
for (const chunk of chunks) {
  if (!chunk.id || !chunk.body) {
    throw new Error(`Invalid empty chunk in ${chunk.source}: ${chunk.id || "(missing id)"}`);
  }
  if (seen.has(chunk.id)) {
    throw new Error(`Duplicate chunk id: ${chunk.id}`);
  }
  if (!chunk.id.includes("#")) {
    throw new Error(`Chunk id must include document anchor separator "#": ${chunk.id}`);
  }
  seen.add(chunk.id);
}

mkdirSync(path.dirname(outputPath), { recursive: true });
writeFileSync(
  outputPath,
  `${JSON.stringify(
    {
      generated_at: "static",
      required_docs: requiredDocs,
      chunks,
    },
    null,
    2,
  )}\n`,
  "utf-8",
);

console.log(`AI explainer chunks: ${chunks.length}`);
console.log(path.relative(root, outputPath));
