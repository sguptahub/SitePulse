import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { 
  Search, 
  Users, 
  Plus, 
  Trash2, 
  Play, 
  Trophy, 
  TrendingUp, 
  AlertCircle, 
  BarChart3, 
  Target,
  Link as LinkIcon,
  Medal,
  Award,
  Crown
} from "lucide-react";
import {
  BarChart,
  Bar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell
} from "recharts";
import { Link } from "wouter";
import type { CompetitorSet, Competitor } from "@shared/schema";

interface CompetitiveAnalysis {
  comparisonId: string;
  analysis: {
    competitorSetId: string;
    primaryUrl: string;
    primaryAudit: any;
    competitorAudits: Array<{
      competitor: Competitor;
      audit: any;
    }>;
    rankings: {
      overall: Array<{
        competitorId?: string;
        url: string;
        name?: string;
        score: number;
        rank: number;
        isPrimary: boolean;
      }>;
      seo: Array<any>;
      accessibility: Array<any>;
      mobile: Array<any>;
      performance: Array<any>;
    };
    gapAnalysis: Array<{
      category: string;
      metric: string;
      primaryScore: number;
      competitorScore: number;
      competitorUrl: string;
      gap: number;
      severity: 'critical' | 'high' | 'medium' | 'low';
    }>;
    opportunities: Array<{
      priority: 'critical' | 'high' | 'medium' | 'low';
      category: string;
      title: string;
      description: string;
      impact: string;
      competitorExample: string;
      potentialGain: number;
    }>;
    industryBenchmarks: {
      averageScores: {
        overall: number;
        seo: number;
        accessibility: number;
        mobile: number;
        performance: number;
      };
    };
    analysisDate: string;
  };
}

