import { test, expect } from "@playwright/test";

/**
 * Visual regression tests for dashboard pages
 * These tests capture and compare screenshots to detect unintended visual changes
 */

test.describe("Visual Regression Tests", () => {
  test.use({ storageState: "tests/.auth/user.json" });

  test.describe("Page Screenshots", () => {
    test("Discovery page visual snapshot", async ({ page }) => {
      await page.goto("/");
      await page.waitForLoadState("networkidle");

      // Wait for any animations to complete
      await page.waitForTimeout(500);

      await expect(page).toHaveScreenshot("discovery-page.png", {
        fullPage: true,
        maxDiffPixelRatio: 0.05,
      });
    });

    test("Leads page visual snapshot", async ({ page }) => {
      await page.goto("/leads");
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(500);

      await expect(page).toHaveScreenshot("leads-page.png", {
        fullPage: true,
        maxDiffPixelRatio: 0.05,
      });
    });

    test("Audits page visual snapshot", async ({ page }) => {
      await page.goto("/audits");
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(500);

      await expect(page).toHaveScreenshot("audits-page.png", {
        fullPage: true,
        maxDiffPixelRatio: 0.05,
      });
    });

    test("Outreach page visual snapshot", async ({ page }) => {
      await page.goto("/outreach");
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(500);

      await expect(page).toHaveScreenshot("outreach-page.png", {
        fullPage: true,
        maxDiffPixelRatio: 0.05,
      });
    });

    test("Settings page visual snapshot", async ({ page }) => {
      await page.goto("/settings");
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(500);

      await expect(page).toHaveScreenshot("settings-page.png", {
        fullPage: true,
        maxDiffPixelRatio: 0.05,
      });
    });
  });

  test.describe("Component Screenshots", () => {
    test("Navigation sidebar snapshot", async ({ page }) => {
      await page.goto("/");
      await page.waitForLoadState("networkidle");

      const sidebar = page.locator("aside, nav").first();
      await expect(sidebar).toHaveScreenshot("sidebar.png", {
        maxDiffPixelRatio: 0.05,
      });
    });

    test("User menu dropdown snapshot", async ({ page }) => {
      await page.goto("/");
      await page.waitForLoadState("networkidle");

      // Open user menu
      const userMenuButton = page.getByRole("button", { name: /@/ });
      if (await userMenuButton.isVisible()) {
        await userMenuButton.click();

        // Wait for dropdown animation
        await page.waitForTimeout(300);

        const dropdown = page.locator('[role="menu"], .dropdown-menu').first();
        if (await dropdown.isVisible()) {
          await expect(dropdown).toHaveScreenshot("user-menu-dropdown.png", {
            maxDiffPixelRatio: 0.05,
          });
        }
      }
    });

    test("Metrics panel snapshot", async ({ page }) => {
      await page.goto("/outreach");
      await page.waitForLoadState("networkidle");

      const metricsPanel = page.locator('[data-testid="metrics-panel"], .metrics-panel, .card').first();
      if (await metricsPanel.isVisible()) {
        await expect(metricsPanel).toHaveScreenshot("metrics-panel.png", {
          maxDiffPixelRatio: 0.05,
        });
      }
    });

    test("Funnel chart snapshot", async ({ page }) => {
      await page.goto("/outreach");
      await page.waitForLoadState("networkidle");

      const funnelChart = page.locator('[data-testid="funnel-chart"], .funnel-chart').first();
      if (await funnelChart.isVisible()) {
        await expect(funnelChart).toHaveScreenshot("funnel-chart.png", {
          maxDiffPixelRatio: 0.1, // Charts may have slight variations
        });
      }
    });
  });

  test.describe("Responsive Screenshots", () => {
    test("Mobile viewport - Discovery page", async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 812 });
      await page.goto("/");
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(500);

      await expect(page).toHaveScreenshot("discovery-mobile.png", {
        fullPage: true,
        maxDiffPixelRatio: 0.05,
      });
    });

    test("Mobile viewport - Leads page", async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 812 });
      await page.goto("/leads");
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(500);

      await expect(page).toHaveScreenshot("leads-mobile.png", {
        fullPage: true,
        maxDiffPixelRatio: 0.05,
      });
    });

    test("Tablet viewport - Outreach page", async ({ page }) => {
      await page.setViewportSize({ width: 768, height: 1024 });
      await page.goto("/outreach");
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(500);

      await expect(page).toHaveScreenshot("outreach-tablet.png", {
        fullPage: true,
        maxDiffPixelRatio: 0.05,
      });
    });
  });

  test.describe("State Screenshots", () => {
    test("Empty state - Leads page", async ({ page, context }) => {
      // Mock empty response
      await context.route("**/rest/v1/lead_profiles**", (route) => {
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify([]),
        });
      });

      await page.goto("/leads");
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(500);

      await expect(page).toHaveScreenshot("leads-empty-state.png", {
        fullPage: true,
        maxDiffPixelRatio: 0.05,
      });
    });

    test("Loading state - Leads page", async ({ page, context }) => {
      // Slow down response to capture loading state
      await context.route("**/rest/v1/lead_profiles**", async (route) => {
        await new Promise((resolve) => setTimeout(resolve, 5000));
        route.continue();
      });

      await page.goto("/leads");

      // Capture loading state quickly
      await page.waitForTimeout(100);

      const loadingIndicator = page.locator('.loading, .spinner, [aria-busy="true"]');
      if (await loadingIndicator.isVisible()) {
        await expect(page).toHaveScreenshot("leads-loading-state.png", {
          fullPage: true,
          maxDiffPixelRatio: 0.1,
        });
      }
    });

    test("Error state - Network failure", async ({ page, context }) => {
      await context.route("**/rest/v1/**", (route) => {
        route.fulfill({
          status: 500,
          body: JSON.stringify({ error: "Internal server error" }),
        });
      });

      await page.goto("/leads");
      await page.waitForTimeout(1000);

      await expect(page).toHaveScreenshot("leads-error-state.png", {
        fullPage: true,
        maxDiffPixelRatio: 0.05,
      });
    });
  });

  test.describe("Interactive State Screenshots", () => {
    test("Lead row expanded state", async ({ page }) => {
      await page.goto("/leads");
      await page.waitForLoadState("networkidle");

      const firstRow = page.locator("tbody tr").first();
      if (await firstRow.isVisible()) {
        await firstRow.click();
        await page.waitForTimeout(300);

        await expect(page).toHaveScreenshot("lead-row-expanded.png", {
          fullPage: true,
          maxDiffPixelRatio: 0.05,
        });
      }
    });

    test("Campaign selected state", async ({ page }) => {
      await page.goto("/outreach");
      await page.waitForLoadState("networkidle");

      const campaignItem = page.locator('[data-testid="campaign-item"], .campaign-item, button').first();
      if (await campaignItem.isVisible()) {
        await campaignItem.click();
        await page.waitForTimeout(300);

        await expect(page).toHaveScreenshot("campaign-selected.png", {
          fullPage: true,
          maxDiffPixelRatio: 0.05,
        });
      }
    });

    test("Filter dropdown open state", async ({ page }) => {
      await page.goto("/leads");
      await page.waitForLoadState("networkidle");

      const filterButton = page.getByRole("button", { name: /filter|status/i }).first();
      if (await filterButton.isVisible()) {
        await filterButton.click();
        await page.waitForTimeout(300);

        await expect(page).toHaveScreenshot("filter-dropdown-open.png", {
          fullPage: true,
          maxDiffPixelRatio: 0.05,
        });
      }
    });
  });
});

test.describe("Dark Mode Visual Regression", () => {
  test.use({ storageState: "tests/.auth/user.json" });

  test.skip("Dark mode - Discovery page", async ({ page }) => {
    // Skip if dark mode not implemented
    await page.goto("/settings");

    const darkModeToggle = page.getByRole("switch", { name: /dark mode/i });
    if (await darkModeToggle.isVisible()) {
      await darkModeToggle.click();
      await page.goto("/");
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(500);

      await expect(page).toHaveScreenshot("discovery-dark-mode.png", {
        fullPage: true,
        maxDiffPixelRatio: 0.05,
      });
    }
  });
});
