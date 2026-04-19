import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const CATALOG_ID = '43';
const BASE_URL = 'https://catalog.uncp.edu';

const DEPARTMENT_PREFIXES = [
  'ACC','AIS','ART','ATR','BIO','BTEC','BLAW','BUS','BRD','CHM','CNS','CRJ','CSC','CYB','DSC',
  'ECE','ECN','EDN','EED','EGR','ELE','EMG','ENG','ENTR','ENV','EXER','EXPH','FIN','FRH',
  'GER','GGY','GLY','GRD','HAD','HCA','HLTH','HON','HST','IDS','ITC','ITL','ITM','JRN',
  'KIN','LIB','MAT','MATE','MATH','MCM','MGT','MKT','MSC','MUS','NUR','OCCT','PAD',
  'PED','PHI','PHS','PHY','PLS','PRE','PSY','RDG','REC','REL','RSA','SAB','SCE','SED',
  'SOC','SPE','SPN','SSE','SWK','TESL','THE','UNV','WLS'
];

async function scrapeWithFirecrawl(url: string, apiKey: string): Promise<string> {
  const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      url,
      formats: ['html'],
      onlyMainContent: false,
      waitFor: 3000,
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(`Firecrawl error: ${data.error || response.status}`);
  }
  return data.data?.html || data.html || '';
}

function parseSearchResults(html: string): Array<{ prefix: string; number: string; title: string; credits: number; catalogUrl: string; catalogId: string }> {
  const courses: Array<{ prefix: string; number: string; title: string; credits: number; catalogUrl: string; catalogId: string }> = [];
  
  // Match aria-label pattern
  const linkRegex = /href="[^"]*preview_course_nopop\.php\?catoid=\d+&(?:amp;)?coid=(\d+)"[^>]*aria-label="View course details for\s+([A-Z]+)\s+(\d+)\.\s+(.+?)\s*\((\d+)\s+credits?\)"[^>]*>/gi;
  
  let match;
  while ((match = linkRegex.exec(html)) !== null) {
    const coid = match[1];
    const prefix = match[2].trim();
    const number = match[3].trim();
    const title = match[4].trim();
    const credits = parseInt(match[5]);
    
    const key = `${prefix}-${number}`;
    if (!courses.find(c => `${c.prefix}-${c.number}` === key)) {
      courses.push({
        prefix, number, title, credits,
        catalogUrl: `${BASE_URL}/preview_course_nopop.php?catoid=${CATALOG_ID}&coid=${coid}`,
        catalogId: coid,
      });
    }
  }
  
  return courses;
}

function hasNextPage(html: string): string | null {
  // Look for "next page" links in pagination
  const nextMatch = html.match(/href="(search_advanced\.php\?[^"]*page=\d+[^"]*)">Next<\/a>/i);
  if (nextMatch) {
    return `${BASE_URL}/${nextMatch[1].replace(/&amp;/g, '&')}`;
  }
  return null;
}

