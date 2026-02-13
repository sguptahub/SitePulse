import { PerformanceHistory, TrendAnalysis, InsertTrendAnalysis, TrendInsight, SignificantChange, HistoricalRecommendation } from "@shared/schema";
import type { IStorage } from "../storage";

interface TrendAnalysisParams {
  timePeriod: '7d' | '30d' | '90d' | '1y';
  minimumDataPoints: number;
  significanceThreshold: number;
}

export class HistoricalInsightsService {
  private storage: IStorage;

  // Trend detection parameters for different time periods
  private readonly TREND_PARAMS: Record<'7d' | '30d' | '90d' | '1y', TrendAnalysisParams> = {
    '7d': { timePeriod: '7d', minimumDataPoints: 3, significanceThreshold: 5 },
    '30d': { timePeriod: '30d', minimumDataPoints: 5, significanceThreshold: 8 },
    '90d': { timePeriod: '90d', minimumDataPoints: 8, significanceThreshold: 10 },
    '1y': { timePeriod: '1y', minimumDataPoints: 12, significanceThreshold: 15 }
  };

  constructor(storage: IStorage) {
    this.storage = storage;
  }

  /**
   * Generate comprehensive trend analysis for a given historical tracking
   */
  async generateTrendAnalysis(trackingId: string, timePeriod: '7d' | '30d' | '90d' | '1y'): Promise<TrendAnalysis> {
    const params = this.TREND_PARAMS[timePeriod];
    
    // Get historical performance data for the specified period
    const dateRange = this.calculateDateRange(timePeriod);
    const performanceHistory = await this.storage.getPerformanceHistoryByDateRange(
      trackingId, 
      dateRange.startDate, 
      dateRange.endDate
    );

    // Generate analysis if we have sufficient data
    if (performanceHistory.length < params.minimumDataPoints) {
      return this.createInsufficientDataAnalysis(trackingId, timePeriod);
    }

    // Perform comprehensive trend analysis
    const overallTrend = this.detectOverallTrend(performanceHistory);
    const trendStrength = this.calculateTrendStrength(performanceHistory, overallTrend);
    const keyInsights = await this.generateKeyInsights(performanceHistory, timePeriod);
    const improvements = this.identifyImprovements(performanceHistory, params.significanceThreshold);
    const regressions = this.identifyRegressions(performanceHistory, params.significanceThreshold);
    const recommendations = await this.generateRecommendations(performanceHistory, improvements, regressions);
    const confidenceScore = this.calculateConfidenceScore(performanceHistory, timePeriod);

    const analysisData: InsertTrendAnalysis = {
      historicalTrackingId: trackingId,
      timePeriod,
      overallTrend,
      trendStrength,
      keyInsights,
      improvements,
      regressions,
      recommendations,
      confidenceScore
    };

    return await this.storage.createOrUpdateTrendAnalysis(analysisData);
  }

  /**
   * Automatically trigger trend analysis when new audit data is recorded
   */
  async onNewAuditRecorded(trackingId: string): Promise<void> {
    // Generate fresh analysis for all time periods in parallel
    const timePeriods: Array<'7d' | '30d' | '90d' | '1y'> = ['7d', '30d', '90d', '1y'];
    
    await Promise.all(timePeriods.map(async (period) => {
      try {
        await this.generateTrendAnalysis(trackingId, period);
      } catch (error) {
        console.error(`Failed to generate ${period} trend analysis for tracking ${trackingId}:`, error);
      }
    }));
  }

