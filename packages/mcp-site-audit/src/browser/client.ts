import puppeteer, {
  type Browser,
  type BrowserContext,
  type Page,
  type HTTPResponse,
} from "puppeteer";

import { BrowserError, MCPConnectionError } from "@the-closer/shared";

import {
  type BrowserOptions,
  type ContextOptions,
  type NavigationOptions,
  type ScreenshotOptions,
  type StealthOptions,
  type ConnectionState,
  type BrowserMetrics,
  BrowserOptionsSchema,
  ContextOptionsSchema,
  NavigationOptionsSchema,
  ScreenshotOptionsSchema,
} from "./types.js";
import { applyStealthEvasions, getDefaultStealthOptions } from "./stealth.js";

/**
 * Event types emitted by the PuppeteerClient
 */
export type ClientEventType =
  | "connected"
  | "disconnected"
  | "reconnecting"
  | "error"
  | "pageCreated"
  | "pageClosed"
  | "contextCreated"
  | "contextClosed";

export type ClientEventHandler = (data?: unknown) => void;

/**
 * Managed page wrapper with automatic cleanup
 */
export interface ManagedPage {
  page: Page;
  contextId: string;
  createdAt: Date;
  close: () => Promise<void>;
}

/**
 * Managed context wrapper with automatic cleanup
 */
export interface ManagedContext {
  context: BrowserContext;
  id: string;
  createdAt: Date;
  pageCount: number;
  close: () => Promise<void>;
}

/**
 * Type-safe Puppeteer client wrapper with connection management,
 * stealth mode, and automatic resource cleanup.
 */
export class PuppeteerClient {
  private browser: Browser | null = null;
  private connectionState: ConnectionState = "disconnected";
  private readonly options: BrowserOptions;
  private readonly stealthOptions: StealthOptions;
  private readonly contexts: Map<string, ManagedContext> = new Map();
  private readonly eventHandlers: Map<ClientEventType, Set<ClientEventHandler>> =
    new Map();
  private reconnectAttempts = 0;
  private readonly maxReconnectAttempts = 3;
  private readonly reconnectDelay = 1000;
  private startTime: Date | null = null;
  private requestsCompleted = 0;
  private errorsCount = 0;
  private healthCheckInterval: NodeJS.Timeout | null = null;

  constructor(
    options: Partial<BrowserOptions> = {},
    stealthOptions: Partial<StealthOptions> = {}
  ) {
    this.options = BrowserOptionsSchema.parse(options);
    this.stealthOptions = {
      ...getDefaultStealthOptions(),
      ...stealthOptions,
      evasions: {
        ...getDefaultStealthOptions().evasions,
        ...stealthOptions.evasions,
      },
    };
  }

  /**
   * Get current connection state
   */
  getConnectionState(): ConnectionState {
    return this.connectionState;
  }

  /**
   * Check if browser is connected
   */
  isConnected(): boolean {
    return this.connectionState === "connected" && this.browser !== null;
  }

  /**
   * Connect to browser
   */
  async connect(): Promise<void> {
    if (this.connectionState === "connected") {
      return;
    }

    this.setConnectionState("connecting");

    try {
      const launchOptions: Parameters<typeof puppeteer.launch>[0] = {
        headless: this.options.headless,
        slowMo: this.options.slowMo,
        args: this.buildBrowserArgs(),
        timeout: this.options.timeout,
      };

      if (this.options.executablePath) {
        launchOptions.executablePath = this.options.executablePath;
      }

      this.browser = await puppeteer.launch(launchOptions);

      this.setupBrowserEventHandlers();
      this.startTime = new Date();
      this.setConnectionState("connected");
      this.startHealthCheck();
      this.emit("connected");
    } catch (error) {
      this.setConnectionState("error");
      this.errorsCount++;
      throw new MCPConnectionError("Failed to launch browser", {
        cause: error instanceof Error ? error : undefined,
        context: { options: this.options },
      });
    }
  }

  /**
   * Disconnect from browser
   */
  async disconnect(): Promise<void> {
    this.stopHealthCheck();

    // Close all contexts first
    for (const context of this.contexts.values()) {
      try {
        await context.close();
      } catch {
        // Ignore errors during cleanup
      }
    }
    this.contexts.clear();

    if (this.browser) {
      try {
        await this.browser.close();
      } catch {
        // Ignore errors during cleanup
      }
      this.browser = null;
    }

    this.setConnectionState("disconnected");
    this.emit("disconnected");
  }

