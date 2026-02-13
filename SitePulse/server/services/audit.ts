import * as cheerio from 'cheerio';
import axios from 'axios';
import { URL } from 'url';
import dns from 'dns';
import { promisify } from 'util';
import type { 
  MetaTagAnalysis, 
  AccessibilityIssue, 
  BrokenLink, 
  PerformanceMetrics, 
  Recommendation,
  AuditStatistics,
  AccessibilityScoring,
  SEOScoring,
  MobileAnalysis 
} from '@shared/schema';

const dnsLookup = promisify(dns.lookup);

export class AuditService {
  private isPrivateIP(ip: string): boolean {
    // Check for IPv6 addresses
    if (ip.includes(':')) {
      const normalized = ip.toLowerCase().trim();
      
      // Block IPv6 loopback
      if (normalized === '::1' || normalized === '::') return true;
      
      // Extract the first hextet (first 16-bit block) for checking
      // Handle compressed format (::) by checking the first non-empty part
      const parts = normalized.split(':').filter(p => p.length > 0);
      if (parts.length === 0) return true; // Invalid format, block it
      
      const firstHextet = parts[0];
      
      // Block IPv6 link-local addresses (fe80::/10)
      if (firstHextet === 'fe80' || normalized.startsWith('fe80:')) return true;
      
      // Block IPv6 unique local addresses (fc00::/7) - private IPv6 addresses
      // These start with 'fc' or 'fd' in the first hextet
      if (firstHextet.startsWith('fc') || firstHextet.startsWith('fd')) return true;
      
      // Block IPv6 multicast (ff00::/8)
      if (firstHextet.startsWith('ff')) return true;
      
      // Allow all other IPv6 addresses (public addresses like 2607:, 2001:, etc.)
      return false;
    }
    
    // Check for IPv4 addresses
    const parts = ip.split('.').map(Number);
    if (parts.length !== 4) return false; // Invalid IPv4 format, but might be valid IPv6, so don't block
    
    // 127.0.0.0/8 (localhost)
    if (parts[0] === 127) return true;
    
    // 10.0.0.0/8 (private)
    if (parts[0] === 10) return true;
    
    // 172.16.0.0/12 (private)
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
    
    // 192.168.0.0/16 (private)
    if (parts[0] === 192 && parts[1] === 168) return true;
    
    // 169.254.0.0/16 (link-local)
    if (parts[0] === 169 && parts[1] === 254) return true;
    
    // 0.0.0.0/8 (this network)
    if (parts[0] === 0) return true;
    
    // 224.0.0.0/4 (multicast)
    if (parts[0] >= 224 && parts[0] <= 239) return true;
    
    return false;
  }

  private async validateUrlSafety(url: string): Promise<void> {
    const urlObj = new URL(url);
    
    // Only allow http and https protocols
    if (!['http:', 'https:'].includes(urlObj.protocol)) {
      throw new Error('Only HTTP and HTTPS protocols are allowed');
    }
    
    // Block obvious private hostnames
    const hostname = urlObj.hostname.toLowerCase();
    if (['localhost', '127.0.0.1', '::1'].includes(hostname)) {
      throw new Error('Cannot audit localhost or loopback addresses');
    }
    
    // Block private IP addresses in hostname (e.g., 192.168.1.1, 10.0.0.1)
    if (/^(10\.|172\.(1[6-9]|2[0-9]|3[0-1])\.|192\.168\.|127\.|169\.254\.)/.test(hostname)) {
      throw new Error('Cannot audit private or internal IP addresses');
    }
    
    // Resolve hostname to IP and check if it's private
    try {
      // DNS lookup prefers IPv4 by default, but will return IPv6 if IPv4 is not available
      const { address, family } = await dnsLookup(urlObj.hostname, { family: 0 }); // 0 = both IPv4 and IPv6
      console.log(`[DNS Lookup] ${urlObj.hostname} resolved to ${address} (IPv${family})`);
      
      const isPrivate = this.isPrivateIP(address);
      console.log(`[IP Check] ${address} is private: ${isPrivate}`);
      
      if (isPrivate) {
        throw new Error('Cannot audit private or internal IP addresses');
      }
    } catch (error) {
      if (error instanceof Error && error.message.includes('Cannot audit')) {
        throw error;
      }
      // DNS resolution failed - allow it to proceed as it might be a temporary DNS issue
      // or the domain might be valid but DNS is having issues
      console.log(`[DNS Lookup] Failed for ${urlObj.hostname}, allowing to proceed:`, error instanceof Error ? error.message : 'Unknown error');
    }
  }

