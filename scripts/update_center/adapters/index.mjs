// scripts/update_center/adapters/index.mjs
//
// 데이터셋 → 어댑터 해석. 전용 어댑터가 있으면 그것을, 없으면 통과 어댑터를 쓴다.
// 새 어댑터는 이 파일의 REGISTRY 에 한 줄 추가하는 것으로 등록된다.

import * as libraries from "./libraries.mjs";
import * as generic from "./generic.mjs";

const REGISTRY = new Map([[libraries.dataset, libraries]]);

export function getAdapter(dataset) {
  return REGISTRY.get(dataset) || generic;
}

export function hasDedicatedAdapter(dataset) {
  return REGISTRY.has(dataset);
}

export function listAdapters() {
  return [...REGISTRY.keys()];
}

export { generic };
