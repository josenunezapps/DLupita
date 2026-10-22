// Cálculo de estadísticas de lectura a partir de las sesiones guardadas.
import { db } from './db.js';
import { startOfDay } from './util.js';

const DAY = 86400000;

export async function computeStats() {
  const [sessions, books] = await Promise.all([db.all('sessions'), db.all('books')]);
  const today = startOfDay();
  const weekStart = (() => { const d = new Date(today); const wd = (d.getDay() + 6) % 7; return today - wd * DAY; })();
  const monthStart = (() => { const d = new Date(today); d.setDate(1); return d.getTime(); })();
  let total = 0, todayMs = 0, week = 0, month = 0, pages = 0;
  const perDay = new Map();
  for (const s of sessions) {
    const dur = s.duration || 0;
    total += dur; pages += s.pagesRead || 0;
    if (s.startedAt >= today) todayMs += dur;
    if (s.startedAt >= weekStart) week += dur;
    if (s.startedAt >= monthStart) month += dur;
    const d = startOfDay(new Date(s.startedAt));
    perDay.set(d, (perDay.get(d) || 0) + dur);
  }
  const last14 = [];
  for (let i = 13; i >= 0; i--) { const d = today - i * DAY; last14.push({ day: d, ms: perDay.get(d) || 0 }); }
  const last30 = [...perDay.entries()].filter(([d]) => d > today - 30 * DAY).reduce((a, [, v]) => a + v, 0);
  const activeDays = [...perDay.values()].filter(v => v > 0).length;
  // racha: días consecutivos con lectura hasta hoy (o ayer)
  let streak = 0; let cursor = perDay.get(today) ? today : today - DAY;
  while (perDay.get(cursor)) { streak++; cursor -= DAY; }
  const visible = books.filter(b => !b.archived);
  return {
    total, today: todayMs, week, month, pages,
    sessions: sessions.length,
    avgDaily: last30 / 30,
    activeDays, streak,
    finished: books.filter(b => b.status === 'finished').length,
    reading: visible.filter(b => b.status === 'reading').length,
    unread: visible.filter(b => b.status === 'unread').length,
    avgProgress: visible.length ? visible.reduce((a, b) => a + (b.progress || 0), 0) / visible.length : 0,
    last14, books, sessionsList: sessions,
  };
}

export async function bookStats(bookId) {
  const sessions = (await db.byIndex('sessions', 'bookId', bookId)).sort((a, b) => b.startedAt - a.startedAt);
  const total = sessions.reduce((a, s) => a + (s.duration || 0), 0);
  const pages = sessions.reduce((a, s) => a + (s.pagesRead || 0), 0);
  return { sessions, total, pages, count: sessions.length, avg: sessions.length ? total / sessions.length : 0 };
}
