import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { AuditService } from "./services/audit";
import { PDFService } from "./services/pdf";
import { CompetitiveAnalysisService } from "./services/competitive";
import { HistoricalInsightsService } from "./services/historical-insights.service";
import { 
  auditRequestSchema, 
  bulkAnalysisRequestSchema,
  competitorSetRequestSchema, 
  competitorRequestSchema 
} from "@shared/schema";

export async function registerRoutes(app: Express): Promise<Server> {
  const auditService = new AuditService();
  const competitiveService = new CompetitiveAnalysisService();
  const historicalInsightsService = new HistoricalInsightsService(storage);

  app.post("/api/audit", async (req, res) => {
    try {
      const { url } = auditRequestSchema.parse(req.body);
      
      const auditResults = await auditService.auditWebsite(url);
      
      const report = await storage.createAuditReport({
        url,
        overallScore: auditResults.overallScore,
        metaTags: auditResults.metaTags,
        accessibilityIssues: auditResults.accessibilityIssues,
        accessibilityScoring: auditResults.accessibilityScoring,
        seoScoring: auditResults.seoScoring,
        mobileAnalysis: auditResults.mobileAnalysis,
        brokenLinks: auditResults.brokenLinks,
        performanceMetrics: auditResults.performanceMetrics,
        recommendations: auditResults.recommendations,
        statistics: auditResults.statistics
      });

      // Record audit history for trend analysis
      console.log('🔄 Recording audit in history for URL:', report.url);
      const { tracking } = await storage.recordAuditInHistory(report);
      console.log('✅ Historical tracking created/updated:', {
        trackingId: tracking.id,
        domain: tracking.domain,
        totalAudits: tracking.totalAudits,
        isActive: tracking.isActive
      });

      // Trigger AI insights generation in background (fire-and-forget)
      historicalInsightsService.onNewAuditRecorded(tracking.id).catch(error => {
        console.error('Historical insights generation failed:', error);
      });

      res.json(report);
    } catch (error) {
      if (error instanceof Error) {
        res.status(400).json({ message: error.message });
      } else {
        res.status(500).json({ message: "Internal server error" });
      }
    }
  });

  app.get("/api/audit/by-url/:url", async (req, res) => {
    try {
      const { url } = req.params;
      const decodedUrl = decodeURIComponent(url);
      const reports = await storage.getAuditReportsByUrl(decodedUrl);
      
      res.json(reports);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/audit/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const report = await storage.getAuditReport(id);
      
      if (!report) {
        res.status(404).json({ message: "Audit report not found" });
        return;
      }

      res.json(report);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/audit", async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;
      const url = req.query.url as string;
      
      const reports = await storage.getAuditReports({ limit, offset, url });
      
      res.json(reports);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/audit/:id/pdf", async (req, res) => {
    try {
      const { id } = req.params;
      
      // Get the audit report from storage
      const report = await storage.getAuditReport(id);
      
      if (!report) {
        return res.status(404).json({ message: "Audit report not found" });
      }
      
      // Generate PDF using the PDF service
      const pdfBuffer = await PDFService.generateAuditReportPDF(report);
      
      // Set appropriate headers for PDF download
      const filename = `audit-report-${report.url.replace(/[^a-z0-9]/gi, '_').toLowerCase()}-${new Date().toISOString().split('T')[0]}.pdf`;
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Length', pdfBuffer.length);
      
      // Send the PDF
      res.send(pdfBuffer);
    } catch (error) {
      console.error('PDF generation error:', error);
      if (error instanceof Error) {
        res.status(500).json({ message: `PDF generation failed: ${error.message}` });
      } else {
        res.status(500).json({ message: "PDF generation failed due to internal server error" });
      }
    }
  });

  // Bulk analysis endpoints
  app.post("/api/bulk-analysis", async (req, res) => {
    try {
      const { urls } = bulkAnalysisRequestSchema.parse(req.body);
      
      const results: any[] = [];
      const errors: any[] = [];
      
      // Process URLs with controlled concurrency (3 at a time)
      const concurrency = 3;
      for (let i = 0; i < urls.length; i += concurrency) {
        const batch = urls.slice(i, i + concurrency);
        const batchPromises = batch.map(async (url) => {
          try {
            const auditResults = await auditService.auditWebsite(url);
            const report = await storage.createAuditReport({
              url,
              overallScore: auditResults.overallScore,
              metaTags: auditResults.metaTags,
              accessibilityIssues: auditResults.accessibilityIssues,
              accessibilityScoring: auditResults.accessibilityScoring,
              seoScoring: auditResults.seoScoring,
              mobileAnalysis: auditResults.mobileAnalysis,
              brokenLinks: auditResults.brokenLinks,
              performanceMetrics: auditResults.performanceMetrics,
              recommendations: auditResults.recommendations,
              statistics: auditResults.statistics
            });

            // Record audit history for trend analysis
            const { tracking } = await storage.recordAuditInHistory(report);
            
            // Trigger AI insights generation in background (fire-and-forget)
            historicalInsightsService.onNewAuditRecorded(tracking.id).catch(error => {
              console.error('Historical insights generation failed for:', url, error);
            });

            return { status: 'success', url, report };
          } catch (error) {
            return { 
              status: 'error', 
              url, 
              error: error instanceof Error ? error.message : 'Unknown error' 
            };
          }
        });
        
        const batchResults = await Promise.all(batchPromises);
        
        // Separate successes and errors
        for (const result of batchResults) {
          if (result.status === 'success') {
            results.push(result.report);
          } else {
            errors.push({ url: result.url, error: result.error });
          }
        }
      }
      
      res.json({
        totalUrls: urls.length,
        successCount: results.length,
        errorCount: errors.length,
        results,
        errors
      });
      
    } catch (error) {
      if (error instanceof Error) {
        res.status(400).json({ message: error.message });
      } else {
        res.status(500).json({ message: "Internal server error" });
      }
    }
  });

  app.get("/api/bulk-analysis", async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;
      
      // For bulk analysis list, we return recent audit reports
      const reports = await storage.getAuditReports({ limit, offset });
      
      res.json(reports);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Competitor Set Management
  app.get("/api/competitor-sets", async (req, res) => {
    try {
      const competitorSets = await storage.getCompetitorSets();
      res.json(competitorSets);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/competitor-sets", async (req, res) => {
    try {
      const competitorSetData = competitorSetRequestSchema.parse(req.body);
      const competitorSet = await storage.createCompetitorSet(competitorSetData);
      res.status(201).json(competitorSet);
    } catch (error) {
      if (error instanceof Error) {
        res.status(400).json({ message: error.message });
      } else {
        res.status(500).json({ message: "Internal server error" });
      }
    }
  });

  app.get("/api/competitor-sets/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const competitorSet = await storage.getCompetitorSet(id);
      
      if (!competitorSet) {
        res.status(404).json({ message: "Competitor set not found" });
        return;
      }

      // Also fetch competitors for this set
      const competitors = await storage.getCompetitorsBySet(id);
      res.json({ ...competitorSet, competitors });
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.put("/api/competitor-sets/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const updates = competitorSetRequestSchema.parse(req.body);
      
      const competitorSet = await storage.updateCompetitorSet(id, updates);
      
      if (!competitorSet) {
        res.status(404).json({ message: "Competitor set not found" });
        return;
      }

      res.json(competitorSet);
    } catch (error) {
      if (error instanceof Error) {
        res.status(400).json({ message: error.message });
      } else {
        res.status(500).json({ message: "Internal server error" });
      }
    }
  });

  app.delete("/api/competitor-sets/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const deleted = await storage.deleteCompetitorSet(id);
      
      if (!deleted) {
        res.status(404).json({ message: "Competitor set not found" });
        return;
      }

      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Competitor Management within Sets
  app.get("/api/competitor-sets/:setId/competitors", async (req, res) => {
    try {
      const { setId } = req.params;
      const competitors = await storage.getCompetitorsBySet(setId);
      res.json(competitors);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/competitor-sets/:setId/competitors", async (req, res) => {
    try {
      const { setId } = req.params;
      const competitorData = competitorRequestSchema.parse(req.body);
      
      const competitor = await storage.addCompetitor({
        ...competitorData,
        competitorSetId: setId
      });
      
      res.status(201).json(competitor);
    } catch (error) {
      if (error instanceof Error) {
        res.status(400).json({ message: error.message });
      } else {
        res.status(500).json({ message: "Internal server error" });
      }
    }
  });

  app.put("/api/competitors/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const updates = competitorRequestSchema.parse(req.body);
      
      const competitor = await storage.updateCompetitor(id, updates);
      
      if (!competitor) {
        res.status(404).json({ message: "Competitor not found" });
        return;
      }

      res.json(competitor);
    } catch (error) {
      if (error instanceof Error) {
        res.status(400).json({ message: error.message });
      } else {
        res.status(500).json({ message: "Internal server error" });
      }
    }
  });

  app.delete("/api/competitors/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const deleted = await storage.removeCompetitor(id);
      
      if (!deleted) {
        res.status(404).json({ message: "Competitor not found" });
        return;
      }

      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Competitive Analysis
  app.post("/api/competitor-sets/:setId/compare", async (req, res) => {
    try {
      const { setId } = req.params;
      
      console.log(`Starting competitive analysis for set ${setId}`);
      const analysis = await competitiveService.runCompetitiveAnalysis(setId);
      
      // Save the comparison results to database
      const comparison = await storage.createComparison({
        competitorSetId: setId,
        primaryAuditId: analysis.primaryAudit.id,
        competitorAudits: analysis.competitorAudits.map(ca => ({
          competitorId: ca.competitor.id,
          auditReportId: ca.audit.id,
          ranking: analysis.rankings.overall.find(r => r.competitorId === ca.competitor.id)?.rank || 0
        })),
        competitiveScores: {
          rankings: analysis.rankings,
          industryBenchmarks: analysis.industryBenchmarks
        },
        gapAnalysis: analysis.gapAnalysis,
        opportunities: analysis.opportunities,
        industryBenchmarks: analysis.industryBenchmarks
      });

      res.status(201).json({
        comparisonId: comparison.id,
        analysis
      });
    } catch (error) {
      console.error('Competitive analysis error:', error);
      if (error instanceof Error) {
        res.status(400).json({ message: error.message });
      } else {
        res.status(500).json({ message: "Competitive analysis failed" });
      }
    }
  });

  app.get("/api/competitor-sets/:setId/comparisons", async (req, res) => {
    try {
      const { setId } = req.params;
      const comparisons = await storage.getComparisonsBySet(setId);
      res.json(comparisons);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/comparisons/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const comparison = await storage.getComparison(id);
      
      if (!comparison) {
        res.status(404).json({ message: "Comparison not found" });
        return;
      }

      res.json(comparison);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/competitor-sets/:setId/latest-comparison", async (req, res) => {
    try {
      const { setId } = req.params;
      const comparison = await storage.getLatestComparison(setId);
      
      if (!comparison) {
        res.status(404).json({ message: "No comparisons found for this set" });
        return;
      }

      res.json(comparison);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Historical Tracking Management
  app.get("/api/historical-tracking", async (req, res) => {
    try {
      const trackings = await storage.getActiveTrackings();
      res.json(trackings);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Historical Tracking Statistics (must come before /:id route)
  app.get("/api/historical-tracking/statistics", async (req, res) => {
    try {
      console.log('📊 Statistics endpoint called');
      const trackings = await storage.getActiveTrackings();
      console.log('📈 Active trackings count:', trackings.length);
      
      const statistics = await storage.getHistoricalTrackingStatistics();
      console.log('📊 Computed statistics:', {
        totalActiveTrackings: statistics.totalActiveTrackings,
        totalHistoricalAudits: statistics.totalHistoricalAudits,
        averageAuditsPerTracking: statistics.averageAuditsPerTracking
      });
      
      res.json(statistics);
    } catch (error) {
      console.error('❌ Statistics endpoint error:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/historical-tracking/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const tracking = await storage.getHistoricalTracking(id);
      
      if (!tracking) {
        res.status(404).json({ message: "Historical tracking not found" });
        return;
      }

      res.json(tracking);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/historical-tracking/by-url/:url", async (req, res) => {
    try {
      const { url } = req.params;
      const decodedUrl = decodeURIComponent(url);
      const tracking = await storage.getHistoricalTrackingByUrl(decodedUrl);
      
      if (!tracking) {
        res.status(404).json({ message: "No historical tracking found for this URL" });
        return;
      }

      res.json(tracking);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/audit/:id/record-history", async (req, res) => {
    try {
      const { id } = req.params;
      const report = await storage.getAuditReport(id);
      
      if (!report) {
        res.status(404).json({ message: "Audit report not found" });
        return;
      }

      const result = await storage.recordAuditInHistory(report);
      res.status(201).json(result);
    } catch (error) {
      if (error instanceof Error) {
        res.status(400).json({ message: error.message });
      } else {
        res.status(500).json({ message: "Internal server error" });
      }
    }
  });

  app.delete("/api/historical-tracking/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const deactivated = await storage.deactivateTracking(id);
      
      if (!deactivated) {
        res.status(404).json({ message: "Historical tracking not found" });
        return;
      }

      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });


  // Performance History
  app.get("/api/historical-tracking/:id/performance-history", async (req, res) => {
    try {
      const { id } = req.params;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;
      
      const tracking = await storage.getHistoricalTracking(id);
      if (!tracking) {
        res.status(404).json({ message: "Historical tracking not found" });
        return;
      }

      const history = await storage.getPerformanceHistoryByTracking(id, limit);
      res.json(history);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/historical-tracking/:id/performance-history/latest", async (req, res) => {
    try {
      const { id } = req.params;
      
      const tracking = await storage.getHistoricalTracking(id);
      if (!tracking) {
        res.status(404).json({ message: "Historical tracking not found" });
        return;
      }

      const latest = await storage.getLatestPerformanceHistory(id);
      if (!latest) {
        res.status(404).json({ message: "No performance history found" });
        return;
      }

      res.json(latest);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/historical-tracking/:id/performance-history/date-range", async (req, res) => {
    try {
      const { id } = req.params;
      const { startDate, endDate } = req.query;

      if (!startDate || !endDate) {
        res.status(400).json({ message: "startDate and endDate query parameters are required" });
        return;
      }

      const tracking = await storage.getHistoricalTracking(id);
      if (!tracking) {
        res.status(404).json({ message: "Historical tracking not found" });
        return;
      }

      const start = new Date(startDate as string);
      const end = new Date(endDate as string);

      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        res.status(400).json({ message: "Invalid date format" });
        return;
      }

      const history = await storage.getPerformanceHistoryByDateRange(id, start, end);
      res.json(history);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Trend Analysis
  app.get("/api/historical-tracking/:id/trend-analysis", async (req, res) => {
    try {
      const { id } = req.params;
      
      const tracking = await storage.getHistoricalTracking(id);
      if (!tracking) {
        res.status(404).json({ message: "Historical tracking not found" });
        return;
      }

      const analyses = await storage.getTrendAnalysesByTracking(id);
      res.json(analyses);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/historical-tracking/:id/trend-analysis/:period", async (req, res) => {
    try {
      const { id, period } = req.params;
      
      const tracking = await storage.getHistoricalTracking(id);
      if (!tracking) {
        res.status(404).json({ message: "Historical tracking not found" });
        return;
      }

      const analysis = await storage.getTrendAnalysis(id, period);
      if (!analysis) {
        res.status(404).json({ message: "Trend analysis not found for this period" });
        return;
      }

      res.json(analysis);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // By-URL endpoints that resolve URLs to tracking IDs internally
  app.get("/api/historical-tracking/by-url/:url/performance-history", async (req, res) => {
    try {
      const { url } = req.params;
      const decodedUrl = decodeURIComponent(url);
      const canonicalUrl = storage.canonicalizeUrl(decodedUrl);
      
      const tracking = await storage.getHistoricalTrackingByUrl(canonicalUrl);
      if (!tracking) {
        res.status(404).json({ message: "No historical tracking found for this URL" });
        return;
      }

      const history = await storage.getPerformanceHistoryByTracking(tracking.id);
      res.json(history);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/historical-tracking/by-url/:url/trend-analysis", async (req, res) => {
    try {
      const { url } = req.params;
      const decodedUrl = decodeURIComponent(url);
      const canonicalUrl = storage.canonicalizeUrl(decodedUrl);
      
      const tracking = await storage.getHistoricalTrackingByUrl(canonicalUrl);
      if (!tracking) {
        res.status(404).json({ message: "No historical tracking found for this URL" });
        return;
      }

      const analyses = await storage.getTrendAnalysesByTracking(tracking.id);
      res.json(analyses);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/historical-tracking/by-url/:url/trend-analysis/:period", async (req, res) => {
    try {
      const { url, period } = req.params;
      const decodedUrl = decodeURIComponent(url);
      const canonicalUrl = storage.canonicalizeUrl(decodedUrl);
      
      const tracking = await storage.getHistoricalTrackingByUrl(canonicalUrl);
      if (!tracking) {
        res.status(404).json({ message: "No historical tracking found for this URL" });
        return;
      }

      const analysis = await storage.getTrendAnalysis(tracking.id, period);
      if (!analysis) {
        res.status(404).json({ message: "Trend analysis not found for this period" });
        return;
      }

      res.json(analysis);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/historical-tracking/:id/trend-analysis", async (req, res) => {
    try {
      const { id } = req.params;
      const analysisData = req.body;

      const tracking = await storage.getHistoricalTracking(id);
      if (!tracking) {
        res.status(404).json({ message: "Historical tracking not found" });
        return;
      }

      const analysis = await storage.createOrUpdateTrendAnalysis({
        historicalTrackingId: id,
        ...analysisData
      });

      res.status(201).json(analysis);
    } catch (error) {
      if (error instanceof Error) {
        res.status(400).json({ message: error.message });
      } else {
        res.status(500).json({ message: "Internal server error" });
      }
    }
  });

  // Data Management
  app.post("/api/historical-tracking/cleanup", async (req, res) => {
    try {
      const { retentionDays } = req.body;
      const result = await storage.cleanupExpiredData(retentionDays);
      res.json({ 
        message: "Cleanup completed successfully", 
        deleted: result.deleted 
      });
    } catch (error) {
      if (error instanceof Error) {
        res.status(400).json({ message: error.message });
      } else {
        res.status(500).json({ message: "Internal server error" });
      }
    }
  });


  // Test endpoint to populate sample data for historical dashboard testing (development only)
  app.post("/api/test/populate-sample-data", async (req, res) => {
    // Only allow in development environment
    if (process.env.NODE_ENV !== 'development') {
      return res.status(404).json({ message: "Not found" });
    }
    
    try {
      // Create sample audit reports that will automatically create historical tracking data
      const sampleAudits = [
        {
          url: "https://meta.com",
          overallScore: 85,
          metaTags: { title: "Meta", description: "Connect with friends", keywords: "social" },
          accessibilityIssues: [{ type: "contrast", description: "Low contrast", severity: "medium" }],
          accessibilityScoring: { score: 80, maxScore: 100 },
          seoScoring: { score: 85, maxScore: 100 },
          mobileAnalysis: { score: 90, isResponsive: true },
          brokenLinks: [],
          performanceMetrics: { loadTime: 2.1, contentSize: 1500 },
          recommendations: ["Improve color contrast"],
          statistics: { totalElements: 150, totalLinks: 25 }
        },
        {
          url: "https://meta.com",
          overallScore: 88,
          metaTags: { title: "Meta", description: "Connect with friends", keywords: "social" },
          accessibilityIssues: [],
          accessibilityScoring: { score: 85, maxScore: 100 },
          seoScoring: { score: 88, maxScore: 100 },
          mobileAnalysis: { score: 92, isResponsive: true },
          brokenLinks: [],
          performanceMetrics: { loadTime: 1.9, contentSize: 1400 },
          recommendations: ["Great improvements!"],
          statistics: { totalElements: 148, totalLinks: 24 }
        },
        {
          url: "https://tcs.com",
          overallScore: 75,
          metaTags: { title: "TCS", description: "Technology consulting", keywords: "IT, consulting" },
          accessibilityIssues: [{ type: "missing-alt", description: "Missing alt text", severity: "high" }],
          accessibilityScoring: { score: 70, maxScore: 100 },
          seoScoring: { score: 75, maxScore: 100 },
          mobileAnalysis: { score: 80, isResponsive: true },
          brokenLinks: [],
          performanceMetrics: { loadTime: 3.2, contentSize: 2100 },
          recommendations: ["Add alt text to images"],
          statistics: { totalElements: 200, totalLinks: 40 }
        },
        {
          url: "https://google.com",
          overallScore: 95,
          metaTags: { title: "Google", description: "Search the world", keywords: "search, web" },
          accessibilityIssues: [],
          accessibilityScoring: { score: 95, maxScore: 100 },
          seoScoring: { score: 95, maxScore: 100 },
          mobileAnalysis: { score: 98, isResponsive: true },
          brokenLinks: [],
          performanceMetrics: { loadTime: 0.8, contentSize: 500 },
          recommendations: ["Excellent performance!"],
          statistics: { totalElements: 80, totalLinks: 15 }
        }
      ];

      const createdReports = [];
      for (const auditData of sampleAudits) {
        // Create audit report
        const report = await storage.createAuditReport(auditData);
        
        // Record in history (this creates/updates historical tracking)
        await storage.recordAuditInHistory(report);
        
        createdReports.push(report);
      }

      res.json({
        message: "Sample data created successfully",
        reports: createdReports.length,
        audits: createdReports.map(r => ({ id: r.id, url: r.url, score: r.overallScore }))
      });
    } catch (error) {
      console.error('Sample data creation error:', error);
      res.status(500).json({ 
        message: "Failed to create sample data", 
        error: error instanceof Error ? error.message : String(error) 
      });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
