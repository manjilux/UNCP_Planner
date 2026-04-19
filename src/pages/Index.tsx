import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import { BookOpen, Search, Calendar, ArrowRight, GraduationCap, Upload, BarChart3, GitCompare, GitBranch, Layers, Cpu } from "lucide-react";
import GraduationPlanner from "@/components/GraduationPlanner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
} from "recharts";

const COLORS = ["#e6a817", "#4d8ddb", "#45b078", "#e05555", "#9b6dd7", "#d68a45"];

const Index = () => {
  const { data: stats } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: async () => {
      const [coursesRes, deptsRes, prereqsRes, progsRes] = await Promise.all([
        supabase.from("courses").select("id", { count: "exact", head: true }),
        supabase.from("departments").select("id", { count: "exact", head: true }),
        supabase.from("prerequisite_relationships").select("id", { count: "exact", head: true }),
        supabase.from("programs").select("id", { count: "exact", head: true }),
      ]);
      return { courses: coursesRes.count || 0, departments: deptsRes.count || 0, prereqs: prereqsRes.count || 0, programs: progsRes.count || 0 };
    },
  });

  const { data: courses } = useQuery({
    queryKey: ["all-courses-dashboard"],
    queryFn: async () => {
      const { data } = await supabase.from("courses").select("course_number, department_prefix, credits");
      return data || [];
    },
  });

  const levelData = courses ? (() => {
    const c = [0, 0, 0, 0];
    for (const course of courses) { const n = parseInt(course.course_number); if (n < 2000) c[0]++; else if (n < 3000) c[1]++; else if (n < 4000) c[2]++; else c[3]++; }
    return [{ level: "1000", count: c[0] }, { level: "2000", count: c[1] }, { level: "3000", count: c[2] }, { level: "4000+", count: c[3] }];
  })() : [];

  const topDepts = courses ? (() => {
    const counts: Record<string, number> = {};
    for (const c of courses) counts[c.department_prefix] = (counts[c.department_prefix] || 0) + 1;
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([dept, count]) => ({ subject: dept, count, fullMark: 30 }));
  })() : [];

  const creditsPie = courses ? (() => {
    const counts: Record<string, number> = {};
    for (const c of courses) { const label = `${c.credits ?? 0} cr`; counts[label] = (counts[label] || 0) + 1; }
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([name, value]) => ({ name, value }));
  })() : [];

  const quickLinks = [
    { to: "/catalog", icon: BookOpen, title: "Browse Catalog", desc: "Explore all courses", color: "#e6a817" },
    { to: "/search", icon: Search, title: "Search", desc: "Find courses fast", color: "#4d8ddb" },
    { to: "/majors", icon: GraduationCap, title: "Majors", desc: "CS, CYB & IT paths", color: "#45b078" },
    { to: "/prereq-graph", icon: GitBranch, title: "Prereq Graph", desc: "Visual dependencies", color: "#e05555" },
    { to: "/planner", icon: Calendar, title: "Planner", desc: "Build your schedule", color: "#9b6dd7" },
    { to: "/analytics", icon: BarChart3, title: "Analytics", desc: "Charts & insights", color: "#d68a45" },
  ];

  return (
    <div className="p-6 md:p-10 max-w-6xl mx-auto space-y-8">
      {/* Graduation Planner — top, personalized */}
      <GraduationPlanner />

      {/* Hero */}
      <section className="relative overflow-hidden rounded-2xl gold-gradient p-8 md:p-12">
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-4">
            <GraduationCap className="w-8 h-8 text-primary-foreground" />
            <span className="text-sm font-medium text-primary-foreground/80 uppercase tracking-wider">UNCP Academic Planner</span>
          </div>
          <h1 className="font-display text-3xl md:text-4xl font-bold text-primary-foreground mb-3">
            Plan Your Path to Graduation
          </h1>
          <p className="text-primary-foreground/80 max-w-lg mb-6">
            Browse the UNCP course catalog, visualize prerequisite chains, track degree progress, and build your semester plan.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button asChild variant="secondary" size="lg"><Link to="/catalog">Browse Courses</Link></Button>
            <Button asChild variant="outline" size="lg" className="border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/10">
              <Link to="/majors">View Majors</Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/10">
              <Link to="/admin"><Upload className="w-4 h-4 mr-2" /> Upload Catalog</Link>
            </Button>
          </div>
        </div>
        <div className="absolute -right-10 -bottom-10 w-48 h-48 rounded-full bg-primary-foreground/10" />
        <div className="absolute right-20 top-5 w-24 h-24 rounded-full bg-primary-foreground/5" />
      </section>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { icon: BookOpen, label: "Courses", val: stats?.courses, color: "#e6a817" },
          { icon: Layers, label: "Departments", val: stats?.departments, color: "#4d8ddb" },
          { icon: GitBranch, label: "Prereq Links", val: stats?.prereqs, color: "#e05555" },
          { icon: GraduationCap, label: "Programs", val: stats?.programs, color: "#45b078" },
        ].map(s => (
          <Card key={s.label}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${s.color}15` }}>
                <s.icon className="w-5 h-5" style={{ color: s.color }} />
              </div>
              <div>
                <p className="text-2xl font-display font-bold text-foreground">{s.val ?? "—"}</p>
                <p className="text-[11px] text-muted-foreground">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {quickLinks.map((link) => (
          <Link key={link.to} to={link.to}>
            <Card className="group border-border hover:border-primary/50 transition-all hover:shadow-md cursor-pointer h-full">
              <CardContent className="p-4 flex flex-col gap-2.5">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${link.color}12` }}>
                  <link.icon className="w-5 h-5" style={{ color: link.color }} />
                </div>
                <div>
                  <h3 className="font-display text-sm font-semibold text-foreground group-hover:text-primary transition-colors flex items-center gap-1">
                    {link.title}
                    <ArrowRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </h3>
                  <p className="text-[11px] text-muted-foreground mt-0.5">{link.desc}</p>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* Charts Grid */}
      {courses && courses.length > 0 && (
        <div className="grid md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-5">
              <h3 className="font-display font-semibold text-foreground text-sm mb-3">Courses by Level</h3>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={levelData}>
                  <XAxis dataKey="level" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="count" radius={[6, 6, 0, 0]} barSize={36}>
                    {levelData.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5">
              <h3 className="font-display font-semibold text-foreground text-sm mb-3">Credits</h3>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={creditsPie} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={35} outerRadius={70} paddingAngle={3} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                    {creditsPie.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5">
              <h3 className="font-display font-semibold text-foreground text-sm mb-3">Departments</h3>
              <ResponsiveContainer width="100%" height={180}>
                <RadarChart cx="50%" cy="50%" outerRadius="65%" data={topDepts}>
                  <PolarGrid stroke="hsl(40 10% 85%)" />
                  <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10, fontWeight: 600 }} />
                  <Radar name="Courses" dataKey="count" stroke="#e6a817" fill="#e6a817" fillOpacity={0.25} strokeWidth={2} />
                  <Tooltip />
                </RadarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      )}

      {stats?.courses === 0 && (
        <Card className="border-primary/30 bg-accent/50">
          <CardContent className="p-8 text-center">
            <Upload className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground mb-3">No courses loaded yet. Upload or scrape the catalog to get started.</p>
            <Button asChild><Link to="/admin">Go to Admin Panel</Link></Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default Index;
