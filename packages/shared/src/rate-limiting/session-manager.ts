/**
 * Session Manager
 *
 * Manages browser sessions with:
 * - Session rotation
 * - Incognito context handling
 * - Cookie/storage clearing
 * - Robots.txt compliance
 */

/**
 * Session configuration
 */
export interface SessionConfig {
  /** Requests before rotating session */
  rotateAfterRequests: number;

  /** Maximum session age in ms before rotation */
  maxSessionAgeMs: number;

  /** Clear cookies between requests */
  clearCookies: boolean;

  /** Use incognito/private mode */
  useIncognito: boolean;

  /** Respect robots.txt */
  respectRobotsTxt: boolean;
}

/**
 * Session state
 */
export interface SessionState {
  id: string;
  createdAt: number;
  requestCount: number;
  lastRequestAt: number | null;
  cookies: number;
}

/**
 * Robots.txt parsed rules
 */
export interface RobotsTxtRules {
  allowed: string[];
  disallowed: string[];
  crawlDelay: number | null;
  sitemaps: string[];
  fetchedAt: number;
}

/**
 * Default session configuration
 */
const DEFAULT_SESSION_CONFIG: SessionConfig = {
  rotateAfterRequests: 50,
  maxSessionAgeMs: 30 * 60 * 1000, // 30 minutes
  clearCookies: true,
  useIncognito: true,
  respectRobotsTxt: true,
};

/**
 * Parse robots.txt content
 */
export function parseRobotsTxt(content: string): RobotsTxtRules {
  const rules: RobotsTxtRules = {
    allowed: [],
    disallowed: [],
    crawlDelay: null,
    sitemaps: [],
    fetchedAt: Date.now(),
  };

  const lines = content.split("\n");
  let isRelevantUserAgent = false;

  for (const line of lines) {
    const trimmed = line.trim().toLowerCase();

    // Check user agent
    if (trimmed.startsWith("user-agent:")) {
      const agent = trimmed.slice("user-agent:".length).trim();
      isRelevantUserAgent = agent === "*" || agent.includes("bot");
    }

    // Only parse rules for relevant user agents
    if (!isRelevantUserAgent) continue;

    if (trimmed.startsWith("disallow:")) {
      const path = trimmed.slice("disallow:".length).trim();
      if (path) {
        rules.disallowed.push(path);
      }
    } else if (trimmed.startsWith("allow:")) {
      const path = trimmed.slice("allow:".length).trim();
      if (path) {
        rules.allowed.push(path);
      }
    } else if (trimmed.startsWith("crawl-delay:")) {
      const delay = parseFloat(trimmed.slice("crawl-delay:".length).trim());
      if (!isNaN(delay)) {
        rules.crawlDelay = delay * 1000; // Convert to ms
      }
    } else if (trimmed.startsWith("sitemap:")) {
      const sitemap = line.slice(line.indexOf(":") + 1).trim();
      if (sitemap) {
        rules.sitemaps.push(sitemap);
      }
    }
  }

  return rules;
}

/**
 * Check if a URL path is allowed by robots.txt rules
 */
export function isPathAllowed(path: string, rules: RobotsTxtRules): boolean {
  // Check allowed first (more specific usually)
  for (const allowed of rules.allowed) {
    if (path.startsWith(allowed)) {
      return true;
    }
  }

  // Check disallowed
  for (const disallowed of rules.disallowed) {
    if (disallowed === "/" || path.startsWith(disallowed)) {
      return false;
    }
  }

  // Default allow if not explicitly disallowed
  return true;
}

/**
 * Generate a unique session ID
 */
