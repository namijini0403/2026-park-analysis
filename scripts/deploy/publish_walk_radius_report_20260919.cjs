'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../..');
const source=path.join(root,'outputs/walk-radius-area-20260919');
const release=path.join(root,'outputs/ux-deploy-20260919');
const target=path.join(release,'vercel_public/reports/walk-radius-area-20260919');
const files={
 'analysis_report.html':'index.html','analysis_report.md':'analysis_report.md','analysis.json':'analysis.json',
 'area_comparison.png':'area_comparison.png','area_comparison.svg':'area_comparison.svg',
 'distribution_region.png':'distribution_region.png','distribution_region.svg':'distribution_region.svg',
 '500m_area_analysis.zip':'500m_area_analysis.zip'
};
assert(fs.existsSync(path.join(release,'ux-release-manifest.json')),'검증된 격리 배포본이 없습니다.');
assert(fs.existsSync(path.join(release,'vercel_public/data_processed/schools.csv')),'공개 데이터가 빠진 배포본입니다.');
fs.mkdirSync(target,{recursive:true});
const hash=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const entries=[];
for(const [from,to] of Object.entries(files)){
 const input=path.join(source,from),output=path.join(target,to);assert(fs.existsSync(input),from);
 fs.copyFileSync(input,output);entries.push({file:to,bytes:fs.statSync(output).size,sha256:hash(output)});
}
const manifest={created:new Date().toISOString(),baseDeployment:'181afe70-87da-4092-a7bc-8f311c58c7e9',
 publicPath:'/reports/walk-radius-area-20260919/',files:entries};
fs.writeFileSync(path.join(target,'share-report-manifest.json'),JSON.stringify(manifest,null,2));
console.log(JSON.stringify(manifest,null,2));
