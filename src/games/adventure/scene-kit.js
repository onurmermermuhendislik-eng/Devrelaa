// V8.5 ORTAK SAHNE ARAC KUTUSU (macera platformu): sinematik/kesif/oyun sahnelerinin hepsinin ihtiyac duydugu kucuk, DOM'suz ortak parcalar.
// Sahne = index.js'in MOUNT tablosuna kayitli `mountXxx(host, args)` -> { destroy, skip?, state? }. Yeni bolum (Orman, Mahalle, Atolye ...) bu araclari
// kullanir: zamanlayici temizligi, ses/maskot hatalarini yutma, konusma/ortam sesi yasam dongusu, arka plana gecince susma, bosta kalan cocuga ipucu.
// Yeni bir bolumun adimlari: docs -> V8.5-DEV/MACERA-PLATFORMU.md
export const reducedMotion = () => {
  try {
    return !!globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
};

export function createSceneRuntime({ audio = null, mascot = null, voice = null, speak = null, ambience = null, music = null } = {}) {
  const timers = new Set();
  let dead = false;
  const safe = (fn) => {
    try {
      return fn();
    } catch {
      /* ses/maskot/animasyon hatasi sahneyi bozmaz */
      return undefined;
    }
  };
  const later = (fn, ms) => {
    const t = setTimeout(() => {
      timers.delete(t);
      if (!dead) safe(fn);
    }, ms);
    timers.add(t);
    return t;
  };
  const clearTimers = () => {
    timers.forEach(clearTimeout);
    timers.clear();
  };
  // Uygulama arka plana alinirsa konusma DURUR (geri donunce yeniden baslamaz); ortam sesini ambience kendisi yonetir
  const onVis = () => {
    if (globalThis.document?.visibilityState === 'hidden') safe(() => voice?.stop());
  };
  globalThis.document?.addEventListener?.('visibilitychange', onVis);
  return {
    safe,
    later,
    clearTimers,
    play: (name) => safe(() => audio?.play(name)),
    react: (kind, msg) => safe(() => mascot?.react(kind, msg)),
    // yazi + sesli okuma (ses kapaliysa speak sessizdir)
    // prio: 1 = onemli yonerge (varsayilan), 2 = geri bildirim/sohbet (aktif onemli yonergeyi KESMEZ)
    say(el, text, prio = 1) {
      if (!text) return;
      if (el) el.textContent = text;
      safe(() => speak?.(text, prio));
    },
    ambience: (scene) => safe(() => ambience?.play(scene)),
    // Sahne sesi: { music, ambience } -> muzik parcasi (ayni parca yeniden baslamaz, farkli parca capraz solar) + ortam sesi (null = sustur)
    scene(sp) {
      if (!sp) return;
      safe(() => (sp.music ? music?.play(sp.music) : undefined));
      safe(() => (sp.ambience ? ambience?.play(sp.ambience) : ambience?.stop()));
    },
    get dead() {
      return dead;
    },
    destroy() {
      dead = true;
      clearTimers();
      globalThis.document?.removeEventListener?.('visibilitychange', onVis);
      safe(() => ambience?.stop());
    }
  };
}

// Bosta kalma ipucu: `ms` boyunca poke() gelmezse fn(n) cagrilir (en fazla `max` kez); poke() sayaci sifirlar, stop() kapatir.
export function idleHint(rt, ms, fn, max = 3) {
  let t = null;
  let n = 0;
  const arm = () => {
    clearTimeout(t);
    if (n >= max) return;
    t = setTimeout(() => {
      if (rt.dead) return;
      n += 1;
      rt.safe(() => fn(n));
      arm();
    }, ms);
  };
  arm();
  return {
    poke() {
      n = 0;
      arm();
    },
    stop() {
      clearTimeout(t);
      n = max;
    }
  };
}
