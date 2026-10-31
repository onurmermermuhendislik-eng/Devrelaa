// V7.5: surum tutarliligi + Egitim Merkezi iyilestirmeleri (YALNIZ degisen kod ve yeni icerik icin hedefli testler):
//  - gorevlerde yanlis baglanti / yanlis cevap icin kisa ogretici Turkce ipuclari (parca adiyla)
//  - pil/kablo/LED/direnc/anahtar parca kartlari ("Dene:" yonergesi)
//  - ders bitis odulu: rozet, "Ogrendin", sayac, asama tamam; mevcut edu.done kaydiyla tutarli
//  - tekrarlanan basari sesi / mukerrer odul korumasi, ses kapali uyumu
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadData } from './helpers.js';
import { createStorage } from '../src/core/storage.js';
import { buildCurriculum, lessonStatus, levelStatus, completeLesson, progressCount, taskResult, startStates, hintText, meetOf, lessonReward, createRun } from '../src/games/learn/logic.js';

const rd = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const data = loadData();
const learn = data.game.learn;
const inv = data.game.invent;
const cur = buildCurriculum(learn, data.levels);
const T = learn.text;
const L = (id) => learn.lessons.find((l) => l.id === id);
const mem = (init) => {
  const m = new Map(init ? [['altez-minilab:v1', init]] : []);
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v) };
};

// (V7.5 surum-tutarlilik testi V7.6'da tests/v76.test.js icine tasindi: surum numaralari yeni surumle degisir; V7.5 icerik testleri aynen korunur.)

test('V7.5 korunan yapi: ders sirasi, adim sayilari ve adim turleri V7.4 ile AYNI (kayitli ilerleme + adim noktalari bozulmaz)', () => {
  assert.deepEqual(cur.order, ['circuit-1', 'switch-1', 'resistor-1', 'series-1', 'parallel-1', 'usta-1', 'kasif-1', 'mucit-1']);
  const shape = (id) => L(id).steps.map((s) => s.type[0]).join(''); // s=show, t=task, q=quiz
  const expected = { 'circuit-1': 'ssssstq', 'switch-1': 'ststq', 'resistor-1': 'stq', 'series-1': 'ssstq', 'parallel-1': 'sstq', 'usta-1': 'sstq', 'kasif-1': 'sstq', 'mucit-1': 'stq' };
  for (const [id, sh] of Object.entries(expected)) assert.equal(shape(id), sh, id);
  assert.deepEqual(cur.levels.map((l) => l.lessons.length), [2, 1, 2, 1, 1, 1]);
  // her ders: goal.with / tools / fixed / board anahtarlari V7.4'tekiyle uyumlu kalmali (yalniz yeni istege bagli alanlar eklendi)
  for (const l of learn.lessons) for (const s of l.steps.filter((x) => x.type === 'task')) assert.ok(s.goal && s.board && Array.isArray(s.tools), l.id);
});

test('V7.5 parca sozlugu: pil, kablo, LED, direnc, anahtar tam; kisa, cocuk dilinde; her biri bir adimda kart olarak kullanilir', () => {
  assert.deepEqual(Object.keys(learn.parts).sort(), ['battery', 'led', 'resistor', 'switch', 'wire']);
  for (const [id, p] of Object.entries(learn.parts)) {
    for (const k of ['icon', 'name', 'job', 'like', 'try']) assert.ok(typeof p[k] === 'string' && p[k].length >= 2, `${id}.${k}`);
    assert.ok(p.job.length <= 40 && p.like.length <= 90 && p.try.length <= 70, `${id}: kisa metin`);
    assert.ok(/[.!]$/.test(p.job) && /[.!]$/.test(p.like) && /[.!]$/.test(p.try), `${id}: cumle sonu`);
  }
  const used = new Set(learn.lessons.flatMap((l) => l.steps.map((s) => s.meet).filter(Boolean)));
  assert.deepEqual([...used].sort(), ['battery', 'led', 'resistor', 'switch', 'wire']);
  for (const l of learn.lessons) for (const s of l.steps) if (s.meet) assert.ok(meetOf(learn.parts, s), `${l.id}: ${s.meet}`);
});

