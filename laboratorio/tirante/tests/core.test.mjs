// Pruebas del núcleo de cálculo contra soluciones analíticas. Ejecutar: npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import { MATERIALS, PROFILES, PROFILE_BY_ID } from '../js/core/catalog.js';
import { cholesky, cholSolve } from '../js/core/linalg.js';
import { addMember, addNode, emptyModel, mergeNodes, splitMember } from '../js/core/model.js';
import { analyze, memberCapacity, vehicleWeights, deckChain } from '../js/core/analysis.js';
import { optimize } from '../js/core/optimize.js';
import { loadToFailure } from '../js/core/failure.js';
import { createCollapse } from '../js/core/physics.js';
import { EXAMPLES } from '../js/core/examples.js';
import { parseProject, serializeProject, toCSV, toSVG, validateModel } from '../js/core/io.js';
import { createStore } from '../js/core/store.js';
import { createPersistence } from '../js/core/persist.js';

const near = (a, b, tol = 1e-6) => assert.ok(Math.abs(a - b) <= tol * Math.max(1, Math.abs(b)), `${a} ≉ ${b}`);

function triangle(load = -100) {
  const m = emptyModel('triángulo');
  m.settings.selfWeight = false;
  const a = addNode(m, 0, 0, { support: 'pin' }).id, b = addNode(m, 4, 0, { support: 'rollerX' }).id;
  const c = addNode(m, 2, 2, { load: { fx: 0, fy: load } }).id;
  addMember(m, a, b); addMember(m, a, c); addMember(m, c, b);
  return m;
}

function miniWarren() {
  const m = emptyModel('warren 2');
  m.settings.selfWeight = false;
  const b0 = addNode(m, 0, 0, { support: 'pin' }).id, b1 = addNode(m, 4, 0).id, b2 = addNode(m, 8, 0, { support: 'rollerX' }).id;
  const t0 = addNode(m, 2, 2).id, t1 = addNode(m, 6, 2).id;
  addMember(m, b0, b1, { deck: true }); addMember(m, b1, b2, { deck: true });
  addMember(m, b0, t0); addMember(m, t0, b1); addMember(m, b1, t1); addMember(m, t1, b2); addMember(m, t0, t1);
  return m;
}

test('Cholesky resuelve un sistema simétrico definido positivo', () => {
  const K = Float64Array.from([4, 12, -16, 12, 37, -43, -16, -43, 98]);
  assert.ok(cholesky(K, 3).ok);
  const x = cholSolve(K, 3, [1, 2, 3]);
  near(4 * x[0] + 12 * x[1] - 16 * x[2], 1); near(12 * x[0] + 37 * x[1] - 43 * x[2], 2); near(-16 * x[0] - 43 * x[1] + 98 * x[2], 3);
});

test('perfil tubular: área e inercia salen de la geometría', () => {
  const p = PROFILE_BY_ID.get('CHS 88.9x4');
  near(p.A * 1e4, 10.67, 2e-3);  // cm², valor de tablas ≈ 10,7
  near(p.I * 1e8, 96.3, 5e-3);   // cm⁴, valor de tablas ≈ 96,3
});

test('triángulo isostático: esfuerzos y reacciones del método de los nudos', () => {
  const r = analyze(triangle(-100));
  assert.ok(r.ok);
  near(r.byId.get('B1').N0, 50);                 // cordón inferior traccionado
  near(r.byId.get('B2').N0, -50 * Math.SQRT2);   // diagonales comprimidas
  near(r.byId.get('B3').N0, -50 * Math.SQRT2);
  const ry = r.reactions.reduce((s, q) => s + q.ry, 0), rx = r.reactions.reduce((s, q) => s + q.rx, 0);
  near(ry, 100); near(rx, 0, 1e-6);
});

