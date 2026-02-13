import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { AuditResults } from "@/components/audit-results";
import { LoadingState } from "@/components/loading-state";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { Link } from "wouter";
import type { AuditReport } from "@shared/schema";

export default function Report() {
  const { id } = useParams<{ id: string }>();

  const { data: report, isLoading, error } = useQuery({
    queryKey: ['/api/audit', id],
    enabled: !!id,
  });

  if (isLoading) {
    return <LoadingState />;
  }

  if (error || !report) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <h1 className="text-2xl font-bold text-destructive">Report Not Found</h1>
          <p className="text-muted-foreground">The requested audit report could not be found.</p>
          <Link href="/">
            <Button>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Home
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-6">
        <div className="mb-6">
          <Link href="/bulk-analysis">
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Bulk Analysis
            </Button>
          </Link>
        </div>
        <AuditResults report={report as AuditReport} />
      </div>
    </div>
  );
}