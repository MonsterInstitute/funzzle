-- Email subscribers for the daily-answers newsletter.
-- Run once in the Supabase Dashboard → SQL Editor.

CREATE TABLE IF NOT EXISTS public.email_subscribers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  unsubscribe_token uuid NOT NULL DEFAULT gen_random_uuid(),
  unsubscribed boolean NOT NULL DEFAULT false
);

-- API roles need access (the app uses the service_role key server-side).
GRANT SELECT, INSERT, UPDATE, DELETE ON public.email_subscribers
  TO anon, authenticated, service_role;

-- RLS on; no public policies (all access is via the service_role key, which
-- bypasses RLS). This keeps the subscriber list private.
ALTER TABLE public.email_subscribers ENABLE ROW LEVEL SECURITY;