test('desplazamiento del vértice coincide con el trabajo virtual', () => {
  const m = triangle(-100), r = analyze(m);
  const p = PROFILE_BY_ID.get('CHS 88.9x4'), EA = MATERIALS.S275.E * p.A;
  // δ = Σ N·n·L / EA con n = N/100 (carga unitaria en el mismo punto)
  const expected = (50 * 0.5 * 4 + 2 * (50 * Math.SQRT2) * (0.5 * Math.SQRT2) * Math.sqrt(8)) / EA;
  near(-r.disp[2 * r.index.get('N3') + 1], expected, 1e-6);
});

test('el peso propio se reparte y equilibra con las reacciones', () => {
  const m = triangle(0); m.nodes[2].load = null; m.settings.selfWeight = true;
  const r = analyze(m);
  near(r.reactions.reduce((s, q) => s + q.ry, 0), (r.totals.mass * 9.80665) / 1000, 1e-9);
});

test('detecta un mecanismo y describe cómo se mueve', () => {
  const m = emptyModel(); m.settings.selfWeight = false;
  const a = addNode(m, 0, 0, { support: 'pin' }).id, b = addNode(m, 4, 0, { support: 'pin' }).id, c = addNode(m, 0, 3).id, d = addNode(m, 4, 3).id;
  addMember(m, a, c); addMember(m, b, d); addMember(m, c, d);
  const r = analyze(m);
  assert.equal(r.status, 'mechanism');
  const i = m.nodes.findIndex((n) => n.id === c);
  assert.ok(Math.abs(r.mode[2 * i]) > 0.5 && Math.abs(r.mode[2 * i + 1]) < 0.05, 'el modo debe ser un desplazamiento lateral');
  addMember(m, a, d);
  assert.ok(analyze(m).ok, 'con una diagonal deja de ser mecanismo');
});

test('sin apoyos suficientes avisa que faltan apoyos', () => {
  const m = triangle(); m.nodes[1].support = null; m.nodes[0].support = 'rollerX';
  assert.equal(analyze(m).status, 'unsupported');
});

test('nudos sueltos no rompen el análisis', () => {
  const m = triangle(); addNode(m, 10, 10);
  assert.ok(analyze(m).ok);
});

test('capacidad: pandeo de Euler gobierna las barras esbeltas', () => {
  const p = PROFILE_BY_ID.get('CHS 48.3x3.2'), mat = MATERIALS.S275;
  const cap = memberCapacity(p, mat, 5, 1);
  near(cap.capC, (Math.PI ** 2 * mat.E * p.I) / 25);
  assert.ok(cap.buckling);
  near(cap.capT, p.A * mat.fy);
  assert.equal(memberCapacity(p, mat, 0.3, 1).buckling, false);
});

test('líneas de influencia y envolvente de la carga móvil', () => {
  const m = miniWarren(); m.settings.moving = { enabled: true, P: 10 };
  const r = analyze(m);
  assert.deepEqual(r.chain.ids, ['N1', 'N2', 'N3']);
  const diag = r.byId.get('B3');                       // diagonal extrema N1–N4
  near(diag.infl[1], -0.5 * Math.SQRT2);               // carga unitaria en el centro
  near(diag.infl[0], 0, 1e-9); near(diag.infl[2], 0, 1e-9); // sobre los apoyos no la exige
  near(diag.Nmin, -5 * Math.SQRT2); near(diag.Nmax, 0, 1e-9);
  const mid = analyze(m, { vehiclePos: 0.25 });        // a mitad del primer tramo: la mitad del efecto
  near(mid.byId.get('B3').Nnow, -2.5 * Math.SQRT2);
  near(mid.reactions.reduce((s, q) => s + q.ry, 0), 10);
  near(mid.reactions.find((q) => q.id === 'N1').ry, 7.5);
});

test('regla de la palanca reparte la carga entre nudos vecinos', () => {
  const chain = deckChain(miniWarren());
  assert.deepEqual(Array.from(vehicleWeights(chain, 0.5)), [0, 1, 0]);
  assert.deepEqual(Array.from(vehicleWeights(chain, 0.875)), [0, 0.25, 0.75]);
});

