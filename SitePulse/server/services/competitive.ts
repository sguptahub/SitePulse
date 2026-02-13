import type { 
  AuditReport, 
  CompetitorSet, 
  Competitor,
  SEOScoring,
  AccessibilityScoring,
  MobileAnalysis,
  PerformanceMetrics
} from "@shared/schema";
import { AuditService } from "./audit";
import { storage } from "../storage";

export interface CompetitiveRankings {
  overall: CompetitorRanking[];
  seo: CompetitorRanking[];
  accessibility: CompetitorRanking[];
  mobile: CompetitorRanking[];
  performance: CompetitorRanking[];
}

export interface CompetitorRanking {
  competitorId?: string; // undefined for primary website
  url: string;
  name?: string;
  score: number;
  rank: number;
  isPrimary: boolean;
}

export interface GapAnalysisItem {
  category: 'SEO' | 'Accessibility' | 'Mobile' | 'Performance' | 'Overall';
  metric: string;
  primaryScore: number;
  competitorScore: number;
  competitorUrl: string;
  gap: number; // Negative means we're behind
  severity: 'critical' | 'high' | 'medium' | 'low';
}

export interface CompetitiveOpportunity {
  priority: 'critical' | 'high' | 'medium' | 'low';
  category: 'SEO' | 'Accessibility' | 'Mobile' | 'Performance';
  title: string;
  description: string;
  impact: string; // What improvement this would bring
  competitorExample: string; // Which competitor does this well
  potentialGain: number; // Estimated score improvement
}

export interface CompetitiveAnalysis {
  competitorSetId: string;
  primaryUrl: string;
  primaryAudit: AuditReport;
  competitorAudits: Array<{
    competitor: Competitor;
    audit: AuditReport;
  }>;
  rankings: CompetitiveRankings;
  gapAnalysis: GapAnalysisItem[];
  opportunities: CompetitiveOpportunity[];
  industryBenchmarks: {
    averageScores: {
      overall: number;
      seo: number;
      accessibility: number;
      mobile: number;
      performance: number;
    };
    topPerformers: {
      overall: CompetitorRanking;
      seo: CompetitorRanking;
      accessibility: CompetitorRanking;
      mobile: CompetitorRanking;
      performance: CompetitorRanking;
    };
  };
  analysisDate: Date;
}

export class CompetitiveAnalysisService {
  private auditService: AuditService;

  constructor() {
    this.auditService = new AuditService();
  }

  async runCompetitiveAnalysis(competitorSetId: string): Promise<CompetitiveAnalysis> {
    // Get competitor set and competitors
    const competitorSet = await storage.getCompetitorSet(competitorSetId);
    if (!competitorSet) {
      throw new Error('Competitor set not found');
    }

    const competitors = await storage.getCompetitorsBySet(competitorSetId);
    if (competitors.length === 0) {
      throw new Error('No competitors found in set');
    }

    // Run audit on primary website
    console.log(`Running audit on primary website: ${competitorSet.primaryUrl}`);
    const primaryAudit = await this.auditService.auditWebsite(competitorSet.primaryUrl);
    
    // Save primary audit to database
    const savedPrimaryAudit = await storage.createAuditReport({
      url: competitorSet.primaryUrl,
      overallScore: primaryAudit.overallScore,
      metaTags: primaryAudit.metaTags,
      accessibilityIssues: primaryAudit.accessibilityIssues,
      accessibilityScoring: primaryAudit.accessibilityScoring,
      seoScoring: primaryAudit.seoScoring,
      mobileAnalysis: primaryAudit.mobileAnalysis,
      brokenLinks: primaryAudit.brokenLinks,
      performanceMetrics: primaryAudit.performanceMetrics,
      recommendations: primaryAudit.recommendations,
      statistics: primaryAudit.statistics
    });

    // Run audits on all competitors
    const competitorAudits: Array<{ competitor: Competitor; audit: AuditReport }> = [];
    
    for (const competitor of competitors) {
      if (!competitor.isActive) continue;
      
      try {
        console.log(`Running audit on competitor: ${competitor.url}`);
        const audit = await this.auditService.auditWebsite(competitor.url);
        
        // Save competitor audit to database
        const savedAudit = await storage.createAuditReport({
          url: competitor.url,
          overallScore: audit.overallScore,
          metaTags: audit.metaTags,
          accessibilityIssues: audit.accessibilityIssues,
          accessibilityScoring: audit.accessibilityScoring,
          seoScoring: audit.seoScoring,
          mobileAnalysis: audit.mobileAnalysis,
          brokenLinks: audit.brokenLinks,
          performanceMetrics: audit.performanceMetrics,
          recommendations: audit.recommendations,
          statistics: audit.statistics
        });

        // Update competitor with latest audit
        await storage.updateCompetitor(competitor.id, {
          lastAuditReportId: savedAudit.id
        });

        competitorAudits.push({
          competitor,
          audit: savedAudit
        });
      } catch (error) {
        console.error(`Failed to audit competitor ${competitor.url}:`, error);
        // Continue with other competitors
      }
    }

    // Calculate competitive rankings
    const rankings = this.calculateRankings(savedPrimaryAudit, competitorAudits);
    
    // Generate gap analysis
    const gapAnalysis = this.generateGapAnalysis(savedPrimaryAudit, competitorAudits);
    
    // Generate opportunities
    const opportunities = this.generateOpportunities(gapAnalysis, rankings);
    
    // Calculate industry benchmarks
    const industryBenchmarks = this.calculateIndustryBenchmarks(savedPrimaryAudit, competitorAudits);

    return {
      competitorSetId,
      primaryUrl: competitorSet.primaryUrl,
      primaryAudit: savedPrimaryAudit,
      competitorAudits,
      rankings,
      gapAnalysis,
      opportunities,
      industryBenchmarks,
      analysisDate: new Date()
    };
  }

