/* Presentation only. No data, analysis, API, storage, or existing app handlers are changed. */
(() => {
  'use strict';
  const cover = document.getElementById('managerCover');
  if (!cover) return;
  const first = cover.querySelector('.manager-cover-film');
  const toggle = cover.querySelector('.manager-cover-motion');
  if (!first || !toggle) return;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  // Two decorative players use the same untouched source. The incoming opening
  // overlaps the outgoing map scene; the large headline at 17.3s stays excluded.
  const loopEnd = 16.8;
  const blendDuration = 1.2;
  const blendStart = loopEnd - blendDuration;
  const lastSafeFrame = loopEnd - .04;
  const second = first.cloneNode(true);
  second.classList.add('manager-cover-film-buffer');
  second.removeAttribute('autoplay');
  second.preload = 'auto';
  first.after(second);
  const videos = [first, second];
  let active = first;
  let standby = second;
  let blend = null;
  let inView = cover.getBoundingClientRect().top < innerHeight;
  let userPaused = false;
  let explicitMotion = false;
  let frame = null;
  let boundaryTimer = null;
  let updating = false;
  const pending = new WeakSet();
  const failed = new WeakSet();
  const smooth = x => x * x * (3 - 2 * x);
  const clamp = x => Math.max(0, Math.min(1, x));
  const rateAt = time => time <= 6 || time >= 10 ? 1
    : time < 6.65 ? 1 + smooth((time - 6) / .65)
      : time > 9 ? 1 + smooth(10 - time) : 2;
  const canPlay = () => inView && !document.hidden && !userPaused
    && (!reduce.matches || explicitMotion) && !active.error;
  const running = () => videos.some(video => !video.paused);
  const shouldPlay = video => canPlay() && !video.error && (video === active
    ? active.currentTime < lastSafeFrame : blend?.incoming === video);
  const setOpacity = (video, value) => {
    const next = String(value);
    if (video.style.opacity !== next) video.style.opacity = next;
  };
  const reflect = () => {
    videos.forEach(video => { video.dataset.coverActive = String(video === active); });
    cover.dataset.coverPhase = blend ? 'blending' : 'playing';
  };
  const label = () => {
    toggle.textContent = active.error ? '영상 연결 확인' : running() ? '영상 일시정지' : '영상 재생';
    toggle.setAttribute('aria-pressed', String(userPaused));
  };
  const cancelWatch = () => {
    if (frame !== null) window.cancelAnimationFrame(frame);
    if (boundaryTimer !== null) window.clearTimeout(boundaryTimer);
    frame = null;
    boundaryTimer = null;
  };
  const pause = () => {
    cancelWatch();
    videos.forEach(video => video.pause());
    label();
  };
  const setRate = video => {
    const next = video === active ? rateAt(video.currentTime) : 1;
    if (Math.abs(video.playbackRate - next) > .001) video.playbackRate = next;
  };
  function abortBlend() {
    if (!blend) return;
    const incoming = blend.incoming;
    setOpacity(incoming, 0);
    incoming.pause();
    incoming.style.zIndex = '-4';
    active.style.zIndex = '-3';
    setOpacity(active, 1);
    blend = null;
    reflect();
  }
  function play(video, retryAbort = true) {
    if (!shouldPlay(video) || !video.paused || pending.has(video)) return;
    pending.add(video);
    let interrupted = false;
    Promise.resolve(video.play()).then(() => {
      // A pending play may resolve after pause, backgrounding or a role swap.
      if (!shouldPlay(video)) video.pause();
    }).catch(error => {
      // Pausing or backgrounding during play() is not a decoder failure.
      // Preserve the blend, and permit one retry if the user already resumed.
      if (error?.name === 'AbortError') { interrupted = true; return; }
      if (!shouldPlay(video)) return;
      if (video === standby) {
        failed.add(video);
        abortBlend();
      }
    }).finally(() => {
      pending.delete(video);
      tick();
      if (interrupted && retryAbort && shouldPlay(video)) play(video, false);
      watch();
      label();
    });
  }
  function beginBlend() {
    if (blend || failed.has(standby) || standby.error || standby.readyState < 2 || standby.seeking) return;
    if (standby.currentTime > .04) {
      standby.currentTime = 0;
      return;
    }
    blend = { outgoing: active, incoming: standby };
    active.style.zIndex = '-4';
    standby.style.zIndex = '-3';
    setOpacity(active, 1);
    setOpacity(standby, 0);
    standby.playbackRate = 1;
    reflect();
    play(standby);
  }
  function finishBlend() {
    const outgoing = active;
    const incoming = blend.incoming;
    // Incoming stays at its current ~1.2s position: only the invisible outgoing
    // player is rewound. Keep a fully opaque layer underneath throughout.
    setOpacity(incoming, 1);
    setOpacity(outgoing, 0);
    active = incoming;
    standby = outgoing;
    blend = null;
    outgoing.pause();
    outgoing.style.zIndex = '-4';
    active.style.zIndex = '-3';
    if (outgoing.readyState > 0) outgoing.currentTime = 0;
    reflect();
  }
  function scheduleBoundary() {
    if (boundaryTimer !== null) window.clearTimeout(boundaryTimer);
    boundaryTimer = null;
    if (!canPlay() || active.paused || active.seeking) return;
    const target = active.currentTime < blendStart ? blendStart : lastSafeFrame;
    boundaryTimer = window.setTimeout(() => {
      boundaryTimer = null;
      tick();
      watch();
    }, Math.max(16, (target - active.currentTime) / active.playbackRate * 1000));
  }
  function tick() {
    if (updating) return;
    updating = true;
    try {
      // Hold the final safe map frame while an incoming decoder is preparing.
      // No rewind is visible during a normal crossfade, even if it buffers.
      if (active.readyState > 0 && active.currentTime >= lastSafeFrame) {
        active.pause();
        if (active.currentTime > lastSafeFrame + .005) active.currentTime = lastSafeFrame;
      }
      if (!canPlay()) { pause(); return; }
      if (blend) {
        const incoming = blend.incoming;
        if (incoming.readyState >= 2 && !incoming.seeking && !incoming.error) {
          const progress = clamp(incoming.currentTime / blendDuration);
          setOpacity(incoming, smooth(progress));
          if (progress >= 1) finishBlend();
        }
      } else if (active.currentTime >= blendStart && !active.seeking) {
        beginBlend();
        if (!blend && (failed.has(standby) || standby.error) && active.currentTime >= lastSafeFrame) {
          // If the optional second decoder is unavailable, retain safe bounded
          // playback instead of displaying the excluded title or freezing forever.
          active.currentTime = 0;
        }
      }
      videos.forEach(setRate);
      label();
      scheduleBoundary();
    } finally {
      updating = false;
    }
  }
  function watch() {
    if (frame !== null || !canPlay() || (!running() && !pending.has(active) && !blend)) return;
    frame = window.requestAnimationFrame(() => {
      frame = null;
      tick();
      watch();
    });
  }
  function sync() {
    tick();
    if (!canPlay()) return pause();
    videos.forEach(video => { if (shouldPlay(video)) play(video); });
    watch();
    label();
  }
  videos.forEach((video, index) => {
    video.muted = true;
    video.defaultMuted = true;
    video.playsInline = true;
    video.loop = false;
    video.dataset.loopEnd = String(loopEnd);
    video.dataset.blendDuration = String(blendDuration);
    video.style.zIndex = index ? '-4' : '-3';
    setOpacity(video, index ? 0 : 1);
    video.setAttribute('aria-hidden', 'true');
    video.tabIndex = -1;
    video.addEventListener('canplay', sync);
    video.addEventListener('loadeddata', sync);
    video.addEventListener('playing', () => {
      if (!shouldPlay(video)) video.pause();
      tick();
      watch();
      label();
    });
    video.addEventListener('pause', label);
    video.addEventListener('timeupdate', tick);
    video.addEventListener('seeking', tick);
    video.addEventListener('seeked', sync);
    video.addEventListener('error', () => {
      failed.add(video);
      if (video === standby) { abortBlend(); sync(); }
      else {
        videos.forEach(player => setOpacity(player, 0));
        toggle.disabled = true;
        pause();
      }
    });
  });
  toggle.addEventListener('click', () => {
    userPaused = running();
    explicitMotion = true;
    sync();
  });
  new IntersectionObserver(entries => {
    inView = entries[0].isIntersecting && entries[0].intersectionRatio > .18;
    sync();
  }, { threshold: [0, .18] }).observe(cover);
  document.addEventListener('visibilitychange', sync);
  window.addEventListener('pagehide', pause);
  window.addEventListener('pageshow', sync);
  reduce.addEventListener('change', () => { explicitMotion = false; sync(); });
  // Existing data-workspace listeners select the app tab. These handlers only scroll.
  cover.querySelectorAll('button[data-workspace]').forEach(button => button.addEventListener('click', () => {
    document.querySelector('.workspace-nav').scrollIntoView({ block: 'start', behavior: reduce.matches ? 'instant' : 'smooth' });
  }));
  cover.querySelector('.manager-cover-scroll').addEventListener('click', event => {
    event.preventDefault();
    document.querySelector('.workspace-nav [data-workspace="explore"]').click();
    document.querySelector('.workspace-nav').scrollIntoView({ block: 'start', behavior: reduce.matches ? 'instant' : 'smooth' });
  });
  reflect();
  label();
  sync();
})();
