// SQLite database connection and schema. SQLite is a real SQL database that lives in one
// file, so there is nothing to install or run separately. The schema is created on first use.

const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const dataDir = path.join(__dirname, '..', 'data');
fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(path.join(dataDir, 'salon.sqlite'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT    NOT NULL,
  email         TEXT    NOT NULL UNIQUE,
  password_hash TEXT    NOT NULL,
  phone         TEXT,
  -- 'customer', 'staff' or 'admin'. Staff members also get a row in the staff table.
  role          TEXT    NOT NULL DEFAULT 'customer',
  preferences   TEXT,                           -- free-text notes the customer can edit
  created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS services (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  name         TEXT    NOT NULL,
  description  TEXT,
  duration_min INTEGER NOT NULL,                -- how long the service takes, in minutes
  price        REAL    NOT NULL,
  active       INTEGER NOT NULL DEFAULT 1       -- 0 hides it from the booking list
);

CREATE TABLE IF NOT EXISTS staff (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id        INTEGER UNIQUE REFERENCES users(id) ON DELETE SET NULL,
  name           TEXT    NOT NULL,
  specialization TEXT,
  -- Working hours, same every day for simplicity, as "HH:MM" 24-hour times.
  work_start     TEXT    NOT NULL DEFAULT '09:00',
  work_end       TEXT    NOT NULL DEFAULT '17:00'
);

-- Which services each staff member can perform.
CREATE TABLE IF NOT EXISTS staff_services (
  staff_id   INTEGER NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  PRIMARY KEY (staff_id, service_id)
);

CREATE TABLE IF NOT EXISTS appointments (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  staff_id    INTEGER NOT NULL REFERENCES staff(id),
  service_id  INTEGER NOT NULL REFERENCES services(id),
  start_time  TEXT    NOT NULL,                 -- ISO date-time, e.g. 2026-11-01T10:00
  end_time    TEXT    NOT NULL,
  status      TEXT    NOT NULL DEFAULT 'booked',-- 'booked', 'cancelled', 'completed'
  payment_status TEXT NOT NULL DEFAULT 'unpaid',-- 'unpaid', 'paid'
  reminder_sent  INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS reviews (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  appointment_id INTEGER UNIQUE REFERENCES appointments(id) ON DELETE CASCADE,
  user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  staff_id      INTEGER NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  rating        INTEGER NOT NULL,               -- 1 to 5
  comment       TEXT,
  staff_reply   TEXT,
  created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);
`);

module.exports = db;
