import { useState, useMemo, useCallback, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Calendar, GraduationCap, AlertTriangle, Sun, Snowflake, Settings2, BookOpen, Clock, Printer
} from "lucide-react";

const DEPT_COLORS: Record<string, string> = {
  CSC: "#e6a817", CYB: "#e05555", MAT: "#4d8ddb",
  ITC: "#45b078", PHY: "#45adb5", CHM: "#c9a33a",
  ENG: "#9b7dcf", BIO: "#6abf69", STA: "#e08040",
};
function getDeptColor(prefix: string) { return DEPT_COLORS[prefix] || "#888"; }

type SemCourse = {
  id: string; prefix: string; number: string; title: string;
  credits: number | null; category?: string; isCritical: boolean;
};

type CriticalPathData = {
  semesters: SemCourse[][];
  unscheduled: SemCourse[];
  criticalSet: Set<string>;
  totalCredits: number;
  semesterCredits: number[];
  maxCreditsPerSem: number;
  avgCreditsPerSem: number;
  minSemesters: number;
};

type Props = {
  criticalPathData: CriticalPathData | null;
  programName?: string;
  programCode?: string;
  onFocusCourse?: (courseId: string) => void;
};

type Term = { season: "Fall" | "Spring" | "Summer"; year: number; courses: SemCourse[]; credits: number };

const currentYear = new Date().getFullYear();
const startYearOptions = Array.from({ length: 6 }, (_, i) => currentYear + i);

