-- Engagement layer (Game Kit): reminders, friend challenges, leagues.
-- Additive only: the code live before this deploy keeps working.

-- Daily reminder emails: at most one per UTC day.
ALTER TABLE email_subscribers ADD COLUMN last_sent_day TEXT;

-- Web push subscriptions (PWA), one per browser endpoint.
CREATE TABLE push_subscriptions (
  endpoint      TEXT PRIMARY KEY,
  p256dh        TEXT NOT NULL,
  auth          TEXT NOT NULL,
  client_id     TEXT NOT NULL,
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  last_sent_day TEXT,
  failures      INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX push_subscriptions_client ON push_subscriptions (client_id);

-- Friend challenges: a link to one puzzle and the creator's result; each
-- friend who finishes adds an entry. No login: client ids + display names.
CREATE TABLE challenges (
  id          TEXT PRIMARY KEY,
  game        TEXT NOT NULL,
  puzzle      TEXT NOT NULL,          -- JSON ChallengePuzzle (lib/games/kit/challenge.ts)
  label       TEXT NOT NULL,          -- e.g. "Daily Sudoku · Oct 24 · Expert"
  created_by  TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE challenge_entries (
  challenge_id TEXT NOT NULL REFERENCES challenges (id),
  client_id    TEXT NOT NULL,
  name         TEXT NOT NULL,
  time_ms      INTEGER NOT NULL CHECK (time_ms > 0),
  mistakes     INTEGER NOT NULL DEFAULT 0,
  hints        INTEGER NOT NULL DEFAULT 0,
  moves        INTEGER,
  created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (challenge_id, client_id)
);

-- Private leagues joined with an invite code; weekly boards come from
-- game_results of the members' client ids.
CREATE TABLE leagues (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  code       TEXT NOT NULL UNIQUE,
  name       TEXT NOT NULL,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE league_members (
  league_id INTEGER NOT NULL REFERENCES leagues (id),
  client_id TEXT NOT NULL,
  name      TEXT NOT NULL,
  joined_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (league_id, client_id)
);
CREATE INDEX league_members_client ON league_members (client_id);

-- League boards read a week of results by client id.
CREATE INDEX game_results_client_date ON game_results (client_id, puzzle_date);
