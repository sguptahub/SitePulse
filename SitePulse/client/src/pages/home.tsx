import { useState } from "react";
import { AuditForm } from "@/components/audit-form";
import { AuditResults } from "@/components/audit-results";
import { LoadingState } from "@/components/loading-state";
import { Search, Zap, BarChart3, Users, Moon, Sun } from "lucide-react";
import { Link } from "wouter";
import { useTheme } from "@/components/theme-provider";
import { Button } from "@/components/ui/button";
import type { AuditReport } from "@shared/schema";

export default function Home() {
  const [currentReport, setCurrentReport] = useState<AuditReport | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { theme, toggleTheme } = useTheme();

  const handleAuditComplete = (report: AuditReport) => {
    setCurrentReport(report);
    setIsLoading(false);
  };

  const handleAuditStart = () => {
    setIsLoading(true);
    setCurrentReport(null);
  };

  return (
    <div className="min-h-screen bg-background text-foreground font-sans">
      {/* Header */}
      <header className="bg-card border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="bg-gradient-to-br from-primary to-primary/80 text-primary-foreground rounded-xl p-3 shadow-lg animate-pulse">
                <Search className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
                  SitePulse
                </h1>
                <p className="text-muted-foreground font-medium">Pulse check for your website's health ❤️</p>
              </div>
            </div>
            <div className="hidden sm:flex items-center space-x-3">
              <div className="bg-gradient-to-r from-primary/10 to-primary/5 dark:from-primary/20 dark:to-primary/10 border border-primary/20 dark:border-primary/30 px-4 py-2 rounded-lg">
                <div className="flex items-center space-x-2 text-primary dark:text-primary-foreground text-sm font-medium">
                  <Zap className="h-4 w-4" />
                  <span>Professional Tool</span>
                </div>
              </div>
              <Link href="/bulk-analysis">
                <div className="group bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:border-primary/20 dark:hover:border-primary/30 shadow-sm hover:shadow-md px-4 py-2 rounded-lg text-sm font-medium cursor-pointer transition-all duration-200 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                  <div className="flex items-center space-x-2 text-gray-700 dark:text-gray-300 group-hover:text-primary">
                    <BarChart3 className="h-4 w-4" />
                    <span>Bulk Analysis</span>
                  </div>
                </div>
              </Link>
              <Link href="/historical-dashboard">
                <div className="group bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:border-primary/20 dark:hover:border-primary/30 shadow-sm hover:shadow-md px-4 py-2 rounded-lg text-sm font-medium cursor-pointer transition-all duration-200 hover:bg-gray-50 dark:hover:bg-gray-700/50" data-testid="link-historical-dashboard">
                  <div className="flex items-center space-x-2 text-gray-700 dark:text-gray-300 group-hover:text-primary">
                    <BarChart3 className="h-4 w-4" />
                    <span>Historical Dashboard</span>
                  </div>
                </div>
              </Link>
              <Link href="/competitive-analysis">
                <div className="group bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:border-primary/20 dark:hover:border-primary/30 shadow-sm hover:shadow-md px-4 py-2 rounded-lg text-sm font-medium cursor-pointer transition-all duration-200 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                  <div className="flex items-center space-x-2 text-gray-700 dark:text-gray-300 group-hover:text-primary">
                    <Users className="h-4 w-4" />
                    <span>Competitive Analysis</span>
                  </div>
                </div>
              </Link>
              <Button
                variant="ghost"
                size="sm"
                onClick={toggleTheme}
                data-testid="button-theme-toggle"
                className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:border-primary/20 dark:hover:border-primary/30 shadow-sm hover:shadow-md px-4 py-2 rounded-lg transition-all duration-200 hover:bg-gray-50 dark:hover:bg-gray-700/50"
              >
                {theme === "light" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <AuditForm 
          onAuditStart={handleAuditStart}
          onAuditComplete={handleAuditComplete}
        />
        
        {isLoading && <LoadingState />}
        
        {currentReport && !isLoading && <AuditResults report={currentReport} />}
      </main>

      {/* Footer */}
      <footer className="bg-card border-t border-border mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="bg-primary text-primary-foreground rounded-lg p-2">
                <Zap className="h-4 w-4" />
              </div>
              <div>
                <p className="font-medium">SitePulse</p>
                <p className="text-sm text-muted-foreground">Comprehensive website health monitoring</p>
              </div>
            </div>
            <div className="flex items-center space-x-4 text-sm text-muted-foreground">
              <span>SEO & Accessibility Analysis</span>
              <span>•</span>
              <span>Real-time Health Checks</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
