// Locutor — texto a voz en el navegador.
// Motores: Piper (voces oficiales e importadas), Kokoro y Supertonic 3. Todo corre en el dispositivo.
import { createPiperPhonemize } from './piper-phonemize.js';
import { TextToSpeech, UnicodeProcessor, Style } from './supertonic.js';

const HF = 'https://huggingface.co/rhasspy/piper-voices/resolve/main/';
const ORT_DIST = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.20.1/dist/';
const PHON_WASM = 'https://cdn.jsdelivr.net/npm/@diffusionstudio/piper-wasm@1.0.0/build/piper_phonemize';
const LAME = 'https://cdnjs.cloudflare.com/ajax/libs/lamejs/1.2.1/lame.min.js';
const CACHE_NAME = 'locutor-voces-v1';
const SAMPLES = ['https://rhasspy.github.io/piper-samples/samples/', 'https://raw.githubusercontent.com/rhasspy/piper-samples/master/samples/'];
const LOCAL = 'https://locutor.local/import/'; // claves de caché para voces importadas desde archivos

const KOKORO = {
  model: 'https://huggingface.co/onnx-community/Kokoro-82M-v1.0-ONNX/resolve/main/onnx/model_quantized.onnx',
  config: 'https://huggingface.co/hexgrad/Kokoro-82M/resolve/main/config.json',
  modelSize: 92_400_000, rate: 24000, espeak: 'es-419',
};
const KOKORO_VOICES = [['ef_dora', 'Dora', 'mujer'], ['em_alex', 'Alex', 'hombre'], ['em_santa', 'Santa', 'hombre']];
const ST_BASE = 'https://huggingface.co/supertone-oss-archive/supertonic-3/resolve/aafc6e32416a594460b32413efc49d7fe4ce6d46/';
const ST_MODELS = ['duration_predictor', 'text_encoder', 'vector_estimator', 'vocoder'];
const ST_VOICES = ['F1', 'F2', 'F3', 'F4', 'F5', 'M1', 'M2', 'M3', 'M4', 'M5'];
const ST_STEPS = 5;

const QUALITY = { x_low: 'Muy baja · muy rápida', low: 'Baja · rápida', medium: 'Media', high: 'Alta · más lenta' };
const COUNTRY = { Argentina: 'Argentina', Mexico: 'México', Spain: 'España', Colombia: 'Colombia', Chile: 'Chile', Peru: 'Perú', 'United States': 'EE. UU.', 'United Kingdom': 'Reino Unido', Brazil: 'Brasil', Portugal: 'Portugal' };
const ENGINE_LABEL = { kokoro: 'Kokoro', supertonic: 'Supertonic' };
const SAMPLE = `Hola, esto es Locutor. Pegá cualquier texto, elegí una voz y descargalo como audio.

Todo se genera en tu navegador: después de bajar una voz, funciona incluso sin conexión.`;

const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const tick = () => new Promise(r => setTimeout(r, 0));
const mb = n => n ? `${Math.max(1, Math.round(n / 1048576))} MB` : '';
const store = {
  get(k, d) { try { const v = localStorage.getItem('locutor:' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('locutor:' + k, JSON.stringify(v)); } catch { } },
};

/* ---------- estado ---------- */
const voices = new Map();      // clave -> descripción unificada de la voz
const installed = new Set();   // claves con todos sus archivos en caché
const loaded = new Map();      // clave -> datos listos para sintetizar
const downloading = new Map(); // clave -> progreso 0..1
const memFiles = new Map();    // respaldo si el navegador no permite caché
let kokoroModel = null, stModel = null;
let busy = false, cancelRequested = false, result = null;

const state = {
  voice: store.get('voice', null),
  sid: store.get('sid', 0),
  lang: store.get('lang', 'es'),
  dialogue: store.get('dialogue', false),
  roles: store.get('roles', {}),
  dict: store.get('dict', [{ from: 'IA', to: 'inteligencia artificial' }, { from: 'Dr.', to: 'doctor' }]),
  imports: store.get('imports', []),
};

/* ---------- red y caché ---------- */
async function openCache() { try { return await caches.open(CACHE_NAME); } catch { return null; } }

async function fetchWithProgress(url, expected, onProg) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`No se pudo descargar ${url.split('/').pop()} (error ${r.status}).`);
  const total = Number(r.headers.get('content-length')) || expected || 0;
  if (!r.body) { const b = await r.blob(); onProg && onProg(1); return b; }
  const reader = r.body.getReader(); const chunks = []; let got = 0;
  for (; ;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value); got += value.length;
    if (total && onProg) onProg(Math.min(1, got / total));
  }
  onProg && onProg(1);
  return new Blob(chunks);
}

async function cachedBlob(url, expected, onProg) {
  if (memFiles.has(url)) return memFiles.get(url);
  const cache = await openCache();
  const hit = cache && await cache.match(url);
  if (hit) { onProg && onProg(1); return hit.blob(); }
  const blob = await fetchWithProgress(url, expected, onProg);
  if (cache) await cache.put(url, new Response(blob));
  else memFiles.set(url, blob);
  return blob;
}

function loadScript(src) {
  return new Promise((res, rej) => {
    if ([...document.scripts].some(s => s.src === src)) return res();
    const s = document.createElement('script'); s.src = src; s.onload = res;
    s.onerror = () => rej(new Error('No se pudo cargar ' + src)); document.head.appendChild(s);
  });
}

async function ensureOrt() {
  if (!window.ort) {
    setStatus('Descargando el motor de voz (solo la primera vez)…');
    await loadScript(ORT_DIST + 'ort.min.js');
  }
  ort.env.wasm.wasmPaths = ORT_DIST;
  ort.env.wasm.numThreads = threadCount();
}

function threadCount() {
  if (!window.crossOriginIsolated || store.get('nothreads', false)) return 1;
  return Math.max(1, Math.min(4, navigator.hardwareConcurrency || 2));
}

async function createSession(blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  try {
    return await ort.InferenceSession.create(bytes, { executionProviders: ['wasm'], graphOptimizationLevel: 'all' });
  } catch (e) {
    if (threadCount() > 1) {
      store.set('nothreads', true);
      throw new Error('El motor no pudo usar varios núcleos en este dispositivo. Recargá la página: va a seguir en modo simple.');
    }
    throw e;
  }
}

/* ---------- registro de voces ---------- */
function regionLabel(lang) {
  const c = lang?.country_english || lang?.region || '';
  return COUNTRY[c] || c;
}

