import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, GitBranch, ExternalLink, Plus, Heart, MessageSquare, Trash2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/hooks/use-toast";
import { getSessionId } from "@/lib/session";
import { useState } from "react";

function getCourseLevel(num: string): string {
  const n = parseInt(num);
  if (n < 2000) return "Freshman";
  if (n < 3000) return "Sophomore";
  if (n < 4000) return "Junior";
  return "Senior";
}

function getLevelColor(num: string): string {
  const n = parseInt(num);
  if (n < 2000) return "bg-primary/20 text-primary";
  if (n < 3000) return "bg-blue-500/20 text-blue-700";
  if (n < 4000) return "bg-green-500/20 text-green-700";
  return "bg-red-500/20 text-red-700";
}

function parseDescription(desc: string): { main: string; prereqText: string; coreqText: string } {
  let main = desc;
  let prereqText = "";
  let coreqText = "";
  const prereqMatch = desc.match(/PREREQ(?:UISITE)?S?\s*:?\s*(.*?)(?=COREQ|CONCURRENT|$)/i);
  const coreqMatch = desc.match(/(?:COREQ(?:UISITE)?S?|CONCURRENT)\s*:?\s*(.*?)$/i);
  if (prereqMatch) prereqText = prereqMatch[1].trim();
  if (coreqMatch) coreqText = coreqMatch[1].trim();
  main = main.replace(/PREREQ(?:UISITE)?S?\s*:?\s*.*/i, "").trim();
  return { main, prereqText, coreqText };
}