test('los ejemplos estables resisten y el pórtico es un mecanismo', () => {
  for (const ex of EXAMPLES) {
    const r = analyze(ex.build());
    if (ex.key === 'portico') assert.equal(r.status, 'mechanism');
    else { assert.ok(r.ok, ex.key); assert.ok(r.totals.pass, `${ex.key} aprovechamiento ${r.totals.maxU.toFixed(2)}`); }
  }
});

test('el optimizador aligera sin dejar barras excedidas', () => {
  for (const ex of EXAMPLES.filter((e) => e.key !== 'portico')) {
    const m = ex.build(), o = optimize(m);
    assert.ok(o.ok);
    assert.ok(o.after.pass, `${ex.key} debe resistir (${o.after.maxU.toFixed(3)})`);
    assert.ok(o.after.mass < o.before.mass, `${ex.key} debe pesar menos`);
    const check = analyze(o.model);
    assert.ok(check.totals.maxU <= 1 + 1e-9);
  }
});

test('ensayo destructivo: en una estructura isostática colapsa al fallar la primera barra', () => {
  const m = triangle(-100), r = analyze(m);
  const f = loadToFailure(m);
  assert.ok(f.ok);
  assert.equal(f.events.length, 1);
  near(f.collapseLambda, 1 / (r.totals.maxU / m.settings.safety), 1e-9);
  assert.equal(f.events[0].mode, 'pandeo');
});

test('ensayo destructivo: una estructura hiperestática redistribuye antes de caer', () => {
  const m = emptyModel(); m.settings.selfWeight = false;
  const a = addNode(m, 0, 0, { support: 'pin' }).id, b = addNode(m, 4, 0, { support: 'pin' }).id, c = addNode(m, 0, 3, { load: { fx: 50, fy: 0 } }).id, d = addNode(m, 4, 3).id;
  addMember(m, a, c); addMember(m, b, d); addMember(m, c, d); addMember(m, a, d); addMember(m, b, c);
  const f = loadToFailure(m);
  assert.ok(f.ok && f.events.length >= 2);
  assert.ok(f.collapseLambda >= f.firstLambda);
  for (let i = 1; i < f.events.length; i++) assert.ok(f.events[i].lambda >= f.events[i - 1].lambda);
});

test('ensayo destructivo sin cargas explica por qué no corre', () => {
  const m = triangle(0); m.nodes[2].load = null;
  assert.equal(loadToFailure(m).ok, false);
});

test('la simulación del derrumbe lleva los nudos libres al suelo', () => {
  const m = triangle(-100);
  const sim = createCollapse(m, { removed: ['B2'], groundY: -3 });
  for (let i = 0; i < 600; i++) sim.step(1 / 60);
  assert.ok(sim.particles[2].y < 0, 'el vértice cae');
  assert.equal(sim.particles[0].y, 0); assert.equal(sim.particles[1].y, 0);
  assert.ok(sim.particles.every((p) => p.y >= -3 - 1e-9));
});

test('editar: partir una barra y fundir nudos conservan la conectividad', () => {
  const m = triangle();
  const n = splitMember(m, 'B1', 2, 0);
  assert.equal(m.members.length, 4);
  assert.ok(m.members.some((b) => b.a === 'N1' && b.b === n.id) && m.members.some((b) => b.a === n.id && b.b === 'N2'));
  mergeNodes(m, n.id, 'N1');
  assert.equal(m.nodes.length, 3);
  assert.equal(m.members.length, 3);
  assert.equal(addMember(m, 'N1', 'N2'), null, 'no admite barras duplicadas');
});

