import { 
  type User, type InsertUser, 
  type AuditReport, type InsertAuditReport,
  type CompetitorSet, type InsertCompetitorSet,
  type Competitor, type InsertCompetitor,
  type Comparison, type InsertComparison,
  type HistoricalTracking, type InsertHistoricalTracking,
  type PerformanceHistory, type InsertPerformanceHistory,
  type TrendAnalysis, type InsertTrendAnalysis,
  users, auditReports, competitorSets, competitors, comparisons,
  historicalTracking, performanceHistory, trendAnalysis
} from "@shared/schema";
import { eq, sql, desc, and, gte, lte, lt } from "drizzle-orm";
import { randomUUID } from "crypto";
import { HistoricalInsightsService } from "./services/historical-insights.service";
import { db } from "./db";

// Temporary in-memory storage while database endpoint is disabled
export class MemStorage implements IStorage {
  private users = new Map<string, User>();
  private auditReports = new Map<string, AuditReport>();
  private competitorSets = new Map<string, CompetitorSet>();
  private competitors = new Map<string, Competitor>();
  private comparisons = new Map<string, Comparison>();
  private historicalTracking = new Map<string, HistoricalTracking>();
  private performanceHistory = new Map<string, PerformanceHistory[]>();
  private trendAnalyses = new Map<string, TrendAnalysis>();
  private insightsService: HistoricalInsightsService;

  constructor() {
    this.insightsService = new HistoricalInsightsService(this);
  }

