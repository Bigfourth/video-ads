(function () {
  "use strict";

  const CDN = {
    videojs: "https://cdn.jsdelivr.net/npm/video.js/dist/video.min.js",
    videojsCss: "https://cdn.jsdelivr.net/npm/video.js/dist/video-js.min.css",
    contribAds:
      "https://cdn.jsdelivr.net/npm/videojs-contrib-ads/dist/videojs-contrib-ads.min.js",
    contribAdsCss:
      "https://cdn.jsdelivr.net/npm/videojs-contrib-ads/dist/videojs-contrib-ads.css",
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
      s.src = src;
      s.async = true;
      s.onload = resolve;
      s.onerror = () => reject(new Error("Failed to load " + src));
      head.appendChild(s);
    });
  }

  function loadCss(href) {
    if (
      [...document.querySelectorAll('link[rel="stylesheet"]')].some(
        (l) => l.href === href
      )
    )
      return;
    const l = document.createElement("link");
    l.rel = "stylesheet";
    l.href = href;
    head.appendChild(l);
  }

  function parseBool(v, def = false) {
    if (v == null) return def;
    return ["1", "true", "yes"].includes(String(v).toLowerCase());
  }

  function once(fn) {
    let done = false;
    return (...a) => {
      if (!done) {
        done = true;
        fn(...a);
      }
    };
  }

  function isVmapTag(adTag, el) {
    const fmt = (el?.getAttribute("data-ad-format") || "").toLowerCase();
    if (fmt === "vmap") return true;
    try {
      return new URL(adTag).searchParams.get("output") === "vmap";
    } catch (e) {
      return false;
    }
  }

  function freshAdTag(adTag) {
    try {
      const url = new URL(adTag);
      url.searchParams.set("correlator", String(Date.now()));
      return url.toString();
    } catch (e) {
      const sep = adTag.includes("?") ? "&" : "?";
      return adTag + sep + "correlator=" + Date.now();
    }
  }

  /** Sticky size responsive: clamp vào viewport */
  function calcStickySize(baseW, baseH) {
    const maxW = window.innerWidth - 24; // 12px mỗi bên
    const w = Math.min(baseW, maxW);
    const h = Math.round(w * (baseH / baseW));
    return { w, h };
  }

  async function ensureDeps() {
    loadCss(CDN.videojsCss);
    loadCss(CDN.contribAdsCss);
    loadCss(CDN.imaCss);
    await loadScript(CDN.gima);
    if (!window.videojs) await loadScript(CDN.videojs);
    if (!window.videojs?.getPlugin?.("ads")) await loadScript(CDN.contribAds);
    if (!window.videojs?.getPlugin?.("ima")) await loadScript(CDN.ima);
  }

  /* ════════════════  CSS  ════════════════ */

  function injectStyles() {
    if (document.getElementById("xad-css")) return;
    const st = document.createElement("style");
    st.id = "xad-css";
    st.textContent = `
      /*
       * Responsive wrapper dùng padding-top trick (tương thích mọi browser).
       * width:100% → tự co giãn theo container cha.
       * padding-top:56.25% (default 16:9) → tạo chiều cao tỷ lệ.
       * Tất cả nội dung bên trong đều position:absolute.
       */
      .xad-wrap{
        position:relative;
        width:100%;
        height:0;
        overflow:hidden;
        background:#000;
      }

      /* Video.js fill toàn bộ wrapper */
      .xad-wrap>.video-js{
        position:absolute!important;
        top:0!important;left:0!important;
        width:100%!important;height:100%!important;
      }
      .xad-wrap .vjs-tech{
        object-fit:contain;
      }

      /* Placeholder giữ chỗ khi sticky */
      .xad-ph{
        display:none;
        background:#111;
        border-radius:8px;
        align-items:center;
        justify-content:center;
        color:#555;
        font:500 13px/1 system-ui,sans-serif;
        cursor:pointer;
      }
      .xad-ph:hover{background:#1a1a1a;color:#888}

      /* ===== STICKY ===== */
      .xad-wrap.is-sticky{
        position:fixed!important;
        z-index:2147483647!important;
        width:auto!important;
        height:auto!important;
        padding-top:0!important;
        border-radius:12px;
        box-shadow:0 8px 32px rgba(0,0,0,.5);
        transition:width .3s ease, height .3s ease;
      }
      .xad-wrap.is-sticky>.video-js{
        position:relative!important;
        width:100%!important;
        height:100%!important;
      }
      .xad-wrap.is-sticky.pos-br{bottom:12px;right:12px}
      .xad-wrap.is-sticky.pos-bl{bottom:12px;left:12px}
      .xad-wrap.is-sticky.pos-tr{top:12px;right:12px}
      .xad-wrap.is-sticky.pos-tl{top:12px;left:12px}
      @media(max-width:480px){
        .xad-wrap.is-sticky.pos-br{bottom:8px;right:8px}
        .xad-wrap.is-sticky.pos-bl{bottom:8px;left:8px}
        .xad-wrap.is-sticky.pos-tr{top:8px;right:8px}
        .xad-wrap.is-sticky.pos-tl{top:8px;left:8px}
      }

      /* Close btn — chỉ hiện khi sticky */
      .xad-close{
        position:absolute;top:6px;right:6px;
        width:28px;height:28px;border:none;border-radius:50%;
        background:rgba(0,0,0,.7);color:#fff;font-size:18px;
        line-height:28px;text-align:center;cursor:pointer;
        z-index:20;opacity:0;pointer-events:none;
        transition:opacity .25s;
      }
      .xad-wrap.is-sticky .xad-close{opacity:1;pointer-events:auto}
      .xad-close:hover{background:rgba(255,255,255,.25)}

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

  /* ════════════════  Ad schedule (VAST)  ════════════════ */

  function buildAdBreaks(breakStr, intervalSec, duration) {
    const breaks = [];
    if (breakStr) {
      breakStr.split(",").forEach((b) => {
        const t = b.trim().toLowerCase();
        if (t === "pre") breaks.push(0);
        else if (t === "post") breaks.push(-1);
        else if (t.endsWith("%") && duration)
          breaks.push(Math.floor((parseFloat(t) / 100) * duration));
        else if (!isNaN(parseFloat(t))) breaks.push(parseFloat(t));
      });
    }
    if (intervalSec > 0 && duration) {
      for (let t = intervalSec; t < duration; t += intervalSec) {
        if (!breaks.includes(t)) breaks.push(t);
      }
    }
    if (!breaks.length) breaks.push(0);
    return breaks.sort((a, b) => a - b);
  }

  /* ════════════════  Retry backoff  ════════════════ */

  function createRetrier(player, baseAdTag, debug) {
    let count = 0;
    let timer = null;
    return {
      retry() {
        if (count >= 4) return;
        const delay = 5000 * Math.pow(2, count++);
        if (debug) console.log("[XAD] retry #" + count + " in " + delay + "ms");
        timer = setTimeout(() => {
          try {
            player.ima.changeAdTag(freshAdTag(baseAdTag));
            player.ima.requestAds();
          } catch (e) {}
        }, delay);
      },
      reset() { count = 0; },
      cancel() { if (timer) clearTimeout(timer); },
    };
  }

  /* ════════════════════════════════════════════════════════

     STICKY CONTROLLER — Fixed bugs

     3 states:
       NORMAL  — wrapper trong DOM flow, placeholder ẩn
       STICKY  — wrapper position:fixed ở góc, placeholder hiện giữ chỗ
       HIDDEN  — wrapper trong DOM flow (giống normal), placeholder ẩn
                 (player VẪN PLAY, user không thấy vì đã scroll qua)

     isOutOfView:
       NORMAL  → check wrapper  (nó đang ở flow)
       STICKY  → check placeholder  (nó giữ chỗ ở flow)
       HIDDEN  → check wrapper  (nó đang ở flow, giống normal)

     Chuyển state:
       NORMAL → STICKY     scroll xuống quá player
       STICKY → NORMAL     scroll ngược lên thấy player
       STICKY → HIDDEN     user nhấn ✕ (wrapper về flow, placeholder ẩn)
       HIDDEN → STICKY     ad break gọi forceSticky()
       HIDDEN → NORMAL     scroll ngược lên thấy wrapper

  ════════════════════════════════════════════════════════ */

  function createStickyController(wrapper, placeholder, opts) {
    const pos = (opts.position || "bottom-right").replace(/\s+/g, "-").toLowerCase();
    const posClass = "pos-" + ({
      "bottom-right": "br", "bottom-left": "bl",
      "top-right": "tr", "top-left": "tl",
    }[pos] || "br");

    const baseStickyW = opts.width || 400;
    const baseStickyH = opts.height || 225;
    const ratioPct = opts.ratioPct || "56.25%";
    const debug = opts.debug || false;

    let state = "normal";

    placeholder.addEventListener("click", () => {
      placeholder.scrollIntoView({ behavior: "smooth", block: "center" });
    });

    /**
     * FIX BUG 2: check đúng target theo state
     *   STICKY → check placeholder (wrapper đang fixed, không ở flow)
     *   NORMAL / HIDDEN → check wrapper (nó đang ở flow)
     */
    function isOutOfView() {
      const target = state === "sticky" ? placeholder : wrapper;
      const rect = target.getBoundingClientRect();
      return rect.bottom < -10 || rect.top > window.innerHeight + 10;
    }

    function enterSticky() {
      if (state === "sticky") return;
      if (debug) console.log("[XAD sticky] " + state + " → STICKY");

      // Lưu kích thước gốc cho placeholder
      const origH = wrapper.offsetHeight || wrapper.getBoundingClientRect().height;

      // Hiện placeholder giữ layout
      placeholder.style.display = "flex";
      placeholder.style.width = "100%";
      placeholder.style.height = Math.max(origH, 50) + "px";
      placeholder.textContent = "\u2191 Quay l\u1EA1i";

      // Wrapper → fixed ở góc, kích thước responsive
      const { w, h } = calcStickySize(baseStickyW, baseStickyH);
      wrapper.classList.add("is-sticky", posClass);
      wrapper.style.width = w + "px";
      wrapper.style.height = h + "px";

      state = "sticky";
    }

    function exitToNormal() {
      if (debug) console.log("[XAD sticky] " + state + " → NORMAL");

      // Wrapper về flow
      wrapper.classList.remove("is-sticky", posClass);
      wrapper.style.width = "";
      wrapper.style.height = "";
      wrapper.style.paddingTop = ratioPct;

      // Ẩn placeholder
      placeholder.style.display = "none";
      placeholder.textContent = "";

      state = "normal";
    }

    /**
     * FIX BUG 1: hideSticky ẩn placeholder + wrapper về flow
     * Khác với exitToNormal: state = "hidden" (chờ ad break bật lại)
     */
    function hideSticky() {
      if (debug) console.log("[XAD sticky] " + state + " → HIDDEN");

      // Wrapper về flow
      wrapper.classList.remove("is-sticky", posClass);
      wrapper.style.width = "";
      wrapper.style.height = "";
      wrapper.style.paddingTop = ratioPct;

      // ẨN placeholder (wrapper đã về flow, không cần giữ chỗ)
      placeholder.style.display = "none";
      placeholder.textContent = "";

      state = "hidden";
    }

    function forceSticky() {
      if (state === "sticky") return;
      if (!isOutOfView()) return; // user đang nhìn thấy player → không cần
      if (debug) console.log("[XAD sticky] ★ FORCE STICKY (ad break)");
      enterSticky();
    }

    function check() {
      const outOfView = isOutOfView();

      if (state === "normal" && outOfView) {
        enterSticky();
      } else if (state === "sticky" && !outOfView) {
        exitToNormal();
      } else if (state === "hidden" && !outOfView) {
        // User scroll ngược lên thấy wrapper → reset về normal
        exitToNormal();
      }
      // hidden && outOfView → giữ nguyên, chờ forceSticky
    }

    let raf = 0;
    const onScroll = () => {
      if (!raf) {
        raf = requestAnimationFrame(() => {
          check();
          raf = 0;
        });
      }
    };

    const onResize = () => {
      if (state === "sticky") {
        const { w, h } = calcStickySize(baseStickyW, baseStickyH);
        wrapper.style.width = w + "px";
        wrapper.style.height = h + "px";
      }
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    window.addEventListener("resize", onResize, { passive: true });
    setTimeout(check, 500);

    return {
      hideSticky,
      forceSticky,
      getState: () => state,
      destroy() {
        window.removeEventListener("scroll", onScroll);
        window.removeEventListener("resize", onScroll);
        window.removeEventListener("resize", onResize);
        cancelAnimationFrame(raf);
      },
    };
  }

  /* ════════════════  Close button  ════════════════ */

  function addCloseBtn(wrapper, onClick) {
    const btn = document.createElement("button");
    btn.className = "xad-close";
    btn.type = "button";
    btn.setAttribute("aria-label", "Close");
    btn.innerHTML = "&#215;";
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      onClick();
    });
    wrapper.appendChild(btn);
  }

  /* ════════════════  Setup wrapper responsive  ════════════════ */

  /**
   * FIX BUG 3: Dùng padding-top trick thay vì CSS aspect-ratio.
   * Tương thích 100% browser. Video.js bên trong dùng position:absolute.
   */
  function setupResponsiveWrapper(wrapper, ratioW, ratioH, maxWidth) {
    const pct = ((ratioH / ratioW) * 100).toFixed(4) + "%";
    wrapper.className = "xad-wrap";
    wrapper.style.paddingTop = pct;
    if (maxWidth > 0) wrapper.style.maxWidth = maxWidth + "px";
    return pct;
  }

  /* ════════════════  INSTREAM  ════════════════ */

  function mountInstream(el) {
    injectStyles();

    const src = el.getAttribute("data-src");
    const adTag = el.getAttribute("data-adtag");
    if (!adTag) return console.error("[XAD] data-adtag required");

    const debug = parseBool(el.getAttribute("data-debug"), false);
    const stickyPos = el.getAttribute("data-sticky");
    const stickyW = parseInt(el.getAttribute("data-sticky-width") || "400", 10);
    const stickyH = parseInt(el.getAttribute("data-sticky-height") || "225", 10);
    const adBreakStr = el.getAttribute("data-ad-breaks");
    const adInterval = parseInt(el.getAttribute("data-ad-interval") || "0", 10);
    const useVmap = isVmapTag(adTag, el);
    const ratioW = parseInt(el.getAttribute("data-width") || "16", 10);
    const ratioH = parseInt(el.getAttribute("data-height") || "9", 10);
    const maxWidth = parseInt(el.getAttribute("data-max-width") || "0", 10);

    /* ── DOM ── */
    const placeholder = document.createElement("div");
    placeholder.className = "xad-ph";

    const wrapper = document.createElement("div");
    const ratioPct = setupResponsiveWrapper(wrapper, ratioW, ratioH, maxWidth);

    el.parentNode.insertBefore(placeholder, el);
    placeholder.parentNode.insertBefore(wrapper, placeholder);
    wrapper.appendChild(el);

    let videoEl = el;
    if (el.tagName.toLowerCase() !== "video") {
      videoEl = document.createElement("video");
      el.appendChild(videoEl);
    }
    videoEl.classList.add("video-js", "vjs-default-skin");
    videoEl.setAttribute("playsinline", "");
    if (parseBool(el.getAttribute("data-controls"), true))
      videoEl.setAttribute("controls", "");
    if (el.getAttribute("data-poster"))
      videoEl.setAttribute("poster", el.getAttribute("data-poster"));
    if (parseBool(el.getAttribute("data-autoplay"), false)) {
      videoEl.muted = true;
      videoEl.setAttribute("muted", "");
      videoEl.setAttribute("autoplay", "");
    }
    if (src) {
      const source = document.createElement("source");
      source.src = src;
      if (src.includes(".m3u8")) source.type = "application/x-mpegURL";
      else if (src.includes(".mpd")) source.type = "application/dash+xml";
      else if (src.includes(".mp4")) source.type = "video/mp4";
      videoEl.appendChild(source);
    }

    const player = window.videojs(videoEl, {
      fluid: false,
      fill: true,
      preload: "auto",
      controls: parseBool(el.getAttribute("data-controls"), true),
    });

    /* ── Sticky ── */
    let sticky = null;
    if (stickyPos) {
      sticky = createStickyController(wrapper, placeholder, {
        position: stickyPos,
        width: stickyW,
        height: stickyH,
        ratioPct,
        debug,
      });

      const badge = document.createElement("div");
      badge.className = "xad-badge";
      badge.textContent = "\u25B6 \u0110ang ph\u00E1t";
      wrapper.appendChild(badge);

      if (parseBool(el.getAttribute("data-close"), true)) {
        addCloseBtn(wrapper, () => sticky.hideSticky());
      }
    }

    /* ── IMA Ads ── */
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
            try {
              player.ima.changeAdTag(freshAdTag(adTag));
              player.ima.requestAds();
            } catch (e) {}
          }
        }
      });
      player.on("ended", () => {
        if (adSchedule.includes(-1) && !playedBreaks.has(-1)) {
          playedBreaks.add(-1);
          if (sticky) sticky.forceSticky();
          try {
            player.ima.changeAdTag(freshAdTag(adTag));
            player.ima.requestAds();
          } catch (e) {}
        }
      });
    }

    player.on("ads-ad-started", () => {
      retrier.reset();
      if (sticky) sticky.forceSticky();
    });
    player.on("adserror", () => {
      player.play().catch(() => {});
      retrier.retry();
    });

    const kickoff = once(() => {
      try { player.ima.initializeAdDisplayContainer(); } catch (e) {}
      try { player.play().catch(() => {}); } catch (e) {}
    });
    if (videoEl.hasAttribute("autoplay")) kickoff();
    else {
      player.one("click", kickoff);
      player.one("play", kickoff);
    }

    return player;
  }

  /* ════════════════  OUTSTREAM  ════════════════ */

  function mountOutstream(container) {
    injectStyles();

    const adTag = container.getAttribute("data-adtag");
    if (!adTag) return console.error("[XAD] data-adtag required");

    const ratioW = parseInt(container.getAttribute("data-width") || "16", 10);
    const ratioH = parseInt(container.getAttribute("data-height") || "9", 10);
    const maxWidth = parseInt(container.getAttribute("data-max-width") || "0", 10);
    const stickyPos = container.getAttribute("data-sticky");
    const stickyW = parseInt(container.getAttribute("data-sticky-width") || "400", 10);
    const stickyH = parseInt(container.getAttribute("data-sticky-height") || "225", 10);
    const closable = parseBool(container.getAttribute("data-close"), true);
    const debug = parseBool(container.getAttribute("data-debug"), false);
    const adRepeat = parseBool(container.getAttribute("data-ad-repeat"), true);
    const adRepeatDelay =
      parseInt(container.getAttribute("data-ad-repeat-delay") || "30", 10) * 1000;
    const useVmap = isVmapTag(adTag, container);

    /* ── DOM ── */
    const placeholder = document.createElement("div");
    placeholder.className = "xad-ph";

    const wrapper = document.createElement("div");
    const ratioPct = setupResponsiveWrapper(wrapper, ratioW, ratioH, maxWidth);

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
    videoEl.muted = true;
    wrapper.appendChild(videoEl);

    const player = window.videojs(videoEl, {
      controls: false,
      preload: "auto",
      fluid: false,
      fill: true,
    });

    player.src({
      src: "https://cdn.pubabc.com/vietnam/Vietnam-4K-Epic-Roadtrip-Nature-landscapes-c.m3u8",
      type: "application/vnd.apple.mpegurl",
    });

    /* ── Sticky ── */
    let sticky = null;
    if (stickyPos) {
      sticky = createStickyController(wrapper, placeholder, {
        position: stickyPos,
        width: stickyW,
        height: stickyH,
        ratioPct,
        debug,
      });

      const badge = document.createElement("div");
      badge.className = "xad-badge";
      badge.textContent = "AD";
      wrapper.appendChild(badge);

      if (closable) {
        addCloseBtn(wrapper, () => sticky.hideSticky());
      }
    }

    /* ── IMA Ads ── */
    let adCount = 0;
    let repeatTimer = null;

    player.ready(() => {
      player.ima({ adTagUrl: freshAdTag(adTag), debug });
      const retrier = createRetrier(player, adTag, debug);

      (() => {
        try { player.ima.initializeAdDisplayContainer(); } catch (e) {}
        player.play().catch(() => {
          player.one("click", () => player.play());
        });
      })();

      player.on("ads-ad-started", () => {
        retrier.reset();
        adCount++;
        if (debug) console.log("[XAD] ad #" + adCount + " started");
        if (sticky) sticky.forceSticky();
      });

      player.on("ads-ad-ended", () => {
        if (debug) console.log("[XAD] ad #" + adCount + " ended");
        if (adRepeat && !useVmap) {
          repeatTimer = setTimeout(() => {
            if (sticky) sticky.forceSticky();
            try {
              player.ima.changeAdTag(freshAdTag(adTag));
              player.ima.requestAds();
            } catch (e) {}
          }, adRepeatDelay);
        }
      });

      player.on("ads-allpods-completed", () => {
        if (adRepeat && useVmap) {
          repeatTimer = setTimeout(() => {
            if (sticky) sticky.forceSticky();
            try {
              player.ima.changeAdTag(freshAdTag(adTag));
              player.ima.requestAds();
            } catch (e) {}
          }, adRepeatDelay);
        }
      });

      player.on("adserror", () => {
        if (debug) console.warn("[XAD] ad error → retry");
        player.play().catch(() => {});
        retrier.retry();
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
