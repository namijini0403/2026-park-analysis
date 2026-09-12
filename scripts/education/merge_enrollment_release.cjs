// Refresh only embedded enrollment after restoring persistent school bundles.
const fs = require('node:fs');
const path = require('node:path');
function mergeEnrollment(rows, forecasts) {
  let updated = 0;
  const latest = value => Math.max(0, ...(value?.history || []).map(r => Number(r.year) || 0));
  for (const row of rows) {
    const next = forecasts[row.학교ID];
    if (!next || latest(next) < latest(row.enrollment)) continue;
    row.enrollment = next;
    row.student_slope = next.student_slope;
    updated++;
  }
  return updated;
}
function applyEnrollmentRelease(publicRoot) {
  const directory = path.join(publicRoot, 'data_processed/education');
  const file = path.join(directory, 'school_analysis.json');
  const forecastsFile = path.join(directory, 'enrollment_forecasts.json');
  if (!fs.existsSync(file) || !fs.existsSync(forecastsFile)) return 0;
  const rows = JSON.parse(fs.readFileSync(file, 'utf8'));
  const updated = mergeEnrollment(rows, JSON.parse(fs.readFileSync(forecastsFile, 'utf8')));
  if (updated) fs.writeFileSync(file, JSON.stringify(rows));
  return updated;
}
module.exports = {mergeEnrollment, applyEnrollmentRelease};
