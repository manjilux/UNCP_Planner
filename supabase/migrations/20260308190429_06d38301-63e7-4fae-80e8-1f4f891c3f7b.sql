
-- Departments table
CREATE TABLE public.departments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  prefix TEXT NOT NULL UNIQUE,
  name TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Departments are publicly readable" ON public.departments FOR SELECT USING (true);

-- Courses table
CREATE TABLE public.courses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  department_prefix TEXT NOT NULL REFERENCES public.departments(prefix),
  course_number TEXT NOT NULL,
  title TEXT NOT NULL,
  credits INTEGER,
  description TEXT,
  catalog_url TEXT,
  catalog_id TEXT UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(department_prefix, course_number)
);
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Courses are publicly readable" ON public.courses FOR SELECT USING (true);
CREATE INDEX idx_courses_department ON public.courses(department_prefix);
CREATE INDEX idx_courses_number ON public.courses(course_number);

-- Prerequisite relationships
CREATE TABLE public.prerequisite_relationships (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  prerequisite_id UUID REFERENCES public.courses(id) ON DELETE CASCADE,
  prerequisite_text TEXT,
  relationship_type TEXT NOT NULL DEFAULT 'prerequisite' CHECK (relationship_type IN ('prerequisite', 'corequisite')),
  is_required BOOLEAN NOT NULL DEFAULT true,
  group_id INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.prerequisite_relationships ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Prerequisites are publicly readable" ON public.prerequisite_relationships FOR SELECT USING (true);
CREATE INDEX idx_prereq_course ON public.prerequisite_relationships(course_id);
CREATE INDEX idx_prereq_prereq ON public.prerequisite_relationships(prerequisite_id);

-- Semester plans (user-owned)
CREATE TABLE public.semester_plans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'My Plan',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.semester_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own plans" ON public.semester_plans FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own plans" ON public.semester_plans FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own plans" ON public.semester_plans FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own plans" ON public.semester_plans FOR DELETE USING (auth.uid() = user_id);

-- Plan terms
CREATE TABLE public.plan_terms (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  plan_id UUID NOT NULL REFERENCES public.semester_plans(id) ON DELETE CASCADE,
  semester TEXT NOT NULL CHECK (semester IN ('Fall', 'Spring', 'Summer')),
  year INTEGER NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.plan_terms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own terms" ON public.plan_terms FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.semester_plans sp WHERE sp.id = plan_id AND sp.user_id = auth.uid())
);
CREATE POLICY "Users can create own terms" ON public.plan_terms FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.semester_plans sp WHERE sp.id = plan_id AND sp.user_id = auth.uid())
);
CREATE POLICY "Users can update own terms" ON public.plan_terms FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.semester_plans sp WHERE sp.id = plan_id AND sp.user_id = auth.uid())
);
CREATE POLICY "Users can delete own terms" ON public.plan_terms FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.semester_plans sp WHERE sp.id = plan_id AND sp.user_id = auth.uid())
);

-- Plan courses
CREATE TABLE public.plan_courses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  term_id UUID NOT NULL REFERENCES public.plan_terms(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(term_id, course_id)
);
ALTER TABLE public.plan_courses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own plan courses" ON public.plan_courses FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.plan_terms pt
    JOIN public.semester_plans sp ON sp.id = pt.plan_id
    WHERE pt.id = term_id AND sp.user_id = auth.uid()
  )
);
CREATE POLICY "Users can create own plan courses" ON public.plan_courses FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.plan_terms pt
    JOIN public.semester_plans sp ON sp.id = pt.plan_id
    WHERE pt.id = term_id AND sp.user_id = auth.uid()
  )
);
CREATE POLICY "Users can delete own plan courses" ON public.plan_courses FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM public.plan_terms pt
    JOIN public.semester_plans sp ON sp.id = pt.plan_id
    WHERE pt.id = term_id AND sp.user_id = auth.uid()
  )
);

-- Scrape log for tracking
CREATE TABLE public.scrape_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'running',
  departments_scraped INTEGER DEFAULT 0,
  courses_found INTEGER DEFAULT 0,
  error_message TEXT,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE
);
ALTER TABLE public.scrape_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Scrape logs are publicly readable" ON public.scrape_logs FOR SELECT USING (true);

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_courses_updated_at BEFORE UPDATE ON public.courses FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_plans_updated_at BEFORE UPDATE ON public.semester_plans FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Service role policies for edge function writes
CREATE POLICY "Service role can insert departments" ON public.departments FOR INSERT WITH CHECK (true);
CREATE POLICY "Service role can update departments" ON public.departments FOR UPDATE USING (true);
CREATE POLICY "Service role can insert courses" ON public.courses FOR INSERT WITH CHECK (true);
CREATE POLICY "Service role can update courses" ON public.courses FOR UPDATE USING (true);
CREATE POLICY "Service role can insert prerequisites" ON public.prerequisite_relationships FOR INSERT WITH CHECK (true);
CREATE POLICY "Service role can delete prerequisites" ON public.prerequisite_relationships FOR DELETE USING (true);
CREATE POLICY "Service role can insert scrape logs" ON public.scrape_logs FOR INSERT WITH CHECK (true);
CREATE POLICY "Service role can update scrape logs" ON public.scrape_logs FOR UPDATE USING (true);
