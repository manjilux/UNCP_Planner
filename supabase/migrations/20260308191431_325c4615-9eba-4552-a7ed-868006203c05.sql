
CREATE TABLE public.programs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text NOT NULL UNIQUE,
  degree_type text NOT NULL DEFAULT 'BS',
  total_credits integer NOT NULL DEFAULT 120,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.programs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Programs are publicly readable" ON public.programs FOR SELECT USING (true);

CREATE TABLE public.program_requirements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id uuid NOT NULL REFERENCES public.programs(id) ON DELETE CASCADE,
  course_id uuid REFERENCES public.courses(id) ON DELETE SET NULL,
  course_code text NOT NULL,
  category text NOT NULL DEFAULT 'core',
  is_elective boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.program_requirements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Program requirements are publicly readable" ON public.program_requirements FOR SELECT USING (true);
