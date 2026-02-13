import { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { 
  Clock, Download, AlertTriangle, Timer, Link, Images, 
  Tags, CheckCircle, AlertCircle, Accessibility, Eye, 
  XCircle, Gauge, Lightbulb, X, TrendingUp, Smartphone, 
  FileDown, ChevronDown, ChevronRight, BarChart3, Zap,
  Globe, Search, Shield, Monitor, Share2
} from "lucide-react";
import type { AuditReport, MetaTagAnalysis, AccessibilityIssue, BrokenLink, PerformanceMetrics, Recommendation, AuditStatistics, AccessibilityScoring, SEOScoring, MobileAnalysis } from "@shared/schema";

interface AuditResultsProps {
  report: AuditReport;
}

export function AuditResults({ report }: AuditResultsProps) {
  const [isDownloadingPDF, setIsDownloadingPDF] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const { toast } = useToast();
  
  const metaTags = report.metaTags as MetaTagAnalysis;
  const accessibilityIssues = report.accessibilityIssues as AccessibilityIssue[];
  const accessibilityScoring = report.accessibilityScoring as AccessibilityScoring | undefined;
  const seoScoring = report.seoScoring as SEOScoring | undefined;
  const mobileAnalysis = report.mobileAnalysis as MobileAnalysis | undefined;
  const brokenLinks = report.brokenLinks as BrokenLink[];
  const performanceMetrics = report.performanceMetrics as PerformanceMetrics;
  const recommendations = report.recommendations as Recommendation[];
  const statistics = report.statistics as AuditStatistics;

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'good': return 'text-emerald-600 bg-emerald-100';
      case 'warning': return 'text-amber-800 bg-amber-100';
      case 'error': return 'text-destructive bg-destructive/10';
      default: return 'text-muted-foreground bg-muted';
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'good': return 'border-emerald-200 text-emerald-700';
      case 'warning': return 'border-amber-200 text-amber-700';
      case 'critical': return 'border-destructive/20 text-destructive';
      default: return 'border-border text-foreground';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-destructive/10 text-destructive';
      case 'medium': return 'bg-amber-100 text-amber-800';
      case 'low': return 'bg-emerald-100 text-emerald-800';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const downloadPDF = async () => {
    setIsDownloadingPDF(true);
    try {
      const response = await fetch(`/api/audit/${report.id}/pdf`);
      
      if (!response.ok) {
        throw new Error(`Failed to generate PDF: ${response.statusText}`);
      }
      
      // Get the PDF blob
      const blob = await response.blob();
      
      // Create download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      
      // Extract filename from response headers or create a default
      const contentDisposition = response.headers.get('content-disposition');
      let filename = 'audit-report.pdf';
      if (contentDisposition) {
        const matches = /filename="([^"]*)"/.exec(contentDisposition);
        if (matches) {
          filename = matches[1];
        }
      }
      
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      
      // Cleanup
      window.URL.revokeObjectURL(url);
      document.body.removeChild(link);
      
      toast({
        title: "PDF Downloaded",
        description: "Your audit report has been downloaded successfully.",
      });
    } catch (error) {
      console.error('PDF download error:', error);
      toast({
        title: "Download Failed",
        description: error instanceof Error ? error.message : "Failed to download PDF report.",
        variant: "destructive",
      });
    } finally {
      setIsDownloadingPDF(false);
    }
  };

  const shareReport = async () => {
    setIsSharing(true);
    try {
      const shareUrl = `${window.location.origin}/report/${report.id}`;
      
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(shareUrl);
        toast({
          title: "Share Link Copied",
          description: "The shareable link has been copied to your clipboard.",
        });
      } else {
        // Fallback for older browsers or non-secure contexts
        const textArea = document.createElement('textarea');
        textArea.value = shareUrl;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        
        try {
          document.execCommand('copy');
          toast({
            title: "Share Link Copied",
            description: "The shareable link has been copied to your clipboard.",
          });
        } catch (err) {
          toast({
            title: "Share Link Ready",
            description: `Copy this link to share: ${shareUrl}`,
            variant: "default",
          });
        } finally {
          textArea.remove();
        }
      }
    } catch (error) {
      console.error('Share error:', error);
      toast({
        title: "Share Failed",
        description: error instanceof Error ? error.message : "Failed to create shareable link.",
        variant: "destructive",
      });
    } finally {
      setIsSharing(false);
    }
  };

  // Use accurate statistics from backend analysis
  const { totalLinks, workingLinks, externalLinks, totalImages } = statistics;

  return (
    <div className="space-y-4 md:space-y-6" data-testid="audit-results">
      {/* Compact Results Header */}
      <Card className="shadow-sm border border-border">
        <CardContent className="p-4 md:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="min-w-0 flex-1">
              <h2 className="text-xl md:text-2xl font-bold mb-1">Audit Results</h2>
              <p className="text-sm md:text-base text-muted-foreground truncate" data-testid="text-analyzed-url">{report.url}</p>
              <p className="text-xs md:text-sm text-muted-foreground mt-1">
                <Clock className="h-3 w-3 md:h-4 md:w-4 mr-1 inline" />
                <span data-testid="text-analysis-date">{formatDate(report.analysisDate)}</span>
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-center">
                <div className="text-2xl md:text-3xl font-bold text-emerald-600" data-testid="text-overall-score">
                  {report.overallScore}
                </div>
                <div className="text-xs text-muted-foreground">Overall Score</div>
              </div>
              <div className="flex items-center gap-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={shareReport}
                  disabled={isSharing}
                  data-testid="button-share-report"
                  className="shrink-0"
                >
                  <Share2 className="h-4 w-4 mr-2" />
                  <span className="hidden sm:inline">{isSharing ? 'Copying...' : 'Share Report'}</span>
                  <span className="sm:hidden">Share</span>
                </Button>
                <Button 
                  variant="secondary" 
                  size="sm"
                  onClick={downloadPDF}
                  disabled={isDownloadingPDF}
                  data-testid="button-download-pdf"
                  className="shrink-0"
                >
                  <FileDown className="h-4 w-4 mr-2" />
                  <span className="hidden sm:inline">{isDownloadingPDF ? 'Generating PDF...' : 'Download PDF'}</span>
                  <span className="sm:hidden">PDF</span>
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Key Metrics Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <Card className="shadow-sm">
          <CardContent className="p-3 md:p-4">
            <div className="text-center">
              <div className={`text-xl md:text-2xl font-bold ${seoScoring ? 'text-green-600' : 'text-muted-foreground'}`} data-testid="text-seo-score">
                {seoScoring?.overallScore || 'N/A'}
              </div>
              <div className="text-xs text-muted-foreground">SEO Score</div>
              <Search className="h-4 w-4 text-green-600 mx-auto mt-1" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="shadow-sm">
          <CardContent className="p-3 md:p-4">
            <div className="text-center">
              <div className={`text-xl md:text-2xl font-bold ${accessibilityScoring ? 'text-blue-600' : 'text-muted-foreground'}`} data-testid="text-accessibility-score">
                {accessibilityScoring?.overallScore || 'N/A'}
              </div>
              <div className="text-xs text-muted-foreground">Accessibility</div>
              <Shield className="h-4 w-4 text-blue-600 mx-auto mt-1" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="shadow-sm">
          <CardContent className="p-3 md:p-4">
            <div className="text-center">
              <div className={`text-xl md:text-2xl font-bold ${brokenLinks.length > 0 ? 'text-destructive' : 'text-emerald-600'}`} data-testid="text-broken-links">
                {brokenLinks.length}
              </div>
              <div className="text-xs text-muted-foreground">Broken Links</div>
              <Link className="h-4 w-4 text-purple-600 mx-auto mt-1" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="shadow-sm">
          <CardContent className="p-3 md:p-4">
            <div className="text-center">
              <div className="text-xl md:text-2xl font-bold text-primary" data-testid="text-performance-time">
                {(performanceMetrics.loadTime / 1000).toFixed(1)}s
              </div>
              <div className="text-xs text-muted-foreground">Load Time</div>
              <Zap className="h-4 w-4 text-primary mx-auto mt-1" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Additional Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="shadow-sm">
          <CardContent className="p-3">
            <div className="text-center">
              <div className={`text-lg font-bold ${mobileAnalysis ? 'text-blue-600' : 'text-muted-foreground'}`} data-testid="text-mobile-score">
                {mobileAnalysis?.overallScore || 'N/A'}
              </div>
              <div className="text-xs text-muted-foreground">Mobile Score</div>
              <Monitor className="h-4 w-4 text-blue-600 mx-auto mt-1" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="shadow-sm">
          <CardContent className="p-3">
            <div className="text-center">
              <div className="text-lg font-bold text-purple-600" data-testid="text-total-links">
                {totalLinks}
              </div>
              <div className="text-xs text-muted-foreground">Total Links</div>
              <Globe className="h-4 w-4 text-purple-600 mx-auto mt-1" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="shadow-sm">
          <CardContent className="p-3">
            <div className="text-center">
              <div className="text-lg font-bold text-pink-600" data-testid="text-images-count">
                {totalImages}
              </div>
              <div className="text-xs text-muted-foreground">Images Found</div>
              <Images className="h-4 w-4 text-pink-600 mx-auto mt-1" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="shadow-sm">
          <CardContent className="p-3">
            <div className="text-center">
              <div className="text-lg font-bold text-amber-600" data-testid="text-total-issues">
                {accessibilityIssues.filter(issue => issue.severity !== 'good').length + brokenLinks.length}
              </div>
              <div className="text-xs text-muted-foreground">Total Issues</div>
              <AlertTriangle className="h-4 w-4 text-amber-600 mx-auto mt-1" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Analysis - Mobile-Friendly Tabs */}
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-2 md:grid-cols-5 h-auto p-1">
          <TabsTrigger value="overview" className="text-xs md:text-sm py-2">
            <BarChart3 className="h-4 w-4 mr-1 md:mr-2" />
            <span className="hidden sm:inline">Overview</span>
          </TabsTrigger>
          <TabsTrigger value="seo" className="text-xs md:text-sm py-2">
            <Search className="h-4 w-4 mr-1 md:mr-2" />
            <span className="hidden sm:inline">SEO</span>
          </TabsTrigger>
          <TabsTrigger value="accessibility" className="text-xs md:text-sm py-2">
            <Shield className="h-4 w-4 mr-1 md:mr-2" />
            <span className="hidden sm:inline">Accessibility</span>
          </TabsTrigger>
          <TabsTrigger value="performance" className="text-xs md:text-sm py-2">
            <Zap className="h-4 w-4 mr-1 md:mr-2" />
            <span className="hidden sm:inline">Performance</span>
          </TabsTrigger>
          <TabsTrigger value="issues" className="text-xs md:text-sm py-2">
            <AlertTriangle className="h-4 w-4 mr-1 md:mr-2" />
            <span className="hidden sm:inline">Issues</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <Card>
            <CardHeader>
              <h3 className="text-lg font-semibold">Meta Tags & Structure</h3>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3">
                {Object.entries(metaTags).map(([key, tag]) => (
                  <div key={key} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <div className="flex items-center space-x-3">
                      {tag.status === 'good' ? 
                        <CheckCircle className="h-4 w-4 text-emerald-500" /> : 
                        <AlertCircle className="h-4 w-4 text-amber-500" />
                      }
                      <div>
                        <p className="font-medium text-sm capitalize">{key.replace(/([A-Z])/g, ' $1')}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {tag.present ? tag.content || 'Present' : `Missing ${key} meta tag`}
                        </p>
                      </div>
                    </div>
                    <Badge className={`text-xs ${getStatusColor(tag.status)} border-0`}>
                      {tag.status.toUpperCase()}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="seo" className="mt-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">SEO Performance</h3>
                {seoScoring && (
                  <Badge className="bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200">
                    Score: {seoScoring.overallScore}/100
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {seoScoring ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center p-3 bg-green-50 dark:bg-green-950 rounded-lg">
                      <div className="text-2xl font-bold text-green-600 dark:text-green-400">{seoScoring.categoryScores.metaTags}</div>
                      <div className="text-xs text-muted-foreground">Meta Tags</div>
                    </div>
                    <div className="text-center p-3 bg-purple-50 dark:bg-purple-950 rounded-lg">
                      <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">{seoScoring.categoryScores.contentStructure}</div>
                      <div className="text-xs text-muted-foreground">Content</div>
                    </div>
                    <div className="text-center p-3 bg-orange-50 dark:bg-orange-950 rounded-lg">
                      <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">{seoScoring.categoryScores.technicalSEO}</div>
                      <div className="text-xs text-muted-foreground">Technical</div>
                    </div>
                    <div className="text-center p-3 bg-blue-50 dark:bg-blue-950 rounded-lg">
                      <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{seoScoring.categoryScores.performance}</div>
                      <div className="text-xs text-muted-foreground">Performance</div>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-muted-foreground">SEO analysis data not available</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="accessibility" className="mt-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Accessibility Analysis</h3>
                {accessibilityScoring && (
                  <Badge className="bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200">
                    Score: {accessibilityScoring.overallScore}/100
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {accessibilityScoring ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center p-3 bg-blue-50 dark:bg-blue-950 rounded-lg">
                      <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{accessibilityScoring.overallScore}</div>
                      <div className="text-xs text-muted-foreground">Overall Score</div>
                    </div>
                    <div className="text-center p-3 bg-green-50 dark:bg-green-950 rounded-lg">
                      <div className="text-xl font-bold text-green-600 dark:text-green-400">{accessibilityScoring.wcagComplianceLevel}</div>
                      <div className="text-xs text-muted-foreground">WCAG Level</div>
                    </div>
                    <div className="text-center p-3 bg-purple-50 dark:bg-purple-950 rounded-lg">
                      <div className="text-xl font-bold text-purple-600 dark:text-purple-400">{accessibilityScoring.compliancePercentage}%</div>
                      <div className="text-xs text-muted-foreground">Compliance</div>
                    </div>
                    <div className="text-center p-3 bg-red-50 dark:bg-red-950 rounded-lg">
                      <div className="text-xl font-bold text-red-600 dark:text-red-400">{accessibilityScoring.criticalIssues}</div>
                      <div className="text-xs text-muted-foreground">Critical Issues</div>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-muted-foreground">Accessibility analysis data not available</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="performance" className="mt-4">
          <Card>
            <CardHeader>
              <h3 className="text-lg font-semibold">Performance Metrics</h3>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-3 bg-green-50 dark:bg-green-950 rounded-lg">
                  <div className="text-xl font-bold text-green-600 dark:text-green-400">{(performanceMetrics.loadTime / 1000).toFixed(1)}s</div>
                  <div className="text-xs text-muted-foreground">Load Time</div>
                </div>
                <div className="text-center p-3 bg-blue-50 dark:bg-blue-950 rounded-lg">
                  <div className="text-xl font-bold text-blue-600 dark:text-blue-400">{(performanceMetrics.contentSize / 1024 / 1024).toFixed(1)}MB</div>
                  <div className="text-xs text-muted-foreground">Content Size</div>
                </div>
                <div className="text-center p-3 bg-purple-50 dark:bg-purple-950 rounded-lg">
                  <div className="text-xl font-bold text-purple-600 dark:text-purple-400">{performanceMetrics.httpRequests}</div>
                  <div className="text-xs text-muted-foreground">HTTP Requests</div>
                </div>
                <div className="text-center p-3 bg-orange-50 dark:bg-orange-950 rounded-lg">
                  <div className="text-xl font-bold text-orange-600 dark:text-orange-400">{performanceMetrics.firstPaint}ms</div>
                  <div className="text-xs text-muted-foreground">First Paint</div>
                </div>
              </div>
              {mobileAnalysis && (
                <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-950 rounded-lg">
                  <h4 className="font-medium mb-2 text-foreground">Mobile Performance</h4>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{mobileAnalysis.overallScore}/100</div>
                    <div className="text-sm text-muted-foreground">Mobile Score</div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="issues" className="mt-4">
          <Card>
            <CardHeader>
              <h3 className="text-lg font-semibold">Issues & Recommendations</h3>
            </CardHeader>
            <CardContent className="space-y-4">
              {brokenLinks.length > 0 && (
                <div>
                  <h4 className="font-medium text-destructive mb-2">Broken Links ({brokenLinks.length})</h4>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {brokenLinks.slice(0, 5).map((link, index) => (
                      <div key={index} className="flex items-center justify-between p-2 bg-destructive/5 dark:bg-destructive/10 rounded text-sm">
                        <span className="truncate mr-2 text-foreground">{link.url}</span>
                        <Badge className="bg-destructive text-destructive-foreground text-xs">
                          {link.status}
                        </Badge>
                      </div>
                    ))}
                    {brokenLinks.length > 5 && (
                      <p className="text-xs text-muted-foreground">+ {brokenLinks.length - 5} more broken links</p>
                    )}
                  </div>
                </div>
              )}
              
              {accessibilityIssues.filter(issue => issue.severity !== 'good').length > 0 && (
                <div>
                  <h4 className="font-medium text-amber-600 mb-2">
                    Accessibility Issues ({accessibilityIssues.filter(issue => issue.severity !== 'good').length})
                  </h4>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {accessibilityIssues.filter(issue => issue.severity !== 'good').slice(0, 5).map((issue, index) => (
                      <div key={index} className={`p-2 rounded text-sm ${
                        issue.severity === 'critical' ? 'bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800' : 'bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800'
                      }`}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-medium text-sm text-foreground">{issue.type}</span>
                          <Badge className={`text-xs ${getSeverityColor(issue.severity)}`}>
                            {issue.severity.toUpperCase()}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">{issue.description}</p>
                      </div>
                    ))}
                    {accessibilityIssues.filter(issue => issue.severity !== 'good').length > 5 && (
                      <p className="text-xs text-muted-foreground">+ {accessibilityIssues.filter(issue => issue.severity !== 'good').length - 5} more accessibility issues</p>
                    )}
                  </div>
                </div>
              )}

              {recommendations.length > 0 && (
                <div>
                  <h4 className="font-medium text-blue-600 mb-2">Top Recommendations</h4>
                  <div className="space-y-2">
                    {recommendations.slice(0, 3).map((rec, index) => (
                      <div key={index} className="p-3 bg-blue-50 dark:bg-blue-950 rounded-lg">
                        <div className="flex items-center gap-2 mb-1">
                          <div className="bg-blue-600 dark:bg-blue-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs">
                            {index + 1}
                          </div>
                          <span className="font-medium text-sm text-foreground">{rec.title}</span>
                          <Badge className={`text-xs ml-auto ${getPriorityColor(rec.priority)}`}>
                            {rec.priority.toUpperCase()}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">{rec.description}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}