test('V7.5 parca karti mantigi: anlatimda "ne yapar + benzetme", gorevde "Dene" okunur; bozuk/bilinmeyen kimlik karti dusurur (cokmez)', () => {
  const show = meetOf(learn.parts, L('circuit-1').steps[0]);
  assert.equal(show.id, 'battery');
  assert.equal(show.name, 'Pil');
  assert.ok(show.spoken.startsWith('Pil. Pil enerji verir.'));
  assert.ok(show.spoken.includes(learn.parts.battery.like), 'anlatimda benzetme okunur');
  const task = meetOf(learn.parts, L('switch-1').steps[1]);
  assert.equal(task.id, 'switch');
  assert.ok(task.spoken.includes(learn.parts.switch.try), 'gorevde yonerge okunur');
  assert.equal(meetOf(learn.parts, { type: 'show', meet: 'yok' }), null);
  assert.equal(meetOf(learn.parts, { type: 'show' }), null);
  assert.equal(meetOf(undefined, { type: 'show', meet: 'led' }), null);
  assert.equal(meetOf({ led: { name: 'LED' } }, { type: 'show', meet: 'led' }), null, 'job yoksa kart yok');
});

// Bir gorev adiminin TUM olasi dizilimlerini (bos + araclar; sabit parcalar sabit; anahtarlar acik/kapali) dolasir
function* allBoards(step) {
  const lay = inv.layouts[step.board.layout];
  const fixed = step.fixed || [];
  const opts = step.board.slots.map((cur0, i) => (fixed.includes(i) ? [cur0] : [null, ...step.tools]));
  const idx = opts.map(() => 0);
  for (;;) {
    const slots = idx.map((k, i) => opts[i][k]);
    const swIds = slots.map((t, i) => (t === 'switch' ? lay.slots[i].id : null)).filter(Boolean);
    for (let m = 0; m < 1 << swIds.length; m++) {
      const states = { ...startStates(step.board) };
      swIds.forEach((id, j) => (states[id] = m & (1 << j) ? 'closed' : 'open'));
      yield { slots, states };
    }
    let p = opts.length - 1;
    while (p >= 0 && ++idx[p] >= opts[p].length) idx[p--] = 0;
    if (p < 0) return;
  }
}

test('V7.5 ipucu kapsami: her gorevin HER olasi yanlis dizilimi bos olmayan, kisa, Turkce ipucu verir; her gorev cozulebilir; ipucu cozumu bozmaz', () => {
  let boards = 0;
  for (const l of learn.lessons) {
    const s = l.steps.find((x) => x.type === 'task');
    // her ders icin TUM gorev adimlari
    for (const step of l.steps.filter((x) => x.type === 'task')) {
      let solvable = false;
      for (const b of allBoards(step)) {
        boards += 1;
        const r = taskResult(inv, step.goal, b.slots, b.states, step.board.layout);
        if (r.ok) {
          solvable = true;
          continue;
        }
        const h = hintText(step, T, r.key);
        assert.ok(h.length >= 12 && h.length <= 80, `${l.id}: "${r.key}" ipucu uzunlugu ${h.length}: ${JSON.stringify(b)}`);
        assert.match(h, /[.!?]$/, `${l.id}: ${r.key} cumle sonu`);
        assert.ok(!/undefined|null|\{|\}/.test(h), `${l.id}: ${r.key}`);
      }
      assert.ok(solvable, `${l.id}: gorev cozulebilir olmali`);
    }
    assert.ok(s, l.id);
  }
  assert.ok(boards > 150, `yeterince dizilim denendi (${boards})`);
});