  private async fetchPage(url: string): Promise<{ html: string; loadTime: number; contentSize: number }> {
    try {
      // Validate URL safety before making request
      await this.validateUrlSafety(url);
      
      const startTime = Date.now();
      const response = await axios.get(url, {
        timeout: 10000,
        maxRedirects: 3, // Limit redirects to prevent redirect loops
        headers: {
          'User-Agent': 'SEO-Audit-Tool/1.0'
        }
      });
      const endTime = Date.now();
      
      return {
        html: response.data,
        loadTime: endTime - startTime,
        contentSize: Buffer.byteLength(response.data, 'utf8')
      };
    } catch (error) {
      throw new Error(`Failed to fetch URL: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private analyzeMetaTags($: cheerio.CheerioAPI): MetaTagAnalysis {
    const title = $('title').text().trim();
    const description = $('meta[name="description"]').attr('content') || '';
    const ogImage = $('meta[property="og:image"]').attr('content') || '';
    const ogTitle = $('meta[property="og:title"]').attr('content') || '';
    const ogDescription = $('meta[property="og:description"]').attr('content') || '';
    const twitterCard = $('meta[name="twitter:card"]').attr('content') || '';
    const twitterTitle = $('meta[name="twitter:title"]').attr('content') || '';
    const twitterDescription = $('meta[name="twitter:description"]').attr('content') || '';

    return {
      title: {
        present: !!title,
        content: title,
        status: title && title.length >= 30 && title.length <= 60 ? 'good' : title ? 'warning' : 'error'
      },
      description: {
        present: !!description,
        content: description,
        status: description && description.length >= 120 && description.length <= 160 ? 'good' : description ? 'warning' : 'error'
      },
      ogImage: {
        present: !!ogImage,
        content: ogImage,
        status: ogImage ? 'good' : 'warning'
      },
      ogTitle: {
        present: !!ogTitle,
        content: ogTitle,
        status: ogTitle ? 'good' : 'warning'
      },
      ogDescription: {
        present: !!ogDescription,
        content: ogDescription,
        status: ogDescription ? 'good' : 'warning'
      },
      twitterCard: {
        present: !!twitterCard,
        content: twitterCard,
        status: twitterCard ? 'good' : 'warning'
      },
      twitterTitle: {
        present: !!twitterTitle,
        content: twitterTitle,
        status: twitterTitle ? 'good' : 'warning'
      },
      twitterDescription: {
        present: !!twitterDescription,
        content: twitterDescription,
        status: twitterDescription ? 'good' : 'warning'
      }
    };
  }

  private analyzeAccessibility($: cheerio.CheerioAPI): { issues: AccessibilityIssue[], scoring: AccessibilityScoring } {
    const issues: AccessibilityIssue[] = [];

    // Check for missing alt text
    const imagesWithoutAlt = $('img:not([alt])');
    if (imagesWithoutAlt.length > 0) {
      issues.push({
        type: 'Missing Alt Text',
        severity: 'critical',
        description: `${imagesWithoutAlt.length} images are missing alt attributes`,
        elements: imagesWithoutAlt.map((_, el) => $(el).attr('src')).get(),
        recommendation: 'Add descriptive alt attributes to all images for screen readers'
      });
    }

    // Check heading hierarchy
    const headings = $('h1, h2, h3, h4, h5, h6');
    let previousLevel = 0;
    let hierarchyIssue = false;

    headings.each((_, el) => {
      const currentLevel = parseInt(el.tagName.charAt(1));
      if (previousLevel > 0 && currentLevel > previousLevel + 1) {
        hierarchyIssue = true;
      }
      previousLevel = currentLevel;
    });

    if (hierarchyIssue) {
      issues.push({
        type: 'Heading Hierarchy',
        severity: 'warning',
        description: 'Page skips heading levels (e.g., h1 to h3 without h2)',
        recommendation: 'Use proper heading hierarchy for screen readers and SEO'
      });
    }

    // Check for semantic HTML
    const hasHeader = $('header').length > 0;
    const hasNav = $('nav').length > 0;
    const hasMain = $('main').length > 0;
    const hasFooter = $('footer').length > 0;

    if (hasHeader && hasNav && hasMain && hasFooter) {
      issues.push({
        type: 'Semantic HTML Structure',
        severity: 'good',
        description: 'Proper use of header, nav, main, and footer elements',
        recommendation: 'Continue using semantic HTML elements'
      });
    } else {
      issues.push({
        type: 'Semantic HTML Structure',
        severity: 'warning',
        description: 'Missing some semantic HTML elements (header, nav, main, footer)',
        recommendation: 'Use semantic HTML elements to improve accessibility and SEO'
      });
    }

    // Check for form labels
    const inputsWithoutLabels = $('input:not([aria-label]):not([aria-labelledby])').filter((_, el) => {
      const $el = $(el);
      const id = $el.attr('id');
      return !id || $(`label[for="${id}"]`).length === 0;
    });

    if (inputsWithoutLabels.length > 0) {
      issues.push({
        type: 'Form Accessibility',
        severity: 'critical',
        description: `${inputsWithoutLabels.length} form inputs are missing proper labels`,
        recommendation: 'Associate all form inputs with labels using the for attribute or aria-label'
      });
    }

    // Enhanced WCAG compliance checks
    const wcagChecks = this.performWCAGChecks($);
    issues.push(...wcagChecks);

    // Calculate accessibility scoring
    const scoring = this.calculateAccessibilityScoring(issues);

    return { issues, scoring };
  }

  private async checkLinks($: cheerio.CheerioAPI, baseUrl: string): Promise<BrokenLink[]> {
    const links = $('a[href]');
    const brokenLinks: BrokenLink[] = [];
    const checkedUrls = new Set<string>();
    const maxLinksToCheck = 50; // Limit total links checked to prevent excessive outbound requests
    let checkedCount = 0;

    for (let i = 0; i < links.length && checkedCount < maxLinksToCheck; i++) {
      const link = links.eq(i);
      const href = link.attr('href');
      
      if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) {
        continue;
      }

      let absoluteUrl: string;
      let isInternal = false;

      try {
        if (href.startsWith('/')) {
          absoluteUrl = new URL(href, baseUrl).toString();
          isInternal = true;
        } else if (href.startsWith('http')) {
          absoluteUrl = href;
          isInternal = new URL(href).origin === new URL(baseUrl).origin;
        } else {
          absoluteUrl = new URL(href, baseUrl).toString();
          isInternal = true;
        }

        if (checkedUrls.has(absoluteUrl)) {
          continue;
        }
        checkedUrls.add(absoluteUrl);
        checkedCount++;

        // Validate URL safety before checking (prevent SSRF for external links)
        try {
          if (!isInternal) {
            await this.validateUrlSafety(absoluteUrl);
          }
        } catch (error) {
          // Skip private/internal URLs silently
          continue;
        }

        try {
          let response;
          
          // First try HEAD request
          try {
            response = await axios.head(absoluteUrl, {
              timeout: 5000,
              maxRedirects: 2,
              headers: {
                'User-Agent': 'SEO-Audit-Tool/1.0'
              }
            });
          } catch (headError) {
            // If HEAD fails with method not allowed, try GET
            if (axios.isAxiosError(headError) && 
                (headError.response?.status === 405 || headError.response?.status === 501)) {
              response = await axios.get(absoluteUrl, {
                timeout: 5000,
                maxRedirects: 2,
                responseType: 'stream',
                headers: {
                  'User-Agent': 'SEO-Audit-Tool/1.0'
                }
              });
              // Close the stream immediately to save bandwidth
              if (response.data && typeof response.data.destroy === 'function') {
                response.data.destroy();
              }
            } else {
              throw headError;
            }
          }
          
          if (response.status >= 400) {
            brokenLinks.push({
              url: absoluteUrl,
              status: response.status,
              foundIn: this.findLinkContext($, link),
              type: isInternal ? 'internal' : 'external'
            });
          }
        } catch (error) {
          if (axios.isAxiosError(error) && error.response) {
            brokenLinks.push({
              url: absoluteUrl,
              status: error.response.status,
              foundIn: this.findLinkContext($, link),
              type: isInternal ? 'internal' : 'external'
            });
          }
        }
      } catch (error) {
        // Skip invalid URLs
        continue;
      }
    }

    return brokenLinks;
  }

  private findLinkContext($: cheerio.CheerioAPI, link: cheerio.Cheerio<any>): string {
    const parent = link.closest('nav, header, footer, main, article, section');
    if (parent.length > 0) {
      const tagName = parent.prop('tagName')?.toLowerCase();
      const className = parent.attr('class');
      const id = parent.attr('id');
      
      let context = tagName || 'unknown';
      if (id) context += `#${id}`;
      if (className) context += `.${className.split(' ')[0]}`;
      
      return context;
    }
    return 'page content';
  }

  private calculateAdvancedSEOScoring(
    $: cheerio.CheerioAPI,
    metaTags: MetaTagAnalysis,
    accessibilityIssues: AccessibilityIssue[],
    brokenLinks: BrokenLink[],
    performanceMetrics: PerformanceMetrics,
    statistics: AuditStatistics
  ): SEOScoring {
    const weights = {
      metaTags: 0.30,
      contentStructure: 0.25,
      technicalSEO: 0.20,
      performance: 0.15,
      userExperience: 0.10
    };

    // Meta Tags Analysis (30% weight)
    const metaTagsScore = this.analyzeMetaTagsScore(metaTags);
    
    // Content Structure Analysis (25% weight)
    const contentStructureScore = this.analyzeContentStructure($);
    
    // Technical SEO Analysis (20% weight)
    const technicalSEOScore = this.analyzeTechnicalSEO($, brokenLinks, statistics);
    
    // Performance Analysis (15% weight)
    const performanceScore = this.analyzePerformanceScore(performanceMetrics);
    
    // User Experience Analysis (10% weight)
    const userExperienceScore = this.analyzeUserExperience($, accessibilityIssues);

    // Calculate weighted overall score
    const overallScore = Math.round(
      (metaTagsScore.score * weights.metaTags) +
      (contentStructureScore.score * weights.contentStructure) +
      (technicalSEOScore.score * weights.technicalSEO) +
      (performanceScore.score * weights.performance) +
      (userExperienceScore.score * weights.userExperience)
    );

    return {
      overallScore,
      categoryScores: {
        metaTags: metaTagsScore.score,
        contentStructure: contentStructureScore.score,
        technicalSEO: technicalSEOScore.score,
        performance: performanceScore.score,
        userExperience: userExperienceScore.score
      },
      categoryWeights: weights,
      detailedBreakdown: {
        metaTags: metaTagsScore,
        contentStructure: contentStructureScore,
        technicalSEO: technicalSEOScore,
        performance: performanceScore,
        userExperience: userExperienceScore
      }
    };
  }

  private analyzeMetaTagsScore(metaTags: MetaTagAnalysis) {
    let score = 100;
    const issues: string[] = [];
    const recommendations: string[] = [];
    
    // Title tag analysis
    if (!metaTags.title.present) {
      score -= 25;
      issues.push('Missing title tag');
      recommendations.push('Add a unique, descriptive title tag (50-60 characters)');
    } else if (metaTags.title.content.length > 60) {
      score -= 10;
      issues.push('Title tag too long');
      recommendations.push('Keep title under 60 characters for optimal display');
    } else if (metaTags.title.content.length < 30) {
      score -= 10;
      issues.push('Title tag too short');
      recommendations.push('Expand title to 30-60 characters for better SEO');
    }
    
    // Meta description analysis
    if (!metaTags.description.present) {
      score -= 20;
      issues.push('Missing meta description');
      recommendations.push('Add compelling meta description (150-160 characters)');
    } else if (metaTags.description.content.length > 160) {
      score -= 8;
      issues.push('Meta description too long');
      recommendations.push('Keep description under 160 characters');
    } else if (metaTags.description.content.length < 120) {
      score -= 5;
      issues.push('Meta description could be longer');
      recommendations.push('Expand description to 120-160 characters');
    }
    
    // Open Graph analysis
    if (!metaTags.ogTitle.present) {
      score -= 10;
      issues.push('Missing Open Graph title');
      recommendations.push('Add og:title for better social media sharing');
    }
    
    if (!metaTags.ogDescription.present) {
      score -= 10;
      issues.push('Missing Open Graph description');
      recommendations.push('Add og:description for social media');
    }
    
    if (!metaTags.ogImage.present) {
      score -= 15;
      issues.push('Missing Open Graph image');
      recommendations.push('Add og:image for rich social media previews');
    }
    
    // Twitter Card analysis
    if (!metaTags.twitterCard.present) {
      score -= 10;
      issues.push('Missing Twitter Card');
      recommendations.push('Add Twitter Card meta tags for better Twitter sharing');
    }
    
    return {
      score: Math.max(0, score),
      issues,
      recommendations
    };
  }

  private analyzeContentStructure($: cheerio.CheerioAPI) {
    let score = 100;
    const issues: string[] = [];
    const recommendations: string[] = [];
    
    // Heading structure analysis
    const h1Count = $('h1').length;
    if (h1Count === 0) {
      score -= 20;
      issues.push('No H1 heading found');
      recommendations.push('Add a single, descriptive H1 heading');
    } else if (h1Count > 1) {
      score -= 15;
      issues.push('Multiple H1 headings found');
      recommendations.push('Use only one H1 per page');
    }
    
    // Check heading hierarchy
    const headings = $('h1, h2, h3, h4, h5, h6').get();
    let previousLevel = 0;
    headings.forEach(heading => {
      const currentLevel = parseInt(heading.name.substring(1));
      if (currentLevel > previousLevel + 1) {
        score -= 5;
        issues.push('Skipped heading levels');
        recommendations.push('Maintain proper heading hierarchy (h1 → h2 → h3)');
        return false; // Exit loop after first violation
      }
      previousLevel = currentLevel;
    });
    
    // Semantic HTML structure
    const hasMain = $('main').length > 0;
    const hasHeader = $('header').length > 0;
    const hasNav = $('nav').length > 0;
    const hasFooter = $('footer').length > 0;
    
    if (!hasMain) {
      score -= 10;
      issues.push('Missing main element');
      recommendations.push('Use <main> element for primary content');
    }
    
    if (!hasHeader) {
      score -= 8;
      issues.push('Missing header element');
      recommendations.push('Use <header> element for page header');
    }
    
    if (!hasNav) {
      score -= 5;
      issues.push('Missing nav element');
      recommendations.push('Use <nav> element for navigation');
    }
    
    if (!hasFooter) {
      score -= 5;
      issues.push('Missing footer element');
      recommendations.push('Use <footer> element for page footer');
    }
    
    // Content quality indicators
    const textContent = $('body').text();
    const wordCount = textContent.split(/\s+/).length;
    
    if (wordCount < 300) {
      score -= 15;
      issues.push('Insufficient content');
      recommendations.push('Add more quality content (aim for 300+ words)');
    }
    
    // Image optimization
    const totalImages = $('img').length;
    const imagesWithAlt = $('img[alt]').length;
    const imagesWithoutAlt = totalImages - imagesWithAlt;
    
    if (imagesWithoutAlt > 0) {
      score -= Math.min(20, imagesWithoutAlt * 5);
      issues.push(`${imagesWithoutAlt} images missing alt text`);
      recommendations.push('Add descriptive alt text to all images');
    }
    
    return {
      score: Math.max(0, score),
      issues,
      recommendations
    };
  }

  private analyzeTechnicalSEO($: cheerio.CheerioAPI, brokenLinks: BrokenLink[], statistics: AuditStatistics) {
    let score = 100;
    const issues: string[] = [];
    const recommendations: string[] = [];
    
    // URL structure
    const canonicalLink = $('link[rel="canonical"]');
    if (canonicalLink.length === 0) {
      score -= 10;
      issues.push('Missing canonical URL');
      recommendations.push('Add canonical link to prevent duplicate content');
    }
    
    // Meta robots
    const robotsMeta = $('meta[name="robots"]');
    if (robotsMeta.length === 0) {
      score -= 5;
      issues.push('Missing robots meta tag');
      recommendations.push('Add robots meta tag for search engine guidance');
    }
    
    // Broken links analysis
    if (brokenLinks.length > 0) {
      const penalty = Math.min(30, brokenLinks.length * 5);
      score -= penalty;
      issues.push(`${brokenLinks.length} broken links found`);
      recommendations.push('Fix all broken links to improve user experience and SEO');
    }
    
    // XML sitemap (heuristic check)
    const sitemapLinks = $('a[href*="sitemap"]');
    if (sitemapLinks.length === 0) {
      score -= 8;
      issues.push('No sitemap reference found');
      recommendations.push('Create and reference an XML sitemap');
    }
    
    // Language declaration
    const htmlLang = $('html').attr('lang');
    if (!htmlLang) {
      score -= 10;
      issues.push('Missing language declaration');
      recommendations.push('Add lang attribute to html element');
    }
    
    // Schema markup detection
    const schemaMarkup = $('[itemtype], script[type="application/ld+json"]');
    if (schemaMarkup.length === 0) {
      score -= 15;
      issues.push('No structured data found');
      recommendations.push('Add schema markup for better search results');
    }
    
    // Internal linking
    const internalLinkRatio = statistics.totalLinks > 0 ? statistics.internalLinks / statistics.totalLinks : 0;
    if (internalLinkRatio < 0.3) {
      score -= 10;
      issues.push('Low internal linking');
      recommendations.push('Improve internal linking structure');
    }
    
    return {
      score: Math.max(0, score),
      issues,
      recommendations
    };
  }

  private analyzePerformanceScore(performanceMetrics: PerformanceMetrics) {
    let score = 100;
    const issues: string[] = [];
    const recommendations: string[] = [];
    
    // Load time analysis
    if (performanceMetrics.loadTime > 3000) {
      score -= 30;
      issues.push('Slow page load time');
      recommendations.push('Optimize page load time to under 3 seconds');
    } else if (performanceMetrics.loadTime > 2000) {
      score -= 15;
      issues.push('Moderate page load time');
      recommendations.push('Improve page load time to under 2 seconds');
    }
    
    // First paint analysis
    if (performanceMetrics.firstPaint > 2000) {
      score -= 20;
      issues.push('Slow first paint');
      recommendations.push('Optimize first paint time');
    }
    
    // Content size analysis
    if (performanceMetrics.contentSize > 1000000) { // 1MB
      score -= 15;
      issues.push('Large page size');
      recommendations.push('Optimize images and reduce page size');
    }
    
    // HTTP requests analysis
    if (performanceMetrics.httpRequests > 50) {
      score -= 10;
      issues.push('Too many HTTP requests');
      recommendations.push('Reduce number of HTTP requests');
    }
    
    return {
      score: Math.max(0, score),
      issues,
      recommendations
    };
  }

  private analyzeUserExperience($: cheerio.CheerioAPI, accessibilityIssues: AccessibilityIssue[]) {
    let score = 100;
    const issues: string[] = [];
    const recommendations: string[] = [];
    
    // Mobile viewport
    const viewportMeta = $('meta[name="viewport"]');
    if (viewportMeta.length === 0) {
      score -= 25;
      issues.push('Missing viewport meta tag');
      recommendations.push('Add viewport meta tag for mobile responsiveness');
    }
    
    // Accessibility score impact
    const criticalA11yIssues = accessibilityIssues.filter(issue => issue.severity === 'critical').length;
    const warningA11yIssues = accessibilityIssues.filter(issue => issue.severity === 'warning').length;
    
    score -= (criticalA11yIssues * 15) + (warningA11yIssues * 5);
    
    if (criticalA11yIssues > 0) {
      issues.push(`${criticalA11yIssues} critical accessibility issues`);
      recommendations.push('Fix critical accessibility issues');
    }
    
    if (warningA11yIssues > 0) {
      issues.push(`${warningA11yIssues} accessibility warnings`);
      recommendations.push('Address accessibility warnings');
    }
    
    // Form usability
    const forms = $('form');
    if (forms.length > 0) {
      const formsWithoutLabels = forms.find('input:not([type="submit"]):not([type="button"])').filter((_, input) => {
        const $input = $(input);
        const id = $input.attr('id');
        const hasLabel = id && $(`label[for="${id}"]`).length > 0;
        const hasAriaLabel = $input.attr('aria-label');
        return !hasLabel && !hasAriaLabel;
      }).length;
      
      if (formsWithoutLabels > 0) {
        score -= 15;
        issues.push('Form inputs without proper labels');
        recommendations.push('Add labels to all form inputs');
      }
    }
    
    return {
      score: Math.max(0, score),
      issues,
      recommendations
    };
  }

  private analyzeMobileFriendliness($: cheerio.CheerioAPI, performanceMetrics: PerformanceMetrics): MobileAnalysis {
    const viewport = this.analyzeViewport($);
    const touchTargets = this.analyzeTouchTargets($);
    const textReadability = this.analyzeTextReadability($);
    const mobilePerformance = this.analyzeMobilePerformance($, performanceMetrics);
    const mobileSEO = this.analyzeMobileSEO($);

    // Calculate overall mobile score (weighted average)
    const overallScore = Math.round(
      (viewport.status === 'good' ? 20 : viewport.status === 'warning' ? 10 : 0) +
      (touchTargets.score * 0.25) +
      (textReadability.score * 0.20) +
      (mobilePerformance.score * 0.20) +
      (mobileSEO.score * 0.15)
    );

    // Collect detailed issues
    const detailedIssues = [
      ...touchTargets.issues.map(issue => ({
        type: 'Touch Targets',
        severity: 'warning' as const,
        description: issue,
        recommendation: touchTargets.recommendations[0] || 'Ensure touch targets are at least 44px'
      })),
      ...textReadability.issues.map(issue => ({
        type: 'Text Readability',
        severity: 'warning' as const,
        description: issue,
        recommendation: textReadability.recommendations[0] || 'Use larger font sizes for better readability'
      })),
      ...mobilePerformance.issues.map(issue => ({
        type: 'Mobile Performance',
        severity: 'warning' as const,
        description: issue,
        recommendation: mobilePerformance.recommendations[0] || 'Optimize for mobile performance'
      })),
      ...mobileSEO.issues.map(issue => ({
        type: 'Mobile SEO',
        severity: 'warning' as const,
        description: issue,
        recommendation: mobileSEO.recommendations[0] || 'Implement mobile SEO best practices'
      }))
    ];

    if (viewport.status === 'error') {
      detailedIssues.unshift({
        type: 'Viewport Configuration',
        severity: 'critical' as const,
        description: 'Missing or invalid viewport meta tag',
        recommendation: 'Add proper viewport meta tag: <meta name="viewport" content="width=device-width, initial-scale=1">'
      });
    }

    return {
      overallScore,
      viewport,
      touchTargets,
      textReadability,
      mobilePerformance,
      mobileSEO,
      detailedIssues
    };
  }

  private analyzeViewport($: cheerio.CheerioAPI) {
    const viewportMeta = $('meta[name="viewport"]');
    
    if (viewportMeta.length === 0) {
      return {
        present: false,
        content: '',
        status: 'error' as const
      };
    }

    const content = viewportMeta.attr('content') || '';
    const hasWidth = content.includes('width=device-width');
    const hasInitialScale = content.includes('initial-scale=1');
    
    let status: 'good' | 'warning' | 'error' = 'good';
    if (!hasWidth || !hasInitialScale) {
      status = 'warning';
    }

    return {
      present: true,
      content,
      status,
      width: hasWidth ? 'device-width' : undefined,
      initialScale: hasInitialScale ? '1' : undefined
    };
  }

  private analyzeTouchTargets($: cheerio.CheerioAPI) {
    const interactiveElements = $('button, a, input[type="button"], input[type="submit"], [onclick], [role="button"]');
    let adequateSize = 0;
    let tooSmall = 0;
    const issues: string[] = [];
    const recommendations: string[] = [];

    // Heuristic analysis - look for elements with inline styles or classes that might indicate size
    interactiveElements.each((_, element) => {
      const $element = $(element);
      const style = $element.attr('style') || '';
      const className = $element.attr('class') || '';
      
      // Check for small button indicators
      if (style.includes('font-size') && style.match(/font-size:\s*(\d+)px/)) {
        const fontSize = parseInt(style.match(/font-size:\s*(\d+)px/)![1]);
        if (fontSize < 16) {
          tooSmall++;
        } else {
          adequateSize++;
        }
      } else if (className.includes('btn-sm') || className.includes('small') || className.includes('xs')) {
        tooSmall++;
      } else {
        adequateSize++; // Assume adequate if no indicators of small size
      }
    });

    const totalElements = adequateSize + tooSmall;
    let score = 100;

    if (tooSmall > 0) {
      score = Math.max(0, 100 - (tooSmall / totalElements * 100));
      issues.push(`${tooSmall} touch targets may be too small`);
      recommendations.push('Ensure touch targets are at least 44px × 44px for optimal usability');
    }

    if (totalElements === 0) {
      score = 50;
      issues.push('No interactive elements detected for touch target analysis');
      recommendations.push('Add interactive elements with proper touch target sizing');
    }

    return {
      score: Math.round(score),
      totalElements,
      adequateSize,
      tooSmall,
      issues,
      recommendations
    };
  }

  private analyzeTextReadability($: cheerio.CheerioAPI) {
    const textElements = $('p, div, span, h1, h2, h3, h4, h5, h6, li, td, th');
    const fontSizes: number[] = [];
    let smallTextElements = 0;

    textElements.each((_, element) => {
      const $element = $(element);
      const style = $element.attr('style') || '';
      
      if (style.includes('font-size')) {
        const fontSizeMatch = style.match(/font-size:\s*(\d+)px/);
        if (fontSizeMatch) {
          const fontSize = parseInt(fontSizeMatch[1]);
          fontSizes.push(fontSize);
          if (fontSize < 16) {
            smallTextElements++;
          }
        }
      } else {
        fontSizes.push(16); // Assume default browser font size
      }
    });

    const averageFontSize = fontSizes.length > 0 ? fontSizes.reduce((a, b) => a + b, 0) / fontSizes.length : 16;
    const issues: string[] = [];
    const recommendations: string[] = [];
    
    let score = 100;
    if (smallTextElements > 0) {
      score = Math.max(0, 100 - (smallTextElements / textElements.length * 100));
      issues.push(`${smallTextElements} text elements have small font sizes`);
      recommendations.push('Use minimum 16px font size for body text on mobile devices');
    }

    if (averageFontSize < 14) {
      score = Math.max(score - 20, 0);
      issues.push('Average font size is too small for mobile reading');
      recommendations.push('Increase overall font sizes for better mobile readability');
    }

    return {
      score: Math.round(score),
      fontSizes,
      averageFontSize: Math.round(averageFontSize),
      smallTextElements,
      issues,
      recommendations
    };
  }

  private analyzeMobilePerformance($: cheerio.CheerioAPI, performanceMetrics: PerformanceMetrics) {
    const images = $('img');
    const issues: string[] = [];
    const recommendations: string[] = [];
    let score = 100;
    let mobileOptimized = true;

    // Analyze image optimization
    let optimizedImages = 0;
    images.each((_, img) => {
      const $img = $(img);
      const src = $img.attr('src') || '';
      const hasResponsive = $img.attr('sizes') || $img.attr('srcset');
      const hasLazyLoading = $img.attr('loading') === 'lazy';
      
      if (hasResponsive || hasLazyLoading) {
        optimizedImages++;
      }
    });

    const imageOptimization = images.length > 0 ? (optimizedImages / images.length) * 100 : 100;
    
    // Performance scoring
    if (performanceMetrics.loadTime > 5000) {
      score -= 30;
      mobileOptimized = false;
      issues.push('Slow loading time affects mobile experience');
      recommendations.push('Optimize loading time for mobile networks');
    }

    if (performanceMetrics.contentSize > 2000000) { // 2MB
      score -= 20;
      issues.push('Large page size may impact mobile users on limited data plans');
      recommendations.push('Optimize images and reduce page size for mobile');
    }

    if (imageOptimization < 50) {
      score -= 25;
      issues.push('Images not optimized for mobile devices');
      recommendations.push('Implement responsive images with srcset and lazy loading');
    }

    // Check for mobile-specific optimizations
    const hasWebP = $('img[src*=".webp"], picture source[type="image/webp"]').length > 0;
    if (!hasWebP && images.length > 0) {
      score -= 10;
      issues.push('Consider using modern image formats like WebP for better mobile performance');
      recommendations.push('Use WebP images for better compression and faster loading');
    }

    return {
      score: Math.max(0, Math.round(score)),
      mobileOptimized,
      imageOptimization: Math.round(imageOptimization),
      issues,
      recommendations
    };
  }

  private analyzeMobileSEO($: cheerio.CheerioAPI) {
    const issues: string[] = [];
    const recommendations: string[] = [];
    let score = 100;

    // Check for mobile-friendly meta tags
    const viewportMeta = $('meta[name="viewport"]').length > 0;
    const appleTouchIcon = $('link[rel="apple-touch-icon"]').length > 0;
    const mobileFriendlyMeta = viewportMeta;

    // Check for responsive design indicators
    const responsiveIndications = [
      $('link[rel="stylesheet"][media*="screen"]').length > 0,
      $('meta[name="viewport"]').length > 0,
      $('style, link').text().includes('@media') || $('style, link').text().includes('media')
    ];
    const responsiveDesign = responsiveIndications.some(Boolean);

    // Check for AMP support
    const ampSupport = $('html[amp], html[⚡]').length > 0 || $('link[rel="amphtml"]').length > 0;

    // Scoring
    if (!mobileFriendlyMeta) {
      score -= 30;
      issues.push('Missing mobile-friendly meta tags');
      recommendations.push('Add viewport meta tag and mobile optimization');
    }

    if (!responsiveDesign) {
      score -= 25;
      issues.push('No responsive design indicators found');
      recommendations.push('Implement responsive CSS design for mobile devices');
    }

    if (!appleTouchIcon) {
      score -= 10;
      issues.push('Missing Apple touch icon for mobile bookmarks');
      recommendations.push('Add Apple touch icon for better mobile experience');
    }

    // Check for mobile-specific structured data
    const structuredData = $('script[type="application/ld+json"]');
    let hasMobileStructuredData = false;
    structuredData.each((_, script) => {
      const content = $(script).html() || '';
      if (content.includes('MobileApplication') || content.includes('mobileUrl')) {
        hasMobileStructuredData = true;
      }
    });

    if (!hasMobileStructuredData && structuredData.length > 0) {
      score -= 15;
      issues.push('Structured data not optimized for mobile');
      recommendations.push('Add mobile-specific structured data markup');
    }

    return {
      score: Math.max(0, Math.round(score)),
      mobileFriendlyMeta,
      responsiveDesign,
      ampSupport,
      issues,
      recommendations
    };
  }

  private calculateOverallScore(
    metaTags: MetaTagAnalysis,
    accessibilityIssues: AccessibilityIssue[],
    brokenLinks: BrokenLink[],
    performanceMetrics: PerformanceMetrics
  ): number {
    let score = 100;

    // Meta tags scoring
    Object.values(metaTags).forEach(tag => {
      if (tag.status === 'error') score -= 10;
      else if (tag.status === 'warning') score -= 5;
    });

    // Accessibility scoring
    accessibilityIssues.forEach(issue => {
      if (issue.severity === 'critical') score -= 15;
      else if (issue.severity === 'warning') score -= 8;
    });

    // Broken links scoring
    score -= brokenLinks.length * 5;

    // Performance scoring
    if (performanceMetrics.status === 'poor') score -= 20;
    else if (performanceMetrics.status === 'average') score -= 10;

    return Math.max(0, Math.min(100, score));
  }

  private generateRecommendations(
    metaTags: MetaTagAnalysis,
    accessibilityIssues: AccessibilityIssue[],
    brokenLinks: BrokenLink[]
  ): Recommendation[] {
    const recommendations: Recommendation[] = [];

    // Meta tag recommendations
    if (metaTags.title.status === 'error') {
      recommendations.push({
        priority: 'high',
        category: 'SEO',
        title: 'Add missing title tag',
        description: 'Every page should have a unique, descriptive title tag for SEO and user experience.'
      });
    }

    if (metaTags.description.status === 'error') {
      recommendations.push({
        priority: 'high',
        category: 'SEO',
        title: 'Add meta description',
        description: 'Write a compelling meta description to improve click-through rates from search results.'
      });
    }

    if (metaTags.ogImage.status === 'warning') {
      recommendations.push({
        priority: 'medium',
        category: 'SEO',
        title: 'Add Open Graph image',
        description: 'Improve social media sharing by adding an og:image meta tag.'
      });
    }

    // Accessibility recommendations
    const criticalA11yIssues = accessibilityIssues.filter(issue => issue.severity === 'critical');
    criticalA11yIssues.forEach(issue => {
      recommendations.push({
        priority: 'high',
        category: 'Accessibility',
        title: `Fix ${issue.type.toLowerCase()}`,
        description: issue.recommendation
      });
    });

    // Broken links recommendations
    if (brokenLinks.length > 0) {
      recommendations.push({
        priority: 'high',
        category: 'User Experience',
        title: 'Fix broken links',
        description: `Update or remove the ${brokenLinks.length} broken links found on your website.`
      });
    }

    return recommendations;
  }

  private calculateStatistics($: cheerio.CheerioAPI, brokenLinks: BrokenLink[], accessibilityIssues: AccessibilityIssue[]): AuditStatistics {
    // Count all links
    const allLinks = $('a[href]');
    const totalLinks = allLinks.length;
    
    // Count internal vs external links
    let internalLinks = 0;
    let externalLinks = 0;
    
    allLinks.each((_, el) => {
      const href = $(el).attr('href');
      if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) {
        return; // Skip anchors, email, and tel links
      }
      
      if (href.startsWith('/') || href.startsWith('.')) {
        internalLinks++;
      } else if (href.startsWith('http')) {
        externalLinks++;
      } else {
        internalLinks++; // Relative links are internal
      }
    });
    
    // Count images
    const allImages = $('img');
    const totalImages = allImages.length;
    const imagesWithoutAlt = allImages.filter((_, el) => !$(el).attr('alt')).length;
    const imagesWithAlt = totalImages - imagesWithoutAlt;
    
    return {
      totalLinks,
      workingLinks: totalLinks - brokenLinks.length,
      brokenLinks: brokenLinks.length,
      internalLinks,
      externalLinks,
      totalImages,
      imagesWithAlt,
      imagesWithoutAlt
    };
  }

