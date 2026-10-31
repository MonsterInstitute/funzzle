-- One row per UTC day: the latest DeepSeek balance seen by the explain cron,
-- the 7-day spend it was compared with, and when a low-balance alert went out.
CREATE TABLE IF NOT EXISTS deepseek_balance (
  day TEXT PRIMARY KEY,
  checked_at TEXT NOT NULL,
  currency TEXT NOT NULL,
  total REAL NOT NULL,
  granted REAL NOT NULL DEFAULT 0,
  topped_up REAL NOT NULL DEFAULT 0,
  is_available INTEGER NOT NULL,
  spend_7d_usd REAL NOT NULL DEFAULT 0,
  days_left REAL,
  alerted_at TEXT
);