export default function CompetitiveAnalysis() {
  const [selectedSetId, setSelectedSetId] = useState<string>("");
  const [newSetName, setNewSetName] = useState("");
  const [newSetPrimaryUrl, setNewSetPrimaryUrl] = useState("");
  const [newCompetitorUrl, setNewCompetitorUrl] = useState("");
  const [newCompetitorName, setNewCompetitorName] = useState("");
  const [activeAnalysis, setActiveAnalysis] = useState<CompetitiveAnalysis | null>(null);
  const { toast } = useToast();

  // Fetch competitor sets
  const { data: competitorSets, isLoading: setsLoading } = useQuery<CompetitorSet[]>({
    queryKey: ["/api/competitor-sets"]
  });

  // Fetch competitors for selected set
  const { data: competitors, isLoading: competitorsLoading } = useQuery<Competitor[]>({
    queryKey: ["/api/competitor-sets", selectedSetId, "competitors"],
    enabled: !!selectedSetId
  });

  // Create competitor set mutation
  const createSetMutation = useMutation({
    mutationFn: async (data: { name: string; primaryUrl: string }) => {
      const response = await apiRequest("POST", `/api/competitor-sets`, data);
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/competitor-sets"] });
      setNewSetName("");
      setNewSetPrimaryUrl("");
      toast({
        title: "Success",
        description: "Competitor set created successfully"
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create competitor set",
        variant: "destructive"
      });
    }
  });

  // Add competitor mutation
  const addCompetitorMutation = useMutation({
    mutationFn: async (data: { url: string; name?: string }) => {
      const response = await apiRequest("POST", `/api/competitor-sets/${selectedSetId}/competitors`, data);
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/competitor-sets", selectedSetId, "competitors"] });
      setNewCompetitorUrl("");
      setNewCompetitorName("");
      toast({
        title: "Success", 
        description: "Competitor added successfully"
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to add competitor",
        variant: "destructive"
      });
    }
  });

  // Remove competitor mutation
  const removeCompetitorMutation = useMutation({
    mutationFn: async (competitorId: string) => {
      const response = await apiRequest("DELETE", `/api/competitors/${competitorId}`);
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/competitor-sets", selectedSetId, "competitors"] });
      toast({
        title: "Success",
        description: "Competitor removed successfully" 
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to remove competitor",
        variant: "destructive"
      });
    }
  });

  // Run competitive analysis mutation
  const runAnalysisMutation = useMutation<CompetitiveAnalysis, Error, string>({
    mutationFn: async (setId: string) => {
      const response = await apiRequest("POST", `/api/competitor-sets/${setId}/compare`);
      return await response.json();
    },
    onSuccess: (data: CompetitiveAnalysis) => {
      setActiveAnalysis(data);
      toast({
        title: "Analysis Complete",
        description: "Competitive analysis completed successfully"
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to run competitive analysis",
        variant: "destructive"
      });
    }
  });

  const handleCreateSet = (e: React.FormEvent) => {
    e.preventDefault();
    if (newSetName.trim() && newSetPrimaryUrl.trim()) {
      createSetMutation.mutate({
        name: newSetName.trim(),
        primaryUrl: newSetPrimaryUrl.trim()
      });
    }
  };

  const handleAddCompetitor = (e: React.FormEvent) => {
    e.preventDefault();
    if (newCompetitorUrl.trim()) {
      addCompetitorMutation.mutate({
        url: newCompetitorUrl.trim(),
        name: newCompetitorName.trim() || undefined
      });
    }
  };

  const handleRunAnalysis = () => {
    if (selectedSetId) {
      runAnalysisMutation.mutate(selectedSetId);
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical': return 'bg-red-100 text-red-800';
      case 'high': return 'bg-orange-100 text-orange-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'low': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getRankColor = (rank: number) => {
    switch (rank) {
      case 1: return 'bg-yellow-100 text-yellow-800'; // Gold
      case 2: return 'bg-gray-100 text-gray-800'; // Silver
      case 3: return 'bg-orange-100 text-orange-800'; // Bronze
      default: return 'bg-gray-50 text-gray-600';
    }
  };

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1: return <Crown className="h-5 w-5 text-yellow-600" />;
      case 2: return <Medal className="h-5 w-5 text-gray-600" />;
      case 3: return <Award className="h-5 w-5 text-orange-600" />;
      default: return null;
    }
  };

  const getSafeHostname = (url: string): string => {
    try {
      return new URL(url).hostname;
    } catch {
      // Fallback to domain-like extraction for malformed URLs
      const match = url.match(/(?:https?:\/\/)?(?:www\.)?([^\/:]+)/);
      return match ? match[1] : url;
    }
  };

  const prepareChartData = (analysis: CompetitiveAnalysis['analysis']) => {
    return analysis.rankings.overall.map(ranking => ({
      name: ranking.isPrimary ? 'Your Website' : (ranking.name || getSafeHostname(ranking.url)),
      url: ranking.url,
      overall: ranking.score,
      seo: analysis.rankings.seo.find(s => s.url === ranking.url)?.score || 0,
      accessibility: analysis.rankings.accessibility.find(a => a.url === ranking.url)?.score || 0,
      mobile: analysis.rankings.mobile.find(m => m.url === ranking.url)?.score || 0,
      performance: analysis.rankings.performance.find(p => p.url === ranking.url)?.score || 0,
      isPrimary: ranking.isPrimary,
      rank: ranking.rank
    }));
  };

  const prepareRadarData = (analysis: CompetitiveAnalysis['analysis']) => {
    const primaryData = analysis.rankings.overall.find(r => r.isPrimary);
    if (!primaryData) return [];

    return [
      {
        metric: 'Overall',
        score: primaryData.score,
        fullMark: 100
      },
      {
        metric: 'SEO',
        score: analysis.rankings.seo.find(s => s.isPrimary)?.score || 0,
        fullMark: 100
      },
      {
        metric: 'Accessibility',
        score: analysis.rankings.accessibility.find(a => a.isPrimary)?.score || 0,
        fullMark: 100
      },
      {
        metric: 'Mobile',
        score: analysis.rankings.mobile.find(m => m.isPrimary)?.score || 0,
        fullMark: 100
      },
      {
        metric: 'Performance',
        score: analysis.rankings.performance.find(p => p.isPrimary)?.score || 0,
        fullMark: 100
      }
    ];
  };

  return (
    <div className="min-h-screen bg-background text-foreground font-sans">
      {/* Header */}
      <header className="bg-card border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="bg-primary text-primary-foreground rounded-lg p-2">
                <Users className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-foreground">Competitive Analysis</h1>
                <p className="text-muted-foreground">Compare your website against competitors</p>
              </div>
            </div>
            <div className="hidden sm:flex items-center space-x-3">
              <Link href="/">
                <div className="group bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:border-primary/20 dark:hover:border-primary/30 shadow-sm hover:shadow-md px-4 py-2 rounded-lg text-sm font-medium cursor-pointer transition-all duration-200 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                  <div className="flex items-center space-x-2 text-gray-700 dark:text-gray-300 group-hover:text-primary">
                    <Search className="h-4 w-4" />
                    <span>Single Analysis</span>
                  </div>
                </div>
              </Link>
              <Link href="/bulk-analysis">
                <div className="group bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:border-primary/20 dark:hover:border-primary/30 shadow-sm hover:shadow-md px-4 py-2 rounded-lg text-sm font-medium cursor-pointer transition-all duration-200 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                  <div className="flex items-center space-x-2 text-gray-700 dark:text-gray-300 group-hover:text-primary">
                    <BarChart3 className="h-4 w-4" />
                    <span>Bulk Analysis</span>
                  </div>
                </div>
              </Link>
              <Link href="/historical-dashboard">
                <div className="group bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:border-primary/20 dark:hover:border-primary/30 shadow-sm hover:shadow-md px-4 py-2 rounded-lg text-sm font-medium cursor-pointer transition-all duration-200 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                  <div className="flex items-center space-x-2 text-gray-700 dark:text-gray-300 group-hover:text-primary">
                    <BarChart3 className="h-4 w-4" />
                    <span>Historical Dashboard</span>
                  </div>
                </div>
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Create New Competitor Set */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Plus className="h-5 w-5 mr-2" />
              Create Competitor Set
            </CardTitle>
            <CardDescription>
              Start by creating a new competitor set with your primary website
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreateSet} className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="set-name">Set Name</Label>
                <Input
                  id="set-name"
                  data-testid="input-set-name"
                  placeholder="e.g., E-commerce Competitors"
                  value={newSetName}
                  onChange={(e) => setNewSetName(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="primary-url">Your Website URL</Label>
                <Input
                  id="primary-url"
                  data-testid="input-primary-url"
                  type="url"
                  placeholder="https://yourwebsite.com"
                  value={newSetPrimaryUrl}
                  onChange={(e) => setNewSetPrimaryUrl(e.target.value)}
                  required
                />
              </div>
              <div className="flex items-end">
                <Button
                  type="submit"
                  data-testid="button-create-set"
                  disabled={createSetMutation.isPending}
                  className="w-full"
                >
                  {createSetMutation.isPending ? "Creating..." : "Create Set"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Competitor Set Selection & Management */}
          <div className="space-y-6">
            {/* Select Competitor Set */}
            <Card>
              <CardHeader>
                <CardTitle>Select Competitor Set</CardTitle>
                <CardDescription>Choose a competitor set to manage</CardDescription>
              </CardHeader>
              <CardContent>
                {setsLoading ? (
                  <div className="text-center py-4">Loading competitor sets...</div>
                ) : !competitorSets || competitorSets.length === 0 ? (
                  <div className="text-center py-4 text-muted-foreground">
                    No competitor sets found. Create one above to get started.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {competitorSets.map((set) => (
                      <div
                        key={set.id}
                        className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                          selectedSetId === set.id
                            ? 'border-primary bg-primary/5'
                            : 'border-border hover:border-primary/50'
                        }`}
                        onClick={() => setSelectedSetId(set.id)}
                        data-testid={`set-${set.id}`}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <h3 className="font-medium">{set.name}</h3>
                            <p className="text-sm text-muted-foreground">
                              <LinkIcon className="h-3 w-3 inline mr-1" />
                              {set.primaryUrl}
                            </p>
                          </div>
                          <Badge variant="secondary">
                            {competitors?.length || 0} competitors
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Add Competitors */}
            {selectedSetId && (
              <Card>
                <CardHeader>
                  <CardTitle>Add Competitors</CardTitle>
                  <CardDescription>Add competitor websites to analyze</CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleAddCompetitor} className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="competitor-url">Competitor URL</Label>
                        <Input
                          id="competitor-url"
                          data-testid="input-competitor-url"
                          type="url"
                          placeholder="https://competitor.com"
                          value={newCompetitorUrl}
                          onChange={(e) => setNewCompetitorUrl(e.target.value)}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="competitor-name">Name (Optional)</Label>
                        <Input
                          id="competitor-name"
                          data-testid="input-competitor-name"
                          placeholder="Competitor Name"
                          value={newCompetitorName}
                          onChange={(e) => setNewCompetitorName(e.target.value)}
                        />
                      </div>
                    </div>
                    <Button
                      type="submit"
                      data-testid="button-add-competitor"
                      disabled={addCompetitorMutation.isPending}
                      className="w-full"
                    >
                      {addCompetitorMutation.isPending ? "Adding..." : "Add Competitor"}
                    </Button>
                  </form>

                  {/* Competitors List */}
                  {competitorsLoading ? (
                    <div className="text-center py-4 mt-6">Loading competitors...</div>
                  ) : competitors && competitors.length > 0 ? (
                    <div className="mt-6 space-y-2">
                      <h4 className="font-medium">Current Competitors</h4>
                      {competitors.map((competitor) => (
                        <div
                          key={competitor.id}
                          className="flex items-center justify-between p-3 border rounded-lg"
                          data-testid={`competitor-${competitor.id}`}
                        >
                          <div>
                            <p className="font-medium">{competitor.name || "Unnamed Competitor"}</p>
                            <p className="text-sm text-muted-foreground">{competitor.url}</p>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            data-testid={`button-remove-${competitor.id}`}
                            onClick={() => removeCompetitorMutation.mutate(competitor.id)}
                            disabled={removeCompetitorMutation.isPending}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-4 mt-6 text-muted-foreground">
                      No competitors added yet
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>

          {/* Run Analysis & Results */}
          <div className="space-y-6">
            {/* Run Analysis */}
            {selectedSetId && competitors && competitors.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Run Competitive Analysis</CardTitle>
                  <CardDescription>
                    Analyze your website against all competitors
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button
                    onClick={handleRunAnalysis}
                    data-testid="button-run-analysis"
                    disabled={runAnalysisMutation.isPending}
                    className="w-full"
                    size="lg"
                  >
                    {runAnalysisMutation.isPending ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                        Running Analysis...
                      </>
                    ) : (
                      <>
                        <Play className="h-4 w-4 mr-2" />
                        Run Analysis
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Analysis Results */}
            {activeAnalysis && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Trophy className="h-5 w-5 mr-2" />
                    Analysis Results
                  </CardTitle>
                  <CardDescription>
                    Competitive analysis completed on {new Date(activeAnalysis.analysis.analysisDate).toLocaleDateString()}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-8">
                  {/* Enhanced Rankings with Medal Icons */}
                  <div>
                    <h4 className="font-medium mb-4 flex items-center">
                      <Trophy className="h-5 w-5 mr-2" />
                      Competitive Rankings
                    </h4>
                    <div className="space-y-3">
                      {activeAnalysis.analysis.rankings.overall.map((ranking) => (
                        <div
                          key={ranking.url}
                          className={`p-4 rounded-lg border-2 transition-all ${
                            ranking.isPrimary 
                              ? 'border-primary bg-primary/5 shadow-sm' 
                              : ranking.rank <= 3 
                              ? 'border-yellow-200 bg-yellow-50/50' 
                              : 'border-border hover:border-primary/30'
                          }`}
                          data-testid={`ranking-${ranking.rank}`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-3">
                              {getRankIcon(ranking.rank)}
                              <div>
                                <p className="font-semibold flex items-center">
                                  {ranking.isPrimary ? "🏠 Your Website" : ranking.name || "🌐 Competitor"}
                                  {ranking.isPrimary && <Badge className="ml-2" variant="secondary">YOU</Badge>}
                                </p>
                                <p className="text-sm text-muted-foreground">{ranking.url}</p>
                              </div>
                            </div>
                            <div className="flex items-center space-x-3">
                              <div className="text-right">
                                <div className="text-2xl font-bold">{ranking.score}</div>
                                <div className="text-xs text-muted-foreground">out of 100</div>
                              </div>
                              <Badge className={getRankColor(ranking.rank)} variant="outline">
                                #{ranking.rank}
                              </Badge>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <Separator />

                  {/* Competitive Score Comparison Chart */}
                  <div>
                    <h4 className="font-medium mb-4 flex items-center">
                      <BarChart3 className="h-5 w-5 mr-2" />
                      Score Comparison
                    </h4>
                    <div className="h-80 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        {(() => {
                          const chartData = prepareChartData(activeAnalysis.analysis);
                          return (
                            <BarChart
                              data={chartData}
                              margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                            >
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis 
                                dataKey="name" 
                                angle={-45}
                                textAnchor="end"
                                height={80}
                                fontSize={12}
                              />
                              <YAxis domain={[0, 100]} />
                              <Tooltip />
                              <Bar dataKey="overall" fill="#3b82f6" name="Overall Score">
                                {chartData.map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={entry.isPrimary ? "#10b981" : "#3b82f6"} />
                                ))}
                              </Bar>
                            </BarChart>
                          );
                        })()}
                      </ResponsiveContainer>
                    </div>
                  </div>

                  <Separator />

                  {/* Multi-dimensional Radar Chart */}
                  <div>
                    <h4 className="font-medium mb-4 flex items-center">
                      <Target className="h-5 w-5 mr-2" />
                      Your Performance Profile
                    </h4>
                    <div className="h-80 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <RadarChart data={prepareRadarData(activeAnalysis.analysis)}>
                          <PolarGrid />
                          <PolarAngleAxis dataKey="metric" />
                          <PolarRadiusAxis 
                            angle={90} 
                            domain={[0, 100]}
                            tick={false}
                          />
                          <Radar
                            name="Your Score"
                            dataKey="score"
                            stroke="#10b981"
                            fill="#10b981"
                            fillOpacity={0.3}
                            strokeWidth={2}
                          />
                          <Tooltip />
                        </RadarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  <Separator />

                  {/* Enhanced Industry Benchmarks */}
                  <div>
                    <h4 className="font-medium mb-4 flex items-center">
                      <Target className="h-5 w-5 mr-2" />
                      Industry Benchmarks
                    </h4>
                    <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                      <div className="text-center p-4 border-2 rounded-lg bg-gradient-to-br from-blue-50 to-blue-100">
                        <div className="text-3xl font-bold text-blue-600 mb-1">
                          {activeAnalysis.analysis.industryBenchmarks.averageScores.overall}
                        </div>
                        <div className="text-sm font-medium text-blue-800">Overall Avg</div>
                        <div className="text-xs text-muted-foreground mt-1">Industry Standard</div>
                      </div>
                      <div className="text-center p-4 border-2 rounded-lg bg-gradient-to-br from-purple-50 to-purple-100">
                        <div className="text-3xl font-bold text-purple-600 mb-1">
                          {activeAnalysis.analysis.industryBenchmarks.averageScores.seo}
                        </div>
                        <div className="text-sm font-medium text-purple-800">SEO Avg</div>
                        <div className="text-xs text-muted-foreground mt-1">Search Rankings</div>
                      </div>
                      <div className="text-center p-4 border-2 rounded-lg bg-gradient-to-br from-green-50 to-green-100">
                        <div className="text-3xl font-bold text-green-600 mb-1">
                          {activeAnalysis.analysis.industryBenchmarks.averageScores.accessibility}
                        </div>
                        <div className="text-sm font-medium text-green-800">A11y Avg</div>
                        <div className="text-xs text-muted-foreground mt-1">WCAG Compliance</div>
                      </div>
                      <div className="text-center p-4 border-2 rounded-lg bg-gradient-to-br from-orange-50 to-orange-100">
                        <div className="text-3xl font-bold text-orange-600 mb-1">
                          {activeAnalysis.analysis.industryBenchmarks.averageScores.mobile}
                        </div>
                        <div className="text-sm font-medium text-orange-800">Mobile Avg</div>
                        <div className="text-xs text-muted-foreground mt-1">Mobile UX</div>
                      </div>
                      <div className="text-center p-4 border-2 rounded-lg bg-gradient-to-br from-red-50 to-red-100">
                        <div className="text-3xl font-bold text-red-600 mb-1">
                          {activeAnalysis.analysis.industryBenchmarks.averageScores.performance}
                        </div>
                        <div className="text-sm font-medium text-red-800">Perf Avg</div>
                        <div className="text-xs text-muted-foreground mt-1">Load Speed</div>
                      </div>
                    </div>
                  </div>

                  <Separator />

                  {/* Top Opportunities */}
                  <div>
                    <h4 className="font-medium mb-3 flex items-center">
                      <TrendingUp className="h-4 w-4 mr-2" />
                      Top Opportunities
                    </h4>
                    <div className="space-y-3">
                      {activeAnalysis.analysis.opportunities.slice(0, 3).map((opportunity, index) => (
                        <div
                          key={index}
                          className="p-4 border rounded-lg space-y-2"
                          data-testid={`opportunity-${index}`}
                        >
                          <div className="flex items-start justify-between">
                            <h5 className="font-medium">{opportunity.title}</h5>
                            <Badge className={getPriorityColor(opportunity.priority)}>
                              {opportunity.priority}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {opportunity.description}
                          </p>
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-green-600">+{opportunity.potentialGain} points</span>
                            <span className="text-muted-foreground">
                              Example: {getSafeHostname(opportunity.competitorExample)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-card border-t border-border mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="bg-primary text-primary-foreground rounded-lg p-2">
                <Users className="h-4 w-4" />
              </div>
              <div>
                <p className="font-medium">Competitive Analysis Tool</p>
                <p className="text-sm text-muted-foreground">Professional competitive intelligence tool</p>
              </div>
            </div>
            <div className="flex items-center space-x-4 text-sm text-muted-foreground">
              <span>Advanced Competitive Intelligence</span>
              <span>•</span>
              <span>Actionable Insights</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}