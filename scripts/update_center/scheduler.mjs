// scripts/update_center/scheduler.mjs
//
// 자동 감시(주기 스캔) + "지금 검사" 버튼이 공유하는 단일 실행기.
//
// 원칙
//   - 절대 겹쳐 돌지 않는다: 실행 중이면 타이머 발화는 건너뛰고 그 사실을 남긴다.
//   - 절대 죽지 않는다: 스캔 실패는 잡아서 last_result 에 기록만 하고 타이머를 유지한다.
//   - 상태(last_scan_at / next_scan_at / last_result / 설정)는 store 의 meta 에 저장되므로
//     Postgres 백엔드에서는 재배포 후에도 남는다.
//
// 설정 우선순위: 런타임 설정(store meta) > 환경변수 UPDATE_CENTER_SCAN_INTERVAL_MIN.
// 환경변수가 0/미설정이고 런타임 설정도 없으면 자동 감시는 꺼진 상태다.

export const SCHEDULE_META_KEY = "schedule_config";
export const SCAN_STATUS_META_KEY = "scan_status";

const MIN_INTERVAL_MIN = 1;
const MAX_INTERVAL_MIN = 7 * 24 * 60; // 7일

export function envIntervalMin() {
  const raw = Number(process.env.UPDATE_CENTER_SCAN_INTERVAL_MIN || 0);
  if (!Number.isFinite(raw) || raw <= 0) return 0;
  return Math.min(Math.max(Math.floor(raw), MIN_INTERVAL_MIN), MAX_INTERVAL_MIN);
}

export function normaliseIntervalMin(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.min(Math.max(Math.floor(n), MIN_INTERVAL_MIN), MAX_INTERVAL_MIN);
}

/**
 * @param {object} deps
 * @param {() => Promise<object>} deps.getStore
 * @param {(opts:{trigger:string}) => Promise<object>} deps.runScan  실제 스캔 실행 함수
 * @param {Function} [deps.log]
 */
