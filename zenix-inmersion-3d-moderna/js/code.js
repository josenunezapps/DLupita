import { canvasTexture } from './util.js';

// Pantallas de código con resaltado de sintaxis, escritas en un canvas que se usa como textura de un monitor 3D.
// Todo el contenido es de ejemplo (no representa proyectos ni resultados reales).

const COLORS = {
  kw: '#c4a7ff', str: '#9ad7c4', num: '#e6c07b', com: '#6b6a7c', fn: '#8fb4ff', tag: '#e58fb0', attr: '#b9a4f0',
  pun: '#a9a8ba', txt: '#e6e5ee', ok: '#7fd6a6', warn: '#e6c07b', err: '#ef8a98', dim: '#7c7b8e', cyan: '#8fe0d8', var: '#dcdbe8',
};

const KW = {
  js: /^(import|from|export|default|function|const|let|var|return|async|await|if|else|new|class|extends|throw|try|catch|for|of|in|true|false|null|undefined|require|module)\b/,
  css: /^(@media|@keyframes|display|grid|flex|position|color|background|transition|transform|padding|margin|border|gap|font|width|height|inset|opacity|animation|content)\b/,
  sql: /^(CREATE|TABLE|PRIMARY|KEY|NOT|NULL|DEFAULT|REFERENCES|INDEX|SELECT|FROM|WHERE|INSERT|INTO|VALUES|UNIQUE|TIMESTAMPTZ|UUID|TEXT|INT|BOOLEAN|ON|JOIN|ORDER|BY|LIMIT|now)\b/i,
  html: /^$/,
};

