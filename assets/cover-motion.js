(() => {
  "use strict";

  // Presentation only: existing navigation, authentication, and analysis stay untouched.
  const cover = document.getElementById("appCover");
  const video = cover?.querySelector(".app-cover-video");
  if (!cover || !video) return;

  const authGate = document.getElementById("authGate");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  let playPending = false;
  let rateFrameRequest = null;

  // Source timestamps in the existing 30-second clip. Keep the children,
  // dashboard and return shot at 1x; accelerate only the forward map approach.
  const mapApproach = { start: 6, fullSpeed: 6.65, easeOut: 9, end: 10, rate: 2 };
  const smoothStep = (progress) => progress * progress * (3 - 2 * progress);
  const playbackRateAt = (time) => {
    if (time <= mapApproach.start || time >= mapApproach.end) return 1;
    if (time < mapApproach.fullSpeed) {
      return 1 + (mapApproach.rate - 1)
        * smoothStep((time - mapApproach.start) / (mapApproach.fullSpeed - mapApproach.start));
    }
    if (time > mapApproach.easeOut) {
      return 1 + (mapApproach.rate - 1)
        * smoothStep((mapApproach.end - time) / (mapApproach.end - mapApproach.easeOut));
    }
    return mapApproach.rate;
  };

  const isHidden = (element) => !element
    || element.hidden
    || element.classList.contains("is-hidden")
    || element.getAttribute("aria-hidden") === "true";

  const canAnimate = () => !document.hidden
    && !reducedMotion.matches
    && !isHidden(cover)
    && isHidden(authGate);

  const syncPlaybackRate = () => {
    const nextRate = canAnimate() ? playbackRateAt(video.currentTime) : 1;
    if (Math.abs(video.playbackRate - nextRate) > 0.001) video.playbackRate = nextRate;
  };

  // Decoded-frame updates make the easing smooth without a background timer.
  // timeupdate/seek events below also support browsers without this API.
  const queueRateFrame = () => {
    if (rateFrameRequest !== null || video.paused || !canAnimate()
      || typeof video.requestVideoFrameCallback !== "function") return;
    rateFrameRequest = video.requestVideoFrameCallback(() => {
      rateFrameRequest = null;
      syncPlaybackRate();
      queueRateFrame();
    });
  };

  const stopRateFrames = () => {
    if (rateFrameRequest === null) return;
    video.cancelVideoFrameCallback?.(rateFrameRequest);
    rateFrameRequest = null;
  };

  const showMotion = (visible) => {
    if (video.classList.contains("is-playing") !== visible) {
      video.classList.toggle("is-playing", visible);
    }
  };

  const pauseMotion = () => {
    video.autoplay = false;
    stopRateFrames();
    video.pause();
    video.playbackRate = 1;
    showMotion(false);
  };

  const syncPlayback = () => {
    if (!canAnimate() || video.error) {
      pauseMotion();
      return;
    }

    video.autoplay = true;
    syncPlaybackRate();
    queueRateFrame();
    if (!video.paused || playPending) return;

    playPending = true;
    const playRequest = video.play();
    if (!playRequest?.then) {
      playPending = false;
      return;
    }
    playRequest.then(() => {
      if (!canAnimate()) pauseMotion();
    }).catch(() => {
      // Autoplay or media failures leave the original artwork in place.
      showMotion(false);
    }).finally(() => {
      playPending = false;
    });
  };

  video.muted = true;
  video.defaultMuted = true;
  video.playsInline = true;
  video.loop = true;
  video.defaultPlaybackRate = 1;

  video.addEventListener("canplay", syncPlayback);
  video.addEventListener("playing", () => {
    if (canAnimate()) {
      syncPlaybackRate();
      queueRateFrame();
      showMotion(true);
    }
    else pauseMotion();
  });
  video.addEventListener("timeupdate", syncPlaybackRate);
  video.addEventListener("seeking", syncPlaybackRate);
  video.addEventListener("seeked", syncPlaybackRate);
  video.addEventListener("pause", () => {
    stopRateFrames();
    showMotion(false);
  });
  video.addEventListener("error", pauseMotion);
  video.addEventListener("emptied", () => {
    stopRateFrames();
    showMotion(false);
  });
  document.addEventListener("visibilitychange", syncPlayback);
  window.addEventListener("pagehide", pauseMotion);
  window.addEventListener("pageshow", syncPlayback);
  reducedMotion.addEventListener("change", syncPlayback);
  cover.addEventListener("pointerdown", syncPlayback, { passive: true });

  const visibilityObserver = new MutationObserver(syncPlayback);
  const visibilityOptions = { attributes: true, attributeFilter: ["class", "hidden", "aria-hidden"] };
  visibilityObserver.observe(cover, visibilityOptions);
  if (authGate) visibilityObserver.observe(authGate, visibilityOptions);

  syncPlayback();
})();