export default function FourYearPlan({ criticalPathData, programName, programCode, onFocusCourse }: Props) {
  const [startYear, setStartYear] = useState(currentYear);
  const [maxCredits, setMaxCredits] = useState(16);
  const [includeSummer, setIncludeSummer] = useState(false);
  const [summerMaxCredits, setSummerMaxCredits] = useState(6);

  const plan = useMemo(() => {
    if (!criticalPathData || criticalPathData.semesters.length === 0) return null;

    // Flatten all courses in topological order (semester index = earliest slot)
    const allCourses: (SemCourse & { topoLevel: number })[] = [];
    for (let i = 0; i < criticalPathData.semesters.length; i++) {
      for (const c of criticalPathData.semesters[i]) {
        allCourses.push({ ...c, topoLevel: i });
      }
    }
    // Include unschedulable courses at the next topoLevel so they get placed after all others
    const maxTopo = criticalPathData.semesters.length;
    for (const c of criticalPathData.unscheduled) {
      allCourses.push({ ...c, topoLevel: maxTopo });
    }

    // Build prerequisite map: a course at topoLevel N depends on courses at topoLevel N-1
    // that are its actual prereqs. We approximate: a course can be placed once all courses
    // from strictly earlier topoLevels that overlap with its semester are placed.
    // Better approach: a course can be placed once all courses at earlier topoLevels
    // that are in its dependency chain are placed. Since we don't have the full chain here,
    // use the simpler rule: a course at level N can be placed in any term after
    // at least N terms have passed (i.e., termIdx >= topoLevel).
    const terms: Term[] = [];
    const placed = new Set<string>();
    let termIdx = 0;

    while (placed.size < allCourses.length) {
      const season: "Fall" | "Spring" | "Summer" =
        includeSummer
          ? (["Fall", "Spring", "Summer"] as const)[termIdx % 3]
          : (["Fall", "Spring"] as const)[termIdx % 2];
      
      const yearOffset = includeSummer ? Math.floor(termIdx / 3) : Math.floor(termIdx / 2);
      const year = startYear + yearOffset;
      const limit = season === "Summer" ? summerMaxCredits : maxCredits;

      const termCourses: SemCourse[] = [];
      let termCredits = 0;

      // A course can be placed if termIdx >= its topoLevel (ensures prereqs had time to be scheduled)
      // and all its same-or-lower topoLevel prereqs are already placed
      for (const c of allCourses) {
        if (placed.has(c.id)) continue;
        if (termIdx < c.topoLevel) continue;
        
        const cr = c.credits || 3;
        if (termCredits + cr > limit) continue;
        
        termCourses.push(c);
        termCredits += cr;
        placed.add(c.id);
      }

      if (termCourses.length > 0) {
        terms.push({ season, year, courses: termCourses, credits: termCredits });
      } else {
        // If no courses could be placed but we haven't placed all, advance termIdx
        // (this handles the case where courses need a higher termIdx)
      }
      
      termIdx++;
      // Safety: prevent infinite loops
      if (termIdx > 30) break;
    }

    // Group by academic year
    const academicYears: { label: string; terms: Term[] }[] = [];
    const yearMap = new Map<number, Term[]>();
    for (const t of terms) {
      // Academic year: Fall 2025 + Spring 2026 = "2025-2026"
      const acadYear = t.season === "Fall" ? t.year : t.year - 1;
      if (!yearMap.has(acadYear)) yearMap.set(acadYear, []);
      yearMap.get(acadYear)!.push(t);
    }
    for (const [yr, trms] of Array.from(yearMap.entries()).sort((a, b) => a[0] - b[0])) {
      academicYears.push({ label: `${yr}–${yr + 1}`, terms: trms });
    }

    const totalTerms = terms.length;
    const totalCredits = terms.reduce((s, t) => s + t.credits, 0);
    const totalYears = academicYears.length;

    return { terms, academicYears, totalTerms, totalCredits, totalYears };
  }, [criticalPathData, startYear, maxCredits, includeSummer, summerMaxCredits]);

  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  if (!criticalPathData) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
        Select a major to generate a 4-year plan
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-4 four-year-plan-printable" ref={printRef}>
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="font-display font-bold text-lg text-foreground flex items-center gap-2">
            <GraduationCap className="w-5 h-5 text-primary no-print" />
            {programName} — 4-Year Plan
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Courses mapped to Fall/Spring terms respecting prerequisite ordering
          </p>
          <p className="text-[10px] text-muted-foreground mt-0.5 hidden print:block">
            Generated {new Date().toLocaleDateString()} · {plan?.totalCredits || 0} credits · {plan?.totalTerms || 0} terms · Max {maxCredits}cr/semester
          </p>
        </div>
        <Button variant="outline" size="sm" className="h-8 text-xs no-print" onClick={handlePrint}>
          <Printer className="w-3.5 h-3.5 mr-1.5" /> Print / Save PDF
        </Button>
      </div>

      {/* Settings - hidden in print */}
      <Card className="no-print">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Settings2 className="w-4 h-4 text-primary" />
            <span className="text-xs font-semibold text-foreground">Plan Settings</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-1.5">
              <Label className="text-[11px]">Start Year</Label>
              <Select value={String(startYear)} onValueChange={v => setStartYear(Number(v))}>
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
              <Slider
                value={[maxCredits]}
                onValueChange={([v]) => setMaxCredits(v)}
                min={12} max={21} step={1}
                className="mt-2"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px]">Include Summer Terms</Label>
              <div className="flex items-center gap-2 mt-1">
                <Switch checked={includeSummer} onCheckedChange={setIncludeSummer} />
                <span className="text-[10px] text-muted-foreground">{includeSummer ? "Yes" : "No"}</span>
              </div>
            </div>
            {includeSummer && (
              <div className="space-y-1.5">
                <Label className="text-[11px]">Summer Max Credits: {summerMaxCredits}</Label>
                <Slider
                  value={[summerMaxCredits]}
                  onValueChange={([v]) => setSummerMaxCredits(v)}
                  min={3} max={12} step={1}
                  className="mt-2"
                />
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* KPIs */}
      {plan && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card className="border-2 border-primary/30">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <Calendar className="w-4 h-4 text-primary" />
                <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">Academic Years</span>
              </div>
              <p className="text-3xl font-display font-bold text-foreground">{plan.totalYears}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <Clock className="w-4 h-4 text-primary" />
                <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">Total Terms</span>
              </div>
              <p className="text-3xl font-display font-bold text-foreground">{plan.totalTerms}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <BookOpen className="w-4 h-4 text-primary" />
                <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">Total Credits</span>
              </div>
              <p className="text-3xl font-display font-bold text-foreground">{plan.totalCredits}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <GraduationCap className="w-4 h-4 text-primary" />
                <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">Courses</span>
              </div>
              <p className="text-3xl font-display font-bold text-foreground">
                {criticalPathData.semesters.flat().length + criticalPathData.unscheduled.length}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Academic Year Timeline */}
      {plan && (
        <div className="space-y-5">
          {plan.academicYears.map((ay, ayIdx) => (
            <div key={ay.label}>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-8 h-8 rounded-lg gold-gradient flex items-center justify-center shrink-0">
                  <span className="text-xs font-bold text-primary-foreground">{ayIdx + 1}</span>
                </div>
                <div>
                  <p className="font-display font-bold text-sm text-foreground">Year {ayIdx + 1}: {ay.label}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {ay.terms.length} term{ay.terms.length !== 1 ? "s" : ""} ·{" "}
                    {ay.terms.reduce((s, t) => s + t.credits, 0)} credits
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 ml-11">
                {ay.terms.map((term, ti) => {
                  const SeasonIcon = term.season === "Fall" ? Snowflake : term.season === "Summer" ? Sun : Sun;
                  const seasonColor = term.season === "Fall" ? "hsl(25 80% 50%)" : term.season === "Summer" ? "hsl(45 90% 50%)" : "hsl(200 70% 50%)";
                  
                  return (
                    <Card key={ti} className="overflow-hidden card-no-break">
                      <div
                        className="flex items-center gap-2 px-3 py-2 border-b border-border"
                        style={{ backgroundColor: `${seasonColor}10` }}
                      >
                        <SeasonIcon className="w-3.5 h-3.5" style={{ color: seasonColor }} />
                        <span className="text-xs font-display font-bold text-foreground">
                          {term.season} {term.year}
                        </span>
                        <span className="ml-auto text-[10px] text-muted-foreground">
                          {term.courses.length} courses · {term.credits}cr
                        </span>
                        {term.credits > maxCredits && (
                          <AlertTriangle className="w-3 h-3 text-destructive" />
                        )}
                      </div>
                      <CardContent className="p-2">
                        <div className="space-y-1.5">
                          {term.courses.map(course => {
                            const color = getDeptColor(course.prefix);
                            return (
                              <div
                                key={course.id}
                                className="flex items-center gap-2 p-2 rounded-md border transition-colors hover:bg-accent/50 cursor-pointer"
                                style={{
                                  borderColor: course.isCritical ? color : "hsl(var(--border))",
                                  backgroundColor: course.isCritical ? `${color}08` : undefined,
                                }}
                                onClick={() => onFocusCourse?.(course.id)}
                              >
                                <div className="w-1.5 h-6 rounded-full shrink-0" style={{ backgroundColor: color }} />
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-[11px] font-mono font-bold" style={{ color }}>
                                      {course.prefix} {course.number}
                                    </span>
                                    {course.isCritical && (
                                      <span
                                        className="text-[7px] font-bold uppercase tracking-wider px-1 py-0.5 rounded"
                                        style={{ backgroundColor: `${color}20`, color }}
                                      >
                                        critical
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-[9px] text-muted-foreground truncate">{course.title}</p>
                                </div>
                                <span className="text-[9px] font-semibold text-muted-foreground shrink-0">
                                  {course.credits || 3}cr
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Unscheduled */}
      {/* Note about courses with missing prereq data */}
      {criticalPathData.unscheduled.length > 0 && (
        <Card className="border-muted">
          <CardContent className="p-3 flex items-center gap-2 text-[10px] text-muted-foreground">
            <AlertTriangle className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            <span>{criticalPathData.unscheduled.length} courses had incomplete prerequisite data and were scheduled after all resolved courses.</span>
          </CardContent>
        </Card>
      )}

      {/* Legend */}
      <Card>
        <CardContent className="p-3 flex flex-wrap gap-4 text-[10px] text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <Snowflake className="w-3 h-3" style={{ color: "hsl(25 80% 50%)" }} />
            <span>Fall semester (Aug–Dec)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Sun className="w-3 h-3" style={{ color: "hsl(200 70% 50%)" }} />
            <span>Spring semester (Jan–May)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-primary/20 text-primary">critical</span>
            <span>Courses on the longest dependency chain</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