const CourseDetail = () => {
  const { id } = useParams<{ id: string }>();
  const sessionId = getSessionId();
  const queryClient = useQueryClient();
  const [newNote, setNewNote] = useState("");

  const { data: course, isLoading } = useQuery({
    queryKey: ["course", id],
    queryFn: async () => {
      const { data } = await supabase.from("courses").select("*").eq("id", id!).single();
      return data;
    },
    enabled: !!id,
  });

  const { data: isFavorite, refetch: refetchFav } = useQuery({
    queryKey: ["favorite", id, sessionId],
    queryFn: async () => {
      const { data } = await supabase.from("favorites").select("id").eq("course_id", id!).eq("session_id", sessionId).single();
      return !!data;
    },
    enabled: !!id,
  });

  const { data: notes, refetch: refetchNotes } = useQuery({
    queryKey: ["course-notes", id],
    queryFn: async () => {
      const { data } = await supabase.from("course_notes").select("*").eq("course_id", id!).eq("session_id", sessionId).order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!id,
  });

  const { data: prerequisites } = useQuery({
    queryKey: ["prerequisites", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("prerequisite_relationships")
        .select("*, prerequisite:courses!prerequisite_relationships_prerequisite_id_fkey(id, department_prefix, course_number, title)")
        .eq("course_id", id!)
        .eq("relationship_type", "prerequisite");
      return data || [];
    },
    enabled: !!id,
  });

  const { data: corequisites } = useQuery({
    queryKey: ["corequisites", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("prerequisite_relationships")
        .select("*, prerequisite:courses!prerequisite_relationships_prerequisite_id_fkey(id, department_prefix, course_number, title)")
        .eq("course_id", id!)
        .eq("relationship_type", "corequisite");
      return data || [];
    },
    enabled: !!id,
  });

  const { data: dependents } = useQuery({
    queryKey: ["dependents", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("prerequisite_relationships")
        .select("*, course:courses!prerequisite_relationships_course_id_fkey(id, department_prefix, course_number, title)")
        .eq("prerequisite_id", id!);
      return data || [];
    },
    enabled: !!id,
  });

  const toggleFavorite = async () => {
    if (isFavorite) {
      await supabase.from("favorites").delete().eq("course_id", id!).eq("session_id", sessionId);
    } else {
      await supabase.from("favorites").insert({ course_id: id!, session_id: sessionId });
    }
    refetchFav();
  };

  const addNote = async () => {
    if (!newNote.trim()) return;
    await supabase.from("course_notes").insert({ course_id: id!, session_id: sessionId, note: newNote.trim() });
    setNewNote("");
    refetchNotes();
    toast({ title: "Note saved" });
  };

  const deleteNote = async (noteId: string) => {
    await supabase.from("course_notes").delete().eq("id", noteId);
    refetchNotes();
  };

  const handleAddToPlanner = () => {
    if (!course) return;
    try {
      const raw = localStorage.getItem("uncp-planner");
      const terms = raw ? JSON.parse(raw) : [];
      if (terms.length === 0) {
        toast({ title: "No terms", description: "Create a term in the Planner first", variant: "destructive" });
        return;
      }
      const lastTerm = terms[terms.length - 1];
      if (lastTerm.courses.find((c: any) => c.course_id === course.id)) {
        toast({ title: "Already added" });
        return;
      }
      lastTerm.courses.push({
        id: crypto.randomUUID(), course_id: course.id,
        department_prefix: course.department_prefix, course_number: course.course_number,
        title: course.title, credits: course.credits,
      });
      localStorage.setItem("uncp-planner", JSON.stringify(terms));
      toast({ title: "Added to planner", description: `Added to ${lastTerm.semester} ${lastTerm.year}` });
    } catch {
      toast({ title: "Error", variant: "destructive" });
    }
  };

  if (isLoading) {
    return (
      <div className="p-6 md:p-10 max-w-3xl mx-auto space-y-6">
        <Skeleton className="h-8 w-32" /><Skeleton className="h-12 w-full" /><Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (!course) {
    return (
      <div className="p-6 md:p-10 max-w-3xl mx-auto text-center">
        <p className="text-muted-foreground">Course not found.</p>
        <Button asChild variant="ghost" className="mt-4"><Link to="/catalog"><ArrowLeft className="w-4 h-4 mr-2" /> Back</Link></Button>
      </div>
    );
  }

  const desc = course.description ? parseDescription(course.description) : null;

  return (
    <div className="p-6 md:p-10 max-w-3xl mx-auto space-y-6">
      <Button asChild variant="ghost" size="sm">
        <Link to="/catalog"><ArrowLeft className="w-4 h-4 mr-2" /> Back to Catalog</Link>
      </Button>

      <div>
        <div className="flex items-center gap-3 mb-2 flex-wrap">
          <Badge className="font-mono gold-gradient text-primary-foreground">{course.department_prefix} {course.course_number}</Badge>
          <Badge variant="outline">{course.credits} credits</Badge>
          <Badge className={getLevelColor(course.course_number)}>{getCourseLevel(course.course_number)}</Badge>
        </div>
        <h1 className="font-display text-2xl md:text-3xl font-bold text-foreground">{course.title}</h1>
      </div>

      {desc?.main && (
        <Card>
          <CardHeader><CardTitle className="text-lg">Description</CardTitle></CardHeader>
          <CardContent><p className="text-sm text-muted-foreground leading-relaxed">{desc.main}</p></CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle className="text-lg">Prerequisites</CardTitle></CardHeader>
        <CardContent>
          {prerequisites && prerequisites.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {prerequisites.map((p) => (
                <Link key={p.id} to={p.prerequisite ? `/course/${p.prerequisite.id}` : "#"} className="inline-block">
                  <Badge variant="secondary" className="hover:bg-primary hover:text-primary-foreground transition-colors cursor-pointer">
                    {p.prerequisite ? `${p.prerequisite.department_prefix} ${p.prerequisite.course_number}` : p.prerequisite_text}
                  </Badge>
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No prerequisites required ✓</p>
          )}
          {desc?.prereqText && <p className="text-xs text-muted-foreground mt-2 italic">{desc.prereqText}</p>}
        </CardContent>
      </Card>

      {corequisites && corequisites.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-lg">Corequisites</CardTitle></CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {corequisites.map((c) => (
                <Link key={c.id} to={c.prerequisite ? `/course/${c.prerequisite.id}` : "#"} className="inline-block">
                  <Badge variant="secondary" className="hover:bg-primary hover:text-primary-foreground transition-colors cursor-pointer">
                    {c.prerequisite ? `${c.prerequisite.department_prefix} ${c.prerequisite.course_number}` : c.prerequisite_text}
                  </Badge>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {dependents && dependents.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-lg">Required By</CardTitle></CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {dependents.map((d) => (
                <Link key={d.id} to={d.course ? `/course/${d.course.id}` : "#"} className="inline-block">
                  <Badge variant="outline" className="hover:bg-accent transition-colors cursor-pointer">
                    {d.course ? `${d.course.department_prefix} ${d.course.course_number} — ${d.course.title}` : "Unknown"}
                  </Badge>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Notes */}
      <Card>
        <CardHeader><CardTitle className="text-lg flex items-center gap-2"><MessageSquare className="w-4 h-4" /> My Notes</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Textarea value={newNote} onChange={(e) => setNewNote(e.target.value)} placeholder="Add a note about this course..." rows={2} className="text-sm" />
            <Button onClick={addNote} disabled={!newNote.trim()} className="shrink-0">Save</Button>
          </div>
          {notes && notes.length > 0 && (
            <div className="space-y-2">
              {notes.map((n) => (
                <div key={n.id} className="flex items-start justify-between p-3 rounded-lg bg-muted/50">
                  <div>
                    <p className="text-sm">{n.note}</p>
                    <p className="text-xs text-muted-foreground mt-1">{new Date(n.created_at).toLocaleString()}</p>
                  </div>
                  <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => deleteNote(n.id)}>
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-3">
        <Button onClick={toggleFavorite} variant={isFavorite ? "default" : "outline"}>
          <Heart className={`w-4 h-4 mr-2 ${isFavorite ? "fill-current" : ""}`} />
          {isFavorite ? "Favorited" : "Favorite"}
        </Button>
        <Button onClick={handleAddToPlanner}>
          <Plus className="w-4 h-4 mr-2" /> Add to Planner
        </Button>
        <Button asChild variant="outline">
          <Link to={`/prereq-graph/${course.id}`}><GitBranch className="w-4 h-4 mr-2" /> Prereq Graph</Link>
        </Button>
        {course.catalog_url && (
          <Button asChild variant="outline">
            <a href={course.catalog_url} target="_blank" rel="noopener noreferrer"><ExternalLink className="w-4 h-4 mr-2" /> UNCP Catalog</a>
          </Button>
        )}
      </div>
    </div>
  );
};

export default CourseDetail;
