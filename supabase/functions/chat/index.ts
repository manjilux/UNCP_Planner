import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `You are the UNCP Academic Advisor AI, built into the UNCP Academic Planner web app. You help students find courses, plan their semesters, and navigate the app.

## App Pages
- **Dashboard** (/) – Overview with stats and quick links
- **Catalog** (/catalog) – Browse all courses by department
- **Search** (/search) – Search courses by keyword, prefix, or number
- **Majors** (/majors) – View major programs and their requirements
- **Prereq Graph** (/prereq-graph) – Visual prerequisite dependency graph
- **Planner** (/planner) – Build semester-by-semester plans; includes a 4-Year Plan generator
- **Compare** (/compare) – Compare two majors side by side
- **Analytics** (/analytics) – Department and credit statistics
- **Course Detail** (/course/:id) – Detailed info for a specific course

## Guidelines
- When suggesting a course, mention its prefix, number, title, and credits if known.
- When a student asks where to find something, point them to the specific page.
- Format course references like: **CSC 1300 - Intro to Computer Science (3 cr)**
- Use markdown for formatting. Keep answers concise and helpful.
- If asked about prerequisites, suggest checking the Prereq Graph page.
- If asked about planning, suggest the Planner page and its 4-Year Plan tab.`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    // Build DB context from the latest user message
    const lastUserMsg = [...messages].reverse().find((m: any) => m.role === "user")?.content || "";
    let dbContext = "";

    try {
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );

      // Search courses matching user query
      const terms = lastUserMsg.split(/\s+/).filter((t: string) => t.length > 2).slice(0, 5);
      if (terms.length > 0) {
        const orFilter = terms
          .map((t: string) => `title.ilike.%${t}%,department_prefix.ilike.%${t}%,course_number.ilike.%${t}%,description.ilike.%${t}%`)
          .join(",");

        const { data: courses } = await supabase
          .from("courses")
          .select("department_prefix, course_number, title, credits, description")
          .or(orFilter)
          .limit(15);

        if (courses && courses.length > 0) {
          dbContext += "\n\n## Relevant Courses from DB:\n";
          for (const c of courses) {
            dbContext += `- **${c.department_prefix} ${c.course_number}** - ${c.title} (${c.credits ?? "?"} cr)${c.description ? ": " + c.description.slice(0, 120) : ""}\n`;
          }
        }

        // Search programs
        const { data: programs } = await supabase
          .from("programs")
          .select("name, code, degree_type, total_credits")
          .or(terms.map((t: string) => `name.ilike.%${t}%,code.ilike.%${t}%`).join(","))
          .limit(5);

        if (programs && programs.length > 0) {
          dbContext += "\n## Relevant Programs:\n";
          for (const p of programs) {
            dbContext += `- **${p.name}** (${p.code}, ${p.degree_type}, ${p.total_credits} credits)\n`;
          }
        }
      }
    } catch (e) {
      console.error("DB context error (non-fatal):", e);
    }

    const systemMessage = SYSTEM_PROMPT + dbContext;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [{ role: "system", content: systemMessage }, ...messages],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI usage limit reached. Please add credits." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "AI service error" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
