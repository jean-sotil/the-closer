/**
 * Anti-Detection Utilities
 *
 * Provides stealth measures for web scraping:
 * - User agent rotation
 * - Viewport randomization
 * - Human-like behavior simulation
 * - Fingerprint evasion helpers
 */

/**
 * Browser viewport configuration
 */
export interface ViewportConfig {
  width: number;
  height: number;
  deviceScaleFactor: number;
  isMobile: boolean;
  hasTouch: boolean;
}

/**
 * User agent with metadata
 */
export interface UserAgentInfo {
  userAgent: string;
  platform: string;
  vendor: string;
  mobile: boolean;
}

/**
 * Pool of realistic user agents (Chrome/Firefox/Safari on Windows/Mac/Linux)
 */
export const USER_AGENT_POOL: UserAgentInfo[] = [
  // Chrome on Windows
  {
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    platform: "Win32",
    vendor: "Google Inc.",
    mobile: false,
  },
  {
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
    platform: "Win32",
    vendor: "Google Inc.",
    mobile: false,
  },
  {
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
    platform: "Win32",
    vendor: "Google Inc.",
    mobile: false,
  },
  // Chrome on Mac
  {
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    platform: "MacIntel",
    vendor: "Google Inc.",
    mobile: false,
  },
  {
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
    platform: "MacIntel",
    vendor: "Google Inc.",
    mobile: false,
  },
  // Firefox on Windows
  {
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0",
    platform: "Win32",
    vendor: "",
    mobile: false,
  },
  {
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:122.0) Gecko/20100101 Firefox/122.0",
    platform: "Win32",
    vendor: "",
    mobile: false,
  },
  // Firefox on Mac
  {
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:121.0) Gecko/20100101 Firefox/121.0",
    platform: "MacIntel",
    vendor: "",
    mobile: false,
  },
  // Safari on Mac
  {
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15",
    platform: "MacIntel",
    vendor: "Apple Computer, Inc.",
    mobile: false,
  },
  {
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15",
    platform: "MacIntel",
    vendor: "Apple Computer, Inc.",
    mobile: false,
  },
  // Chrome on Linux
  {
    userAgent:
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    platform: "Linux x86_64",
    vendor: "Google Inc.",
    mobile: false,
  },
];

/**
 * Common screen resolutions for desktop
 */
export const SCREEN_RESOLUTIONS: Array<{ width: number; height: number }> = [
  { width: 1920, height: 1080 }, // Full HD (most common)
  { width: 1366, height: 768 }, // HD
  { width: 1536, height: 864 }, // HD+
  { width: 1440, height: 900 }, // WXGA+
  { width: 2560, height: 1440 }, // QHD
  { width: 1680, height: 1050 }, // WSXGA+
  { width: 1280, height: 720 }, // HD
  { width: 1600, height: 900 }, // HD+
];

/**
 * User agent rotator with round-robin and random selection
 */
export class UserAgentRotator {
  private readonly pool: UserAgentInfo[];
  private currentIndex = 0;

  constructor(pool: UserAgentInfo[] = USER_AGENT_POOL) {
    this.pool = [...pool];
    // Shuffle on initialization for randomness
    this.shuffle();
  }

  /**
   * Get the next user agent in rotation
   */
  next(): UserAgentInfo {
    const agent = this.pool[this.currentIndex]!;
    this.currentIndex = (this.currentIndex + 1) % this.pool.length;
    return agent;
  }

  /**
   * Get a random user agent
   */
  random(): UserAgentInfo {
    const index = Math.floor(Math.random() * this.pool.length);
    return this.pool[index]!;
  }

  /**
   * Shuffle the pool
   */
  shuffle(): void {
    for (let i = this.pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.pool[i], this.pool[j]] = [this.pool[j]!, this.pool[i]!];
    }
    this.currentIndex = 0;
  }

  /**
   * Get pool size
   */
  get size(): number {
    return this.pool.length;
  }
}

/**
 * Generate randomized viewport dimensions
 */
export function generateRandomViewport(
  variationPercent = 5
): ViewportConfig {
  // Pick a base resolution
  const base =
    SCREEN_RESOLUTIONS[Math.floor(Math.random() * SCREEN_RESOLUTIONS.length)]!;

  // Apply random variation
  const variation = variationPercent / 100;
  const width = Math.round(
    base.width * (1 + (Math.random() * 2 - 1) * variation)
  );
  const height = Math.round(
    base.height * (1 + (Math.random() * 2 - 1) * variation)
  );

  return {
    width,
    height,
    deviceScaleFactor: 1,
    isMobile: false,
    hasTouch: false,
  };
}

/**
 * Generate random delay within bounds
 */
export function randomDelay(minMs: number, maxMs: number): number {
  return Math.floor(Math.random() * (maxMs - minMs)) + minMs;
}

/**
 * Sleep for a random duration
 */
