"use strict";

// local_review_server.cjs 단독 테스트 (2026-09-06 운영 태스크)
// 실행: node scripts/tests/test_local_review_server_ops20260906.cjs
// 외부 네트워크 호출 없음. 서버를 in-process 로 띄워 오프라인 강제/경로 차단/API 폴백을 검증한다.

const assert = require("node:assert");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");

// 오프라인 강제 검증을 위해 셸에 키가 있어도 시작 상태를 통제한다(값은 사용/출력하지 않음).
const HAD_SHELL_KEY = Boolean(process.env.OPENAI_API_KEY);

const { createAppServer, resolveStaticFile, parseArgs, PROJECT_ROOT } =
  require(path.join(__dirname, "..", "local_review_server.cjs"));

function request(port, { method = "GET", urlPath = "/", body = null, headers = {} } = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      { host: "127.0.0.1", port, method, path: urlPath, headers },
      (res) => {
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks).toString("utf-8") }));
      },
    );
    req.on("error", reject);
    if (body) req.write(body);
    req.end();
  });
}

async function postExplainer(port, payload) {
  const res = await request(port, {
    method: "POST",
    urlPath: "/api/ai-explainer-v2",
    body: JSON.stringify(payload),
    headers: { "Content-Type": "application/json" },
  });
  return { status: res.status, json: JSON.parse(res.body) };
}

let passed = 0;
function ok(name, condition) {
  assert.ok(condition, name);
  passed += 1;
  console.log(`  PASS ${name}`);
}

