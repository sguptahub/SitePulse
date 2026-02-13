import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { 
  ChartContainer, 
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent 
} from "@/components/ui/chart";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Area,
  AreaChart,
  Cell
} from "recharts";
import { 
  Clock, 
  TrendingUp, 
  TrendingDown, 
  BarChart3, 
  Calendar,
  Globe,
  Eye,
  Activity,
  Database,
  AlertCircle,
  CheckCircle,
  Users,
  Link as LinkIcon,
  Home,
  Search,
  ArrowUp,
  ArrowDown,
  Minus
} from "lucide-react";
import { Link } from "wouter";
import TimePeriodComparisons from "@/components/time-period-comparisons";

interface HistoricalTracking {
  id: string;
  url: string;
  domain: string;
  trackingStartDate: string;
  lastAuditDate: string;
  totalAudits: number;
  retentionDays: number;
  isActive: boolean;
  averageScore: number;
}

interface PerformanceHistory {
  id: string;
  historicalTrackingId: string;
  overallScore: number;
  seoScore: number;
  accessibilityScore: number;
  mobileScore: number;
  performanceScore: number;
  scoreChange: number;
  recordedAt: string;
}

interface TrendAnalysis {
  id: string;
  historicalTrackingId: string;
  period: string;
  trendDirection: 'improving' | 'declining' | 'stable';
  averageChange: number;
  significantChanges: Array<{
    metric: string;
    change: number;
    significance: 'high' | 'medium' | 'low';
  }>;
  analysisDate: string;
}

interface Statistics {
  totalActiveTrackings: number;
  totalHistoricalAudits: number;
  averageAuditsPerTracking: number;
  topDomains: Array<{
    domain: string;
    trackingCount: number;
  }>;
  oldestTracking: HistoricalTracking | null;
  mostRecentAudit: HistoricalTracking | null;
}