function addPiperOfficial(catalog) {
  for (const [key, v] of Object.entries(catalog)) {
    const paths = Object.keys(v.files || {});
    const onnx = paths.find(p => p.endsWith('.onnx'));
    const json = paths.find(p => p.endsWith('.onnx.json'));
    const card = paths.find(p => p.endsWith('MODEL_CARD'));
    if (!onnx || !json) continue;
    const n = v.name || key;
    voices.set(key, {
      key, engine: 'piper', source: 'official',
      name: n.charAt(0).toUpperCase() + n.slice(1).replace(/_/g, ' '),
      family: v.language?.family, region: regionLabel(v.language) || v.language?.code,
      quality: QUALITY[v.quality] || v.quality, size: v.files[onnx].size_bytes,
      speakers: v.num_speakers || 1, speakerMap: v.speaker_id_map || {},
      files: [{ url: HF + json, size: 0 }, { url: HF + onnx, size: v.files[onnx].size_bytes }],
      onnxUrl: HF + onnx, jsonUrl: HF + json,
      card: card ? HF + card : null, sampleDir: onnx.replace(/\/[^/]+$/, ''),
    });
  }
}

function addImported() {
  for (const m of state.imports) {
    voices.set('import:' + m.id, {
      key: 'import:' + m.id, engine: 'piper', source: 'import',
      name: m.name, family: m.family || 'es', region: m.region || 'Importada', quality: 'Piper',
      size: m.size || 0, speakers: m.speakers || 1, speakerMap: m.speakerMap || {},
      files: [{ url: m.json, size: 0 }, { url: m.onnx, size: m.size || 0 }],
      onnxUrl: m.onnx, jsonUrl: m.json, card: m.page || null,
    });
  }
}

function addEngines() {
  for (const [id, name, g] of KOKORO_VOICES) {
    voices.set('kokoro:' + id, {
      key: 'kokoro:' + id, engine: 'kokoro', source: 'engine', id,
      name, family: 'es', region: 'Kokoro', quality: `Voz de ${g}`, size: KOKORO.modelSize, shared: true,
      speakers: 1, files: [{ url: KOKORO.config, size: 0 }, { url: KOKORO.model, size: KOKORO.modelSize }],
    });
  }
  for (const id of ST_VOICES) {
    voices.set('supertonic:' + id, {
      key: 'supertonic:' + id, engine: 'supertonic', source: 'engine', id,
      name: `${id.startsWith('F') ? 'Mujer' : 'Hombre'} ${id.slice(1)}`, family: 'es', region: 'Supertonic',
      quality: 'Expresiva', size: 0, shared: true, speakers: 1,
      files: [
        { url: ST_BASE + 'onnx/tts.json', size: 0 }, { url: ST_BASE + 'onnx/unicode_indexer.json', size: 0 },
        ...ST_MODELS.map(m => ({ url: `${ST_BASE}onnx/${m}.onnx`, size: 0 })),
        { url: `${ST_BASE}voice_styles/${id}.json`, size: 0 },
      ],
    });
  }
}

async function refreshInstalled() {
  installed.clear();
  const cache = await openCache();
  const urls = new Set(cache ? (await cache.keys()).map(k => k.url) : []);
  for (const u of memFiles.keys()) urls.add(u);
  for (const v of voices.values()) if (v.files.every(f => urls.has(f.url))) installed.add(v.key);
}

async function loadCatalog() {
  const cache = await openCache();
  const url = HF + 'voices.json';
  let data = null;
  try {
    const r = await fetch(url, { cache: 'no-cache' });
    if (!r.ok) throw new Error();
    data = await r.json();
    if (cache) cache.put(url, new Response(JSON.stringify(data), { headers: { 'content-type': 'application/json' } }));
  } catch {
    const hit = cache && await cache.match(url);
    if (hit) data = await hit.json();
  }
  voices.clear();
  addImported();
  addEngines();
  if (data) addPiperOfficial(data);
  await refreshInstalled();
  if (!state.voice || !voices.has(state.voice)) state.voice = pickDefault();
  if (!data) throw new Error('No se pudo cargar el catálogo de Piper. Las voces importadas, Kokoro y Supertonic siguen disponibles.');
}

function pickDefault() {
  const keys = [...voices.keys()];
  return keys.find(k => k.startsWith('es_AR')) || keys.find(k => k === 'es_MX-claude-high') || keys.find(k => k.startsWith('es_')) || keys[0];
}

/* ---------- descarga y carga de voces ---------- */
async function installVoice(key, onProg) {
  const v = voices.get(key);
  downloading.set(key, 0); renderList();
  try {
    for (let i = 0; i < v.files.length; i++) {
      const f = v.files[i];
      await cachedBlob(f.url, f.size, p => {
        const total = (i + p) / v.files.length;
        downloading.set(key, total); updateRowBar(key, total); onProg && onProg(total);
      });
    }
  } finally {
    downloading.delete(key);
    await refreshInstalled(); renderList(); renderVoiceCard();
  }
}

async function removeVoice(key) {
  const v = voices.get(key); const cache = await openCache();
  for (const f of v.files) { memFiles.delete(f.url); if (cache) await cache.delete(f.url); }
  if (v.source === 'import') {
    state.imports = state.imports.filter(m => 'import:' + m.id !== key);
    store.set('imports', state.imports); voices.delete(key);
    if (state.voice === key) { state.voice = pickDefault(); store.set('voice', state.voice); }
  }
  if (v.engine === 'kokoro') kokoroModel = null;
  if (v.engine === 'supertonic') stModel = null;
  for (const k of [...loaded.keys()]) if (voices.get(k)?.engine === v.engine && (v.shared || k === key)) loaded.delete(k);
  loaded.delete(key);
  await refreshInstalled(); renderList(); renderVoiceCard(); renderRoles();
}

