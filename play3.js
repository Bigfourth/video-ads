(function () {
  "use strict";

  const CDN = {
    videojs: "https://cdn.jsdelivr.net/npm/video.js/dist/video.min.js",
    videojsCss: "https://cdn.jsdelivr.net/npm/video.js/dist/video-js.min.css",
    contribAds: "https://cdn.jsdelivr.net/npm/videojs-contrib-ads/dist/videojs-contrib-ads.min.js",
    contribAdsCss: "https://cdn.jsdelivr.net/npm/videojs-contrib-ads/dist/videojs-contrib-ads.css",
    ima: "https://cdn.jsdelivr.net/npm/videojs-ima/dist/videojs.ima.min.js",
    imaCss: "https://cdn.jsdelivr.net/npm/videojs-ima/dist/videojs.ima.css",
    gima: "https://imasdk.googleapis.com/js/sdkloader/ima3.js",
  };

  const head = document.head || document.getElementsByTagName("head")[0];

  /* ════════════════  Helpers  ════════════════ */

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      if ([...document.scripts].some((s) => s.src === src)) return resolve();
      const s = document.createElement("script");
      s.src = src; s.async = true;
      s.onload = resolve;
      s.onerror = () => reject(new Error("Failed to load " + src));
      head.appendChild(s);
    });
  }
  function loadCss(href) {
    if ([...document.querySelectorAll('link[rel="stylesheet"]')].some((l) => l.href === href)) return;
    const l = document.createElement("link"); l.rel = "stylesheet"; l.href = href;
    head.appendChild(l);
  }
  function parseBool(v, def = false) {
    if (v == null) return def;
    return ["1", "true", "yes"].includes(String(v).toLowerCase());
  }
  function once(fn) {
    let done = false;
    return (...a) => { if (!done) { done = true; fn(...a); } };
  }
  function isVmapTag(adTag, el) {
    const fmt = (el?.getAttribute("data-ad-format") || "").toLowerCase();
    if (fmt === "vmap") return true;
    try { return new URL(adTag).searchParams.get("output") === "vmap"; } catch (e) { return false; }
  }
  function freshAdTag(adTag) {
    try {
      const url = new URL(adTag);
      url.searchParams.set("correlator", String(Date.now()));
      return url.toString();
    } catch (e) {
      return adTag + (adTag.includes("?") ? "&" : "?") + "correlator=" + Date.now();
    }
  }
  function calcStickySize(baseW, baseH) {
    const ratio   = baseH / baseW;
    const isMobile = window.innerWidth <= 600;
    const maxW = isMobile
      ? Math.round(window.innerWidth * 0.6)
      : Math.min(baseW, window.innerWidth - 24);
    const w = maxW;
    const h = Math.round(w * ratio); 
    return { w, h };
  }

  async function ensureDeps() {
    loadCss(CDN.videojsCss); loadCss(CDN.contribAdsCss); loadCss(CDN.imaCss);
    await loadScript(CDN.gima);
    if (!window.videojs) await loadScript(CDN.videojs);
    if (!window.videojs?.getPlugin?.("ads")) await loadScript(CDN.contribAds);
    if (!window.videojs?.getPlugin?.("ima")) await loadScript(CDN.ima);
  }

  /* ════════════════  Video categories  ════════════════ */

  const CATEGORY_VIDEOS = {
    sport:          "https://cdn.pubabc.com/sport/main.m3u8",
    technology:     "https://cdn.pubabc.com/tech/main.m3u8",
    tech:           "https://cdn.pubabc.com/tech/main.m3u8",
    entertainment:  "https://cdn.pubabc.com/entertainment/main.m3u8",
    travel:         "https://cdn.pubabc.com/travel/main.m3u8",
    nature:         "https://cdn.pubabc.com/natural/main.m3u8",
    vietnam:        "https://cdn.pubabc.com/vietnam/Vietnam-4K-Epic-Roadtrip-Nature-landscapes-c.m3u8",
  };
  const CATEGORY_KEYS = Object.keys(CATEGORY_VIDEOS);

  function resolveVideoSrc(el) {
    const manual = el.getAttribute("data-src");
    if (manual) return manual;
    let cat = (el.getAttribute("data-category") || "").toLowerCase().trim();
    if (cat === "random") cat = CATEGORY_KEYS[Math.floor(Math.random() * CATEGORY_KEYS.length)];
    return CATEGORY_VIDEOS[cat] || CATEGORY_VIDEOS.nature;
  }

  /* ════════════════  CSS  ════════════════ */

  function injectStyles() {
    if (document.getElementById("xad-css")) return;
    const st = document.createElement("style");
    st.id = "xad-css";
    st.textContent = `
      .xad-wrap{
        position:relative;width:100%;height:0;
        padding-top:56.25%;overflow:hidden;background:#000;
      }
      .xad-wrap .video-js{
        position:absolute!important;top:0!important;left:0!important;
        width:100%!important;height:100%!important;
      }
      .xad-wrap .vjs-tech{
        object-fit:cover!important;width:100%!important;height:100%!important;
      }
      .xad-wrap .xad-inner{
        position:absolute;top:0;left:0;width:100%;height:100%;
      }

      /* Outstream */
      .xad-outstream-wrap{min-width:280px;border-radius:0!important;background:transparent!important;}
      .xad-outstream-wrap .video-js{border:none!important;outline:none!important;border-radius:0!important;background:transparent!important;}
      .xad-outstream-wrap .vjs-poster{background-color:transparent!important}
      .xad-outstream-wrap .vjs-text-track-display,.xad-outstream-wrap .vjs-loading-spinner,
      .xad-outstream-wrap .vjs-big-play-button,.xad-outstream-wrap .vjs-control-bar,
      .xad-outstream-wrap .vjs-error-display,.xad-outstream-wrap .vjs-modal-dialog{display:none!important}

      /* Placeholder */
      .xad-ph{
        display:none;background:#111;border-radius:8px;
        align-items:center;justify-content:center;
        color:#555;font:500 13px/1 system-ui,sans-serif;cursor:pointer;
      }
      .xad-ph:hover{background:#1a1a1a;color:#888}

      /* ═══ STICKY ═══ */
      .xad-wrap.is-sticky{
        position:fixed!important;z-index:2147483647!important;
        padding-top:46.25%!important;overflow:visible;
        border-radius:4px;
        box-shadow:0 4px 24px rgba(0,0,0,.7);
        transition:width .3s ease,height .3s ease;
      }
      .xad-wrap.is-sticky .xad-inner,
      .xad-wrap.is-sticky .video-js{
        position:absolute!important;top:0!important;left:0!important;
        width:100%!important;height:100%!important;
      }

      /* Vị trí sticky — dùng CSS variable --xad-b cho bottom offset */
      .xad-wrap.is-sticky.pos-br{bottom:var(--xad-b,250px);right:16px}
      .xad-wrap.is-sticky.pos-bl{bottom:var(--xad-b,250px);left:16px}
      .xad-wrap.is-sticky.pos-tr{top:16px;right:16px}
      .xad-wrap.is-sticky.pos-tl{top:16px;left:16px}
      @media(max-width:600px){
        .xad-wrap.is-sticky.pos-br{bottom:var(--xad-b,80px);right:8px}
        .xad-wrap.is-sticky.pos-bl{bottom:var(--xad-b,80px);left:8px}
      }

      /* Nút X — ngoài khung, góc trên-phải */
      .xad-close{
        position:absolute;
        top:-14px;right:-14px;
        width:26px;height:26px;
        border:none;border-radius:50%;
        background:#111;color:#fff;
        font-size:16px;line-height:26px;text-align:center;
        cursor:pointer;z-index:20;
        opacity:0;pointer-events:none;
        transition:opacity .25s;
        box-shadow:0 2px 6px rgba(0,0,0,.5);
      }
      .xad-wrap.is-sticky .xad-close{opacity:1;pointer-events:auto}
      .xad-close:hover{background:#cc0000}

      /* Brand label — trong khung, góc trên-phải (như AD badge) */
      .xad-brand{
        position:absolute;bottom:8px;right:8px;
        background:rgba(0,0,0,.65);color:#fff;
        font:800 10px/1 system-ui,sans-serif;
        letter-spacing:2px;text-transform:uppercase;
        padding:4px 8px;border-radius:4px;z-index:20;
        opacity:0;pointer-events:none;transition:opacity .25s;
      }
      .xad-wrap.is-sticky .xad-brand{opacity:1}

      /* Badge */
      .xad-badge{
        position:absolute;bottom:8px;left:8px;
        background:rgba(0,0,0,.65);color:#fff;
        font:600 11px/1 system-ui,sans-serif;
        padding:4px 8px;border-radius:4px;z-index:20;
        opacity:0;pointer-events:none;transition:opacity .25s;
      }
      .xad-wrap.is-sticky .xad-badge{opacity:1}
    `;
    head.appendChild(st);
  }

  /* ════════════════  Ad schedule  ════════════════ */

  function buildAdBreaks(breakStr, intervalSec, duration) {
    const breaks = [];
    if (breakStr) {
      breakStr.split(",").forEach((b) => {
        const t = b.trim().toLowerCase();
        if (t === "pre") breaks.push(0);
        else if (t === "post") breaks.push(-1);
        else if (t.endsWith("%") && duration) breaks.push(Math.floor((parseFloat(t) / 100) * duration));
        else if (!isNaN(parseFloat(t))) breaks.push(parseFloat(t));
      });
    }
    if (intervalSec > 0 && duration) {
      for (let t = intervalSec; t < duration; t += intervalSec)
        if (!breaks.includes(t)) breaks.push(t);
    }
    if (!breaks.length) breaks.push(0);
    return breaks.sort((a, b) => a - b);
  }

  /* ════════════════  Retry  ════════════════ */

  function createRetrier(player, baseAdTag, debug) {
    let count = 0, timer = null;
    return {
      retry() {
        if (count >= 4) return;
        const delay = 5000 * Math.pow(2, count++);
        if (debug) console.log("[XAD] retry #" + count + " in " + delay + "ms");
        timer = setTimeout(() => {
          try { player.ima.changeAdTag(freshAdTag(baseAdTag)); player.ima.requestAds(); } catch (e) {}
        }, delay);
      },
      reset() { count = 0; },
      cancel() { if (timer) clearTimeout(timer); },
    };
  }

  /* ════════════════  STICKY CONTROLLER  ════════════════ */

  function createStickyController(wrapper, placeholder, opts) {
    const pos = (opts.position || "bottom-right").replace(/\s+/g, "-").toLowerCase();
    const posClass = "pos-" + ({"bottom-right":"br","bottom-left":"bl","top-right":"tr","top-left":"tl"}[pos] || "br");
    const baseStickyW = opts.width || 400;
    const baseStickyH = opts.height || 225;
    let ratioPct = opts.ratioPct || "46.25%";
    const debug = opts.debug || false;
    let state = "normal";

    placeholder.addEventListener("click", () => {
      placeholder.scrollIntoView({ behavior: "smooth", block: "center" });
    });

    function isOutOfView() {
      const target = state === "sticky" ? placeholder : wrapper;
      const rect = target.getBoundingClientRect();
      return rect.bottom < -10 || rect.top > window.innerHeight + 10;
    }

    function enterSticky() {
      if (state === "sticky") return;
      if (debug) console.log("[XAD sticky] " + state + " → STICKY");
      const origH = wrapper.offsetHeight || wrapper.getBoundingClientRect().height;
      placeholder.style.display = "flex";
      placeholder.style.width = "100%";
      placeholder.style.height = Math.max(origH, 50) + "px";
      placeholder.textContent = "\u2191 Quay l\u1EA1i";
      const { w, h } = calcStickySize(baseStickyW, baseStickyH);
      wrapper.classList.add("is-sticky", posClass);
      wrapper.style.width = w + "px";
      wrapper.style.height = h + "px";
      state = "sticky";
    }

    function exitToNormal() {
      if (debug) console.log("[XAD sticky] " + state + " → NORMAL");
      wrapper.classList.remove("is-sticky", posClass);
      wrapper.style.width = ""; wrapper.style.height = "";
      wrapper.style.paddingTop = ratioPct;
      placeholder.style.display = "none"; placeholder.textContent = "";
      state = "normal";
    }

    function hideSticky() {
      if (debug) console.log("[XAD sticky] " + state + " → HIDDEN");
      wrapper.classList.remove("is-sticky", posClass);
      wrapper.style.width = ""; wrapper.style.height = "";
      wrapper.style.paddingTop = ratioPct;
      placeholder.style.display = "none"; placeholder.textContent = "";
      state = "hidden";
    }

    function forceSticky() {
      if (state === "sticky") return;
      if (!isOutOfView()) return;
      if (debug) console.log("[XAD sticky] ★ FORCE STICKY");
      enterSticky();
    }

    function check() {
      const outOfView = isOutOfView();
      if (state === "normal" && outOfView) enterSticky();
      else if (state === "sticky" && !outOfView) exitToNormal();
      else if (state === "hidden" && !outOfView) exitToNormal();
    }

    let raf = 0;
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(() => { check(); raf = 0; }); };
    const onResize = () => {
      if (state === "sticky") {
        const { w, h } = calcStickySize(baseStickyW, baseStickyH);
        wrapper.style.width = w + "px"; wrapper.style.height = h + "px";
      }
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    window.addEventListener("resize", onResize, { passive: true });
    setTimeout(check, 500);

    return {
      hideSticky, forceSticky,
      getState: () => state,
      updateRatio(pct) { ratioPct = pct; },
      destroy() {
        window.removeEventListener("scroll", onScroll);
        window.removeEventListener("resize", onScroll);
        window.removeEventListener("resize", onResize);
        cancelAnimationFrame(raf);
      },
    };
  }

  /* X ngoài khung góc trên-phải + Brand trong khung góc trên-phải */
  function addTopbar(wrapper, onClose, brand) {
    // Nút X — ngoài khung
    const btn = document.createElement("button");
    btn.className = "xad-close";
    btn.type = "button";
    btn.setAttribute("aria-label", "Close");
    btn.innerHTML = "&#215;";
    btn.addEventListener("click", (e) => { e.stopPropagation(); onClose(); });
    wrapper.appendChild(btn);

    // Brand — trong khung
    if (brand) {
      const lbl = document.createElement("span");
      lbl.className = "xad-brand";
      lbl.textContent = brand;
      wrapper.appendChild(lbl);
    }
  }

  /* ════════════════  INSTREAM  ════════════════ */

  function mountInstream(el) {
    injectStyles();

    const src       = el.getAttribute("data-src");
    const adTag     = el.getAttribute("data-adtag");
    if (!adTag) return console.error("[XAD] data-adtag required");

    const debug       = parseBool(el.getAttribute("data-debug"), false);
    const stickyPos   = el.getAttribute("data-sticky");
    const stickyW     = parseInt(el.getAttribute("data-sticky-width")  || "400", 10);
    const stickyH     = parseInt(el.getAttribute("data-sticky-height") || "225", 10);
    const stickyBottom= el.getAttribute("data-sticky-bottom") || "";
    const brandAttr = el.getAttribute("data-brand");
    const brand = brandAttr === null ? "BIGFOURTH" : brandAttr;
    const adBreakStr  = el.getAttribute("data-ad-breaks");
    const adInterval  = parseInt(el.getAttribute("data-ad-interval") || "0", 10);
    const useVmap     = isVmapTag(adTag, el);
    const ratioW      = parseInt(el.getAttribute("data-width")     || "16", 10);
    const ratioH      = parseInt(el.getAttribute("data-height")    || "9",  10);
    const maxWidth    = parseInt(el.getAttribute("data-max-width") || "0",  10);
    const ratioPct    = ((ratioH / ratioW) * 100).toFixed(4) + "%";

    const placeholder = document.createElement("div");
    placeholder.className = "xad-ph";

    const wrapper = document.createElement("div");
    wrapper.className = "xad-wrap";
    wrapper.style.paddingTop = ratioPct;
    if (maxWidth > 0) wrapper.style.maxWidth = maxWidth + "px";
    if (stickyBottom) wrapper.style.setProperty("--xad-b", stickyBottom);

    const inner = document.createElement("div");
    inner.className = "xad-inner";

    el.parentNode.insertBefore(placeholder, el);
    placeholder.parentNode.insertBefore(wrapper, placeholder);
    wrapper.appendChild(inner);

    const videoEl = document.createElement("video");
    videoEl.classList.add("video-js", "vjs-default-skin");
    videoEl.setAttribute("playsinline", "");
    if (parseBool(el.getAttribute("data-controls"), true)) videoEl.setAttribute("controls", "");
    if (el.getAttribute("data-poster")) videoEl.setAttribute("poster", el.getAttribute("data-poster"));
    if (parseBool(el.getAttribute("data-autoplay"), false)) {
      videoEl.muted = true;
      videoEl.setAttribute("muted", ""); videoEl.setAttribute("autoplay", "");
    }
    inner.appendChild(videoEl);
    el.style.display = "none";

    // Source — data-src > data-category > nature default (cdn.pubabc.com)
    const resolvedSrc = resolveVideoSrc(el);
    if (debug) console.log("[XAD] instream src:", resolvedSrc);
    const source = document.createElement("source");
    source.src = resolvedSrc;
    if (resolvedSrc.includes(".m3u8")) source.type = "application/x-mpegURL";
    else if (resolvedSrc.includes(".mpd")) source.type = "application/dash+xml";
    else if (resolvedSrc.includes(".mp4")) source.type = "video/mp4";
    videoEl.appendChild(source);
    videoEl.setAttribute("crossorigin", "anonymous");

    const player = window.videojs(videoEl, {
      fluid: false, preload: "auto",
      controls: parseBool(el.getAttribute("data-controls"), true),
    });

    let sticky = null;
    if (stickyPos) {
      sticky = createStickyController(wrapper, placeholder, {
        position: stickyPos, width: stickyW, height: stickyH, ratioPct, debug,
      });
      const badge = document.createElement("div");
      badge.className = "xad-badge";
      badge.textContent = "\u25B6 \u0110ang ph\u00E1t";
      wrapper.appendChild(badge);
      if (parseBool(el.getAttribute("data-close"), true)) {
        addTopbar(wrapper, () => sticky.hideSticky(), brand);
      }
    }

    player.ima({ adTagUrl: freshAdTag(adTag), debug });
    const retrier = createRetrier(player, adTag, debug);
    let adSchedule = [];
    const playedBreaks = new Set();

    if (!useVmap) {
      player.on("loadedmetadata", () => {
        adSchedule = buildAdBreaks(adBreakStr, adInterval, player.duration());
        if (debug) console.log("[XAD] VAST breaks:", adSchedule);
      });
      player.on("timeupdate", () => {
        const t = player.currentTime();
        for (const bp of adSchedule) {
          if (bp <= 0 || bp === -1 || playedBreaks.has(bp)) continue;
          if (t >= bp && t < bp + 2) {
            playedBreaks.add(bp);
            if (debug) console.log("[XAD] midroll @", bp);
            if (sticky) sticky.forceSticky();
            try { player.ima.changeAdTag(freshAdTag(adTag)); player.ima.requestAds(); } catch (e) {}
          }
        }
      });
      player.on("ended", () => {
        if (adSchedule.includes(-1) && !playedBreaks.has(-1)) {
          playedBreaks.add(-1);
          if (sticky) sticky.forceSticky();
          try { player.ima.changeAdTag(freshAdTag(adTag)); player.ima.requestAds(); } catch (e) {}
        }
      });
    }

    player.on("ads-ad-started", () => { retrier.reset(); if (sticky) sticky.forceSticky(); });
    player.on("adserror", () => { player.play().catch(() => {}); retrier.retry(); });

    const kickoff = once(() => {
      try { player.ima.initializeAdDisplayContainer(); } catch (e) {}
      try { player.play().catch(() => {}); } catch (e) {}
    });
    if (videoEl.hasAttribute("autoplay")) kickoff();
    else { player.one("click", kickoff); player.one("play", kickoff); }

    return player;
  }

  /* ════════════════  OUTSTREAM  ════════════════ */

  function mountOutstream(container) {
    injectStyles();

    const adTag       = container.getAttribute("data-adtag");
    if (!adTag) return console.error("[XAD] data-adtag required");

    const stickyPos    = container.getAttribute("data-sticky");
    const stickyW      = parseInt(container.getAttribute("data-sticky-width")     || "400", 10);
    const stickyH      = parseInt(container.getAttribute("data-sticky-height")    || "225", 10);
    const stickyBottom = container.getAttribute("data-sticky-bottom") || "";
    const brand        = container.getAttribute("data-brand")         || "BIGFOURTH";
    const closable     = parseBool(container.getAttribute("data-close"),           true);
    const debug        = parseBool(container.getAttribute("data-debug"),           false);
    const adRepeat     = parseBool(container.getAttribute("data-ad-repeat"),       true);
    const adRepeatDelay= parseInt(container.getAttribute("data-ad-repeat-delay")  || "30", 10) * 1000;
    const adRepeatMax  = parseInt(container.getAttribute("data-ad-repeat-max")    || "0",  10);
    const useVmap      = isVmapTag(adTag, container);
    const maxWidth     = parseInt(container.getAttribute("data-max-width")        || "0",  10);

    let ratioPct = "56.25%";

    const placeholder = document.createElement("div");
    placeholder.className = "xad-ph";

    const wrapper = document.createElement("div");
    wrapper.className = "xad-wrap xad-outstream-wrap";
    wrapper.style.paddingTop = ratioPct;
    wrapper.style.minWidth = "270px";
    if (maxWidth > 0) wrapper.style.maxWidth = maxWidth + "px";
    if (stickyBottom) wrapper.style.setProperty("--xad-b", stickyBottom);

    container.innerHTML = "";
    container.appendChild(placeholder);
    container.appendChild(wrapper);

    const videoEl = document.createElement("video");
    videoEl.className = "video-js vjs-default-skin";
    videoEl.setAttribute("playsinline", "");
    videoEl.setAttribute("muted", "");
    videoEl.setAttribute("autoplay", "");
    videoEl.setAttribute("preload", "auto");
    videoEl.setAttribute("crossorigin", "anonymous");
    videoEl.setAttribute("loop", "");
    videoEl.loop = true;
    videoEl.muted = true;
    wrapper.appendChild(videoEl);

    const player = window.videojs(videoEl, { controls: false, preload: "auto", fluid: false, loop: true });

    const videoSrc = resolveVideoSrc(container);
    if (debug) console.log("[XAD] outstream src:", videoSrc);

    const srcObj = { src: videoSrc };
    if (videoSrc.includes(".m3u8")) srcObj.type = "application/x-mpegURL";
    else if (videoSrc.includes(".mpd")) srcObj.type = "application/dash+xml";
    else if (videoSrc.includes(".mp4")) srcObj.type = "video/mp4";
    player.src(srcObj);

    /* ── Sticky ── */
    let sticky = null;
    if (stickyPos) {
      sticky = createStickyController(wrapper, placeholder, {
        position: stickyPos, width: stickyW, height: stickyH, ratioPct, debug,
      });
      const badge = document.createElement("div");
      badge.className = "xad-badge"; badge.textContent = "AD";
      wrapper.appendChild(badge);
      if (closable) {
        addTopbar(wrapper, () => {
          sticky.hideSticky();
          if (debug) console.log("[XAD] sticky closed — ad cycle continues");
        }, brand);
      }
    }

    player.on("loadedmetadata", () => {
      const vw = player.videoWidth(), vh = player.videoHeight();
      if (vw && vh) {
        const ratio = (vh / vw) * 100;
        ratioPct = Math.min(ratio, 56.25).toFixed(4) + "%";
        if (!wrapper.classList.contains("is-sticky")) wrapper.style.paddingTop = ratioPct;
        if (sticky) sticky.updateRatio(ratioPct);
        if (debug) console.log("[XAD] Video ratio:", vw + "x" + vh, "→", ratioPct);
      }
    });

    let _vidErrCount = 0;
    player.on("error", () => {
      player.error(null); // clear error state — quan trọng để IMA tiếp tục
      if (_vidErrCount >= 3) {
        if (debug) console.log("[XAD] bg video: all fallbacks failed, running ad-only");
        return;
      }
      _vidErrCount++;
      const fallbacks = CATEGORY_KEYS.filter(k => k !== "vietnam");
      const nextSrc = CATEGORY_VIDEOS[fallbacks[Math.floor(Math.random() * fallbacks.length)]];
      if (debug) console.log("[XAD] bg video error, fallback #" + _vidErrCount + ":", nextSrc);
      setTimeout(() => {
        player.src({ src: nextSrc, type: "application/x-mpegURL" });
        player.load();
        player.play().catch(() => {});
      }, 1000);
    });

    let adCount = 0, repeatCount = 0, repeatTimer = null;

    function scheduleRepeat() {
      if (!adRepeat) return;
      if (adRepeatMax > 0 && repeatCount >= adRepeatMax) {
        if (debug) console.log("[XAD] repeat max reached (" + adRepeatMax + ")");
        return;
      }
      if (repeatTimer) clearTimeout(repeatTimer);
      if (debug) console.log("[XAD] next ad in " + adRepeatDelay / 1000 + "s");
      repeatTimer = setTimeout(() => {
        repeatCount++;
        if (debug) console.log("[XAD] repeat #" + repeatCount);
        if (sticky) sticky.forceSticky();
        try { player.ima.changeAdTag(freshAdTag(adTag)); player.ima.requestAds(); } catch (e) {}
      }, adRepeatDelay);
    }

    player.ready(() => {
      player.ima({ adTagUrl: freshAdTag(adTag), debug });

      try { player.ima.initializeAdDisplayContainer(); } catch (e) {}
      player.play().catch(() => { player.one("click", () => player.play()); });

      player.on("ads-ad-started", () => {
        adCount++;
        if (debug) console.log("[XAD] ad #" + adCount + " started");
        if (sticky) sticky.forceSticky();
      });

      let _schedAt = 0;
      function trySchedule(evt) {
        const now = Date.now();
        if (now - _schedAt < 1000) return;
        _schedAt = now;
        if (debug) console.log("[XAD]", evt, "→ scheduleRepeat");
        scheduleRepeat();
      }

      player.on("adend",          () => trySchedule("adend"));
      player.on("adskip",         () => trySchedule("adskip"));
      player.on("contentresumed", () => trySchedule("contentresumed"));

      player.on("adserror", () => {
        // 303 no fill → không retry ngay, chờ scheduleRepeat bình thường
        if (debug) console.warn("[XAD] adserror (no fill?) → wait for next schedule");
        player.play().catch(() => {});
        trySchedule("adserror");
      });
    });

    return player;
  }

  /* ════════════════  Mount  ════════════════ */

  async function mountAll(root = document) {
    await ensureDeps();
    root.querySelectorAll(".xad-video,[data-mode='instream']").forEach((el) => {
      try { mountInstream(el); } catch (e) { console.error("[XAD]", e); }
    });
    root.querySelectorAll(".xad-outstream,[data-mode='outstream']").forEach((el) => {
      try { mountOutstream(el); } catch (e) { console.error("[XAD]", e); }
    });
  }

  window.XadPlayer = { mountAll, mountInstream, mountOutstream };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => mountAll().catch(console.error));
  } else {
    mountAll().catch(console.error);
  }
})();
