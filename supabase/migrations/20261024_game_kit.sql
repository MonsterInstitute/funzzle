-- Funzzle Game Kit: daily puzzles, anonymous results, cached coach text, events.
-- Applied with the Supabase Management API (database/query). Every table is
-- RLS-on with no policies: only the service-role key (server routes) reads or
-- writes them.

-- One puzzle per game per UTC day; everyone gets the same one. `variant`
-- separates e.g. Solitaire draw-1 / draw-3 deals ('' when there is one).
CREATE TABLE IF NOT EXISTS public.daily_puzzles (
  game text NOT NULL,
  puzzle_date date NOT NULL,
  variant text NOT NULL DEFAULT '',
  data jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (game, puzzle_date, variant)
);

-- Anonymous daily results for "faster than N% of today's players". One row per
-- browser (client_id is a random id kept in local storage) per puzzle.
CREATE TABLE IF NOT EXISTS public.game_results (
  id bigserial PRIMARY KEY,
  game text NOT NULL,
  puzzle_date date NOT NULL,
  variant text NOT NULL DEFAULT '',
  client_id uuid NOT NULL,
  time_ms integer NOT NULL CHECK (time_ms > 0),
  mistakes smallint NOT NULL DEFAULT 0,
  hints smallint NOT NULL DEFAULT 0,
  moves integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (game, puzzle_date, variant, client_id)
);
CREATE INDEX IF NOT EXISTS game_results_day_time
  ON public.game_results (game, puzzle_date, variant, time_ms);

-- Coach explanations written ahead of time (Daily Content workflow, DeepSeek)
-- for the daily puzzle's solve path, so a hint costs a row read, not an LLM call.
CREATE TABLE IF NOT EXISTS public.coach_explanations (
  game text NOT NULL,
  puzzle_date date NOT NULL,
  step_key text NOT NULL,
  text text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (game, puzzle_date, step_key)
);

-- Product analytics: game_start, game_complete, hint_used, share, return_visit.
CREATE TABLE IF NOT EXISTS public.game_events (
  id bigserial PRIMARY KEY,
  event text NOT NULL,
  game text,
  client_id uuid,
  props jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS game_events_created ON public.game_events (created_at);

ALTER TABLE public.daily_puzzles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coach_explanations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_events ENABLE ROW LEVEL SECURITY;

-- The default privileges in setup.sql would also grant anon/authenticated;
-- RLS with no policies already blocks them, and revoking makes it explicit.
REVOKE ALL ON public.daily_puzzles, public.game_results, public.coach_explanations, public.game_events FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.daily_puzzles, public.game_results, public.coach_explanations, public.game_events TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.game_results_id_seq, public.game_events_id_seq TO service_role;

-- Histogram + count for one day's results: `buckets` time buckets between lo
-- and hi (ms); times outside land in the first/last bucket.
CREATE OR REPLACE FUNCTION public.daily_result_stats(
  p_game text, p_date date, p_variant text, p_lo integer, p_hi integer, p_buckets integer
) RETURNS jsonb
LANGUAGE sql STABLE
SET search_path = public
AS $$
  WITH r AS (
    SELECT least(greatest(width_bucket(time_ms, p_lo, p_hi, p_buckets), 1), p_buckets) AS b
    FROM game_results
    WHERE game = p_game AND puzzle_date = p_date AND variant = p_variant
  )
  SELECT jsonb_build_object(
    'count', (SELECT count(*) FROM r),
    'buckets', (
      SELECT jsonb_agg(coalesce(c.n, 0) ORDER BY s.i)
      FROM generate_series(1, p_buckets) AS s(i)
      LEFT JOIN (SELECT b, count(*) AS n FROM r GROUP BY b) c ON c.b = s.i
    )
  );
$$;
REVOKE ALL ON FUNCTION public.daily_result_stats(text, date, text, integer, integer, integer) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.daily_result_stats(text, date, text, integer, integer, integer) TO service_role;
