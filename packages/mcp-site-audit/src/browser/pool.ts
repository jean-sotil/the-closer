import { BrowserError } from "@the-closer/shared";

import {
  PuppeteerClient,
  type ManagedPage,
  type ManagedContext,
} from "./client.js";
import {
  type BrowserPoolConfig,
  type BrowserOptions,
  type ContextOptions,
  type StealthOptions,
  BrowserPoolConfigSchema,
} from "./types.js";

/**
 * Pool entry for tracking browser clients
 */
interface PoolEntry {
  client: PuppeteerClient;
  activeContexts: number;
  createdAt: Date;
  lastUsedAt: Date;
}

/**
 * Browser pool for managing multiple browser instances
 * and contexts for parallel processing.
 */
export class BrowserPool {
  private readonly config: BrowserPoolConfig;
  private readonly browserOptions: BrowserOptions;
  private readonly stealthOptions: StealthOptions;
  private readonly pool: PoolEntry[] = [];
  private isShuttingDown = false;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(
    config: Partial<BrowserPoolConfig> = {},
    browserOptions: Partial<BrowserOptions> = {},
    stealthOptions: Partial<StealthOptions> = {}
  ) {
    this.config = BrowserPoolConfigSchema.parse(config);
    this.browserOptions = browserOptions as BrowserOptions;
    this.stealthOptions = stealthOptions as StealthOptions;
    this.startCleanupInterval();
  }

  /**
   * Acquire a page from the pool
   */
  async acquirePage(
    contextOptions?: Partial<ContextOptions>
  ): Promise<ManagedPage> {
    if (this.isShuttingDown) {
      throw new BrowserError("Pool is shutting down");
    }

    const entry = await this.getAvailableEntry();
    entry.lastUsedAt = new Date();

    const page = await entry.client.createPage(contextOptions);
    entry.activeContexts++;

    // Wrap the close function to decrement counter
    const originalClose = page.close;
    page.close = async () => {
      await originalClose();
      entry.activeContexts = Math.max(0, entry.activeContexts - 1);
    };

    return page;
  }

  /**
   * Acquire a context from the pool
   */
  async acquireContext(
    contextOptions?: Partial<ContextOptions>
  ): Promise<ManagedContext> {
    if (this.isShuttingDown) {
      throw new BrowserError("Pool is shutting down");
    }

    const entry = await this.getAvailableEntry();
    entry.lastUsedAt = new Date();

    const context = await entry.client.createContext(contextOptions);
    entry.activeContexts++;

    // Wrap the close function to decrement counter
    const originalClose = context.close;
    context.close = async () => {
      await originalClose();
      entry.activeContexts = Math.max(0, entry.activeContexts - 1);
    };

    return context;
  }

  /**
   * Get pool statistics
   */
  getStats(): {
    totalBrowsers: number;
    activeBrowsers: number;
    totalContexts: number;
    idleBrowsers: number;
  } {
    let totalContexts = 0;
    let activeBrowsers = 0;
    let idleBrowsers = 0;

    for (const entry of this.pool) {
      totalContexts += entry.activeContexts;
      if (entry.activeContexts > 0) {
        activeBrowsers++;
      } else {
        idleBrowsers++;
      }
    }

    return {
      totalBrowsers: this.pool.length,
      activeBrowsers,
      totalContexts,
      idleBrowsers,
    };
  }

  /**
   * Warm up the pool with pre-initialized browsers
   */
  async warmUp(count: number = 1): Promise<void> {
    const toCreate = Math.min(count, this.config.maxBrowsers - this.pool.length);

    const promises: Promise<void>[] = [];
    for (let i = 0; i < toCreate; i++) {
      promises.push(this.createNewEntry().then(() => {}));
    }

    await Promise.all(promises);
  }

  /**
   * Shutdown the pool
   */
  async shutdown(): Promise<void> {
    this.isShuttingDown = true;
    this.stopCleanupInterval();

    const shutdownPromises = this.pool.map(async (entry) => {
      try {
        await entry.client.disconnect();
      } catch {
        // Ignore errors during shutdown
      }
    });

    await Promise.all(shutdownPromises);
    this.pool.length = 0;
  }

  /**
   * Get an available pool entry or create a new one
   */
  private async getAvailableEntry(): Promise<PoolEntry> {
    // Find an entry with available context slots
    for (const entry of this.pool) {
      if (
        entry.client.isConnected() &&
        entry.activeContexts < this.config.maxContextsPerBrowser
      ) {
        return entry;
      }
    }

    // Create a new entry if we haven't hit the limit
    if (this.pool.length < this.config.maxBrowsers) {
      return await this.createNewEntry();
    }

    // Wait for an entry to become available
    return await this.waitForAvailableEntry();
  }

  /**
   * Create a new pool entry
   */
  private async createNewEntry(): Promise<PoolEntry> {
    const client = new PuppeteerClient(
      this.browserOptions,
      this.stealthOptions
    );

    await client.connect();

    const entry: PoolEntry = {
      client,
      activeContexts: 0,
      createdAt: new Date(),
      lastUsedAt: new Date(),
    };

    this.pool.push(entry);
    return entry;
  }

  /**
   * Wait for an entry to become available
   */
  private async waitForAvailableEntry(): Promise<PoolEntry> {
    const maxWait = 30000;
    const checkInterval = 100;
    const startTime = Date.now();

    return new Promise((resolve, reject) => {
      const check = () => {
        if (this.isShuttingDown) {
          reject(new BrowserError("Pool is shutting down"));
          return;
        }

        for (const entry of this.pool) {
          if (
            entry.client.isConnected() &&
            entry.activeContexts < this.config.maxContextsPerBrowser
          ) {
            resolve(entry);
            return;
          }
        }

        if (Date.now() - startTime > maxWait) {
          reject(new BrowserError("Timeout waiting for available browser"));
          return;
        }

        setTimeout(check, checkInterval);
      };

      check();
    });
  }

  /**
   * Start the cleanup interval
   */
  private startCleanupInterval(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanupIdleEntries();
    }, this.config.contextIdleTimeout);
  }

  /**
   * Stop the cleanup interval
   */
  private stopCleanupInterval(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  /**
   * Clean up idle browser entries
   */
  private cleanupIdleEntries(): void {
    const now = Date.now();
    const entriesToRemove: PoolEntry[] = [];

    for (const entry of this.pool) {
      const idleTime = now - entry.lastUsedAt.getTime();

      // Don't close the last browser
      if (this.pool.length - entriesToRemove.length <= 1) {
        break;
      }

      // Close browsers that have been idle too long and have no active contexts
      if (
        entry.activeContexts === 0 &&
        idleTime > this.config.browserIdleTimeout
      ) {
        entriesToRemove.push(entry);
      }
    }

    for (const entry of entriesToRemove) {
      const index = this.pool.indexOf(entry);
      if (index !== -1) {
        this.pool.splice(index, 1);
        entry.client.disconnect().catch(() => {
          // Ignore cleanup errors
        });
      }
    }
  }
}
