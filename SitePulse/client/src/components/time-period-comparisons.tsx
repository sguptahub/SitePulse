import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent 
} from "@/components/ui/chart";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Cell,
  LineChart,
  Line,
  Area,
  AreaChart
} from "recharts";
import { 
  TrendingUp, 
  TrendingDown, 
  Minus,
  Calendar,
  BarChart3,
  ArrowUp,
  ArrowDown,
  Activity,
  Target,
  Clock,
  Zap,
  AlertTriangle,
  CheckCircle
} from "lucide-react";

interface ScoreChanges {
  overall: { previous: number; current: number; change: number; percentage: number };
  seo?: { previous: number; current: number; change: number; percentage: number };
  accessibility?: { previous: number; current: number; change: number; percentage: number };
  mobile?: { previous: number; current: number; change: number; percentage: number };
  performance?: { previous: number; current: number; change: number; percentage: number };
}

interface TrendAnalysis {
  id: string;
  historicalTrackingId: string;
  analysisDate: string;
  timePeriod: '7d' | '30d' | '90d' | '1y';
  overallTrend: 'improving' | 'declining' | 'stable';
  trendStrength: 'weak' | 'moderate' | 'strong';
  keyInsights: Array<{
    category: string;
    insight: string;
    impact: 'high' | 'medium' | 'low';
  }>;
  improvements: Array<{
    metric: string;
    change: number;
    significance: 'high' | 'medium' | 'low';
  }>;
  regressions: Array<{
    metric: string;
    change: number;
    significance: 'high' | 'medium' | 'low';
  }>;
  confidenceScore: number;
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

interface TimePeriodComparisonsProps {
  selectedTracking: string | null;
}

export default function TimePeriodComparisons({ selectedTracking }: TimePeriodComparisonsProps) {
  const [selectedPeriod, setSelectedPeriod] = useState<'7d' | '30d' | '90d' | '1y'>('30d');
  const [comparisonMode, setComparisonMode] = useState<'before-after' | 'week-over-week' | 'month-over-month'>('before-after');

  // Fetch trend analysis for selected tracking and period
  const { data: trendAnalysis, isLoading: trendLoading } = useQuery<TrendAnalysis>({
    queryKey: ['/api/historical-tracking', selectedTracking, 'trend-analysis', selectedPeriod],
    queryFn: async () => {
      if (!selectedTracking) throw new Error('No tracking selected');
      const response = await fetch(`/api/historical-tracking/${selectedTracking}/trend-analysis/${selectedPeriod}`);
      if (!response.ok) throw new Error('Failed to fetch trend analysis');
      return response.json();
    },
    enabled: !!selectedTracking,
  });

  // Fetch recent performance history for comparisons
  const { data: recentHistory = [], isLoading: historyLoading } = useQuery<PerformanceHistory[]>({
    queryKey: ['/api/historical-tracking', selectedTracking, 'performance-history', 'recent'],
    queryFn: async () => {
      if (!selectedTracking) return [];
      const response = await fetch(`/api/historical-tracking/${selectedTracking}/performance-history?limit=30`);
      if (!response.ok) throw new Error('Failed to fetch recent history');
      return response.json();
    },
    enabled: !!selectedTracking,
  });

  // Calculate period comparisons
  const calculatePeriodComparison = () => {
    if (!recentHistory.length) return null;

    const now = new Date();
    const history = [...recentHistory].sort((a, b) => new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime());
    
    let currentPeriod: PerformanceHistory[] = [];
    let previousPeriod: PerformanceHistory[] = [];
    
    if (comparisonMode === 'week-over-week') {
      // Last 7 days vs previous 7 days
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
      
      currentPeriod = history.filter(h => new Date(h.recordedAt) >= weekAgo);
      previousPeriod = history.filter(h => {
        const date = new Date(h.recordedAt);
        return date >= twoWeeksAgo && date < weekAgo;
      });
    } else if (comparisonMode === 'month-over-month') {
      // Last 30 days vs previous 30 days  
      const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const twoMonthsAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
      
      currentPeriod = history.filter(h => new Date(h.recordedAt) >= monthAgo);
      previousPeriod = history.filter(h => {
        const date = new Date(h.recordedAt);
        return date >= twoMonthsAgo && date < monthAgo;
      });
    } else {
      // Before/after: split history in half
      const midpoint = Math.floor(history.length / 2);
      currentPeriod = history.slice(0, midpoint);
      previousPeriod = history.slice(midpoint);
    }

    if (!currentPeriod.length || !previousPeriod.length) return null;

    // Calculate averages for each period
    const calculateAverage = (period: PerformanceHistory[]) => ({
      overall: period.reduce((sum, h) => sum + h.overallScore, 0) / period.length,
      seo: period.reduce((sum, h) => sum + (h.seoScore || 0), 0) / period.length,
      accessibility: period.reduce((sum, h) => sum + (h.accessibilityScore || 0), 0) / period.length,
      mobile: period.reduce((sum, h) => sum + (h.mobileScore || 0), 0) / period.length,
      performance: period.reduce((sum, h) => sum + (h.performanceScore || 0), 0) / period.length,
    });

    const currentAvg = calculateAverage(currentPeriod);
    const previousAvg = calculateAverage(previousPeriod);

    // Calculate score changes
    const calculateChange = (current: number, previous: number) => ({
      previous,
      current,
      change: current - previous,
      percentage: previous > 0 ? ((current - previous) / previous) * 100 : 0
    });

    return {
      overall: calculateChange(currentAvg.overall, previousAvg.overall),
      seo: calculateChange(currentAvg.seo, previousAvg.seo),
      accessibility: calculateChange(currentAvg.accessibility, previousAvg.accessibility),
      mobile: calculateChange(currentAvg.mobile, previousAvg.mobile),
      performance: calculateChange(currentAvg.performance, previousAvg.performance),
      currentPeriodCount: currentPeriod.length,
      previousPeriodCount: previousPeriod.length,
    };
  };

  const comparison = calculatePeriodComparison();

  // Chart configuration
  const chartConfig = {
    previous: { label: "Previous Period", color: "hsl(var(--muted-foreground))" },
    current: { label: "Current Period", color: "hsl(var(--primary))" },
    change: { label: "Change", color: "hsl(142, 76%, 36%)" },
  };

  // Prepare comparison chart data
  const comparisonChartData = comparison ? [
    {
      metric: "Overall",
      previous: Math.round(comparison.overall.previous * 100) / 100,
      current: Math.round(comparison.overall.current * 100) / 100,
      change: Math.round(comparison.overall.change * 100) / 100
    },
    {
      metric: "SEO",
      previous: Math.round(comparison.seo.previous * 100) / 100,
      current: Math.round(comparison.seo.current * 100) / 100,
      change: Math.round(comparison.seo.change * 100) / 100
    },
    {
      metric: "Accessibility",
      previous: Math.round(comparison.accessibility.previous * 100) / 100,
      current: Math.round(comparison.accessibility.current * 100) / 100,
      change: Math.round(comparison.accessibility.change * 100) / 100
    },
    {
      metric: "Mobile",
      previous: Math.round(comparison.mobile.previous * 100) / 100,
      current: Math.round(comparison.mobile.current * 100) / 100,
      change: Math.round(comparison.mobile.change * 100) / 100
    },
    {
      metric: "Performance",
      previous: Math.round(comparison.performance.previous * 100) / 100,
      current: Math.round(comparison.performance.current * 100) / 100,
      change: Math.round(comparison.performance.change * 100) / 100
    }
  ] : [];

  const getTrendIcon = (change: number) => {
    if (change > 0) return <ArrowUp className="h-4 w-4 text-green-600" />;
    if (change < 0) return <ArrowDown className="h-4 w-4 text-red-600" />;
    return <Minus className="h-4 w-4 text-gray-600" />;
  };

  const getChangeColor = (change: number) => {
    if (change > 0) return "text-green-600";
    if (change < 0) return "text-red-600";
    return "text-gray-600";
  };

  const getChangeBadge = (change: number, threshold = 1) => {
    if (Math.abs(change) < threshold) return { variant: "secondary" as const, label: "Stable" };
    if (change > 0) return { variant: "default" as const, label: "Improved" };
    return { variant: "destructive" as const, label: "Declined" };
  };

  if (!selectedTracking) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-64">
          <div className="text-center text-muted-foreground">
            <Calendar className="h-12 w-12 mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">Select a Tracking</h3>
            <p>Choose a historical tracking to view time-period comparisons</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Time-Period Comparisons
          </CardTitle>
          <CardDescription>
            Compare performance across different time periods
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={comparisonMode} onValueChange={(value) => setComparisonMode(value as any)} className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="before-after" data-testid="tab-before-after">Before/After</TabsTrigger>
              <TabsTrigger value="week-over-week" data-testid="tab-week-over-week">Week-over-Week</TabsTrigger>
              <TabsTrigger value="month-over-month" data-testid="tab-month-over-month">Month-over-Month</TabsTrigger>
            </TabsList>

            <TabsContent value="before-after" className="space-y-4">
              <div className="text-sm text-muted-foreground">
                Compare first half vs second half of historical data
              </div>
              {historyLoading ? (
                <div className="h-32 bg-muted animate-pulse rounded" />
              ) : comparison ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                    {comparisonChartData.map((item) => (
                      <Card key={item.metric} className="p-4">
                        <div className="flex items-center justify-between mb-2">
                          <div className="text-sm font-medium">{item.metric}</div>
                          {getTrendIcon(item.change)}
                        </div>
                        <div className="space-y-1">
                          <div className="text-2xl font-bold">{item.current.toFixed(1)}</div>
                          <div className={`text-sm ${getChangeColor(item.change)}`}>
                            {item.change > 0 ? '+' : ''}{item.change.toFixed(1)} pts
                          </div>
                          <Badge {...getChangeBadge(item.change)} className="text-xs">
                            {getChangeBadge(item.change).label}
                          </Badge>
                        </div>
                      </Card>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  Insufficient data for before/after comparison
                </div>
              )}
            </TabsContent>

            <TabsContent value="week-over-week" className="space-y-4">
              <div className="text-sm text-muted-foreground">
                Compare last 7 days vs previous 7 days
              </div>
              {historyLoading ? (
                <div className="h-32 bg-muted animate-pulse rounded" />
              ) : comparison ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                    {comparisonChartData.map((item) => (
                      <Card key={item.metric} className="p-4">
                        <div className="flex items-center justify-between mb-2">
                          <div className="text-sm font-medium">{item.metric}</div>
                          {getTrendIcon(item.change)}
                        </div>
                        <div className="space-y-1">
                          <div className="text-2xl font-bold">{item.current.toFixed(1)}</div>
                          <div className={`text-sm ${getChangeColor(item.change)}`}>
                            {item.change > 0 ? '+' : ''}{item.change.toFixed(1)} pts
                          </div>
                          <div className="text-xs text-muted-foreground">
                            vs {item.previous.toFixed(1)} (prev week)
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                  <div className="text-xs text-muted-foreground text-center">
                    Current period: {comparison.currentPeriodCount} audits | Previous period: {comparison.previousPeriodCount} audits
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  Insufficient data for week-over-week comparison
                </div>
              )}
            </TabsContent>

            <TabsContent value="month-over-month" className="space-y-4">
              <div className="text-sm text-muted-foreground">
                Compare last 30 days vs previous 30 days
              </div>
              {historyLoading ? (
                <div className="h-32 bg-muted animate-pulse rounded" />
              ) : comparison ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                    {comparisonChartData.map((item) => (
                      <Card key={item.metric} className="p-4">
                        <div className="flex items-center justify-between mb-2">
                          <div className="text-sm font-medium">{item.metric}</div>
                          {getTrendIcon(item.change)}
                        </div>
                        <div className="space-y-1">
                          <div className="text-2xl font-bold">{item.current.toFixed(1)}</div>
                          <div className={`text-sm ${getChangeColor(item.change)}`}>
                            {item.change > 0 ? '+' : ''}{item.change.toFixed(1)} pts
                          </div>
                          <div className="text-xs text-muted-foreground">
                            vs {item.previous.toFixed(1)} (prev month)
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                  <div className="text-xs text-muted-foreground text-center">
                    Current period: {comparison.currentPeriodCount} audits | Previous period: {comparison.previousPeriodCount} audits
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  Insufficient data for month-over-month comparison
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Trend Analysis Insights */}
      {trendAnalysis && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Trend Analysis Insights ({selectedPeriod})
            </CardTitle>
            <CardDescription>
              Automated insights from {selectedPeriod} trend analysis
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Key Insights */}
              <div className="space-y-4">
                <h4 className="font-medium flex items-center gap-2">
                  <Zap className="h-4 w-4" />
                  Key Insights
                </h4>
                {trendAnalysis.keyInsights.length > 0 ? (
                  <div className="space-y-2">
                    {trendAnalysis.keyInsights.map((insight, index) => (
                      <div key={index} className="border rounded p-3">
                        <div className="flex items-center justify-between mb-1">
                          <div className="font-medium text-sm">{insight.category}</div>
                          <Badge variant={
                            insight.impact === 'high' ? 'destructive' :
                            insight.impact === 'medium' ? 'default' :
                            'secondary'
                          }>
                            {insight.impact}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">{insight.insight}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground">No insights available</div>
                )}
              </div>

              {/* Improvements & Regressions */}
              <div className="space-y-4">
                <h4 className="font-medium flex items-center gap-2">
                  <Target className="h-4 w-4" />
                  Changes Summary
                </h4>
                <div className="space-y-3">
                  {trendAnalysis.improvements.length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <CheckCircle className="h-4 w-4 text-green-600" />
                        <span className="text-sm font-medium">Improvements</span>
                      </div>
                      <div className="space-y-1">
                        {trendAnalysis.improvements.map((improvement, index) => (
                          <div key={index} className="flex items-center justify-between text-sm">
                            <span>{improvement.metric}</span>
                            <div className="flex items-center gap-2">
                              <span className="text-green-600">+{improvement.change.toFixed(1)}%</span>
                              <Badge variant="secondary">{improvement.significance}</Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {trendAnalysis.regressions.length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <AlertTriangle className="h-4 w-4 text-red-600" />
                        <span className="text-sm font-medium">Regressions</span>
                      </div>
                      <div className="space-y-1">
                        {trendAnalysis.regressions.map((regression, index) => (
                          <div key={index} className="flex items-center justify-between text-sm">
                            <span>{regression.metric}</span>
                            <div className="flex items-center gap-2">
                              <span className="text-red-600">{regression.change.toFixed(1)}%</span>
                              <Badge variant="secondary">{regression.significance}</Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="pt-2 border-t">
                    <div className="flex items-center justify-between text-sm">
                      <span>Confidence Score</span>
                      <Badge variant="outline">{trendAnalysis.confidenceScore}%</Badge>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}