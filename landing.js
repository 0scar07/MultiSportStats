/* MultiSport Stats — portada.
   Script clásico (IIFE, sin módulos). Todo el contenido ya está en el HTML:
   aquí solo se añaden animaciones e interacción. Cada efecto va aislado en safe(). */
(function () {
  "use strict";

  const data = window.__BRAND__ || {};
  const $ = (sel, scope) => (scope || document).querySelector(sel);
  const $$ = (sel, scope) => Array.from((scope || document).querySelectorAll(sel));
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const fineHover = matchMedia("(hover: hover) and (pointer: fine)").matches;

  function safe(fn, name) {
    try { fn(); } catch (e) { console.warn("[" + name + "]", e); }
  }

  // ---------- Tema (comparte la preferencia con la app) ----------
  function initTheme() {
    const btn = $("[data-theme-toggle]");
    if (!btn) return;
    const paint = () => {
      const dark = document.documentElement.dataset.theme !== "light";
      btn.innerHTML = `<svg class="icon" aria-hidden="true"><use href="#${dark ? "sun" : "moon"}"></use></svg>`;
      btn.setAttribute("aria-label", dark ? "Cambiar a modo claro" : "Cambiar a modo oscuro");
      const meta = $('meta[name="theme-color"]');
      if (meta) meta.content = dark ? "#0b0f17" : "#f4f6fb";
    };
    btn.addEventListener("click", () => {
      const next = document.documentElement.dataset.theme === "light" ? "dark" : "light";
      document.documentElement.dataset.theme = next;
      try { localStorage.setItem("mss.theme", JSON.stringify(next)); } catch (e) { /* sin almacenamiento */ }
      paint();
    });
    paint();
  }

  // ---------- Navegación: sombra, progreso y sección actual ----------
  function initNav() {
    const nav = $(".lp-nav");
    const bar = $(".progress span");
    let ticking = false;
    const update = () => {
      ticking = false;
      const max = document.documentElement.scrollHeight - innerHeight;
      if (bar) bar.style.setProperty("--p", max > 0 ? (scrollY / max).toFixed(4) : 0);
      if (nav) nav.classList.toggle("is-scrolled", scrollY > 8);
    };
    addEventListener("scroll", () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
    update();

    const links = $$(".lp-nav__links a");
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        links.forEach((a) => a.classList.toggle("is-current", a.getAttribute("href") === "#" + e.target.id));
      });
    }, { rootMargin: "-45% 0px -50% 0px", threshold: 0 });
    links.forEach((a) => { const s = $(a.getAttribute("href")); if (s) io.observe(s); });
  }

  // ---------- Revelado al hacer scroll (umbral bajo + red de seguridad) ----------
  function initReveals() {
    const items = $$(".reveal");
    if (!("IntersectionObserver" in window)) { items.forEach((el) => el.classList.add("is-visible")); return; }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) { e.target.classList.add("is-visible"); io.unobserve(e.target); }
      });
    }, { threshold: 0.01, rootMargin: "0px 0px -4% 0px" });
    items.forEach((el) => io.observe(el));
    setTimeout(() => {
      items.forEach((el) => {
        if (!el.classList.contains("is-visible") && el.getBoundingClientRect().top < innerHeight) el.classList.add("is-visible");
      });
    }, 6000);
  }

  // ---------- Hero: degradado que sigue al ratón ----------
  function initGlow() {
    const hero = $("[data-hero]");
    if (!hero || !fineHover) return;
    let raf = null, x = 72, y = 38;
    hero.addEventListener("pointermove", (e) => {
      const r = hero.getBoundingClientRect();
      x = ((e.clientX - r.left) / r.width) * 100;
      y = ((e.clientY - r.top) / r.height) * 100;
      if (!raf) raf = requestAnimationFrame(() => {
        raf = null;
        hero.style.setProperty("--mx", x.toFixed(1) + "%");
        hero.style.setProperty("--my", y.toFixed(1) + "%");
      });
    });
  }

  // ---------- Hero: mockup 3D con inclinación y parallax ----------
  function initStage() {
    const stage = $("[data-stage]");
    const device = $("[data-tilt]", stage || document);
    if (!stage || !device || reduced) return;

    const base = { rx: 9, ry: -14 };
    if (fineHover) {
      const hero = $("[data-hero]");
      hero.addEventListener("pointermove", (e) => {
        const r = stage.getBoundingClientRect();
        const px = (e.clientX - (r.left + r.width / 2)) / r.width;
        const py = (e.clientY - (r.top + r.height / 2)) / r.height;
        device.classList.add("is-live");
        device.style.setProperty("--ry", (base.ry + px * 10).toFixed(2) + "deg");
        device.style.setProperty("--rx", (base.rx - py * 8).toFixed(2) + "deg");
      });
      hero.addEventListener("pointerleave", () => {
        device.classList.remove("is-live");
        device.style.removeProperty("--ry");
        device.style.removeProperty("--rx");
      });
    }

    // Al bajar, el navegador se "endereza" y las piezas flotantes se separan a distinta velocidad.
    const layers = $$("[data-depth]", stage);
    let ticking = false;
    const onScroll = () => {
      ticking = false;
      const y = Math.min(scrollY, innerHeight);
      const k = y / innerHeight;
      if (!device.classList.contains("is-live")) {
        device.style.setProperty("--rx", (base.rx * (1 - k)).toFixed(2) + "deg");
        device.style.setProperty("--ry", (base.ry * (1 - k)).toFixed(2) + "deg");
      }
      device.style.setProperty("--py", (y * -0.06).toFixed(1) + "px");
      layers.forEach((el) => el.style.setProperty("--py", (y * -0.12 * Number(el.dataset.depth || 1)).toFixed(1) + "px"));
    };
    addEventListener("scroll", () => { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }, { passive: true });
    onScroll();
  }

  // ---------- Hero: reloj del marcador flotante ----------
  function initTicker() {
    const el = $("[data-ticker]");
    if (!el || reduced) return;
    let min = 78;
    setInterval(() => {
      if (document.hidden) return;
      min = min >= 90 ? 78 : min + 1;
      el.textContent = min === 90 ? "90+'" : min + "'";
    }, 4000);
  }

  // ---------- Contadores ----------
  function initCounters() {
    const els = $$("[data-count]");
    const run = (el) => {
      const end = Number(el.dataset.count);
      if (reduced || end === 0) { el.textContent = String(end); return; }
      const dur = 1400; const t0 = performance.now();
      const step = (t) => {
        const p = Math.min(1, (t - t0) / dur);
        el.textContent = String(Math.round(end * (1 - Math.pow(1 - p, 3))));
        if (p < 1) requestAnimationFrame(step);
      };
      el.textContent = "0";
      requestAnimationFrame(step);
    };
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) { run(e.target); io.unobserve(e.target); } });
    }, { threshold: 0.01 });
    els.forEach((el) => io.observe(el));
  }

  // ---------- Bento: inclinación suave al pasar el ratón ----------
  function initTiles() {
    if (!fineHover || reduced) return;
    $$("[data-tilt-soft]").forEach((card) => {
      if (card.dataset.tiltBound) return;
      card.dataset.tiltBound = "1";
      const MAX = 4;
      card.addEventListener("pointermove", (e) => {
        const r = card.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width - 0.5;
        const py = (e.clientY - r.top) / r.height - 0.5;
        card.style.setProperty("--rx", (-py * MAX).toFixed(2) + "deg");
        card.style.setProperty("--ry", (px * MAX).toFixed(2) + "deg");
      });
      card.addEventListener("pointerleave", () => {
        card.style.setProperty("--rx", "0deg");
        card.style.setProperty("--ry", "0deg");
      });
    });
  }

  // ---------- En vivo: el scroll avanza el partido ----------
  function initStory() {
    const section = $("[data-story]");
    const board = $("[data-board]");
    const steps = $$("[data-steps] .step");
    if (!section || !board || !steps.length) return;

    const story = data.story || { kickoff: "20:00", events: [] };
    const events = story.events;
    const home = $("[data-home]", board);
    const away = $("[data-away]", board);
    const clock = $("[data-clock]", board);
    const status = $("[data-status]", board);
    const bar = $("[data-bar]", board);
    const rows = $$("[data-events] li", board);
    const BADGES = {
      upcoming: '<span class="badge badge--upcoming">Próximo</span>',
      live: '<span class="badge badge--live">En vivo</span>',
      final: '<span class="badge badge--final">Final</span>',
    };
    let last = { state: "", h: -1, a: -1, step: -1 };

    const setScore = (el, value, prev) => {
      el.textContent = value;
      if (prev >= 0 && value > prev && !reduced) {
        el.classList.remove("flash"); void el.offsetWidth; el.classList.add("flash");
      }
    };

    function render(p) {
      // 0–0.18: previa · 0.18–0.9: partido (0'–90') · >0.9: final
      const state = p < 0.18 ? "upcoming" : p > 0.9 ? "final" : "live";
      const minute = state === "upcoming" ? 0 : state === "final" ? 90 : Math.max(1, Math.round(((p - 0.18) / 0.72) * 90));
      const h = events.filter((e) => e.type === "goal" && e.side === "home" && e.min <= minute).length;
      const a = events.filter((e) => e.type === "goal" && e.side === "away" && e.min <= minute).length;

      if (state !== last.state) {
        board.dataset.state = state;
        status.innerHTML = BADGES[state];
      }
      clock.textContent = state === "upcoming" ? `Hoy · ${story.kickoff}` : state === "final" ? "Final" : `${minute}'`;
      if (state === "upcoming") { home.textContent = "0"; away.textContent = "0"; }
      else { setScore(home, h, last.h); setScore(away, a, last.a); }
      bar.style.setProperty("--m", (minute / 90).toFixed(3));
      rows.forEach((li) => li.classList.toggle("is-off", Number(li.dataset.min) > minute));

      const step = Math.min(steps.length - 1, Math.floor(p * steps.length));
      if (step !== last.step) steps.forEach((s, i) => s.classList.toggle("is-active", i === step));
      last = { state, h: state === "upcoming" ? -1 : h, a: state === "upcoming" ? -1 : a, step };
    }

    const list = $("[data-steps]");
    if (window.gsap && window.ScrollTrigger) {
      gsap.registerPlugin(ScrollTrigger);
      ScrollTrigger.create({
        trigger: list, start: "top 65%", end: "bottom 60%",
        onUpdate: (self) => render(self.progress),
        onRefresh: (self) => render(self.progress),
      });
    } else {
      // Respaldo sin GSAP: mismo cálculo con el scroll nativo.
      let ticking = false;
      const update = () => {
        ticking = false;
        const r = list.getBoundingClientRect();
        const start = innerHeight * 0.65, end = innerHeight * 0.6;
        const total = r.height - (start - end);
        render(Math.min(1, Math.max(0, (start - r.top) / total)));
      };
      addEventListener("scroll", () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
      update();
    }
  }

  // ---------- Galería: flechas y visor ----------
  function initGallery() {
    const track = $("[data-gallery]");
    if (!track) return;
    const by = (dir) => {
      const shot = $(".shot", track);
      const w = shot ? shot.getBoundingClientRect().width + 16 : 400;
      track.scrollBy({ left: dir * w, behavior: reduced ? "auto" : "smooth" });
    };
    $("[data-gallery-prev]")?.addEventListener("click", () => by(-1));
    $("[data-gallery-next]")?.addEventListener("click", () => by(1));

    const box = $("[data-lightbox]");
    const img = $("[data-lightbox-img]");
    if (!box || !img || typeof box.showModal !== "function") return;
    track.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-full]");
      if (!btn) return;
      const thumb = $("img", btn);
      img.src = btn.dataset.full;
      img.alt = thumb ? thumb.alt : "";
      box.setAttribute("aria-label", thumb ? thumb.alt : "Captura ampliada");
      box.showModal();
    });
    box.addEventListener("click", (e) => {
      if (e.target === box || e.target.closest("[data-lightbox-close]")) box.close();
    });
  }

  function boot() {
    safe(initTheme, "initTheme");
    safe(initNav, "initNav");
    safe(initReveals, "initReveals");
    safe(initGlow, "initGlow");
    safe(initStage, "initStage");
    safe(initTicker, "initTicker");
    safe(initCounters, "initCounters");
    safe(initTiles, "initTiles");
    safe(initStory, "initStory");
    safe(initGallery, "initGallery");
    document.documentElement.classList.add("is-ready");
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
