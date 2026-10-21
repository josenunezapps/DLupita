import { canvasTexture } from './util.js';

// Pantallas de código con resaltado de sintaxis, escritas en un canvas que se usa como textura de un monitor 3D.
// Todo el contenido es de ejemplo (no representa proyectos ni resultados reales).

const COLORS = {
  kw: '#c792ff', str: '#7fe0ff', num: '#ffc66b', com: '#6c6796', fn: '#7aa8ff', tag: '#ff7eb6', attr: '#b69bff',
  pun: '#c9c3ec', txt: '#e8e4ff', ok: '#6ee7a8', warn: '#ffc66b', err: '#ff7a8a', dim: '#7d77a6', cyan: '#5eead4', var: '#e2dcff',
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

// Crea una pantalla de código con revelado progresivo ("tipeo"). `aspect` = ancho/alto de la pantalla física.
export function makeCodeScreen(kind, { W = 1024, aspect = 1.74, aniso = 4 } = {}) {
  const H = Math.round(W / aspect);
  const sn = SNIPPETS[kind];
  const lines = sn.src.split('\n').map((l) => tokenize(l, sn.lang));
  const total = sn.src.replace(/\n/g, '').length;
  const fs = Math.round(W / 36), lh = Math.round(fs * 1.38);
  const state = { frac: -1, blink: 0 };

  const t = canvasTexture(W, H, (ctx, w, h, frac = 0, blink = 1) => {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#0d0b20'); g.addColorStop(1, '#090716');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    // barra de pestañas
    const th = Math.round(h * 0.075);
    ctx.fillStyle = '#120f2a'; ctx.fillRect(0, 0, w, th);
    ctx.fillStyle = '#1b1740'; ctx.fillRect(14, 8, Math.round(w * 0.24), th - 8);
    ctx.fillStyle = sn.accent; ctx.fillRect(14, 8, Math.round(w * 0.24), 3);
    ctx.font = `600 ${Math.round(fs * 0.72)}px ui-sans-serif, system-ui, sans-serif`;
    ctx.fillStyle = '#e8e4ff'; ctx.textBaseline = 'middle';
    ctx.fillText(sn.file, 30, th / 2 + 4);
    ctx.fillStyle = '#6c6796'; ctx.textAlign = 'right';
    ctx.fillText(sn.lang === 'js' ? 'JavaScript' : sn.lang.toUpperCase(), w - 18, th / 2 + 2);
    ctx.textAlign = 'left';
    // editor (con desplazamiento automático: como en un editor real, el texto sube al llegar al borde)
    const gut = Math.round(fs * 2.6);
    ctx.font = `${fs}px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`;
    ctx.textBaseline = 'alphabetic';
    const sbH = Math.round(h * 0.07);
    const top = th + lh * 1.15;
    const cap = Math.max(4, Math.floor((h - sbH - top) / lh) + 1);
    const cw = ctx.measureText('M').width;
    let left = Math.round(total * frac), cur = 0, rem = left;
    for (let i = 0; i < lines.length; i++) {
      const len = lines[i].reduce((a, b) => a + b[0].length, 0);
      if (rem <= len) { cur = i; break; }
      rem -= len; cur = Math.min(i + 1, lines.length - 1);
    }
    const first = Math.max(0, cur - cap + 2);
    let cx = gut + 10, cy = top;
    for (let i = first; i < lines.length; i++) {
      if (left <= 0) break;
      const y = top + (i - first) * lh;
      if (y > h - sbH) break;
      ctx.fillStyle = '#4a4470'; ctx.textAlign = 'right';
      ctx.fillText(String(i + 1), gut - 14, y); ctx.textAlign = 'left';
      let x = gut + 10;
      for (const [txt, c] of lines[i]) {
        if (left <= 0) break;
        const part = txt.slice(0, left);
        ctx.fillStyle = COLORS[c] || COLORS.txt;
        ctx.fillText(part, x, y);
        x += cw * part.length; left -= part.length;
        if (part.length < txt.length) { left = 0; break; }
      }
      cx = x; cy = y;
    }
    // cursor
    if (blink > 0.5 || frac < 1) {
      ctx.fillStyle = sn.accent; ctx.globalAlpha = 0.9;
      ctx.fillRect(cx + 2, cy - fs * 0.82, Math.max(3, cw * 0.55), fs * 1.02);
      ctx.globalAlpha = 1;
    }
    // minimapa y barra de estado
    ctx.fillStyle = 'rgba(167,139,250,.14)';
    for (let i = 0; i < Math.min(lines.length, 28); i++) {
      const wlen = Math.min(lines[i].reduce((a, b) => a + b[0].length, 0) * 3.2, w * 0.1);
      if (i / lines.length <= frac + 0.02) ctx.fillRect(w - w * 0.12, th + 18 + i * 6, wlen, 3);
    }
    const sb = Math.round(h * 0.07);
    ctx.fillStyle = '#17123a'; ctx.fillRect(0, h - sb, w, sb);
    ctx.fillStyle = sn.accent; ctx.fillRect(0, h - sb, 6, sb);
    ctx.font = `600 ${Math.round(fs * 0.66)}px ui-monospace, Menlo, monospace`;
    ctx.fillStyle = '#b8b0e8'; ctx.textBaseline = 'middle';
    ctx.fillText(`main  ✓ 0 errores   ${Math.round(frac * 100)}%`, 22, h - sb / 2 + 1);
    ctx.textBaseline = 'alphabetic';
  }, { aniso });

  return {
    tex: t.tex, W, H,
    update(frac, time) {
      const q = Math.round(frac * total);               // solo redibuja si cambia la cantidad de caracteres visibles
      const bl = frac >= 1 ? (Math.floor(time * 1.6) % 2) : 1;
      if (q === state.q && bl === state.blink) return false;
      state.q = q; state.blink = bl; state.frac = frac;
      t.redraw(frac, bl);
      return true;
    },
  };
}

export function makeTerminalScreen(kind, { W = 768, aspect = 1.6, aniso = 4 } = {}) {
  const H = Math.round(W / aspect);
  const sn = TERMINALS[kind];
  const total = sn.lines.reduce((a, l) => a + l[0].length + 1, 0);
  const fs = Math.round(W / 31), lh = Math.round(fs * 1.4);
  const state = {};
  const t = canvasTexture(W, H, (ctx, w, h, frac = 0, blink = 1) => {
    ctx.fillStyle = '#05040d'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#100d26'; ctx.fillRect(0, 0, w, Math.round(h * 0.09));
    ['#ff6b8b', '#ffc66b', '#6ee7a8'].forEach((c, i) => { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(20 + i * 22, Math.round(h * 0.045), 6, 0, 7); ctx.fill(); });
    ctx.font = `600 ${Math.round(fs * 0.66)}px ui-sans-serif, system-ui, sans-serif`;
    ctx.fillStyle = '#9b93cf'; ctx.textBaseline = 'middle'; ctx.fillText(sn.file, 92, Math.round(h * 0.047));
    ctx.font = `${fs}px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`;
    ctx.textBaseline = 'alphabetic';
    const top0 = Math.round(h * 0.09) + lh * 1.2;
    const cap = Math.max(4, Math.floor((h - 50 - top0) / lh) + 1);
    const cw = ctx.measureText('M').width;
    let left = Math.round(total * frac), used = 0, shown = 0, rem = left;
    for (let i = 0; i < sn.lines.length; i++) { if (rem <= 0) break; shown = i + 1; rem -= sn.lines[i][0].length + 1; }
    const first = Math.max(0, shown - cap);
    let cx = 22, cy = top0;
    for (let i = first; i < sn.lines.length; i++) {
      if (left <= 0) break;
      const [txt, c] = sn.lines[i];
      const y = top0 + (i - first) * lh;
      const part = txt.slice(0, left);
      ctx.fillStyle = COLORS[c] || COLORS.txt; ctx.fillText(part, 22, y);
      cx = 22 + cw * part.length; cy = y; left -= part.length + 1;
    }
    ctx.fillStyle = '#5eead4'; if (blink > 0.5 || frac < 1) ctx.fillRect(cx + 4, cy - fs * 0.8, cw * 0.6, fs);
    // barra de progreso inferior
    ctx.fillStyle = '#17123a'; ctx.fillRect(22, h - 34, w - 44, 8);
    ctx.fillStyle = '#5eead4'; ctx.fillRect(22, h - 34, (w - 44) * frac, 8);
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
