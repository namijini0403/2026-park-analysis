// Server-side SSO adapter. No portal session cookie or signing key leaves the portal.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const {randomBytes, createHash} = require('node:crypto');
const COOKIE = '__Host-seokam_app';
const STATE = '__Host-seokam_state';
const PORTAL = 'https://t.seokam.es.kr';
const cookies = header => Object.fromEntries(String(header || '').split(';').map(v => {
  const i = v.indexOf('='); return i > 0 ? [v.slice(0, i).trim(), v.slice(i + 1).trim()] : ['', ''];
}));

function createPortalGuard({allowNativeAuth = false, app, origin, entry = '/', publicRequest = () => false, health = ['/health'], fetchImpl = globalThis.fetch, portal = PORTAL, secure = true}) {
  if (!app || !origin || !entry.startsWith('/') || entry.startsWith('//')) throw new Error('SSO configuration required');
  const expectedHost = new URL(origin).host;
  const flags = `; Path=/; HttpOnly; SameSite=Lax${secure ? '; Secure' : ''}`;
  const cookieName = secure ? COOKIE : 'seokam_app_test';
  const stateName = secure ? STATE : 'seokam_state_test';
  const clearState = `${stateName}=${flags}; Max-Age=0`;
  const headers = {'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff'};
  const reply = (res, status, body, extra = {}) => { res.writeHead(status, {...headers, ...extra}); res.end(body); return false; };
  const json = (res, status, data, extra) => reply(res, status, JSON.stringify(data), {'Content-Type': 'application/json; charset=utf-8', ...extra});
  const redirect = (res, target, extra) => reply(res, 302, '', {Location: target, ...extra});
  async function remote(path, options = {}) {
    const response = await fetchImpl(portal + path, {...options, redirect: 'error', signal: AbortSignal.timeout(5000)});
    if (response.status === 401) return null;
    if (!response.ok) throw new Error('SSO unavailable');
    return response.json();
  }
  return async function guard(req, res) {
    try {
      const url = new URL(req.url, origin);
      const path = decodeURIComponent(url.pathname);
      if (path.includes("\\") || /(?:^|\/)\.{1,2}(?:\/|$)/.test(path) || /%[0-9a-f]{2}/i.test(path) || /[\u0000-\u001f]/.test(path)) return json(res, 400, {error: "invalid_path"});
      const get = req.method === 'GET' || req.method === 'HEAD';
      if (get && health.includes(path)) return json(res, 200, {ok: true});
      const c = cookies(req.headers.cookie);
      if (path.startsWith('/__portal/')) {
        if (req.headers.host !== expectedHost) return redirect(res, origin + '/__portal/start');
        if (get && path === '/__portal/start') {
          const verifier = randomBytes(32).toString('base64url');
          const challenge = createHash('sha256').update(verifier).digest('base64url');
          return redirect(res, `${portal}/api/teacher/sso/authorize?app=${app}&challenge=${challenge}`, {'Set-Cookie': `${stateName}=${verifier}${flags}; Max-Age=300`});
        }
        if (get && path === '/__portal/callback') {
          if (!c[stateName] || !url.searchParams.get('ticket')) return json(res, 401, {error: 'invalid_sso_state'}, {'Set-Cookie': clearState});
          const result = await remote('/api/teacher/sso/exchange', {method: 'POST', headers: {'Content-Type': 'application/json', 'X-Requested-With': 'fetch'}, body: JSON.stringify({app, ticket: url.searchParams.get('ticket'), verifier: c[stateName]})});
          if (!result?.token) return json(res, 401, {error: 'invalid_sso_ticket'}, {'Set-Cookie': clearState});
          return redirect(res, entry, {'Set-Cookie': [clearState, `${cookieName}=${result.token}${flags}`]});
        }
        return json(res, 404, {error: 'not_found'});
      }
      if (publicRequest(path, req.method)) return true;
      if (allowNativeAuth && !get) {
        const requestOrigin = `${req.headers.host === expectedHost ? 'https' : (req.headers['x-forwarded-proto'] || 'http')}://${req.headers.host}`;
        if ((req.headers.origin && req.headers.origin !== requestOrigin) || req.headers['sec-fetch-site'] === 'cross-site') return json(res, 403, {error: 'invalid_origin'});
      }
      if (allowNativeAuth) res.setHeader('Cache-Control', 'no-store');
      if (allowNativeAuth && !c[cookieName]) return true;
      if (req.headers.host !== expectedHost) {
        if (allowNativeAuth) return true;
        if (get && !/(?:^|\/)api(?:\/|$)/i.test(path)) return redirect(res, origin + entry);
        return json(res, 401, {error: 'portal_login_required'});
      }
      if (!get) {
        if (req.headers.origin && req.headers.origin !== origin) return json(res, 403, {error: 'invalid_origin'});
        if (req.headers['sec-fetch-site'] === 'cross-site') return json(res, 403, {error: 'invalid_origin'});
      }
      const token = c[cookieName];
      const result = token && await remote(`/api/teacher/sso/session?app=${app}`, {headers: {Authorization: `Bearer ${token}`}}).catch(error => {if(allowNativeAuth)return null;throw error;});
      if (!result?.ok || !result.user) {
        const extra = {'Set-Cookie': `${cookieName}=${flags}; Max-Age=0`};
        if (allowNativeAuth) {res.setHeader('Set-Cookie', extra['Set-Cookie']);return true;}
        if (get && String(req.headers.accept || '').includes('text/html')) return redirect(res, '/__portal/start', extra);
        return json(res, 401, {error: 'portal_login_required', login: origin + '/__portal/start'}, extra);
      }
      res.setHeader('Cache-Control', 'no-store');
      req.portalUser = result.user;
      return true;
    } catch {
      return json(res, 503, {error: 'authentication_unavailable'});
    }
  };
}
module.exports = {createPortalGuard};