  /**
   * Create a new browser context (isolated session)
   */
  async createContext(
    options: Partial<ContextOptions> = {}
  ): Promise<ManagedContext> {
    await this.ensureConnected();

    const contextOptions = ContextOptionsSchema.parse(options);
    const context = await this.browser!.createBrowserContext();

    const id = `ctx_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

    const managedContext: ManagedContext = {
      context,
      id,
      createdAt: new Date(),
      pageCount: 0,
      close: async () => {
        try {
          await context.close();
        } finally {
          this.contexts.delete(id);
          this.emit("contextClosed", { id });
        }
      },
    };

    // Apply context-level settings
    if (contextOptions.geolocation) {
      await context.overridePermissions("https://*", ["geolocation"]);
    }

    this.contexts.set(id, managedContext);
    this.emit("contextCreated", { id });

    return managedContext;
  }

  /**
   * Create a new page in a context
   */
  async createPage(
    contextOrOptions?: ManagedContext | Partial<ContextOptions>
  ): Promise<ManagedPage> {
    await this.ensureConnected();

    let managedContext: ManagedContext;
    let contextOptions: ContextOptions;

    if (
      contextOrOptions &&
      "context" in contextOrOptions &&
      "id" in contextOrOptions
    ) {
      managedContext = contextOrOptions;
      contextOptions = ContextOptionsSchema.parse({});
    } else {
      contextOptions = ContextOptionsSchema.parse(contextOrOptions ?? {});
      managedContext = await this.createContext(contextOptions);
    }

    const page = await managedContext.context.newPage();
    managedContext.pageCount++;

    // Apply viewport
    await page.setViewport({
      width: contextOptions.viewport.width,
      height: contextOptions.viewport.height,
      deviceScaleFactor: contextOptions.viewport.deviceScaleFactor,
      isMobile: contextOptions.viewport.isMobile,
      hasTouch: contextOptions.viewport.hasTouch,
    });

    // Apply user agent if specified
    const userAgent = contextOptions.userAgent ?? this.options.userAgent;
    if (userAgent) {
      await page.setUserAgent(userAgent);
    }

    // Apply extra HTTP headers
    await page.setExtraHTTPHeaders({
      "Accept-Language": contextOptions.locale,
    });

    // Apply stealth evasions
    await applyStealthEvasions(page, this.stealthOptions);

    // Setup page event handlers
    this.setupPageEventHandlers(page);

    const managedPage: ManagedPage = {
      page,
      contextId: managedContext.id,
      createdAt: new Date(),
      close: async () => {
        try {
          await page.close();
        } finally {
          managedContext.pageCount--;
          this.emit("pageClosed", { contextId: managedContext.id });
        }
      },
    };

    this.emit("pageCreated", { contextId: managedContext.id });

    return managedPage;
  }

  /**
   * Navigate to a URL
   */
  async navigate(
    page: Page,
    url: string,
    options: Partial<NavigationOptions> = {}
  ): Promise<HTTPResponse | null> {
    const navOptions = NavigationOptionsSchema.parse(options);

    try {
      const gotoOptions: Parameters<Page["goto"]>[1] = {
        timeout: navOptions.timeout,
        waitUntil: navOptions.waitUntil,
      };

      if (navOptions.referer) {
        gotoOptions.referer = navOptions.referer;
      }

      const response = await page.goto(url, gotoOptions);

      this.requestsCompleted++;
      return response;
    } catch (error) {
      this.errorsCount++;
      throw new BrowserError(`Navigation failed: ${url}`, {
        cause: error instanceof Error ? error : undefined,
        context: { url, options: navOptions },
      });
    }
  }

  /**
   * Take a screenshot
   */
  async screenshot(
    page: Page,
    options: Partial<ScreenshotOptions> = {}
  ): Promise<Uint8Array | string> {
    const screenshotOptions = ScreenshotOptionsSchema.parse(options);

    try {
      if (screenshotOptions.encoding === "base64") {
        const base64Options = {
          type: screenshotOptions.type,
          fullPage: screenshotOptions.fullPage,
          captureBeyondViewport: screenshotOptions.captureBeyondViewport,
          encoding: "base64" as const,
          ...(screenshotOptions.path && { path: screenshotOptions.path }),
          ...(screenshotOptions.type !== "png" &&
            screenshotOptions.quality !== undefined && {
              quality: screenshotOptions.quality,
            }),
          ...(screenshotOptions.clip && { clip: screenshotOptions.clip }),
        };
        return await page.screenshot(base64Options);
      }

      const binaryOptions = {
        type: screenshotOptions.type,
        fullPage: screenshotOptions.fullPage,
        captureBeyondViewport: screenshotOptions.captureBeyondViewport,
        ...(screenshotOptions.path && { path: screenshotOptions.path }),
        ...(screenshotOptions.type !== "png" &&
          screenshotOptions.quality !== undefined && {
            quality: screenshotOptions.quality,
          }),
        ...(screenshotOptions.clip && { clip: screenshotOptions.clip }),
      };
      return await page.screenshot(binaryOptions);
    } catch (error) {
      this.errorsCount++;
      throw new BrowserError("Screenshot capture failed", {
        cause: error instanceof Error ? error : undefined,
        context: { options: screenshotOptions },
      });
    }
  }

  /**
   * Wait for selector with Locator API
   */
  async waitForSelector(
    page: Page,
    selector: string,
    timeout: number = 10000
  ): Promise<void> {
    try {
      await page.locator(selector).setTimeout(timeout).wait();
    } catch (error) {
      throw new BrowserError(`Timeout waiting for selector: ${selector}`, {
        cause: error instanceof Error ? error : undefined,
        context: { selector, timeout },
      });
    }
  }

  /**
   * Get browser metrics
   */
  getMetrics(): BrowserMetrics {
    const uptime = this.startTime
      ? Date.now() - this.startTime.getTime()
      : 0;

    let pagesActive = 0;
    for (const ctx of this.contexts.values()) {
      pagesActive += ctx.pageCount;
    }

    return {
      contextsActive: this.contexts.size,
      pagesActive,
      memoryUsageBytes: process.memoryUsage().heapUsed,
      uptime,
      requestsCompleted: this.requestsCompleted,
      errorsCount: this.errorsCount,
    };
  }

  /**
   * Subscribe to events
   */
  on(event: ClientEventType, handler: ClientEventHandler): () => void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }
    this.eventHandlers.get(event)!.add(handler);

    return () => {
      this.eventHandlers.get(event)?.delete(handler);
    };
  }

  /**
   * Emit an event
   */
  private emit(event: ClientEventType, data?: unknown): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      for (const handler of handlers) {
        try {
          handler(data);
        } catch {
          // Ignore errors in event handlers
        }
      }
    }
  }

  /**
   * Ensure browser is connected
   */
  private async ensureConnected(): Promise<void> {
    if (this.connectionState === "connected" && this.browser?.connected) {
      return;
    }

    if (this.connectionState === "connecting") {
      // Wait for connection to complete
      await this.waitForConnection();
      return;
    }

    // Try to reconnect
    await this.reconnect();
  }

  /**
   * Wait for connection to be established
   */
  private waitForConnection(): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new MCPConnectionError("Connection timeout"));
      }, this.options.timeout);

      const checkConnection = () => {
        if (this.connectionState === "connected") {
          clearTimeout(timeout);
          resolve();
        } else if (this.connectionState === "error") {
          clearTimeout(timeout);
          reject(new MCPConnectionError("Connection failed"));
        } else {
          setTimeout(checkConnection, 100);
        }
      };

      checkConnection();
    });
  }

  /**
   * Attempt to reconnect
   */
  private async reconnect(): Promise<void> {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      throw new MCPConnectionError("Max reconnect attempts exceeded");
    }

    this.setConnectionState("reconnecting");
    this.emit("reconnecting", { attempt: this.reconnectAttempts + 1 });
    this.reconnectAttempts++;

    // Clean up existing browser
    if (this.browser) {
      try {
        await this.browser.close();
      } catch {
        // Ignore cleanup errors
      }
      this.browser = null;
    }

    // Wait before reconnecting
    await new Promise((resolve) =>
      setTimeout(resolve, this.reconnectDelay * this.reconnectAttempts)
    );

    try {
      await this.connect();
      this.reconnectAttempts = 0;
    } catch (error) {
      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        await this.reconnect();
      } else {
        throw error;
      }
    }
  }

  /**
   * Set connection state
   */
  private setConnectionState(state: ConnectionState): void {
    this.connectionState = state;
  }

  /**
   * Build browser launch arguments
   */
  private buildBrowserArgs(): string[] {
    const args = [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-accelerated-2d-canvas",
      "--no-first-run",
      "--no-zygote",
      "--disable-gpu",
      "--disable-background-networking",
      "--disable-default-apps",
      "--disable-extensions",
      "--disable-sync",
      "--disable-translate",
      "--hide-scrollbars",
      "--metrics-recording-only",
      "--mute-audio",
      "--safebrowsing-disable-auto-update",
    ];

    if (this.options.proxyServer) {
      args.push(`--proxy-server=${this.options.proxyServer}`);
    }

    return args;
  }

  /**
   * Setup browser event handlers
   */
  private setupBrowserEventHandlers(): void {
    if (!this.browser) return;

    this.browser.on("disconnected", () => {
      this.setConnectionState("disconnected");
      this.emit("disconnected");
    });
  }

  /**
   * Setup page event handlers
   */
  private setupPageEventHandlers(page: Page): void {
    page.on("error", (error) => {
      this.errorsCount++;
      this.emit("error", { type: "page", error: error.message });
    });

    page.on("pageerror", (error) => {
      // Log but don't count as our error - this is the target page's error
      this.emit("error", { type: "pageerror", error: error.message });
    });

    page.on("requestfinished", () => {
      this.requestsCompleted++;
    });
  }

  /**
   * Start health check interval
   */
  private startHealthCheck(): void {
    this.healthCheckInterval = setInterval(async () => {
      if (this.browser && !this.browser.connected) {
        this.setConnectionState("disconnected");
        this.emit("disconnected");
      }
    }, 30000);
  }

  /**
   * Stop health check interval
   */
  private stopHealthCheck(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }
}