function parseCourseDetail(html: string): { description: string; prerequisites: string[]; corequisites: string[] } {
  let description = '';
  const prerequisites: string[] = [];
  const corequisites: string[] = [];

  const h1Match = html.match(/<h1[^>]*id="course_preview_title"[^>]*>.*?<\/h1>\s*<hr>([\s\S]*?)(?:<br\s*\/?>\s*<hr|$)/i);
  if (h1Match) {
    let content = h1Match[1];
    
    // Broader prereq pattern: match PREREQ, PREREQUISITE, and variations
    const prereqSection = content.match(/PREREQ(?:UISITE)?S?\s*:?\s*([\s\S]*?)(?:COREQ|CONCURRENT|<br|$)/i);
    const coreqSection = content.match(/(?:COREQ(?:UISITE)?S?|CONCURRENT)\s*:?\s*([\s\S]*?)(?:<br|$)/i);
    
    // Find course references - both linked and unlinked
    if (prereqSection) {
      // Linked refs via aria-label
      const linkedRefs = prereqSection[1].matchAll(/aria-label="View course details for\s+([A-Z]+\s+\d+)"/gi);
      for (const ref of linkedRefs) {
        prerequisites.push(ref[1].trim());
      }
      // Unlinked refs like "CSC 1750" or "C or better in CSC 1750"
      if (prerequisites.length === 0) {
        const textRefs = prereqSection[1].matchAll(/\b([A-Z]{2,4})\s+(\d{4})\b/g);
        for (const ref of textRefs) {
          const code = `${ref[1]} ${ref[2]}`;
          if (!prerequisites.includes(code)) prerequisites.push(code);
        }
      }
    }
    
    if (coreqSection) {
      const linkedRefs = coreqSection[1].matchAll(/aria-label="View course details for\s+([A-Z]+\s+\d+)"/gi);
      for (const ref of linkedRefs) {
        corequisites.push(ref[1].trim());
      }
      if (corequisites.length === 0) {
        const textRefs = coreqSection[1].matchAll(/\b([A-Z]{2,4})\s+(\d{4})\b/g);
        for (const ref of textRefs) {
          const code = `${ref[1]} ${ref[2]}`;
          if (!corequisites.includes(code)) corequisites.push(code);
        }
      }
    }
    
    // Clean HTML for description
    description = content
      .replace(/<[^>]*>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/\s+/g, ' ')
      .trim();
  }

  return { description, prerequisites, corequisites };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const firecrawlKey = Deno.env.get('FIRECRAWL_API_KEY');
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  if (!firecrawlKey) {
    return new Response(JSON.stringify({ success: false, error: 'Firecrawl not configured' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
  const { data: logData } = await supabase.from('scrape_logs').insert({ status: 'running' }).select().single();
  const logId = logData?.id;

  try {
    let body: { prefixes?: string[]; detailLimit?: number } = {};
    try { body = await req.json(); } catch { /* no body is fine */ }
    
    const prefixesToScrape = body.prefixes || DEPARTMENT_PREFIXES;
    const detailLimit = body.detailLimit || 500; // raised from 100
    let totalCourses = 0;
    let deptCount = 0;

    const allCourses: Array<{ prefix: string; number: string; title: string; credits: number; catalogUrl: string; catalogId: string }> = [];

    for (const prefix of prefixesToScrape) {
      try {
        console.log(`Scraping prefix: ${prefix}`);
        let searchUrl: string | null = `${BASE_URL}/search_advanced.php?cur_cat_oid=${CATALOG_ID}&ecession=0&search_database=Filter&filter%5Bkeyword%5D=${prefix}&filter%5Bexact_match%5D=1&filter%5B3%5D=1&filter%5B31%5D=1`;
        
        let pageCount = 0;
        while (searchUrl && pageCount < 10) {
          const html = await scrapeWithFirecrawl(searchUrl, firecrawlKey);
          const courses = parseSearchResults(html);
          
          for (const course of courses) {
            if (!allCourses.find(c => `${c.prefix}-${c.number}` === `${course.prefix}-${course.number}`)) {
              allCourses.push(course);
            }
          }
          
          // Check for next page
          searchUrl = hasNextPage(html);
          pageCount++;
          if (searchUrl) await new Promise(r => setTimeout(r, 400));
        }

        if (allCourses.length > 0) {
          await supabase.from('departments').upsert({ prefix, name: prefix }, { onConflict: 'prefix' });
          deptCount++;
        }
        
        await new Promise(r => setTimeout(r, 400));
      } catch (err) {
        console.error(`Error scraping ${prefix}:`, err);
      }
    }

    // Upsert all courses
    for (const course of allCourses) {
      const { error } = await supabase.from('courses').upsert({
        department_prefix: course.prefix,
        course_number: course.number,
        title: course.title,
        credits: course.credits,
        catalog_url: course.catalogUrl,
        catalog_id: course.catalogId,
      }, { onConflict: 'department_prefix,course_number' });

      if (error) console.error(`Error upserting ${course.prefix} ${course.number}:`, error);
      else totalCourses++;
    }

    // Scrape course details - no arbitrary limit on small batches
    const coursesToDetail = allCourses.slice(0, detailLimit);
    
    for (const course of coursesToDetail) {
      try {
        const html = await scrapeWithFirecrawl(course.catalogUrl, firecrawlKey);
        const detail = parseCourseDetail(html);

        if (detail.description) {
          await supabase.from('courses')
            .update({ description: detail.description })
            .eq('catalog_id', course.catalogId);
        }

        const { data: courseRecord } = await supabase.from('courses')
          .select('id')
          .eq('catalog_id', course.catalogId)
          .single();

        if (courseRecord) {
          // Clear old prerequisites
          await supabase.from('prerequisite_relationships')
            .delete()
            .eq('course_id', courseRecord.id);

          for (const prereqRef of detail.prerequisites) {
            const [prereqPrefix, prereqNum] = prereqRef.split(' ');
            const { data: prereqRecord } = await supabase.from('courses')
              .select('id')
              .eq('department_prefix', prereqPrefix)
              .eq('course_number', prereqNum)
              .single();

            await supabase.from('prerequisite_relationships').insert({
              course_id: courseRecord.id,
              prerequisite_id: prereqRecord?.id || null,
              prerequisite_text: prereqRef,
              relationship_type: 'prerequisite',
            });
          }

          for (const coreqRef of detail.corequisites) {
            const [coreqPrefix, coreqNum] = coreqRef.split(' ');
            const { data: coreqRecord } = await supabase.from('courses')
              .select('id')
              .eq('department_prefix', coreqPrefix)
              .eq('course_number', coreqNum)
              .single();

            await supabase.from('prerequisite_relationships').insert({
              course_id: courseRecord.id,
              prerequisite_id: coreqRecord?.id || null,
              prerequisite_text: coreqRef,
              relationship_type: 'corequisite',
            });
          }
        }

        await new Promise(r => setTimeout(r, 300));
      } catch (err) {
        console.error(`Error getting details for ${course.prefix} ${course.number}:`, err);
      }
    }

    if (logId) {
      await supabase.from('scrape_logs').update({
        status: 'completed',
        departments_scraped: deptCount,
        courses_found: totalCourses,
        completed_at: new Date().toISOString(),
      }).eq('id', logId);
    }

    return new Response(JSON.stringify({
      success: true,
      departments: deptCount,
      courses: totalCourses,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Scrape failed';
    if (logId) {
      await supabase.from('scrape_logs').update({
        status: 'failed',
        error_message: msg,
        completed_at: new Date().toISOString(),
      }).eq('id', logId);
    }
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
