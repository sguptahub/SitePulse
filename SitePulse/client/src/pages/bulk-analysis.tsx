import { useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Link as WouterLink } from "wouter";
import { 
  Upload, FileText, Link, X, Play, Download, 
  BarChart3, Globe, AlertCircle, CheckCircle, Clock, Home,
  ArrowUpDown, ArrowUp, ArrowDown, Filter, Users, Search
} from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { AuditReport } from "@shared/schema";

interface BulkAnalysisJob {
  id: string;
  urls: string[];
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number;
  startedAt: Date;
  completedAt?: Date;
  results?: import("@shared/schema").AuditReport[];
  errors?: string[];
}

export default function BulkAnalysis() {
  const [urls, setUrls] = useState<string[]>([]);
  const [manualInput, setManualInput] = useState("");
  const [currentJob, setCurrentJob] = useState<BulkAnalysisJob | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  // Sorting and filtering state
  const [sortField, setSortField] = useState<'url' | 'overallScore' | 'seoScore' | 'accessibilityScore' | 'mobileScore' | 'performanceScore'>('overallScore');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [filterMinScore, setFilterMinScore] = useState<string>('');
  const [filterDomain, setFilterDomain] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  // Helper functions for sorting and filtering
  const getScoreFromResult = (result: AuditReport, field: string): number => {
    switch (field) {
      case 'overallScore': return result.overallScore;
      case 'seoScore': 
        return typeof result.seoScoring === 'object' && result.seoScoring && 'overallScore' in result.seoScoring 
          ? Number(result.seoScoring.overallScore) || 0 
          : 0;
      case 'accessibilityScore':
        return typeof result.accessibilityScoring === 'object' && result.accessibilityScoring && 'overallScore' in result.accessibilityScoring
          ? Number(result.accessibilityScoring.overallScore) || 0
          : 0;
      case 'mobileScore':
        return typeof result.mobileAnalysis === 'object' && result.mobileAnalysis && 'overallScore' in result.mobileAnalysis
          ? Number(result.mobileAnalysis.overallScore) || 0
          : 0;
      case 'performanceScore':
        return typeof result.performanceMetrics === 'object' && result.performanceMetrics && 'overallScore' in result.performanceMetrics
          ? Number(result.performanceMetrics.overallScore) || 0
          : 0;
      default: return 0;
    }
  };

  const sortResults = (results: AuditReport[]) => {
    return [...results].sort((a, b) => {
      let aValue: number | string;
      let bValue: number | string;

      if (sortField === 'url') {
        aValue = a.url;
        bValue = b.url;
      } else {
        aValue = getScoreFromResult(a, sortField);
        bValue = getScoreFromResult(b, sortField);
      }

      if (sortDirection === 'asc') {
        return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
      } else {
        return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
      }
    });
  };

  const getResultStatus = (result: AuditReport, errors: string[] = []): 'success' | 'failed' => {
    // Check if this URL had any errors
    const hasError = errors.some(error => error.includes(result.url));
    return hasError ? 'failed' : 'success';
  };

  const filterResults = (results: AuditReport[]) => {
    return results.filter(result => {
      // Filter by minimum score
      if (filterMinScore && result.overallScore < parseInt(filterMinScore)) {
        return false;
      }
      
      // Filter by domain
      if (filterDomain && !result.url.toLowerCase().includes(filterDomain.toLowerCase())) {
        return false;
      }
      
      // Filter by status
      if (filterStatus !== 'all') {
        const status = getResultStatus(result, currentJob?.errors);
        if (filterStatus !== status) {
          return false;
        }
      }
      
      return true;
    });
  };

  const exportToCSV = (results: AuditReport[]) => {
    const headers = [
      'URL', 'Overall Score', 'SEO Score', 'Accessibility Score', 'Mobile Score', 
      'Performance Score', 'Broken Links', 'Analysis Date'
    ];
    
    const getSafeValue = (value: unknown, fallback: string | number = 0) => {
      if (value === null || value === undefined) return fallback;
      return value;
    };
    
    const getBrokenLinksCount = (brokenLinks: unknown): number => {
      if (Array.isArray(brokenLinks)) return brokenLinks.length;
      if (typeof brokenLinks === 'object' && brokenLinks && 'links' in brokenLinks) {
        return Array.isArray(brokenLinks.links) ? brokenLinks.links.length : 0;
      }
      return 0;
    };

    const formatDate = (dateValue: unknown): string => {
      try {
        const date = dateValue instanceof Date ? dateValue : new Date(String(dateValue));
        return isNaN(date.getTime()) ? 'Invalid Date' : date.toLocaleDateString();
      } catch {
        return 'Invalid Date';
      }
    };
    
    const csvContent = [
      headers.join(','),
      ...results.map(result => [
        `"${result.url.replace(/"/g, '""')}"`, // Escape quotes in URL
        getSafeValue(result.overallScore, 0),
        getScoreFromResult(result, 'seoScore'),
        getScoreFromResult(result, 'accessibilityScore'),
        getScoreFromResult(result, 'mobileScore'),
        getScoreFromResult(result, 'performanceScore'),
        getBrokenLinksCount(result.brokenLinks),
        formatDate(result.analysisDate)
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `bulk_audit_results_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleSort = (field: typeof sortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const getSortIcon = (field: typeof sortField) => {
    if (sortField !== field) return <ArrowUpDown className="h-4 w-4" />;
    return sortDirection === 'asc' 
      ? <ArrowUp className="h-4 w-4" /> 
      : <ArrowDown className="h-4 w-4" />;
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const parseUrlsFromText = (text: string, isCSV: boolean = false): string[] => {
    let lines: string[];
    
    if (isCSV) {
      // Parse CSV format: split by commas and newlines, handle quoted values
      lines = text.split(/[,\n\r]+/).map(line => line.trim().replace(/^["']|["']$/g, '')).filter(line => line.length > 0);
    } else {
      // Parse plain text: one URL per line
      lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    }
    
    const validUrls: string[] = [];
    
    for (const line of lines) {
      try {
        // Try to create a URL object to validate
        const url = new URL(line.startsWith('http') ? line : `https://${line}`);
        validUrls.push(url.toString());
      } catch (e) {
        // Skip invalid URLs
      }
    }
    
    return validUrls;
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.txt') && !file.name.endsWith('.csv')) {
      toast({
        title: "Invalid file format",
        description: "Please upload a .txt or .csv file containing URLs.",
        variant: "destructive",
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      const isCSV = file.name.endsWith('.csv');
      const extractedUrls = parseUrlsFromText(content, isCSV);
      
      if (extractedUrls.length === 0) {
        toast({
          title: "No valid URLs found",
          description: "The file doesn't contain any valid URLs.",
          variant: "destructive",
        });
        return;
      }

      setUrls(prev => {
        const combinedUrls = [...prev, ...extractedUrls];
        return Array.from(new Set(combinedUrls));
      });
      toast({
        title: "URLs loaded",
        description: `Added ${extractedUrls.length} URLs from the file.`,
      });
    };
    
    reader.readAsText(file);
  };

  const handleManualAdd = () => {
    if (!manualInput.trim()) return;
    
    const newUrls = parseUrlsFromText(manualInput);
    if (newUrls.length === 0) {
      toast({
        title: "No valid URLs",
        description: "Please enter valid URLs, one per line.",
        variant: "destructive",
      });
      return;
    }

    setUrls(prev => {
      const combinedUrls = [...prev, ...newUrls];
      return Array.from(new Set(combinedUrls));
    });
    setManualInput("");
    toast({
      title: "URLs added",
      description: `Added ${newUrls.length} URLs to the list.`,
    });
  };

  const removeUrl = (indexToRemove: number) => {
    setUrls(prev => prev.filter((_, index) => index !== indexToRemove));
  };

  const clearAllUrls = () => {
    setUrls([]);
    setManualInput("");
  };

  const startBulkAnalysis = async () => {
    if (urls.length === 0) {
      toast({
        title: "No URLs to analyze",
        description: "Please add URLs before starting the analysis.",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);
    
    const job: BulkAnalysisJob = {
      id: `bulk-${Date.now()}`,
      urls: [...urls],
      status: 'running',
      progress: 0,
      startedAt: new Date(),
      results: [],
      errors: []
    };
    
    setCurrentJob(job);

    try {
      // Process URLs sequentially to avoid overwhelming the server
      for (let i = 0; i < urls.length; i++) {
        const url = urls[i];
        
        try {
          const response = await fetch('/api/audit', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ url }),
          });

          if (!response.ok) {
            throw new Error(`Failed to analyze ${url}: ${response.statusText}`);
          }

          const result = await response.json();

          // Real-time progress: update results immediately
          setCurrentJob(prev => prev ? {
            ...prev,
            progress: ((i + 1) / urls.length) * 100,
            results: [...(prev.results || []), result]
          } : null);
          
        } catch (error) {
          console.error(`Error analyzing ${url}:`, error);
          const errorMessage = `${url}: ${error instanceof Error ? error.message : 'Unknown error'}`;
          
          // Real-time progress: update errors immediately
          setCurrentJob(prev => prev ? {
            ...prev,
            progress: ((i + 1) / urls.length) * 100,
            errors: [...(prev.errors || []), errorMessage]
          } : null);
        }
      }

      setCurrentJob(prev => prev ? {
        ...prev,
        status: 'completed',
        progress: 100,
        completedAt: new Date()
      } : null);

      toast({
        title: "Bulk analysis completed",
        description: `Successfully analyzed ${currentJob?.results?.length || 0} out of ${urls.length} URLs.`,
      });

    } catch (error) {
      console.error('Bulk analysis error:', error);
      setCurrentJob(prev => prev ? {
        ...prev,
        status: 'failed',
        errors: [...(prev.errors || []), error instanceof Error ? error.message : 'Unknown error']
      } : null);
      
      toast({
        title: "Analysis failed",
        description: "An error occurred during bulk analysis.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return <Clock className="h-4 w-4 text-amber-500" />;
      case 'running': return <BarChart3 className="h-4 w-4 text-blue-500 animate-pulse" />;
      case 'completed': return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failed': return <AlertCircle className="h-4 w-4 text-red-500" />;
      default: return null;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto space-y-8">
          {/* Header */}
          <div className="text-center space-y-4">
            <div className="flex items-center justify-center space-x-4 mb-4">
              <WouterLink href="/">
                <Button variant="outline" size="sm" data-testid="button-back-home">
                  <Home className="h-4 w-4 mr-2" />
                  Home
                </Button>
              </WouterLink>
              <WouterLink href="/competitive-analysis">
                <Button variant="outline" size="sm" data-testid="button-competitive-analysis">
                  <Users className="h-4 w-4 mr-2" />
                  Competitive Analysis
                </Button>
              </WouterLink>
            </div>
            <h1 className="text-4xl font-bold text-gray-900 dark:text-white">
              Bulk URL Analysis
            </h1>
            <p className="text-lg text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
              Analyze multiple websites simultaneously for SEO, accessibility, and mobile-friendliness. 
              Perfect for agencies and businesses managing multiple domains.
            </p>
          </div>

          {/* URL Input Section */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* File Upload */}
            <Card className="shadow-sm border border-border">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Upload className="h-5 w-5 mr-2 text-blue-600" />
                  Upload URL List
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-sm text-muted-foreground">
                  Upload a .txt or .csv file with URLs (one per line)
                </div>
                <div className="border-2 border-dashed border-border rounded-lg p-6 text-center">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".txt,.csv"
                    onChange={handleFileUpload}
                    className="hidden"
                    data-testid="input-file-upload"
                  />
                  <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <Button 
                    variant="outline" 
                    onClick={() => fileInputRef.current?.click()}
                    data-testid="button-upload-file"
                  >
                    Choose File
                  </Button>
                  <p className="text-sm text-muted-foreground mt-2">
                    Supported formats: .txt, .csv
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Manual Entry */}
            <Card className="shadow-sm border border-border">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Link className="h-5 w-5 mr-2 text-green-600" />
                  Manual Entry
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-sm text-muted-foreground">
                  Enter URLs manually (one per line)
                </div>
                <Textarea
                  placeholder="https://example1.com&#10;https://example2.com&#10;example3.com"
                  value={manualInput}
                  onChange={(e) => setManualInput(e.target.value)}
                  rows={6}
                  data-testid="textarea-manual-urls"
                />
                <Button 
                  onClick={handleManualAdd}
                  disabled={!manualInput.trim()}
                  data-testid="button-add-manual-urls"
                >
                  Add URLs
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* URL List */}
          {urls.length > 0 && (
            <Card className="shadow-sm border border-border">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center">
                    <Globe className="h-5 w-5 mr-2 text-purple-600" />
                    URLs to Analyze ({urls.length})
                  </CardTitle>
                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={clearAllUrls}
                      data-testid="button-clear-urls"
                    >
                      Clear All
                    </Button>
                    <Button 
                      onClick={startBulkAnalysis}
                      disabled={isProcessing || urls.length === 0}
                      data-testid="button-start-analysis"
                    >
                      <Play className="h-4 w-4 mr-2" />
                      {isProcessing ? 'Analyzing...' : 'Start Analysis'}
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-60 overflow-y-auto">
                  {urls.map((url, index) => (
                    <div 
                      key={index} 
                      className="flex items-center justify-between bg-muted/30 rounded-lg p-3"
                    >
                      <span className="text-sm truncate flex-1" title={url}>
                        {url}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeUrl(index)}
                        className="h-6 w-6 p-0"
                        data-testid={`button-remove-url-${index}`}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Progress Section */}
          {currentJob && (
            <Card className="shadow-sm border border-border">
              <CardHeader>
                <CardTitle className="flex items-center">
                  {getStatusIcon(currentJob.status)}
                  <span className="ml-2">Analysis Progress</span>
                  <Badge className="ml-auto" data-testid="badge-job-status">
                    {currentJob.status.toUpperCase()}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Progress</span>
                    <span data-testid="text-progress-percentage">{Math.round(currentJob.progress)}%</span>
                  </div>
                  <Progress value={currentJob.progress} className="w-full" data-testid="progress-bar" />
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                  <div>
                    <div className="text-2xl font-bold text-blue-600" data-testid="text-total-urls">
                      {currentJob.urls.length}
                    </div>
                    <div className="text-sm text-muted-foreground">Total URLs</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-green-600" data-testid="text-completed-count">
                      {currentJob.results?.length || 0}
                    </div>
                    <div className="text-sm text-muted-foreground">Completed</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-red-600" data-testid="text-errors-count">
                      {currentJob.errors?.length || 0}
                    </div>
                    <div className="text-sm text-muted-foreground">Errors</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-amber-600" data-testid="text-duration">
                      {currentJob.completedAt 
                        ? Math.round((currentJob.completedAt.getTime() - currentJob.startedAt.getTime()) / 1000)
                        : Math.round((Date.now() - currentJob.startedAt.getTime()) / 1000)
                      }s
                    </div>
                    <div className="text-sm text-muted-foreground">Duration</div>
                  </div>
                </div>

{currentJob.status === 'completed' && currentJob.results && currentJob.results.length > 0 && (() => {
                  const filteredResults = filterResults(currentJob.results);
                  const sortedResults = sortResults(filteredResults);
                  
                  return (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h4 className="font-semibold">Analysis Results ({sortedResults.length} URLs)</h4>
                        <div className="flex gap-2">
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => exportToCSV(sortedResults)}
                            data-testid="button-export-csv"
                          >
                            <Download className="h-4 w-4 mr-2" />
                            Export CSV
                          </Button>
                        </div>
                      </div>
                      
                      {/* Filter Controls */}
                      <div className="flex flex-wrap gap-4 p-4 bg-muted/30 rounded-lg">
                        <div className="flex items-center gap-2">
                          <Filter className="h-4 w-4" />
                          <span className="text-sm font-medium">Filters:</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <label className="text-sm">Min Score:</label>
                          <Input
                            type="number"
                            placeholder="0-100"
                            value={filterMinScore}
                            onChange={(e) => setFilterMinScore(e.target.value)}
                            className="w-20 h-8"
                            data-testid="input-filter-min-score"
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <label className="text-sm">Domain:</label>
                          <Input
                            placeholder="Filter by domain..."
                            value={filterDomain}
                            onChange={(e) => setFilterDomain(e.target.value)}
                            className="w-40 h-8"
                            data-testid="input-filter-domain"
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <label className="text-sm">Status:</label>
                          <Select value={filterStatus} onValueChange={setFilterStatus}>
                            <SelectTrigger className="w-32 h-8" data-testid="select-filter-status">
                              <SelectValue placeholder="All" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">All</SelectItem>
                              <SelectItem value="success">Success</SelectItem>
                              <SelectItem value="failed">Failed</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        {(filterMinScore || filterDomain || filterStatus !== 'all') && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setFilterMinScore('');
                              setFilterDomain('');
                              setFilterStatus('all');
                            }}
                            className="h-8"
                            data-testid="button-clear-filters"
                          >
                            Clear Filters
                          </Button>
                        )}
                      </div>

                      {/* Comparison Table */}
                      <div className="border rounded-lg overflow-hidden">
                        <div className="max-h-96 overflow-y-auto">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="w-[300px]">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleSort('url')}
                                    className="h-auto p-0 font-semibold text-left justify-start"
                                    data-testid="button-sort-url"
                                  >
                                    URL {getSortIcon('url')}
                                  </Button>
                                </TableHead>
                                <TableHead className="text-center">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleSort('overallScore')}
                                    className="h-auto p-0 font-semibold"
                                    data-testid="button-sort-overall"
                                  >
                                    Overall {getSortIcon('overallScore')}
                                  </Button>
                                </TableHead>
                                <TableHead className="text-center">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleSort('seoScore')}
                                    className="h-auto p-0 font-semibold"
                                    data-testid="button-sort-seo"
                                  >
                                    SEO {getSortIcon('seoScore')}
                                  </Button>
                                </TableHead>
                                <TableHead className="text-center">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleSort('accessibilityScore')}
                                    className="h-auto p-0 font-semibold"
                                    data-testid="button-sort-accessibility"
                                  >
                                    A11y {getSortIcon('accessibilityScore')}
                                  </Button>
                                </TableHead>
                                <TableHead className="text-center">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleSort('mobileScore')}
                                    className="h-auto p-0 font-semibold"
                                    data-testid="button-sort-mobile"
                                  >
                                    Mobile {getSortIcon('mobileScore')}
                                  </Button>
                                </TableHead>
                                <TableHead className="text-center">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleSort('performanceScore')}
                                    className="h-auto p-0 font-semibold"
                                    data-testid="button-sort-performance"
                                  >
                                    Performance {getSortIcon('performanceScore')}
                                  </Button>
                                </TableHead>
                                <TableHead className="text-center">Actions</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {sortedResults.map((result, index) => (
                                <TableRow key={result.id}>
                                  <TableCell className="font-medium">
                                    <div className="truncate" title={result.url}>
                                      {result.url}
                                    </div>
                                    <div className="text-xs text-muted-foreground">
                                      {new Date(result.analysisDate).toLocaleDateString()}
                                    </div>
                                  </TableCell>
                                  <TableCell className="text-center">
                                    <div className={`font-semibold ${getScoreColor(result.overallScore)}`}>
                                      {result.overallScore}
                                    </div>
                                  </TableCell>
                                  <TableCell className="text-center">
                                    <div className={`font-semibold ${getScoreColor(getScoreFromResult(result, 'seoScore'))}`}>
                                      {getScoreFromResult(result, 'seoScore')}
                                    </div>
                                  </TableCell>
                                  <TableCell className="text-center">
                                    <div className={`font-semibold ${getScoreColor(getScoreFromResult(result, 'accessibilityScore'))}`} data-testid={`cell-accessibility-score-${index}`}>
                                      {getScoreFromResult(result, 'accessibilityScore')}
                                    </div>
                                  </TableCell>
                                  <TableCell className="text-center">
                                    <div className={`font-semibold ${getScoreColor(getScoreFromResult(result, 'mobileScore'))}`}>
                                      {getScoreFromResult(result, 'mobileScore')}
                                    </div>
                                  </TableCell>
                                  <TableCell className="text-center">
                                    <div className={`font-semibold ${getScoreColor(getScoreFromResult(result, 'performanceScore'))}`} data-testid={`cell-performance-score-${index}`}>
                                      {getScoreFromResult(result, 'performanceScore')}
                                    </div>
                                  </TableCell>
                                  <TableCell className="text-center">
                                    <WouterLink href={`/report/${result.id}`}>
                                      <Button 
                                        variant="outline" 
                                        size="sm"
                                        data-testid={`button-view-result-${index}`}
                                      >
                                        View Report
                                      </Button>
                                    </WouterLink>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {currentJob.errors && currentJob.errors.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="font-semibold text-red-600">Errors</h4>
                    <div className="bg-red-50 border border-red-200 rounded-lg p-3 max-h-32 overflow-y-auto">
                      {currentJob.errors.map((error, index) => (
                        <div key={index} className="text-sm text-red-700">
                          {error}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}