function tokenize(line, lang) {
  const out = [];
  let s = line;
  const kw = KW[lang] || KW.js;
  while (s.length) {
    let m;
    if (lang === 'term') { out.push([s, null]); break; }
    if ((m = s.match(/^(\/\/.*|--.*|\/\*.*?\*\/|#.*)/)) && !(lang === 'css' && s[0] === '#')) out.push([m[0], 'com']);
    else if ((m = s.match(/^('[^']*'|"[^"]*"|`[^`]*`)/))) out.push([m[0], 'str']);
    else if ((m = s.match(/^\d+(\.\d+)?(px|ms|s|rem|%|vh|vw|fr)?\b/))) out.push([m[0], 'num']);
    else if (lang === 'html' && (m = s.match(/^<\/?[a-zA-Z][\w-]*/))) out.push([m[0], 'tag']);
    else if (lang === 'js' && (m = s.match(/^<\/?[A-Z][\w.]*/))) out.push([m[0], 'tag']);
    else if ((m = s.match(kw))) out.push([m[0], 'kw']);
    else if ((m = s.match(/^[A-Za-z_$][\w$]*(?=\()/))) out.push([m[0], 'fn']);
    else if (lang === 'css' && (m = s.match(/^[.#][\w-]+/))) out.push([m[0], 'fn']);
    else if ((m = s.match(/^[A-Za-z_$][\w$-]*(?==)/))) out.push([m[0], 'attr']);
    else if ((m = s.match(/^[A-Za-z_$][\w$]*/))) out.push([m[0], 'var']);
    else if ((m = s.match(/^\s+/))) out.push([m[0], null]);
    else { m = [s[0]]; out.push([m[0], 'pun']); }
    s = s.slice(m[0].length);
  }
  return out;
}

export const SNIPPETS = {
  app: { file: 'App.jsx', lang: 'js', accent: '#5eead4', src: `import { useEffect, useState } from 'react';
import { Hero } from './components/Hero';
import { Projects } from './components/Projects';

export default function App() {
  const [data, setData] = useState(null);

  useEffect(() => {
    fetch('/api/projects')
      .then((res) => res.json())
      .then(setData);
  }, []);

  return (
    <main className="app">
      <Hero title="Tu idea, en producción" />
      {data && <Projects items={data} />}
    </main>
  );
}` },
  hero: { file: 'Hero.jsx', lang: 'js', accent: '#5eead4', src: `export function Hero({ title }) {
  return (
    <section className="hero">
      <h1>{title}</h1>
      <p>Diseño, desarrollo y despliegue.</p>
      <button onClick={start}>
        Empezar
      </button>
    </section>
  );
}

const start = () => {
  document.body.classList.add('go');
};` },
  css: { file: 'styles.css', lang: 'css', accent: '#a78bfa', src: `:root {
  --violet: #8b4dff;
  --cyan: #22d3ee;
  --bg: #05030f;
}

.hero {
  display: grid;
  gap: 24px;
  padding: 96px 8vw;
  background: radial-gradient(
    circle at 30% 20%,
    var(--violet),
    var(--bg)
  );
}

.hero button {
  transition: transform 240ms ease;
}
.hero button:hover {
  transform: translateY(-2px);
}` },
  server: { file: 'server.js', lang: 'js', accent: '#a78bfa', src: `import express from 'express';
import { verify } from './auth.js';
import { db } from './db.js';

const app = express();
app.use(express.json());

app.get('/api/projects', verify, async (req, res) => {
  const rows = await db.query(
    'SELECT id, name, status FROM projects'
  );
  res.json(rows);
});

app.post('/api/projects', verify, async (req, res) => {
  const { name } = req.body;
  const row = await db.insert('projects', { name });
  res.status(201).json(row);
});

app.listen(3000);` },
  auth: { file: 'auth.js', lang: 'js', accent: '#a78bfa', src: `import jwt from 'jsonwebtoken';

export function verify(req, res, next) {
  const token = req.headers.authorization;
  if (!token) {
    return res.status(401).json({ error: 'auth' });
  }
  try {
    req.user = jwt.verify(token, process.env.KEY);
    next();
  } catch (err) {
    res.status(403).json({ error: 'token' });
  }
}

export const sign = (user) =>
  jwt.sign({ id: user.id }, process.env.KEY, {
    expiresIn: '2h',
  });` },
  sql: { file: 'schema.sql', lang: 'sql', accent: '#a78bfa', src: `-- esquema de ejemplo
CREATE TABLE users (
  id UUID PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE projects (
  id UUID PRIMARY KEY,
  owner UUID REFERENCES users(id),
  name TEXT NOT NULL,
  status TEXT DEFAULT 'draft'
);

CREATE INDEX idx_projects_owner
  ON projects(owner);

SELECT name, status
FROM projects
WHERE status = 'live'
ORDER BY created_at
LIMIT 20;` },
  html: { file: 'index.html', lang: 'html', accent: '#5eead4', src: `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <title>Mi proyecto</title>
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <div id="root"></div>
  <script type="module" src="main.js"></script>
</body>
</html>` },
};

export const TERMINALS = {
  build: { file: 'terminal — build', lines: [
    ['$ npm run build', 'txt'], ['', null], ['> vite build', 'dim'], ['transformando 128 módulos…', 'dim'],
    ['✓ componentes   24', 'ok'], ['✓ estilos        6', 'ok'], ['✓ rutas api      9', 'ok'], ['✓ pruebas   48/48', 'ok'],
    ['', null], ['build listo en 3.2 s', 'cyan'], ['$ _', 'txt'],
  ] },
  deploy: { file: 'terminal — deploy', lines: [
    ['$ git push origin main', 'txt'], ['', null], ['enviando objetos… 100%', 'dim'], ['→ CI: instalando dependencias', 'dim'],
    ['→ CI: pruebas unitarias', 'dim'], ['✓ pruebas aprobadas', 'ok'], ['→ publicando versión', 'dim'], ['✓ desplegado', 'ok'],
    ['', null], ['$ _', 'txt'],
  ] },
  logs: { file: 'terminal — logs', lines: [
    ['GET  /api/projects   200  12 ms', 'ok'], ['POST /api/projects   201  28 ms', 'ok'], ['GET  /api/users/me    200   9 ms', 'ok'],
    ['GET  /api/projects   200  11 ms', 'ok'], ['POST /api/auth/login  200  34 ms', 'ok'], ['GET  /api/health      200   2 ms', 'ok'],
    ['GET  /api/projects   200  10 ms', 'ok'], ['', null], ['escuchando en :3000', 'cyan'],
  ] },
};


const FONT_UI = 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
const FONT_MONO = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
const rr = (c, x, y, w, h, r) => { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); };

// Editor de código moderno: barra lateral con archivos, pestañas, migas, editor con números de línea, minimapa y barra de estado.
export function makeCodeScreen(kind, { W = 1280, aspect = 1.75, aniso = 8 } = {}) {
  const H = Math.round(W / aspect);
  const sn = SNIPPETS[kind];
  const lines = sn.src.split('\n').map((l) => tokenize(l, sn.lang));
  const total = sn.src.replace(/\n/g, '').length;
  const fs = Math.round(W / 46), lh = Math.round(fs * 1.5);
  const state = {};
  const files = ['src', '  App.jsx', '  Hero.jsx', '  styles.css', 'server', '  server.js', '  auth.js', '  schema.sql', 'package.json'];

  const t = canvasTexture(W, H, (c, w, h, frac = 0, blink = 1) => {
    c.fillStyle = '#0f0f13'; c.fillRect(0, 0, w, h);
    const sbw = Math.round(w * 0.17), th = Math.round(h * 0.068), sbH = Math.round(h * 0.055);
    // barra lateral
    c.fillStyle = '#131318'; c.fillRect(0, th, sbw, h - th - sbH);
    c.fillStyle = '#1a1a21'; c.fillRect(sbw - 1, th, 1, h - th - sbH);
    c.font = `600 ${Math.round(fs * 0.62)}px ${FONT_UI}`; c.fillStyle = '#6f6e80'; c.textBaseline = 'middle';
    c.fillText('EXPLORADOR', 18, th + fs * 1.1);
    c.font = `${Math.round(fs * 0.78)}px ${FONT_UI}`;
    files.forEach((f, i) => {
      const y = th + fs * 2.9 + i * fs * 1.35, on = f.trim() === sn.file;
      if (on) { c.fillStyle = 'rgba(139,92,255,.16)'; c.fillRect(0, y - fs * 0.62, sbw - 1, fs * 1.24); c.fillStyle = '#8b5cff'; c.fillRect(0, y - fs * 0.62, 3, fs * 1.24); }
      c.fillStyle = on ? '#f1f0f7' : (f.startsWith(' ') ? '#9a99ab' : '#c9c8d6'); c.fillText((f.startsWith(' ') ? '   ' : '▾ ') + f.trim(), 16, y);
    });
    // pestañas
    c.fillStyle = '#131318'; c.fillRect(sbw, 0, w - sbw, th);
    const tabW = Math.round(w * 0.2);
    c.fillStyle = '#0f0f13'; c.fillRect(sbw, 0, tabW, th); c.fillStyle = '#8b5cff'; c.fillRect(sbw, 0, tabW, 2);
    c.font = `500 ${Math.round(fs * 0.78)}px ${FONT_UI}`; c.fillStyle = '#f1f0f7'; c.fillText(sn.file, sbw + 20, th / 2 + 1);
    c.fillStyle = '#6f6e80'; c.fillText('src › ' + sn.file, sbw + tabW + 24, th / 2 + 1);
    // editor
    const gut = sbw + Math.round(fs * 3.0), left0 = gut + 14;
    c.font = `${fs}px ${FONT_MONO}`; c.textBaseline = 'alphabetic';
    const top = th + lh * 1.25, cw = c.measureText('M').width;
    const cap = Math.max(4, Math.floor((h - sbH - top) / lh) + 1);
    let left = Math.round(total * frac), cur = 0, rem = left;
    for (let i = 0; i < lines.length; i++) {
      const len = lines[i].reduce((a, b) => a + b[0].length, 0);
      if (rem <= len) { cur = i; break; }
      rem -= len; cur = Math.min(i + 1, lines.length - 1);
    }
    const first = Math.max(0, cur - cap + 2);
    let cx = left0, cy = top;
    // línea activa resaltada
    for (let i = first; i < lines.length; i++) {
      if (left <= 0) break;
      const y = top + (i - first) * lh;
      if (y > h - sbH) break;
      if (i === cur) { c.fillStyle = 'rgba(255,255,255,.04)'; c.fillRect(sbw + 2, y - lh * 0.78, w - sbw - 2, lh); }
      c.fillStyle = i === cur ? '#9a99ab' : '#4d4c5c'; c.textAlign = 'right'; c.fillText(String(i + 1), gut - 12, y); c.textAlign = 'left';
      let x = left0;
      for (const [txt, k] of lines[i]) {
        if (left <= 0) break;
        const part = txt.slice(0, left);
        c.fillStyle = COLORS[k] || COLORS.txt; c.fillText(part, x, y);
        x += cw * part.length; left -= part.length;
        if (part.length < txt.length) { left = 0; break; }
      }
      cx = x; cy = y;
    }
    if (blink > 0.5 || frac < 1) { c.fillStyle = '#c4a7ff'; c.fillRect(cx + 2, cy - fs * 0.84, Math.max(3, cw * 0.14), fs * 1.08); }
    // minimapa
    const mmx = w - Math.round(w * 0.095);
    c.fillStyle = '#121217'; c.fillRect(mmx, th, w - mmx, h - th - sbH);
    for (let i = 0; i < Math.min(lines.length, 34); i++) {
      if (i / lines.length > frac + 0.02) break;
      let x = mmx + 8; for (const [txt, k] of lines[i]) { const ww = txt.length * 2.2; if (k) { c.fillStyle = COLORS[k]; c.globalAlpha = 0.55; c.fillRect(x, th + 12 + i * 5.5, ww, 2.6); } x += ww; }
    }
    c.globalAlpha = 1;
    // barra de estado
    c.fillStyle = '#8b5cff'; c.fillRect(0, h - sbH, Math.round(w * 0.1), sbH);
    c.fillStyle = '#17171d'; c.fillRect(Math.round(w * 0.1), h - sbH, w, sbH);
    c.font = `600 ${Math.round(fs * 0.68)}px ${FONT_UI}`; c.fillStyle = '#fff'; c.textBaseline = 'middle';
    c.fillText('⎇ main', 16, h - sbH / 2 + 1);
    c.fillStyle = '#a9a8ba'; c.fillText(`✓ 0 errores    ${sn.lang === 'js' ? 'JavaScript' : sn.lang.toUpperCase()}    UTF-8    ${Math.round(frac * 100)} %`, Math.round(w * 0.1) + 18, h - sbH / 2 + 1);
    c.textBaseline = 'alphabetic';
  }, { aniso });

  return {
    tex: t.tex, W, H,
    update(frac, time) {
      const q = Math.round(frac * total);
      const bl = frac >= 1 ? (Math.floor(time * 1.6) % 2) : 1;
      if (q === state.q && bl === state.blink) return false;
      state.q = q; state.blink = bl; t.redraw(frac, bl); return true;
    },
  };
}

export function makeTerminalScreen(kind, { W = 960, aspect = 1.6, aniso = 8 } = {}) {
  const H = Math.round(W / aspect);
  const sn = TERMINALS[kind];
  const total = sn.lines.reduce((a, l) => a + l[0].length + 1, 0);
  const fs = Math.round(W / 34), lh = Math.round(fs * 1.5);
  const state = {};
  const t = canvasTexture(W, H, (c, w, h, frac = 0, blink = 1) => {
    c.fillStyle = '#0b0b0e'; c.fillRect(0, 0, w, h);
    const th = Math.round(h * 0.085);
    c.fillStyle = '#141419'; c.fillRect(0, 0, w, th);
    ['#4d4c5c', '#4d4c5c', '#4d4c5c'].forEach((col, i) => { c.fillStyle = col; c.beginPath(); c.arc(22 + i * 20, th / 2, 5.5, 0, 7); c.fill(); });
    c.font = `500 ${Math.round(fs * 0.7)}px ${FONT_UI}`; c.fillStyle = '#8d8c9f'; c.textBaseline = 'middle'; c.fillText(sn.file, 96, th / 2 + 1);
    c.font = `${fs}px ${FONT_MONO}`; c.textBaseline = 'alphabetic';
    const top0 = th + lh * 1.3, cw = c.measureText('M').width;
    const cap = Math.max(4, Math.floor((h - 56 - top0) / lh) + 1);
    let left = Math.round(total * frac), shown = 0, rem = left;
    for (let i = 0; i < sn.lines.length; i++) { if (rem <= 0) break; shown = i + 1; rem -= sn.lines[i][0].length + 1; }
    const first = Math.max(0, shown - cap);
    let cx = 24, cy = top0;
    for (let i = first; i < sn.lines.length; i++) {
      if (left <= 0) break;
      const [txt, k] = sn.lines[i], y = top0 + (i - first) * lh, part = txt.slice(0, left);
      c.fillStyle = COLORS[k] || COLORS.txt; c.fillText(part, 24, y);
      cx = 24 + cw * part.length; cy = y; left -= part.length + 1;
    }
    if (blink > 0.5 || frac < 1) { c.fillStyle = '#c4a7ff'; c.fillRect(cx + 4, cy - fs * 0.82, cw * 0.55, fs); }
    c.fillStyle = '#1b1b22'; rr(c, 24, h - 38, w - 48, 8, 4); c.fill();
    c.fillStyle = '#8b5cff'; rr(c, 24, h - 38, Math.max(8, (w - 48) * frac), 8, 4); c.fill();
  }, { aniso });
  return {
    tex: t.tex, W, H,
    update(frac, time) {
      const q = Math.round(frac * total);
      const bl = frac >= 1 ? (Math.floor(time * 1.6) % 2) : 1;
      if (q === state.q && bl === state.blink) return false;
      state.q = q; state.blink = bl; t.redraw(frac, bl); return true;
    },
  };
}

// Vista previa de la aplicación que se está construyendo (sitio de ejemplo): aparece por bloques con `frac`.
export function makePreviewScreen({ W = 1280, aspect = 1.75, aniso = 8 } = {}) {
  const H = Math.round(W / aspect), state = {};
  const t = canvasTexture(W, H, (c, w, h, frac = 0) => {
    const f = (a, b) => Math.max(0, Math.min(1, (frac - a) / (b - a)));
    c.fillStyle = '#0c0c10'; c.fillRect(0, 0, w, h);
    // marco de navegador
    const bar = Math.round(h * 0.075);
    c.fillStyle = '#16161c'; c.fillRect(0, 0, w, bar);
    ['#4d4c5c', '#4d4c5c', '#4d4c5c'].forEach((col, i) => { c.fillStyle = col; c.beginPath(); c.arc(24 + i * 20, bar / 2, 5.5, 0, 7); c.fill(); });
    c.fillStyle = '#0c0c10'; rr(c, w * 0.16, bar * 0.22, w * 0.5, bar * 0.56, bar * 0.28); c.fill();
    c.fillStyle = '#8d8c9f'; c.font = `500 ${Math.round(bar * 0.34)}px ${FONT_UI}`; c.textBaseline = 'middle'; c.fillText('mi-proyecto.com', w * 0.19, bar / 2 + 1);
    // contenido
    const a1 = f(0.0, 0.2), a2 = f(0.2, 0.45), a3 = f(0.45, 0.75), a4 = f(0.7, 1);
    c.globalAlpha = a1;
    c.fillStyle = '#e6e5ee'; c.font = `700 ${Math.round(h * 0.034)}px ${FONT_UI}`; c.fillText('● miproyecto', w * 0.06, bar + h * 0.07);
    c.font = `500 ${Math.round(h * 0.026)}px ${FONT_UI}`; c.fillStyle = '#9a99ab';
    ['Servicios', 'Casos', 'Contacto'].forEach((s, i) => c.fillText(s, w * (0.66 + i * 0.1), bar + h * 0.07));
    c.globalAlpha = a2;
    c.fillStyle = '#f4f3f9'; c.font = `700 ${Math.round(h * 0.085)}px ${FONT_UI}`; c.fillText('Tu idea,', w * 0.06, bar + h * 0.27); c.fillText('en producción.', w * 0.06, bar + h * 0.38);
    c.fillStyle = '#9a99ab'; c.font = `400 ${Math.round(h * 0.03)}px ${FONT_UI}`; c.fillText('Diseño, desarrollo y despliegue de software a medida.', w * 0.06, bar + h * 0.47);
    c.fillStyle = '#8b5cff'; rr(c, w * 0.06, bar + h * 0.53, w * 0.17, h * 0.08, h * 0.04); c.fill();
    c.fillStyle = '#fff'; c.font = `600 ${Math.round(h * 0.03)}px ${FONT_UI}`; c.fillText('Empezar proyecto', w * 0.08, bar + h * 0.57);
    // ilustración: tarjeta con gráfico a la derecha
    c.globalAlpha = a3;
    c.fillStyle = '#16161c'; rr(c, w * 0.56, bar + h * 0.16, w * 0.38, h * 0.46, 18); c.fill();
    c.strokeStyle = 'rgba(255,255,255,.07)'; c.lineWidth = 2; rr(c, w * 0.56, bar + h * 0.16, w * 0.38, h * 0.46, 18); c.stroke();
    for (let i = 0; i < 7; i++) { const bh = (0.25 + 0.6 * Math.abs(Math.sin(i * 1.7 + 1))) * h * 0.26; c.fillStyle = i === 5 ? '#8b5cff' : '#2a2a34'; rr(c, w * 0.585 + i * w * 0.048, bar + h * 0.55 - bh, w * 0.03, bh, 6); c.fill(); }
    c.globalAlpha = a4;
    for (let i = 0; i < 3; i++) { c.fillStyle = '#14141a'; rr(c, w * (0.06 + i * 0.3), bar + h * 0.7, w * 0.27, h * 0.2, 14); c.fill(); c.fillStyle = '#8b5cff'; c.fillRect(w * (0.08 + i * 0.3), bar + h * 0.735, w * 0.03, 4); c.fillStyle = '#d4d3df'; c.font = `600 ${Math.round(h * 0.03)}px ${FONT_UI}`; c.fillText(['Web a medida', 'Apps y sistemas', 'Soporte continuo'][i], w * (0.08 + i * 0.3), bar + h * 0.79); c.fillStyle = '#6f6e80'; c.font = `400 ${Math.round(h * 0.024)}px ${FONT_UI}`; c.fillText('Rápido, claro y escalable', w * (0.08 + i * 0.3), bar + h * 0.84); }
    c.globalAlpha = 1;
  }, { aniso });
  return { tex: t.tex, W, H, update(frac) { const q = Math.round(frac * 200); if (q === state.q) return false; state.q = q; t.redraw(frac); return true; } };
}
