import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, jsonb, timestamp, boolean, pgEnum, unique, index, check } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Enums for constrained text fields
export const trackingFrequencyEnum = pgEnum("tracking_frequency", ["manual", "daily", "weekly", "monthly"]);
export const timePeriodEnum = pgEnum("time_period", ["7d", "30d", "90d", "1y"]);
export const trendDirectionEnum = pgEnum("trend_direction", ["improving", "declining", "stable"]);
export const trendStrengthEnum = pgEnum("trend_strength", ["strong", "moderate", "weak"]);

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const auditReports = pgTable("audit_reports", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  url: text("url").notNull(),
  overallScore: integer("overall_score").notNull(),
  metaTags: jsonb("meta_tags").notNull(),
  accessibilityIssues: jsonb("accessibility_issues").notNull(),
  accessibilityScoring: jsonb("accessibility_scoring"),
  seoScoring: jsonb("seo_scoring"),
  mobileAnalysis: jsonb("mobile_analysis"),
  brokenLinks: jsonb("broken_links").notNull(),
  performanceMetrics: jsonb("performance_metrics").notNull(),
  recommendations: jsonb("recommendations").notNull(),
  statistics: jsonb("statistics").notNull(),
  analysisDate: timestamp("analysis_date").notNull().default(sql`now()`),
});

export const competitorSets = pgTable("competitor_sets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  primaryUrl: text("primary_url").notNull(), // The main website being compared
  industry: text("industry"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
});

export const competitors = pgTable("competitors", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  competitorSetId: varchar("competitor_set_id").notNull().references(() => competitorSets.id, { onDelete: 'cascade' }),
  url: text("url").notNull(),
  name: text("name"), // Optional display name
  lastAuditReportId: varchar("last_audit_report_id").references(() => auditReports.id),
  isActive: boolean("is_active").notNull().default(true),
  addedAt: timestamp("added_at").notNull().default(sql`now()`),
});

export const comparisons = pgTable("comparisons", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  competitorSetId: varchar("competitor_set_id").notNull().references(() => competitorSets.id, { onDelete: 'cascade' }),
  primaryAuditId: varchar("primary_audit_id").notNull().references(() => auditReports.id),
  competitorAudits: jsonb("competitor_audits").notNull(), // Array of {competitorId, auditReportId, ranking}
  competitiveScores: jsonb("competitive_scores").notNull(), // Comparative rankings across metrics
  gapAnalysis: jsonb("gap_analysis").notNull(), // Areas where competitors outperform
  opportunities: jsonb("opportunities").notNull(), // Prioritized improvement recommendations
  industryBenchmarks: jsonb("industry_benchmarks"), // Industry-specific scoring context
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

// Historical tracking for website performance over time
export const historicalTracking = pgTable("historical_tracking", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  url: text("url").notNull(),
  domain: text("domain").notNull(), // Extract domain for grouping
  trackingStartDate: timestamp("tracking_start_date").notNull().default(sql`now()`),
  lastAuditDate: timestamp("last_audit_date").notNull().default(sql`now()`),
  totalAudits: integer("total_audits").notNull().default(1),
  isActive: boolean("is_active").notNull().default(true),
  retentionDays: integer("retention_days").notNull().default(365), // How long to keep historical data
  trackingFrequency: trackingFrequencyEnum("tracking_frequency").notNull().default("manual"),
}, (table) => ({
  // Unique constraint to prevent duplicate trackers for the same URL
  uniqueUrl: unique().on(table.url),
  // Index for domain-based grouping and filtering
  domainIdx: index().on(table.domain),
  // Constraint to ensure retention days is reasonable (1-3650 days = 10 years max)
  retentionDaysCheck: check("retention_days_check", sql`${table.retentionDays} >= 1 AND ${table.retentionDays} <= 3650`),
}));

