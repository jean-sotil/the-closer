import { test as base, expect } from "@playwright/test";
import type { Page } from "@playwright/test";

/**
 * Test data factories
 */
export const testData = {
  leads: {
    pending: {
      id: "test-lead-pending",
      business_name: "Test Pending Business",
      business_category: "Dentist",
      contact_status: "pending",
      rating: 3.5,
      performance_score: 45,
    },
    emailed: {
      id: "test-lead-emailed",
      business_name: "Test Emailed Business",
      business_category: "Attorney",
      contact_status: "emailed",
      rating: 4.0,
      performance_score: 62,
    },
    booked: {
      id: "test-lead-booked",
      business_name: "Test Booked Business",
      business_category: "Restaurant",
      contact_status: "booked",
      rating: 4.5,
      performance_score: 78,
    },
  },

  campaigns: {
    draft: {
      id: "test-campaign-draft",
      name: "Test Draft Campaign",
      status: "draft",
      totalLeads: 50,
      emailsSent: 0,
    },
    active: {
      id: "test-campaign-active",
      name: "Test Active Campaign",
      status: "active",
      totalLeads: 100,
      emailsSent: 45,
    },
    completed: {
      id: "test-campaign-completed",
      name: "Test Completed Campaign",
      status: "completed",
      totalLeads: 200,
      emailsSent: 200,
    },
  },

  audits: {
    good: {
      id: "test-audit-good",
      lead_id: "test-lead-001",
      performance_score: 85,
      accessibility_score: 90,
      mobile_friendly: true,
    },
    poor: {
      id: "test-audit-poor",
      lead_id: "test-lead-002",
      performance_score: 35,
      accessibility_score: 45,
      mobile_friendly: false,
      pain_points: [
        { type: "SLOW_LOAD", value: "6.5s", severity: "CRITICAL" },
        { type: "WCAG_VIOLATION", value: "12 errors", severity: "HIGH" },
      ],
    },
  },
};

/**
 * Page object helpers
 */
export class DashboardPage {
  constructor(private page: Page) {}

  async goto(path: string) {
    await this.page.goto(path);
    await this.page.waitForLoadState("networkidle");
  }

  async login(email: string, password: string) {
    await this.goto("/login");
    await this.page.getByLabel(/email/i).fill(email);
    await this.page.getByLabel(/password/i).fill(password);
    await this.page.getByRole("button", { name: /sign in/i }).click();
    await expect(this.page).toHaveURL("/", { timeout: 15000 });
  }

  async logout() {
    // Open user menu
    await this.page.getByRole("button", { name: /@/ }).click();
    // Click sign out
    await this.page.getByRole("button", { name: /sign out/i }).click();
    await expect(this.page).toHaveURL(/login/);
  }

  async navigateToLeads() {
    await this.page.getByRole("link", { name: /leads/i }).click();
    await expect(this.page).toHaveURL("/leads");
  }

  async navigateToAudits() {
    await this.page.getByRole("link", { name: /audits/i }).click();
    await expect(this.page).toHaveURL("/audits");
  }

  async navigateToOutreach() {
    await this.page.getByRole("link", { name: /outreach/i }).click();
    await expect(this.page).toHaveURL("/outreach");
  }

  async navigateToSettings() {
    await this.page.getByRole("link", { name: /settings/i }).click();
    await expect(this.page).toHaveURL("/settings");
  }
}

export class LeadsPage {
  constructor(private page: Page) {}

  async selectLead(index: number) {
    const checkbox = this.page.locator('input[type="checkbox"]').nth(index);
    await checkbox.check();
  }

  async selectAllLeads() {
    const selectAll = this.page.locator('input[type="checkbox"]').first();
    await selectAll.check();
  }

  async filterByStatus(status: string) {
    const statusFilter = this.page.getByRole("button", { name: /status/i });
    await statusFilter.click();
    await this.page.getByRole("option", { name: new RegExp(status, "i") }).click();
  }

  async searchLeads(query: string) {
    const searchInput = this.page.getByPlaceholder(/search/i);
    await searchInput.fill(query);
    await this.page.waitForTimeout(500); // Debounce
  }

  async bulkUpdateStatus(status: string) {
    await this.page.getByRole("button", { name: /change status/i }).click();
    await this.page.getByRole("menuitem", { name: new RegExp(status, "i") }).click();
  }
}

export class CampaignsPage {
  constructor(private page: Page) {}

  async createCampaign(name: string) {
    await this.page.getByRole("button", { name: /create campaign/i }).click();
    await this.page.getByLabel(/campaign name/i).fill(name);
  }

  async selectCampaign(name: string) {
    await this.page.getByText(name).click();
  }

  async toggleCampaignStatus() {
    const toggleButton = this.page.locator('button:has(svg[class*="play"], svg[class*="pause"])').first();
    await toggleButton.click();
  }

  async viewMetrics() {
    await expect(this.page.getByText(/sent|opened|replied/i)).toBeVisible();
  }
}

/**
 * Extended test fixture with page objects
 */
export const test = base.extend<{
  dashboardPage: DashboardPage;
  leadsPage: LeadsPage;
  campaignsPage: CampaignsPage;
}>({
  dashboardPage: async ({ page }, use) => {
    await use(new DashboardPage(page));
  },
  leadsPage: async ({ page }, use) => {
    await use(new LeadsPage(page));
  },
  campaignsPage: async ({ page }, use) => {
    await use(new CampaignsPage(page));
  },
});

export { expect };

/**
 * Utility functions
 */
export async function waitForApiCall(page: Page, urlPattern: string | RegExp) {
  return page.waitForResponse((response) => {
    const url = response.url();
    if (typeof urlPattern === "string") {
      return url.includes(urlPattern);
    }
    return urlPattern.test(url);
  });
}

export async function mockApiResponse(
  page: Page,
  urlPattern: string,
  response: { status?: number; body?: unknown }
) {
  await page.route(`**/${urlPattern}**`, (route) => {
    route.fulfill({
      status: response.status ?? 200,
      contentType: "application/json",
      body: JSON.stringify(response.body ?? {}),
    });
  });
}

export async function clearMocks(page: Page) {
  await page.unrouteAll();
}

/**
 * Visual testing helpers
 */
export async function takeScreenshot(page: Page, name: string) {
  await page.screenshot({
    path: `tests/screenshots/${name}.png`,
    fullPage: true,
  });
}

export async function compareScreenshot(page: Page, name: string) {
  await expect(page).toHaveScreenshot(`${name}.png`, {
    maxDiffPixelRatio: 0.1,
  });
}
