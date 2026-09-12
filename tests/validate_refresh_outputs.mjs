import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {validatePipelineFile} from '../scripts/update_center/pipeline.mjs';
const root=path.resolve('.');
const disclosures=JSON.parse(fs.readFileSync('contest_plan/disclosure_refresh_validation.json','utf8'));
const libraryDir=path.join(root,'outputs','refresh-validation-1789099414');
const hash=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const files=[];
function walk(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const file=path.join(dir,entry.name);if(entry.isDirectory())walk(file);else{const target=path.relative(libraryDir,file).split(path.sep).join('/');if(!fs.existsSync(path.join(root,target))||hash(file)!==hash(path.join(root,target)))files.push({target,sha256:hash(file),bytes:fs.statSync(file).size});}}}
walk(path.join(libraryDir,'data_processed'));
for(const result of [{work:libraryDir,files},disclosures]){
  for(const f of result.files)validatePipelineFile(fs.readFileSync(path.join(result.work,f.target)),f.target,path.join(root,f.target));
  console.log('Validated actual refresh outputs:',result.files.length,'files',result.files.reduce((sum,f)=>sum+f.bytes,0),'bytes');
}
fs.writeFileSync('contest_plan/library_refresh_validation.json',JSON.stringify({kind:'libraries',work:libraryDir,files},null,2));