  // User management
  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const values = Array.from(this.users.values());
    for (const user of values) {
      if (user.username === username) return user;
    }
    return undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const user: User = { id: randomUUID(), ...insertUser };
    this.users.set(user.id, user);
    return user;
  }

  // Audit report management
  async createAuditReport(insertReport: InsertAuditReport): Promise<AuditReport> {
    const report: AuditReport = { 
      id: randomUUID(), 
      ...insertReport,
      analysisDate: new Date(),
      accessibilityScoring: insertReport.accessibilityScoring || null,
      seoScoring: insertReport.seoScoring || null,
      mobileAnalysis: insertReport.mobileAnalysis || null
    };
    this.auditReports.set(report.id, report);
    return report;
  }

  async getAuditReport(id: string): Promise<AuditReport | undefined> {
    return this.auditReports.get(id);
  }

  async getAuditReportsByUrl(url: string): Promise<AuditReport[]> {
    return Array.from(this.auditReports.values())
      .filter(report => report.url === url)
      .sort((a, b) => new Date(b.analysisDate).getTime() - new Date(a.analysisDate).getTime());
  }

  async getAuditReports(opts?: { limit?: number; offset?: number; url?: string }): Promise<AuditReport[]> {
    let reports = Array.from(this.auditReports.values());
    
    // Filter by URL if specified
    if (opts?.url) {
      reports = reports.filter(report => report.url === opts.url);
    }
    
    // Sort by analysis date (newest first)
    reports.sort((a, b) => new Date(b.analysisDate).getTime() - new Date(a.analysisDate).getTime());
    
    // Apply pagination
    const offset = opts?.offset || 0;
    const limit = opts?.limit || 50;
    
    return reports.slice(offset, offset + limit);
  }

  // Competitor set management
  async createCompetitorSet(insertCompetitorSet: InsertCompetitorSet): Promise<CompetitorSet> {
    const competitorSet: CompetitorSet = { 
      id: randomUUID(), 
      ...insertCompetitorSet,
      description: insertCompetitorSet.description || null,
      industry: insertCompetitorSet.industry || null,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.competitorSets.set(competitorSet.id, competitorSet);
    return competitorSet;
  }

  async getCompetitorSet(id: string): Promise<CompetitorSet | undefined> {
    return this.competitorSets.get(id);
  }

  async getCompetitorSets(): Promise<CompetitorSet[]> {
    return Array.from(this.competitorSets.values());
  }

  async updateCompetitorSet(id: string, updates: Partial<InsertCompetitorSet>): Promise<CompetitorSet | undefined> {
    const existing = this.competitorSets.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...updates };
    this.competitorSets.set(id, updated);
    return updated;
  }

  async deleteCompetitorSet(id: string): Promise<boolean> {
    return this.competitorSets.delete(id);
  }

  // Competitor management
  async addCompetitor(insertCompetitor: InsertCompetitor): Promise<Competitor> {
    const competitor: Competitor = { 
      id: randomUUID(), 
      ...insertCompetitor,
      name: insertCompetitor.name || null,
      lastAuditReportId: insertCompetitor.lastAuditReportId || null,
      isActive: insertCompetitor.isActive ?? true,
      addedAt: new Date()
    };
    this.competitors.set(competitor.id, competitor);
    return competitor;
  }

  async getCompetitor(id: string): Promise<Competitor | undefined> {
    return this.competitors.get(id);
  }

  async getCompetitorsBySet(competitorSetId: string): Promise<Competitor[]> {
    return Array.from(this.competitors.values())
      .filter(comp => comp.competitorSetId === competitorSetId);
  }

  async updateCompetitor(id: string, updates: Partial<InsertCompetitor>): Promise<Competitor | undefined> {
    const existing = this.competitors.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...updates };
    this.competitors.set(id, updated);
    return updated;
  }

  async removeCompetitor(id: string): Promise<boolean> {
    return this.competitors.delete(id);
  }

  // Comparison management
  async createComparison(insertComparison: InsertComparison): Promise<Comparison> {
    const comparison: Comparison = { 
      id: randomUUID(), 
      ...insertComparison,
      industryBenchmarks: insertComparison.industryBenchmarks || null,
      createdAt: new Date()
    };
    this.comparisons.set(comparison.id, comparison);
    return comparison;
  }

  async getComparison(id: string): Promise<Comparison | undefined> {
    return this.comparisons.get(id);
  }

  async getComparisonsBySet(competitorSetId: string): Promise<Comparison[]> {
    return Array.from(this.comparisons.values())
      .filter(comp => comp.competitorSetId === competitorSetId);
  }

  async getLatestComparison(competitorSetId: string): Promise<Comparison | undefined> {
    const comparisons = await this.getComparisonsBySet(competitorSetId);
    return comparisons.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
  }

  // Historical tracking management
  async createOrUpdateHistoricalTracking(url: string, domain?: string): Promise<HistoricalTracking> {
    const canonical = this.canonicalizeUrl(url);
    const existing = Array.from(this.historicalTracking.values()).find(t => t.url === canonical);
    
    if (existing) {
      return existing;
    }
    
    const tracking: HistoricalTracking = {
      id: randomUUID(),
      url: canonical,
      domain: domain || new URL(canonical).hostname,
      trackingStartDate: new Date(),
      lastAuditDate: new Date(),
      totalAudits: 0,
      isActive: true,
      retentionDays: 365,
      trackingFrequency: "manual" as const
    };
    
    this.historicalTracking.set(tracking.id, tracking);
    return tracking;
  }

  async getHistoricalTracking(id: string): Promise<HistoricalTracking | undefined> {
    return this.historicalTracking.get(id);
  }

  async getHistoricalTrackingByUrl(url: string): Promise<HistoricalTracking | undefined> {
    const canonical = this.canonicalizeUrl(url);
    return Array.from(this.historicalTracking.values()).find(t => t.url === canonical);
  }

  async getActiveTrackings(): Promise<HistoricalTracking[]> {
    return Array.from(this.historicalTracking.values()).filter(t => t.isActive);
  }

  async updateTrackingStats(trackingId: string, auditDate: Date): Promise<void> {
    const tracking = this.historicalTracking.get(trackingId);
    if (tracking) {
      tracking.lastAuditDate = auditDate;
      tracking.totalAudits++;
      this.historicalTracking.set(trackingId, tracking);
    }
  }

  async deactivateTracking(id: string): Promise<boolean> {
    const tracking = this.historicalTracking.get(id);
    if (tracking) {
      tracking.isActive = false;
      this.historicalTracking.set(id, tracking);
      return true;
    }
    return false;
  }

  // Performance history management
  async createPerformanceHistory(insertHistory: InsertPerformanceHistory): Promise<PerformanceHistory> {
    const history: PerformanceHistory = { 
      id: randomUUID(), 
      ...insertHistory,
      seoScore: insertHistory.seoScore || null,
      accessibilityScore: insertHistory.accessibilityScore || null,
      mobileScore: insertHistory.mobileScore || null,
      performanceScore: insertHistory.performanceScore || null,
      scoreChanges: insertHistory.scoreChanges || null,
      trendData: insertHistory.trendData || null,
      significantChanges: insertHistory.significantChanges || null,
      recordedAt: new Date()
    };
    
    const existing = this.performanceHistory.get(history.historicalTrackingId) || [];
    existing.push(history);
    this.performanceHistory.set(history.historicalTrackingId, existing);
    
    return history;
  }

  async getPerformanceHistoryByTracking(trackingId: string, limit?: number): Promise<PerformanceHistory[]> {
    const histories = this.performanceHistory.get(trackingId) || [];
    const sorted = histories.sort((a, b) => new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime());
    return limit ? sorted.slice(0, limit) : sorted;
  }

  async getPerformanceHistoryByDateRange(trackingId: string, startDate: Date, endDate: Date): Promise<PerformanceHistory[]> {
    const histories = this.performanceHistory.get(trackingId) || [];
    return histories.filter(h => {
      const recordedAt = new Date(h.recordedAt);
      return recordedAt >= startDate && recordedAt <= endDate;
    });
  }

  async getLatestPerformanceHistory(trackingId: string): Promise<PerformanceHistory | undefined> {
    const histories = await this.getPerformanceHistoryByTracking(trackingId, 1);
    return histories[0];
  }

  // Trend analysis management
  async createOrUpdateTrendAnalysis(insertAnalysis: InsertTrendAnalysis): Promise<TrendAnalysis> {
    const key = `${insertAnalysis.historicalTrackingId}_${insertAnalysis.timePeriod}`;
    const existing = this.trendAnalyses.get(key);
    
    if (existing) {
      const updated: TrendAnalysis = { 
        ...existing, 
        ...insertAnalysis, 
        analysisDate: new Date()
      };
      this.trendAnalyses.set(key, updated);
      return updated;
    } else {
      const analysis: TrendAnalysis = { 
        id: randomUUID(), 
        ...insertAnalysis,
        keyInsights: insertAnalysis.keyInsights || [],
        improvements: insertAnalysis.improvements || [],
        regressions: insertAnalysis.regressions || [],
        recommendations: insertAnalysis.recommendations || [],
        analysisDate: new Date()
      };
      this.trendAnalyses.set(key, analysis);
      return analysis;
    }
  }

  async getTrendAnalysis(trackingId: string, timePeriod: string): Promise<TrendAnalysis | undefined> {
    const key = `${trackingId}_${timePeriod}`;
    return this.trendAnalyses.get(key);
  }

  async getTrendAnalysesByTracking(trackingId: string): Promise<TrendAnalysis[]> {
    return Array.from(this.trendAnalyses.values())
      .filter(analysis => analysis.historicalTrackingId === trackingId);
  }

  // Historical data utilities
  async recordAuditInHistory(auditReport: AuditReport): Promise<{tracking: HistoricalTracking, history: PerformanceHistory}> {
    const tracking = await this.createOrUpdateHistoricalTracking(auditReport.url);
    await this.updateTrackingStats(tracking.id, auditReport.analysisDate);

    const history = await this.createPerformanceHistory({
      historicalTrackingId: tracking.id,
      auditReportId: auditReport.id,
      overallScore: auditReport.overallScore,
      seoScore: auditReport.overallScore, // Using overall score as SEO score for simplicity
      accessibilityScore: auditReport.overallScore,
      mobileScore: auditReport.overallScore,
      performanceScore: auditReport.overallScore,
      scoreChanges: null,
      trendData: null,
      significantChanges: null
    });

    // Fire and forget insights generation
    this.insightsService.onNewAuditRecorded(tracking.id).catch(err => 
      console.error('Failed to generate insights:', err)
    );

    return { tracking, history };
  }

  async cleanupExpiredData(retentionDays = 90): Promise<{deleted: number}> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
    
    let deleted = 0;
    const entries = Array.from(this.performanceHistory.entries());
    for (const [trackingId, histories] of entries) {
      const filtered = histories.filter(h => new Date(h.recordedAt) > cutoffDate);
      deleted += histories.length - filtered.length;
      this.performanceHistory.set(trackingId, filtered);
    }
    
    return { deleted };
  }

  canonicalizeUrl(url: string): string {
    try {
      const parsed = new URL(url.toLowerCase());
      parsed.hash = '';
      if (parsed.search) {
        const params = new URLSearchParams(parsed.search);
        params.sort();
        parsed.search = params.toString();
      }
      return parsed.toString().replace(/\/$/, '');
    } catch {
      return url.toLowerCase();
    }
  }

  async getHistoricalTrackingStatistics(): Promise<any> {
    try {
      // Get all active trackings
      const activeTrackings = Array.from(this.historicalTracking.values())
        .filter(tracking => tracking.isActive);
      
      // Calculate total active trackings
      const totalActiveTrackings = activeTrackings.length;
      
      // Calculate total historical audits
      const totalHistoricalAudits = activeTrackings.reduce((sum, tracking) => sum + tracking.totalAudits, 0);
      
      // Calculate average audits per tracking
      const averageAuditsPerTracking = totalActiveTrackings > 0 ? Math.round(totalHistoricalAudits / totalActiveTrackings * 10) / 10 : 0;
      
      // Calculate top domains by tracking count
      const domainCounts: Record<string, number> = {};
      activeTrackings.forEach(tracking => {
        domainCounts[tracking.domain] = (domainCounts[tracking.domain] || 0) + 1;
      });
      
      const topDomains = Object.entries(domainCounts)
        .map(([domain, trackingCount]) => ({ domain, trackingCount }))
        .sort((a, b) => b.trackingCount - a.trackingCount)
        .slice(0, 5);
      
      // Find oldest and most recent trackings
      const oldestTracking = activeTrackings.length > 0 
        ? activeTrackings.reduce((oldest, current) => 
            new Date(oldest.trackingStartDate) < new Date(current.trackingStartDate) ? oldest : current
          )
        : null;
      
      const mostRecentAudit = activeTrackings.length > 0
        ? activeTrackings.reduce((most, current) => {
            if (!current.lastAuditDate) return most;
            if (!most.lastAuditDate) return current;
            return new Date(most.lastAuditDate) > new Date(current.lastAuditDate) ? most : current;
          })
        : null;
      
      return {
        totalActiveTrackings,
        totalHistoricalAudits,
        averageAuditsPerTracking,
        topDomains,
        oldestTracking,
        mostRecentAudit
      };
    } catch (error) {
      console.error('Error getting historical tracking statistics:', error);
      return {
        totalActiveTrackings: 0,
        totalHistoricalAudits: 0,
        averageAuditsPerTracking: 0,
        topDomains: [],
        oldestTracking: null,
        mostRecentAudit: null
      };
    }
  }
}

