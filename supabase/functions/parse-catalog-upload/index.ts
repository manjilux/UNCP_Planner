import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// Parse various catalog text formats into course objects
function parseCoursesFromText(text: string): Array<{
  prefix: string; number: string; title: string; credits: number; description: string;
}> {
  const courses: Array<{ prefix: string; number: string; title: string; credits: number; description: string }> = [];

  // Pattern 1: "CSC 1550. Introduction to Computer Science (3 credits)"
  const pattern1 = /([A-Z]{2,4})\s+(\d{4})\.\s+(.+?)\s*\((\d+)\s+credits?\)/gi;
  let match;
  while ((match = pattern1.exec(text)) !== null) {
    courses.push({
      prefix: match[1], number: match[2], title: match[3].trim(),
      credits: parseInt(match[4]), description: '',
    });
  }

  if (courses.length > 0) return courses;

  // Pattern 2: Tab/comma separated - "CSC\t1550\tIntroduction to CS\t3"
  const lines = text.split('\n').filter(l => l.trim());
  for (const line of lines) {
    const parts = line.split(/[\t,]+/).map(p => p.trim());
    if (parts.length >= 3) {
      // Try prefix, number, title, credits
      const prefixMatch = parts[0].match(/^([A-Z]{2,4})$/);
      const numMatch = parts[1]?.match(/^(\d{4})$/);
      if (prefixMatch && numMatch) {
        courses.push({
          prefix: prefixMatch[1], number: numMatch[1],
          title: parts[2], credits: parseInt(parts[3]) || 3, description: parts[4] || '',
        });
        continue;
      }
      // Try combined "CSC 1550", title, credits
      const combined = parts[0].match(/^([A-Z]{2,4})\s+(\d{4})$/);
      if (combined) {
        courses.push({
          prefix: combined[1], number: combined[2],
          title: parts[1], credits: parseInt(parts[2]) || 3, description: parts[3] || '',
        });
      }
    }
  }

  if (courses.length > 0) return courses;

  // Pattern 3: Just scan for any "PREFIX NUMBER" with context
  const simplePattern = /\b([A-Z]{2,4})\s+(\d{4})\b[.\s]+([^\n(]+?)(?:\s*\((\d+)\s*(?:credits?|cr)?\))?/gi;
  while ((match = simplePattern.exec(text)) !== null) {
    const key = `${match[1]}-${match[2]}`;
    if (!courses.find(c => `${c.prefix}-${c.number}` === key)) {
      courses.push({
        prefix: match[1], number: match[2],
        title: match[3].trim().replace(/\s+/g, ' ').substring(0, 200),
        credits: parseInt(match[4]) || 3, description: '',
      });
    }
  }

  return courses;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const { text, fileName } = await req.json();

    if (!text || typeof text !== 'string') {
      return new Response(JSON.stringify({ success: false, error: 'No text content provided' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Parsing uploaded file: ${fileName}, length: ${text.length}`);

    const courses = parseCoursesFromText(text);
    console.log(`Parsed ${courses.length} courses from uploaded file`);

    if (courses.length === 0) {
      return new Response(JSON.stringify({
        success: false,
        error: 'No courses found in the uploaded text. Expected formats: "CSC 1550. Title (3 credits)" or tab/comma-separated.',
      }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Upsert departments
    const prefixes = [...new Set(courses.map(c => c.prefix))];
    for (const prefix of prefixes) {
      await supabase.from('departments').upsert({ prefix, name: prefix }, { onConflict: 'prefix' });
    }

    // Upsert courses
    let inserted = 0;
    let updated = 0;
    for (const course of courses) {
      const { data: existing } = await supabase.from('courses')
        .select('id')
        .eq('department_prefix', course.prefix)
        .eq('course_number', course.number)
        .single();

      if (existing) {
        await supabase.from('courses').update({
          title: course.title,
          credits: course.credits,
          ...(course.description ? { description: course.description } : {}),
        }).eq('id', existing.id);
        updated++;
      } else {
        await supabase.from('courses').insert({
          department_prefix: course.prefix,
          course_number: course.number,
          title: course.title,
          credits: course.credits,
          description: course.description || null,
        });
        inserted++;
      }
    }

    // Log it
    await supabase.from('scrape_logs').insert({
      status: 'completed',
      departments_scraped: prefixes.length,
      courses_found: courses.length,
      completed_at: new Date().toISOString(),
    });

    return new Response(JSON.stringify({
      success: true,
      parsed: courses.length,
      inserted,
      updated,
      departments: prefixes.length,
      sampleCourses: courses.slice(0, 5).map(c => `${c.prefix} ${c.number} - ${c.title}`),
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Parse failed';
    console.error('Error parsing upload:', error);
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
