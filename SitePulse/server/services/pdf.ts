import puppeteer from 'puppeteer';
import type { AuditReport } from '@shared/schema';

export class PDFService {
  private static async launchBrowser() {
    try {
      return await puppeteer.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--disable-gpu',
          '--disable-web-security',
          '--disable-features=IsolateOrigins,site-per-process',
          '--disable-background-timer-throttling',
          '--disable-backgrounding-occluded-windows',
          '--disable-renderer-backgrounding'
        ],
        timeout: 60000,
        protocolTimeout: 120000
      });
    } catch (error) {
      console.error('Failed to launch browser:', error);
      throw new Error(`Failed to launch browser: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  static async generateAuditReportPDF(report: AuditReport): Promise<Buffer> {
    let browser;
    let page;
    
    try {
      console.log('Starting PDF generation for report:', report.id);
      browser = await this.launchBrowser();
      console.log('Browser launched successfully');
      
      page = await browser.newPage();
      console.log('Page created');
      
      // Set page format for PDF
      await page.setViewport({ width: 1200, height: 800 });
      
      // Generate HTML content for the audit report
      const htmlContent = this.generateReportHTML(report);
      console.log('HTML content generated, length:', htmlContent.length);
      
      // Set content without request interception (we're using inline HTML only)
      // Request interception can cause issues with PDF generation
      await page.setContent(htmlContent, { 
        waitUntil: 'domcontentloaded', 
        timeout: 60000 
      });
      console.log('Page content set');
      
      // Wait for CSS and rendering to complete
      // Use a simple delay since we have inline styles and no external resources
      await new Promise(resolve => setTimeout(resolve, 2000));
      console.log('Page rendering complete');
      
      // Verify page is still open
      if (page.isClosed()) {
        throw new Error('Page was closed unexpectedly');
      }
      
      console.log('Generating PDF...');
      // Generate PDF with professional settings
      const pdfData = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: {
          top: '20mm',
          right: '15mm',
          bottom: '20mm',
          left: '15mm'
        },
        displayHeaderFooter: true,
        headerTemplate: `
          <div style="font-size: 10px; width: 100%; text-align: center; color: #666;">
            <span style="margin-right: 10px;">SEO & Accessibility Audit Report</span>
            <span style="float: right; margin-right: 1cm;">Generated: ${new Date().toLocaleDateString()}</span>
          </div>
        `,
        footerTemplate: `
          <div style="font-size: 10px; width: 100%; text-align: center; color: #666;">
            <span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span>
          </div>
        `,
        timeout: 60000
      });
      
      console.log('PDF generated, size:', pdfData.length);
      
      // Ensure PDF data is valid
      if (!pdfData || pdfData.length === 0) {
        throw new Error('PDF generation returned empty data');
      }
      
      return Buffer.from(pdfData);
    } catch (error) {
      console.error('PDF generation error details:', error);
      if (error instanceof Error) {
        console.error('Error stack:', error.stack);
      }
      throw new Error(`Failed to generate PDF: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      // Close page first, then browser
      try {
        if (page && !page.isClosed()) {
          await page.close().catch(e => console.warn('Error closing page:', e));
        }
      } catch (e) {
        console.warn('Error closing page:', e);
      }
      
      try {
        if (browser) {
          await browser.close().catch(e => console.warn('Error closing browser:', e));
        }
      } catch (e) {
        console.warn('Error closing browser:', e);
      }
    }
  }

  private static generateReportHTML(report: AuditReport): string {
    // HTML escape utility to prevent injection attacks
    const escapeHtml = (text: string): string => {
      if (typeof text !== 'string') return String(text);
      return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    };

    const formatDate = (date: Date | string) => {
      return new Date(date).toLocaleString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
    };

    const getScoreColor = (score: number) => {
      if (score >= 80) return '#22c55e'; // green
      if (score >= 60) return '#f59e0b'; // amber  
      return '#ef4444'; // red
    };

    const getScoreStatus = (score: number) => {
      if (score >= 80) return 'Excellent';
      if (score >= 60) return 'Good';
      return 'Needs Improvement';
    };

    // Type assertions for report data
    const metaTags = report.metaTags as any;
    const accessibilityIssues = report.accessibilityIssues as any[];
    const accessibilityScoring = report.accessibilityScoring as any;
    const seoScoring = report.seoScoring as any;
    const mobileAnalysis = report.mobileAnalysis as any;
    const brokenLinks = report.brokenLinks as any[];
    const performanceMetrics = report.performanceMetrics as any;
    const recommendations = report.recommendations as any[];
    const statistics = report.statistics as any;

    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>SEO & Accessibility Audit Report</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #333;
            background: #fff;
        }
        
        .container {
            max-width: 100%;
            padding: 0 20px;
        }
        
        .header {
            text-align: center;
            margin-bottom: 40px;
            padding: 30px 0;
            border-bottom: 3px solid #3b82f6;
        }
        
        .header h1 {
            font-size: 32px;
            color: #1e40af;
            margin-bottom: 10px;
        }
        
        .header .subtitle {
            font-size: 18px;
            color: #6b7280;
            margin-bottom: 20px;
        }
        
        .audit-info {
            background: #f8fafc;
            padding: 20px;
            border-radius: 8px;
            margin-bottom: 30px;
            border-left: 4px solid #3b82f6;
        }
        
        .audit-info h2 {
            color: #1e40af;
            margin-bottom: 15px;
            font-size: 20px;
        }
        
        .info-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 15px;
        }
        
        .info-item {
            display: flex;
            justify-content: space-between;
            padding: 8px 0;
            border-bottom: 1px solid #e5e7eb;
        }
        
        .info-label {
            font-weight: 600;
            color: #374151;
        }
        
        .info-value {
            color: #6b7280;
            font-family: monospace;
        }
        
        .score-summary {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 20px;
            margin-bottom: 40px;
        }
        
        .score-card {
            background: #fff;
            border: 2px solid #e5e7eb;
            border-radius: 12px;
            padding: 25px;
            text-align: center;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }
        
        .score-card h3 {
            font-size: 18px;
            margin-bottom: 15px;
            color: #374151;
        }
        
        .score-value {
            font-size: 48px;
            font-weight: bold;
            margin-bottom: 10px;
        }
        
        .score-status {
            font-size: 14px;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 1px;
        }
        
        .section {
            margin-bottom: 40px;
            break-inside: avoid;
        }
        
        .section h2 {
            font-size: 24px;
            color: #1e40af;
            margin-bottom: 20px;
            padding-bottom: 10px;
            border-bottom: 2px solid #e5e7eb;
        }
        
        .subsection {
            margin-bottom: 25px;
        }
        
        .subsection h3 {
            font-size: 18px;
            color: #374151;
            margin-bottom: 15px;
        }
        
        .category-scores {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 15px;
            margin-bottom: 20px;
        }
        
        .category-score {
            background: #f8fafc;
            padding: 15px;
            border-radius: 8px;
            text-align: center;
            border: 1px solid #e5e7eb;
        }
        
        .category-score .score {
            font-size: 24px;
            font-weight: bold;
            margin-bottom: 5px;
        }
        
        .category-score .label {
            font-size: 12px;
            color: #6b7280;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        
        .issues-list {
            list-style: none;
            margin-bottom: 20px;
        }
        
        .issue-item {
            background: #fef2f2;
            border: 1px solid #fecaca;
            border-radius: 6px;
            padding: 15px;
            margin-bottom: 10px;
        }
        
        .issue-item.warning {
            background: #fffbeb;
            border-color: #fed7aa;
        }
        
        .issue-item.good {
            background: #f0fdf4;
            border-color: #bbf7d0;
        }
        
        .issue-header {
            display: flex;
            justify-content: between;
            align-items: center;
            margin-bottom: 8px;
        }
        
        .issue-type {
            font-weight: 600;
            color: #374151;
        }
        
        .issue-severity {
            font-size: 12px;
            padding: 2px 8px;
            border-radius: 12px;
            text-transform: uppercase;
            font-weight: 600;
        }
        
        .issue-severity.critical {
            background: #fecaca;
            color: #dc2626;
        }
        
        .issue-severity.warning {
            background: #fed7aa;
            color: #d97706;
        }
        
        .issue-description {
            color: #6b7280;
            margin-bottom: 8px;
        }
        
        .issue-recommendation {
            background: #f0fdf4;
            border: 1px solid #bbf7d0;
            border-radius: 4px;
            padding: 8px;
            font-size: 14px;
            color: #166534;
        }
        
        .recommendations-grid {
            display: grid;
            grid-template-columns: 1fr;
            gap: 15px;
        }
        
        .recommendation {
            background: #fff;
            border: 1px solid #e5e7eb;
            border-radius: 8px;
            padding: 20px;
        }
        
        .recommendation h4 {
            color: #374151;
            margin-bottom: 10px;
        }
        
        .recommendation .description {
            color: #6b7280;
            margin-bottom: 10px;
        }
        
        .recommendation .meta {
            display: flex;
            gap: 10px;
        }
        
        .badge {
            font-size: 12px;
            padding: 4px 8px;
            border-radius: 12px;
            text-transform: uppercase;
            font-weight: 600;
        }
        
        .badge.high {
            background: #fecaca;
            color: #dc2626;
        }
        
        .badge.medium {
            background: #fed7aa;
            color: #d97706;
        }
        
        .badge.low {
            background: #dbeafe;
            color: #2563eb;
        }
        
        .stats-grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 15px;
        }
        
        .stat-card {
            background: #f8fafc;
            border: 1px solid #e5e7eb;
            border-radius: 8px;
            padding: 15px;
            text-align: center;
        }
        
        .stat-value {
            font-size: 24px;
            font-weight: bold;
            color: #374151;
            margin-bottom: 5px;
        }
        
        .stat-label {
            font-size: 12px;
            color: #6b7280;
            text-transform: uppercase;
        }
        
        @media print {
            .section {
                page-break-inside: avoid;
            }
            
            .score-summary {
                page-break-inside: avoid;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <!-- Header -->
        <div class="header">
            <h1>SEO & Accessibility Audit Report</h1>
            <div class="subtitle">Comprehensive Website Analysis</div>
        </div>

        <!-- Audit Information -->
        <div class="audit-info">
            <h2>Audit Details</h2>
            <div class="info-grid">
                <div class="info-item">
                    <span class="info-label">Website URL:</span>
                    <span class="info-value">${escapeHtml(report.url)}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Analysis Date:</span>
                    <span class="info-value">${formatDate(report.analysisDate)}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Report ID:</span>
                    <span class="info-value">${escapeHtml(report.id)}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Load Time:</span>
                    <span class="info-value">${performanceMetrics?.loadTime || 'N/A'}ms</span>
                </div>
            </div>
        </div>

        <!-- Score Summary -->
        <div class="score-summary">
            <div class="score-card">
                <h3>Overall Score</h3>
                <div class="score-value" style="color: ${getScoreColor(report.overallScore)}">${report.overallScore}</div>
                <div class="score-status" style="color: ${getScoreColor(report.overallScore)}">${getScoreStatus(report.overallScore)}</div>
            </div>
            ${mobileAnalysis ? `
            <div class="score-card">
                <h3>Mobile-Friendliness</h3>
                <div class="score-value" style="color: ${getScoreColor(mobileAnalysis.overallScore)}">${mobileAnalysis.overallScore}</div>
                <div class="score-status" style="color: ${getScoreColor(mobileAnalysis.overallScore)}">${getScoreStatus(mobileAnalysis.overallScore)}</div>
            </div>
            ` : ''}
        </div>

        <!-- SEO Analysis -->
        ${seoScoring ? `
        <div class="section">
            <h2>🔍 SEO Performance Analysis</h2>
            <div class="subsection">
                <h3>Category Scores</h3>
                <div class="category-scores">
                    <div class="category-score">
                        <div class="score" style="color: ${getScoreColor(seoScoring.categoryScores.metaTags)}">${seoScoring.categoryScores.metaTags}</div>
                        <div class="label">Meta Tags (30%)</div>
                    </div>
                    <div class="category-score">
                        <div class="score" style="color: ${getScoreColor(seoScoring.categoryScores.contentStructure)}">${seoScoring.categoryScores.contentStructure}</div>
                        <div class="label">Content (25%)</div>
                    </div>
                    <div class="category-score">
                        <div class="score" style="color: ${getScoreColor(seoScoring.categoryScores.technicalSEO)}">${seoScoring.categoryScores.technicalSEO}</div>
                        <div class="label">Technical (20%)</div>
                    </div>
                </div>
            </div>
        </div>
        ` : ''}

        <!-- Mobile Analysis -->
        ${mobileAnalysis ? `
        <div class="section">
            <h2>📱 Mobile-Friendliness Analysis</h2>
            <div class="subsection">
                <h3>Mobile Categories</h3>
                <div class="category-scores">
                    <div class="category-score">
                        <div class="score" style="color: ${getScoreColor(mobileAnalysis.textReadability.score)}">${mobileAnalysis.textReadability.score}</div>
                        <div class="label">Text Readability</div>
                    </div>
                    <div class="category-score">
                        <div class="score" style="color: ${getScoreColor(mobileAnalysis.mobilePerformance.score)}">${mobileAnalysis.mobilePerformance.score}</div>
                        <div class="label">Mobile Performance</div>
                    </div>
                    <div class="category-score">
                        <div class="score" style="color: ${getScoreColor(mobileAnalysis.mobileSEO.score)}">${mobileAnalysis.mobileSEO.score}</div>
                        <div class="label">Mobile SEO</div>
                    </div>
                </div>
            </div>
            
            ${mobileAnalysis.viewport.present ? `
            <div class="subsection">
                <h3>Viewport Configuration</h3>
                <div class="issue-item good">
                    <div class="issue-description">✅ Viewport is properly configured: ${escapeHtml(mobileAnalysis.viewport.content)}</div>
                </div>
            </div>
            ` : ''}
            
            <div class="subsection">
                <h3>Touch Targets Analysis</h3>
                <div class="stats-grid">
                    <div class="stat-card">
                        <div class="stat-value">${mobileAnalysis.touchTargets.totalElements}</div>
                        <div class="stat-label">Total Elements</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value" style="color: #22c55e">${mobileAnalysis.touchTargets.adequateSize}</div>
                        <div class="stat-label">Adequate Size</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value" style="color: #ef4444">${mobileAnalysis.touchTargets.tooSmall}</div>
                        <div class="stat-label">Too Small</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value" style="color: ${getScoreColor(mobileAnalysis.touchTargets.score)}">${mobileAnalysis.touchTargets.score}</div>
                        <div class="stat-label">Score</div>
                    </div>
                </div>
            </div>
        </div>
        ` : ''}

        <!-- Accessibility Analysis -->
        ${accessibilityScoring ? `
        <div class="section">
            <h2>♿ Accessibility Analysis</h2>
            <div class="subsection">
                <h3>WCAG Compliance Summary</h3>
                <div class="category-scores">
                    <div class="category-score">
                        <div class="score" style="color: ${getScoreColor(accessibilityScoring.categoryScores.perceivable)}">${accessibilityScoring.categoryScores.perceivable}</div>
                        <div class="label">Perceivable</div>
                    </div>
                    <div class="category-score">
                        <div class="score" style="color: ${getScoreColor(accessibilityScoring.categoryScores.operable)}">${accessibilityScoring.categoryScores.operable}</div>
                        <div class="label">Operable</div>
                    </div>
                    <div class="category-score">
                        <div class="score" style="color: ${getScoreColor(accessibilityScoring.categoryScores.understandable)}">${accessibilityScoring.categoryScores.understandable}</div>
                        <div class="label">Understandable</div>
                    </div>
                </div>
            </div>
            
            <div class="subsection">
                <h3>Accessibility Issues</h3>
                <ul class="issues-list">
                    ${accessibilityIssues.map(issue => `
                    <li class="issue-item ${escapeHtml(issue.severity)}">
                        <div class="issue-header">
                            <span class="issue-type">${escapeHtml(issue.type)}</span>
                            <span class="issue-severity ${escapeHtml(issue.severity)}">${escapeHtml(issue.severity)}</span>
                        </div>
                        <div class="issue-description">${escapeHtml(issue.description)}</div>
                        <div class="issue-recommendation">💡 ${escapeHtml(issue.recommendation)}</div>
                    </li>
                    `).join('')}
                </ul>
            </div>
        </div>
        ` : ''}

        <!-- Performance Metrics -->
        ${performanceMetrics ? `
        <div class="section">
            <h2>⚡ Performance Metrics</h2>
            <div class="stats-grid">
                <div class="stat-card">
                    <div class="stat-value">${performanceMetrics.loadTime}ms</div>
                    <div class="stat-label">Load Time</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${Math.round(performanceMetrics.contentSize / 1024)}KB</div>
                    <div class="stat-label">Content Size</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${performanceMetrics.httpRequests}</div>
                    <div class="stat-label">HTTP Requests</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${Math.round(performanceMetrics.firstPaint)}ms</div>
                    <div class="stat-label">First Paint</div>
                </div>
            </div>
        </div>
        ` : ''}

        <!-- Website Statistics -->
        ${statistics ? `
        <div class="section">
            <h2>📊 Website Statistics</h2>
            <div class="stats-grid">
                <div class="stat-card">
                    <div class="stat-value">${statistics.totalLinks}</div>
                    <div class="stat-label">Total Links</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value" style="color: #ef4444">${statistics.brokenLinks}</div>
                    <div class="stat-label">Broken Links</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${statistics.totalImages}</div>
                    <div class="stat-label">Total Images</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value" style="color: #22c55e">${statistics.imagesWithAlt}</div>
                    <div class="stat-label">Images with Alt</div>
                </div>
            </div>
        </div>
        ` : ''}

        <!-- Recommendations -->
        ${recommendations && recommendations.length > 0 ? `
        <div class="section">
            <h2>💡 Recommendations</h2>
            <div class="recommendations-grid">
                ${recommendations.map((rec, index) => `
                <div class="recommendation">
                    <h4>${index + 1}. ${escapeHtml(rec.title)}</h4>
                    <div class="description">${escapeHtml(rec.description)}</div>
                    <div class="meta">
                        <span class="badge ${escapeHtml(rec.priority)}">${escapeHtml(rec.priority)} Priority</span>
                        <span class="badge" style="background: #e5e7eb; color: #374151;">${escapeHtml(rec.category)}</span>
                    </div>
                </div>
                `).join('')}
            </div>
        </div>
        ` : ''}
    </div>
</body>
</html>
    `;
  }
}