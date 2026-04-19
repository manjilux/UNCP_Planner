import { useState, useMemo, useCallback, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  GraduationCap, Lock, Unlock, Plus, X, Search, AlertTriangle, Eye, Pencil,
  Settings2, Compass, Target, User, ArrowRight, ChevronLeft
} from "lucide-react";

const STORAGE_KEY = "graduation-plan-v1";
const PROFILE_KEY = "graduation-profile-v1";

type PlannedCourse = {
  id: string;
  prefix: string;
  number: string;
  title: string;
  credits: number;
  prereqBypassed?: boolean;
};

type Semester = {
  season: "Fall" | "Spring" | "Summer";
  year: number;
  courses: PlannedCourse[];
  locked: boolean;
};

type SavedPlan = {
  programId: string;
  startYear: number;
  maxCredits: number;
  includeSummer: boolean;
  semesters: Semester[];
};

type UserProfile = {
  name: string;
  mode: "decided" | "exploring";
  programId: string;
  startYear: number;
  maxCredits: number;
  includeSummer: boolean;
  completedStep: number; // how far through onboarding
};

const currentYear = new Date().getFullYear();
const startYearOptions = Array.from({ length: 6 }, (_, i) => currentYear - 2 + i);

export default function GraduationPlanner() {
  // Profile / onboarding state
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [onboardingStep, setOnboardingStep] = useState(0);
  const [tempName, setTempName] = useState("");
  const [tempMode, setTempMode] = useState<"decided" | "exploring" | "">("");

  // Plan state
  const [programId, setProgramId] = useState("");
  const [startYear, setStartYear] = useState(currentYear);
  const [maxCredits, setMaxCredits] = useState(16);
  const [includeSummer, setIncludeSummer] = useState(false);
  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [planGenerated, setPlanGenerated] = useState(false);
  const [registrationView, setRegistrationView] = useState(false);
  const [showSetup, setShowSetup] = useState(false);

  // Add course modal state
  const [addingSemIdx, setAddingSemIdx] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // Prereq bypass dialog
  const [bypassDialog, setBypassDialog] = useState<{
    open: boolean;
    course: PlannedCourse | null;
    semIdx: number;
    missingPrereqs: string[];
  }>({ open: false, course: null, semIdx: 0, missingPrereqs: [] });

  // Fetch programs
  const { data: programs } = useQuery({
    queryKey: ["programs-list"],
    queryFn: async () => {
      const { data } = await supabase.from("programs").select("id, name, code, total_credits, degree_type");
      return data || [];
    },
  });

  // Fetch program requirements when program selected
  const { data: requirements } = useQuery({
    queryKey: ["program-requirements", programId],
    queryFn: async () => {
      const { data } = await supabase
        .from("program_requirements")
        .select("id, course_code, category, is_elective, course_id, courses(id, department_prefix, course_number, title, credits)")
        .eq("program_id", programId);
      return data || [];
    },
    enabled: !!programId,
  });

  // Fetch all courses for search
  const { data: allCourses } = useQuery({
    queryKey: ["all-courses-planner"],
    queryFn: async () => {
      const { data } = await supabase.from("courses").select("id, department_prefix, course_number, title, credits");
      return data || [];
    },
  });

  // Fetch prereqs
  const { data: prereqs } = useQuery({
    queryKey: ["prereqs-all"],
    queryFn: async () => {
      const { data } = await supabase
        .from("prerequisite_relationships")
        .select("course_id, prerequisite_id, is_required");
      return data || [];
    },
  });

  const selectedProgram = programs?.find(p => p.id === programId);

  // Load saved profile + plan
  useEffect(() => {
    try {
      const savedProfile = localStorage.getItem(PROFILE_KEY);
      if (savedProfile) {
        const p: UserProfile = JSON.parse(savedProfile);
        setProfile(p);
        setProgramId(p.programId);
        setStartYear(p.startYear);
        setMaxCredits(p.maxCredits);
        setIncludeSummer(p.includeSummer);
        setOnboardingStep(99); // completed
      }
    } catch { /* ignore */ }
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const plan: SavedPlan = JSON.parse(saved);
        if (!programId) setProgramId(plan.programId);
        setStartYear(plan.startYear);
        setMaxCredits(plan.maxCredits);
        setIncludeSummer(plan.includeSummer);
        setSemesters(plan.semesters);
        setPlanGenerated(true);
      }
    } catch { /* ignore */ }
  }, []);

  // Save plan
  useEffect(() => {
    if (planGenerated && programId) {
      const plan: SavedPlan = { programId, startYear, maxCredits, includeSummer, semesters };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(plan));
    }
  }, [semesters, planGenerated, programId, startYear, maxCredits, includeSummer]);

  // Save profile
  const saveProfile = (p: UserProfile) => {
    setProfile(p);
    localStorage.setItem(PROFILE_KEY, JSON.stringify(p));
  };

  // Build prereq map
  const prereqMap = useMemo(() => {
    const map = new Map<string, Set<string>>();
    if (!prereqs) return map;
    for (const p of prereqs) {
      if (!p.prerequisite_id) continue;
      if (!map.has(p.course_id)) map.set(p.course_id, new Set());
      map.get(p.course_id)!.add(p.prerequisite_id);
    }
    return map;
  }, [prereqs]);

  // Generate plan using topological scheduling
  const generatePlan = useCallback(() => {
    if (!requirements || !prereqs) return;

    const courseList: PlannedCourse[] = [];
    for (const req of requirements) {
      const c = req.courses as any;
      if (c) {
        courseList.push({
          id: c.id, prefix: c.department_prefix, number: c.course_number,
          title: c.title, credits: c.credits || 3,
        });
      }
    }

    // Topological sort
    const inDegree = new Map<string, number>();
    const adjList = new Map<string, string[]>();
    const courseIds = new Set(courseList.map(c => c.id));

    for (const c of courseList) { inDegree.set(c.id, 0); adjList.set(c.id, []); }
    for (const p of prereqs) {
      if (!p.prerequisite_id || !courseIds.has(p.course_id) || !courseIds.has(p.prerequisite_id)) continue;
      adjList.get(p.prerequisite_id)!.push(p.course_id);
      inDegree.set(p.course_id, (inDegree.get(p.course_id) || 0) + 1);
    }

    const levels: string[][] = [];
    let queue = courseList.filter(c => (inDegree.get(c.id) || 0) === 0).map(c => c.id);
    const placed = new Set<string>();

    while (queue.length > 0) {
      levels.push([...queue]);
      for (const id of queue) placed.add(id);
      const next: string[] = [];
      for (const id of queue) {
        for (const dep of adjList.get(id) || []) {
          inDegree.set(dep, (inDegree.get(dep) || 0) - 1);
          if (inDegree.get(dep) === 0 && !placed.has(dep)) next.push(dep);
        }
      }
      queue = next;
    }
    const remaining = courseList.filter(c => !placed.has(c.id)).map(c => c.id);
    if (remaining.length) levels.push(remaining);

    const courseMap = new Map(courseList.map(c => [c.id, c]));
    const orderedCourses: (PlannedCourse & { level: number })[] = [];
    for (let i = 0; i < levels.length; i++) {
      for (const id of levels[i]) {
        const c = courseMap.get(id);
        if (c) orderedCourses.push({ ...c, level: i });
      }
    }

    const newSemesters: Semester[] = [];
    const placedIds = new Set<string>();
    let termIdx = 0;

    while (placedIds.size < orderedCourses.length && termIdx < 30) {
      const season: "Fall" | "Spring" | "Summer" = includeSummer
        ? (["Fall", "Spring", "Summer"] as const)[termIdx % 3]
        : (["Fall", "Spring"] as const)[termIdx % 2];
      const yearOffset = includeSummer ? Math.floor(termIdx / 3) : Math.floor(termIdx / 2);
      const year = startYear + yearOffset;
      const limit = season === "Summer" ? 6 : maxCredits;

      const termCourses: PlannedCourse[] = [];
      let termCredits = 0;
      for (const c of orderedCourses) {
        if (placedIds.has(c.id)) continue;
        if (termIdx < c.level) continue;
        if (termCredits + c.credits > limit) continue;
        termCourses.push(c);
        termCredits += c.credits;
        placedIds.add(c.id);
      }

      if (termCourses.length > 0 || termIdx < 2) {
        newSemesters.push({ season, year, courses: termCourses, locked: false });
      }
      termIdx++;
    }

    setSemesters(newSemesters);
    setPlanGenerated(true);
  }, [requirements, prereqs, startYear, maxCredits, includeSummer]);

  // Prereq check
  const checkPrereqs = useCallback((courseId: string, semIdx: number): string[] => {
    const required = prereqMap.get(courseId);
    if (!required || required.size === 0) return [];
    const priorCourseIds = new Set<string>();
    for (let i = 0; i < semIdx; i++) {
      for (const c of semesters[i].courses) priorCourseIds.add(c.id);
    }
    const missing: string[] = [];
    for (const prereqId of required) {
      if (!priorCourseIds.has(prereqId)) {
        const course = allCourses?.find(c => c.id === prereqId);
        missing.push(course ? `${course.department_prefix} ${course.course_number}` : prereqId);
      }
    }
    return missing;
  }, [prereqMap, semesters, allCourses]);

  const handleAddCourse = useCallback((course: NonNullable<typeof allCourses>[number], semIdx: number) => {
    const planned: PlannedCourse = {
      id: course.id, prefix: course.department_prefix, number: course.course_number,
      title: course.title, credits: course.credits || 3,
    };
    const missing = checkPrereqs(course.id, semIdx);
    if (missing.length > 0) {
      setBypassDialog({ open: true, course: planned, semIdx, missingPrereqs: missing });
      return;
    }
    addCourseToSemester(planned, semIdx, false);
    setAddingSemIdx(null);
    setSearchQuery("");
  }, [checkPrereqs]);

  const addCourseToSemester = (course: PlannedCourse, semIdx: number, bypassed: boolean) => {
    setSemesters(prev => prev.map((sem, i) =>
      i === semIdx ? { ...sem, courses: [...sem.courses, { ...course, prereqBypassed: bypassed }] } : sem
    ));
  };

  const removeCourse = (semIdx: number, courseId: string) => {
    setSemesters(prev => prev.map((sem, i) =>
      i === semIdx ? { ...sem, courses: sem.courses.filter(c => c.id !== courseId) } : sem
    ));
  };

  const toggleLock = (semIdx: number) => {
    setSemesters(prev => prev.map((sem, i) =>
      i === semIdx ? { ...sem, locked: !sem.locked } : sem
    ));
  };

  const resetProfile = () => {
    localStorage.removeItem(PROFILE_KEY);
    localStorage.removeItem(STORAGE_KEY);
    setProfile(null);
    setOnboardingStep(0);
    setTempName("");
    setTempMode("");
    setProgramId("");
    setSemesters([]);
    setPlanGenerated(false);
    setRegistrationView(false);
  };

  // Credits
  const totalPlannedCredits = semesters.reduce((s, sem) => s + sem.courses.reduce((a, c) => a + c.credits, 0), 0);
  const totalRequired = selectedProgram?.total_credits || 120;
  const progressPercent = Math.min(100, Math.round((totalPlannedCredits / totalRequired) * 100));

  // Search
  const searchResults = useMemo(() => {
    if (!allCourses || !searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    const plannedIds = new Set(semesters.flatMap(s => s.courses.map(c => c.id)));
    return allCourses
      .filter(c => !plannedIds.has(c.id) && (`${c.department_prefix} ${c.course_number} ${c.title}`.toLowerCase().includes(q)))
      .slice(0, 8);
  }, [allCourses, searchQuery, semesters]);

  const displaySemesters = registrationView ? semesters.filter(s => s.locked) : semesters;

  const firstName = profile?.name?.split(" ")[0] || "Student";

  // ─── ONBOARDING (no profile saved) ───
  if (!profile) {
    return (
      <section className="space-y-4">
        <div className="flex items-center gap-3 mb-2">
          <GraduationCap className="w-7 h-7 text-primary" />
          <h2 className="font-display text-xl font-bold text-foreground">My Graduation Plan</h2>
        </div>

        {/* Step 0: Name */}
        {onboardingStep === 0 && (
          <Card className="overflow-hidden">
            <div className="h-1.5 bg-primary/20">
              <div className="h-full bg-primary transition-all" style={{ width: "33%" }} />
            </div>
            <CardContent className="p-6 md:p-8 space-y-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <User className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-display font-bold text-foreground">Welcome! Let's personalize your plan.</h3>
                  <p className="text-xs text-muted-foreground">First, what should we call you?</p>
                </div>
              </div>
              <Input
                placeholder="Your first name"
                value={tempName}
                onChange={e => setTempName(e.target.value)}
                className="max-w-xs text-sm"
                autoFocus
              />
              <Button
                onClick={() => { if (tempName.trim()) setOnboardingStep(1); }}
                disabled={!tempName.trim()}
                size="sm"
              >
                Continue <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Step 1: Browsing or Decided */}
        {onboardingStep === 1 && (
          <Card className="overflow-hidden">
            <div className="h-1.5 bg-primary/20">
              <div className="h-full bg-primary transition-all" style={{ width: "66%" }} />
            </div>
            <CardContent className="p-6 md:p-8 space-y-5">
              <div>
                <h3 className="font-display font-bold text-foreground">Hey {tempName}! 👋 What brings you here?</h3>
                <p className="text-xs text-muted-foreground mt-1">This helps us tailor your experience.</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  onClick={() => { setTempMode("exploring"); setOnboardingStep(2); }}
                  className={`text-left p-4 rounded-xl border-2 transition-all hover:shadow-md ${
                    tempMode === "exploring" ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"
                  }`}
                >
                  <Compass className="w-6 h-6 text-primary mb-2" />
                  <p className="font-display font-bold text-sm text-foreground">I'm exploring</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Undecided on a major — I want to browse courses and see what's available.
                  </p>
                </button>
                <button
                  onClick={() => { setTempMode("decided"); setOnboardingStep(2); }}
                  className={`text-left p-4 rounded-xl border-2 transition-all hover:shadow-md ${
                    tempMode === "decided" ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"
                  }`}
                >
                  <Target className="w-6 h-6 text-primary mb-2" />
                  <p className="font-display font-bold text-sm text-foreground">I know my major</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    I've declared my major and want to build my graduation plan.
                  </p>
                </button>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setOnboardingStep(0)} className="text-xs">
                <ChevronLeft className="w-3 h-3 mr-1" /> Back
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Step 2: Details */}
        {onboardingStep === 2 && (
          <Card className="overflow-hidden">
            <div className="h-1.5 bg-primary/20">
              <div className="h-full bg-primary transition-all" style={{ width: "100%" }} />
            </div>
            <CardContent className="p-6 md:p-8 space-y-5">
              <div>
                <h3 className="font-display font-bold text-foreground">
                  {tempMode === "decided" ? `Great, ${tempName}! Let's set up your plan.` : `Cool, ${tempName}! Let's get you set up.`}
                </h3>
                <p className="text-xs text-muted-foreground mt-1">
                  {tempMode === "decided"
                    ? "Select your major and preferences below."
                    : "You can still pick a program to explore, or change it anytime."}
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl">
                <div className="space-y-1.5">
                  <Label className="text-xs">
                    {tempMode === "decided" ? "Your Major / Program" : "Explore a Program (optional)"}
                  </Label>
                  <Select value={programId} onValueChange={setProgramId}>
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue placeholder="Select a program" />
                    </SelectTrigger>
                    <SelectContent>
                      {programs?.map(p => (
                        <SelectItem key={p.id} value={p.id}>{p.name} ({p.code})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Start Year</Label>
                  <Select value={String(startYear)} onValueChange={v => setStartYear(Number(v))}>
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {startYearOptions.map(y => (
                        <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Max Credits per Semester: {maxCredits}</Label>
                  <Slider value={[maxCredits]} onValueChange={([v]) => setMaxCredits(v)} min={12} max={21} step={1} className="mt-2" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Include Summer Semesters</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <Switch checked={includeSummer} onCheckedChange={setIncludeSummer} />
                    <span className="text-[11px] text-muted-foreground">{includeSummer ? "Yes" : "No"}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={() => setOnboardingStep(1)} className="text-xs">
                  <ChevronLeft className="w-3 h-3 mr-1" /> Back
                </Button>
                <Button
                  onClick={() => {
                    const p: UserProfile = {
                      name: tempName.trim(),
                      mode: tempMode as "decided" | "exploring",
                      programId,
                      startYear,
                      maxCredits,
                      includeSummer,
                      completedStep: 2,
                    };
                    saveProfile(p);
                    setOnboardingStep(99);
                    if (programId && requirements) generatePlan();
                  }}
                  size="sm"
                  disabled={tempMode === "decided" && !programId}
                >
                  {programId ? "Generate My Plan" : "Save & Continue"} <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </section>
    );
  }

  // ─── PERSONALIZED PLAN VIEW ───
  return (
    <section className="space-y-4">
      {/* Personalized header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-primary/15 flex items-center justify-center">
            <GraduationCap className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="font-display text-lg font-bold text-foreground">
              {firstName}'s Graduation Plan
            </h2>
            <p className="text-[11px] text-muted-foreground">
              {selectedProgram
                ? `${selectedProgram.name} • ${selectedProgram.degree_type}`
                : profile.mode === "exploring" ? "Exploring programs" : "No program selected"}
              {planGenerated && ` • ${totalPlannedCredits}/${totalRequired} credits`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {planGenerated && (
            <Button
              variant={registrationView ? "default" : "outline"}
              size="sm"
              onClick={() => setRegistrationView(!registrationView)}
              className="text-xs h-8"
            >
              {registrationView ? <Pencil className="w-3.5 h-3.5 mr-1" /> : <Eye className="w-3.5 h-3.5 mr-1" />}
              {registrationView ? "Edit Mode" : "Registration View"}
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowSetup(!showSetup)}
            className="text-xs h-8"
          >
            <Settings2 className="w-3.5 h-3.5 mr-1" /> Settings
          </Button>
          <Button variant="ghost" size="sm" onClick={resetProfile} className="text-xs h-8 text-muted-foreground">
            Reset
          </Button>
        </div>
      </div>

      {/* Collapsible setup */}
      {showSetup && !registrationView && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Settings2 className="w-4 h-4 text-primary" />
              <span className="text-xs font-semibold text-foreground">Plan Settings</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="space-y-1.5">
                <Label className="text-[11px]">Major / Program</Label>
                <Select value={programId} onValueChange={(v) => { setProgramId(v); saveProfile({ ...profile, programId: v }); }}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Select a program" />
                  </SelectTrigger>
                  <SelectContent>
                    {programs?.map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.name} ({p.code})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-[11px]">Start Year</Label>
                <Select value={String(startYear)} onValueChange={v => { setStartYear(Number(v)); saveProfile({ ...profile, startYear: Number(v) }); }}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {startYearOptions.map(y => (
                      <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-[11px]">Max Credits/Semester: {maxCredits}</Label>
                <Slider value={[maxCredits]} onValueChange={([v]) => { setMaxCredits(v); saveProfile({ ...profile, maxCredits: v }); }} min={12} max={21} step={1} className="mt-2" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[11px]">Include Summer</Label>
                <div className="flex items-center gap-2 mt-1">
                  <Switch checked={includeSummer} onCheckedChange={v => { setIncludeSummer(v); saveProfile({ ...profile, includeSummer: v }); }} />
                  <span className="text-[10px] text-muted-foreground">{includeSummer ? "Yes" : "No"}</span>
                </div>
              </div>
            </div>
            <div className="mt-4">
              <Button onClick={generatePlan} disabled={!programId || !requirements} size="sm" className="text-xs">
                {planGenerated ? "Regenerate Plan" : "Generate Plan"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Progress */}
      {planGenerated && selectedProgram && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-foreground">
                Progress: {totalPlannedCredits} / {totalRequired} credits
              </span>
              {progressPercent >= 100 && (
                <Badge className="bg-primary/20 text-primary border-primary/30 text-[10px]">
                  🎓 Ready for Graduation!
                </Badge>
              )}
            </div>
            <Progress value={progressPercent} className="h-3" />
            <p className="text-[10px] text-muted-foreground mt-1">{progressPercent}% complete</p>
          </CardContent>
        </Card>
      )}

      {/* Semester cards */}
      {planGenerated && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {displaySemesters.map((sem, realIdx) => {
            const semIdx = registrationView ? semesters.indexOf(sem) : realIdx;
            const semCredits = sem.courses.reduce((s, c) => s + c.credits, 0);
            const seasonColor = sem.season === "Fall" ? "hsl(25 80% 50%)" : sem.season === "Summer" ? "hsl(45 90% 50%)" : "hsl(200 70% 50%)";

            return (
              <Card key={`${sem.season}-${sem.year}`} className={sem.locked ? "border-primary/30 bg-muted/30" : ""}>
                <div className="flex items-center gap-2 px-3 py-2 border-b border-border" style={{ backgroundColor: `${seasonColor}10` }}>
                  <span className="text-xs font-display font-bold text-foreground">{sem.season} {sem.year}</span>
                  <span className="text-[10px] text-muted-foreground ml-auto">{semCredits}cr</span>
                  {sem.locked && (
                    <Badge variant="outline" className="text-[9px] h-5 border-primary/40 text-primary">
                      <Lock className="w-2.5 h-2.5 mr-0.5" /> Locked
                    </Badge>
                  )}
                  {!registrationView && (
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => toggleLock(semIdx)} title={sem.locked ? "Unlock semester" : "Lock semester"}>
                      {sem.locked ? <Lock className="w-3 h-3 text-primary" /> : <Unlock className="w-3 h-3 text-muted-foreground" />}
                    </Button>
                  )}
                </div>
                <CardContent className="p-2">
                  <div className="space-y-1">
                    {sem.courses.map(course => (
                      <div key={course.id} className="flex items-center gap-2 p-1.5 rounded-md border border-border text-xs">
                        <div className="flex-1 min-w-0">
                          <span className="font-mono font-bold text-foreground">{course.prefix} {course.number}</span>
                          <span className="text-muted-foreground ml-1 truncate">{course.title}</span>
                          {course.prereqBypassed && (
                            <Badge variant="outline" className="ml-1 text-[8px] h-4 border-destructive/40 text-destructive">
                              <AlertTriangle className="w-2 h-2 mr-0.5" /> prereq bypassed
                            </Badge>
                          )}
                        </div>
                        <span className="text-[10px] text-muted-foreground shrink-0">{course.credits}cr</span>
                        {!sem.locked && !registrationView && (
                          <Button variant="ghost" size="icon" className="h-5 w-5 shrink-0" onClick={() => removeCourse(semIdx, course.id)}>
                            <X className="w-3 h-3 text-muted-foreground" />
                          </Button>
                        )}
                      </div>
                    ))}
                    {sem.courses.length === 0 && (
                      <p className="text-[10px] text-muted-foreground text-center py-2">No courses yet</p>
                    )}
                  </div>

                  {/* Add course */}
                  {!sem.locked && !registrationView && (
                    <div className="mt-2">
                      {addingSemIdx === semIdx ? (
                        <div className="space-y-1.5">
                          <div className="relative">
                            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
                            <Input placeholder="Search courses..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="h-7 text-[11px] pl-7" autoFocus />
                          </div>
                          {searchResults.map(c => (
                            <button key={c.id} onClick={() => handleAddCourse(c, semIdx)} className="w-full text-left text-[11px] p-1.5 rounded border border-border hover:bg-accent/50 transition-colors">
                              <span className="font-mono font-bold">{c.department_prefix} {c.course_number}</span>{" "}
                              <span className="text-muted-foreground">{c.title}</span>{" "}
                              <span className="text-muted-foreground">({c.credits || 3}cr)</span>
                            </button>
                          ))}
                          <Button variant="ghost" size="sm" className="text-[10px] h-6 w-full" onClick={() => { setAddingSemIdx(null); setSearchQuery(""); }}>Cancel</Button>
                        </div>
                      ) : (
                        <Button variant="ghost" size="sm" className="text-[10px] h-6 w-full text-muted-foreground" onClick={() => setAddingSemIdx(semIdx)}>
                          <Plus className="w-3 h-3 mr-1" /> Add Course
                        </Button>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Empty state for exploring users with no plan */}
      {!planGenerated && (
        <Card className="border-dashed">
          <CardContent className="p-8 text-center">
            <GraduationCap className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">
              {profile.mode === "exploring"
                ? `${firstName}, select a program in Settings and generate a plan to explore it!`
                : "Open Settings to select your major and generate your graduation plan."}
            </p>
            <Button variant="outline" size="sm" className="mt-3 text-xs" onClick={() => setShowSetup(true)}>
              <Settings2 className="w-3.5 h-3.5 mr-1" /> Open Settings
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Prereq Bypass Dialog */}
      <AlertDialog open={bypassDialog.open} onOpenChange={open => !open && setBypassDialog(p => ({ ...p, open: false }))}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              Prerequisite Warning
            </AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{bypassDialog.course?.prefix} {bypassDialog.course?.number}</strong> requires the following prerequisites
              that are not in prior semesters:
              <ul className="mt-2 list-disc list-inside">
                {bypassDialog.missingPrereqs.map(p => <li key={p} className="font-mono text-sm">{p}</li>)}
              </ul>
              <p className="mt-2 text-destructive font-medium">Are you sure you want to bypass this requirement?</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (bypassDialog.course) {
                  addCourseToSemester(bypassDialog.course, bypassDialog.semIdx, true);
                  setAddingSemIdx(null);
                  setSearchQuery("");
                }
                setBypassDialog(p => ({ ...p, open: false }));
              }}
            >
              Bypass Prerequisite
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
