-- Funzzle's application database (D1 binding DB, database funzzle-db).
-- Replaces the Supabase Postgres schema (supabase/migrations, kept for history).
--
-- Conventions (docs/cloudflare-stack.md):
--   * dates are 'YYYY-MM-DD' TEXT, timestamps ISO-8601 UTC TEXT
--   * JSON columns are TEXT holding JSON (read with JSON.parse / json_extract)
--   * booleans are INTEGER 0/1
--   * upserts use INSERT … ON CONFLICT(<unique key>) DO UPDATE / DO NOTHING

-- Daily NYT answers (Wordle, Connections, Mini). One row per (date, type).
CREATE TABLE answers (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  puzzle_id    INTEGER,
  publish_date TEXT NOT NULL,
  type         TEXT NOT NULL,
  answer_data  TEXT NOT NULL,
  summary      TEXT,
  created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (publish_date, type)
);

CREATE TABLE clues (
  slug        TEXT PRIMARY KEY,
  clue_text   TEXT NOT NULL,
  answer      TEXT NOT NULL,
  source      TEXT NOT NULL DEFAULT 'nyt-mini',
  explanation TEXT,
  appearances INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE puzzles (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  slug         TEXT NOT NULL UNIQUE,
  type         TEXT NOT NULL,
  publish_date TEXT NOT NULL,
  title        TEXT,
  size         INTEGER,
  grid         TEXT,
  clues        TEXT,
  created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX puzzles_publish_date_type ON puzzles (publish_date, type);

CREATE TABLE email_subscribers (
  id                TEXT PRIMARY KEY,
  email             TEXT NOT NULL UNIQUE,
  created_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  unsubscribe_token TEXT NOT NULL UNIQUE,
  unsubscribed      INTEGER NOT NULL DEFAULT 0
);

-- Funzzle's own daily puzzles (Sudoku grid, Solitaire deals), stored ahead of time.
CREATE TABLE daily_puzzles (
  game        TEXT NOT NULL,
  puzzle_date TEXT NOT NULL,
  variant     TEXT NOT NULL DEFAULT '',
  data        TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (game, puzzle_date, variant)
);

-- Anonymous daily results; a browser's first result for a puzzle counts.
CREATE TABLE game_results (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  game        TEXT NOT NULL,
  puzzle_date TEXT NOT NULL,
  variant     TEXT NOT NULL DEFAULT '',
  client_id   TEXT NOT NULL,
  time_ms     INTEGER NOT NULL CHECK (time_ms > 0),
  mistakes    INTEGER NOT NULL DEFAULT 0,
  hints       INTEGER NOT NULL DEFAULT 0,
  moves       INTEGER,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (game, puzzle_date, variant, client_id)
);
CREATE INDEX game_results_day_time ON game_results (game, puzzle_date, variant, time_ms);

-- AI Coach text per (puzzle, solver step), written ahead of time by the coach cron.
CREATE TABLE coach_explanations (
  game        TEXT NOT NULL,
  puzzle_date TEXT NOT NULL,
  step_key    TEXT NOT NULL,
  text        TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (game, puzzle_date, step_key)
);

-- One row per cron job run: proof each schedule fires, and what it did.
CREATE TABLE cron_runs (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  job         TEXT NOT NULL,
  cron        TEXT,
  started_at  TEXT NOT NULL,
  finished_at TEXT NOT NULL,
  ok          INTEGER NOT NULL,
  detail      TEXT
);
CREATE INDEX cron_runs_job_started ON cron_runs (job, started_at);

-- LLM spend, one row per API call (weekly report cost section).
CREATE TABLE llm_usage (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  day               TEXT NOT NULL,
  job               TEXT NOT NULL,
  model             TEXT NOT NULL,
  prompt_tokens     INTEGER NOT NULL DEFAULT 0,
  cache_hit_tokens  INTEGER NOT NULL DEFAULT 0,
  completion_tokens INTEGER NOT NULL DEFAULT 0,
  cost_usd          REAL NOT NULL DEFAULT 0,
  created_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX llm_usage_day ON llm_usage (day);