export interface IStorage {
  // User management
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Audit report management
  createAuditReport(report: InsertAuditReport): Promise<AuditReport>;
  getAuditReport(id: string): Promise<AuditReport | undefined>;
  getAuditReportsByUrl(url: string): Promise<AuditReport[]>;
  getAuditReports(opts?: { limit?: number; offset?: number; url?: string }): Promise<AuditReport[]>;
  
  // Competitor set management
  createCompetitorSet(competitorSet: InsertCompetitorSet): Promise<CompetitorSet>;
  getCompetitorSet(id: string): Promise<CompetitorSet | undefined>;
  getCompetitorSets(): Promise<CompetitorSet[]>;
  updateCompetitorSet(id: string, updates: Partial<InsertCompetitorSet>): Promise<CompetitorSet | undefined>;
  deleteCompetitorSet(id: string): Promise<boolean>;
  
  // Competitor management
  addCompetitor(competitor: InsertCompetitor): Promise<Competitor>;
  getCompetitor(id: string): Promise<Competitor | undefined>;
  getCompetitorsBySet(competitorSetId: string): Promise<Competitor[]>;
  updateCompetitor(id: string, updates: Partial<InsertCompetitor>): Promise<Competitor | undefined>;
  removeCompetitor(id: string): Promise<boolean>;
  
