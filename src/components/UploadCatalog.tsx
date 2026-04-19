import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Upload, FileText, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";

const UploadCatalog = () => {
  const [text, setText] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      setText(ev.target?.result as string || "");
      toast({ title: "File loaded", description: `${file.name} (${(file.size / 1024).toFixed(1)} KB)` });
    };
    reader.readAsText(file);
  };

  const handleUpload = async () => {
    if (!text.trim()) {
      toast({ title: "No data", description: "Paste or upload catalog text first", variant: "destructive" });
      return;
    }

    setIsUploading(true);
    setResult(null);

    try {
      const { data, error } = await supabase.functions.invoke("parse-catalog-upload", {
        body: { text, fileName: "manual-upload" },
      });

      if (error) {
        setResult({ success: false, error: error.message });
        toast({ title: "Upload failed", description: error.message, variant: "destructive" });
      } else {
        setResult(data);
        if (data.success) {
          toast({ title: "Import complete!", description: `${data.parsed} courses processed (${data.inserted} new, ${data.updated} updated)` });
        } else {
          toast({ title: "Parse error", description: data.error, variant: "destructive" });
        }
      }
    } catch (err: any) {
      setResult({ success: false, error: err.message });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5" /> Import Catalog Data
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Upload a .txt or .csv file, or paste catalog data directly. Supports formats like:
          </p>
          <div className="grid md:grid-cols-3 gap-3">
            <div className="p-3 rounded-lg bg-muted/50 text-xs font-mono">
              CSC 1550. Intro to CS (3 credits)<br />
              CSC 1750. Programming I (3 credits)
            </div>
            <div className="p-3 rounded-lg bg-muted/50 text-xs font-mono">
              CSC,1550,Intro to CS,3<br />
              CSC,1750,Programming I,3
            </div>
            <div className="p-3 rounded-lg bg-muted/50 text-xs font-mono">
              CSC 1550 — Intro to CS<br />
              CSC 1750 — Programming I
            </div>
          </div>

          <div className="flex gap-3">
            <input
              type="file"
              ref={fileInputRef}
              accept=".txt,.csv,.tsv,.text"
              onChange={handleFileSelect}
              className="hidden"
            />
            <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
              <FileText className="w-4 h-4 mr-2" /> Choose File
            </Button>
          </div>

          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Paste catalog data here, or upload a file above..."
            rows={10}
            className="font-mono text-xs"
          />

          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              {text.length > 0 ? `${text.length} characters` : "No data"}
            </span>
            <Button onClick={handleUpload} disabled={isUploading || !text.trim()}>
              {isUploading ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Processing...</>
              ) : (
                <><Upload className="w-4 h-4 mr-2" /> Import Courses</>
              )}
            </Button>
          </div>

          {result && (
            <div className={`p-4 rounded-lg ${result.success ? "bg-accent/50 border border-primary/20" : "bg-destructive/10 border border-destructive/20"}`}>
              {result.success ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-primary" />
                    <span className="text-sm font-medium">
                      {result.parsed} courses parsed — {result.inserted} new, {result.updated} updated
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">{result.departments} departments</p>
                  {result.sampleCourses && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {result.sampleCourses.map((c: string, i: number) => (
                        <Badge key={i} variant="outline" className="text-xs">{c}</Badge>
                      ))}
                      {result.parsed > 5 && <Badge variant="secondary" className="text-xs">+{result.parsed - 5} more</Badge>}
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <XCircle className="w-4 h-4 text-destructive" />
                  <span className="text-sm text-destructive">{result.error}</span>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default UploadCatalog;
