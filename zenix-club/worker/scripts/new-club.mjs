// Alta de un comercio nuevo en Zenix Club.
// Uso: node scripts/new-club.mjs <codigo> "<Nombre del comercio>" [emoji] [color]
// Imprime la contraseña del dueño y el SQL; correlo con:
//   npx wrangler d1 execute zenix-club --remote --command "<SQL>"
import { webcrypto as crypto } from 'node:crypto';
globalThis.crypto ??= crypto;
const { hashSecret } = await import('../src/index.js');

const [slug, name, emoji = '☕', color = '#0f6b4f'] = process.argv.slice(2);
if (!/^[a-z0-9-]{2,40}$/.test(slug || '') || !name) {
  console.error('Uso: node scripts/new-club.mjs <codigo-en-minusculas> "<Nombre>" [emoji] [#color]'); process.exit(1);
}
const ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
const rand = n => Array.from(crypto.getRandomValues(new Uint8Array(n)), x => ALPHA[x % ALPHA.length]).join('');
const password = rand(4) + '-' + rand(4) + '-' + rand(2) + String(10 + (crypto.getRandomValues(new Uint8Array(1))[0] % 90));
const q = s => "'" + String(s).replace(/'/g, "''") + "'";
const clubId = rand(12), now = Date.now();
const settings = { name, emoji, color, goal: 8, welcome: 1, reward: 'Un café gratis', doubleDay: '', phone: '', birthdayGift: 'Un detalle de la casa', address: '', refBonus: 1, reviewUrl: '', reviewAfter: 3, minHours: 3 };
const sql = `INSERT INTO clubs (id,slug,settings,created) VALUES (${q(clubId)},${q(slug)},${q(JSON.stringify(settings))},${now}); INSERT INTO staff (id,club_id,name,role,secret,created) VALUES (${q(rand(12))},${q(clubId)},'Dueño','owner',${q(await hashSecret(password))},${now});`;
console.log(`Club: ${slug}\nContraseña del dueño: ${password}\n\nSQL:\n${sql}`);