export function createScheduler({ getStore, runScan, log = () => {} }) {
  let timer = null;
  let running = false;
  let effective = { enabled: false, interval_min: 0, source: "off" };

  async function loadConfig() {
    const envMin = envIntervalMin();
    let stored = null;
    try {
      const store = await getStore();
      stored = await store.getMeta(SCHEDULE_META_KEY);
    } catch (err) {
      log(`[scheduler] 설정 로드 실패(환경변수 기본값 사용): ${err.message}`);
    }
    if (stored && typeof stored === "object" && typeof stored.enabled === "boolean") {
      const interval = normaliseIntervalMin(stored.interval_min ?? envMin);
      return {
        enabled: Boolean(stored.enabled) && interval > 0,
        interval_min: interval,
        source: "runtime",
        updated_at: stored.updated_at || null,
        actor: stored.actor || null,
      };
    }
    return {
      enabled: envMin > 0,
      interval_min: envMin,
      source: envMin > 0 ? "env" : "off",
      updated_at: null,
      actor: null,
    };
  }

  async function recordStatus(patch) {
    try {
      const store = await getStore();
      const current = (await store.getMeta(SCAN_STATUS_META_KEY)) || {};
      const next = { ...current, ...patch };
      await store.setMeta(SCAN_STATUS_META_KEY, next);
      return next;
    } catch (err) {
      log(`[scheduler] 상태 기록 실패: ${err.message}`);
      return null;
    }
  }

  function clearTimer() {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  }

  function armTimer() {
    clearTimer();
    if (!effective.enabled || effective.interval_min <= 0) return;
    const ms = effective.interval_min * 60 * 1000;
    timer = setInterval(() => {
      runOnce("schedule", {}).catch(() => {
        /* runOnce never rejects; this is belt-and-braces */
      });
    }, ms);
    if (typeof timer.unref === "function") timer.unref();
  }

  /**
   * 한 번 실행. 겹치면 건너뛰고, 실패해도 절대 throw 하지 않는다.
   * @returns {Promise<{ran:boolean, skipped?:boolean, reason?:string, result?:object, error?:string}>}
   */
  async function runOnce(trigger, scanOpts = {}) {
    if (running) {
      log("[scheduler] 이전 스캔이 아직 실행 중 — 이번 주기는 건너뜁니다(겹침 방지).");
      await recordStatus({ last_skipped_at: new Date().toISOString(), last_skip_reason: "overlap" });
      return { ran: false, skipped: true, reason: "overlap" };
    }
    running = true;
    const startedAt = new Date().toISOString();
    try {
      const result = await runScan({ trigger, ...scanOpts });
      const finishedAt = new Date().toISOString();
      const nextAt =
        effective.enabled && effective.interval_min > 0
          ? new Date(Date.now() + effective.interval_min * 60 * 1000).toISOString()
          : null;
      await recordStatus({
        last_scan_at: finishedAt,
        last_scan_started_at: startedAt,
        next_scan_at: nextAt,
        last_trigger: trigger,
        last_result: {
          ok: true,
          summary: result && result.summary ? result.summary : null,
          event_count: result && Array.isArray(result.events) ? result.events.length : 0,
        },
      });
      return { ran: true, result };
    } catch (err) {
      const finishedAt = new Date().toISOString();
      const nextAt =
        effective.enabled && effective.interval_min > 0
          ? new Date(Date.now() + effective.interval_min * 60 * 1000).toISOString()
          : null;
      log(`[scheduler] 스캔 실패(타이머는 유지): ${err.message}`);
      await recordStatus({
        last_scan_at: finishedAt,
        last_scan_started_at: startedAt,
        next_scan_at: nextAt,
        last_trigger: trigger,
        last_result: { ok: false, error: err.message },
      });
      return { ran: true, error: err.message };
    } finally {
      running = false;
    }
  }

  async function start() {
    effective = await loadConfig();
    armTimer();
    if (effective.enabled) {
      const nextAt = new Date(Date.now() + effective.interval_min * 60 * 1000).toISOString();
      await recordStatus({ next_scan_at: nextAt, schedule_source: effective.source });
      log(`[scheduler] 자동 감시 ON — ${effective.interval_min}분 주기 (설정 출처: ${effective.source})`);
    } else {
      await recordStatus({ next_scan_at: null, schedule_source: "off" });
      log("[scheduler] 자동 감시 OFF (UPDATE_CENTER_SCAN_INTERVAL_MIN 미설정/0, 런타임 설정 없음)");
    }
    return effective;
  }

  async function setSchedule({ enabled, interval_min, actor }) {
    const envMin = envIntervalMin();
    const interval = normaliseIntervalMin(interval_min ?? (effective.interval_min || envMin));
    const wantEnabled = Boolean(enabled) && interval > 0;
    const config = {
      enabled: wantEnabled,
      interval_min: interval,
      updated_at: new Date().toISOString(),
      actor: actor || null,
    };
    const store = await getStore();
    await store.setMeta(SCHEDULE_META_KEY, config);
    effective = { ...config, source: "runtime" };
    armTimer();
    const nextAt = effective.enabled ? new Date(Date.now() + effective.interval_min * 60 * 1000).toISOString() : null;
    await recordStatus({ next_scan_at: nextAt, schedule_source: "runtime" });
    log(`[scheduler] 자동 감시 설정 변경 — enabled=${effective.enabled}, interval=${effective.interval_min}분`);
    return effective;
  }

  async function getStatus() {
    let status = {};
    try {
      const store = await getStore();
      status = (await store.getMeta(SCAN_STATUS_META_KEY)) || {};
    } catch {
      status = {};
    }
    return {
      enabled: effective.enabled,
      interval_min: effective.interval_min,
      source: effective.source,
      env_interval_min: envIntervalMin(),
      running,
      timer_armed: Boolean(timer),
      last_scan_at: status.last_scan_at || null,
      next_scan_at: status.next_scan_at || null,
      last_trigger: status.last_trigger || null,
      last_result: status.last_result || null,
      last_skipped_at: status.last_skipped_at || null,
      updated_at: effective.updated_at || null,
      actor: effective.actor || null,
    };
  }

  function stop() {
    clearTimer();
  }

  return { start, stop, runOnce, setSchedule, getStatus, isRunning: () => running };
}