  private performWCAGChecks($: cheerio.CheerioAPI): AccessibilityIssue[] {
    const wcagIssues: AccessibilityIssue[] = [];

    // WCAG 1.1.1 - Non-text Content (Level A)
    const imagesWithEmptyAlt = $('img[alt=""]');
    if (imagesWithEmptyAlt.length > 0) {
      wcagIssues.push({
        type: 'Images with Empty Alt Text',
        severity: 'critical',
        description: `${imagesWithEmptyAlt.length} images have empty alt attributes`,
        wcagLevel: 'A',
        wcagReference: '1.1.1 Non-text Content',
        recommendation: 'Provide meaningful alt text or use alt="" only for decorative images'
      });
    }

    // WCAG 1.4.3 - Contrast (Minimum) (Level AA)
    const textElements = $('p, h1, h2, h3, h4, h5, h6, span, div, li, td, th');
    const lowContrastElements = textElements.filter((_, el) => {
      const style = $(el).attr('style') || '';
      return style.includes('color: #') && (style.includes('background') || style.includes('background-color'));
    });
    
    if (lowContrastElements.length > 0) {
      wcagIssues.push({
        type: 'Potential Color Contrast Issues',
        severity: 'warning',
        description: `${lowContrastElements.length} elements may have color contrast issues`,
        wcagLevel: 'AA',
        wcagReference: '1.4.3 Contrast (Minimum)',
        recommendation: 'Ensure text has sufficient contrast ratio (4.5:1 for normal text, 3:1 for large text)'
      });
    }

    // WCAG 2.4.1 - Bypass Blocks (Level A)
    const skipLinks = $('a[href^="#"]').filter((_, el) => {
      const text = $(el).text().toLowerCase();
      return text.includes('skip') || text.includes('main') || text.includes('content');
    });

    if (skipLinks.length === 0) {
      wcagIssues.push({
        type: 'Missing Skip Links',
        severity: 'warning',
        description: 'No skip links found to bypass navigation',
        wcagLevel: 'A',
        wcagReference: '2.4.1 Bypass Blocks',
        recommendation: 'Add skip links to allow users to bypass repetitive navigation'
      });
    }

    // WCAG 3.1.1 - Language of Page (Level A)
    const htmlLang = $('html').attr('lang');
    if (!htmlLang) {
      wcagIssues.push({
        type: 'Missing Language Declaration',
        severity: 'warning',
        description: 'Page language is not declared',
        wcagLevel: 'A',
        wcagReference: '3.1.1 Language of Page',
        recommendation: 'Add lang attribute to html element (e.g., <html lang="en">)'
      });
    }

    // WCAG 4.1.1 - Parsing (Level A)
    const elementsWithDuplicateIds = new Map<string, number>();
    $('[id]').each((_, el) => {
      const id = $(el).attr('id')!;
      elementsWithDuplicateIds.set(id, (elementsWithDuplicateIds.get(id) || 0) + 1);
    });

    const duplicateIds = Array.from(elementsWithDuplicateIds.entries()).filter(([_, count]) => count > 1);
    if (duplicateIds.length > 0) {
      wcagIssues.push({
        type: 'Duplicate IDs',
        severity: 'critical',
        description: `${duplicateIds.length} duplicate IDs found: ${duplicateIds.map(([id]) => id).join(', ')}`,
        wcagLevel: 'A',
        wcagReference: '4.1.1 Parsing',
        recommendation: 'Ensure all IDs are unique on the page'
      });
    }

    return wcagIssues;
  }

