-- ============================================================
-- Migration: user_profiles table
-- Run this in the Supabase SQL editor or via supabase db push
-- ============================================================

CREATE TABLE IF NOT EXISTS public.user_profiles (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth0_sub             TEXT UNIQUE NOT NULL,
  email                 TEXT,
  display_name          TEXT,
  avatar_url            TEXT,
  favorite_driver_code  TEXT,
  favorite_team_id      TEXT,
  onboarding_complete   BOOLEAN NOT NULL DEFAULT FALSE,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Keep updated_at current automatically
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_user_profiles_updated_at ON public.user_profiles;
CREATE TRIGGER trg_user_profiles_updated_at
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Row-level security
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- Service-role (backend) can read/write all rows
CREATE POLICY "service_all" ON public.user_profiles
  FOR ALL
  USING (true)
  WITH CHECK (true);
-- Note: the backend uses the service-role key and passes auth0_sub explicitly,
-- so RLS is enforced at the application layer (src/routers/profile.py).
-- If you switch to Supabase Auth JWTs, replace this policy with:
--   USING (auth.jwt()->>'sub' = auth0_sub)
