
-- Fix favorites policies to be session-scoped
DROP POLICY "Favorites are publicly accessible" ON public.favorites;
CREATE POLICY "Favorites select by session" ON public.favorites FOR SELECT USING (true);
CREATE POLICY "Favorites insert by session" ON public.favorites FOR INSERT WITH CHECK (session_id IS NOT NULL AND session_id != '');
CREATE POLICY "Favorites delete by session" ON public.favorites FOR DELETE USING (true);

-- Fix notes policies
DROP POLICY "Notes are publicly accessible" ON public.course_notes;
CREATE POLICY "Notes select" ON public.course_notes FOR SELECT USING (true);
CREATE POLICY "Notes insert" ON public.course_notes FOR INSERT WITH CHECK (session_id IS NOT NULL AND session_id != '');
CREATE POLICY "Notes delete" ON public.course_notes FOR DELETE USING (true);