test('exportar e importar devuelve el mismo proyecto', () => {
  const m = EXAMPLES[0].build();
  const back = parseProject(serializeProject(m));
  assert.ok(back.ok);
  assert.deepEqual(back.model.nodes, m.nodes);
  assert.deepEqual(back.model.members, m.members);
  assert.deepEqual(back.model.settings, m.settings);
  near(analyze(back.model).totals.maxU, analyze(m).totals.maxU);
});

test('la importación rechaza archivos inválidos con mensajes claros', () => {
  assert.match(parseProject('no soy json').errors[0], /JSON/);
  assert.match(parseProject('{"kind":"otra-cosa"}').errors[0], /no es un proyecto/);
  const bad = validateModel({ nodes: [{ id: 'N1', x: 0, y: 0 }, { id: 'N1', x: 1, y: 'x' }], members: [{ id: 'B1', a: 'N1', b: 'N9', profile: 'CHS 88.9x4' }] });
  assert.equal(bad.ok, false);
  assert.ok(bad.errors.some((e) => /repetido/.test(e)) && bad.errors.some((e) => /no existe/.test(e)));
  assert.equal(validateModel({ nodes: [{ id: 'N1', x: 0, y: 0 }, { id: 'N2', x: 1, y: 0 }], members: [{ id: 'B1', a: 'N1', b: 'N2', profile: 'IPE 200' }] }).ok, false);
});

test('CSV y SVG contienen los resultados', () => {
  const m = triangle(), r = analyze(m);
  const csv = toCSV(m, r);
  assert.equal(csv.trim().split('\r\n').length, 4);
  assert.match(csv, /B2;N1;N3;CHS 88.9x4;2,828;/);
  const svg = toSVG(m, r);
  assert.match(svg, /^<svg/); assert.match(svg, /triángulo/); assert.equal((svg.match(/<line /g) || []).length >= 3, true);
});

test('historial: deshacer, rehacer y arrastres agrupados', () => {
  const s = createStore({ model: triangle(), tool: 'select' });
  s.mutate((m) => { m.nodes[2].y = 5; }, { label: 'mover' });
  s.begin('arrastre');
  s.mutate((m) => { m.nodes[2].x = 3; }, { record: false });
  s.mutate((m) => { m.nodes[2].x = 3.5; }, { record: false });
  s.commit();
  assert.equal(s.get().model.nodes[2].x, 3.5);
  assert.equal(s.undo(), 'arrastre'); assert.equal(s.get().model.nodes[2].x, 2); assert.equal(s.get().model.nodes[2].y, 5);
  s.undo(); assert.equal(s.get().model.nodes[2].y, 2);
  assert.equal(s.canUndo(), false);
  s.redo(); s.redo(); assert.equal(s.get().model.nodes[2].x, 3.5);
  s.undo(); s.mutate((m) => { m.name = 'otro'; }); assert.equal(s.canRedo(), false, 'un cambio nuevo descarta el rehacer');
});

test('persistencia: guarda, recupera, sobrevive a datos corruptos y a un navegador sin almacenamiento', () => {
  const map = new Map();
  const storage = { getItem: (k) => map.get(k) ?? null, setItem: (k, v) => map.set(k, v), removeItem: (k) => map.delete(k) };
  const p = createPersistence(storage), m = triangle();
  assert.ok(p.saveProject(m).ok); p.savePrefs({ theme: 'dark' });
  const again = createPersistence(storage);
  assert.equal(again.list().length, 1); assert.equal(again.currentId(), m.id); assert.equal(again.prefs().theme, 'dark');
  again.deleteProject(m.id); assert.equal(createPersistence(storage).list().length, 0);
  map.set('tirante.v1', '{roto'); assert.equal(createPersistence(storage).corrupted, true);
  const full = { getItem: () => null, setItem: () => { throw new Error('QuotaExceededError'); }, removeItem: () => {} };
  const v = createPersistence(full); assert.equal(v.volatile, true); assert.ok(v.saveProject(m).ok, 'cae a memoria');
});
