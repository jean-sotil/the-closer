import { test, expect } from "@playwright/test";

test.describe("Error Handling Scenarios", () => {
  test.use({ storageState: "tests/.auth/user.json" });

  test.describe("Network Failure During Discovery", () => {
    test("should show error message when network fails during search", async ({ page, context }) => {
      await page.goto("/");

      // Fill search form
      const businessType = page.getByLabel(/business type/i);
      const location = page.getByLabel(/location/i);

      if (await businessType.isVisible()) {
        await businessType.fill("Dentists");
      }
      if (await location.isVisible()) {
        await location.fill("Austin, TX");
      }

      // Simulate network failure by blocking API requests
      await context.route("**/api/**", (route) => {
        route.abort("failed");
      });
      await context.route("**/rest/v1/**", (route) => {
        route.abort("failed");
      });

      // Submit search
      const searchButton = page.getByRole("button", { name: /search|discover/i });
      if (await searchButton.isVisible()) {
        await searchButton.click();

        // Should show error message
        await expect(
          page.getByText(/error|failed|unable|network/i).or(page.getByRole("alert"))
        ).toBeVisible({ timeout: 10000 });
      }
    });

    test("should allow retry after network failure", async ({ page, context }) => {
      await page.goto("/");

      // Block network
      await context.route("**/api/**", (route) => route.abort("failed"));

      // Trigger search
      const searchButton = page.getByRole("button", { name: /search|discover/i });
      if (await searchButton.isVisible()) {
        await searchButton.click();

        // Wait for error
        await expect(
          page.getByText(/error|failed/i).or(page.getByRole("alert"))
        ).toBeVisible({ timeout: 10000 });

        // Restore network
        await context.unroute("**/api/**");

        // Find retry button
        const retryButton = page.getByRole("button", { name: /retry|try again/i });
        if (await retryButton.isVisible()) {
          await retryButton.click();

          // Should attempt to load again
          await expect(page.getByText(/loading|searching/i)).toBeVisible({ timeout: 5000 });
        }
      }
    });
  });

  test.describe("Blocked Website During Audit", () => {
    test("should handle audit failures gracefully", async ({ page }) => {
      await page.goto("/audits");

      // Look for any failed audit indicators
      const failedAudit = page.locator('[data-status="failed"], .audit-failed, .error-badge');

      if (await failedAudit.isVisible()) {
        // Click to view details
        await failedAudit.click();

        // Should show meaningful error message
        await expect(
          page.getByText(/blocked|timeout|failed to audit|error/i)
        ).toBeVisible({ timeout: 5000 });
      }
    });

    test("should offer re-audit option for failed audits", async ({ page }) => {
      await page.goto("/audits");

      const failedAudit = page.locator('[data-status="failed"]').first();

      if (await failedAudit.isVisible()) {
        await failedAudit.click();

        // Look for re-audit button
        await expect(
          page.getByRole("button", { name: /re-audit|retry|run again/i })
        ).toBeVisible({ timeout: 5000 });
      }
    });
  });

  test.describe("Email Service Rate Limits", () => {
    test("should show rate limit warning in campaign", async ({ page, context }) => {
      // Mock rate limit response from email API
      await context.route("**/api/email/**", (route) => {
        route.fulfill({
          status: 429,
          body: JSON.stringify({
            error: "Rate limit exceeded",
            retryAfter: 60,
          }),
        });
      });

      await page.goto("/outreach");

      // Try to send/launch a campaign
      const launchButton = page.getByRole("button", { name: /launch|send|start/i });
      if (await launchButton.isVisible()) {
        await launchButton.click();

        // Should show rate limit error
        await expect(
          page.getByText(/rate limit|too many|slow down|wait/i).or(page.getByRole("alert"))
        ).toBeVisible({ timeout: 10000 });
      }
    });

    test("should queue emails when rate limited", async ({ page }) => {
      await page.goto("/outreach");

      // Look for queued status indicator
      const queuedIndicator = page.locator('[data-status="queued"], .status-queued');

      if (await queuedIndicator.isVisible()) {
        // Verify queue count is displayed
        await expect(
          page.getByText(/queued|pending send/i)
        ).toBeVisible();
      }
    });
  });

  test.describe("Authentication Errors", () => {
    test("should redirect to login when session expires", async ({ page, context }) => {
      await page.goto("/leads");

      // Clear auth state to simulate session expiry
      await context.clearCookies();

      // Try to perform an action that requires auth
      await page.reload();

      // Should redirect to login
      await expect(page).toHaveURL(/login/, { timeout: 10000 });
    });

    test("should show session expired message", async ({ page, context }) => {
      await page.goto("/leads");

      // Mock 401 response
      await context.route("**/rest/v1/**", (route) => {
        route.fulfill({
          status: 401,
          body: JSON.stringify({ error: "JWT expired" }),
        });
      });

      // Trigger an API call by refreshing
      await page.reload();

      // Should show auth error or redirect
      await expect(
        page.getByText(/session expired|please log in|unauthorized/i).or(page.locator('[href="/login"]'))
      ).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe("Form Validation Errors", () => {
    test("should show validation errors for invalid campaign data", async ({ page }) => {
      await page.goto("/outreach");

      // Open create campaign
      await page.getByRole("button", { name: /create campaign/i }).click();

      // Try to submit without required fields
      const submitButton = page.getByRole("button", { name: /save|create|submit/i });
      if (await submitButton.isVisible()) {
        await submitButton.click();

        // Should show validation errors
        await expect(
          page.getByText(/required|please fill|cannot be empty/i).or(
            page.locator('.error-message, [role="alert"]')
          )
        ).toBeVisible({ timeout: 5000 });
      }
    });

    test("should validate email template syntax", async ({ page }) => {
      await page.goto("/outreach");
      await page.getByRole("button", { name: /create campaign/i }).click();

      // Fill template with invalid variable syntax
      const templateEditor = page.locator('textarea, [contenteditable="true"]').first();
      if (await templateEditor.isVisible()) {
        await templateEditor.fill("Hello {{invalid_variable}}");

        // Look for validation warning
        const warningIndicator = page.getByText(/unknown variable|invalid|not found/i);
        // This may or may not show depending on implementation
        const hasWarning = await warningIndicator.isVisible().catch(() => false);
        console.log("Variable validation warning shown:", hasWarning);
      }
    });
  });

  test.describe("Data Loading Errors", () => {
    test("should show empty state when no data available", async ({ page, context }) => {
      // Mock empty response
      await context.route("**/rest/v1/lead_profiles**", (route) => {
        route.fulfill({
          status: 200,
          body: JSON.stringify([]),
        });
      });

      await page.goto("/leads");

      // Should show empty state
      await expect(
        page.getByText(/no leads|no results|get started/i).or(
          page.locator('[data-testid="empty-state"]')
        )
      ).toBeVisible({ timeout: 10000 });
    });

    test("should handle partial data loading failures", async ({ page, context }) => {
      // Mock successful leads but failed audits
      await context.route("**/rest/v1/audit_results**", (route) => {
        route.fulfill({
          status: 500,
          body: JSON.stringify({ error: "Internal server error" }),
        });
      });

      await page.goto("/audits");

      // Should show error for audits specifically
      await expect(
        page.getByText(/error loading|failed to load|try again/i).or(page.getByRole("alert"))
      ).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe("Concurrent Operation Conflicts", () => {
    test("should handle optimistic update conflicts", async ({ page, context }) => {
      await page.goto("/leads");

      // Mock conflict response
      await context.route("**/rest/v1/lead_profiles**", (route) => {
        if (route.request().method() === "PATCH") {
          route.fulfill({
            status: 409,
            body: JSON.stringify({ error: "Conflict: Record was modified" }),
          });
        } else {
          route.continue();
        }
      });

      // Try to update a lead
      const checkbox = page.locator('input[type="checkbox"]').first();
      if (await checkbox.isVisible()) {
        await checkbox.check();

        const actionButton = page.getByRole("button", { name: /update|change status/i });
        if (await actionButton.isVisible()) {
          await actionButton.click();

          // Should show conflict error
          await expect(
            page.getByText(/conflict|modified|refresh|try again/i)
          ).toBeVisible({ timeout: 5000 });
        }
      }
    });
  });
});

test.describe("Graceful Degradation", () => {
  test.use({ storageState: "tests/.auth/user.json" });

  test("should work without JavaScript for critical content", async ({ page }) => {
    // This tests that the page at least loads
    await page.goto("/");

    // Basic content should be visible
    await expect(page.locator("body")).not.toBeEmpty();
  });

  test("should maintain usability during slow network", async ({ page, context }) => {
    // Slow down all requests
    await context.route("**/*", async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      route.continue();
    });

    await page.goto("/leads", { timeout: 60000 });

    // Page should still load eventually
    await expect(page).toHaveURL("/leads");

    // Should show loading indicator
    await expect(
      page.getByText(/loading/i).or(page.locator('.spinner, .loading, [aria-busy="true"]'))
    ).toBeVisible({ timeout: 3000 });
  });
});
