
-- Drop overly permissive service role policies and replace with proper ones
-- These tables are written to ONLY by the edge function using service_role key,
-- which bypasses RLS entirely, so we don't need INSERT/UPDATE/DELETE policies for anon/authenticated.

DROP POLICY "Service role can insert departments" ON public.departments;
DROP POLICY "Service role can update departments" ON public.departments;
DROP POLICY "Service role can insert courses" ON public.courses;
DROP POLICY "Service role can update courses" ON public.courses;
DROP POLICY "Service role can insert prerequisites" ON public.prerequisite_relationships;
DROP POLICY "Service role can delete prerequisites" ON public.prerequisite_relationships;
DROP POLICY "Service role can insert scrape logs" ON public.scrape_logs;
DROP POLICY "Service role can update scrape logs" ON public.scrape_logs;
