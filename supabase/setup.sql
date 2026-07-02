-- ============================================================================
-- Funzzle — Supabase setup
-- Run this ONCE in the Supabase Dashboard → SQL Editor.
-- It (1) grants the API roles access to the existing tables, and
--    (2) seeds sample answers so pages render immediately.
--
-- Why this is needed: the puzzles/answers/clues tables were created without
-- privileges for the PostgREST roles, so even the service_role key gets
-- "permission denied for table". These GRANTs fix that.
-- ============================================================================

-- 1. Grant table + sequence access to the API roles ---------------------------
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

GRANT SELECT, INSERT, UPDATE, DELETE
  ON ALL TABLES IN SCHEMA public
  TO anon, authenticated, service_role;

GRANT USAGE, SELECT
  ON ALL SEQUENCES IN SCHEMA public
  TO anon, authenticated, service_role;

-- Make future tables inherit the same grants.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES
  TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES
  TO anon, authenticated, service_role;

-- 2. (Optional but recommended) enable RLS with public read policies ----------
-- The app reads via the service_role key (which bypasses RLS), so this is only
-- needed if you ever query these tables with the anon/publishable key.
ALTER TABLE public.answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.puzzles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clues   ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public read answers" ON public.answers;
CREATE POLICY "public read answers" ON public.answers FOR SELECT USING (true);

DROP POLICY IF EXISTS "public read puzzles" ON public.puzzles;
CREATE POLICY "public read puzzles" ON public.puzzles FOR SELECT USING (true);

DROP POLICY IF EXISTS "public read clues" ON public.clues;
CREATE POLICY "public read clues" ON public.clues FOR SELECT USING (true);

-- 3. Seed sample data ---------------------------------------------------------
DELETE FROM public.answers
  WHERE publish_date = '2026-07-01' AND type IN ('nyt-mini', 'wordle');

INSERT INTO public.answers (publish_date, type, answer_data, summary) VALUES
('2026-07-01', 'nyt-mini',
  '{"across": [{"number": 1, "clue": "Opposite of subtract", "answer": "ADD"}, {"number": 4, "clue": "Angry", "answer": "MAD"}, {"number": 5, "clue": "Cooking vessel", "answer": "PAN"}], "down": [{"number": 1, "clue": "Father, informally", "answer": "DAD"}, {"number": 2, "clue": "Exist", "answer": "ARE"}, {"number": 3, "clue": "Dampness", "answer": "DEN"}]}',
  'Today''s NYT Mini was a quick solve with a math theme. ADD anchored the across clues, making this a Monday-easy puzzle.'
),
('2026-07-01', 'wordle',
  '{"answer": "CRANE", "hint_first_letter": "C", "hint_vowels": 2}',
  'Today''s Wordle answer is CRANE — a bird and a construction machine. Common starting guesses like RAISE or SLATE would get you close quickly.'
);

-- Playable mini puzzle for /play/mini (mapped by lib/miniCrossword.ts).
-- grid: 2D array of letters ("#" = black square). clues: number -> text.
DELETE FROM public.puzzles WHERE slug = 'mini-2026-07-01';
INSERT INTO public.puzzles (slug, type, publish_date, title, size, grid, clues) VALUES
('mini-2026-07-01', 'mini', '2026-07-01', 'NYT Mini Crossword', 5,
  '[["H","E","A","R","T"],["E","M","B","E","R"],["A","B","U","S","E"],["R","E","S","I","N"],["T","R","E","N","T"]]',
  '{"across": [{"number": 1, "clue": "Organ that pumps blood"}, {"number": 6, "clue": "Glowing coal in a dying fire"}, {"number": 7, "clue": "Mistreat or misuse"}, {"number": 8, "clue": "Sticky secretion from pine trees"}, {"number": 9, "clue": "English river through Nottingham"}], "down": [{"number": 1, "clue": "Valentine''s Day symbol"}, {"number": 2, "clue": "Faint, lingering coal"}, {"number": 3, "clue": "Take cruel advantage of"}, {"number": 4, "clue": "Base for varnish and adhesives"}, {"number": 5, "clue": "Council of ___ (Catholic conclave)"}]}'
);
