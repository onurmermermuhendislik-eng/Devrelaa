// Varlik (asset) yukleyici: manifest + veri dosyalari. Hepsi uygulamayla birlikte paketlenir, cevrimdisi calisir.
export async function loadAssets(base = globalThis.document?.baseURI ?? '', fetchFn = globalThis.fetch.bind(globalThis)) {
  const get = async (path) => {
    const res = await fetchFn(new URL(path, base).href);
    if (!res.ok) throw new Error(`${path}: ${res.status}`);
    return res.json();
  };
  const manifest = await get('assets/manifest.json');
  const [shapes, colors, circuits, strings, levelsFile, figures] = await Promise.all([
    get(manifest.data.shapes),
    get(manifest.data.colors),
    get(manifest.data.circuits),
    get(manifest.data.strings),
    get(manifest.data.levels),
    get(manifest.data.figures)
  ]);
  // Oyuna ozel veriler (manifest.gameData: { oyunId: yol }) -> data.game[oyunId]
  // Kullaniciya gorunen surum (scripts/version.env'den uretilir); okunamazsa null: yanlis surum gostermektense hic gostermez
  const version = manifest.data.version ? await get(manifest.data.version).catch(() => null) : null;
  const game = {};
  await Promise.all(Object.entries(manifest.gameData || {}).map(async ([id, path]) => (game[id] = await get(path))));
  return { manifest, shapes, colors, circuits, strings, levels: levelsFile.levels, figures, game, version, base };
}
