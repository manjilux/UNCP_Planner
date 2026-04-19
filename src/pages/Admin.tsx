import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, RefreshCw, CheckCircle2, XCircle, Database } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import UploadCatalog from "@/components/UploadCatalog";

const Admin = () => {
  const [isScraping, setIsScraping] = useState(false);
  const [scrapeResult, setScrapeResult] = useState<any>(null);

  const { data: logs, refetch: refetchLogs } = useQuery({
    queryKey: ["scrape-logs"],
    queryFn: async () => {
      const { data } = await supabase.from("scrape_logs").select("*").order("started_at", { ascending: false }).limit(10);
      return data || [];
    },
  });

  const { data: stats, refetch: refetchStats } = useQuery({
    queryKey: ["admin-stats"],
    queryFn: async () => {
      const [courses, depts, prereqs] = await Promise.all([
        supabase.from("courses").select("id", { count: "exact", head: true }),
        supabase.from("departments").select("id", { count: "exact", head: true }),
        supabase.from("prerequisite_relationships").select("id", { count: "exact", head: true }),
      ]);
      return { courses: courses.count || 0, departments: depts.count || 0, prerequisites: prereqs.count || 0 };
    },
  });

  const handleScrape = async (prefixes?: string[]) => {
    setIsScraping(true);
    setScrapeResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("scrape-catalog", {
        body: prefixes ? { prefixes } : {},
      });
      if (error) {
        setScrapeResult({ success: false, error: error.message });
        toast({ title: "Scrape failed", description: error.message, variant: "destructive" });
      } else {
        setScrapeResult(data);
        toast({ title: "Scrape complete", description: `Found ${data.courses} courses in ${data.departments} departments` });
      }
    } catch (err: any) {
      setScrapeResult({ success: false, error: err.message });
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setIsScraping(false);
      refetchLogs();
      refetchStats();
    }
  };

  return (
    <div className="p-6 md:p-10 max-w-4xl mx-auto space-y-6">
      <h1 className="font-display text-2xl font-bold text-foreground">Admin Panel</h1>

      <div className="grid grid-cols-3 gap-4">
        <Card><CardContent className="p-4 text-center">
          <p className="text-2xl font-display font-bold">{stats?.departments || 0}</p>
          <p className="text-xs text-muted-foreground">Departments</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <p className="text-2xl font-display font-bold">{stats?.courses || 0}</p>
          <p className="text-xs text-muted-foreground">Courses</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <p className="text-2xl font-display font-bold">{stats?.prerequisites || 0}</p>
          <p className="text-xs text-muted-foreground">Prereq Links</p>
        </CardContent></Card>
      </div>

      <Tabs defaultValue="scrape">
        <TabsList>
          <TabsTrigger value="scrape">Web Scraper</TabsTrigger>
          <TabsTrigger value="upload">File Upload</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        <TabsContent value="scrape" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Database className="w-5 h-5" /> Catalog Scraper</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Scrape the UNCP course catalog with pagination support and prerequisite parsing.
              </p>
              <div className="flex flex-wrap gap-3">
                <Button onClick={() => handleScrape()} disabled={isScraping}>
                  {isScraping ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Scraping...</> : <><RefreshCw className="w-4 h-4 mr-2" /> Scrape All</>}
                </Button>
                <Button variant="outline" onClick={() => handleScrape(["CSC", "CYB", "ITC", "DSC", "MAT", "MATH", "EGR", "PHY", "ITM", "CNS"])} disabled={isScraping}>
                  CS/CYB/IT Majors
                </Button>
                <Button variant="outline" onClick={() => handleScrape(["CSC", "MAT", "CYB", "DSC", "ITC"])} disabled={isScraping}>
                  Quick: CS & Math
                </Button>
                <Button variant="outline" onClick={() => handleScrape(["ENG", "PLS", "PSY", "SOC", "HST", "PHI", "BIO", "CHM"])} disabled={isScraping}>
                  Gen Ed Courses
                </Button>
                <Button variant="outline" onClick={() => handleScrape(["CSC"])} disabled={isScraping}>
                  CSC Only
                </Button>
              </div>

              {scrapeResult && (
                <div className={`p-4 rounded-lg ${scrapeResult.success ? "bg-accent/50 border border-primary/20" : "bg-destructive/10 border border-destructive/20"}`}>
                  {scrapeResult.success ? (
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-primary" />
                      <span className="text-sm">Found {scrapeResult.courses} courses in {scrapeResult.departments} departments</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <XCircle className="w-4 h-4 text-destructive" />
                      <span className="text-sm text-destructive">{scrapeResult.error}</span>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="upload">
          <UploadCatalog />
        </TabsContent>

        <TabsContent value="history">
          <Card>
            <CardHeader><CardTitle>Scrape & Import History</CardTitle></CardHeader>
            <CardContent>
              {logs && logs.length > 0 ? (
                <div className="space-y-2">
                  {logs.map((log) => (
                    <div key={log.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                      <div className="flex items-center gap-3">
                        <Badge variant={log.status === "completed" ? "default" : log.status === "failed" ? "destructive" : "secondary"}>
                          {log.status}
                        </Badge>
                        <span className="text-xs text-muted-foreground">{new Date(log.started_at).toLocaleString()}</span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {log.departments_scraped ? `${log.departments_scraped} depts, ` : ""}
                        {log.courses_found ? `${log.courses_found} courses` : ""}
                        {log.error_message && <span className="text-destructive ml-2">{log.error_message}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">No history yet</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Admin;
