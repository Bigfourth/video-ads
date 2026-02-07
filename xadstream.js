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
      .xad-wrap{position:relative;background:#000;overflow:hidden;line-height:0}
      .xad-wrap .video-js{width:100%!important;height:100%!important}

      /* Placeholder giữ chỗ khi sticky */
      .xad-ph{display:none;background:#111;border-radius:8px}
      .xad-ph.is-visible{
        display:flex!important;align-items:center;justify-content:center;
        color:#555;font:500 13px/1 system-ui,sans-serif;cursor:pointer;
      }
      .xad-ph.is-visible:hover{background:#1a1a1a;color:#888}

      /* STICKY */
      .xad-wrap.is-sticky{
        position:fixed!important;
        z-index:2147483647!important;
        border-radius:12px;
        box-shadow:0 8px 32px rgba(0,0,0,.5);
        transition:width .35s cubic-bezier(.4,0,.2,1),
                   height .35s cubic-bezier(.4,0,.2,1),
                   opacity .3s ease;
      }
      .xad-wrap.is-sticky.pos-br{bottom:16px;right:16px}
      .xad-wrap.is-sticky.pos-bl{bottom:16px;left:16px}
      .xad-wrap.is-sticky.pos-tr{top:16px;right:16px}
      .xad-wrap.is-sticky.pos-tl{top:16px;left:16px}

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
    const MAX = 4;
    const BASE = 5000;

    return {
      retry() {
        if (count >= MAX) return;
        const delay = BASE * Math.pow(2, count++);
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

  /* ════════════════════════════════════════════════════════════

     STICKY CONTROLLER

     3 states:
       NORMAL  — wrapper ở vị trí gốc trong DOM flow
       STICKY  — wrapper fixed ở góc (user scroll quá player)
       HIDDEN  — user đã tắt sticky, wrapper ở vị trí gốc
                 (player VẪN PLAY, chỉ user không thấy vì đã scroll qua)

     Transitions:
       NORMAL → STICKY   khi scroll xuống quá player
       STICKY → NORMAL   khi scroll ngược lên thấy player
       STICKY → HIDDEN   khi user nhấn ✕
       HIDDEN → STICKY   khi ad break trigger (forceSticky)
       HIDDEN → NORMAL   khi scroll ngược lên

  ════════════════════════════════════════════════════════════ */

  function createStickyController(wrapper, placeholder, opts) {
    const pos = (opts.position || "bottom-right").replace(/\s+/g, "-").toLowerCase();
    const posClass = "pos-" + ({
      "bottom-right": "br", "bottom-left": "bl",
      "top-right": "tr", "top-left": "tl",
    }[pos] || "br");

    const stickyW = opts.width || 400;
    const stickyH = opts.height || 225;
    const debug = opts.debug || false;

    // State
    let state = "normal"; // "normal" | "sticky" | "hidden"
    let origW = 0;
    let origH = 0;

    // Click placeholder → scroll về player
    placeholder.addEventListener("click", () => {
      placeholder.scrollIntoView({ behavior: "smooth", block: "center" });
    });

    function isOutOfView() {
      const target = state === "normal" ? wrapper : placeholder;
      const rect = target.getBoundingClientRect();
      return rect.bottom < -10 || rect.top > window.innerHeight + 10;
    }

    function enterSticky() {
      if (state === "sticky") return;
      if (debug) console.log("[XAD sticky] → STICKY");

      if (state === "normal") {
        origW = wrapper.offsetWidth;
        origH = wrapper.offsetHeight;
      }

      // Placeholder giữ layout
      placeholder.style.display = "flex";
      placeholder.style.width = origW + "px";
      placeholder.style.height = origH + "px";
      placeholder.classList.add("is-visible");
      placeholder.textContent = "\u2191 Click \u0111\u1EC3 quay l\u1EA1i";

      // Wrapper → fixed corner
      wrapper.style.width = stickyW + "px";
      wrapper.style.height = stickyH + "px";
      wrapper.classList.add("is-sticky", posClass);

      state = "sticky";
    }

    function exitSticky() {
      if (debug) console.log("[XAD sticky] → NORMAL");

      wrapper.classList.remove("is-sticky", posClass);
      wrapper.style.width = "";
      wrapper.style.height = "";

      placeholder.classList.remove("is-visible");
      placeholder.style.display = "none";
      placeholder.textContent = "";

      state = "normal";
    }

    function hideSticky() {
      // User nhấn ✕ — chỉ ẩn sticky, player VẪN PLAY
      if (debug) console.log("[XAD sticky] → HIDDEN (player vẫn play)");

      wrapper.classList.remove("is-sticky", posClass);
      wrapper.style.width = "";
      wrapper.style.height = "";

      // Placeholder vẫn hiện để giữ layout
      state = "hidden";
    }

    /**
     * ★ Force bật lại sticky (gọi từ ad break)
     * Chỉ bật nếu player đang ngoài viewport
     */
    function forceSticky() {
      if (state === "sticky") return; // đã sticky rồi
      if (!isOutOfView()) return; // user đang nhìn thấy player → không cần

      if (debug) console.log("[XAD sticky] ★ FORCE STICKY (ad break)");
      enterSticky();
    }

    // Scroll check
    function check() {
      const outOfView = isOutOfView();

      if (state === "normal" && outOfView) {
        enterSticky();
      } else if (state === "sticky" && !outOfView) {
        exitSticky();
      } else if (state === "hidden" && !outOfView) {
        // User scroll ngược lên nhìn thấy player → reset về normal
        exitSticky(); // cleans placeholder
      }
      // state === "hidden" && outOfView → giữ nguyên, chờ ad break
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

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    setTimeout(check, 300);

    return {
      hideSticky,
      forceSticky,
      getState: () => state,
      destroy() {
        window.removeEventListener("scroll", onScroll);
        window.removeEventListener("resize", onScroll);
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

    /* ── DOM: placeholder → wrapper → el ── */
    const placeholder = document.createElement("div");
    placeholder.className = "xad-ph";

    const wrapper = document.createElement("div");
    wrapper.className = "xad-wrap";

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

    /* ── Player ── */
    const player = window.videojs(videoEl, {
      fluid: true,
      preload: "auto",
      controls: parseBool(el.getAttribute("data-controls"), true),
    });

    /* ── Sticky controller ── */
    let sticky = null;
    if (stickyPos) {
      sticky = createStickyController(wrapper, placeholder, {
        position: stickyPos,
        width: stickyW,
        height: stickyH,
        debug,
      });

      // Badge
      const badge = document.createElement("div");
      badge.className = "xad-badge";
      badge.textContent = "\u25B6 \u0110ang ph\u00E1t";
      wrapper.appendChild(badge);

      // Close = chỉ ẩn sticky, player VẪN PLAY
      if (parseBool(el.getAttribute("data-close"), true)) {
        addCloseBtn(wrapper, () => {
          sticky.hideSticky();
          // Player tiếp tục play bình thường
        });
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

            // ★ Bật lại sticky khi có ad break
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

    // ★ VMAP: IMA tự schedule, nhưng khi ad bắt đầu → forceSticky
    player.on("ads-ad-started", () => {
      retrier.reset();
      if (sticky) sticky.forceSticky();
      if (debug) console.log("[XAD] ad started → forceSticky");
    });

    player.on("adserror", () => {
      if (debug) console.warn("[XAD] ad error → retry");
      player.play().catch(() => {});
      retrier.retry();
    });

    /* ── Kickoff ── */
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

    const W = parseInt(container.getAttribute("data-width") || "640", 10);
    const H = parseInt(container.getAttribute("data-height") || "360", 10);
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
    wrapper.className = "xad-wrap";
    wrapper.style.width = W + "px";
    wrapper.style.height = H + "px";

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
    videoEl.width = W;
    videoEl.height = H;
    wrapper.appendChild(videoEl);

    /* ── Player ── */
    const player = window.videojs(videoEl, {
      controls: false,
      preload: "auto",
      fluid: true,
    });

    player.src({
      src: "https://cdn.pubabc.com/vietnam/Vietnam-4K-Epic-Roadtrip-Nature-landscapes-c.m3u8",
      type: "application/vnd.apple.mpegurl",
    });

    /* ── Sticky controller ── */
    let sticky = null;
    if (stickyPos) {
      sticky = createStickyController(wrapper, placeholder, {
        position: stickyPos,
        width: stickyW,
        height: stickyH,
        debug,
      });

      const badge = document.createElement("div");
      badge.className = "xad-badge";
      badge.textContent = "AD";
      wrapper.appendChild(badge);

      // Close = chỉ ẩn sticky, player VẪN PLAY
      if (closable) {
        addCloseBtn(wrapper, () => {
          sticky.hideSticky();
        });
      }
    }

    /* ── IMA Ads ── */
    let adCount = 0;
    let repeatTimer = null;

    player.ready(() => {
      player.ima({ adTagUrl: freshAdTag(adTag), debug });
      const retrier = createRetrier(player, adTag, debug);

      const kickoff = () => {
        try { player.ima.initializeAdDisplayContainer(); } catch (e) {}
        player.play().catch(() => {
          player.one("click", () => player.play());
        });
      };
      kickoff();

      // ★ Ad bắt đầu → force bật sticky
      player.on("ads-ad-started", () => {
        retrier.reset();
        adCount++;
        if (debug) console.log("[XAD] ad #" + adCount + " started → forceSticky");
        if (sticky) sticky.forceSticky();
      });

      player.on("ads-ad-ended", () => {
        if (debug) console.log("[XAD] ad #" + adCount + " ended");

        if (adRepeat && !useVmap) {
          repeatTimer = setTimeout(() => {
            if (debug) console.log("[XAD] requesting next ad...");
            // ★ Bật sticky trước khi request ad
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
