-- Zenix Club · esquema D1 (multi-comercio)
CREATE TABLE IF NOT EXISTS clubs (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  settings TEXT NOT NULL,            -- JSON: nombre, ícono, color, meta, premio, etc.
  created INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS staff (
  id TEXT PRIMARY KEY,
  club_id TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL,                -- owner | staff
  secret TEXT NOT NULL,              -- pbkdf2 de la contraseña (dueño) o PIN (empleado)
  active INTEGER NOT NULL DEFAULT 1,
  created INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS staff_club ON staff(club_id);
CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,            -- sha256 del token
  club_id TEXT NOT NULL,
  staff_id TEXT NOT NULL,
  expires INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS customers (
  id TEXT PRIMARY KEY,
  club_id TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,        -- link público de la tarjeta
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  phone_norm TEXT NOT NULL,
  birthday TEXT NOT NULL DEFAULT '',
  created INTEGER NOT NULL,
  last INTEGER NOT NULL,
  stamps INTEGER NOT NULL DEFAULT 0,
  total INTEGER NOT NULL DEFAULT 0,
  visits INTEGER NOT NULL DEFAULT 0,
  redeemed INTEGER NOT NULL DEFAULT 0,
  referred_by TEXT,                  -- id del cliente que lo recomendó
  ref_paid INTEGER NOT NULL DEFAULT 0,
  source TEXT NOT NULL DEFAULT 'counter', -- counter | qr
  UNIQUE (club_id, phone_norm)
);
CREATE INDEX IF NOT EXISTS customers_club ON customers(club_id);
CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  club_id TEXT NOT NULL,
  cid TEXT NOT NULL,
  ts INTEGER NOT NULL,
  type TEXT NOT NULL,                -- join | stamp | redeem | ref
  n INTEGER NOT NULL DEFAULT 0,
  staff_id TEXT,
  flag TEXT                          -- 'forced' si se sumó pese al aviso antifraude
);
CREATE INDEX IF NOT EXISTS events_club_ts ON events(club_id, ts);
CREATE INDEX IF NOT EXISTS events_cid ON events(cid, ts);
CREATE TABLE IF NOT EXISTS attempts (
  key TEXT PRIMARY KEY,
  count INTEGER NOT NULL,
  reset INTEGER NOT NULL
);
