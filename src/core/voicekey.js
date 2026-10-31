// V8.4 Ses anahtari: bir yonerge METNINDEN kararli, kisa bir anahtar uretir (`adv_` + FNV-1a 32 bit hex). Uygulama (voice.say) ve
// uretim betikleri (scripts/voice-lines.mjs, scripts/gen-voice-elevenlabs.mjs) AYNI islevi kullanir; boylece MP3 dosya adi metinden
// turetilir ve elle eslestirme gerekmez. Metin degisirse anahtar degisir: eski MP3 yanlis cumleyle caliniz diye CALINMAZ (TTS'e doner).
export const normalizeLine = (t) => String(t ?? '').normalize('NFC').replace(/\s+/g, ' ').trim();

export function lineKey(text) {
  const s = normalizeLine(text);
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return `adv_${h.toString(16).padStart(8, '0')}`;
}