async function loadVoice(key, onProg) {
  if (loaded.has(key)) return loaded.get(key);
  const v = voices.get(key);
  if (!v) throw new Error('Esa voz ya no está disponible. Elegí otra en el catálogo.');
  if (!installed.has(key)) await installVoice(key, onProg);
  let entry;
  if (v.engine === 'piper') {
    const config = JSON.parse(await (await cachedBlob(v.jsonUrl)).text());
    const blob = await cachedBlob(v.onnxUrl);
    const session = await createSession(blob);
    entry = { engine: 'piper', session, config, rate: config.audio?.sample_rate || 22050 };
  } else if (v.engine === 'kokoro') {
    if (!kokoroModel) {
      const cfg = JSON.parse(await (await cachedBlob(KOKORO.config)).text());
      const blob = await cachedBlob(KOKORO.model);
      const session = await createSession(blob);
      kokoroModel = { session, vocab: cfg.vocab || {} };
    }
    const r = await fetch(`./kokoro/${v.id}.bin`);
    if (!r.ok) throw new Error('No se encontró el estilo de la voz Kokoro.');
    entry = { engine: 'kokoro', style: new Float32Array(await r.arrayBuffer()), rate: KOKORO.rate };
  } else {
    if (!stModel) {
      const cfgs = JSON.parse(await (await cachedBlob(ST_BASE + 'onnx/tts.json')).text());
      const indexer = JSON.parse(await (await cachedBlob(ST_BASE + 'onnx/unicode_indexer.json')).text());
      const sessions = [];
      for (const m of ST_MODELS) {
        const blob = await cachedBlob(`${ST_BASE}onnx/${m}.onnx`);
        sessions.push(await createSession(blob));
      }
      stModel = new TextToSpeech(cfgs, new UnicodeProcessor(indexer), ...sessions);
    }
    const sj = JSON.parse(await (await cachedBlob(`${ST_BASE}voice_styles/${v.id}.json`)).text());
    const tensor = s => new ort.Tensor('float32', Float32Array.from(s.data.flat(Infinity)), s.dims);
    entry = { engine: 'supertonic', style: new Style(tensor(sj.style_ttl), tensor(sj.style_dp)), rate: stModel.sampleRate };
  }
  loaded.set(key, entry);
  return entry;
}

/* ---------- pronunciación (fonemizador oficial de Piper, eSpeak NG) ---------- */
// Se crea una sola vez por sesión. Sus archivos (18 MB) se guardan en la caché de Locutor
// y se le pasan ya cargados, para no volver a descargarlos en cada frase.
let phonPromise = null, phonOut = [];
function getPhonemizer(onProg) {
  if (!phonPromise) {
    phonPromise = (async () => {
      const wasm = new Uint8Array(await (await cachedBlob(PHON_WASM + '.wasm', 635_212)).arrayBuffer());
      const data = await (await cachedBlob(PHON_WASM + '.data', 18_077_249, onProg)).arrayBuffer();
      return createPiperPhonemize({
        print: line => phonOut.push(line),
        printErr: msg => console.warn('[fonemizador]', msg),
        wasmBinary: wasm,
        getPreloadedPackage: () => data,
        locateFile: url => url.endsWith('.wasm') ? PHON_WASM + '.wasm' : url.endsWith('.data') ? PHON_WASM + '.data' : url,
      });
    })();
    phonPromise.catch(() => { phonPromise = null; });
  }
  return phonPromise;
}

async function phonemizeAll(texts, espeakVoice) {
  if (!texts.length) return [];
  const mod = await getPhonemizer();
  const run = list => {
    phonOut = [];
    try { mod.callMain(['-l', espeakVoice, '--input', JSON.stringify(list.map(text => ({ text }))), '--espeak_data', '/espeak-ng-data']); }
    catch (e) { if (!(e && e.name === 'ExitStatus')) throw e; }
    return phonOut.map(l => JSON.parse(l));
  };
  const all = run(texts);
  if (all.length === texts.length) return all;
  return texts.map(t => run([t])[0] || { phoneme_ids: [], phonemes: [] });
}

/* ---------- síntesis por motor ---------- */
async function synthPiper(entry, ph, sid, speed, vary) {
  const { session, config } = entry;
  const ids = strengthenR((ph?.phoneme_ids || []).map(Number), config.phoneme_id_map);
  if (ids.length < 3) return new Float32Array(0);
  const inf = config.inference || {};
  const feeds = {
    input: new ort.Tensor('int64', BigInt64Array.from(ids, BigInt), [1, ids.length]),
    input_lengths: new ort.Tensor('int64', BigInt64Array.from([BigInt(ids.length)]), [1]),
    scales: new ort.Tensor('float32', Float32Array.from([(inf.noise_scale ?? 0.667) * vary, (inf.length_scale ?? 1) / speed, (inf.noise_w ?? 0.8) * vary]), [3]),
  };
  if ((config.num_speakers || 1) > 1) feeds.sid = new ort.Tensor('int64', BigInt64Array.from([BigInt(sid || 0)]), [1]);
  const out = await session.run(feeds);
  return out[session.outputNames[0]].data;
}

async function synthKokoro(entry, phRes, speed) {
  const ph = (phRes?.phonemes || []).join('');
  const tokens = Array.from(ph).map(c => kokoroModel.vocab[c]).filter(v => v != null).slice(0, 510);
  if (!tokens.length) return new Float32Array(0);
  const ids = [0, ...tokens, 0];
  const row = Math.min(tokens.length, 509) * 256;
  const { session } = kokoroModel;
  const out = await session.run({
    input_ids: new ort.Tensor('int64', BigInt64Array.from(ids, BigInt), [1, ids.length]),
    style: new ort.Tensor('float32', entry.style.slice(row, row + 256), [1, 256]),
    speed: new ort.Tensor('float32', Float32Array.from([speed]), [1]),
  });
  return (out.waveform || out[session.outputNames[0]]).data;
}

async function synthSupertonic(entry, text, speed) {
  const { wav } = await stModel._infer([text], ['es'], entry.style, ST_STEPS, 1.05 * speed);
  return Float32Array.from(wav);
}

function resample(data, from, to) {
  if (from === to) return data;
  const ratio = from / to; const n = Math.round(data.length / ratio); const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = i * ratio; const i0 = Math.floor(x); const t = x - i0;
    out[i] = (data[i0] || 0) * (1 - t) + (data[i0 + 1] || 0) * t;
  }
  return out;
}

