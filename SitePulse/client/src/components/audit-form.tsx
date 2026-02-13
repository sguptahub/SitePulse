import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Globe, Play } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { AuditReport } from "@shared/schema";

interface AuditFormProps {
  onAuditStart: () => void;
  onAuditComplete: (report: AuditReport) => void;
}

export function AuditForm({ onAuditStart, onAuditComplete }: AuditFormProps) {
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  const { toast } = useToast();

  const auditMutation = useMutation({
    mutationFn: async (auditUrl: string) => {
      const response = await apiRequest("POST", "/api/audit", { url: auditUrl });
      return await response.json() as AuditReport;
    },
    onSuccess: (report) => {
      onAuditComplete(report);
      toast({
        title: "Analysis Complete",
        description: "Your website audit has been completed successfully.",
      });
    },
    onError: (error) => {
      setError(error instanceof Error ? error.message : "An error occurred during analysis");
      toast({
        title: "Analysis Failed", 
        description: "There was an error analyzing your website. Please try again.",
        variant: "destructive",
      });
    },
  });

  const normalizeUrl = (url: string): string => {
    const trimmedUrl = url.trim();
    
    // If the URL already has a protocol, return as is
    if (trimmedUrl.match(/^https?:\/\//i)) {
      return trimmedUrl;
    }
    
    // Add https:// if no protocol is present
    return `https://${trimmedUrl}`;
  };

  const validateUrl = (url: string): boolean => {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!url.trim()) {
      setError("Please enter a URL");
      return;
    }

    // Normalize the URL to add https:// if missing
    const normalizedUrl = normalizeUrl(url);

    if (!validateUrl(normalizedUrl)) {
      setError("Please enter a valid URL (e.g., example.com or https://example.com)");
      return;
    }

    onAuditStart();
    auditMutation.mutate(normalizedUrl);
  };

  return (
    <Card className="shadow-sm border border-border p-6 mb-8">
      <CardContent className="p-0">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-xl font-semibold mb-4 text-center">Enter Website URL to Analyze</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Globe className="h-4 w-4 text-muted-foreground" />
              </div>
              <Input
                type="text"
                placeholder="example.com or https://example.com"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="pl-10"
                disabled={auditMutation.isPending}
                data-testid="input-audit-url"
              />
            </div>
            <Button
              type="submit"
              className="w-full"
              disabled={auditMutation.isPending}
              data-testid="button-start-analysis"
            >
              <Play className="h-4 w-4 mr-2" />
              {auditMutation.isPending ? "Analyzing..." : "Start Analysis"}
            </Button>
          </form>

          {error && (
            <Alert variant="destructive" className="mt-4" data-testid="alert-error">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
