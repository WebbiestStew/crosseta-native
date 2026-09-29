import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS devices (
  id            TEXT PRIMARY KEY,
  secret_hash   TEXT NOT NULL,
  created_at    INTEGER NOT NULL,
  push_token    TEXT,
  lang          TEXT NOT NULL DEFAULT 'en',
  quiet_json    TEXT,
  rules_json    TEXT NOT NULL DEFAULT '[]',
  tz_offset_min INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS devices_push ON devices(push_token) WHERE push_token IS NOT NULL;

CREATE TABLE IF NOT EXISTS alert_state (
  device_id   TEXT NOT NULL,
  crossing_id TEXT NOT NULL,
  prev_wait   INTEGER,
  last_high   INTEGER NOT NULL DEFAULT 0,
  last_drop   INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (device_id, crossing_id)
);

CREATE TABLE IF NOT EXISTS trips (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  device_id   TEXT NOT NULL,
  crossing_id TEXT NOT NULL,
  lane        TEXT NOT NULL,
  start_ms    INTEGER NOT NULL,
  end_ms      INTEGER NOT NULL,
  wait_min    INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS trips_recent ON trips(crossing_id, end_ms);

CREATE TABLE IF NOT EXISTS reports (
  id            TEXT PRIMARY KEY,
  device_id     TEXT NOT NULL,
  crossing_id   TEXT NOT NULL,
  crossing_name TEXT NOT NULL,
  border        TEXT NOT NULL,
  lane          TEXT NOT NULL,
  wait_min      INTEGER NOT NULL,
  note          TEXT NOT NULL DEFAULT '',
  author        TEXT NOT NULL,
  initials      TEXT NOT NULL,
  color         TEXT NOT NULL,
  created_at    INTEGER NOT NULL,
  hidden        INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS reports_recent ON reports(crossing_id, created_at);

CREATE TABLE IF NOT EXISTS report_votes (
  report_id TEXT NOT NULL,
  device_id TEXT NOT NULL,
  value     INTEGER NOT NULL,
  PRIMARY KEY (report_id, device_id)
);

CREATE TABLE IF NOT EXISTS report_flags (
  report_id TEXT NOT NULL,
  device_id TEXT NOT NULL,
  PRIMARY KEY (report_id, device_id)
);

CREATE TABLE IF NOT EXISTS history (
  crossing_id TEXT NOT NULL,
  bucket      INTEGER NOT NULL,
  prior_sum   REAL NOT NULL,
  prior_days  INTEGER NOT NULL,
  day_key     INTEGER NOT NULL,
  day_mean    REAL NOT NULL,
  day_n       INTEGER NOT NULL,
  PRIMARY KEY (crossing_id, bucket)
);

CREATE TABLE IF NOT EXISTS crossing_meta (
  crossing_id TEXT PRIMARY KEY,
  tz_offset_h REAL
);
`;

export const openDb = (path) => {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec(SCHEMA);
  return db;
};
