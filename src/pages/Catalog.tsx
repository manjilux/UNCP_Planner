import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { BookOpen, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";

function getCourseLevel(num: string): string {
  const n = parseInt(num);
  if (n < 2000) return "Freshman";
  if (n < 3000) return "Sophomore";
  if (n < 4000) return "Junior";
  return "Senior";
}

const Catalog = () => {
  const [selectedDept, setSelectedDept] = useState<string>("all");
  const [selectedLevel, setSelectedLevel] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("number");
  const [showAll, setShowAll] = useState(false);

  const { data: departments } = useQuery({
    queryKey: ["departments"],
    queryFn: async () => {
      const { data } = await supabase.from("departments").select("*").order("prefix");
      return data || [];
    },
  });

  const { data: courses, isLoading } = useQuery({
    queryKey: ["courses", selectedDept],
    queryFn: async () => {
      let query = supabase.from("courses").select("*").order("department_prefix").order("course_number");
      if (selectedDept !== "all") {
        query = query.eq("department_prefix", selectedDept);
      }
      const { data } = await query;
      return data || [];
    },
  });

  let filteredCourses = courses?.filter(c => {
    if (selectedLevel !== "all") {
      const num = parseInt(c.course_number);
      const lvl = parseInt(selectedLevel);
      if (num < lvl || num >= lvl + 1000) return false;
    }
    return true;
  }) || [];

  if (sortBy === "title") {
    filteredCourses = [...filteredCourses].sort((a, b) => a.title.localeCompare(b.title));
  } else if (sortBy === "credits") {
    filteredCourses = [...filteredCourses].sort((a, b) => (b.credits || 0) - (a.credits || 0));
  }

  const displayCourses = showAll ? filteredCourses : filteredCourses.slice(0, 50);

  return (
    <div className="p-6 md:p-10 max-w-5xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">Course Catalog</h1>
          <p className="text-sm text-muted-foreground">Browse courses by department and level</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Select value={selectedDept} onValueChange={setSelectedDept}>
            <SelectTrigger className="w-full md:w-56"><SelectValue placeholder="All Departments" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Departments</SelectItem>
              {departments?.map((d) => (
                <SelectItem key={d.prefix} value={d.prefix}>{d.prefix} — {d.name || d.prefix}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={selectedLevel} onValueChange={setSelectedLevel}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Levels</SelectItem>
              <SelectItem value="1000">1000</SelectItem>
              <SelectItem value="2000">2000</SelectItem>
              <SelectItem value="3000">3000</SelectItem>
              <SelectItem value="4000">4000+</SelectItem>
            </SelectContent>
          </Select>
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="number">By Number</SelectItem>
              <SelectItem value="title">By Title</SelectItem>
              <SelectItem value="credits">By Credits</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-3">
          {[...Array(6)].map((_, i) => <div key={i} className="h-20 rounded-lg bg-muted animate-pulse" />)}
        </div>
      ) : filteredCourses.length === 0 ? (
        <Card>
          <CardContent className="p-10 text-center">
            <BookOpen className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">No courses found. Try scraping the catalog first.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-2">
            {displayCourses.map((course) => (
              <HoverCard key={course.id} openDelay={400}>
                <HoverCardTrigger asChild>
                  <Link to={`/course/${course.id}`}>
                    <Card className="border-border hover:border-primary/40 transition-all hover:shadow-sm cursor-pointer">
                      <CardContent className="p-4 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <Badge variant="outline" className="font-mono text-xs shrink-0">
                            {course.department_prefix} {course.course_number}
                          </Badge>
                          <span className="text-sm font-medium text-foreground">{course.title}</span>
                          <Badge variant="secondary" className="text-[10px] hidden md:inline-flex">
                            {getCourseLevel(course.course_number)}
                          </Badge>
                        </div>
                        <Badge className="shrink-0 bg-accent text-accent-foreground">{course.credits} cr</Badge>
                      </CardContent>
                    </Card>
                  </Link>
                </HoverCardTrigger>
                {course.description && (
                  <HoverCardContent className="w-80">
                    <p className="text-xs text-muted-foreground line-clamp-4">{course.description}</p>
                  </HoverCardContent>
                )}
              </HoverCard>
            ))}
          </div>

          {filteredCourses.length > 50 && !showAll && (
            <div className="text-center">
              <Button variant="outline" onClick={() => setShowAll(true)}>
                <ChevronDown className="w-4 h-4 mr-2" /> Show all {filteredCourses.length} courses
              </Button>
            </div>
          )}
          {showAll && filteredCourses.length > 50 && (
            <div className="text-center">
              <Button variant="outline" onClick={() => setShowAll(false)}>
                <ChevronUp className="w-4 h-4 mr-2" /> Show fewer
              </Button>
            </div>
          )}
        </>
      )}

      <p className="text-xs text-muted-foreground text-center">
        {displayCourses.length} of {filteredCourses.length} courses shown
      </p>
    </div>
  );
};

export default Catalog;
