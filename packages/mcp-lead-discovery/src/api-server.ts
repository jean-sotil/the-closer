import { createServer, IncomingMessage, ServerResponse } from "http";
import puppeteer, { Browser } from "puppeteer";

import { MapsScraper } from "./maps-scraper.js";
import { DataExtractor } from "./data-extractor.js";
import { ProspectQualifier, DEFAULT_QUALIFICATION_RULES } from "./qualifier.js";
import type { SearchCriteria, DiscoveredBusiness } from "./types.js";

const PORT = process.env["DISCOVERY_API_PORT"] || 3001;

let browser: Browser | null = null;

/**
 * Initialize Puppeteer browser
 */
async function initBrowser(): Promise<Browser> {
  if (!browser) {
    console.log("🚀 Launching Puppeteer browser...");
    browser = await puppeteer.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-accelerated-2d-canvas",
        "--disable-gpu",
      ],
    });
    console.log("✅ Browser launched");
  }
  return browser;
}

/**
 * Parse JSON body from request
 */
async function parseBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk.toString();
    });
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (e) {
        reject(e);
      }
    });
    req.on("error", reject);
  });
}

/**
 * Send JSON response
 */
function sendJson(res: ServerResponse, status: number, data: unknown): void {
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  });
  res.end(JSON.stringify(data));
}

/**
 * Handle discovery search request
 */
async function handleDiscovery(
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  try {
    const body = (await parseBody(req)) as {
      query?: string;
      location?: string;
      maxResults?: number;
    };

    if (!body.query || !body.location) {
      sendJson(res, 400, { error: "Missing query or location" });
      return;
    }

    const maxResults = body.maxResults || 20;
    const criteria: SearchCriteria = {
      query: body.query,
      location: body.location,
    };

    console.log(`\n🔍 Starting discovery: "${criteria.query}" in "${criteria.location}"`);

    // Initialize browser and scraper
    const browserInstance = await initBrowser();
    const page = await browserInstance.newPage();

    try {
      // Set mobile viewport for Google Maps
      await page.setViewport({ width: 375, height: 812, isMobile: true });

      // Set user agent
      await page.setUserAgent(
        "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1"
      );

      // Create scraper and search
      const scraper = new MapsScraper();
      const qualifier = new ProspectQualifier(DEFAULT_QUALIFICATION_RULES);

      console.log("📍 Navigating to Google Maps...");
      const scraperResult = await scraper.searchBusinesses(page, criteria);

      console.log(`📊 Found ${scraperResult.businesses.length} raw businesses`);

      // Extract and validate
      const extractionResult = DataExtractor.extractBatch(scraperResult.businesses);
      console.log(`✅ Extracted ${extractionResult.successful.length} valid businesses`);

      // Qualify prospects
      const qualified = qualifier.filterQualified(extractionResult.successful);
      console.log(`🎯 Qualified ${qualified.length} prospects`);

      // Map to response format
      const leads: DiscoveredBusiness[] = qualified.slice(0, maxResults);

      sendJson(res, 200, {
        success: true,
        leads,
        stats: {
          found: scraperResult.businesses.length,
          extracted: extractionResult.successful.length,
          qualified: qualified.length,
          returned: leads.length,
        },
      });
    } finally {
      await page.close();
    }
  } catch (error) {
    console.error("❌ Discovery error:", error);
    sendJson(res, 500, {
      error: error instanceof Error ? error.message : "Discovery failed",
    });
  }
}

/**
 * Request handler
 */
async function handleRequest(
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  const url = req.url || "/";
  const method = req.method || "GET";

  // CORS preflight
  if (method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    });
    res.end();
    return;
  }

  // Health check
  if (url === "/health" && method === "GET") {
    sendJson(res, 200, { status: "ok", service: "lead-discovery" });
    return;
  }

  // Discovery endpoint
  if (url === "/api/discover" && method === "POST") {
    await handleDiscovery(req, res);
    return;
  }

  // 404
  sendJson(res, 404, { error: "Not found" });
}

/**
 * Start the API server
 */
function startServer(): void {
  const server = createServer((req, res) => {
    handleRequest(req, res).catch((error) => {
      console.error("Request error:", error);
      sendJson(res, 500, { error: "Internal server error" });
    });
  });

  server.listen(PORT, () => {
    console.log(`
╔════════════════════════════════════════════════════╗
║                                                    ║
║   🔍 Lead Discovery API Server                     ║
║                                                    ║
║   Running on: http://localhost:${PORT}              ║
║                                                    ║
║   Endpoints:                                       ║
║   • GET  /health      - Health check               ║
║   • POST /api/discover - Search Google Maps        ║
║                                                    ║
╚════════════════════════════════════════════════════╝
    `);
  });

  // Cleanup on exit
  process.on("SIGINT", async () => {
    console.log("\n🛑 Shutting down...");
    if (browser) {
      await browser.close();
    }
    process.exit(0);
  });
}

// Start if run directly
startServer();
