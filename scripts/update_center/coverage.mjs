import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';
import {sourcesPath,applyRoot} from './paths.mjs';
export function refreshCoverage(){
  const sources=yaml.load(fs.readFileSync(sourcesPath(),'utf8')).sources||[];
  const items=sources.map(s=>({dataset:s.dataset,file:s.local_file,provider:s.provider,source_url:s.source_url,check:s.check?.type||'manual',
    mode:s.auto_apply&&!s.never_auto_apply&&!s.rebuild_command?'validated_auto_apply':s.check?.type==='json_api'?'collect_review_apply':s.check?.type==='file_head'?'header_signal_only':s.check?.type==='school_zones'?'collect_review_apply':'manual',
    rebuild:s.check?.pipeline||s.rebuild_command||null,protected:Boolean(s.never_auto_apply),coverage:s.coverage||s.notes||'등록된 범위 설명 없음'}));
  const counts={};for(const item of items)counts[item.mode]=(counts[item.mode]||0)+1;
  const registered=new Set(sources.map(s=>s.local_file));const unregistered=[];
  function walk(dir){if(!fs.existsSync(dir))return;for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const file=path.join(dir,entry.name);if(entry.isDirectory())walk(file);else if(/\.(csv|json|geojson)$/.test(entry.name)){const relative=path.relative(applyRoot(),file).split(path.sep).join('/');if(!registered.has(relative))unregistered.push(relative);}}}
  walk(path.join(applyRoot(),'data_processed'));
  return {generated_at:new Date().toISOString(),counts,sources:items,unregistered_files:unregistered,
    notes:['미등록 파일에는 다른 원자료에서 만들어지는 파생 산출물도 포함됩니다. 모두 독립 수집 대상이라는 뜻은 아닙니다.','file_head는 게시물 HTTP 헤더 변화 신호이며 첨부파일 내용 갱신을 보장하지 않습니다.','자동 반영은 출처별 명시적 허용과 품질 검사를 모두 통과해야 합니다.','기존 모델/생활권/정책 결과는 전체 파생 재분석이 연결되어야 갱신 완료라고 할 수 있습니다.']};
}