async function main() {
  console.log("[1] 오프라인 모드 초기화");
  const server = createAppServer({ mode: "offline" });
  ok("require 이후 OPENAI_API_KEY 가 프로세스에서 제거됨(더미 포함)", process.env.OPENAI_API_KEY === undefined);
  console.log(`      (시작 시 셸에 키 존재 여부: ${HAD_SHELL_KEY} — 존재했더라도 제거되어야 함)`);

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;
  console.log(`      임시 포트 ${port}`);

  try {
    console.log("[2] 외부 fetch 차단 가드");
    await assert.rejects(
      () => globalThis.fetch("https://api.openai.com/v1/responses", { method: "POST" }),
      /offline mode: outbound fetch blocked/,
    );
    passed += 1;
    console.log("  PASS api.openai.com 으로의 fetch 가 프로세스 차원에서 차단됨");

    console.log("[3] 공개 자산 서빙");
    for (const p of ["/", "/index.html", "/logo.png", "/outputs/robust_xai/run_summary.json"]) {
      const res = await request(port, { urlPath: p });
      ok(`GET ${p} -> 200`, res.status === 200);
    }
    const head = await request(port, { method: "HEAD", urlPath: "/index.html" });
    ok("HEAD /index.html -> 200", head.status === 200);

    console.log("[4] 경로 탐색/비밀/비공개 코드 차단");
    const deniedPaths = [
      "/.env",
      "/..%2F.env",
      "/../.env",
      "/data_processed/../.env",
      "/data_processed/..%2f..%2f1.env",
      "/api/ai-explainer-v2.js",
      "/scripts/local_review_server.cjs",
      "/update_center/review_cli.cjs",
      "/pipeline/registry/data_registry.yaml",
      "/reports/operations_progress_20260906.md",
      "/outputs/verification/anything.json",
      "/package.json",
      "/vercel.json",
      "/assets/%2e%2e/package.json",
      "/data_processed/.hidden.json",
      "/ui-preview/dist/..%5c..%5cpackage.json",
    ];
    for (const p of deniedPaths) {
      const res = await request(port, { urlPath: p });
      ok(`GET ${p} -> 404 (차단)`, res.status === 404);
    }

    console.log("[5] resolveStaticFile 단위 검증");
    const realRoot = fs.realpathSync.native(PROJECT_ROOT);
    ok("탈출 경로는 null", resolveStaticFile("/data_processed/../../secret.csv") === null);
    ok("허용 경로는 프로젝트 루트 안", (resolveStaticFile("/data_processed/gu_summary.csv") || "").startsWith(realRoot));
    ok("허용 확장자 외(.cjs)는 null", resolveStaticFile("/update_center/public/x.cjs") === null);

    console.log("[6] 메서드 제한");
    const putStatic = await request(port, { method: "PUT", urlPath: "/index.html", body: "x" });
    ok("PUT /index.html -> 405", putStatic.status === 405);
    const getApi = await request(port, { urlPath: "/api/ai-explainer-v2" });
    ok("GET /api/ai-explainer-v2 -> 405", getApi.status === 405);
    const delApi = await request(port, { method: "DELETE", urlPath: "/api/ai-explainer-v2" });
    ok("DELETE /api/ai-explainer-v2 -> 405", delApi.status === 405);

    console.log("[7] 키 없이 유용한 오프라인 해설 (OpenAI 실호출 없음)");
    const caseAnswer = await postExplainer(port, {
      mode: "identified_school_explainer",
      question: "Case 1부터 Case 4까지 전체 분류 기준을 알려줘",
      question_type: "concept",
    });
    ok("Case 전체 기준 질문 200", caseAnswer.status === 200);
    ok("answerable=true (결정론적 case overview 답변)", caseAnswer.json.answerable === true);
    ok("근거 chunk 인용 포함", Array.isArray(caseAnswer.json.evidence) && caseAnswer.json.evidence.length > 0);

    const knnAnswer = await postExplainer(port, {
      mode: "identified_school_explainer",
      question: "KNN 유사학교 비교는 어떤 방식인가요?",
      question_type: "concept",
    });
    ok("KNN 질문 200 (retrieval fallback 경로)", knnAnswer.status === 200);
    ok("KNN 질문 answerable=true", knnAnswer.json.answerable === true);
    ok("KNN 근거 chunk id 존재", knnAnswer.json.evidence.every((e) => typeof e.source_chunk_id === "string" && e.source_chunk_id.length > 0));

    const offDomain = await postExplainer(port, {
      mode: "identified_school_explainer",
      question: "오늘 저녁 메뉴 추천해줘",
      question_type: "concept",
    });
    ok("오프도메인 질문은 blocked", offDomain.json.answerable === false);

    console.log("[8] 상태 엔드포인트(키 값 미노출)");
    const status = await request(port, { urlPath: "/__status" });
    const statusJson = JSON.parse(status.body);
    ok("__status mode=offline", statusJson.mode === "offline");
    ok("__status openai_key_present=false", statusJson.openai_key_present === false);
    ok("__status 응답에 sk- 문자열 없음", !status.body.includes("sk-"));

    console.log("[10] symlink/junction 탈출 차단 (리뷰 1차 P1 회귀)");
    // 내가 소유한 update_center/public 아래에만 임시 링크를 만들어 검증한다.
    const outsideDir = fs.mkdtempSync(path.join(require("node:os").tmpdir(), "srv_link_out_"));
    fs.writeFileSync(path.join(outsideDir, "leak.json"), '"outside-marker"');
    const linkOutside = path.join(PROJECT_ROOT, "update_center", "public", "uc_link_out_test");
    const linkInternal = path.join(PROJECT_ROOT, "update_center", "public", "uc_link_api_test");
    let junctionOk = false;
    try {
      fs.symlinkSync(outsideDir, linkOutside, "junction");
      fs.symlinkSync(path.join(PROJECT_ROOT, "api"), linkInternal, "junction");
      junctionOk = true;
    } catch (err) {
      console.log(`  SKIP junction 생성 불가(${err.code}) — 환경 제약`);
    }
    if (junctionOk) {
      try {
        const escOut = await request(port, { urlPath: "/update_center/public/uc_link_out_test/leak.json" });
        ok("프로젝트 밖으로 나가는 junction 경유 서빙 차단", escOut.status === 404);
        const escIn = await request(port, { urlPath: "/update_center/public/uc_link_api_test/ai_explainer_chunks.json" });
        ok("프로젝트 안이라도 허용목록 밖(api/)으로 가는 junction 차단", escIn.status === 404);
      } finally {
        fs.rmSync(linkOutside, { recursive: true, force: true });
        fs.rmSync(linkInternal, { recursive: true, force: true });
      }
    }
    fs.rmSync(outsideDir, { recursive: true, force: true });

    console.log("[11] fetch 가드 리다이렉트 차단 (리뷰 1차 P1 회귀, 로컬 서버만 사용)");
    let targetHits = 0;
    const target = http.createServer((req, res) => { targetHits += 1; res.end("target"); });
    await new Promise((resolve) => target.listen(0, "127.0.0.2", resolve));
    const targetPort = target.address().port;
    const redirector = http.createServer((req, res) => {
      res.writeHead(302, { Location: `http://127.0.0.2:${targetPort}/` });
      res.end();
    });
    await new Promise((resolve) => redirector.listen(0, "127.0.0.1", resolve));
    const redirectorPort = redirector.address().port;
    try {
      await assert.rejects(() => globalThis.fetch(`http://127.0.0.1:${redirectorPort}/`));
      passed += 1;
      console.log("  PASS localhost 302 → 127.0.0.2 리다이렉트를 따르지 않고 실패");
      ok("리다이렉트 대상 서버 호출 0회", targetHits === 0);
      await assert.rejects(() => globalThis.fetch(`http://127.0.0.1:${redirectorPort}/`, { redirect: "follow" }));
      passed += 1;
      console.log("  PASS 호출자가 redirect:follow 를 지정해도 강제 미추적 유지");
      ok("follow 지정 후에도 대상 호출 0회", targetHits === 0);
      const direct = await globalThis.fetch(`http://127.0.0.1:${port}/__status`);
      ok("리다이렉트 없는 localhost fetch 는 정상 동작", direct.status === 200);
    } finally {
      redirector.close();
      target.close();
    }

    console.log("[12] 인자 파싱");
    ok("기본 포트", parseArgs([]).port === 8899);
    ok("--port 파싱", parseArgs(["--port", "0"]).port === 0);
    assert.throws(() => parseArgs(["--port", "abc"]));
    passed += 1;
    console.log("  PASS 잘못된 포트 거부");
  } finally {
    server.close();
  }

  console.log(`\n총 ${passed}개 검증 통과`);
}

main().catch((err) => {
  console.error("FAIL:", err && err.message ? err.message : err);
  process.exit(1);
});
