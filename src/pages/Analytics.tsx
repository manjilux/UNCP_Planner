import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  AreaChart, Area, CartesianGrid, Legend, ScatterChart, Scatter, ZAxis,
  Treemap,
} from "recharts";
import { BarChart3, TrendingUp, Layers, GitBranch, BookOpen, GraduationCap, Cpu } from "lucide-react";

const COLORS = ["#e6a817", "#4d8ddb", "#45b078", "#e05555", "#9b6dd7", "#d68a45", "#45adb5", "#d65fa0"];

const Analytics = () => {
  const { data: courses } = useQuery({
    queryKey: ["analytics-courses"],
    queryFn: async () => {
      const { data } = await supabase.from("courses").select("id, course_number, department_prefix, credits, title");
      return data || [];
    },
  });

  const { data: prereqs } = useQuery({
    queryKey: ["analytics-prereqs"],
    queryFn: async () => {
      const { data } = await supabase.from("prerequisite_relationships").select("course_id, prerequisite_id, relationship_type");
      return data || [];
    },
  });

  const { data: programs } = useQuery({
    queryKey: ["analytics-programs"],
    queryFn: async () => {
      const { data } = await supabase.from("programs").select("id, name, code, total_credits");
      return data || [];
    },
  });

  const { data: programReqs } = useQuery({
    queryKey: ["analytics-program-reqs"],
    queryFn: async () => {
      const { data } = await supabase.from("program_requirements").select("program_id, course_id, category, is_elective");
      return data || [];
    },
  });

  // ─── Computed Data ────────────────────────────────
  const deptCounts = courses ? (() => {
    const c: Record<string, number> = {};
    for (const course of courses) c[course.department_prefix] = (c[course.department_prefix] || 0) + 1;
    return Object.entries(c).sort((a, b) => b[1] - a[1]).map(([dept, count], i) => ({ dept, count, fill: COLORS[i % COLORS.length] }));
  })() : [];

  const levelData = courses ? (() => {
    const c = [0, 0, 0, 0];
    for (const course of courses) {
      const n = parseInt(course.course_number);
      if (n < 2000) c[0]++; else if (n < 3000) c[1]++; else if (n < 4000) c[2]++; else c[3]++;
    }
    return [
      { level: "1000", count: c[0], label: "Freshman" },
      { level: "2000", count: c[1], label: "Sophomore" },
      { level: "3000", count: c[2], label: "Junior" },
      { level: "4000+", count: c[3], label: "Senior" },
    ];
  })() : [];

  const creditDist = courses ? (() => {
    const c: Record<number, number> = {};
    for (const course of courses) { const cr = course.credits ?? 0; c[cr] = (c[cr] || 0) + 1; }
    return Object.entries(c).sort((a, b) => +a[0] - +b[0]).map(([credits, count]) => ({ name: `${credits} cr`, value: count }));
  })() : [];

  const prereqComplexity = prereqs && courses ? (() => {
    const countMap: Record<string, number> = {};
    for (const p of prereqs) countMap[p.course_id] = (countMap[p.course_id] || 0) + 1;
    return Object.entries(countMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([id, count]) => {
        const c = courses.find(x => x.id === id);
        return { name: c ? `${c.department_prefix} ${c.course_number}` : id.slice(0, 8), prereqs: count, title: c?.title || "" };
      });
  })() : [];

  const radarData = deptCounts.slice(0, 8).map(d => ({
    subject: d.dept, count: d.count, fullMark: deptCounts[0]?.count || 1,
  }));

  const prereqTypes = prereqs ? (() => {
    const c: Record<string, number> = {};
    for (const p of prereqs) c[p.relationship_type] = (c[p.relationship_type] || 0) + 1;
    return Object.entries(c).map(([name, value]) => ({ name: name === "prerequisite" ? "Prerequisites" : "Corequisites", value }));
  })() : [];

  const prereqVsNone = courses && prereqs ? (() => {
    const withPrereq = new Set(prereqs.map(p => p.course_id));
    return [
      { name: "Has Prereqs", value: withPrereq.size },
      { name: "No Prereqs", value: courses.length - withPrereq.size },
    ];
  })() : [];

  // Program comparison: courses per program
  const programComparison = programs && programReqs ? (() => {
    return programs.map((p, i) => {
      const reqs = programReqs.filter(r => r.program_id === p.id);
      const core = reqs.filter(r => r.category === "core").length;
      const elective = reqs.filter(r => r.is_elective).length;
      const math = reqs.filter(r => r.category === "math").length;
      return { name: p.code, core, elective, math, total: reqs.length, fill: COLORS[i % COLORS.length] };
    });
  })() : [];

  // Treemap of departments
  const treemapData = deptCounts.map(d => ({ name: d.dept, size: d.count, fill: d.fill }));

  // Department × Level scatter
  const scatterData = courses ? (() => {
    const map: Record<string, Record<string, number>> = {};
    for (const c of courses) {
      const lvl = parseInt(c.course_number) < 2000 ? 1000 : parseInt(c.course_number) < 3000 ? 2000 : parseInt(c.course_number) < 4000 ? 3000 : 4000;
      if (!map[c.department_prefix]) map[c.department_prefix] = {};
      map[c.department_prefix][lvl] = (map[c.department_prefix][lvl] || 0) + 1;
    }
    return Object.entries(map).flatMap(([dept, levels]) =>
      Object.entries(levels).map(([lvl, count]) => ({ dept, level: +lvl, count }))
    );
  })() : [];

  const totalCourses = courses?.length || 0;
  const totalPrereqs = prereqs?.length || 0;
  const totalPrograms = programs?.length || 0;
  const avgCredits = courses?.length ? (courses.reduce((s, c) => s + (c.credits || 0), 0) / courses.length).toFixed(1) : "0";

  return (
    <div className="p-6 md:p-10 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-primary" /> Analytics Dashboard
          </h1>
          <p className="text-sm text-muted-foreground">Comprehensive catalog statistics and visualizations</p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { icon: BookOpen, label: "Total Courses", value: totalCourses, color: "#e6a817" },
          { icon: GitBranch, label: "Prereq Links", value: totalPrereqs, color: "#e05555" },
          { icon: GraduationCap, label: "Programs", value: totalPrograms, color: "#4d8ddb" },
          { icon: Cpu, label: "Avg Credits", value: avgCredits, color: "#45b078" },
        ].map(kpi => (
          <Card key={kpi.label}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${kpi.color}15` }}>
                <kpi.icon className="w-5 h-5" style={{ color: kpi.color }} />
              </div>
              <div>
                <p className="text-2xl font-display font-bold text-foreground">{kpi.value}</p>
                <p className="text-[11px] text-muted-foreground">{kpi.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Row 1: Courses by Level + Credit Distribution */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Layers className="w-4 h-4 text-primary" /> Courses by Level</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={levelData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(40 10% 90%)" />
                <XAxis dataKey="level" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip formatter={(val: number, name: string, props: any) => [val, props.payload.label]} />
                <Bar dataKey="count" radius={[8, 8, 0, 0]} barSize={50}>
                  {levelData.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Credit Hour Distribution</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={creditDist} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={90} paddingAngle={3} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                  {creditDist.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Row 2: Department Radar + Program Comparison */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Department Coverage</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <RadarChart cx="50%" cy="50%" outerRadius="65%" data={radarData}>
                <PolarGrid stroke="hsl(40 10% 85%)" />
                <PolarAngleAxis dataKey="subject" tick={{ fontSize: 11, fontWeight: 600 }} />
                <PolarRadiusAxis tick={{ fontSize: 10 }} />
                <Radar name="Courses" dataKey="count" stroke="#e6a817" fill="#e6a817" fillOpacity={0.25} strokeWidth={2} />
                <Tooltip />
              </RadarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><GraduationCap className="w-4 h-4 text-primary" /> Program Requirements Breakdown</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={programComparison}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(40 10% 90%)" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="core" name="Core" stackId="a" fill="#e6a817" radius={[0, 0, 0, 0]} />
                <Bar dataKey="math" name="Math" stackId="a" fill="#4d8ddb" />
                <Bar dataKey="elective" name="Elective" stackId="a" fill="#45b078" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Row 3: Complexity + Prereq overview */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><GitBranch className="w-4 h-4 text-destructive" /> Most Complex Courses</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={prereqComplexity} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(40 10% 90%)" />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fontFamily: "monospace" }} width={85} />
                <Tooltip content={({ payload }) => payload?.[0] ? (
                  <div className="bg-card border border-border rounded-lg p-2 shadow-lg text-xs">
                    <p className="font-semibold">{payload[0].payload.name}</p>
                    <p className="text-muted-foreground">{payload[0].payload.title}</p>
                    <p className="mt-1 font-medium">{payload[0].value} dependencies</p>
                  </div>
                ) : null} />
                <Bar dataKey="prereqs" fill="#e05555" radius={[0, 6, 6, 0]} barSize={18} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Prerequisite Breakdown</CardTitle></CardHeader>
          <CardContent className="flex flex-col items-center gap-4">
            <ResponsiveContainer width="100%" height={150}>
              <PieChart>
                <Pie data={prereqTypes} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={60} label>
                  <Cell fill="#e6a817" />
                  <Cell fill="#e05555" />
                </Pie>
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
            <ResponsiveContainer width="100%" height={150}>
              <PieChart>
                <Pie data={prereqVsNone} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={35} outerRadius={60} label paddingAngle={3}>
                  <Cell fill="#e6a817" />
                  <Cell fill="#ccc" />
                </Pie>
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Row 4: Department Treemap + Scatter */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Department Treemap</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <Treemap
                data={treemapData}
                dataKey="size"
                aspectRatio={4 / 3}
                stroke="#fff"
              >
                <Tooltip />
              </Treemap>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><TrendingUp className="w-4 h-4" /> Course Density: Dept × Level</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <ScatterChart>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(40 10% 90%)" />
                <XAxis type="number" dataKey="level" name="Level" tick={{ fontSize: 11 }} domain={[500, 4500]} />
                <YAxis type="category" dataKey="dept" name="Dept" tick={{ fontSize: 10, fontFamily: "monospace" }} width={45} />
                <ZAxis type="number" dataKey="count" range={[60, 500]} name="Courses" />
                <Tooltip cursor={{ strokeDasharray: "3 3" }} />
                <Scatter data={scatterData} fill="#e6a817" />
              </ScatterChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* All Departments horizontal bar */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">All Departments — Course Count</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={Math.max(200, deptCounts.length * 35)}>
            <BarChart data={deptCounts} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(40 10% 90%)" />
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="dept" tick={{ fontSize: 11, fontFamily: "monospace", fontWeight: 600 }} width={45} />
              <Tooltip />
              <Bar dataKey="count" radius={[0, 8, 8, 0]} barSize={20}>
                {deptCounts.map((d, i) => <Cell key={i} fill={d.fill} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
};

export default Analytics;