export default function HistoricalDashboard() {
  const [selectedTracking, setSelectedTracking] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState({
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 30 days ago
    endDate: new Date().toISOString().split('T')[0]
  });
  const { toast } = useToast();

  // Fetch active trackings
  const { data: trackings = [], isLoading: trackingsLoading } = useQuery<HistoricalTracking[]>({
    queryKey: ['/api/historical-tracking'],
  });

  // Auto-select first tracking when trackings load
  useEffect(() => {
    if (!selectedTracking && trackings.length > 0 && !trackingsLoading) {
      console.log('🎯 Auto-selecting first tracking:', trackings[0].domain);
      setSelectedTracking(trackings[0].id);
    }
  }, [trackings, trackingsLoading, selectedTracking]);

  // Fetch statistics
  const { data: statistics, isLoading: statisticsLoading } = useQuery<Statistics>({
    queryKey: ['/api/historical-tracking/statistics'],
  });

  // Fetch performance history for selected tracking
  const { data: performanceHistory = [], isLoading: historyLoading } = useQuery<PerformanceHistory[]>({
    queryKey: ['/api/historical-tracking', selectedTracking, 'performance-history', 'date-range', dateRange.startDate, dateRange.endDate],
    queryFn: async () => {
      if (!selectedTracking) return [];
      const response = await fetch(`/api/historical-tracking/${selectedTracking}/performance-history/date-range?startDate=${dateRange.startDate}&endDate=${dateRange.endDate}`);
      if (!response.ok) throw new Error('Failed to fetch performance history');
      return response.json();
    },
    enabled: !!selectedTracking,
  });

  // Fetch trend analysis for selected tracking
  const { data: trendAnalyses = [], isLoading: trendsLoading } = useQuery<TrendAnalysis[]>({
    queryKey: ['/api/historical-tracking', selectedTracking, 'trend-analysis'],
    queryFn: async () => {
      if (!selectedTracking) return [];
      const response = await fetch(`/api/historical-tracking/${selectedTracking}/trend-analysis`);
      if (!response.ok) throw new Error('Failed to fetch trend analysis');
      return response.json();
    },
    enabled: !!selectedTracking,
  });

  // Cleanup data mutation
  const cleanupMutation = useMutation({
    mutationFn: async (retentionDays?: number) => {
      const response = await fetch('/api/historical-tracking/cleanup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(retentionDays ? { retentionDays } : {})
      });
      if (!response.ok) throw new Error('Cleanup failed');
      return response.json();
    },
    onSuccess: (data: { deleted: number }) => {
      toast({
        title: "Cleanup completed successfully",
        description: `Deleted ${data.deleted} expired records`,
      });
      // Invalidate all historical tracking related queries
      queryClient.invalidateQueries({ queryKey: ['/api/historical-tracking'] });
      queryClient.invalidateQueries({ queryKey: ['/api/historical-tracking/statistics'] });
      if (selectedTracking) {
        queryClient.invalidateQueries({ 
          queryKey: ['/api/historical-tracking', selectedTracking, 'performance-history'] 
        });
        queryClient.invalidateQueries({ 
          queryKey: ['/api/historical-tracking', selectedTracking, 'trend-analysis'] 
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Cleanup failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Chart configuration
  const chartConfig = {
    overallScore: { label: "Overall", color: "hsl(var(--primary))" },
    seoScore: { label: "SEO", color: "hsl(142, 76%, 36%)" },
    accessibilityScore: { label: "Accessibility", color: "hsl(221, 83%, 53%)" },
    mobileScore: { label: "Mobile", color: "hsl(262, 83%, 58%)" },
    performanceScore: { label: "Performance", color: "hsl(25, 95%, 53%)" },
  };

  // Prepare chart data
  const chartData = performanceHistory.map((record: PerformanceHistory) => ({
    date: new Date(record.recordedAt).toLocaleDateString(),
    overallScore: record.overallScore,
    seoScore: record.seoScore || 0,
    accessibilityScore: record.accessibilityScore || 0,
    mobileScore: record.mobileScore || 0,
    performanceScore: record.performanceScore || 0,
    scoreChange: record.scoreChange || 0
  }));

  // Trend direction helper
  const getTrendIcon = (direction: string, change: number) => {
    if (direction === 'improving' || change > 0) return <ArrowUp className="h-4 w-4 text-green-600" />;
    if (direction === 'declining' || change < 0) return <ArrowDown className="h-4 w-4 text-red-600" />;
    return <Minus className="h-4 w-4 text-gray-600" />;
  };

  return (
    <div className="min-h-screen bg-background text-foreground font-sans">
      {/* Header */}
      <header className="bg-card border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="bg-primary text-primary-foreground rounded-lg p-2">
                <BarChart3 className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-foreground">Historical Dashboard</h1>
                <p className="text-muted-foreground">Track performance trends and analysis over time</p>
              </div>
            </div>
            <div className="hidden sm:flex items-center space-x-3">
              <Link href="/">
                <div className="group bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:border-primary/20 dark:hover:border-primary/30 shadow-sm hover:shadow-md px-4 py-2 rounded-lg text-sm font-medium cursor-pointer transition-all duration-200 hover:bg-gray-50 dark:hover:bg-gray-700/50" data-testid="link-home">
                  <div className="flex items-center space-x-2 text-gray-700 dark:text-gray-300 group-hover:text-primary">
                    <Home className="h-4 w-4" />
                    <span>Home</span>
                  </div>
                </div>
              </Link>
              <Link href="/bulk-analysis">
                <div className="group bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:border-primary/20 dark:hover:border-primary/30 shadow-sm hover:shadow-md px-4 py-2 rounded-lg text-sm font-medium cursor-pointer transition-all duration-200 hover:bg-gray-50 dark:hover:bg-gray-700/50" data-testid="link-bulk-analysis">
                  <div className="flex items-center space-x-2 text-gray-700 dark:text-gray-300 group-hover:text-primary">
                    <BarChart3 className="h-4 w-4" />
                    <span>Bulk Analysis</span>
                  </div>
                </div>
              </Link>
              <Link href="/competitive-analysis">
                <div className="group bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:border-primary/20 dark:hover:border-primary/30 shadow-sm hover:shadow-md px-4 py-2 rounded-lg text-sm font-medium cursor-pointer transition-all duration-200 hover:bg-gray-50 dark:hover:bg-gray-700/50" data-testid="link-competitive-analysis">
                  <div className="flex items-center space-x-2 text-gray-700 dark:text-gray-300 group-hover:text-primary">
                    <Users className="h-4 w-4" />
                    <span>Competitive Analysis</span>
                  </div>
                </div>
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Statistics Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Trackings</CardTitle>
              <Database className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="stat-active-trackings">
                {statisticsLoading ? '...' : statistics?.totalActiveTrackings || 0}
              </div>
              <p className="text-xs text-muted-foreground">URLs being monitored</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Audits</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="stat-total-audits">
                {statisticsLoading ? '...' : statistics?.totalHistoricalAudits || 0}
              </div>
              <p className="text-xs text-muted-foreground">Historical records</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg Audits</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="stat-avg-audits">
                {statisticsLoading ? '...' : statistics?.averageAuditsPerTracking || 0}
              </div>
              <p className="text-xs text-muted-foreground">Per tracking</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Top Domain</CardTitle>
              <Globe className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-lg font-bold truncate" data-testid="stat-top-domain">
                {statisticsLoading ? '...' : statistics?.topDomains?.[0]?.domain || 'None'}
              </div>
              <p className="text-xs text-muted-foreground">
                {statistics?.topDomains?.[0]?.trackingCount || 0} trackings
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Historical Trackings List */}
          <div className="lg:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Eye className="h-5 w-5" />
                  Active Trackings
                </CardTitle>
                <CardDescription>
                  Select a tracking to view its performance history
                </CardDescription>
              </CardHeader>
              <CardContent>
                {trackingsLoading ? (
                  <div className="space-y-2">
                    <div className="h-4 bg-muted animate-pulse rounded" />
                    <div className="h-4 bg-muted animate-pulse rounded" />
                    <div className="h-4 bg-muted animate-pulse rounded" />
                  </div>
                ) : trackings.length === 0 ? (
                  <div className="text-center py-4 text-muted-foreground">
                    <Search className="h-8 w-8 mx-auto mb-2" />
                    No historical trackings found
                  </div>
                ) : (
                  <div className="space-y-2" data-testid="tracking-list">
                    {trackings.map((tracking) => (
                      <div
                        key={tracking.id}
                        onClick={() => setSelectedTracking(tracking.id)}
                        className={`p-3 border rounded-lg cursor-pointer transition-colors hover:bg-muted/50 ${
                          selectedTracking === tracking.id ? 'border-primary bg-primary/5' : 'border-border'
                        }`}
                        data-testid={`tracking-item-${tracking.id}`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1 min-w-0">
                            <div className="font-medium truncate">{tracking.domain}</div>
                            <div className="text-sm text-muted-foreground truncate">{tracking.url}</div>
                          </div>
                          <Badge variant="secondary" className="ml-2">
                            {tracking.totalAudits}
                          </Badge>
                        </div>
                        <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
                          <span>Avg: {tracking.averageScore ? tracking.averageScore.toFixed(1) : '0.0'}%</span>
                          <span>{tracking.lastAuditDate ? new Date(tracking.lastAuditDate).toLocaleDateString() : 'N/A'}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Data Management */}
            <Card className="mt-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database className="h-5 w-5" />
                  Data Management
                </CardTitle>
                <CardDescription>
                  Manage historical data retention
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button 
                  onClick={() => cleanupMutation.mutate(undefined)}
                  disabled={cleanupMutation.isPending}
                  className="w-full"
                  variant="outline"
                  data-testid="button-cleanup"
                >
                  {cleanupMutation.isPending ? 'Cleaning...' : 'Run Cleanup'}
                </Button>
                <p className="text-xs text-muted-foreground mt-2">
                  Removes expired data based on retention policies
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Performance Charts */}
          <div className="lg:col-span-2">
            {selectedTracking ? (
              <div className="space-y-6">
                {/* Date Range Selection */}
                <Card>
                  <CardHeader>
                    <CardTitle>Performance Trends</CardTitle>
                    <CardDescription>
                      Historical performance data over time
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex gap-4 mb-6">
                      <div className="flex-1">
                        <Label htmlFor="start-date">Start Date</Label>
                        <Input
                          id="start-date"
                          type="date"
                          value={dateRange.startDate}
                          onChange={(e) => setDateRange(prev => ({ ...prev, startDate: e.target.value }))}
                          data-testid="input-start-date"
                        />
                      </div>
                      <div className="flex-1">
                        <Label htmlFor="end-date">End Date</Label>
                        <Input
                          id="end-date"
                          type="date"
                          value={dateRange.endDate}
                          onChange={(e) => setDateRange(prev => ({ ...prev, endDate: e.target.value }))}
                          data-testid="input-end-date"
                        />
                      </div>
                    </div>

                    {historyLoading ? (
                      <div className="h-64 bg-muted animate-pulse rounded" />
                    ) : chartData.length === 0 ? (
                      <div className="h-64 flex items-center justify-center text-muted-foreground">
                        <div className="text-center">
                          <Calendar className="h-8 w-8 mx-auto mb-2" />
                          No data available for selected date range
                        </div>
                      </div>
                    ) : (
                      <ChartContainer config={chartConfig} className="h-64">
                        <LineChart data={chartData}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="date" />
                          <YAxis domain={[0, 100]} />
                          <ChartTooltip content={<ChartTooltipContent />} />
                          <ChartLegend content={<ChartLegendContent />} />
                          <Line 
                            type="monotone" 
                            dataKey="overallScore" 
                            stroke={chartConfig.overallScore.color}
                            strokeWidth={3}
                            dot={{ r: 4 }}
                          />
                          <Line 
                            type="monotone" 
                            dataKey="seoScore" 
                            stroke={chartConfig.seoScore.color}
                            strokeWidth={2}
                            dot={{ r: 3 }}
                          />
                          <Line 
                            type="monotone" 
                            dataKey="accessibilityScore" 
                            stroke={chartConfig.accessibilityScore.color}
                            strokeWidth={2}
                            dot={{ r: 3 }}
                          />
                          <Line 
                            type="monotone" 
                            dataKey="mobileScore" 
                            stroke={chartConfig.mobileScore.color}
                            strokeWidth={2}
                            dot={{ r: 3 }}
                          />
                          <Line 
                            type="monotone" 
                            dataKey="performanceScore" 
                            stroke={chartConfig.performanceScore.color}
                            strokeWidth={2}
                            dot={{ r: 3 }}
                          />
                        </LineChart>
                      </ChartContainer>
                    )}
                  </CardContent>
                </Card>

                {/* Trend Analysis */}
                <Card>
                  <CardHeader>
                    <CardTitle>Trend Analysis</CardTitle>
                    <CardDescription>
                      Performance trends and insights
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {trendsLoading ? (
                      <div className="space-y-2">
                        <div className="h-4 bg-muted animate-pulse rounded" />
                        <div className="h-4 bg-muted animate-pulse rounded" />
                      </div>
                    ) : !trendAnalyses || trendAnalyses.length === 0 ? (
                      <div className="text-center py-4 text-muted-foreground">
                        <TrendingUp className="h-8 w-8 mx-auto mb-2" />
                        No trend analysis available
                      </div>
                    ) : (
                      <div className="space-y-4" data-testid="trend-analysis">
                        {trendAnalyses.map((analysis: TrendAnalysis) => (
                          <div key={analysis.id} className="border rounded-lg p-4">
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex items-center gap-2">
                                {getTrendIcon(analysis.trendDirection || 'stable', analysis.averageChange || 0)}
                                <Badge variant={
                                  analysis.trendDirection === 'improving' ? 'default' :
                                  analysis.trendDirection === 'declining' ? 'destructive' :
                                  'secondary'
                                }>
                                  {analysis.trendDirection}
                                </Badge>
                                <span className="font-medium">{analysis.period}</span>
                              </div>
                              <span className="text-sm text-muted-foreground">
                                {new Date(analysis.analysisDate).toLocaleDateString()}
                              </span>
                            </div>
                            <div className="text-sm text-muted-foreground mb-2">
                              Average change: {analysis.averageChange != null ? (analysis.averageChange > 0 ? '+' : '') + analysis.averageChange.toFixed(1) + '%' : 'N/A'}
                            </div>
                            {analysis.significantChanges && analysis.significantChanges.length > 0 && (
                              <div className="space-y-1">
                                <div className="text-sm font-medium">Significant Changes:</div>
                                {analysis.significantChanges.map((change: any, index: number) => (
                                  <div key={index} className="flex items-center justify-between text-sm">
                                    <span>{change.metric}</span>
                                    <div className="flex items-center gap-2">
                                      <span className={change.change > 0 ? 'text-green-600' : 'text-red-600'}>
                                        {change.change != null ? (change.change > 0 ? '+' : '') + change.change.toFixed(1) + '%' : 'N/A'}
                                      </span>
                                      <Badge variant={
                                        change.significance === 'high' ? 'destructive' :
                                        change.significance === 'medium' ? 'default' :
                                        'secondary'
                                      }>
                                        {change.significance}
                                      </Badge>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Time-Period Comparisons */}
                <TimePeriodComparisons selectedTracking={selectedTracking} />
              </div>
            ) : (
              <Card className="h-full">
                <CardContent className="flex items-center justify-center h-64">
                  <div className="text-center text-muted-foreground">
                    <BarChart3 className="h-12 w-12 mx-auto mb-4" />
                    <h3 className="text-lg font-medium mb-2">Select a Tracking</h3>
                    <p>Choose a historical tracking from the left to view performance trends and analysis</p>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}