function generateSessionId(): string {
  return `session_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Session manager for browser context handling
 */
export class SessionManager {
  private readonly config: SessionConfig;
  private currentSession: SessionState;
  private robotsCache = new Map<string, RobotsTxtRules>();
  private readonly robotsCacheMaxAge = 3600000; // 1 hour

  constructor(config: Partial<SessionConfig> = {}) {
    this.config = { ...DEFAULT_SESSION_CONFIG, ...config };
    this.currentSession = this.createSession();
  }

  /**
   * Create a new session state
   */
  private createSession(): SessionState {
    return {
      id: generateSessionId(),
      createdAt: Date.now(),
      requestCount: 0,
      lastRequestAt: null,
      cookies: 0,
    };
  }

  /**
   * Check if session should be rotated
   */
  shouldRotate(): boolean {
    const { rotateAfterRequests, maxSessionAgeMs } = this.config;
    const { createdAt, requestCount } = this.currentSession;

    // Check request count
    if (requestCount >= rotateAfterRequests) {
      return true;
    }

    // Check age
    if (Date.now() - createdAt >= maxSessionAgeMs) {
      return true;
    }

    return false;
  }

  /**
   * Rotate to a new session
   */
  rotate(): SessionState {
    const oldSession = this.currentSession;
    this.currentSession = this.createSession();
    return oldSession;
  }

  /**
   * Record a request
   */
  recordRequest(): void {
    this.currentSession.requestCount++;
    this.currentSession.lastRequestAt = Date.now();
  }

  /**
   * Get current session state
   */
  getSession(): SessionState {
    return { ...this.currentSession };
  }

  /**
   * Get session age in ms
   */
  getSessionAge(): number {
    return Date.now() - this.currentSession.createdAt;
  }

  /**
   * Check and auto-rotate if needed
   */
  checkRotation(): { rotated: boolean; oldSession?: SessionState } {
    if (this.shouldRotate()) {
      const oldSession = this.rotate();
      return { rotated: true, oldSession };
    }
    return { rotated: false };
  }

  /**
   * Get configuration
   */
  getConfig(): SessionConfig {
    return { ...this.config };
  }

  /**
   * Fetch and parse robots.txt for a domain
   */
  async fetchRobotsTxt(
    domain: string,
    fetchFn: (url: string) => Promise<string>
  ): Promise<RobotsTxtRules | null> {
    // Check cache
    const cached = this.robotsCache.get(domain);
    if (cached && Date.now() - cached.fetchedAt < this.robotsCacheMaxAge) {
      return cached;
    }

    try {
      const url = `https://${domain}/robots.txt`;
      const content = await fetchFn(url);
      const rules = parseRobotsTxt(content);
      this.robotsCache.set(domain, rules);
      return rules;
    } catch {
      // No robots.txt or fetch error - allow all
      return null;
    }
  }

  /**
   * Check if crawling is allowed for a URL
   */
  async canCrawl(
    url: string,
    fetchFn: (url: string) => Promise<string>
  ): Promise<{ allowed: boolean; crawlDelay?: number }> {
    if (!this.config.respectRobotsTxt) {
      return { allowed: true };
    }

    try {
      const urlObj = new URL(url);
      const rules = await this.fetchRobotsTxt(urlObj.hostname, fetchFn);

      if (!rules) {
        return { allowed: true };
      }

      const allowed = isPathAllowed(urlObj.pathname, rules);
      const result: { allowed: boolean; crawlDelay?: number } = { allowed };
      if (rules.crawlDelay !== null) {
        result.crawlDelay = rules.crawlDelay;
      }
      return result;
    } catch {
      // On error, allow but be cautious
      return { allowed: true };
    }
  }

  /**
   * Get cached robots.txt rules for a domain
   */
  getCachedRobotsTxt(domain: string): RobotsTxtRules | null {
    return this.robotsCache.get(domain) ?? null;
  }

  /**
   * Clear robots.txt cache
   */
  clearRobotsCache(): void {
    this.robotsCache.clear();
  }

  /**
   * Get session statistics
   */
  getStats(): {
    currentSession: SessionState;
    sessionAge: number;
    shouldRotate: boolean;
    robotsCacheSize: number;
  } {
    return {
      currentSession: this.getSession(),
      sessionAge: this.getSessionAge(),
      shouldRotate: this.shouldRotate(),
      robotsCacheSize: this.robotsCache.size,
    };
  }
}

/**
 * Create a session manager with default config
 */
export function createSessionManager(
  config?: Partial<SessionConfig>
): SessionManager {
  return new SessionManager(config);
}

/**
 * Global session manager instance
 */
export const globalSessionManager = new SessionManager();

/**
 * Exponential backoff calculator
 */
export class BackoffCalculator {
  private readonly baseDelayMs: number;
  private readonly maxDelayMs: number;
  private readonly multiplier: number;
  private currentAttempt = 0;

  constructor(
    baseDelayMs = 1000,
    maxDelayMs = 300000,
    multiplier = 2
  ) {
    this.baseDelayMs = baseDelayMs;
    this.maxDelayMs = maxDelayMs;
    this.multiplier = multiplier;
  }

  /**
   * Get next backoff delay
   */
  nextDelay(): number {
    const delay = Math.min(
      this.baseDelayMs * Math.pow(this.multiplier, this.currentAttempt),
      this.maxDelayMs
    );

    // Add jitter (±20%)
    const jitter = delay * 0.2 * (Math.random() * 2 - 1);
    this.currentAttempt++;

    return Math.round(delay + jitter);
  }

  /**
   * Reset attempts
   */
  reset(): void {
    this.currentAttempt = 0;
  }

  /**
   * Get current attempt number
   */
  getAttempt(): number {
    return this.currentAttempt;
  }
}

/**
 * Create a backoff calculator
 */
export function createBackoff(
  baseDelayMs?: number,
  maxDelayMs?: number,
  multiplier?: number
): BackoffCalculator {
  return new BackoffCalculator(baseDelayMs, maxDelayMs, multiplier);
}