// Time-series performance metrics for trend analysis  
export const performanceHistory = pgTable("performance_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  historicalTrackingId: varchar("historical_tracking_id").notNull().references(() => historicalTracking.id, { onDelete: 'cascade' }),
  auditReportId: varchar("audit_report_id").notNull().references(() => auditReports.id, { onDelete: 'cascade' }),
  recordedAt: timestamp("recorded_at").notNull().default(sql`now()`),
  overallScore: integer("overall_score").notNull(),
  seoScore: integer("seo_score"),
  accessibilityScore: integer("accessibility_score"),
  mobileScore: integer("mobile_score"),
  performanceScore: integer("performance_score"),
  scoreChanges: jsonb("score_changes").$type<ScoreChanges>(), // Compared to previous audit
  trendData: jsonb("trend_data").$type<TrendData>(), // Rolling averages, momentum indicators
  significantChanges: jsonb("significant_changes").$type<SignificantChange[]>(), // Notable improvements/regressions
}, (table) => ({
  // Unique constraint to prevent duplicate audit entries
  uniqueAuditReport: unique().on(table.auditReportId),
  // Index for time-series queries by historical tracking and date
  timeSeriesIdx: index().on(table.historicalTrackingId, table.recordedAt),
  // Index for date-based queries
  recordedAtIdx: index().on(table.recordedAt),
  // Score range constraints (0-100)
  overallScoreCheck: check("overall_score_check", sql`${table.overallScore} >= 0 AND ${table.overallScore} <= 100`),
  seoScoreCheck: check("seo_score_check", sql`${table.seoScore} IS NULL OR (${table.seoScore} >= 0 AND ${table.seoScore} <= 100)`),
  accessibilityScoreCheck: check("accessibility_score_check", sql`${table.accessibilityScore} IS NULL OR (${table.accessibilityScore} >= 0 AND ${table.accessibilityScore} <= 100)`),
  mobileScoreCheck: check("mobile_score_check", sql`${table.mobileScore} IS NULL OR (${table.mobileScore} >= 0 AND ${table.mobileScore} <= 100)`),
  performanceScoreCheck: check("performance_score_check", sql`${table.performanceScore} IS NULL OR (${table.performanceScore} >= 0 AND ${table.performanceScore} <= 100)`),
}));

// Trend analysis and insights generated from historical data
export const trendAnalysis = pgTable("trend_analysis", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  historicalTrackingId: varchar("historical_tracking_id").notNull().references(() => historicalTracking.id, { onDelete: 'cascade' }),
  analysisDate: timestamp("analysis_date").notNull().default(sql`now()`),
  timePeriod: timePeriodEnum("time_period").notNull(),
  overallTrend: trendDirectionEnum("overall_trend").notNull(),
  trendStrength: trendStrengthEnum("trend_strength").notNull(),
  keyInsights: jsonb("key_insights").$type<TrendInsight[]>().notNull(), // Array of insight objects
  improvements: jsonb("improvements").$type<SignificantChange[]>().notNull(), // Areas showing improvement
  regressions: jsonb("regressions").$type<SignificantChange[]>().notNull(), // Areas showing decline
  recommendations: jsonb("recommendations").$type<HistoricalRecommendation[]>().notNull(), // Data-driven recommendations
  confidenceScore: integer("confidence_score").notNull(), // 0-100, based on data points
}, (table) => ({
  // Unique constraint for one analysis per tracking/period combination (stores latest)
  uniqueTrackingPeriod: unique().on(table.historicalTrackingId, table.timePeriod),
  // Index for queries by tracking ID and analysis date
  analysisIdx: index().on(table.historicalTrackingId, table.analysisDate),
  // Confidence score range constraint (0-100)
  confidenceScoreCheck: check("confidence_score_check", sql`${table.confidenceScore} >= 0 AND ${table.confidenceScore} <= 100`),
}));

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export const insertAuditReportSchema = createInsertSchema(auditReports).omit({
  id: true,
  analysisDate: true,
});

export const insertCompetitorSetSchema = createInsertSchema(competitorSets).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCompetitorSchema = createInsertSchema(competitors).omit({
  id: true,
  addedAt: true,
});

export const insertComparisonSchema = createInsertSchema(comparisons).omit({
  id: true,
  createdAt: true,
});

export const insertHistoricalTrackingSchema = createInsertSchema(historicalTracking).omit({
  id: true,
  trackingStartDate: true,
  lastAuditDate: true,
});

export const insertPerformanceHistorySchema = createInsertSchema(performanceHistory).omit({
  id: true,
  recordedAt: true,
});

export const insertTrendAnalysisSchema = createInsertSchema(trendAnalysis).omit({
  id: true,
  analysisDate: true,
});