  private calculateRankings(
    primaryAudit: AuditReport, 
    competitorAudits: Array<{ competitor: Competitor; audit: AuditReport }>
  ): CompetitiveRankings {
    const allAudits: Array<{
      audit: AuditReport;
      isPrimary: boolean;
      url: string;
      competitor?: Competitor;
      name?: string;
    }> = [
      { audit: primaryAudit, isPrimary: true, url: primaryAudit.url },
      ...competitorAudits.map(ca => ({
        audit: ca.audit,
        competitor: ca.competitor,
        isPrimary: false,
        url: ca.competitor.url,
        name: ca.competitor.name || undefined
      }))
    ];

    const calculateCategoryRankings = (scoreExtractor: (audit: AuditReport) => number): CompetitorRanking[] => {
      return allAudits
        .map(item => ({
          competitorId: item.isPrimary ? undefined : item.competitor?.id,
          url: item.url,
          name: item.name,
          score: scoreExtractor(item.audit),
          rank: 0, // Will be calculated below
          isPrimary: item.isPrimary
        }))
        .sort((a, b) => b.score - a.score) // Sort by score descending
        .map((item, index) => ({ ...item, rank: index + 1 }));
    };

    return {
      overall: calculateCategoryRankings(audit => audit.overallScore),
      seo: calculateCategoryRankings(audit => this.extractSEOScore(audit)),
      accessibility: calculateCategoryRankings(audit => this.extractAccessibilityScore(audit)),
      mobile: calculateCategoryRankings(audit => this.extractMobileScore(audit)),
      performance: calculateCategoryRankings(audit => this.extractPerformanceScore(audit))
    };
  }

