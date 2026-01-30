/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Page, HTTPResponse } from "puppeteer";

import { BrowserError } from "@the-closer/shared";

// Browser globals available inside page.evaluate()
declare const document: any;

import {
  type SearchCriteria,
  type RawBusinessEntity,
  type MapsScraperConfig,
  type StealthConfig,
  type ScraperResult,
  MapsScraperConfigSchema,
  StealthConfigSchema,
} from "./types.js";

/**
 * Google Maps scraper using network interception
 *
 * Extracts business data from Google Maps search results
 * using stealth techniques to avoid detection.
 */
export class MapsScraper {
  private readonly config: MapsScraperConfig;
  private readonly stealthConfig: StealthConfig;
  private responseBuffer: RawBusinessEntity[] = [];
  private interceptedResponses = 0;
  private userAgentIndex = 0;

  constructor(
    config: Partial<MapsScraperConfig> = {},
    stealthConfig: Partial<StealthConfig> = {}
  ) {
    this.config = MapsScraperConfigSchema.parse(config);
    this.stealthConfig = StealthConfigSchema.parse(stealthConfig);
  }

  /**
   * Search for businesses matching the criteria
   */
  async searchBusinesses(
    page: Page,
    criteria: SearchCriteria
  ): Promise<ScraperResult> {
    const startTime = Date.now();
    const errors: string[] = [];
    let scrollAttempts = 0;

    // Reset state for new search
    this.responseBuffer = [];
    this.interceptedResponses = 0;

    try {
      // Apply stealth measures
      await this.applyStealthMeasures(page);

      // Setup network interception
      await this.setupNetworkInterception(page);

      // Build and navigate to Maps URL
      const searchUrl = this.buildMapsUrl(criteria);
      await this.navigateToMaps(page, searchUrl);

      // Wait for initial results
      await this.waitForResults(page);

      // Scroll to load more results
      scrollAttempts = await this.loadAllResults(page);

      // Apply delay between searches
      await this.delay(
        this.config.delayBetweenSearches + this.getRandomDelay()
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown error during search";
      errors.push(message);
    }

    // Deduplicate by placeId
    const deduplicated = this.deduplicateResults();

    return {
      businesses: deduplicated,
      totalFound: deduplicated.length,
      searchDurationMs: Date.now() - startTime,
      scrollAttempts,
      errors,
    };
  }

  /**
   * Setup network interception to capture Maps API responses
   */
  private async setupNetworkInterception(page: Page): Promise<void> {
    page.on("response", async (response: HTTPResponse) => {
      try {
        await this.handleResponse(response);
      } catch {
        // Silently ignore response handling errors
      }
    });
  }

  /**
   * Handle intercepted network response
   */
  private async handleResponse(response: HTTPResponse): Promise<void> {
    const url = response.url();

    // Filter for Maps search results
    if (!this.isSearchResultResponse(url)) {
      return;
    }

    // Only process successful responses
    if (response.status() !== 200) {
      return;
    }

    try {
      const text = await response.text();

      // Google Maps API responses often start with )]}' for security
      const cleanedText = text.replace(/^\)\]\}'/, "").trim();

      if (!cleanedText.startsWith("[") && !cleanedText.startsWith("{")) {
        return;
      }

      const json = JSON.parse(cleanedText);
      const businesses = this.parseBusinessData(json);

      if (businesses.length > 0) {
        this.responseBuffer.push(...businesses);
        this.interceptedResponses++;
      }
    } catch {
      // JSON parsing failed, skip this response
    }
  }

  /**
   * Check if URL is a Maps search result response
   */
  private isSearchResultResponse(url: string): boolean {
    const patterns = [
      "maps.googleapis.com",
      "/maps/api/place",
      "/search?",
      "tbm=lcl", // Local search
      "/localservices/",
      "google.com/maps/preview/",
      "google.com/maps/rpc/",
    ];

    return patterns.some((pattern) => url.includes(pattern));
  }

  /**
   * Parse business data from Google Maps JSON response
   *
   * Google Maps responses have complex nested structures.
   * This attempts to extract business data from various known formats.
   */
  private parseBusinessData(json: unknown): RawBusinessEntity[] {
    const businesses: RawBusinessEntity[] = [];

    if (!json || typeof json !== "object") {
      return businesses;
    }

    // Try to find business data in various nested structures
    this.extractBusinessesRecursively(json, businesses);

    return businesses;
  }

  /**
   * Recursively search for business data in nested JSON
   */
  private extractBusinessesRecursively(
    obj: unknown,
    results: RawBusinessEntity[],
    depth = 0
  ): void {
    // Prevent infinite recursion
    if (depth > 15) return;

    if (Array.isArray(obj)) {
      for (const item of obj) {
        this.extractBusinessesRecursively(item, results, depth + 1);
      }
      return;
    }

    if (obj && typeof obj === "object") {
      const record = obj as Record<string, unknown>;

      // Check if this object looks like a business entity
      const business = this.tryExtractBusiness(record);
      if (business) {
        results.push(business);
        return; // Don't recurse into business objects
      }

      // Continue searching nested objects
      for (const value of Object.values(record)) {
        this.extractBusinessesRecursively(value, results, depth + 1);
      }
    }
  }

  /**
   * Try to extract a business entity from an object
   */
  private tryExtractBusiness(
    obj: Record<string, unknown>
  ): RawBusinessEntity | null {
    // Look for common patterns in Google Maps data
    // Pattern 1: Direct properties
    if (this.hasBusinessProperties(obj)) {
      return this.extractFromDirectProperties(obj);
    }

    // Pattern 2: Nested in numbered array indices (common in Maps API)
    if (Array.isArray(obj[14]) || Array.isArray(obj[11])) {
      return this.extractFromArrayPattern(obj);
    }

    return null;
  }

  /**
   * Check if object has business-like properties
   */
  private hasBusinessProperties(obj: Record<string, unknown>): boolean {
    const businessIndicators = [
      "name",
      "title",
      "displayName",
      "place_id",
      "placeId",
      "formatted_address",
      "rating",
    ];

    const hasName =
      typeof obj["name"] === "string" ||
      typeof obj["title"] === "string" ||
      typeof obj["displayName"] === "string";

    const hasIndicator = businessIndicators.some(
      (key) => obj[key] !== undefined
    );

    return hasName && hasIndicator;
  }

  /**
   * Extract business from direct properties
   */
  private extractFromDirectProperties(
    obj: Record<string, unknown>
  ): RawBusinessEntity | null {
    const name = this.getString(obj, ["name", "title", "displayName"]);
    if (!name) return null;

    const address = this.getString(obj, [
      "formatted_address",
      "address",
      "vicinity",
    ]);
    if (!address) return null;

    return {
      name,
      address,
      phone: this.getString(obj, [
        "formatted_phone_number",
        "phone",
        "phoneNumber",
      ]),
      website: this.getString(obj, ["website", "url"]),
      rating: this.getNumber(obj, ["rating"]),
      reviewCount: this.getNumber(obj, ["user_ratings_total", "reviewCount"]) ?? 0,
      placeId: this.getString(obj, ["place_id", "placeId"]) ?? this.generatePlaceId(name, address),
      latitude: this.getNestedNumber(obj, ["geometry", "location", "lat"]),
      longitude: this.getNestedNumber(obj, ["geometry", "location", "lng"]),
      categories: this.getStringArray(obj, ["types", "categories"]),
    };
  }

  /**
   * Extract business from Google Maps array pattern
   * Maps often encodes data in nested numbered arrays
   */
  private extractFromArrayPattern(
    obj: Record<string, unknown>
  ): RawBusinessEntity | null {
    // This is a simplified extraction - actual Google Maps responses
    // have very complex nested array structures that vary by endpoint
    const arr = obj as unknown as unknown[][];

    try {
      // Common pattern: name at [11], address at [18], etc.
      const name = this.findStringInArray(arr, 11) || this.findStringInArray(arr, 14);
      if (!name || name.length < 2) return null;

      const address = this.findStringInArray(arr, 18) || this.findStringInArray(arr, 39);
      if (!address) return null;

      const placeId = this.findStringInArray(arr, 78) || this.findStringInArray(arr, 0);

      return {
        name,
        address,
        phone: this.findStringInArray(arr, 178) || null,
        website: this.findStringInArray(arr, 7) || null,
        rating: this.findNumberInArray(arr, 4),
        reviewCount: this.findNumberInArray(arr, 5) ?? 0,
        placeId: placeId ?? this.generatePlaceId(name, address),
        categories: [],
      };
    } catch {
      return null;
    }
  }

  /**
   * Helper: Get string from object by multiple possible keys
   */
  private getString(
    obj: Record<string, unknown>,
    keys: string[]
  ): string | null {
    for (const key of keys) {
      const value = obj[key];
      if (typeof value === "string" && value.trim()) {
        return value.trim();
      }
    }
    return null;
  }

  /**
   * Helper: Get number from object by multiple possible keys
   */
  private getNumber(
    obj: Record<string, unknown>,
    keys: string[]
  ): number | null {
    for (const key of keys) {
      const value = obj[key];
      if (typeof value === "number" && !isNaN(value)) {
        return value;
      }
    }
    return null;
  }

  /**
   * Helper: Get nested number from object path
   */
  private getNestedNumber(
    obj: Record<string, unknown>,
    path: string[]
  ): number | undefined {
    let current: unknown = obj;
    for (const key of path) {
      if (current && typeof current === "object") {
        current = (current as Record<string, unknown>)[key];
      } else {
        return undefined;
      }
    }
    return typeof current === "number" ? current : undefined;
  }

  /**
   * Helper: Get string array from object
   */
  private getStringArray(
    obj: Record<string, unknown>,
    keys: string[]
  ): string[] {
    for (const key of keys) {
      const value = obj[key];
      if (Array.isArray(value)) {
        return value.filter((v): v is string => typeof v === "string");
      }
    }
    return [];
  }

  /**
   * Helper: Find string in nested array
   */
  private findStringInArray(arr: unknown[][], index: number): string | null {
    try {
      const value = arr[index];
      if (typeof value === "string") return value;
      if (Array.isArray(value) && typeof value[0] === "string") return value[0];
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Helper: Find number in nested array
   */
  private findNumberInArray(arr: unknown[][], index: number): number | null {
    try {
      const value = arr[index];
      if (typeof value === "number") return value;
      if (Array.isArray(value) && typeof value[0] === "number") return value[0];
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Generate a placeId-like identifier from name and address
   */
  private generatePlaceId(name: string, address: string): string {
    const combined = `${name}-${address}`.toLowerCase().replace(/\s+/g, "-");
    return `gen_${Buffer.from(combined).toString("base64").slice(0, 20)}`;
  }

  /**
   * Build Google Maps search URL
   */
  private buildMapsUrl(criteria: SearchCriteria): string {
    const query = encodeURIComponent(`${criteria.query} ${criteria.location}`);
    return `https://www.google.com/maps/search/${query}`;
  }

  /**
   * Navigate to Google Maps with error handling
   */
  private async navigateToMaps(page: Page, url: string): Promise<void> {
    try {
      await page.goto(url, {
        waitUntil: "networkidle2",
        timeout: 30000,
      });
    } catch (error) {
      throw new BrowserError(`Failed to navigate to Maps: ${url}`, {
        cause: error instanceof Error ? error : undefined,
      });
    }
  }

  /**
   * Wait for search results to appear
   */
  private async waitForResults(page: Page): Promise<void> {
    const selectors = [
      '[role="feed"]', // Results feed
      ".Nv2PK", // Business card
      '[data-index="0"]', // First result
      ".section-result", // Legacy selector
    ];

    for (const selector of selectors) {
      try {
        await page.locator(selector).setTimeout(this.config.scrollTimeout).wait();
        return;
      } catch {
        // Try next selector
      }
    }

    // If no selector matched, wait a bit and check if we have intercepted data
    await this.delay(2000);
    if (this.responseBuffer.length > 0) {
      return; // We got data from network interception
    }

    throw new BrowserError("No search results found");
  }

  /**
   * Load all results by scrolling
   */
  private async loadAllResults(page: Page): Promise<number> {
    let scrollAttempts = 0;
    let lastCount = 0;
    let noNewResultsCount = 0;

    while (
      scrollAttempts < this.config.maxScrollAttempts &&
      this.responseBuffer.length < this.config.maxResults
    ) {
      scrollAttempts++;

      // Perform human-like scroll
      await this.humanLikeScroll(page);

      // Wait for new results to load
      await this.delay(
        this.config.delayBetweenScrolls + this.getRandomDelay()
      );

      // Check if new results appeared
      const currentCount = this.responseBuffer.length;
      if (currentCount === lastCount) {
        noNewResultsCount++;
        if (noNewResultsCount >= 3) {
          // No new results after 3 attempts, stop scrolling
          break;
        }
      } else {
        noNewResultsCount = 0;
        lastCount = currentCount;
      }
    }

    return scrollAttempts;
  }

  /**
   * Apply stealth measures to the page
   */
  private async applyStealthMeasures(page: Page): Promise<void> {
    // Set random user agent
    const userAgent = this.getRandomUserAgent();
    await page.setUserAgent(userAgent);

    // Set viewport to realistic desktop size
    await page.setViewport({
      width: 1920,
      height: 1080,
      deviceScaleFactor: 1,
    });

    // Set geolocation permission
    const context = page.browserContext();
    await context.overridePermissions("https://www.google.com", ["geolocation"]);
  }

  /**
   * Get a random user agent from the list
   */
  private getRandomUserAgent(): string {
    const agents = this.stealthConfig.userAgents;
    this.userAgentIndex = (this.userAgentIndex + 1) % agents.length;
    return agents[this.userAgentIndex]!;
  }

  /**
   * Get a random delay within configured range
   */
  private getRandomDelay(): number {
    const { minDelay, maxDelay } = this.stealthConfig;
    return Math.floor(Math.random() * (maxDelay - minDelay)) + minDelay;
  }

  /**
   * Human-like scroll with variance
   */
  private async humanLikeScroll(page: Page): Promise<void> {
    const baseDistance = 600;
    const variance = this.stealthConfig.scrollVariance;

    // Add random variance to scroll distance
    const actualDistance =
      baseDistance * (1 + (Math.random() * 2 - 1) * variance);

    // Find the scrollable container
    await page.evaluate((distance) => {
      const feedElement = document.querySelector('[role="feed"]');
      const scrollContainer =
        feedElement?.parentElement ?? document.documentElement;

      // Scroll in smaller steps for more human-like behavior
      const steps = 3 + Math.floor(Math.random() * 3);
      const stepDistance = distance / steps;

      let scrolled = 0;
      const scrollStep = () => {
        if (scrolled < distance) {
          scrollContainer.scrollTop += stepDistance;
          scrolled += stepDistance;
          setTimeout(scrollStep, 50 + Math.random() * 100);
        }
      };

      scrollStep();
    }, actualDistance);

    // Occasional small reverse scroll (more human-like)
    if (Math.random() < 0.2) {
      await this.delay(300);
      await page.evaluate(() => {
        const feedElement = document.querySelector('[role="feed"]');
        const scrollContainer =
          feedElement?.parentElement ?? document.documentElement;
        scrollContainer.scrollTop -= 50 + Math.random() * 50;
      });
    }
  }

  /**
   * Delay execution
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Deduplicate results by placeId
   */
  private deduplicateResults(): RawBusinessEntity[] {
    const seen = new Set<string>();
    const unique: RawBusinessEntity[] = [];

    for (const business of this.responseBuffer) {
      if (!seen.has(business.placeId)) {
        seen.add(business.placeId);
        unique.push(business);
      }
    }

    return unique;
  }
}