export const auditRequestSchema = z.object({
  url: z.string()
    .transform((url) => {
      const trimmedUrl = url.trim();
      // If the URL already has a protocol, return as is
      if (trimmedUrl.match(/^https?:\/\//i)) {
        return trimmedUrl;
      }
      // Add https:// if no protocol is present
      return `https://${trimmedUrl}`;
    })
    .refine((url) => {
      try {
        new URL(url);
        return true;
      } catch {
        return false;
      }
    }, "Please enter a valid URL"),
});

export const bulkAnalysisRequestSchema = z.object({
  urls: z.array(
    z.string()
      .transform((url) => {
        const trimmedUrl = url.trim();
        // If the URL already has a protocol, return as is
        if (trimmedUrl.match(/^https?:\/\//i)) {
          return trimmedUrl;
        }
        // Otherwise, prepend https://
        return `https://${trimmedUrl}`;
      })
      .refine((url) => {
        try {
          const urlObj = new URL(url);
          // Block localhost and private IP ranges for security
          const hostname = urlObj.hostname.toLowerCase();
          if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname.startsWith('192.168.') || hostname.startsWith('10.') || hostname.match(/^172\.(1[6-9]|2[0-9]|3[0-1])\./)) {
            return false;
          }
          return true;
        } catch {
          return false;
        }
      }, "Please enter valid URLs")
  )
  .min(1, "At least one URL is required")
  .max(20, "Maximum 20 URLs allowed per bulk analysis")
});

export const competitorSetRequestSchema = z.object({
  name: z.string().min(1, "Set name is required"),
  description: z.string().optional(),
  primaryUrl: z.string().url("Please enter a valid primary URL"),
  industry: z.string().optional(),
});

export const competitorRequestSchema = z.object({
  url: z.string().url("Please enter a valid competitor URL"),
  name: z.string().optional(),
});

// Types
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type InsertAuditReport = z.infer<typeof insertAuditReportSchema>;
export type AuditReport = typeof auditReports.$inferSelect;
export type AuditRequest = z.infer<typeof auditRequestSchema>;
export type BulkAnalysisRequest = z.infer<typeof bulkAnalysisRequestSchema>;

export type InsertCompetitorSet = z.infer<typeof insertCompetitorSetSchema>;
export type CompetitorSet = typeof competitorSets.$inferSelect;
export type CompetitorSetRequest = z.infer<typeof competitorSetRequestSchema>;

export type InsertCompetitor = z.infer<typeof insertCompetitorSchema>;
export type Competitor = typeof competitors.$inferSelect;
export type CompetitorRequest = z.infer<typeof competitorRequestSchema>;

export type InsertComparison = z.infer<typeof insertComparisonSchema>;
export type Comparison = typeof comparisons.$inferSelect;

export type InsertHistoricalTracking = z.infer<typeof insertHistoricalTrackingSchema>;
export type HistoricalTracking = typeof historicalTracking.$inferSelect;

export type InsertPerformanceHistory = z.infer<typeof insertPerformanceHistorySchema>;
export type PerformanceHistory = typeof performanceHistory.$inferSelect;

export type InsertTrendAnalysis = z.infer<typeof insertTrendAnalysisSchema>;
export type TrendAnalysis = typeof trendAnalysis.$inferSelect;

// Detailed audit result types
export interface MetaTagAnalysis {
  title: { present: boolean; content: string; status: 'good' | 'warning' | 'error' };
  description: { present: boolean; content: string; status: 'good' | 'warning' | 'error' };
  ogImage: { present: boolean; content: string; status: 'good' | 'warning' | 'error' };
  ogTitle: { present: boolean; content: string; status: 'good' | 'warning' | 'error' };
  ogDescription: { present: boolean; content: string; status: 'good' | 'warning' | 'error' };
  twitterCard: { present: boolean; content: string; status: 'good' | 'warning' | 'error' };
  twitterTitle: { present: boolean; content: string; status: 'good' | 'warning' | 'error' };
  twitterDescription: { present: boolean; content: string; status: 'good' | 'warning' | 'error' };
}

export interface AccessibilityIssue {
  type: string;
  severity: 'critical' | 'warning' | 'good';
  description: string;
  elements?: string[];
  recommendation: string;
  wcagLevel?: 'A' | 'AA' | 'AAA';
  wcagReference?: string;
}

export interface AccessibilityScoring {
  overallScore: number;
  wcagComplianceLevel: 'A' | 'AA' | 'AAA' | 'None';
  compliancePercentage: number;
  categoryScores: {
    perceivable: number;
    operable: number;
    understandable: number;
    robust: number;
  };
  criticalIssues: number;
  warningIssues: number;
  passedChecks: number;
  totalChecks: number;
}

export interface BrokenLink {
  url: string;
  status: number;
  foundIn: string;
  type: 'internal' | 'external';
}

export interface PerformanceMetrics {
  loadTime: number;
  contentSize: number;
  httpRequests: number;
  firstPaint: number;
  status: 'good' | 'average' | 'poor';
}

export interface Recommendation {
  priority: 'high' | 'medium' | 'low';
  category: 'SEO' | 'Accessibility' | 'Performance' | 'User Experience';
  title: string;
  description: string;
}

export interface SEOScoring {
  overallScore: number;
  categoryScores: {
    metaTags: number;      // 30% weight
    contentStructure: number; // 25% weight
    technicalSEO: number;  // 20% weight
    performance: number;   // 15% weight
    userExperience: number; // 10% weight
  };
  categoryWeights: {
    metaTags: number;
    contentStructure: number;
    technicalSEO: number;
    performance: number;
    userExperience: number;
  };
  detailedBreakdown: {
    metaTags: {
      score: number;
      issues: string[];
      recommendations: string[];
    };
    contentStructure: {
      score: number;
      issues: string[];
      recommendations: string[];
    };
    technicalSEO: {
      score: number;
      issues: string[];
      recommendations: string[];
    };
    performance: {
      score: number;
      issues: string[];
      recommendations: string[];
    };
    userExperience: {
      score: number;
      issues: string[];
      recommendations: string[];
    };
  };
}

export interface MobileAnalysis {
  overallScore: number;
  viewport: {
    present: boolean;
    content: string;
    status: 'good' | 'warning' | 'error';
    width?: string;
    initialScale?: string;
  };
  touchTargets: {
    score: number;
    totalElements: number;
    adequateSize: number;
    tooSmall: number;
    issues: string[];
    recommendations: string[];
  };
  textReadability: {
    score: number;
    fontSizes: number[];
    averageFontSize: number;
    smallTextElements: number;
    issues: string[];
    recommendations: string[];
  };
  mobilePerformance: {
    score: number;
    mobileOptimized: boolean;
    imageOptimization: number;
    issues: string[];
    recommendations: string[];
  };
  mobileSEO: {
    score: number;
    mobileFriendlyMeta: boolean;
    responsiveDesign: boolean;
    ampSupport: boolean;
    issues: string[];
    recommendations: string[];
  };
  detailedIssues: {
    type: string;
    severity: 'critical' | 'warning' | 'good';
    description: string;
    recommendation: string;
  }[];
}

export interface AuditStatistics {
  totalLinks: number;
  workingLinks: number;
  brokenLinks: number;
  internalLinks: number;
  externalLinks: number;
  totalImages: number;
  imagesWithAlt: number;
  imagesWithoutAlt: number;
}

// Historical tracking interfaces
export interface ScoreChanges {
  overall: { previous: number; current: number; change: number; percentage: number };
  seo?: { previous: number; current: number; change: number; percentage: number };
  accessibility?: { previous: number; current: number; change: number; percentage: number };
  mobile?: { previous: number; current: number; change: number; percentage: number };
  performance?: { previous: number; current: number; change: number; percentage: number };
}

export interface TrendData {
  rollingAverage7d: number;
  rollingAverage30d: number;
  momentum: 'accelerating' | 'stable' | 'decelerating';
  volatility: 'low' | 'medium' | 'high';
  dataPoints: number;
  timeSpan: string; // e.g., "30 days"
}

export interface SignificantChange {
  category: 'overall' | 'seo' | 'accessibility' | 'mobile' | 'performance';
  type: 'improvement' | 'regression';
  magnitude: 'minor' | 'moderate' | 'major';
  scoreChange: number;
  percentageChange: number;
  description: string;
  impact: string;
  possibleCauses: string[];
}

export interface TrendInsight {
  type: 'improvement' | 'regression' | 'pattern' | 'anomaly' | 'recommendation';
  category: 'overall' | 'seo' | 'accessibility' | 'mobile' | 'performance';
  title: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  timeframe: string;
  confidence: number; // 0-100
  dataSupport: string[];
}

export interface HistoricalRecommendation {
  priority: 'critical' | 'high' | 'medium' | 'low';
  category: 'trend-reversal' | 'optimization' | 'monitoring' | 'investigation';
  title: string;
  description: string;
  expectedImpact: string;
  effort: 'low' | 'medium' | 'high';
  timeframe: 'immediate' | 'short-term' | 'long-term';
  basedOn: string[]; // Which trend data supports this recommendation
}
