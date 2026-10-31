// V8.2 yerel profil yardimcilari. Profil yalniz cihazda (storage.profile); cevrimici hesap yoktur.
const firstChar = (s) => Array.from(String(s || '').trim().split(/\s+/)[0] || '')[0] || '';
const lastWordChar = (s) => Array.from(String(s || '').trim().split(/\s+/).pop() || '')[0] || '';
// "Onur Altay" -> "OA" (Turkce buyuk harf kurali: i -> İ)
export function initialsOf(profile) {
  if (!profile || !profile.first || !profile.last) return '';
  return (firstChar(profile.first) + lastWordChar(profile.last)).toLocaleUpperCase('tr-TR');
}
export const fullName = (p) => (p && p.first && p.last ? `${p.first} ${p.last}` : '');