  private calculateAccessibilityScoring(issues: AccessibilityIssue[]): AccessibilityScoring {
    const criticalIssues = issues.filter(issue => issue.severity === 'critical').length;
    const warningIssues = issues.filter(issue => issue.severity === 'warning').length;
    const passedChecks = issues.filter(issue => issue.severity === 'good').length;
    const totalChecks = issues.length;

    // Calculate category scores based on WCAG principles
    const perceivableScore = this.calculateCategoryScore(issues, ['Missing Alt Text', 'Images with Empty Alt Text', 'Potential Color Contrast Issues']);
    const operableScore = this.calculateCategoryScore(issues, ['Interactive Elements Not Keyboard Accessible', 'Missing Skip Links']);
    const understandableScore = this.calculateCategoryScore(issues, ['Missing Language Declaration', 'Missing Page Title']);
    const robustScore = this.calculateCategoryScore(issues, ['Duplicate IDs', 'Buttons Without Accessible Names', 'Form Accessibility']);

    // Calculate overall score (0-100)
    const maxPossibleScore = 100;
    const criticalPenalty = criticalIssues * 15; // 15 points per critical issue
    const warningPenalty = warningIssues * 5;   // 5 points per warning
    const overallScore = Math.max(0, maxPossibleScore - criticalPenalty - warningPenalty);

    // Determine WCAG compliance level
    let wcagComplianceLevel: 'A' | 'AA' | 'AAA' | 'None' = 'None';
    const levelAIssues = issues.filter(issue => issue.wcagLevel === 'A' && issue.severity === 'critical').length;
    const levelAAIssues = issues.filter(issue => issue.wcagLevel === 'AA' && issue.severity === 'critical').length;
    
    if (levelAIssues === 0 && levelAAIssues === 0) {
      wcagComplianceLevel = 'AA';
    } else if (levelAIssues === 0) {
      wcagComplianceLevel = 'A';
    }

    // Calculate compliance percentage
    const totalPossibleIssues = 10; // Based on number of checks we perform
    const actualIssues = criticalIssues + warningIssues;
    const compliancePercentage = Math.max(0, Math.round(((totalPossibleIssues - actualIssues) / totalPossibleIssues) * 100));

    return {
      overallScore,
      wcagComplianceLevel,
      compliancePercentage,
      categoryScores: {
        perceivable: perceivableScore,
        operable: operableScore,
        understandable: understandableScore,
        robust: robustScore
      },
      criticalIssues,
      warningIssues,
      passedChecks,
      totalChecks
    };
  }

