// Refresh only embedded enrollment after restoring persistent school bundles.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
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
  const analysisFile = path.join(directory, 'analysis_dataset.json');
  if (fs.existsSync(analysisFile)) {
    const analysis = JSON.parse(fs.readFileSync(analysisFile, 'utf8'));
    const bundled = Object.fromEntries(rows.map(row => [row.학교ID, row.enrollment]));
    const forecasts = JSON.parse(fs.readFileSync(forecastsFile, 'utf8'));
    for (const school of analysis.schools || []) {
      const offered = forecasts[school.id];
      const saved = bundled[school.id];
      const latestYear = value => Math.max(0, ...(value?.history || []).map(row => Number(row.year) || 0));
      const next = latestYear(saved) > latestYear(offered) ? saved : offered || saved;
      const origin = Math.max(0, ...(next?.history || []).map(row => Number(row.year) || 0));
      const currentOrigin = school.forecast_origin_year || Math.max(0, ...(school.enrollment_trend?.observations || []).map(row => Number(row.year) || 0));
      if (!next || origin < currentOrigin) continue;
      school.forecast = next.forecast || [];
      school.forecast_status = next.model_status || 'unavailable';
      school.forecast_origin_year = origin || null;
      school.forecast_model_version = next.model_version || null;
      school.forecast_limitations = next.limitations || null;
    }
    for (const [level, coverage] of Object.entries(analysis.coverage || {})) {
      coverage.forecast = (analysis.schools || []).filter(school => school.level === level && school.forecast?.length).length;
    }
    if (analysis.source_hashes) {
      for (const filename of ['enrollment_forecasts.json', 'school_analysis.json']) {
        delete analysis.source_hashes['data_processed\\education\\' + filename];
        analysis.source_hashes['data_processed/education/' + filename] = crypto.createHash('sha256').update(fs.readFileSync(path.join(directory, filename))).digest('hex');
      }
    }
    fs.writeFileSync(analysisFile, JSON.stringify(analysis));
  }
  return updated;
}
module.exports = {mergeEnrollment, applyEnrollmentRelease};
