// ICE notice-specific observation; never stages or applies source data.
import crypto from 'node:crypto';
const MAX_BYTES = 2 * 1024 * 1024;
function section(html, className) {
  const tags = /<\/?div\b[^>]*>/gi;
  let match, start = -1, depth = 0;
  while ((match = tags.exec(html))) {
    if (start < 0) {
      const classes = match[0].match(/\bclass\s*=\s*["']([^"']*)["']/i)?.[1]?.split(/\s+/) || [];
      if (classes.includes(className)) {start = tags.lastIndex; depth = 1;}
    } else {
      depth += /^<\//.test(match[0]) ? -1 : 1;
      if (!depth) return html.slice(start, match.index);
    }
  }
  throw Error('공식 게시글 구조 확인 불가: ' + className);
}
function text(html) {
  return html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]*>/g, ' ').replace(/&#(x[\da-f]+|\d+);/gi, (all, code) => {
      const n = code[0].toLowerCase() === 'x' ? parseInt(code.slice(1), 16) : Number(code);
      return n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : all;
    }).replace(/&(nbsp|amp|lt|gt|quot|apos);/g, (_, name) => ({nbsp:' ',amp:'&',lt:'<',gt:'>',quot:'"',apos:"'"}[name]))
    .replace(/\s+/g, ' ').trim();
}
export function extractIceNotice(html) {
  const article = section(html.replace(/<!--[\s\S]*?-->/g, ''), 'bbs_ViewA');
  const title = text(article.match(/<h3\b[^>]*>([\s\S]*?)<\/h3>/i)?.[1] || '');
  const body = text(section(article, 'bbsV_cont'));
  const attachments = [];
  if (/class=["'][^"']*\bbbsV_atchmnfl\b/.test(article)) {
    for (const match of section(article, 'bbsV_atchmnfl').matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)) {
      if (!/\bclass=["'][^"']*\bfileName\b/.test(match[1])) continue;
      const id = match[1].match(/goFileDown\(['"]([a-f\d]{32})['"]\)/i)?.[1];
      if (!id) throw Error('첨부파일 참조 구조 변경');
      attachments.push({id: id.toLowerCase(), name: text(match[2])});
    }
  }
  if (!title || (!body && !attachments.length) || /^(로그인|오류|에러|접근\s*거부)/.test(title)) throw Error('유효한 공개 게시글 확인 불가');
  attachments.sort((a,b) => a.id.localeCompare(b.id));
  return {title, body, attachments};
}
export async function fetchIceNotice(url, fetchImpl = fetch) {
  const target = new URL(url);
  if (target.origin !== 'https://www.ice.go.kr' || target.pathname !== '/ice/na/ntt/selectNttInfo.do' || !/^\d+$/.test(target.searchParams.get('nttSn') || '')) throw Error('허용된 교육청 게시글 주소가 아닙니다.');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  let reader;
  try {
    const response = await fetchImpl(url, {signal: controller.signal, redirect: 'error'});
    if (!response.ok) throw Error('게시글 GET HTTP ' + response.status);
    if (!/text\/html/i.test(response.headers.get('content-type') || '')) throw Error('게시글 HTML 응답이 아닙니다.');
    if (Number(response.headers.get('content-length')) > MAX_BYTES) throw Error('게시글 응답 크기 초과');
    if (!response.body) throw Error('게시글 응답 본문 없음');
    reader = response.body.getReader();
    let size = 0; const chunks = [];
    while (true) {
      const {done, value} = await reader.read(); if (done) break;
      size += value.byteLength; if (size > MAX_BYTES) throw Error('게시글 응답 크기 초과');
      chunks.push(Buffer.from(value));
    }
    return extractIceNotice(Buffer.concat(chunks).toString('utf8'));
  } finally {clearTimeout(timer); if (reader) await reader.cancel().catch(() => {});}
}
export async function checkPageNotice(entry, state, store, {actor = 'scan.mjs', fetchImpl} = {}, log = () => {}) {
  const dataset = entry.dataset, prev = state[dataset] || {};
  const lastCheckedAt = new Date().toISOString();
  try {
    const notice = await fetchIceNotice(entry.check.urls.page, fetchImpl);
    const hash = crypto.createHash('sha256').update(JSON.stringify(notice)).digest('hex');
    state[dataset] = {lastCheckedAt, lastStatus: 'ok', noticeHash: hash, noticeTitle: notice.title, detection_scope: 'notice_text_and_attachment_references'};
    if (!prev.noticeHash) {
      await store.appendAudit({actor, action: 'baseline_recorded', dataset, detail: '게시글 제목·본문·첨부 참조 기준 기록 (첨부 내용 검증 아님)'});
      return {outcome: 'baseline'};
    }
    if (prev.noticeHash === hash) return {outcome: 'unchanged'};
    const event = await store.recordEvent({dataset, kind: 'content', risk: 'yellow', status: 'pending', summary: '게시글 또는 첨부 참조 변경 · 원자료 확인 필요 (자동 반영 없음)', diff_json: {previous_hash: prev.noticeHash, next_hash: hash, title: notice.title, attachments: notice.attachments, observation_only: true, approval_blocked: true}});
    await store.appendAudit({actor, action: 'record_event', dataset, event_id: event.id, detail: event.summary});
    return {outcome: 'yellow', event};
  } catch (error) {
    state[dataset] = {...prev, lastCheckedAt, lastStatus: 'error', error: error.message};
    if (prev.lastStatus === 'error' && prev.error === error.message) return {outcome: 'error-unchanged'};
    const event = await store.recordEvent({dataset, kind: 'error', risk: 'red', status: 'pending', summary: '게시글 변경 확인 불가 · 기존 자료 유지', diff_json: {error: error.message}});
    log(`[${dataset}] ${error.message}`);
    return {outcome: 'error', event};
  }
}
