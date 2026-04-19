import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { GitCompare, Plus, X, BookOpen, GitBranch, Layers } from "lucide-react";
import { Link } from "react-router-dom";

function getCourseLevel(num: string): string {
  const n = parseInt(num);
  if (n < 2000) return "Freshman";
  if (n < 3000) return "Sophomore";
  if (n < 4000) return "Junior";
  return "Senior";
}

const Compare = () => {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const { data: courses } = useQuery({
    queryKey: ["compare-courses-list"],
    queryFn: async () => {
      const { data } = await supabase.from("courses").select("id, department_prefix, course_number, title, credits, description").order("department_prefix").order("course_number");
      return data || [];
    },
  });

  const { data: prereqs } = useQuery({
    queryKey: ["compare-prereqs"],
    queryFn: async () => {
      const { data } = await supabase
        .from("prerequisite_relationships")
        .select("course_id, prerequisite_id, relationship_type, prerequisite:courses!prerequisite_relationships_prerequisite_id_fkey(department_prefix, course_number, title)");
      return data || [];
    },
  });

  const selectedCourses = useMemo(() =>
    selectedIds.map(id => courses?.find(c => c.id === id)).filter(Boolean) as NonNullable<typeof courses>[number][],
    [selectedIds, courses]
  );

  const addCourse = (id: string) => {
    if (selectedIds.length < 4 && !selectedIds.includes(id)) {
      setSelectedIds([...selectedIds, id]);
    }
  };

  const removeCourse = (id: string) => setSelectedIds(selectedIds.filter(x => x !== id));

  const getPrereqsFor = (courseId: string) =>
    prereqs?.filter(p => p.course_id === courseId && p.prerequisite_id) || [];

  return (
    <div className="p-6 md:p-10 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-foreground flex items-center gap-2">
          <GitCompare className="w-6 h-6 text-primary" /> Compare Courses
        </h1>
        <p className="text-sm text-muted-foreground">Select up to 4 courses to compare side-by-side</p>
      </div>

      {/* Course Picker */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-3">
            <Select onValueChange={addCourse} value="">
              <SelectTrigger className="w-full md:w-80">
                <SelectValue placeholder="Add a course to compare..." />
              </SelectTrigger>
              <SelectContent className="max-h-64">
                {courses?.filter(c => !selectedIds.includes(c.id)).map(c => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.department_prefix} {c.course_number} — {c.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex flex-wrap gap-2">
              {selectedCourses.map(c => (
                <Badge key={c.id} className="gap-1 pr-1">
                  {c.department_prefix} {c.course_number}
                  <button onClick={() => removeCourse(c.id)} className="ml-1 hover:bg-primary-foreground/20 rounded-full p-0.5">
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {selectedCourses.length === 0 ? (
        <Card>
          <CardContent className="p-10 text-center">
            <GitCompare className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">Select courses above to start comparing</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${Math.min(selectedCourses.length, 4)}, 1fr)` }}>
          {selectedCourses.map(course => {
            const coursePrereqs = getPrereqsFor(course.id);
            const prereqOnly = coursePrereqs.filter(p => p.relationship_type === "prerequisite");
            const coreqOnly = coursePrereqs.filter(p => p.relationship_type === "corequisite");

            return (
              <Card key={course.id} className="border-primary/20">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <Badge variant="outline" className="font-mono text-xs">
                      {course.department_prefix} {course.course_number}
                    </Badge>
                    <button onClick={() => removeCourse(course.id)} className="text-muted-foreground hover:text-foreground">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <CardTitle className="text-base">{course.title}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Quick Stats */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="p-2.5 rounded-lg bg-accent/50 text-center">
                      <p className="text-lg font-bold text-foreground">{course.credits ?? "—"}</p>
                      <p className="text-[10px] text-muted-foreground">Credits</p>
                    </div>
                    <div className="p-2.5 rounded-lg bg-accent/50 text-center">
                      <p className="text-lg font-bold text-foreground">{getCourseLevel(course.course_number)}</p>
                      <p className="text-[10px] text-muted-foreground">Level</p>
                    </div>
                  </div>

                  {/* Description */}
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1"><BookOpen className="w-3 h-3" /> Description</p>
                    <p className="text-xs text-foreground/80 line-clamp-5">
                      {course.description || "No description available"}
                    </p>
                  </div>

                  {/* Prerequisites */}
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1"><GitBranch className="w-3 h-3" /> Prerequisites ({prereqOnly.length})</p>
                    {prereqOnly.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {prereqOnly.map(p => (
                          <Badge key={p.prerequisite_id} variant="secondary" className="text-[10px]">
                            {p.prerequisite ? `${(p.prerequisite as any).department_prefix} ${(p.prerequisite as any).course_number}` : "—"}
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">None ✓</p>
                    )}
                  </div>

                  {/* Corequisites */}
                  {coreqOnly.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1">Corequisites ({coreqOnly.length})</p>
                      <div className="flex flex-wrap gap-1">
                        {coreqOnly.map(p => (
                          <Badge key={p.prerequisite_id} variant="outline" className="text-[10px]">
                            {p.prerequisite ? `${(p.prerequisite as any).department_prefix} ${(p.prerequisite as any).course_number}` : "—"}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-2 pt-2">
                    <Button size="sm" variant="outline" className="flex-1 text-xs" asChild>
                      <Link to={`/course/${course.id}`}>Details</Link>
                    </Button>
                    <Button size="sm" variant="outline" className="flex-1 text-xs" asChild>
                      <Link to="/prereq-graph">
                        <GitBranch className="w-3 h-3 mr-1" /> Graph
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Compare;