  private calculateCategoryScore(issues: AccessibilityIssue[], categoryTypes: string[]): number {
    const categoryIssues = issues.filter(issue => categoryTypes.includes(issue.type));
    const criticalInCategory = categoryIssues.filter(issue => issue.severity === 'critical').length;
    const warningInCategory = categoryIssues.filter(issue => issue.severity === 'warning').length;
    
    const maxScore = 100;
    const penalty = (criticalInCategory * 20) + (warningInCategory * 10);
    return Math.max(0, maxScore - penalty);
  }

  async auditWebsite(url: string): Promise<{
    overallScore: number;
    metaTags: MetaTagAnalysis;
    accessibilityIssues: AccessibilityIssue[];
    accessibilityScoring: AccessibilityScoring;
    seoScoring: SEOScoring;
    mobileAnalysis: MobileAnalysis;
    brokenLinks: BrokenLink[];
    performanceMetrics: PerformanceMetrics;
    recommendations: Recommendation[];
    statistics: AuditStatistics;
  }> {
    const { html, loadTime, contentSize } = await this.fetchPage(url);
    const $ = cheerio.load(html);

    const metaTags = this.analyzeMetaTags($);
    const accessibilityAnalysis = this.analyzeAccessibility($);
    const accessibilityIssues = accessibilityAnalysis.issues;
    const accessibilityScoring = accessibilityAnalysis.scoring;
    const brokenLinks = await this.checkLinks($, url);
    
    const performanceMetrics: PerformanceMetrics = {
      loadTime,
      contentSize,
      httpRequests: $('script, link[rel="stylesheet"], img').length,
      firstPaint: loadTime * 0.6, // Approximation
      status: loadTime < 2000 ? 'good' : loadTime < 4000 ? 'average' : 'poor'
    };

    const statistics = this.calculateStatistics($, brokenLinks, accessibilityIssues);
    const recommendations = this.generateRecommendations(metaTags, accessibilityIssues, brokenLinks);
    
    // Calculate advanced SEO scoring
    const seoScoring = this.calculateAdvancedSEOScoring($, metaTags, accessibilityIssues, brokenLinks, performanceMetrics, statistics);
    
    // Calculate mobile analysis
    const mobileAnalysis = this.analyzeMobileFriendliness($, performanceMetrics);
    
    // Use SEO scoring for overall score (or keep legacy for backward compatibility)
    const overallScore = seoScoring.overallScore;

    return {
      overallScore,
      metaTags,
      accessibilityIssues,
      accessibilityScoring,
      seoScoring,
      mobileAnalysis,
      brokenLinks,
      performanceMetrics,
      recommendations,
      statistics
    };
  }
}
