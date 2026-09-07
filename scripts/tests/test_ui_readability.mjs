import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { createServer } from '../../ui-preview/node_modules/vite/dist/node/index.js';
import React from '../../ui-preview/node_modules/react/index.js';
import { renderToStaticMarkup } from '../../ui-preview/node_modules/react-dom/server.node.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
let scriptCount = 0;
for (const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
  if (/\bsrc\s*=/.test(match[1]) || !match[2].trim()) continue;
  new vm.Script(match[2]);
  scriptCount++;
}
assert.ok(scriptCount > 0);
assert.ok(!html.includes('최우선 지원(case 3)'));
console.log(`PASS main map: ${scriptCount} inline scripts parse; policy legend corrected`);

const vite = await createServer({ root: path.join(root, 'ui-preview'), server: { middlewareMode: true }, appType: 'custom' });
try {
  const [stats, statsData, report, preview, simulation, landing, disclosure] = await Promise.all([
    '/src/StatisticsPageSafe.tsx', '/src/statisticsPreviewDataSafe.ts',
    '/src/SchoolDetailReportPagePreview.tsx', '/src/previewData.ts',
    '/src/SimulationPage.tsx', '/src/LandingPage.tsx', '/src/Disclosure.tsx',
  ].map(file => vite.ssrLoadModule(file)));
  const render = (component, props) => renderToStaticMarkup(React.createElement(component, props));
  const data = statsData.cityStatisticsPreviewDataSafe;
  assert.equal(data.districts.reduce((sum, item) => sum + item.schoolCount, 0), data.summary.schoolCount);
  assert.equal(data.summary.case1Count + data.summary.case2Count + data.summary.case3Count + data.summary.case4Count + data.summary.separateBundleCount, data.summary.schoolCount);
  const statisticsHtml = render(stats.default, { data });
  assert.ok(statisticsHtml.includes('81개교'));
  assert.ok(statisticsHtml.includes('29.8%'));
  assert.ok(!statisticsHtml.includes('최우수'));
  assert.ok(statisticsHtml.includes('aria-pressed="true"'));
  console.log('PASS statistics: totals, visible 81/272 (29.8%), meaningful labels, selected controls');

  for (const [caseId, labels] of Object.entries(report.CASE_LABELS)) {
    const output = render(report.default, { ...preview.previewSchoolDetailReport, casePolicyLabel: labels.policy, caseStatusLabel: labels.status });
    assert.ok(output.includes(labels.policy));
    assert.ok(output.includes('시 평균과 비교하면 어떤가요?'));
    assert.ok(output.includes('aria-expanded="false"'));
    assert.ok(!output.includes('NaN'));
    assert.ok(!output.includes('Infinity'));
    console.log(`PASS school report: policy ${caseId}, summary, comparison, collapsed evidence`);
  }
  const bridge = await vite.ssrLoadModule('/src/schoolDataBridge.ts');
  const { parseCsv } = createRequire(import.meta.url)('../../update_center/review_cli.cjs');
  const [headers, ...rows] = parseCsv(fs.readFileSync(path.join(root, 'data_processed/school_priority_with_functional_park_layer.csv'), 'utf8').replace(/^\uFEFF/, ''));
  const schoolRows = rows.filter(row => row.length === headers.length).map(row => Object.fromEntries(headers.map((key, index) => [key, row[index]])));
  assert.equal(schoolRows.length, 272);
  for (const row of schoolRows) {
    const mapped = bridge.mapSchoolRowToReportProps(row);
    const output = render(report.default, mapped);
    assert.ok(output.includes(row['학교명']));
    assert.ok(!output.includes('NaN'), row['학교명']);
    assert.ok(!output.includes('Infinity'), row['학교명']);
  }
  for (const [row, expected] of [
    [{ iso_park_count: '1', nearest_park_dist_m: '500' }, false],
    [{ iso_park_count: '0', nearest_park_dist_m: '500' }, true],
    [{ nearest_park_dist_m: '500' }, false],
    [{ nearest_park_dist_m: '501' }, true],
  ]) assert.equal(bridge.mapSchoolRowToReportProps(row).noParkWithin500m, expected);
  console.log('PASS all 272 school rows render; observed park counts and inclusive 500m boundary');
  const simulationHtml = render(simulation.default, {
    schoolName: '검증 학교', schoolLat: 37.46, schoolLng: 126.68,
    casePolicyLabel: '즉시 개선 대상', caseType: 1, candidates: [], onBack() {},
  });
  assert.ok(simulationHtml.includes('검증 학교'));
  assert.ok(simulationHtml.includes('어디를 먼저 현장 검토할까요?'));
  assert.ok(simulationHtml.includes('비교 기준 조정'));
  assert.ok(!simulationHtml.includes('NaN'));
  console.log('PASS simulation: empty candidates render without failure');
  assert.ok(render(landing.default, { onEnter() {} }).includes('화면별 사용법과 예시 보기'));
  const folded = render(disclosure.default, { title: '근거', children: 'DETAIL_SENTINEL' });
  assert.ok(folded.includes('aria-controls='));
  assert.ok(!folded.includes('DETAIL_SENTINEL'));
  console.log('PASS landing and disclosure: accessible collapsed controls; deferred evidence rendering');
} finally {
  await vite.close();
}