test('V7.5 yanlis baglanti ipuclari: eksik parca adiyla (kablo/LED/direnc/anahtar), acik devre, anahtar acik, seri/paralel', () => {
  const task = (id, i) => L(id).steps.filter((x) => x.type === 'task')[i || 0];
  const hint = (id, slots, states = {}, i) => {
    const st = task(id, i);
    const r = taskResult(inv, st.goal, slots, states, st.board.layout);
    return { r, text: hintText(st, T, r.key) };
  };
  // Pil-kablo-LED: LED var ama kablo yok -> eskiden "LED ekleyelim mi?" denirdi; simdi kablo istenir
  const noWire = hint('circuit-1', ['led', 'led', 'led']);
  assert.equal(noWire.r.ok, false);
  assert.equal(noWire.r.key, 'needwire');
  assert.match(noWire.text, /kablo/i);
  // LED yok
  assert.equal(hint('circuit-1', ['wire', 'wire', 'wire']).r.key, 'short');
  assert.match(hint('circuit-1', ['wire', 'wire', 'wire']).text, /LED/);
  // bosluk: yol kopuk
  const gap = hint('circuit-1', ['wire', 'led', null]);
  assert.equal(gap.r.key, 'gap');
  assert.match(gap.text, /bo[sş]luk/i);
  // Anahtar: tahtada ama acik
  const sw = hint('switch-1', ['wire', 'led', 'switch'], { s3: 'open' }, 1);
  assert.equal(sw.r.key, 'switch');
  assert.match(sw.text, /anahtar/i);
  // Anahtar eksik
  const needSw = hint('switch-1', ['wire', 'led', 'wire'], {}, 1);
  assert.equal(needSw.r.key, 'needswitch');
  assert.match(needSw.text, /anahtar/i);
  // Direnc eksik
  const needR = hint('resistor-1', ['wire', 'led', 'wire']);
  assert.equal(needR.r.key, 'resistor');
  assert.match(needR.text, /diren[cç]/i);
  // Seri: tek LED
  assert.equal(hint('series-1', ['led', 'wire', 'wire']).r.key, 'needseries');
  assert.match(hint('series-1', ['led', 'wire', 'wire']).text, /aynı yola/);
  // Paralel: tek kolda LED
  const par = hint('parallel-1', ['wire', 'led', 'wire', 'wire', 'wire', null]);
  assert.equal(par.r.key, 'needparallel');
  assert.match(par.text, /yol/);
  // Seri gorev: 3 LED yanar ama kablo yok -> kablo istenir; 2 LED + kablo cozer (3 LED pilin tasiyabilecegi sinirdadir, "pil yetmedi" bu gorevde olusmaz)
  assert.equal(hint('series-1', ['led', 'led', 'led']).r.key, 'needwire');
  assert.match(hint('series-1', ['led', 'led', 'led']).text, /kablo/i);
  assert.equal(hint('series-1', ['led', 'led', 'wire']).r.ok, true);
  // Kasif: bosluga kablo
  const k = hint('kasif-1', ['wire', 'led', null]);
  assert.equal(k.r.key, 'gap');
  assert.match(k.text, /kablo/i);
  // Mucit: anahtar yok / paralel degil
  assert.equal(hint('mucit-1', ['wire', 'wire', 'wire', 'led', 'led', 'led']).r.key, 'needswitch');
});

test('V7.5 eski davranis korunur: LED+direnc+anahtar (Usta) ipuclari ve basari kosullari V7.4 ile ayni anahtarlari verir', () => {
  const st = L('usta-1').steps.find((s) => s.type === 'task');
  const run = (slots, states) => taskResult(inv, st.goal, slots, states, st.board.layout);
  assert.equal(run(['led', 'resistor', 'switch'], { s3: 'closed' }).ok, true);
  assert.equal(run(['led', 'wire', 'switch'], { s3: 'closed' }).key, 'resistor');
  assert.equal(run(['led', 'resistor', 'switch'], { s3: 'open' }).key, 'switch');
  assert.equal(run(['led', 'resistor', null], {}).key, 'gap');
});

test('V7.5 genel metinler: tum ipucu anahtarlari var, kisa ve ogretici; ses/ipucu metni cevap vermez', () => {
  for (const k of ['quizWrong', 'pick', 'noled', 'gap', 'switch', 'short', 'ledoff', 'weak', 'resistor', 'needswitch', 'needseries', 'needparallel', 'needwire']) {
    assert.ok(typeof T[k] === 'string' && T[k].length >= 12 && T[k].length <= 80, k);
    assert.match(T[k], /[.!?]$/, k);
  }
  assert.equal(hintText({ hints: { gap: 'Ozel.' } }, T, 'gap'), 'Ozel.');
  assert.equal(hintText({ hints: { gap: 'Ozel.' } }, T, 'noled'), T.noled);
  assert.equal(hintText({}, T, 'gap'), T.gap);
  assert.equal(hintText({}, T, null), '');
  assert.equal(hintText({}, T, 'bilinmeyen'), '');
});

