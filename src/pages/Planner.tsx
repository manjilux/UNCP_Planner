import { useState, useCallback, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Plus, Trash2, AlertTriangle, Search, GraduationCap } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { Link } from "react-router-dom";

type LocalCourse = {
  id: string;
  course_id: string;
  department_prefix: string;
  course_number: string;
  title: string;
  credits: number | null;
};

type LocalTerm = {
  id: string;
  semester: string;
  year: number;
  courses: LocalCourse[];
};

function loadPlan(): LocalTerm[] {
  try {
    const raw = localStorage.getItem("uncp-planner");
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function savePlan(terms: LocalTerm[]) {
  localStorage.setItem("uncp-planner", JSON.stringify(terms));
}

const Planner = () => {
  const [terms, setTerms] = useState<LocalTerm[]>(loadPlan);
  const [searchQuery, setSearchQuery] = useState("");
  const [addingToTerm, setAddingToTerm] = useState<string | null>(null);
  const [newSemester, setNewSemester] = useState("Fall");
  const [newYear, setNewYear] = useState(new Date().getFullYear().toString());

  useEffect(() => { savePlan(terms); }, [terms]);

  const { data: searchResults } = useQuery({
    queryKey: ["planner-search", searchQuery],
    queryFn: async () => {
      if (!searchQuery.trim()) return [];
      const { data } = await supabase
        .from("courses")
        .select("*")
        .or(`title.ilike.%${searchQuery}%,course_number.ilike.%${searchQuery}%,department_prefix.ilike.%${searchQuery}%`)
        .limit(10);
      return data || [];
    },
    enabled: searchQuery.length > 1,
  });

  const { data: allPrereqs } = useQuery({
    queryKey: ["all-prereqs-planner"],
    queryFn: async () => {
      const { data } = await supabase
        .from("prerequisite_relationships")
        .select("course_id, prerequisite_id, relationship_type");
      return data || [];
    },
  });

  const addTerm = useCallback(() => {
    const newTerm: LocalTerm = {
      id: crypto.randomUUID(),
      semester: newSemester,
      year: parseInt(newYear),
      courses: [],
    };
    setTerms(prev => [...prev, newTerm]);
    toast({ title: "Term added" });
  }, [newSemester, newYear]);

  const removeTerm = useCallback((termId: string) => {
    setTerms(prev => prev.filter(t => t.id !== termId));
    toast({ title: "Term removed" });
  }, []);

  const addCourseToTerm = useCallback((termId: string, course: any) => {
    setTerms(prev => prev.map(t => {
      if (t.id !== termId) return t;
      if (t.courses.find(c => c.course_id === course.id)) return t;
      return {
        ...t,
        courses: [...t.courses, {
          id: crypto.randomUUID(),
          course_id: course.id,
          department_prefix: course.department_prefix,
          course_number: course.course_number,
          title: course.title,
          credits: course.credits,
        }],
      };
    }));
    setAddingToTerm(null);
    setSearchQuery("");
    toast({ title: "Course added" });
  }, []);

  const removeCourse = useCallback((termId: string, courseEntryId: string) => {
    setTerms(prev => prev.map(t =>
      t.id === termId ? { ...t, courses: t.courses.filter(c => c.id !== courseEntryId) } : t
    ));
  }, []);

  function getPrereqWarnings(term: LocalTerm): string[] {
    const warnings: string[] = [];
    const termIndex = terms.findIndex((t) => t.id === term.id);
    const previousCourseIds = new Set(
      terms.slice(0, termIndex).flatMap((t) => t.courses.map((c) => c.course_id))
    );
    for (const course of term.courses) {
      const prereqs = allPrereqs?.filter(
        (p) => p.course_id === course.course_id && p.relationship_type === "prerequisite" && p.prerequisite_id
      );
      for (const prereq of prereqs || []) {
        if (prereq.prerequisite_id && !previousCourseIds.has(prereq.prerequisite_id)) {
          warnings.push(`${course.department_prefix} ${course.course_number} requires a prerequisite not in earlier terms`);
          break;
        }
      }
    }
    return warnings;
  }

  const totalCredits = terms.reduce((sum, t) => sum + t.courses.reduce((s, c) => s + (c.credits || 0), 0), 0);

  return (
    <div className="p-6 md:p-10 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">Semester Planner</h1>
          <p className="text-sm text-muted-foreground">Plan your courses — saved locally in your browser</p>
        </div>
        <Badge variant="outline" className="text-lg px-4 py-2">
          <GraduationCap className="w-4 h-4 mr-2" />
          {totalCredits} total credits
        </Badge>
      </div>

      {/* Add Term */}
      <Card>
        <CardContent className="p-4 flex flex-col md:flex-row items-center gap-3">
          <Select value={newSemester} onValueChange={setNewSemester}>
            <SelectTrigger className="w-full md:w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="Fall">Fall</SelectItem>
              <SelectItem value="Spring">Spring</SelectItem>
              <SelectItem value="Summer">Summer</SelectItem>
            </SelectContent>
          </Select>
          <Input type="number" value={newYear} onChange={(e) => setNewYear(e.target.value)} className="w-full md:w-24" min={2020} max={2035} />
          <Button onClick={addTerm}><Plus className="w-4 h-4 mr-2" /> Add Term</Button>
        </CardContent>
      </Card>

      {terms.length === 0 && (
        <Card className="border-primary/30 bg-accent/50">
          <CardContent className="p-8 text-center">
            <GraduationCap className="w-10 h-10 text-primary mx-auto mb-3" />
            <p className="text-muted-foreground mb-2">No terms yet — add your first semester above!</p>
            <p className="text-xs text-muted-foreground">Your plan is saved automatically in your browser.</p>
          </CardContent>
        </Card>
      )}

      {terms.map((term) => {
        const warnings = getPrereqWarnings(term);
        const termCredits = term.courses.reduce((sum, c) => sum + (c.credits || 0), 0);

        return (
          <Card key={term.id} className="border-border">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <div>
                <CardTitle className="font-display text-lg">{term.semester} {term.year}</CardTitle>
                <p className="text-sm text-muted-foreground">{termCredits} credits · {term.courses.length} courses</p>
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={() => setAddingToTerm(addingToTerm === term.id ? null : term.id)}>
                  <Plus className="w-4 h-4" />
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="sm">
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete {term.semester} {term.year}?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will remove the term and all {term.courses.length} course(s) in it. This action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={() => removeTerm(term.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {warnings.length > 0 && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                  <AlertTriangle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                  <div className="text-xs text-destructive">
                    {warnings.map((w, i) => <p key={i}>{w}</p>)}
                  </div>
                </div>
              )}

              {term.courses.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No courses added yet</p>
              ) : (
                term.courses.map((c) => (
                  <div key={c.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <Link to={`/course/${c.course_id}`} className="flex items-center gap-3 hover:text-primary transition-colors">
                      <Badge variant="outline" className="font-mono text-xs">{c.department_prefix} {c.course_number}</Badge>
                      <span className="text-sm">{c.title}</span>
                    </Link>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">{c.credits} cr</span>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7">
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Remove {c.department_prefix} {c.course_number}?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to remove "{c.title}" from this term?
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => removeCourse(term.id, c.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Remove</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                ))
              )}

              {addingToTerm === term.id && (
                <div className="mt-3 space-y-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input placeholder="Search courses to add..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10" autoFocus />
                  </div>
                  {searchResults && searchResults.length > 0 && (
                    <div className="border rounded-lg max-h-48 overflow-y-auto">
                      {searchResults.map((c) => (
                        <button key={c.id} onClick={() => addCourseToTerm(term.id, c)}
                          className="w-full text-left p-2 hover:bg-accent/50 border-b last:border-0 text-sm flex items-center justify-between">
                          <span>
                            <span className="font-mono text-xs font-medium">{c.department_prefix} {c.course_number}</span>
                            {" — "}{c.title}
                          </span>
                          <span className="text-xs text-muted-foreground">{c.credits} cr</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};

export default Planner;
