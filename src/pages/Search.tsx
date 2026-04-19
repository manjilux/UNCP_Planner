import { useState, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Search as SearchIcon, Heart, Star } from "lucide-react";
import { getSessionId } from "@/lib/session";
import { toast } from "@/hooks/use-toast";
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

const Search = () => {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [level, setLevel] = useState("all");
  const [dept, setDept] = useState("all");
  const [hasPrereqs, setHasPrereqs] = useState(false);
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const sessionId = getSessionId();

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(timer);
  }, [query]);

  const { data: departments } = useQuery({
    queryKey: ["departments"],
    queryFn: async () => {
      const { data } = await supabase.from("departments").select("*").order("prefix");
      return data || [];
    },
  });

  const { data: favorites, refetch: refetchFavorites } = useQuery({
    queryKey: ["favorites", sessionId],
    queryFn: async () => {
      const { data } = await supabase.from("favorites").select("course_id").eq("session_id", sessionId);
      return new Set(data?.map(f => f.course_id) || []);
    },
  });

  const { data: prereqCourseIds } = useQuery({
    queryKey: ["prereq-course-ids"],
    queryFn: async () => {
      const { data } = await supabase.from("prerequisite_relationships").select("course_id");
      return new Set(data?.map((r) => r.course_id) || []);
    },
    enabled: hasPrereqs,
  });

  const { data: courses } = useQuery({
    queryKey: ["search-courses", debouncedQuery, level, dept],
    queryFn: async () => {
      let q = supabase.from("courses").select("*").order("department_prefix").order("course_number");
      if (dept !== "all") q = q.eq("department_prefix", dept);
      if (debouncedQuery.trim()) {
        q = q.or(`title.ilike.%${debouncedQuery}%,course_number.ilike.%${debouncedQuery}%,department_prefix.ilike.%${debouncedQuery}%,description.ilike.%${debouncedQuery}%`);
      }
      const { data } = await q;
      return data || [];
    },
  });

  const toggleFavorite = useCallback(async (courseId: string) => {
    if (favorites?.has(courseId)) {
      await supabase.from("favorites").delete().eq("course_id", courseId).eq("session_id", sessionId);
    } else {
      await supabase.from("favorites").insert({ course_id: courseId, session_id: sessionId });
    }
    refetchFavorites();
  }, [favorites, sessionId, refetchFavorites]);

  const filteredCourses = courses?.filter((c) => {
    if (level !== "all") {
      const num = parseInt(c.course_number);
      const lvl = parseInt(level);
      if (num < lvl || num >= lvl + 1000) return false;
    }
    if (hasPrereqs && prereqCourseIds && !prereqCourseIds.has(c.id)) return false;
    if (favoritesOnly && favorites && !favorites.has(c.id)) return false;
    return true;
  });

  return (
    <div className="p-6 md:p-10 max-w-5xl mx-auto space-y-6">
      <h1 className="font-display text-2xl font-bold text-foreground">Search Courses</h1>

      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by course number, title, or keyword..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={dept} onValueChange={setDept}>
          <SelectTrigger className="w-full md:w-44"><SelectValue placeholder="Department" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Depts</SelectItem>
            {departments?.map((d) => (
              <SelectItem key={d.prefix} value={d.prefix}>{d.prefix}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={level} onValueChange={setLevel}>
          <SelectTrigger className="w-full md:w-36"><SelectValue placeholder="Level" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Levels</SelectItem>
            <SelectItem value="1000">1000-level</SelectItem>
            <SelectItem value="2000">2000-level</SelectItem>
            <SelectItem value="3000">3000-level</SelectItem>
            <SelectItem value="4000">4000-level</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-wrap gap-4">
        <div className="flex items-center gap-2">
          <Switch id="prereqs" checked={hasPrereqs} onCheckedChange={setHasPrereqs} />
          <Label htmlFor="prereqs" className="text-sm whitespace-nowrap">Has prereqs</Label>
        </div>
        <div className="flex items-center gap-2">
          <Switch id="favs" checked={favoritesOnly} onCheckedChange={setFavoritesOnly} />
          <Label htmlFor="favs" className="text-sm whitespace-nowrap flex items-center gap-1">
            <Heart className="w-3 h-3" /> Favorites only
          </Label>
        </div>
      </div>

      <div className="grid gap-2">
        {filteredCourses?.map((course) => (
          <HoverCard key={course.id} openDelay={400}>
            <HoverCardTrigger asChild>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  onClick={(e) => { e.preventDefault(); toggleFavorite(course.id); }}
                >
                  <Heart className={`w-4 h-4 ${favorites?.has(course.id) ? "fill-primary text-primary" : "text-muted-foreground"}`} />
                </Button>
                <Link to={`/course/${course.id}`} className="flex-1">
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
              </div>
            </HoverCardTrigger>
            {course.description && (
              <HoverCardContent className="w-80">
                <p className="text-xs text-muted-foreground line-clamp-4">{course.description}</p>
              </HoverCardContent>
            )}
          </HoverCard>
        ))}
      </div>

      <p className="text-xs text-muted-foreground text-center">
        {filteredCourses?.length || 0} results
      </p>
    </div>
  );
};

export default Search;