test('V7.5 soru ipuclari: yanlista cevap soylenmez, kisa ve ogretici (benzetmeli); her biri V7.4 sinirlari icinde', () => {
  for (const l of learn.lessons) {
    const q = l.steps.find((s) => s.type === 'quiz');
    const ok = q.options.find((o) => o.ok).text.toLowerCase();
    for (const o of q.options.filter((x) => !x.ok)) {
      assert.ok(o.hint.length > 10 && o.hint.length < 80, `${l.id} uzunluk`);
      assert.ok(!o.hint.toLowerCase().includes(ok), `${l.id}: ipucu cevabi soylemez`);
      assert.notEqual(o.hint, T.quizWrong);
    }
  }
  assert.match(L('usta-1').steps.find((s) => s.type === 'quiz').options[1].hint, /Anahtar|yol/i);
});

test('V7.5 ders bitis odulu: ilk kez -> yeni rozet; tekrar -> rozet zaten var; kayit mevcut edu.done kuraliyla AYNI', () => {
  const r1 = lessonReward(cur, [], 'circuit-1');
  assert.equal(r1.firstTime, true);
  assert.equal(r1.earned, true);
  assert.deepEqual(r1.done, ['circuit-1']);
  assert.deepEqual(r1.badge, { id: 'circuit-1', icon: '🔌', title: 'Elektrik devresi nedir?' });
  assert.equal(r1.count, 1);
  assert.equal(r1.total, 8);
  assert.equal(r1.levelJustDone, false, 'Baslangic 2 dersli: ilk ders asamayi bitirmez');
  assert.match(r1.learned, /^Öğrendin:/);
  // ayni dersi tekrar bitirmek: rozet zaten var, liste degismez
  const r2 = lessonReward(cur, r1.done, 'circuit-1');
  assert.equal(r2.firstTime, false);
  assert.equal(r2.earned, true);
  assert.deepEqual(r2.done, ['circuit-1']);
  assert.equal(r2.levelJustDone, false);
  // completeLesson ile ayni sonuc (rozet = tamamlanan ders; ayri kayit yok)
  for (const id of cur.order) assert.deepEqual(lessonReward(cur, [], id).done, completeLesson(cur, [], id));
  // sayac: progressCount ile tutarli
  const r3 = lessonReward(cur, ['circuit-1'], 'switch-1');
  assert.deepEqual({ done: r3.count, total: r3.total }, progressCount(cur, r3.done));
});

test('V7.5 asama tamam: Baslangic ikinci dersle biter; tum 8 ders bitince allDone yalniz bir kez; kilitli ders rozet vermez', () => {
  const r = lessonReward(cur, ['circuit-1'], 'switch-1');
  assert.equal(r.levelJustDone, true);
  assert.equal(r.levelId, 'baslangic');
  assert.equal(r.levelName, 'Başlangıç');
  assert.equal(levelStatus(cur, r.done).baslangic, 'done');
  // tek dersli asama (Cirak) ilk kez bitince asama tamam
  assert.equal(lessonReward(cur, ['circuit-1', 'switch-1'], 'resistor-1').levelJustDone, true);
  // ayni ders tekrar: asama tamam duyurusu tekrarlanmaz
  assert.equal(lessonReward(cur, r.done, 'switch-1').levelJustDone, false);
  // son ders
  const sevenDone = cur.order.slice(0, 7);
  const last = lessonReward(cur, sevenDone, 'mucit-1');
  assert.equal(last.allDone, true);
  assert.equal(last.count, 8);
  assert.equal(lessonReward(cur, last.done, 'mucit-1').allDone, false);
  // kilitli (sirasi gelmemis) ders: rozet yok, liste degismez
  const locked = lessonReward(cur, [], 'usta-1');
  assert.equal(locked.earned, false);
  assert.equal(locked.firstTime, false);
  assert.deepEqual(locked.done, []);
  assert.equal(lessonStatus(cur, locked.done)['usta-1'], 'locked');
  // bilinmeyen/bozuk kimlik
  assert.equal(lessonReward(cur, [], 'yok-ders'), null);
  assert.equal(lessonReward(cur, null, 'circuit-1').firstTime, true);
});