  // Comparison management
  createComparison(comparison: InsertComparison): Promise<Comparison>;
  getComparison(id: string): Promise<Comparison | undefined>;
  getComparisonsBySet(competitorSetId: string): Promise<Comparison[]>;
  getLatestComparison(competitorSetId: string): Promise<Comparison | undefined>;
  
  // Historical tracking management
  createOrUpdateHistoricalTracking(url: string, domain?: string): Promise<HistoricalTracking>;
  getHistoricalTracking(id: string): Promise<HistoricalTracking | undefined>;
  getHistoricalTrackingByUrl(url: string): Promise<HistoricalTracking | undefined>;
  getActiveTrackings(): Promise<HistoricalTracking[]>;
  updateTrackingStats(trackingId: string, auditDate: Date): Promise<void>;
  deactivateTracking(id: string): Promise<boolean>;
  
  // Performance history management
  createPerformanceHistory(history: InsertPerformanceHistory): Promise<PerformanceHistory>;
  getPerformanceHistoryByTracking(trackingId: string, limit?: number): Promise<PerformanceHistory[]>;
  getPerformanceHistoryByDateRange(trackingId: string, startDate: Date, endDate: Date): Promise<PerformanceHistory[]>;
  getLatestPerformanceHistory(trackingId: string): Promise<PerformanceHistory | undefined>;
  
  // Trend analysis management  
  createOrUpdateTrendAnalysis(analysis: InsertTrendAnalysis): Promise<TrendAnalysis>;
  getTrendAnalysis(trackingId: string, timePeriod: string): Promise<TrendAnalysis | undefined>;
  getTrendAnalysesByTracking(trackingId: string): Promise<TrendAnalysis[]>;
  
  // Historical data utilities
  recordAuditInHistory(auditReport: AuditReport): Promise<{tracking: HistoricalTracking, history: PerformanceHistory}>;
  getHistoricalTrackingStatistics(): Promise<any>;
  cleanupExpiredData(retentionDays?: number): Promise<{deleted: number}>;
  canonicalizeUrl(url: string): string;
}

export class DatabaseStorage implements IStorage {
  private insightsService: HistoricalInsightsService;