  private generateGapAnalysis(
    primaryAudit: AuditReport,
    competitorAudits: Array<{ competitor: Competitor; audit: AuditReport }>
  ): GapAnalysisItem[] {
    const gaps: GapAnalysisItem[] = [];

    for (const { competitor, audit } of competitorAudits) {
      // Overall score gap
      const overallGap = audit.overallScore - primaryAudit.overallScore;
      if (overallGap > 0) {
        gaps.push({
          category: 'Overall',
          metric: 'Overall Score',
          primaryScore: primaryAudit.overallScore,
          competitorScore: audit.overallScore,
          competitorUrl: competitor.url,
          gap: overallGap,
          severity: this.determineSeverity(overallGap)
        });
      }

      // SEO gaps
      const primarySEO = this.extractSEOScore(primaryAudit);
      const competitorSEO = this.extractSEOScore(audit);
      const seoGap = competitorSEO - primarySEO;
      if (seoGap > 0) {
        gaps.push({
          category: 'SEO',
          metric: 'SEO Score',
          primaryScore: primarySEO,
          competitorScore: competitorSEO,
          competitorUrl: competitor.url,
          gap: seoGap,
          severity: this.determineSeverity(seoGap)
        });
      }

      // Accessibility gaps
      const primaryA11y = this.extractAccessibilityScore(primaryAudit);
      const competitorA11y = this.extractAccessibilityScore(audit);
      const a11yGap = competitorA11y - primaryA11y;
      if (a11yGap > 0) {
        gaps.push({
          category: 'Accessibility',
          metric: 'Accessibility Score',
          primaryScore: primaryA11y,
          competitorScore: competitorA11y,
          competitorUrl: competitor.url,
          gap: a11yGap,
          severity: this.determineSeverity(a11yGap)
        });
      }

      // Mobile gaps
      const primaryMobile = this.extractMobileScore(primaryAudit);
      const competitorMobile = this.extractMobileScore(audit);
      const mobileGap = competitorMobile - primaryMobile;
      if (mobileGap > 0) {
        gaps.push({
          category: 'Mobile',
          metric: 'Mobile Score',
          primaryScore: primaryMobile,
          competitorScore: competitorMobile,
          competitorUrl: competitor.url,
          gap: mobileGap,
          severity: this.determineSeverity(mobileGap)
        });
      }

      // Performance gaps
      const primaryPerf = this.extractPerformanceScore(primaryAudit);
      const competitorPerf = this.extractPerformanceScore(audit);
      const perfGap = competitorPerf - primaryPerf;
      if (perfGap > 0) {
        gaps.push({
          category: 'Performance',
          metric: 'Performance Score',
          primaryScore: primaryPerf,
          competitorScore: competitorPerf,
          competitorUrl: competitor.url,
          gap: perfGap,
          severity: this.determineSeverity(perfGap)
        });
      }
    }

    return gaps.sort((a, b) => b.gap - a.gap); // Sort by gap size, largest first
  }

  private generateOpportunities(
    gapAnalysis: GapAnalysisItem[],
    rankings: CompetitiveRankings
  ): CompetitiveOpportunity[] {
    const opportunities: CompetitiveOpportunity[] = [];

    // Group gaps by category to create opportunities
    const gapsByCategory = gapAnalysis.reduce((acc, gap) => {
      if (!acc[gap.category]) acc[gap.category] = [];
      acc[gap.category].push(gap);
      return acc;
    }, {} as Record<string, GapAnalysisItem[]>);

    for (const [category, gaps] of Object.entries(gapsByCategory)) {
      if (gaps.length === 0) continue;

      const largestGap = gaps[0]; // Already sorted by gap size
      const avgGap = gaps.reduce((sum, gap) => sum + gap.gap, 0) / gaps.length;

      opportunities.push({
        priority: largestGap.severity,
        category: category as any,
        title: `Improve ${category} Performance`,
        description: this.generateOpportunityDescription(category, largestGap, gaps.length),
        impact: `Could improve overall score by up to ${Math.round(avgGap)} points`,
        competitorExample: largestGap.competitorUrl,
        potentialGain: Math.round(avgGap)
      });
    }

    return opportunities.sort((a, b) => {
      const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });
  }

  private calculateIndustryBenchmarks(
    primaryAudit: AuditReport,
    competitorAudits: Array<{ competitor: Competitor; audit: AuditReport }>
  ) {
    const allAudits = [primaryAudit, ...competitorAudits.map(ca => ca.audit)];
    
    const avgOverall = allAudits.reduce((sum, audit) => sum + audit.overallScore, 0) / allAudits.length;
    const avgSEO = allAudits.reduce((sum, audit) => sum + this.extractSEOScore(audit), 0) / allAudits.length;
    const avgA11y = allAudits.reduce((sum, audit) => sum + this.extractAccessibilityScore(audit), 0) / allAudits.length;
    const avgMobile = allAudits.reduce((sum, audit) => sum + this.extractMobileScore(audit), 0) / allAudits.length;
    const avgPerf = allAudits.reduce((sum, audit) => sum + this.extractPerformanceScore(audit), 0) / allAudits.length;

    return {
      averageScores: {
        overall: Math.round(avgOverall),
        seo: Math.round(avgSEO),
        accessibility: Math.round(avgA11y),
        mobile: Math.round(avgMobile),
        performance: Math.round(avgPerf)
      },
      topPerformers: {
        overall: this.getTopPerformer(allAudits, audit => audit.overallScore, primaryAudit, competitorAudits),
        seo: this.getTopPerformer(allAudits, audit => this.extractSEOScore(audit), primaryAudit, competitorAudits),
        accessibility: this.getTopPerformer(allAudits, audit => this.extractAccessibilityScore(audit), primaryAudit, competitorAudits),
        mobile: this.getTopPerformer(allAudits, audit => this.extractMobileScore(audit), primaryAudit, competitorAudits),
        performance: this.getTopPerformer(allAudits, audit => this.extractPerformanceScore(audit), primaryAudit, competitorAudits)
      }
    };
  }