test('V7.5 kayit: odul listesi edu.done olarak yazilir/okunur; yeniden acilista rozetler korunur; oyun kayitlari ve ayarlar bozulmaz; cift yazim guvenli', () => {
  const b = mem(JSON.stringify({ correct: 7, band: '6-8', sound: false, games: { 'number-hunt': { correct: 9 } } }));
  let s = createStorage(b);
  let done = s.getEdu().done;
  for (const id of ['circuit-1', 'switch-1']) {
    const R = lessonReward(cur, done, id);
    s.updateEdu(R.done);
    done = s.getEdu().done;
  }
  // ayni bitis iki kez islenirse (cift dokunus) kayit ayni kalir
  const again = lessonReward(cur, s.getEdu().done, 'switch-1');
  s.updateEdu(again.done);
  s = createStorage(b);
  assert.deepEqual(s.getEdu().done, ['circuit-1', 'switch-1']);
  assert.equal(s.get().correct, 7);
  assert.equal(s.get().band, '6-8');
  assert.equal(s.get().sound, false);
  assert.equal(s.getGame('number-hunt').correct, 9);
  assert.equal(progressCount(cur, s.getEdu().done).done, 2);
});

test('V7.5 tek seferlik koruma: ayni calismada basari sesi/odul/ayni yanlis dokunus yalniz BIR kez; yeni calisma yeniden sayar; eski zamanlayici gecersiz', () => {
  const run = createRun();
  const r1 = run.start();
  assert.equal(run.isCurrent(r1), true);
  // 50 hizli dokunus: yalniz ilki gecer
  let granted = 0;
  for (let i = 0; i < 50; i++) if (run.claim('ok:5')) granted += 1;
  assert.equal(granted, 1, 'basari sesi bir kez');
  assert.equal(run.claim('reward'), true);
  assert.equal(run.claim('reward'), false, 'odul bir kez');
  assert.equal(run.claim('wrong:6:1'), true);
  assert.equal(run.claim('wrong:6:1'), false, 'ayni yanlis dokunus tekrar ses uretmez');
  assert.equal(run.claim('wrong:6:0'), true, 'baska yanlis secenek ayri sayilir');
  // yeni ders / liste: eski calismanin zamanlayicisi gecersiz, talepler sifirlanir
  const r2 = run.start();
  assert.equal(run.isCurrent(r1), false);
  assert.equal(run.isCurrent(r2), true);
  assert.equal(run.claim('ok:5'), true);
  assert.equal(run.claim('reward'), true);
});

