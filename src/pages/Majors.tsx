import { useState, useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link, useNavigate } from "react-router-dom";
import { GraduationCap, BookOpen, Shield, Monitor, Plus, Check, GitBranch, List, ChevronDown, ChevronRight, Cpu } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import MajorGraph from "@/components/MajorGraph";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

const PROGRAM_ICONS: Record<string, typeof GraduationCap> = {
  "CS-GEN": Monitor,
  "CS-CYB": Shield,
  "CYB": Shield,
  "IT-GEN": BookOpen,
  "IT-CYB": Cpu,
};

const Majors = () => {
  const [selectedProgramId, setSelectedProgramId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"list" | "graph">("list");
  const [selectedCourse, setSelectedCourse] = useState<string | null>(null);
  const [openCategories, setOpenCategories] = useState<Set<string>>(new Set(["core", "cybersecurity", "math"]));
  const navigate = useNavigate();

  // Fetch programs from DB
  const { data: programs } = useQuery({
    queryKey: ["programs"],
    queryFn: async () => {
      const { data } = await supabase.from("programs").select("*").order("code");
      return data || [];
    },
  });

  // Auto-select first program
  const selectedProgram = useMemo(() => {
    if (!programs?.length) return null;
    if (selectedProgramId) return programs.find(p => p.id === selectedProgramId) || programs[0];
    return programs[0];
  }, [programs, selectedProgramId]);

  // Fetch requirements for selected program
  const { data: requirements } = useQuery({
    queryKey: ["program-requirements", selectedProgram?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("program_requirements")
        .select("*, course:courses(id, department_prefix, course_number, title, credits)")
        .eq("program_id", selectedProgram!.id);
      return data || [];
    },
    enabled: !!selectedProgram?.id,
  });

  const { data: courses } = useQuery({
    queryKey: ["all-courses-for-majors"],
    queryFn: async () => {
      const { data } = await supabase.from("courses").select("id, department_prefix, course_number, title, credits");
      return data || [];
    },
  });

  const { data: allPrereqs } = useQuery({
    queryKey: ["all-prereqs-majors"],
    queryFn: async () => {
      const { data } = await supabase
        .from("prerequisite_relationships")
        .select("course_id, prerequisite_id, relationship_type, course:courses!prerequisite_relationships_course_id_fkey(id, department_prefix, course_number, title, credits), prerequisite:courses!prerequisite_relationships_prerequisite_id_fkey(id, department_prefix, course_number, title, credits)");
      return data || [];
    },
  });

  // Planner state
  const plannerCourseIds = useMemo(() => {
    const ids = new Set<string>();
    try {
      const raw = localStorage.getItem("uncp-planner");
      if (raw) {
        const terms = JSON.parse(raw);
        for (const t of terms) for (const c of t.courses) ids.add(c.course_id);
      }
    } catch {}
    return ids;
  }, []);

  // Group requirements by category
  const categorizedReqs = useMemo(() => {
    if (!requirements) return [];
    const catMap = new Map<string, typeof requirements>();
    for (const req of requirements) {
      if (!catMap.has(req.category)) catMap.set(req.category, []);
      catMap.get(req.category)!.push(req);
    }
    // Sort: core first, then alphabetical
    const order = ["core", "cybersecurity", "math", "track_elective", "major_elective"];
    return Array.from(catMap.entries()).sort((a, b) => {
      const ai = order.indexOf(a[0]), bi = order.indexOf(b[0]);
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    });
  }, [requirements]);

  const CATEGORY_LABELS: Record<string, string> = {
    core: "Core Requirements",
    cybersecurity: "Cybersecurity Requirements",
    math: "Math Requirements",
    track_elective: "Track Electives (choose from list)",
    major_elective: "Major Electives (choose from list)",
  };

  // All course IDs for this major
  const majorCourseIds = useMemo(() => {
    const ids = new Set<string>();
    if (!requirements) return ids;
    for (const req of requirements) {
      if (req.course_id) ids.add(req.course_id);
    }
    return ids;
  }, [requirements]);

  const getPrereqsForCourse = useCallback((courseId: string) => {
    return allPrereqs?.filter(p => p.course_id === courseId && p.prerequisite_id && p.relationship_type === "prerequisite") || [];
  }, [allPrereqs]);

  const getCoreqsForCourse = useCallback((courseId: string) => {
    return allPrereqs?.filter(p => p.course_id === courseId && p.prerequisite_id && p.relationship_type === "corequisite") || [];
  }, [allPrereqs]);

  const totalReqs = requirements?.length || 0;
  const plannedReqs = requirements?.filter(r => r.course_id && plannerCourseIds.has(r.course_id)).length || 0;
  const totalCredits = requirements?.reduce((sum, r) => sum + ((r.course as any)?.credits || 3), 0) || 0;
  const plannedCredits = requirements?.filter(r => r.course_id && plannerCourseIds.has(r.course_id))
    .reduce((sum, r) => sum + ((r.course as any)?.credits || 3), 0) || 0;

  const addToPlanner = (courseData: any) => {
    try {
      const raw = localStorage.getItem("uncp-planner");
      const terms = raw ? JSON.parse(raw) : [];
      if (terms.length === 0) {
        toast({ title: "No terms", description: "Create a term in the Planner first", variant: "destructive" });
        return;
      }
      const lastTerm = terms[terms.length - 1];
      if (lastTerm.courses.find((c: any) => c.course_id === courseData.id)) {
        toast({ title: "Already in plan" }); return;
      }
      lastTerm.courses.push({
        id: crypto.randomUUID(), course_id: courseData.id,
        department_prefix: courseData.department_prefix, course_number: courseData.course_number,
        title: courseData.title, credits: courseData.credits,
      });
      localStorage.setItem("uncp-planner", JSON.stringify(terms));
      toast({ title: "Added!", description: `${courseData.department_prefix} ${courseData.course_number} → ${lastTerm.semester} ${lastTerm.year}` });
    } catch {
      toast({ title: "Error", variant: "destructive" });
    }
  };

  const toggleCategory = (name: string) => {
    setOpenCategories(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name); else next.add(name);
      return next;
    });
  };

  return (
    <div className="p-6 md:p-10 max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">Major Requirements</h1>
          <p className="text-sm text-muted-foreground">Select your major to see all required courses and prerequisites</p>
        </div>
        <div className="flex gap-2">
          <Button variant={viewMode === "list" ? "default" : "outline"} size="sm" onClick={() => setViewMode("list")}>
            <List className="w-4 h-4 mr-1" /> Courses
          </Button>
          <Button variant={viewMode === "graph" ? "default" : "outline"} size="sm" onClick={() => setViewMode("graph")}>
            <GitBranch className="w-4 h-4 mr-1" /> Graph
          </Button>
        </div>
      </div>

      {/* Program Selector */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {programs?.map((prog) => {
          const isSelected = selectedProgram?.id === prog.id;
          const Icon = PROGRAM_ICONS[prog.code] || GraduationCap;
          return (
            <button
              key={prog.id}
              onClick={() => { setSelectedProgramId(prog.id); setSelectedCourse(null); }}
              className={`p-3 rounded-xl border-2 text-left transition-all ${
                isSelected ? "border-primary bg-primary/10 shadow-md" : "border-border hover:border-primary/40 bg-card"
              }`}
            >
              <div className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${isSelected ? "bg-primary" : "bg-muted"}`}>
                  <Icon className={`w-4 h-4 ${isSelected ? "text-primary-foreground" : "text-muted-foreground"}`} />
                </div>
                <div className="min-w-0">
                  <p className="font-display font-semibold text-foreground text-sm">{prog.code}</p>
                  <p className="text-[10px] text-muted-foreground truncate">{prog.degree_type}</p>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {selectedProgram && (
        <>
          {/* Progress Bar */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="font-display font-semibold text-sm">{selectedProgram.name}</span>
                <div className="text-sm text-muted-foreground">
                  {plannedReqs}/{totalReqs} courses · {plannedCredits}/{totalCredits} credits
                </div>
              </div>
              <div className="w-full bg-muted rounded-full h-3">
                <div className="bg-primary h-3 rounded-full transition-all duration-500"
                  style={{ width: `${totalReqs > 0 ? (plannedReqs / totalReqs) * 100 : 0}%` }} />
              </div>
            </CardContent>
          </Card>

          {viewMode === "list" ? (
            <div className="space-y-3">
              {categorizedReqs.map(([category, reqs]) => {
                const isOpen = openCategories.has(category);
                const catPlanned = reqs.filter(r => r.course_id && plannerCourseIds.has(r.course_id));
                const isElective = reqs[0]?.is_elective;

                return (
                  <Collapsible key={category} open={isOpen} onOpenChange={() => toggleCategory(category)}>
                    <Card>
                      <CollapsibleTrigger asChild>
                        <CardHeader className="cursor-pointer hover:bg-muted/30 transition-colors py-3">
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-base flex items-center gap-2">
                              {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                              {CATEGORY_LABELS[category] || category}
                              {isElective && <Badge variant="secondary" className="text-[10px]">Elective</Badge>}
                            </CardTitle>
                            <Badge variant="outline" className="text-xs">{catPlanned.length}/{reqs.length}</Badge>
                          </div>
                        </CardHeader>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <CardContent className="pt-0 space-y-1">
                          {reqs.map((req) => {
                            const courseData = req.course as any;
                            const isPlanned = req.course_id && plannerCourseIds.has(req.course_id);
                            const isSelected2 = courseData?.id === selectedCourse;
                            const prereqs = courseData ? getPrereqsForCourse(courseData.id) : [];
                            const coreqs = courseData ? getCoreqsForCourse(courseData.id) : [];

                            return (
                              <div key={req.id}>
                                <div
                                  className={`flex items-center justify-between p-3 rounded-lg cursor-pointer transition-all ${
                                    isSelected2 ? "bg-primary/15 border border-primary/30 shadow-sm" :
                                    isPlanned ? "bg-primary/5 border border-primary/10" : "bg-muted/30 hover:bg-muted/60"
                                  }`}
                                  onClick={() => setSelectedCourse(courseData?.id === selectedCourse ? null : courseData?.id || null)}
                                >
                                  <div className="flex items-center gap-3">
                                    <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                                      isPlanned ? "border-primary bg-primary" : "border-muted-foreground/30"
                                    }`}>
                                      {isPlanned && <Check className="w-3 h-3 text-primary-foreground" />}
                                    </div>
                                    <Badge variant="outline" className="font-mono text-xs">{req.course_code}</Badge>
                                    {courseData ? (
                                      <span className="text-sm font-medium">{courseData.title}</span>
                                    ) : (
                                      <span className="text-sm text-muted-foreground italic">Not yet in catalog</span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2">
                                    {prereqs.length > 0 && (
                                      <Badge variant="secondary" className="text-[10px]">{prereqs.length} prereq{prereqs.length > 1 ? "s" : ""}</Badge>
                                    )}
                                    {courseData && <span className="text-xs text-muted-foreground">{courseData.credits} cr</span>}
                                  </div>
                                </div>

                                {isSelected2 && courseData && (
                                  <div className="ml-9 mt-1 mb-2 p-3 rounded-lg bg-card border border-border space-y-3">
                                    {prereqs.length > 0 && (
                                      <div>
                                        <p className="text-xs font-medium text-muted-foreground mb-1">Prerequisites:</p>
                                        <div className="flex flex-wrap gap-1.5">
                                          {prereqs.map(p => (
                                            <Link key={p.prerequisite_id} to={`/course/${p.prerequisite_id}`}>
                                              <Badge variant="secondary" className="hover:bg-primary hover:text-primary-foreground transition-colors text-xs cursor-pointer">
                                                {p.prerequisite ? `${(p.prerequisite as any).department_prefix} ${(p.prerequisite as any).course_number}` : "Unknown"}
                                              </Badge>
                                            </Link>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                    {coreqs.length > 0 && (
                                      <div>
                                        <p className="text-xs font-medium text-muted-foreground mb-1">Corequisites:</p>
                                        <div className="flex flex-wrap gap-1.5">
                                          {coreqs.map(p => (
                                            <Link key={p.prerequisite_id} to={`/course/${p.prerequisite_id}`}>
                                              <Badge variant="outline" className="hover:bg-accent transition-colors text-xs cursor-pointer">
                                                {p.prerequisite ? `${(p.prerequisite as any).department_prefix} ${(p.prerequisite as any).course_number}` : "Unknown"}
                                              </Badge>
                                            </Link>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                    {prereqs.length === 0 && coreqs.length === 0 && (
                                      <p className="text-xs text-muted-foreground">No prerequisites required ✓</p>
                                    )}
                                    <div className="flex gap-2">
                                      {!isPlanned && (
                                        <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); addToPlanner(courseData); }}>
                                          <Plus className="w-3 h-3 mr-1" /> Add to Planner
                                        </Button>
                                      )}
                                      <Button size="sm" variant="ghost" asChild>
                                        <Link to={`/course/${courseData.id}`}>View Details</Link>
                                      </Button>
                                      <Button size="sm" variant="ghost" asChild>
                                        <Link to={`/prereq-graph/${courseData.id}`}>
                                          <GitBranch className="w-3 h-3 mr-1" /> Graph
                                        </Link>
                                      </Button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </CardContent>
                      </CollapsibleContent>
                    </Card>
                  </Collapsible>
                );
              })}
            </div>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <GitBranch className="w-5 h-5 text-primary" />
                  {selectedProgram.name} — Prerequisite Graph
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                  Bright nodes = in this major. Dimmer = external prerequisites. Click to view details.
                </p>
              </CardHeader>
              <CardContent className="p-0 overflow-hidden rounded-b-xl">
                {courses && allPrereqs ? (
                  <MajorGraph
                    courseIds={majorCourseIds}
                    allPrereqs={allPrereqs as any}
                    courses={courses.map(c => ({ id: c.id, prefix: c.department_prefix, number: c.course_number, title: c.title, credits: c.credits }))}
                    highlightIds={selectedCourse ? new Set([selectedCourse]) : undefined}
                    onNodeClick={(id) => navigate(`/course/${id}`)}
                    height="550px"
                  />
                ) : (
                  <div className="h-[550px] flex items-center justify-center text-muted-foreground">Loading graph...</div>
                )}
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
};

export default Majors;