  constructor() {
    this.insightsService = new HistoricalInsightsService(this);
  }
  async getUser(id: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
    return result[0];
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.username, username)).limit(1);
    return result[0];
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const result = await db.insert(users).values(insertUser).returning();
    return result[0];
  }

  async createAuditReport(insertReport: InsertAuditReport): Promise<AuditReport> {
    const result = await db.insert(auditReports).values(insertReport).returning();
    return result[0];
  }

  async getAuditReport(id: string): Promise<AuditReport | undefined> {
    const result = await db.select().from(auditReports).where(eq(auditReports.id, id)).limit(1);
    return result[0];
  }

  async getAuditReportsByUrl(url: string): Promise<AuditReport[]> {
    const result = await db.select().from(auditReports)
      .where(eq(auditReports.url, url))
      .orderBy(auditReports.analysisDate);
    return result.reverse(); // Most recent first
  }

  async getAuditReports(opts?: { limit?: number; offset?: number; url?: string }): Promise<AuditReport[]> {
    let query = db.select().from(auditReports);
    
    // Filter by URL if specified
    if (opts?.url) {
      query = query.where(eq(auditReports.url, opts.url));
    }
    
    // Order by analysis date (newest first)
    query = query.orderBy(desc(auditReports.analysisDate));
    
    // Apply pagination
    const limit = opts?.limit || 50;
    const offset = opts?.offset || 0;
    query = query.limit(limit).offset(offset);
    
    const result = await query;
    return result;
  }

  // Competitor set management
  async createCompetitorSet(insertCompetitorSet: InsertCompetitorSet): Promise<CompetitorSet> {
    const result = await db.insert(competitorSets).values(insertCompetitorSet).returning();
    return result[0];
  }

  async getCompetitorSet(id: string): Promise<CompetitorSet | undefined> {
    const result = await db.select().from(competitorSets).where(eq(competitorSets.id, id)).limit(1);
    return result[0];
  }

  async getCompetitorSets(): Promise<CompetitorSet[]> {
    const result = await db.select().from(competitorSets).orderBy(desc(competitorSets.createdAt));
    return result;
  }

  async updateCompetitorSet(id: string, updates: Partial<InsertCompetitorSet>): Promise<CompetitorSet | undefined> {
    const result = await db.update(competitorSets)
      .set({ ...updates, updatedAt: sql`now()` })
      .where(eq(competitorSets.id, id))
      .returning();
    return result[0];
  }

  async deleteCompetitorSet(id: string): Promise<boolean> {
    const result = await db.delete(competitorSets).where(eq(competitorSets.id, id));
    return result.rowCount > 0;
  }

  // Competitor management
  async addCompetitor(insertCompetitor: InsertCompetitor): Promise<Competitor> {
    const result = await db.insert(competitors).values(insertCompetitor).returning();
    return result[0];
  }

  async getCompetitor(id: string): Promise<Competitor | undefined> {
    const result = await db.select().from(competitors).where(eq(competitors.id, id)).limit(1);
    return result[0];
  }

  async getCompetitorsBySet(competitorSetId: string): Promise<Competitor[]> {
    const result = await db.select().from(competitors)
      .where(eq(competitors.competitorSetId, competitorSetId))
      .orderBy(competitors.addedAt);
    return result;
  }

  async updateCompetitor(id: string, updates: Partial<InsertCompetitor>): Promise<Competitor | undefined> {
    const result = await db.update(competitors)
      .set(updates)
      .where(eq(competitors.id, id))
      .returning();
    return result[0];
  }

  async removeCompetitor(id: string): Promise<boolean> {
    const result = await db.delete(competitors).where(eq(competitors.id, id));
    return result.rowCount > 0;
  }

  // Comparison management
  async createComparison(insertComparison: InsertComparison): Promise<Comparison> {
    const result = await db.insert(comparisons).values(insertComparison).returning();
    return result[0];
  }

  async getComparison(id: string): Promise<Comparison | undefined> {
    const result = await db.select().from(comparisons).where(eq(comparisons.id, id)).limit(1);
    return result[0];
  }

  async getComparisonsBySet(competitorSetId: string): Promise<Comparison[]> {
    const result = await db.select().from(comparisons)
      .where(eq(comparisons.competitorSetId, competitorSetId))
      .orderBy(desc(comparisons.createdAt));
    return result;
  }

  async getLatestComparison(competitorSetId: string): Promise<Comparison | undefined> {
    const result = await db.select().from(comparisons)
      .where(eq(comparisons.competitorSetId, competitorSetId))
      .orderBy(desc(comparisons.createdAt))
      .limit(1);
    return result[0];
  }

  // Historical tracking management
  async createOrUpdateHistoricalTracking(url: string, domain?: string): Promise<HistoricalTracking> {
    const canonicalUrl = this.canonicalizeUrl(url);
    const extractedDomain = domain || this.extractDomain(canonicalUrl);
    
    // Try to find existing tracking record
    const existing = await this.getHistoricalTrackingByUrl(canonicalUrl);
    if (existing) {
      return existing;
    }

    // Create new tracking record (start with 0, updateTrackingStats will increment to 1)
    const result = await db.insert(historicalTracking).values({
      url: canonicalUrl,
      domain: extractedDomain,
      totalAudits: 0,
      isActive: true,
    }).returning();
    return result[0];
  }

  async getHistoricalTracking(id: string): Promise<HistoricalTracking | undefined> {
    const result = await db.select().from(historicalTracking).where(eq(historicalTracking.id, id)).limit(1);
    return result[0];
  }

  async getHistoricalTrackingByUrl(url: string): Promise<HistoricalTracking | undefined> {
    const canonicalUrl = this.canonicalizeUrl(url);
    const result = await db.select().from(historicalTracking)
      .where(eq(historicalTracking.url, canonicalUrl))
      .limit(1);
    return result[0];
  }

  async getActiveTrackings(): Promise<HistoricalTracking[]> {
    const result = await db.select().from(historicalTracking)
      .where(eq(historicalTracking.isActive, true))
      .orderBy(desc(historicalTracking.lastAuditDate));
    return result;
  }

  async updateTrackingStats(trackingId: string, auditDate: Date): Promise<void> {
    await db.update(historicalTracking)
      .set({ 
        lastAuditDate: auditDate,
        totalAudits: sql`${historicalTracking.totalAudits} + 1`
      })
      .where(eq(historicalTracking.id, trackingId));
  }

  async deactivateTracking(id: string): Promise<boolean> {
    const result = await db.update(historicalTracking)
      .set({ isActive: false })
      .where(eq(historicalTracking.id, id));
    return result.rowCount > 0;
  }

  // Performance history management
  async createPerformanceHistory(history: InsertPerformanceHistory): Promise<PerformanceHistory> {
    const result = await db.insert(performanceHistory).values({
      ...history,
      scoreChanges: history.scoreChanges as any,
      trendData: history.trendData as any,
      significantChanges: history.significantChanges as any,
    }).returning();
    return result[0];
  }

  async getPerformanceHistoryByTracking(trackingId: string, limit?: number): Promise<PerformanceHistory[]> {
    const query = db.select().from(performanceHistory)
      .where(eq(performanceHistory.historicalTrackingId, trackingId))
      .orderBy(desc(performanceHistory.recordedAt));
    
    if (limit) {
      return await query.limit(limit);
    }
    
    return await query;
  }

  async getPerformanceHistoryByDateRange(trackingId: string, startDate: Date, endDate: Date): Promise<PerformanceHistory[]> {
    const result = await db.select().from(performanceHistory)
      .where(
        and(
          eq(performanceHistory.historicalTrackingId, trackingId),
          gte(performanceHistory.recordedAt, startDate),
          lte(performanceHistory.recordedAt, endDate)
        )
      )
      .orderBy(performanceHistory.recordedAt);
    return result;
  }

  async getLatestPerformanceHistory(trackingId: string): Promise<PerformanceHistory | undefined> {
    const result = await db.select().from(performanceHistory)
      .where(eq(performanceHistory.historicalTrackingId, trackingId))
      .orderBy(desc(performanceHistory.recordedAt))
      .limit(1);
    return result[0];
  }

  // Trend analysis management
  async createOrUpdateTrendAnalysis(analysis: InsertTrendAnalysis): Promise<TrendAnalysis> {
    // Try to find existing analysis for the same tracking and time period
    const existing = await this.getTrendAnalysis(analysis.historicalTrackingId, analysis.timePeriod);
    
    if (existing) {
      // Update existing analysis
      const result = await db.update(trendAnalysis)
        .set({ 
          ...analysis, 
          analysisDate: sql`now()`,
          keyInsights: analysis.keyInsights as any,
          improvements: analysis.improvements as any,
          regressions: analysis.regressions as any,
          recommendations: analysis.recommendations as any
        })
        .where(eq(trendAnalysis.id, existing.id))
        .returning();
      return result[0];
    } else {
      // Create new analysis
      const result = await db.insert(trendAnalysis).values({
        ...analysis,
        keyInsights: analysis.keyInsights as any,
        improvements: analysis.improvements as any,
        regressions: analysis.regressions as any,
        recommendations: analysis.recommendations as any
      }).returning();
      return result[0];
    }
  }

  async getTrendAnalysis(trackingId: string, timePeriod: string): Promise<TrendAnalysis | undefined> {
    const result = await db.select().from(trendAnalysis)
      .where(
        and(
          eq(trendAnalysis.historicalTrackingId, trackingId),
          eq(trendAnalysis.timePeriod, timePeriod as any)
        )
      )
      .limit(1);
    return result[0];
  }

  async getTrendAnalysesByTracking(trackingId: string): Promise<TrendAnalysis[]> {
    const result = await db.select().from(trendAnalysis)
      .where(eq(trendAnalysis.historicalTrackingId, trackingId))
      .orderBy(desc(trendAnalysis.analysisDate));
    return result;
  }

  // Historical data utilities
  async recordAuditInHistory(auditReport: AuditReport): Promise<{tracking: HistoricalTracking, history: PerformanceHistory}> {
    // Create or get historical tracking record
    const tracking = await this.createOrUpdateHistoricalTracking(auditReport.url);

    // Get the previous performance history for score changes calculation
    const previousHistory = await this.getLatestPerformanceHistory(tracking.id);

    // Extract scores from audit report
    const seoScore = auditReport.seoScoring ? Math.round((auditReport.seoScoring as any).overallScore || 0) : null;
    const accessibilityScore = auditReport.accessibilityScoring ? Math.round((auditReport.accessibilityScoring as any).overallScore || 0) : null;
    const mobileScore = auditReport.mobileAnalysis ? Math.round((auditReport.mobileAnalysis as any).overallScore || 0) : null;
    const performanceScore = auditReport.performanceMetrics ? this.calculatePerformanceScore(auditReport.performanceMetrics as any) : null;

    // Calculate score changes if we have previous data
    const scoreChanges = previousHistory ? this.calculateScoreChanges(previousHistory, {
      overall: auditReport.overallScore,
      seo: seoScore,
      accessibility: accessibilityScore,
      mobile: mobileScore,
      performance: performanceScore
    }) : undefined;

    // Create performance history record
    const history = await this.createPerformanceHistory({
      historicalTrackingId: tracking.id,
      auditReportId: auditReport.id,
      overallScore: auditReport.overallScore,
      seoScore,
      accessibilityScore,
      mobileScore,
      performanceScore,
      scoreChanges: scoreChanges as any,
    });

    // Update tracking stats
    await this.updateTrackingStats(tracking.id, auditReport.analysisDate);

    // Trigger automatic insights generation (fire and forget)
    this.insightsService.onNewAuditRecorded(tracking.id).catch(error => {
      console.error(`Failed to generate insights for tracking ${tracking.id}:`, error);
    });

    return { tracking, history };
  }

  async cleanupExpiredData(retentionDays?: number): Promise<{deleted: number}> {
    let totalDeleted = 0;

    if (retentionDays) {
      // Global cleanup: delete data older than specified retention days
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

      // Delete old performance history records
      const historyResult = await db.delete(performanceHistory)
        .where(lt(performanceHistory.recordedAt, cutoffDate));
      totalDeleted += historyResult.rowCount || 0;

      // Delete old trend analysis records  
      const trendResult = await db.delete(trendAnalysis)
        .where(lt(trendAnalysis.analysisDate, cutoffDate));
      totalDeleted += trendResult.rowCount || 0;
    } else {
      // Per-tracking cleanup: respect each tracking's retention policy
      const activeTrackings = await this.getActiveTrackings();
      
      for (const tracking of activeTrackings) {
        const trackingCutoffDate = new Date();
        trackingCutoffDate.setDate(trackingCutoffDate.getDate() - tracking.retentionDays);

        // Delete old performance history for this tracking
        const historyResult = await db.delete(performanceHistory)
          .where(
            and(
              eq(performanceHistory.historicalTrackingId, tracking.id),
              lt(performanceHistory.recordedAt, trackingCutoffDate)
            )
          );
        totalDeleted += historyResult.rowCount || 0;

        // Delete old trend analysis for this tracking
        const trendResult = await db.delete(trendAnalysis)
          .where(
            and(
              eq(trendAnalysis.historicalTrackingId, tracking.id),
              lt(trendAnalysis.analysisDate, trackingCutoffDate)
            )
          );
        totalDeleted += trendResult.rowCount || 0;
      }
    }

    return { deleted: totalDeleted };
  }

  canonicalizeUrl(url: string): string {
    try {
      const parsed = new URL(url);
      // Normalize protocol to https
      parsed.protocol = 'https:';
      // Remove trailing slash from pathname
      if (parsed.pathname.endsWith('/') && parsed.pathname.length > 1) {
        parsed.pathname = parsed.pathname.slice(0, -1);
      }
      // Sort search params for consistency
      parsed.searchParams.sort();
      // Remove fragment
      parsed.hash = '';
      return parsed.toString();
    } catch {
      // If URL parsing fails, return cleaned version
      return url.trim().toLowerCase()
        .replace(/^http:\/\//, 'https://')
        .replace(/\/$/, '')
        .split('#')[0]; // Remove fragment
    }
  }

  async getHistoricalTrackingStatistics(): Promise<any> {
    try {
      // Get all active trackings
      const activeTrackings = await this.getActiveTrackings();
      
      // Calculate total active trackings
      const totalActiveTrackings = activeTrackings.length;
      
      // Calculate total historical audits
      const totalHistoricalAudits = activeTrackings.reduce((sum, tracking) => sum + tracking.totalAudits, 0);
      
      // Calculate average audits per tracking
      const averageAuditsPerTracking = totalActiveTrackings > 0 ? Math.round(totalHistoricalAudits / totalActiveTrackings * 10) / 10 : 0;
      
      // Calculate top domains by tracking count
      const domainCounts: Record<string, number> = {};
      activeTrackings.forEach(tracking => {
        domainCounts[tracking.domain] = (domainCounts[tracking.domain] || 0) + 1;
      });
      
      const topDomains = Object.entries(domainCounts)
        .map(([domain, trackingCount]) => ({ domain, trackingCount }))
        .sort((a, b) => b.trackingCount - a.trackingCount)
        .slice(0, 5);
      
      // Find oldest and most recent trackings
      const oldestTracking = activeTrackings.length > 0 
        ? activeTrackings.reduce((oldest, current) => 
            new Date(oldest.trackingStartDate) < new Date(current.trackingStartDate) ? oldest : current
          )
        : null;
      
      const mostRecentAudit = activeTrackings.length > 0
        ? activeTrackings.reduce((most, current) => {
            if (!current.lastAuditDate) return most;
            if (!most.lastAuditDate) return current;
            return new Date(most.lastAuditDate) > new Date(current.lastAuditDate) ? most : current;
          })
        : null;
      
      return {
        totalActiveTrackings,
        totalHistoricalAudits,
        averageAuditsPerTracking,
        topDomains,
        oldestTracking,
        mostRecentAudit
      };
    } catch (error) {
      console.error('Error getting historical tracking statistics:', error);
      return {
        totalActiveTrackings: 0,
        totalHistoricalAudits: 0,
        averageAuditsPerTracking: 0,
        topDomains: [],
        oldestTracking: null,
        mostRecentAudit: null
      };
    }
  }

  // Helper methods
  private extractDomain(url: string): string {
    try {
      return new URL(url).hostname;
    } catch {
      // Fallback extraction for invalid URLs
      const match = url.match(/^https?:\/\/([^\/]+)/);
      return match ? match[1] : url;
    }
  }

  private calculatePerformanceScore(metrics: any): number {
    // Simple performance scoring based on load time and content size
    const loadTime = metrics.loadTime || 0;
    const contentSize = metrics.contentSize || 0;
    
    let score = 100;
    
    // Penalize slow load times (over 3 seconds)
    if (loadTime > 3000) {
      score -= Math.min(50, (loadTime - 3000) / 100);
    }
    
    // Penalize large content size (over 2MB)
    if (contentSize > 2000000) {
      score -= Math.min(30, (contentSize - 2000000) / 100000);
    }
    
    return Math.max(0, Math.round(score));
  }

  private calculateScoreChanges(previous: PerformanceHistory, current: {overall: number, seo: number | null, accessibility: number | null, mobile: number | null, performance: number | null}) {
    const changes: any = {
      overall: {
        previous: previous.overallScore,
        current: current.overall,
        change: current.overall - previous.overallScore,
        percentage: previous.overallScore > 0 ? Math.round(((current.overall - previous.overallScore) / previous.overallScore) * 100) : 0
      }
    };

    if (previous.seoScore !== null && current.seo !== null) {
      changes.seo = {
        previous: previous.seoScore,
        current: current.seo,
        change: current.seo - previous.seoScore,
        percentage: previous.seoScore > 0 ? Math.round(((current.seo - previous.seoScore) / previous.seoScore) * 100) : 0
      };
    }

    if (previous.accessibilityScore !== null && current.accessibility !== null) {
      changes.accessibility = {
        previous: previous.accessibilityScore,
        current: current.accessibility,
        change: current.accessibility - previous.accessibilityScore,
        percentage: previous.accessibilityScore > 0 ? Math.round(((current.accessibility - previous.accessibilityScore) / previous.accessibilityScore) * 100) : 0
      };
    }

    if (previous.mobileScore !== null && current.mobile !== null) {
      changes.mobile = {
        previous: previous.mobileScore,
        current: current.mobile,
        change: current.mobile - previous.mobileScore,
        percentage: previous.mobileScore > 0 ? Math.round(((current.mobile - previous.mobileScore) / previous.mobileScore) * 100) : 0
      };
    }

    if (previous.performanceScore !== null && current.performance !== null) {
      changes.performance = {
        previous: previous.performanceScore,
        current: current.performance,
        change: current.performance - previous.performanceScore,
        percentage: previous.performanceScore > 0 ? Math.round(((current.performance - previous.performanceScore) / previous.performanceScore) * 100) : 0
      };
    }

    return changes;
  }
}

// Temporarily using MemStorage to test application
export const storage = new MemStorage();
// export const storage = new DatabaseStorage(); // Switch when PostgreSQL tables are ready