function splitSentences(s) {
  const parts = s.match(/[^.!?…]+[.!?…]+["»”')]*|[^.!?…]+$/g) || [s];
  const out = [];
  for (let p of parts) {
    p = p.trim(); if (!p) continue;
    while (p.length > 280) {
      let cut = p.lastIndexOf(', ', 280);
      if (cut < 80) cut = p.lastIndexOf(' ', 280);
      if (cut < 1) cut = 280;
      out.push(p.slice(0, cut + 1).trim()); p = p.slice(cut + 1).trim();
    }
    if (p) out.push(p);
  }
  return out;
}

function applyDict(text) {
  let t = text;
  for (const { from, to } of state.dict) {
    if (!from) continue;
    const re = new RegExp(`(?<![\\p{L}\\p{N}])${from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\p{L}\\p{N}])`, 'giu');
    t = t.replace(re, to);
  }
  return t;
}

// Siglas: las pronunciables se leen como palabra (IVA, AFIP, ANSES); el resto, letra por letra (YPF, DNI).
const VOW = 'aeiouáéíóúü';
const PRONOUNCEABLE = new RegExp(`^[^${VOW}]?[${VOW}]`);
const HARD_CLUSTER = new RegExp(`[^${VOW}]{3}`);
function fixAcronyms(text) {
  if (!$('#acronyms').checked) return text;
  return text.replace(/(?<![\p{L}\p{N}])\p{Lu}{2,6}(?![\p{L}\p{N}])/gu, w => {
    const l = w.toLocaleLowerCase('es');
    return PRONOUNCEABLE.test(l) && !HARD_CLUSTER.test(l) ? l : [...w].join(' ');
  });
}

// Erre fuerte: repite el fonema /r/ (vibrante múltiple) para que la voz lo marque más.
function strengthenR(ids, map) {
  if (!$('#strongr').checked) return ids;
  const r = map?.r?.[0], pad = map?._?.[0] ?? 0;
  if (r == null) return ids;
  const out = [];
  for (let i = 0; i < ids.length; i++) {
    out.push(ids[i]);
    if (ids[i] === r && ids[i + 1] === pad) out.push(pad, r);
  }
  return out;
}

const ROLE_RE = /^\s*([\p{L}\p{N}][\p{L}\p{N} _-]{0,23}):\s*(.+)$/u;

function buildJobs(raw) {
  const jobs = [];
  for (const p of raw.split(/\n+/).map(s => s.trim()).filter(Boolean)) {
    let voice = state.voice, sid = state.sid, body = p;
    if (state.dialogue) {
      const m = p.match(ROLE_RE);
      if (m) {
        body = m[2];
        const assigned = state.roles[m[1].trim()];
        if (assigned) { const [k, s] = assigned.split('#'); if (voices.has(k)) { voice = k; sid = Number(s) || 0; } }
      }
    }
    const sentences = splitSentences(body);
    sentences.forEach((s, i) => jobs.push({ display: s, text: fixAcronyms(applyDict(s)), voice, sid, paraEnd: i === sentences.length - 1 }));
  }
  return jobs;
}

/* ---------- escuchar mientras se genera ---------- */
let actx = null, live = null;
function startLive() {
  if (!$('#liveplay').checked) return;
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    actx.resume();
    live = { t: 0, sources: [] };
  } catch { live = null; }
}
function liveAppend(audio, rate, gapAfter) {
  if (!live || !actx || !audio.length) return;
  const buf = actx.createBuffer(1, audio.length, rate);
  buf.copyToChannel(audio, 0);
  const src = actx.createBufferSource(); src.buffer = buf; src.connect(actx.destination);
  const at = Math.max(live.t, actx.currentTime + 0.08);
  src.start(at); live.sources.push(src);
  live.t = at + buf.duration + gapAfter;
}
function stopLive() { if (live) { live.sources.forEach(s => { try { s.stop(); } catch { } }); live = null; } }

function setBusy(on) {
  busy = on; setOnAir(on);
  const b = $('#go'); b.textContent = on ? 'Detener' : 'Generar audio'; b.classList.toggle('stop', on);
}

async function generate() {
  if (busy) return;
  const raw = $('#text').value.trim();
  if (!raw) return setStatus('Escribí o pegá un texto primero.', true);
  if (!state.voice) return setStatus('Elegí una voz del catálogo.', true);
  cancelRequested = false; stopLive(); startLive(); // el audio en vivo se habilita con este toque
  setBusy(true); setBar(0);
  const pieces = [], subs = []; let t = 0, rate = 22050, stopped = false;
  try {
    await ensureOrt();
    const jobs = buildJobs(raw);
    const keys = [...new Set(jobs.map(j => j.voice))];
    for (const key of keys) {
      const label = voices.get(key)?.name || key;
      setStatus(installed.has(key) ? `Cargando la voz ${label}…` : `Descargando la voz ${label}…`);
      await loadVoice(key, p => { setBar(p * 100); setStatus(`Descargando la voz ${label}… ${Math.round(p * 100)} %`); });
      if (cancelRequested) throw new Error('Generación detenida.');
    }
    rate = Math.max(...keys.map(k => loaded.get(k).rate));

    // Pronunciación de todas las frases de una vez, agrupadas por idioma.
    const byLang = new Map();
    jobs.forEach((job, i) => {
      const e = loaded.get(job.voice);
      const lang = e.engine === 'piper' ? (e.config.espeak?.voice || 'es') : e.engine === 'kokoro' ? KOKORO.espeak : null;
      if (lang) { if (!byLang.has(lang)) byLang.set(lang, []); byLang.get(lang).push(i); }
    });
    if (byLang.size) {
      setStatus('Preparando la pronunciación…');
      await getPhonemizer(p => { setBar(p * 100); setStatus(`Descargando el motor de pronunciación (solo la primera vez)… ${Math.round(p * 100)} %`); });
      for (const [lang, idx] of byLang) {
        const res = await phonemizeAll(idx.map(i => jobs[i].text), lang);
        idx.forEach((i, k) => { jobs[i].ph = res[k]; });
      }
    }

    const speed = Number($('#speed').value), pause = Number($('#pause').value), vary = Number($('#vary').value);
    for (let i = 0; i < jobs.length; i++) {
      if (cancelRequested) { stopped = true; break; }
      const job = jobs[i]; const entry = loaded.get(job.voice);
      setStatus(`Leyendo frase ${i + 1} de ${jobs.length}…${live ? ' Ya podés ir escuchando.' : ''}`); setBar((i / jobs.length) * 100);
      await tick();
      let audio;
      try {
        if (entry.engine === 'piper') audio = await synthPiper(entry, job.ph, job.sid, speed, vary);
        else if (entry.engine === 'kokoro') audio = await synthKokoro(entry, job.ph, speed);
        else audio = await synthSupertonic(entry, job.text, speed);
      } catch (e) {
        console.error(e);
        throw new Error(`No se pudo leer la frase ${i + 1}: ${e.message || e}`);
      }
      if (!audio.length) continue;
      audio = resample(audio, entry.rate, rate);
      const gap = i < jobs.length - 1 ? (job.paraEnd ? pause * 2 : pause) : 0;
      liveAppend(audio, rate, gap);
      pieces.push(audio);
      subs.push({ start: t, end: t + audio.length / rate, text: job.display });
      t += audio.length / rate;
      if (gap) { pieces.push(new Float32Array(Math.round(gap * rate))); t += gap; }
    }
    if (!pieces.length) throw new Error(stopped ? 'Generación detenida.' : 'No se generó audio. Revisá que el texto tenga palabras.');
    const total = pieces.reduce((n, p) => n + p.length, 0);
    const samples = new Float32Array(total); let off = 0, peak = 0;
    for (const p of pieces) { samples.set(p, off); off += p.length; }
    for (let i = 0; i < samples.length; i++) { const a = Math.abs(samples[i]); if (a > peak) peak = a; }
    if (peak > 0) { const g = Math.min(0.95 / peak, 4); for (let i = 0; i < samples.length; i++) samples[i] *= g; }
    result = { samples, rate, subs, name: slug(raw) };
    showResult();
    setBar(100);
    setStatus(stopped ? `Detenido: se guardaron ${fmtTime(samples.length / rate)} de audio.` : `Listo: ${fmtTime(samples.length / rate)} de audio.`);
  } catch (e) {
    console.error(e); stopLive();
    setStatus(e.message || 'Algo falló al generar el audio. Probá de nuevo.', true); setBar(0);
  } finally {
    setBusy(false);
  }
}

/* ---------- importar voces Piper ---------- */
function normalizeHfUrl(u) {
  let url = u.trim().replace('/blob/', '/resolve/').replace(/\?.*$/, '');
  if (!/^https:\/\//.test(url)) throw new Error('Pegá un link que empiece con https://');
  if (url.endsWith('.onnx.json')) return { onnx: url.slice(0, -5), json: url };
  if (url.endsWith('.onnx')) return { onnx: url, json: url + '.json' };
  throw new Error('El link tiene que apuntar al archivo .onnx de la voz (o a su .onnx.json).');
}

function metaFromConfig(config, fallbackName) {
  if (!config.phoneme_id_map || !config.audio?.sample_rate) throw new Error('El archivo .onnx.json no parece de una voz Piper.');
  const espeak = config.espeak?.voice || 'es';
  return {
    family: config.language?.family || espeak.split('-')[0],
    region: regionLabel(config.language) || config.language?.code || espeak,
    speakers: config.num_speakers || 1, speakerMap: config.speaker_id_map || {},
    name: fallbackName || config.dataset || 'Voz importada',
  };
}

function finishImport(meta) {
  state.imports = state.imports.filter(m => m.onnx !== meta.onnx).concat(meta);
  store.set('imports', state.imports);
  addImported();
  const key = 'import:' + meta.id;
  state.voice = key; state.sid = 0; store.set('voice', key); store.set('sid', 0);
  if (meta.family !== state.lang) { state.lang = meta.family; store.set('lang', state.lang); renderLangs(); }
  return key;
}

async function importFromUrl() {
  const box = $('#impStatus'); const btn = $('#impUrlBtn');
  try {
    const { onnx, json } = normalizeHfUrl($('#impUrl').value);
    btn.disabled = true; box.className = 'status'; box.textContent = 'Leyendo la configuración de la voz…';
    const r = await fetch(json);
    if (!r.ok) throw new Error(`No encontré el archivo ${json.split('/').pop()} (error ${r.status}).`);
    const jsonText = await r.text();
    const base = onnx.split('/').pop().replace(/\.onnx$/, '');
    const meta = { id: Date.now().toString(36), onnx, json, page: onnx.replace('/resolve/', '/blob/'), ...metaFromConfig(JSON.parse(jsonText), $('#impName').value.trim() || base) };
    const cache = await openCache();
    if (cache) await cache.put(json, new Response(jsonText)); else memFiles.set(json, new Blob([jsonText]));
    const blob = await cachedBlob(onnx, 0, p => { box.textContent = `Descargando la voz… ${Math.round(p * 100)} %`; });
    meta.size = blob.size;
    finishImport(meta);
    await refreshInstalled(); renderLangs(); renderList(); renderVoiceCard(); renderRoles();
    box.textContent = `Listo: "${meta.name}" quedó en tu catálogo y seleccionada.`;
    $('#impUrl').value = ''; $('#impName').value = '';
  } catch (e) {
    box.className = 'status err'; box.textContent = e.message || 'No se pudo importar la voz.';
  } finally { btn.disabled = false; }
}

async function importFromFiles(files) {
  const box = $('#impStatus');
  try {
    const list = [...files];
    const onnxFile = list.find(f => f.name.toLowerCase().endsWith('.onnx'));
    const jsonFile = list.find(f => f.name.toLowerCase().endsWith('.json'));
    if (!onnxFile || !jsonFile) throw new Error('Elegí los dos archivos juntos: el .onnx y el .onnx.json de la voz.');
    box.className = 'status'; box.textContent = 'Guardando la voz en el navegador…';
    const jsonText = await jsonFile.text();
    const id = Date.now().toString(36);
    const base = onnxFile.name.replace(/\.onnx$/i, '');
    const meta = { id, onnx: `${LOCAL}${id}/model.onnx`, json: `${LOCAL}${id}/model.onnx.json`, size: onnxFile.size, ...metaFromConfig(JSON.parse(jsonText), $('#impName').value.trim() || base) };
    const cache = await openCache();
    if (cache) {
      await cache.put(meta.json, new Response(jsonText));
      await cache.put(meta.onnx, new Response(onnxFile));
    } else {
      memFiles.set(meta.json, new Blob([jsonText])); memFiles.set(meta.onnx, onnxFile);
    }
    finishImport(meta);
    await refreshInstalled(); renderLangs(); renderList(); renderVoiceCard(); renderRoles();
    box.textContent = cache ? `Listo: "${meta.name}" quedó guardada y seleccionada.` : `"${meta.name}" se cargó solo para esta sesión: este navegador no permite guardarla.`;
    $('#impName').value = '';
  } catch (e) {
    box.className = 'status err'; box.textContent = e.message || 'No se pudo importar la voz.';
  }
}

/* ---------- salida: WAV, MP3, SRT ---------- */
function toInt16(f) { const o = new Int16Array(f.length); for (let i = 0; i < f.length; i++) { const s = Math.max(-1, Math.min(1, f[i])); o[i] = s < 0 ? s * 0x8000 : s * 0x7FFF; } return o; }
function toWav(f, rate) {
  const pcm = toInt16(f); const buf = new ArrayBuffer(44 + pcm.length * 2); const v = new DataView(buf);
  const w = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  w(0, 'RIFF'); v.setUint32(4, 36 + pcm.length * 2, true); w(8, 'WAVE'); w(12, 'fmt ');
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, rate, true);
  v.setUint32(28, rate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, 'data'); v.setUint32(40, pcm.length * 2, true);
  new Int16Array(buf, 44).set(pcm);
  return new Blob([buf], { type: 'audio/wav' });
}
async function toMp3(f, rate) {
  await loadScript(LAME);
  let data = f, r = rate;
  if (![8000, 11025, 12000, 16000, 22050, 24000, 32000, 44100, 48000].includes(r)) { data = resample(f, rate, 44100); r = 44100; }
  const enc = new lamejs.Mp3Encoder(1, r, 128); const pcm = toInt16(data); const out = [];
  for (let i = 0; i < pcm.length; i += 1152) { const b = enc.encodeBuffer(pcm.subarray(i, i + 1152)); if (b.length) out.push(new Uint8Array(b)); }
  const end = enc.flush(); if (end.length) out.push(new Uint8Array(end));
  return new Blob(out, { type: 'audio/mpeg' });
}
function srtTime(s) {
  const ms = Math.round(s * 1000); const h = Math.floor(ms / 3600000), m = Math.floor(ms / 60000) % 60, sec = Math.floor(ms / 1000) % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')},${String(ms % 1000).padStart(3, '0')}`;
}
function toSrt(subs) { return subs.map((s, i) => `${i + 1}\n${srtTime(s.start)} --> ${srtTime(s.end)}\n${s.text}\n`).join('\n'); }
function save(blob, filename) { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500); }
function slug(t) { return 'locutor-' + (t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').match(/[a-z0-9]+/g) || ['audio']).slice(0, 5).join('-'); }
function fmtTime(s) { const m = Math.floor(s / 60), r = Math.round(s % 60); return `${m}:${String(r).padStart(2, '0')}`; }

let audioUrl = null;
function showResult() {
  $('#emptyOut').hidden = true; $('#outBox').hidden = false;
  if (audioUrl) URL.revokeObjectURL(audioUrl);
  audioUrl = URL.createObjectURL(toWav(result.samples, result.rate));
  $('#player').src = audioUrl;
  $('#dur').textContent = `${fmtTime(result.samples.length / result.rate)} · ${result.rate} Hz`;
  drawWave();
}

function drawWave() {
  if (!result) return;
  const c = $('#wave'); const dpr = window.devicePixelRatio || 1;
  const w = c.clientWidth, h = c.clientHeight; c.width = w * dpr; c.height = h * dpr;
  const ctx = c.getContext('2d'); ctx.scale(dpr, dpr); ctx.clearRect(0, 0, w, h);
  const cs = getComputedStyle(document.documentElement);
  const played = cs.getPropertyValue('--accent').trim(), rest = cs.getPropertyValue('--muted').trim();
  const p = $('#player'); const frac = p.duration ? p.currentTime / p.duration : 0;
  const bars = Math.max(20, Math.floor(w / 3)); const step = Math.floor(result.samples.length / bars) || 1;
  for (let i = 0; i < bars; i++) {
    let m = 0; for (let j = i * step; j < (i + 1) * step && j < result.samples.length; j += 4) { const a = Math.abs(result.samples[j]); if (a > m) m = a; }
    const bh = Math.max(1.5, m * (h - 14));
    const on = (i / bars) < frac;
    ctx.fillStyle = on ? played : rest; ctx.globalAlpha = on ? 1 : 0.55;
    ctx.fillRect(i * 3, (h - bh) / 2, 2, bh);
  }
  ctx.globalAlpha = 1;
}

/* ---------- muestras: escuchar una voz sin descargarla ---------- */
const preview = new Audio();
preview.preload = 'none';
let previewKey = null;
function sampleUrls(key, sid) {
  const v = voices.get(key); if (!v?.sampleDir) return [];
  const urls = [];
  for (const sp of [sid || 0, 0]) for (const base of SAMPLES) urls.push(`${base}${v.sampleDir}/speaker_${sp}.mp3`);
  return [...new Set(urls)];
}
function stopPreview() { preview.pause(); previewKey = null; refreshPreviewButtons(); }
function playPreview(key, sid) {
  if (previewKey === key) { stopPreview(); return; }
  const urls = sampleUrls(key, sid); let i = 0;
  if (!urls.length) return setStatus('Esta voz no tiene muestra: descargala y generá un texto corto para escucharla.', true);
  previewKey = key; refreshPreviewButtons();
  preview.onerror = () => {
    i++;
    if (i < urls.length) { preview.src = urls[i]; preview.play().catch(() => { }); }
    else { stopPreview(); setStatus('No hay muestra disponible para esta voz.', true); }
  };
  preview.onended = stopPreview;
  preview.src = urls[0];
  preview.play().catch(() => { });
}
function refreshPreviewButtons() {
  document.querySelectorAll('button[data-act="hear"]').forEach(b => {
    const on = (b.dataset.key || b.closest('.vrow')?.dataset.key) === previewKey;
    b.textContent = on ? '■ Detener' : '▶ Escuchar muestra';
    b.setAttribute('aria-pressed', String(on));
  });
}

/* ---------- interfaz ---------- */
function setStatus(msg, err) { const s = $('#status'); s.textContent = msg; s.classList.toggle('err', !!err); }
function setBar(p) { $('#bar').style.width = p + '%'; }
function setOnAir(on) { $('#lamp').classList.toggle('on', on); }

function sizeText(v) {
  if (v.engine === 'kokoro') return `${mb(v.size)} (motor compartido)`;
  if (v.engine === 'supertonic') return 'motor compartido';
  return mb(v.size);
}
function tagsHtml(v) {
  const tags = [`<span class="tag">${esc(v.region)}</span>`];
  if (v.source === 'import') tags.push('<span class="tag">Importada</span>');
  return tags.join(' ');
}

function renderVoiceCard() {
  const v = voices.get(state.voice); const box = $('#voicecard');
  if (!v) { box.innerHTML = '<span class="hint">Elegí una voz del catálogo.</span>'; $('#speakerWrap').hidden = true; return; }
  box.innerHTML = `<strong>${esc(v.name)}</strong>
    <div class="tags">${tagsHtml(v)}<span class="tag">${esc(v.quality)}</span>
    ${installed.has(v.key) ? '<span class="tag ok">Descargada</span>' : (sizeText(v) ? `<span class="tag">${esc(sizeText(v))}</span>` : '')}</div>
    ${v.sampleDir ? `<div><button class="btn small hear" data-act="hear" data-key="${esc(v.key)}" type="button">▶ Escuchar muestra</button></div>` : ''}
    ${v.card ? `<a class="hint" href="${esc(v.card)}" target="_blank" rel="noopener" style="color:inherit">Ver ficha y licencia</a>` : ''}`;
  const sw = $('#speakerWrap'); const sel = $('#speaker');
  if (v.engine === 'piper' && v.speakers > 1) {
    sw.hidden = false;
    const names = Object.entries(v.speakerMap).sort((a, b) => a[1] - b[1]);
    const opts = names.length ? names : Array.from({ length: Math.min(v.speakers, 50) }, (_, i) => [`Hablante ${i + 1}`, i]);
    sel.innerHTML = opts.slice(0, 200).map(([name, id]) => `<option value="${id}">${esc(name)}</option>`).join('');
    if (state.sid >= v.speakers) state.sid = 0;
    sel.value = String(state.sid);
  } else { sw.hidden = true; state.sid = 0; }
  refreshPreviewButtons();
}

function renderLangs() {
  const fams = new Map();
  for (const v of voices.values()) if (v.family && !fams.has(v.family)) fams.set(v.family, v.family);
  // nombres legibles desde el catálogo de Piper cuando están
  const names = { es: 'Español', en: 'English', pt: 'Português', fr: 'Français', it: 'Italiano', de: 'Deutsch', ca: 'Català' };
  const sorted = [...fams.keys()].sort((a, b) => a === 'es' ? -1 : b === 'es' ? 1 : a.localeCompare(b));
  $('#lang').innerHTML = sorted.map(f => `<option value="${esc(f)}">${esc(names[f] || f.toUpperCase())}</option>`).join('');
  if (!fams.has(state.lang)) state.lang = 'es';
  $('#lang').value = state.lang;
}

const ORDER = { import: 0, official: 1, engine: 2 };
function renderList() {
  const q = $('#search').value.trim().toLowerCase();
  const rows = [...voices.values()]
    .filter(v => v.family === state.lang)
    .filter(v => !q || `${v.key} ${v.name} ${v.region}`.toLowerCase().includes(q))
    .sort((a, b) => (ORDER[a.source] - ORDER[b.source]) || (installed.has(b.key) - installed.has(a.key)) || a.key.localeCompare(b.key));
  if (!rows.length) { $('#list').innerHTML = '<div class="vrow"><span class="hint">No hay voces que coincidan.</span></div>'; return; }
  $('#list').innerHTML = rows.map(v => {
    const inst = installed.has(v.key); const dl = downloading.has(v.key);
    const spk = v.speakers > 1 ? ` · ${v.speakers} hablantes` : '';
    const size = sizeText(v);
    return `<div class="vrow${v.key === state.voice ? ' sel' : ''}" data-key="${esc(v.key)}">
      <div><div class="name">${esc(v.name)} ${tagsHtml(v)}</div>
      <div class="sub">${esc(v.quality)}${spk}${size ? ' · ' + esc(size) : ''}</div>
      ${v.sampleDir ? '<button class="btn small hear" data-act="hear" type="button">▶ Escuchar muestra</button>' : ''}</div>
      <div class="acts">
        ${dl ? `<div class="bar"><span style="width:${Math.round(downloading.get(v.key) * 100)}%"></span></div>` : ''}
        ${v.key === state.voice ? '<span class="tag ok">En uso</span>' : '<button class="btn small" data-act="use" type="button">Usar</button>'}
        ${inst || v.source === 'import' ? '<button class="btn small ghost" data-act="del" type="button">Quitar</button>' : (dl ? '' : '<button class="btn small" data-act="get" type="button">Descargar</button>')}
      </div></div>`;
  }).join('');
  refreshPreviewButtons();
}
function updateRowBar(key, p) { const el = document.querySelector(`.vrow[data-key="${CSS.escape(key)}"] .bar span`); if (el) el.style.width = Math.round(p * 100) + '%'; }

function renderRoles() {
  const box = $('#roles'); $('#dialogueHint').hidden = !state.dialogue;
  if (!state.dialogue) { box.innerHTML = ''; return; }
  const names = [...new Set($('#text').value.split('\n').map(l => l.match(ROLE_RE)?.[1].trim()).filter(Boolean))].slice(0, 12);
  if (!names.length) { box.innerHTML = '<p class="hint">Todavía no hay personajes. Ejemplo: <b>Dino: ¡Hola!</b></p>'; return; }
  const fam = voices.get(state.voice)?.family || 'es';
  const opts = [];
  for (const v of voices.values()) {
    if (v.family !== fam) continue;
    const tag = v.engine === 'piper' ? v.region : ENGINE_LABEL[v.engine];
    if (v.engine !== 'piper' || v.speakers === 1) opts.push([`${v.key}#0`, `${v.name} (${tag})`]);
    else if (v.speakers <= 10) {
      const map = Object.entries(v.speakerMap);
      for (let i = 0; i < v.speakers; i++) opts.push([`${v.key}#${i}`, `${v.name} (${tag}) — ${map.find(m => m[1] === i)?.[0] || 'hablante ' + (i + 1)}`]);
    }
  }
  box.innerHTML = names.map((n, i) => {
    const cur = state.roles[n] || `${state.voice}#${state.sid}`;
    return `<div class="r"><b>${esc(n)}</b><select data-role="${esc(n)}" id="role-${i}" aria-label="Voz de ${esc(n)}">
      ${opts.map(([val, lab]) => `<option value="${esc(val)}"${val === cur ? ' selected' : ''}>${esc(lab)}</option>`).join('')}</select></div>`;
  }).join('');
}

function renderDict() {
  $('#dictList').innerHTML = state.dict.length ? state.dict.map((d, i) =>
    `<div class="e"><span>${esc(d.from)}</span><span aria-hidden="true">→</span><span>${esc(d.to)}</span>
     <button class="btn small ghost" data-i="${i}" type="button" aria-label="Quitar ${esc(d.from)}">Quitar</button></div>`).join('')
    : '<p class="hint">Sin reemplazos todavía.</p>';
}

function updateCount() {
  const n = $('#text').value.length;
  $('#count').textContent = `${n.toLocaleString('es-AR')} caracteres`;
  $('#estimate').textContent = n ? `≈ ${fmtTime(n / 15 / Number($('#speed').value))} de audio` : '';
}
function syncSliders() {
  $('#speedOut').textContent = Number($('#speed').value).toFixed(2) + '×';
  $('#pauseOut').textContent = Number($('#pause').value).toFixed(2) + ' s';
  $('#varyOut').textContent = Math.round(Number($('#vary').value) * 100) + ' %';
}

/* ---------- eventos ---------- */
let saveT;
$('#text').addEventListener('input', () => { updateCount(); renderRoles(); clearTimeout(saveT); saveT = setTimeout(() => store.set('text', $('#text').value), 400); });
$('#clear').addEventListener('click', () => { $('#text').value = ''; updateCount(); renderRoles(); store.set('text', ''); $('#text').focus(); });
$('#txtfile').addEventListener('change', e => {
  const file = e.target.files[0]; if (!file) return;
  const r = new FileReader(); r.onload = () => { $('#text').value = r.result; updateCount(); renderRoles(); store.set('text', r.result); };
  r.readAsText(file); e.target.value = '';
});
for (const id of ['speed', 'pause', 'vary']) {
  const el = $('#' + id); el.value = store.get(id, el.value);
  el.addEventListener('input', () => { syncSliders(); updateCount(); store.set(id, el.value); });
}
$('#speaker').addEventListener('change', e => { state.sid = Number(e.target.value); store.set('sid', state.sid); });
$('#dialogue').checked = state.dialogue;
$('#dialogue').addEventListener('change', e => { state.dialogue = e.target.checked; store.set('dialogue', state.dialogue); renderRoles(); });
$('#roles').addEventListener('change', e => { const r = e.target.dataset.role; if (r) { state.roles[r] = e.target.value; store.set('roles', state.roles); } });
$('#go').addEventListener('click', () => {
  if (busy) { cancelRequested = true; stopLive(); setStatus('Deteniendo después de la frase actual…'); return; }
  stopPreview(); generate();
});
$('#liveplay').checked = store.get('liveplay', true);
for (const id of ['acronyms', 'strongr']) {
  $('#' + id).checked = store.get(id, true);
  $('#' + id).addEventListener('change', e => store.set(id, e.target.checked));
}
$('#liveplay').addEventListener('change', e => { store.set('liveplay', e.target.checked); if (!e.target.checked) stopLive(); });
$('#voicecard').addEventListener('click', e => { const b = e.target.closest('button[data-act="hear"]'); if (b) playPreview(b.dataset.key, state.sid); });
$('#lang').addEventListener('change', e => { state.lang = e.target.value; store.set('lang', state.lang); renderList(); });
$('#search').addEventListener('input', renderList);
$('#list').addEventListener('click', async e => {
  const btn = e.target.closest('button[data-act]'); if (!btn) return;
  const key = btn.closest('.vrow').dataset.key;
  try {
    if (btn.dataset.act === 'hear') { playPreview(key, 0); return; }
    if (btn.dataset.act === 'use') { state.voice = key; state.sid = 0; store.set('voice', key); store.set('sid', 0); renderVoiceCard(); renderList(); renderRoles(); }
    if (btn.dataset.act === 'get') await installVoice(key, p => setStatus(`Descargando ${voices.get(key).name}… ${Math.round(p * 100)} %`));
    if (btn.dataset.act === 'del') await removeVoice(key);
    if (btn.dataset.act !== 'use') setStatus('');
  } catch (err) { setStatus(err.message, true); }
});
$('#impUrlBtn').addEventListener('click', importFromUrl);
$('#impFiles').addEventListener('change', e => { if (e.target.files.length) importFromFiles(e.target.files); e.target.value = ''; });
$('#dictForm').addEventListener('submit', e => {
  e.preventDefault(); const from = $('#dictFrom').value.trim(), to = $('#dictTo').value.trim();
  if (!from || !to) return;
  state.dict = state.dict.filter(d => d.from.toLowerCase() !== from.toLowerCase()).concat({ from, to });
  store.set('dict', state.dict); renderDict(); $('#dictFrom').value = ''; $('#dictTo').value = ''; $('#dictFrom').focus();
});
$('#dictList').addEventListener('click', e => { const i = e.target.dataset.i; if (i == null) return; state.dict.splice(Number(i), 1); store.set('dict', state.dict); renderDict(); });
$('#dlWav').addEventListener('click', () => result && save(toWav(result.samples, result.rate), result.name + '.wav'));
$('#dlSrt').addEventListener('click', () => result && save(new Blob([toSrt(result.subs)], { type: 'text/plain' }), result.name + '.srt'));
$('#dlMp3').addEventListener('click', async () => {
  if (!result) return;
  try { setStatus('Convirtiendo a MP3…'); save(await toMp3(result.samples, result.rate), result.name + '.mp3'); setStatus('MP3 descargado.'); }
  catch { setStatus('No se pudo crear el MP3. Descargá el WAV.', true); }
});
const player = $('#player');
player.addEventListener('play', stopLive);
player.addEventListener('timeupdate', drawWave);
player.addEventListener('seeked', drawWave);
$('#wave').addEventListener('click', e => { if (!player.duration) return; const r = e.currentTarget.getBoundingClientRect(); player.currentTime = ((e.clientX - r.left) / r.width) * player.duration; });
window.addEventListener('resize', drawWave);
matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', drawWave);

/* ---------- inicio ---------- */
$('#text').value = store.get('text', SAMPLE) || SAMPLE;
syncSliders(); updateCount(); renderDict(); renderRoles();
try {
  await loadCatalog();
  setStatus(installed.size ? 'Listo para generar.' : 'La primera vez se descarga la voz elegida. Después funciona sin conexión.');
} catch (e) {
  setStatus(e.message, true);
} finally {
  renderLangs(); renderVoiceCard(); renderList(); renderRoles();
}