  /**
   * Detect overall trend direction across all metrics
   */
  private detectOverallTrend(history: PerformanceHistory[]): 'improving' | 'declining' | 'stable' {
    if (history.length < 2) return 'stable';

    const sortedHistory = [...history].sort((a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime());
    const recentHalf = sortedHistory.slice(Math.ceil(sortedHistory.length / 2));
    const earlierHalf = sortedHistory.slice(0, Math.floor(sortedHistory.length / 2));

    const recentAverage = this.calculateAverageScores(recentHalf);
    const earlierAverage = this.calculateAverageScores(earlierHalf);

    const overallChange = recentAverage.overall - earlierAverage.overall;
    
    if (overallChange >= 5) return 'improving';
    if (overallChange <= -5) return 'declining';
    return 'stable';
  }

  /**
   * Calculate trend strength based on consistency and magnitude of changes
   */
  private calculateTrendStrength(history: PerformanceHistory[], trend: 'improving' | 'declining' | 'stable'): 'weak' | 'moderate' | 'strong' {
    if (trend === 'stable') return 'weak';

    const changes = this.calculateConsecutiveChanges(history);
    const consistencyScore = this.calculateConsistencyScore(changes, trend);
    const magnitudeScore = this.calculateMagnitudeScore(changes);

    const strengthScore = (consistencyScore + magnitudeScore) / 2;

    if (strengthScore >= 75) return 'strong';
    if (strengthScore >= 50) return 'moderate';
    return 'weak';
  }

  /**
   * Generate intelligent key insights based on performance patterns
   */
  private async generateKeyInsights(history: PerformanceHistory[], timePeriod: '7d' | '30d' | '90d' | '1y'): Promise<TrendInsight[]> {
    const insights: TrendInsight[] = [];
    
    // Performance velocity insight
    const velocityInsight = this.analyzePerformanceVelocity(history, timePeriod);
    if (velocityInsight) insights.push(velocityInsight);

    // Score consistency insight  
    const consistencyInsight = this.analyzeScoreConsistency(history);
    if (consistencyInsight) insights.push(consistencyInsight);

    // Metric correlation insight
    const correlationInsight = this.analyzeMetricCorrelations(history);
    if (correlationInsight) insights.push(correlationInsight);

    // Recent changes insight
    const recentChangesInsight = this.analyzeRecentChanges(history);
    if (recentChangesInsight) insights.push(recentChangesInsight);

    // Performance stability insight
    const stabilityInsight = this.analyzePerformanceStability(history);
    if (stabilityInsight) insights.push(stabilityInsight);

    return insights;
  }

  /**
   * Identify significant improvements across all metrics
   */
  private identifyImprovements(history: PerformanceHistory[], threshold: number): SignificantChange[] {
    if (history.length < 2) return [];

    const sortedHistory = [...history].sort((a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime());
    const recentAvg = this.calculateAverageScores(sortedHistory.slice(-5)); // Last 5 audits
    const baselineAvg = this.calculateAverageScores(sortedHistory.slice(0, 5)); // First 5 audits

    const improvements: SignificantChange[] = [];

    // Check each metric for improvements
    const metrics = [
      { name: 'Overall', recent: recentAvg.overall, baseline: baselineAvg.overall },
      { name: 'SEO', recent: recentAvg.seo, baseline: baselineAvg.seo },
      { name: 'Accessibility', recent: recentAvg.accessibility, baseline: baselineAvg.accessibility },
      { name: 'Mobile', recent: recentAvg.mobile, baseline: baselineAvg.mobile },
      { name: 'Performance', recent: recentAvg.performance, baseline: baselineAvg.performance }
    ];

    for (const metric of metrics) {
      if (metric.recent === null || metric.baseline === null) continue;
      
      const change = metric.recent - metric.baseline;
      const percentage = metric.baseline > 0 ? (change / metric.baseline) * 100 : 0;

      if (change >= threshold) {
        improvements.push({
          category: this.metricNameToCategory(metric.name),
          type: 'improvement',
          magnitude: this.classifyMagnitude(Math.abs(change), threshold),
          scoreChange: Math.round(change * 100) / 100,
          percentageChange: Math.round(percentage * 100) / 100,
          description: `${metric.name} improved by ${Math.round(change * 100) / 100} points (${Math.round(percentage * 100) / 100}%)`,
          impact: `Positive change in ${metric.name} performance indicates successful optimization efforts`,
          possibleCauses: this.generatePossibleCauses(metric.name, 'improvement')
        });
      }
    }

    return improvements;
  }

  /**
   * Identify significant regressions across all metrics
   */
  private identifyRegressions(history: PerformanceHistory[], threshold: number): SignificantChange[] {
    if (history.length < 2) return [];

    const sortedHistory = [...history].sort((a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime());
    const recentAvg = this.calculateAverageScores(sortedHistory.slice(-5));
    const baselineAvg = this.calculateAverageScores(sortedHistory.slice(0, 5));

    const regressions: SignificantChange[] = [];

    const metrics = [
      { name: 'Overall', recent: recentAvg.overall, baseline: baselineAvg.overall },
      { name: 'SEO', recent: recentAvg.seo, baseline: baselineAvg.seo },
      { name: 'Accessibility', recent: recentAvg.accessibility, baseline: baselineAvg.accessibility },
      { name: 'Mobile', recent: recentAvg.mobile, baseline: baselineAvg.mobile },
      { name: 'Performance', recent: recentAvg.performance, baseline: baselineAvg.performance }
    ];

    for (const metric of metrics) {
      if (metric.recent === null || metric.baseline === null) continue;
      
      const change = metric.recent - metric.baseline;
      const percentage = metric.baseline > 0 ? (change / metric.baseline) * 100 : 0;

      if (change <= -threshold) {
        regressions.push({
          category: this.metricNameToCategory(metric.name),
          type: 'regression',
          magnitude: this.classifyMagnitude(Math.abs(change), threshold),
          scoreChange: Math.round(change * 100) / 100,
          percentageChange: Math.round(percentage * 100) / 100,
          description: `${metric.name} declined by ${Math.abs(Math.round(change * 100) / 100)} points (${Math.abs(Math.round(percentage * 100) / 100)}%)`,
          impact: `Negative change in ${metric.name} performance requires attention and optimization`,
          possibleCauses: this.generatePossibleCauses(metric.name, 'regression')
        });
      }
    }

    return regressions;
  }

  /**
   * Generate actionable recommendations based on analysis
   */
  private async generateRecommendations(
    history: PerformanceHistory[],
    improvements: SignificantChange[],
    regressions: SignificantChange[]
  ): Promise<HistoricalRecommendation[]> {
    const recommendations: HistoricalRecommendation[] = [];

    // Critical regression recommendations
    const criticalRegressions = regressions.filter(r => r.magnitude === 'major');
    for (const regression of criticalRegressions) {
      recommendations.push({
        priority: 'critical',
        category: 'trend-reversal',
        title: `${this.categoryToMetricName(regression.category)} Recovery Required`,
        description: `Immediately investigate and address the ${regression.scoreChange.toFixed(1)} point decline in ${this.categoryToMetricName(regression.category)} scores`,
        expectedImpact: `Restore ${this.categoryToMetricName(regression.category)} performance to prevent further degradation`,
        effort: this.estimateEffortLevel(this.categoryToMetricName(regression.category)),
        timeframe: 'immediate',
        basedOn: [`High-impact regression in ${this.categoryToMetricName(regression.category)} performance`]
      });
    }

    // Leverage successful improvements
    const significantImprovements = improvements.filter(i => i.magnitude === 'major');
    for (const improvement of significantImprovements) {
      recommendations.push({
        priority: 'medium',
        category: 'optimization',
        title: `Scale ${this.categoryToMetricName(improvement.category)} Success`,
        description: `Scale the successful strategies that improved ${this.categoryToMetricName(improvement.category)} by ${improvement.scoreChange.toFixed(1)} points`,
        expectedImpact: `Apply proven optimization patterns to other performance areas`,
        effort: 'low',
        timeframe: 'short-term',
        basedOn: [`Successful optimization in ${this.categoryToMetricName(improvement.category)} performance`]
      });
    }

    // Stability recommendations
    if (this.detectVolatility(history)) {
      recommendations.push({
        priority: 'high',
        category: 'optimization',
        title: 'Improve Performance Stability',
        description: 'Implement consistent optimization practices to reduce performance volatility',
        expectedImpact: 'Achieve more predictable and stable website performance metrics',
        effort: 'medium',
        timeframe: 'short-term',
        basedOn: ['High performance volatility detected', 'Inconsistent score patterns']
      });
    }

    // Long-term strategy recommendations
    if (history.length >= 10) {
      const trend = this.detectLongTermTrend(history);
      if (trend === 'plateauing') {
        recommendations.push({
          priority: 'medium',
          category: 'optimization',
          title: 'Performance Innovation Strategy',
          description: 'Explore new optimization techniques to break through current performance plateau',
          expectedImpact: 'Unlock the next level of website performance improvements',
          effort: 'high',
          timeframe: 'long-term',
          basedOn: ['Performance plateau pattern detected', 'Long-term stagnation in improvements']
        });
      }
    }

    return recommendations.slice(0, 5); // Limit to top 5 recommendations
  }

  /**
   * Calculate confidence score based on data quality and quantity
   */
  private calculateConfidenceScore(history: PerformanceHistory[], timePeriod: '7d' | '30d' | '90d' | '1y'): number {
    let confidence = 0;

    // Data quantity factor (30% of score)
    const minRequired = this.TREND_PARAMS[timePeriod].minimumDataPoints;
    const dataQuantityScore = Math.min(100, (history.length / (minRequired * 2)) * 100);
    confidence += dataQuantityScore * 0.3;

    // Data consistency factor (25% of score)
    const consistencyScore = this.calculateDataConsistency(history);
    confidence += consistencyScore * 0.25;

    // Time span coverage (25% of score)
    const timeSpanScore = this.calculateTimeSpanCoverage(history, timePeriod);
    confidence += timeSpanScore * 0.25;

    // Data freshness (20% of score)
    const freshnessScore = this.calculateDataFreshness(history);
    confidence += freshnessScore * 0.2;

    return Math.round(Math.max(0, Math.min(100, confidence)));
  }

  // Helper methods for advanced analysis

  private calculateDateRange(timePeriod: '7d' | '30d' | '90d' | '1y'): { startDate: Date, endDate: Date } {
    const endDate = new Date();
    const startDate = new Date();

    switch (timePeriod) {
      case '7d':
        startDate.setDate(endDate.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(endDate.getDate() - 30);
        break;
      case '90d':
        startDate.setDate(endDate.getDate() - 90);
        break;
      case '1y':
        startDate.setFullYear(endDate.getFullYear() - 1);
        break;
    }

    return { startDate, endDate };
  }

  private calculateAverageScores(history: PerformanceHistory[]): {
    overall: number,
    seo: number | null,
    accessibility: number | null,
    mobile: number | null,
    performance: number | null
  } {
    if (history.length === 0) {
      return { overall: 0, seo: null, accessibility: null, mobile: null, performance: null };
    }

    const totals = {
      overall: 0,
      seo: 0,
      accessibility: 0,
      mobile: 0,
      performance: 0
    };

    const counts = {
      overall: 0,
      seo: 0,
      accessibility: 0,
      mobile: 0,
      performance: 0
    };

    for (const record of history) {
      totals.overall += record.overallScore;
      counts.overall++;

      if (record.seoScore !== null) {
        totals.seo += record.seoScore;
        counts.seo++;
      }
      if (record.accessibilityScore !== null) {
        totals.accessibility += record.accessibilityScore;
        counts.accessibility++;
      }
      if (record.mobileScore !== null) {
        totals.mobile += record.mobileScore;
        counts.mobile++;
      }
      if (record.performanceScore !== null) {
        totals.performance += record.performanceScore;
        counts.performance++;
      }
    }

    return {
      overall: totals.overall / counts.overall,
      seo: counts.seo > 0 ? totals.seo / counts.seo : null,
      accessibility: counts.accessibility > 0 ? totals.accessibility / counts.accessibility : null,
      mobile: counts.mobile > 0 ? totals.mobile / counts.mobile : null,
      performance: counts.performance > 0 ? totals.performance / counts.performance : null
    };
  }

  private calculateConsecutiveChanges(history: PerformanceHistory[]): number[] {
    if (history.length < 2) return [];

    const sortedHistory = [...history].sort((a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime());
    const changes: number[] = [];

    for (let i = 1; i < sortedHistory.length; i++) {
      const change = sortedHistory[i].overallScore - sortedHistory[i - 1].overallScore;
      changes.push(change);
    }

    return changes;
  }

  private calculateConsistencyScore(changes: number[], trend: 'improving' | 'declining'): number {
    if (changes.length === 0) return 0;

    const expectedDirection = trend === 'improving' ? 1 : -1;
    let consistentChanges = 0;

    for (const change of changes) {
      if ((change > 0 && expectedDirection > 0) || (change < 0 && expectedDirection < 0)) {
        consistentChanges++;
      }
    }

    return (consistentChanges / changes.length) * 100;
  }

  private calculateMagnitudeScore(changes: number[]): number {
    if (changes.length === 0) return 0;

    const averageMagnitude = changes.reduce((sum, change) => sum + Math.abs(change), 0) / changes.length;
    return Math.min(100, averageMagnitude * 5); // Scale magnitude to 0-100
  }

  private classifySignificance(change: number, threshold: number): 'high' | 'medium' | 'low' {
    if (change >= threshold * 2) return 'high';
    if (change >= threshold * 1.5) return 'medium';
    return 'low';
  }

  private analyzePerformanceVelocity(history: PerformanceHistory[], timePeriod: string): TrendInsight | null {
    if (history.length < 3) return null;

    const changes = this.calculateConsecutiveChanges(history);
    const recentChanges = changes.slice(-3); // Last 3 changes
    const averageChange = recentChanges.reduce((sum, change) => sum + change, 0) / recentChanges.length;

    if (Math.abs(averageChange) < 2) return null;

    const velocity = averageChange > 0 ? 'accelerating' : 'decelerating';
    const impact = Math.abs(averageChange) >= 5 ? 'high' : Math.abs(averageChange) >= 3 ? 'medium' : 'low';

    return {
      type: 'pattern',
      category: 'overall',
      title: 'Performance Velocity Analysis',
      description: `Website performance is ${velocity} with an average change of ${averageChange.toFixed(1)} points per audit over the ${timePeriod} period`,
      impact,
      timeframe: timePeriod,
      confidence: Math.min(100, recentChanges.length * 25),
      dataSupport: [`${recentChanges.length} recent audit data points`, `Average change: ${averageChange.toFixed(1)} points`]
    };
  }

  private analyzeScoreConsistency(history: PerformanceHistory[]): TrendInsight | null {
    if (history.length < 5) return null;

    const scores = history.map(h => h.overallScore);
    const mean = scores.reduce((sum, score) => sum + score, 0) / scores.length;
    const variance = scores.reduce((sum, score) => sum + Math.pow(score - mean, 2), 0) / scores.length;
    const standardDeviation = Math.sqrt(variance);

    const consistencyLevel = standardDeviation <= 5 ? 'highly consistent' : 
                            standardDeviation <= 10 ? 'moderately consistent' : 'highly variable';

    const impact = standardDeviation <= 5 ? 'low' : standardDeviation <= 10 ? 'medium' : 'high';

    return {
      type: 'pattern',
      category: 'overall',
      title: 'Performance Consistency Assessment',
      description: `Performance scores show ${consistencyLevel} patterns with a standard deviation of ${standardDeviation.toFixed(1)} points`,
      impact,
      timeframe: 'overall-period',
      confidence: Math.min(100, history.length * 10),
      dataSupport: [`${history.length} performance data points`, `Standard deviation: ${standardDeviation.toFixed(1)} points`]
    };
  }

  private analyzeMetricCorrelations(history: PerformanceHistory[]): TrendInsight | null {
    if (history.length < 5) return null;

    // Find strongest correlation between metrics
    const correlations = this.calculateMetricCorrelations(history);
    const strongestCorrelation = Object.entries(correlations).reduce((max, [key, value]) => 
      Math.abs(value) > Math.abs(max.value) ? { key, value } : max,
      { key: '', value: 0 }
    );

    if (Math.abs(strongestCorrelation.value) < 0.6) return null;

    const relationship = strongestCorrelation.value > 0 ? 'positive' : 'negative';
    const strength = Math.abs(strongestCorrelation.value) >= 0.8 ? 'strong' : 'moderate';

    return {
      type: 'pattern',
      category: 'overall',
      title: 'Metric Correlation Analysis',
      description: `${strongestCorrelation.key} shows a ${strength} ${relationship} correlation (${(strongestCorrelation.value * 100).toFixed(0)}%), indicating interdependent performance factors`,
      impact: Math.abs(strongestCorrelation.value) >= 0.8 ? 'high' : 'medium',
      timeframe: 'historical-analysis',
      confidence: Math.min(100, history.length * 12),
      dataSupport: [`Correlation coefficient: ${strongestCorrelation.value.toFixed(3)}`, `Analysis of ${history.length} data points`]
    };
  }

  private analyzeRecentChanges(history: PerformanceHistory[]): TrendInsight | null {
    if (history.length < 3) return null;

    const sortedHistory = [...history].sort((a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime());
    const recent = sortedHistory.slice(-2);
    const change = recent[1].overallScore - recent[0].overallScore;

    if (Math.abs(change) < 3) return null;

    const direction = change > 0 ? 'improved' : 'declined';
    const magnitude = Math.abs(change) >= 10 ? 'significantly' : Math.abs(change) >= 5 ? 'moderately' : 'slightly';
    const impact = Math.abs(change) >= 10 ? 'high' : Math.abs(change) >= 5 ? 'medium' : 'low';

    return {
      type: change > 0 ? 'improvement' : 'regression',
      category: 'overall',
      title: 'Recent Performance Change',
      description: `Latest audit shows performance ${magnitude} ${direction} by ${Math.abs(change).toFixed(1)} points compared to previous assessment`,
      impact,
      timeframe: 'latest-audit',
      confidence: 95,
      dataSupport: [`Latest two audit comparisons`, `Score change: ${change.toFixed(1)} points`]
    };
  }

  private analyzePerformanceStability(history: PerformanceHistory[]): TrendInsight | null {
    if (history.length < 8) return null;

    const volatility = this.calculateVolatilityScore(history);
    const stabilityLevel = volatility <= 15 ? 'highly stable' : volatility <= 25 ? 'moderately stable' : 'unstable';
    const impact = volatility <= 15 ? 'low' : volatility <= 25 ? 'medium' : 'high';

    return {
      type: 'pattern',
      category: 'overall',
      title: 'Performance Stability Assessment',
      description: `Performance shows ${stabilityLevel} patterns with a volatility score of ${volatility.toFixed(1)}%, indicating ${stabilityLevel.includes('stable') ? 'consistent' : 'unpredictable'} optimization results`,
      impact,
      timeframe: 'historical-period',
      confidence: Math.min(100, history.length * 8),
      dataSupport: [`${history.length} historical data points`, `Volatility score: ${volatility.toFixed(1)}%`]
    };
  }

  private estimateEffortLevel(metric: string): 'low' | 'medium' | 'high' {
    const effortMap: Record<string, 'low' | 'medium' | 'high'> = {
      'SEO': 'medium',
      'Accessibility': 'high',
      'Mobile': 'medium', 
      'Performance': 'high',
      'Overall': 'medium'
    };
    return effortMap[metric] || 'medium';
  }

  private detectVolatility(history: PerformanceHistory[]): boolean {
    return this.calculateVolatilityScore(history) > 25;
  }

  private calculateVolatilityScore(history: PerformanceHistory[]): number {
    if (history.length < 3) return 0;

    const changes = this.calculateConsecutiveChanges(history);
    const averageChange = changes.reduce((sum, change) => sum + Math.abs(change), 0) / changes.length;
    
    return averageChange * 2; // Convert to percentage-like score
  }

  private detectLongTermTrend(history: PerformanceHistory[]): 'improving' | 'declining' | 'stable' | 'plateauing' {
    if (history.length < 10) return 'stable';

    const sortedHistory = [...history].sort((a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime());
    const firstQuarter = sortedHistory.slice(0, Math.floor(sortedHistory.length / 4));
    const lastQuarter = sortedHistory.slice(-Math.floor(sortedHistory.length / 4));

    const firstAvg = this.calculateAverageScores(firstQuarter);
    const lastAvg = this.calculateAverageScores(lastQuarter);
    
    const longTermChange = lastAvg.overall - firstAvg.overall;
    const recentVolatility = this.calculateVolatilityScore(lastQuarter);

    if (Math.abs(longTermChange) < 3 && recentVolatility < 5) return 'plateauing';
    if (longTermChange >= 5) return 'improving';
    if (longTermChange <= -5) return 'declining';
    return 'stable';
  }

  private calculateMetricCorrelations(history: PerformanceHistory[]): Record<string, number> {
    // Simplified correlation analysis between Overall and other metrics
    const correlations: Record<string, number> = {};
    
    const overallScores = history.map(h => h.overallScore);
    
    if (history.every(h => h.seoScore !== null)) {
      const seoScores = history.map(h => h.seoScore!);
      correlations['SEO-Overall'] = this.calculateCorrelation(overallScores, seoScores);
    }
    
    if (history.every(h => h.accessibilityScore !== null)) {
      const accessibilityScores = history.map(h => h.accessibilityScore!);
      correlations['Accessibility-Overall'] = this.calculateCorrelation(overallScores, accessibilityScores);
    }

    return correlations;
  }

  private calculateCorrelation(x: number[], y: number[]): number {
    if (x.length !== y.length || x.length === 0) return 0;

    const n = x.length;
    const sumX = x.reduce((sum, val) => sum + val, 0);
    const sumY = y.reduce((sum, val) => sum + val, 0);
    const sumXY = x.reduce((sum, val, i) => sum + val * y[i], 0);
    const sumX2 = x.reduce((sum, val) => sum + val * val, 0);
    const sumY2 = y.reduce((sum, val) => sum + val * val, 0);

    const numerator = n * sumXY - sumX * sumY;
    const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));

    return denominator === 0 ? 0 : numerator / denominator;
  }

  private calculateDataConsistency(history: PerformanceHistory[]): number {
    if (history.length === 0) return 0;

    // Check for consistent data quality (non-null scores)
    let totalFields = 0;
    let nullFields = 0;

    for (const record of history) {
      totalFields += 5; // 5 score fields
      if (record.seoScore === null) nullFields++;
      if (record.accessibilityScore === null) nullFields++;
      if (record.mobileScore === null) nullFields++;
      if (record.performanceScore === null) nullFields++;
    }

    return ((totalFields - nullFields) / totalFields) * 100;
  }

  private calculateTimeSpanCoverage(history: PerformanceHistory[], timePeriod: '7d' | '30d' | '90d' | '1y'): number {
    if (history.length === 0) return 0;

    const sortedHistory = [...history].sort((a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime());
    const firstDate = new Date(sortedHistory[0].recordedAt);
    const lastDate = new Date(sortedHistory[sortedHistory.length - 1].recordedAt);
    const actualSpan = lastDate.getTime() - firstDate.getTime();

    const expectedSpan = this.getExpectedTimeSpan(timePeriod);
    
    return Math.min(100, (actualSpan / expectedSpan) * 100);
  }

  private calculateDataFreshness(history: PerformanceHistory[]): number {
    if (history.length === 0) return 0;

    const sortedHistory = [...history].sort((a, b) => new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime());
    const latestDate = new Date(sortedHistory[0].recordedAt);
    const now = new Date();
    const daysSinceLatest = (now.getTime() - latestDate.getTime()) / (1000 * 60 * 60 * 24);

    // Fresher data gets higher score
    if (daysSinceLatest <= 1) return 100;
    if (daysSinceLatest <= 3) return 80;
    if (daysSinceLatest <= 7) return 60;
    if (daysSinceLatest <= 14) return 40;
    if (daysSinceLatest <= 30) return 20;
    return 10;
  }

  private getExpectedTimeSpan(timePeriod: '7d' | '30d' | '90d' | '1y'): number {
    const day = 24 * 60 * 60 * 1000;
    switch (timePeriod) {
      case '7d': return 7 * day;
      case '30d': return 30 * day;
      case '90d': return 90 * day;
      case '1y': return 365 * day;
      default: return 30 * day;
    }
  }

  // Helper methods for schema compliance
  private metricNameToCategory(metricName: string): 'overall' | 'seo' | 'accessibility' | 'mobile' | 'performance' {
    const categoryMap: Record<string, 'overall' | 'seo' | 'accessibility' | 'mobile' | 'performance'> = {
      'Overall': 'overall',
      'SEO': 'seo',
      'Accessibility': 'accessibility',
      'Mobile': 'mobile',
      'Performance': 'performance'
    };
    return categoryMap[metricName] || 'overall';
  }

  private categoryToMetricName(category: 'overall' | 'seo' | 'accessibility' | 'mobile' | 'performance'): string {
    const nameMap: Record<string, string> = {
      'overall': 'Overall',
      'seo': 'SEO',
      'accessibility': 'Accessibility',
      'mobile': 'Mobile',
      'performance': 'Performance'
    };
    return nameMap[category] || 'Overall';
  }

  private classifyMagnitude(change: number, threshold: number): 'minor' | 'moderate' | 'major' {
    if (change >= threshold * 2.5) return 'major';
    if (change >= threshold * 1.5) return 'moderate';
    return 'minor';
  }

  private generatePossibleCauses(metricName: string, changeType: 'improvement' | 'regression'): string[] {
    const causes: Record<string, Record<string, string[]>> = {
      'Overall': {
        'improvement': ['Comprehensive optimization efforts', 'Multiple metric improvements', 'Strategic performance initiatives'],
        'regression': ['Multiple simultaneous issues', 'Technical debt accumulation', 'Resource constraints']
      },
      'SEO': {
        'improvement': ['Meta tag optimization', 'Content structure improvements', 'Technical SEO enhancements'],
        'regression': ['Content quality issues', 'Technical SEO problems', 'Crawling or indexing issues']
      },
      'Accessibility': {
        'improvement': ['WCAG compliance improvements', 'Screen reader optimizations', 'Keyboard navigation enhancements'],
        'regression': ['New accessibility barriers', 'Missing alt texts or labels', 'Color contrast issues']
      },
      'Mobile': {
        'improvement': ['Responsive design improvements', 'Mobile-specific optimizations', 'Touch interaction enhancements'],
        'regression': ['Mobile layout issues', 'Touch target problems', 'Mobile performance degradation']
      },
      'Performance': {
        'improvement': ['Code optimization', 'Caching improvements', 'Resource compression'],
        'regression': ['Increased payload size', 'Third-party script issues', 'Server performance problems']
      }
    };

    return causes[metricName]?.[changeType] || ['General optimization changes', 'External factors', 'Technical modifications'];
  }

  private async createInsufficientDataAnalysis(trackingId: string, timePeriod: '7d' | '30d' | '90d' | '1y'): Promise<TrendAnalysis> {
    const analysisData: InsertTrendAnalysis = {
      historicalTrackingId: trackingId,
      timePeriod,
      overallTrend: 'stable',
      trendStrength: 'weak',
      keyInsights: [{
        type: 'recommendation',
        category: 'overall',
        title: 'Insufficient Data for Analysis',
        description: `Insufficient historical data available for ${timePeriod} analysis. Continue running audits to build comprehensive trend insights.`,
        impact: 'low',
        timeframe: timePeriod,
        confidence: 10,
        dataSupport: ['Limited audit history available']
      }],
      improvements: [],
      regressions: [],
      recommendations: [{
        priority: 'low',
        category: 'monitoring',
        title: 'Increase Data Collection',
        description: `Run additional audits to gather sufficient data for meaningful ${timePeriod} trend analysis`,
        expectedImpact: 'Enable comprehensive historical performance insights and recommendations',
        effort: 'low',
        timeframe: 'short-term',
        basedOn: ['Insufficient historical data points']
      }],
      confidenceScore: 10
    };

    return await this.storage.createOrUpdateTrendAnalysis(analysisData);
  }
}