  // Helper methods
  private extractSEOScore(audit: AuditReport): number {
    if (typeof audit.seoScoring === 'object' && audit.seoScoring && 'overallScore' in audit.seoScoring) {
      return Number(audit.seoScoring.overallScore) || 0;
    }
    return 0;
  }

  private extractAccessibilityScore(audit: AuditReport): number {
    if (typeof audit.accessibilityScoring === 'object' && audit.accessibilityScoring && 'overallScore' in audit.accessibilityScoring) {
      return Number(audit.accessibilityScoring.overallScore) || 0;
    }
    return 0;
  }

  private extractMobileScore(audit: AuditReport): number {
    if (typeof audit.mobileAnalysis === 'object' && audit.mobileAnalysis && 'overallScore' in audit.mobileAnalysis) {
      return Number(audit.mobileAnalysis.overallScore) || 0;
    }
    return 0;
  }

  private extractPerformanceScore(audit: AuditReport): number {
    if (typeof audit.performanceMetrics === 'object' && audit.performanceMetrics && 'overallScore' in audit.performanceMetrics) {
      return Number(audit.performanceMetrics.overallScore) || 0;
    }
    return 0;
  }

  private determineSeverity(gap: number): 'critical' | 'high' | 'medium' | 'low' {
    if (gap >= 20) return 'critical';
    if (gap >= 10) return 'high';
    if (gap >= 5) return 'medium';
    return 'low';
  }

  private generateOpportunityDescription(category: string, largestGap: GapAnalysisItem, gapCount: number): string {
    const competitor = largestGap.competitorUrl;
    const gap = largestGap.gap;
    
    switch (category) {
      case 'SEO':
        return `Your SEO score is ${gap} points behind ${competitor}. Focus on meta tags, content structure, and technical SEO improvements to close this gap.`;
      case 'Accessibility':
        return `Your accessibility score is ${gap} points behind ${competitor}. Improve WCAG compliance, semantic HTML, and screen reader compatibility.`;
      case 'Mobile':
        return `Your mobile score is ${gap} points behind ${competitor}. Optimize for mobile viewport, touch targets, and responsive design.`;
      case 'Performance':
        return `Your performance score is ${gap} points behind ${competitor}. Focus on load times, image optimization, and reducing HTTP requests.`;
      default:
        return `Your ${category.toLowerCase()} score is ${gap} points behind ${competitor}. ${gapCount} competitor${gapCount > 1 ? 's' : ''} outperform you in this area.`;
    }
  }

  private getTopPerformer(
    allAudits: AuditReport[],
    scoreExtractor: (audit: AuditReport) => number,
    primaryAudit: AuditReport,
    competitorAudits: Array<{ competitor: Competitor; audit: AuditReport }>
  ): CompetitorRanking {
    let topScore = -1;
    let topPerformer: CompetitorRanking = {
      url: primaryAudit.url,
      score: scoreExtractor(primaryAudit),
      rank: 1,
      isPrimary: true
    };

    // Check primary
    const primaryScore = scoreExtractor(primaryAudit);
    if (primaryScore > topScore) {
      topScore = primaryScore;
      topPerformer = {
        url: primaryAudit.url,
        score: primaryScore,
        rank: 1,
        isPrimary: true
      };
    }

    // Check competitors
    for (const { competitor, audit } of competitorAudits) {
      const score = scoreExtractor(audit);
      if (score > topScore) {
        topScore = score;
        topPerformer = {
          competitorId: competitor.id,
          url: competitor.url,
          name: competitor.name || undefined,
          score,
          rank: 1,
          isPrimary: false
        };
      }
    }

    return topPerformer;
  }
}