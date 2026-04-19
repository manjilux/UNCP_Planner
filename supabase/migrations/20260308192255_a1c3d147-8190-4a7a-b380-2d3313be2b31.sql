
-- Storage bucket for catalog uploads
INSERT INTO storage.buckets (id, name, public) VALUES ('catalog-uploads', 'catalog-uploads', false);

-- Allow anyone to upload (for now, no auth)
CREATE POLICY "Anyone can upload catalog files" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'catalog-uploads');
CREATE POLICY "Anyone can read catalog files" ON storage.objects FOR SELECT USING (bucket_id = 'catalog-uploads');

-- Favorites table for bookmarking courses
CREATE TABLE public.favorites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  session_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(course_id, session_id)
);

ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Favorites are publicly accessible" ON public.favorites FOR ALL USING (true) WITH CHECK (true);

-- Course notes table
CREATE TABLE public.course_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  session_id text NOT NULL,
  note text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.course_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Notes are publicly accessible" ON public.course_notes FOR ALL USING (true) WITH CHECK (true);
