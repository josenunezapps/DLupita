// Estructuras de ejemplo. Son datos de demostración: geometrías típicas con cargas inventadas.
import { addMember, addNode, emptyModel } from './model.js';

function base(name, profile) {
  const m = emptyModel(name);
  m.example = true;
  const node = (x, y, extra) => addNode(m, x, y, extra).id;
  const bar = (a, b, extra = {}) => addMember(m, a, b, { profile, ...extra });
  return { m, node, bar };
}

function warren() {
  const { m, node, bar } = base('Puente Warren de 24 m', 'CHS 168.3x6.3');
  const bottom = [], top = [];
  for (let i = 0; i <= 6; i++) bottom.push(node(i * 4, 0, i === 0 ? { support: 'pin' } : i === 6 ? { support: 'rollerX' } : { load: { fx: 0, fy: -25 } }));
  for (let i = 0; i < 6; i++) top.push(node(i * 4 + 2, 3.5));
  for (let i = 0; i < 6; i++) { bar(bottom[i], bottom[i + 1], { deck: true }); bar(bottom[i], top[i]); bar(top[i], bottom[i + 1]); }
  for (let i = 0; i < 5; i++) bar(top[i], top[i + 1]);
  m.settings.moving = { enabled: true, P: 180 };
  return m;
}

function prattOrHowe(kind) {
  const pratt = kind === 'pratt';
  const panel = pratt ? 5 : 3, h = pratt ? 5 : 3;
  const { m, node, bar } = base(pratt ? 'Puente Pratt de 30 m' : 'Pasarela Howe de 18 m', pratt ? 'CHS 219.1x8' : 'CHS 114.3x4');
  const bottom = [], top = [null];
  for (let i = 0; i <= 6; i++) bottom.push(node(i * panel, 0, i === 0 ? { support: 'pin' } : i === 6 ? { support: 'rollerX' } : { load: { fx: 0, fy: pratt ? -40 : -12 } }));
  for (let i = 1; i <= 5; i++) top.push(node(i * panel, h));
  for (let i = 0; i < 6; i++) bar(bottom[i], bottom[i + 1], { deck: true });
  for (let i = 1; i < 5; i++) bar(top[i], top[i + 1]);
  for (let i = 1; i <= 5; i++) bar(bottom[i], top[i]);
  bar(bottom[0], top[1]); bar(bottom[6], top[5]);
  if (pratt) { bar(top[1], bottom[2]); bar(top[2], bottom[3]); bar(top[4], bottom[3]); bar(top[5], bottom[4]); }
  else { bar(bottom[1], top[2]); bar(bottom[2], top[3]); bar(bottom[4], top[3]); bar(bottom[5], top[4]); }
  m.settings.moving = { enabled: true, P: pratt ? 250 : 40 };
  return m;
}

function bowstring() {
  const { m, node, bar } = base('Arco atirantado de 32 m', 'CHS 219.1x8');
  const L = 32, rise = 6, bottom = [], top = [];
  for (let i = 0; i <= 8; i++) bottom.push(node(i * 4, 0, i === 0 ? { support: 'pin' } : i === 8 ? { support: 'rollerX' } : { load: { fx: 0, fy: -30 } }));
  top[0] = bottom[0]; top[8] = bottom[8];
  for (let i = 1; i < 8; i++) { const x = i * 4; top[i] = node(x, Math.round(((4 * rise * x * (L - x)) / (L * L)) * 100) / 100); }
  for (let i = 0; i < 8; i++) { bar(bottom[i], bottom[i + 1], { deck: true }); bar(top[i], top[i + 1]); }
  for (let i = 1; i < 8; i++) bar(bottom[i], top[i]);
  for (let i = 1; i < 4; i++) bar(bottom[i], top[i + 1]);
  for (let i = 5; i < 8; i++) bar(bottom[i], top[i - 1]);
  m.settings.moving = { enabled: true, P: 200 };
  return m;
}

function cantilever() {
  const { m, node, bar } = base('Ménsula de 10 m', 'CHS 114.3x4');
  const b0 = node(0, 0, { support: 'pin' }), t0 = node(0, 3, { support: 'pin' });
  const bottom = [b0], top = [t0];
  for (let i = 1; i <= 3; i++) { bottom.push(node(i * 2.5, 0)); top.push(node(i * 2.5, 3 - i * 0.75)); }
  const tip = node(10, 0, { load: { fx: 0, fy: -40 } });
  for (let i = 0; i < 3; i++) { bar(bottom[i], bottom[i + 1]); bar(top[i], top[i + 1]); bar(bottom[i + 1], top[i + 1]); bar(top[i], bottom[i + 1]); }
  bar(bottom[3], tip); bar(top[3], tip);
  return m;
}

function wobblyFrame() {
  const { m, node, bar } = base('Pórtico que se cae (arreglalo)', 'CHS 114.3x4');
  const a = node(0, 0, { support: 'pin' }), b = node(6, 0, { support: 'pin' });
  const c = node(0, 4, { load: { fx: 20, fy: 0 } }), d = node(6, 4);
  bar(a, c); bar(b, d); bar(c, d);
  return m;
}

export const EXAMPLES = [
  { key: 'warren', title: 'Puente Warren', blurb: 'Triángulos iguales, 24 m, con vehículo.', build: warren },
  { key: 'pratt', title: 'Puente Pratt', blurb: 'Diagonales traccionadas, 30 m.', build: () => prattOrHowe('pratt') },
  { key: 'howe', title: 'Pasarela Howe', blurb: 'Diagonales comprimidas, 18 m.', build: () => prattOrHowe('howe') },
  { key: 'arco', title: 'Arco atirantado', blurb: 'Cordón superior parabólico, 32 m.', build: bowstring },
  { key: 'mensula', title: 'Ménsula', blurb: 'Voladizo de 10 m con carga en la punta.', build: cantilever },
  { key: 'portico', title: 'Pórtico inestable', blurb: 'Le falta una diagonal: miralo moverse y arreglalo.', build: wobblyFrame },
];

export const buildExample = (key) => (EXAMPLES.find((e) => e.key === key) || EXAMPLES[0]).build();
