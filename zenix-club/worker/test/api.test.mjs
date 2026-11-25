// Prueba de punta a punta de la API con una D1 simulada sobre node:sqlite.
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import worker, { hashSecret } from '../src/index.js';

const sqlite = new DatabaseSync(':memory:');
sqlite.exec(readFileSync(new URL('../schema.sql', import.meta.url), 'utf8'));
class Stmt { constructor(sql, args = []) { this.sql = sql; this.args = args; }
  bind(...a) { return new Stmt(this.sql, a); }
  _p() { return sqlite.prepare(this.sql); }
  async first() { return this._p().get(...this.args) ?? null; }
  async all() { return { results: this._p().all(...this.args) }; }
  async run() { this._p().run(...this.args); return { success: true }; }
  _exec() { return /^\s*select/i.test(this.sql) ? { results: this._p().all(...this.args) } : (this._p().run(...this.args), { results: [] }); } }
const DB = { prepare: s => new Stmt(s), async batch(list) { sqlite.exec('BEGIN'); try { const r = list.map(s => s._exec()); sqlite.exec('COMMIT'); return r; } catch (e) { sqlite.exec('ROLLBACK'); throw e; } } };
const env = { DB, ASSETS: { fetch: async () => new Response('<html><head><title>x</title></head></html>') } };

let tok = '';
async function call(method, path, body, t = tok) {
  const r = await worker.fetch(new Request('https://club.zenix.com.ar/api/' + path, { method, headers: { 'Content-Type': 'application/json', ...(t ? { Authorization: 'Bearer ' + t } : {}) }, body: body ? JSON.stringify(body) : undefined }), env);
  return { status: r.status, ...(await r.json()) };
}

// club de prueba
const now = Date.now();
DB.prepare('INSERT INTO clubs (id,slug,settings,created) VALUES (?,?,?,?)').bind('club1', 'cafe-test', JSON.stringify({ name: 'Café Test', goal: 3, welcome: 1, refBonus: 1, reviewAfter: 2, reviewUrl: 'https://g.page/r/x', minHours: 3 }), now).run();
DB.prepare('INSERT INTO staff (id,club_id,name,role,secret,created) VALUES (?,?,?,?,?,?)').bind('own1', 'club1', 'Dueño', 'owner', await hashSecret('ClaveSegura123'), now).run();

let r = await call('POST', 'login', { club: 'cafe-test', secret: 'mal' }, '');
assert.equal(r.status, 401);
r = await call('POST', 'login', { club: 'cafe-test', secret: 'ClaveSegura123' }, '');
assert.equal(r.status, 200); tok = r.token; assert.equal(r.me.role, 'owner');

r = await call('GET', 'state', null, ''); assert.equal(r.status, 401);
r = await call('POST', 'customers', { name: 'Ana Pérez', phone: '2901 15 471353', birthday: '05-14' });
assert.equal(r.status, 200); const ana = r.customer; assert.equal(ana.stamps, 1);
r = await call('POST', 'customers', { name: 'Otra', phone: '+54 9 2901 471353' }); assert.equal(r.status, 409, 'duplicado por teléfono');

// sello + antifraude
r = await call('POST', 'stamp', { cid: ana.id }); assert.equal(r.status, 200); assert.equal(r.customer.stamps, 2);
r = await call('POST', 'stamp', { cid: ana.id }); assert.equal(r.status, 409); assert.equal(r.code, 'recent');
r = await call('POST', 'stamp', { cid: ana.id, force: true }); assert.equal(r.status, 200); assert.equal(r.customer.stamps, 3); assert.equal(r.events[0].flag, 'forced');

// canje y deshacer
r = await call('POST', 'redeem', { cid: ana.id }); assert.equal(r.customer.stamps, 0); assert.equal(r.customer.redeemed, 1);
r = await call('POST', 'undo', { cid: ana.id }); assert.equal(r.type, 'redeem'); assert.equal(r.customers[0].stamps, 3);

// tarjeta pública en vivo
r = await call('GET', 'card/' + ana.token, null, ''); assert.equal(r.card.c.s, 3); assert.equal(r.card.b.rv, 'https://g.page/r/x', 'pide reseña tras 2 visitas');

// alta por QR con referido
r = await call('GET', 'club/cafe-test', null, ''); assert.equal(r.club.name, 'Café Test');
r = await call('POST', 'join', { club: 'cafe-test', name: 'Beto Gómez', phone: '2901 555111', ref: ana.token }, '');
assert.equal(r.status, 200); const betoTok = r.token;
r = await call('POST', 'join', { club: 'cafe-test', name: 'Beto', phone: '2901555111' }, ''); assert.equal(r.status, 409);
r = await call('GET', 'state');
const beto = r.customers.find(c => c.token === betoTok); assert.equal(beto.ref, ana.id); assert.equal(beto.source, 'qr');
r = await call('POST', 'stamp', { cid: beto.id });
assert.equal(r.customer.stamps, 1 + 1 + 1, 'bienvenida + sello + premio por referido'); assert.equal(r.referrer.stamps, 4);
r = await call('POST', 'undo', { cid: beto.id });
assert.equal(r.customers.find(c => c.id === beto.id).stamps, 1); assert.equal(r.customers.find(c => c.id === ana.id).stamps, 3, 'se revierte el premio del referido');

// empleados
r = await call('POST', 'staff', { name: 'Lucas', pin: '4821' }); assert.equal(r.status, 200);
r = await call('POST', 'login', { club: 'cafe-test', secret: '4821' }, ''); assert.equal(r.me.role, 'staff'); const staffTok = r.token;
r = await call('PUT', 'settings', { goal: 10 }, staffTok); assert.equal(r.status, 403);
r = await call('DELETE', 'customers/' + beto.id, null, staffTok); assert.equal(r.status, 403);
r = await call('POST', 'stamp', { cid: beto.id, force: true }, staffTok); assert.equal(r.events[0].by !== 'own1', true);
r = await call('PUT', 'settings', { goal: 10, reward: 'Desayuno', color: 'rojo' }); assert.equal(r.biz.goal, 10); assert.equal(r.biz.color, '#0f6b4f');
r = await call('GET', 'state'); assert.equal(r.staff.length, 2); assert.equal(r.events.length >= 5, true);
const lucas = r.staff.find(s => s.role === 'staff');
r = await call('DELETE', 'staff/' + lucas.id); assert.equal(r.status, 200);
r = await call('GET', 'state', null, staffTok); assert.equal(r.status, 401, 'sesión del empleado dado de baja');

// límite de intentos
for (let i = 0; i < 8; i++) await call('POST', 'login', { club: 'cafe-test', secret: '0000' }, '');
r = await call('POST', 'login', { club: 'cafe-test', secret: 'ClaveSegura123' }, ''); assert.equal(r.status, 429);

// cambio de contraseña
r = await call('POST', 'password', { current: 'ClaveSegura123', password: 'OtraClave2026' }); assert.equal(r.status, 200);
console.log('✓ API de Zenix Club: todas las pruebas pasaron');