export function sleepRandom(minMs: number, maxMs: number): Promise<void> {
  const delay = randomDelay(minMs, maxMs);
  return new Promise((resolve) => setTimeout(resolve, delay));
}

/**
 * Human-like scroll distance (varies amount)
 */
export function humanScrollDistance(
  baseDistance: number,
  variance = 0.3
): number {
  const multiplier = 1 + (Math.random() * 2 - 1) * variance;
  return Math.round(baseDistance * multiplier);
}

/**
 * Generate Bezier curve points for mouse movement
 * Creates a natural-looking path between two points
 */
export function generateMousePath(
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  steps = 10
): Array<{ x: number; y: number }> {
  const path: Array<{ x: number; y: number }> = [];

  // Generate random control points for bezier curve
  const midX = (startX + endX) / 2;
  const midY = (startY + endY) / 2;

  const cp1x = startX + (midX - startX) * 0.5 + (Math.random() - 0.5) * 100;
  const cp1y = startY + (midY - startY) * 0.5 + (Math.random() - 0.5) * 100;
  const cp2x = midX + (endX - midX) * 0.5 + (Math.random() - 0.5) * 100;
  const cp2y = midY + (endY - midY) * 0.5 + (Math.random() - 0.5) * 100;

  // Generate points along the bezier curve
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const u = 1 - t;

    // Cubic bezier formula
    const x =
      u * u * u * startX +
      3 * u * u * t * cp1x +
      3 * u * t * t * cp2x +
      t * t * t * endX;

    const y =
      u * u * u * startY +
      3 * u * u * t * cp1y +
      3 * u * t * t * cp2y +
      t * t * t * endY;

    path.push({ x: Math.round(x), y: Math.round(y) });
  }

  return path;
}

/**
 * Simulate human typing delay (varies between keystrokes)
 */
export function humanTypingDelay(): number {
  // Average typing speed: 200ms per character with variance
  const base = 150;
  const variance = 100;
  return base + Math.random() * variance;
}

/**
 * Generate delays for typing a string
 */
export function generateTypingDelays(text: string): number[] {
  return Array.from({ length: text.length }, () => humanTypingDelay());
}

/**
 * Should perform occasional reverse scroll (human behavior)
 */
export function shouldReverseScroll(probability = 0.2): boolean {
  return Math.random() < probability;
}

/**
 * Generate a realistic browser timezone
 */
export function getRandomTimezone(): string {
  const timezones = [
    "America/New_York",
    "America/Chicago",
    "America/Denver",
    "America/Los_Angeles",
    "America/Phoenix",
    "America/Anchorage",
    "Pacific/Honolulu",
    "America/Toronto",
    "America/Vancouver",
  ];
  return timezones[Math.floor(Math.random() * timezones.length)]!;
}

/**
 * Generate realistic WebGL renderer info
 */
export function getRandomWebGLRenderer(): { vendor: string; renderer: string } {
  const configs = [
    {
      vendor: "Google Inc. (NVIDIA)",
      renderer:
        "ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Direct3D11 vs_5_0 ps_5_0)",
    },
    {
      vendor: "Google Inc. (Intel)",
      renderer:
        "ANGLE (Intel, Intel(R) UHD Graphics 630 Direct3D11 vs_5_0 ps_5_0)",
    },
    {
      vendor: "Google Inc. (AMD)",
      renderer:
        "ANGLE (AMD, AMD Radeon RX 580 Series Direct3D11 vs_5_0 ps_5_0)",
    },
    {
      vendor: "Intel Inc.",
      renderer: "Intel Iris Pro OpenGL Engine",
    },
    {
      vendor: "Apple Inc.",
      renderer: "Apple M1",
    },
  ];
  return configs[Math.floor(Math.random() * configs.length)]!;
}

/**
 * Pattern avoidance - add slight randomness to repeated actions
 */
export class PatternAvoider {
  private actionHistory: Array<{ action: string; timestamp: number }> = [];
  private readonly maxHistory = 100;

  /**
   * Record an action
   */
  record(action: string): void {
    this.actionHistory.push({ action, timestamp: Date.now() });
    if (this.actionHistory.length > this.maxHistory) {
      this.actionHistory.shift();
    }
  }

  /**
   * Get count of recent identical actions
   */
  getRecentCount(action: string, windowMs = 60000): number {
    const cutoff = Date.now() - windowMs;
    return this.actionHistory.filter(
      (h) => h.action === action && h.timestamp > cutoff
    ).length;
  }

  /**
   * Suggest delay multiplier to avoid patterns
   */
  suggestDelayMultiplier(action: string): number {
    const recent = this.getRecentCount(action);
    // Increase delays as pattern emerges
    if (recent > 10) return 2.0;
    if (recent > 5) return 1.5;
    if (recent > 3) return 1.2;
    return 1.0;
  }

  /**
   * Clear history
   */
  clear(): void {
    this.actionHistory = [];
  }
}

/**
 * Global instance for pattern avoidance
 */
export const globalPatternAvoider = new PatternAvoider();