test('V7.5 kaynak: basari sesi ve odul run.claim ile korunur; ses/konusma yalniz ctx.audio / ctx.voice uzerinden (ses kapatma ayarina uyar); geri tusu/kayit korunur', () => {
  const g = rd('src/games/learn/game.js');
  assert.match(g, /run\.claim\(`ok:\$\{si\}`\)/);
  assert.match(g, /run\.claim\('reward'\)/);
  assert.match(g, /run\.claim\(`wrong:\$\{stepIdx\}:\$\{i\}`\)/);
  assert.match(g, /run\.claim\(`right:\$\{stepIdx\}`\)/);
  assert.match(g, /run\.isCurrent\(rid\) && lesson === sl && stepIdx === si && audio\.play\('success'\)/);
  assert.match(g, /run\.start\(\)/);
  // dogrudan tarayici ses/konusma API'si YOK: ses kapaliyken (audio.enabled / voice.on) hicbir ses cikmaz
  assert.doesNotMatch(g, /speechSynthesis|new Audio\(|AudioContext|SpeechSynthesisUtterance/);
  // parca karti, dokununca okur (voice.say), otomatik uzun konusma yok
  assert.match(g, /data-act="meet"/);
  assert.match(g, /voice\.say\(`learn_meet_\$\{m\.id\}`/);
  // mevcut korumalar
  assert.match(g, /registerBack\(\(\) => \(screen !== 'map'/);
  assert.match(g, /storage\.updateEdu\(R\.done\)/);
  assert.match(g, /class="learn-path"/);
  assert.match(g, /data-badge=/);
  assert.match(g, /lv-count/);
  assert.match(g, /o\.hint \|\| T\.quizWrong/);
  // bitis ekrani: yeni/var rozet, ogrendin, sayac, asama
  for (const m of ['learn-reward', 'learn-learned', 'learn-meter', 'learn-levelup', 'T.badgeNew', 'T.badgeHave', 'R.levelJustDone', 'R.allDone']) assert.ok(g.includes(m), m);
  // ses ayari: audio.play/voice.say kapaliyken sessiz (mevcut altyapi)
  const a = rd('src/core/audio.js');
  assert.match(a, /play\(name\) \{\s*if \(!on\) return;/);
  const v = rd('src/core/voice.js');
  assert.match(v, /say\(key, onEnd, text\) \{\s*if \(!on\) return onEnd\?\.\(\);/);
});

test('V7.5 CSS: parca karti ve odul ogeleri tanimli; hareket azaltma destekli; dokunma hedefi >= 44px', () => {
  const c = rd('src/ui/styles.css');
  for (const sel of ['.learn-meet', '.learn-reward', '.learn-meter', '.learn-levelup', '.learn-learned']) assert.ok(c.includes(sel), sel);
  assert.match(c, /prefers-reduced-motion: reduce\)[^}]*\.lr-new \.lr-badge \{ animation: none/);
  assert.match(c, /\.learn-meet \{[^}]*min-height: 52px/);
  assert.match(c, /max-height: 600px\) \{ \.learn-meet \{ min-height: 44px/);
});

test('V7.5 yatay/kisa ekran: Egitim listesi kaydirilir, ders ekrani dikey yigin + yazili ipucu gorunur, odul ekrani iki sutun (V7.4 yatay duzen hatasi duzeltildi)', () => {
  const c = rd('src/ui/styles.css');
  assert.match(c, /@media \(orientation: landscape\) and \(max-height: 540px\) \{ \.learn-map \{ align-self: stretch; \} \}/);
  const m = c.match(/\.learn \.learn-stage \{ flex-direction: column;[^}]*overflow-y: auto/);
  assert.ok(m, 'ders ekrani yatayda dikey yigin + kaydirma');
  assert.match(c, /\.learn \.learn-stage > \.cap \{ display: block;/);
  assert.match(c, /\.learn-done \.ld-in \{ grid-template-columns: 1fr 1\.25fr;/);
  // yalniz Egitim kapsami: yatay kurallar `.learn` ile sinirli (diger oyunlarin yatay duzeni degismez)
  const tail = c.slice(c.indexOf('V7.5: Egitim DERS ekranlari yatay'));
  for (const line of tail.split('\n').filter((l) => /^\s+\.[a-z]/.test(l))) assert.match(line, /^\s+\.learn/, line.trim().slice(0, 60));
});

test('V7.5 derleme betigi: SMOKE_SCRIPT secenegi var, varsayilan TAM smoke; hedefli secimde rapor tam smoke kosulmadigini yazar', () => {
  const b = rd('install-and-build.sh');
  assert.match(b, /SMK="\$\{SMOKE_SCRIPT:-scripts\/ui-smoke\.mjs\}"/);
  assert.match(b, /KOSULMADI/);
  assert.match(b, /timeout 1500 node "\$SMK"/);
  assert.equal(JSON.parse(rd('package.json')).scripts['test:ui75'], 'node scripts/ui-v75.mjs');
  assert.equal(JSON.parse(rd('package.json')).scripts['test:ui'], 'node scripts/ui-smoke.mjs');
});

test('V7.5 ozellik envanteri: learn ozelligi bu testi icerir; V7.4 testleri hala bagli', () => {
  const f = JSON.parse(rd('release/features.json'));
  const learnF = f.features.find((x) => x.id === 'learn');
  assert.ok(learnF.tests.includes('tests/v75.test.js'));
  assert.ok(learnF.tests.includes('tests/v74.test.js'));
});
