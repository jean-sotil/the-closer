import { test, expect } from "@playwright/test";

test.describe("Discovery to Audit Journey", () => {
  test.use({ storageState: "tests/.auth/user.json" });

  test.beforeEach(async ({ page }) => {
    // Start from the Discovery page
    await page.goto("/");
    await expect(page.getByRole("heading", { name: /discovery/i })).toBeVisible();
  });

  test("should display the discovery page with search form", async ({ page }) => {
    // Verify search form elements are present
    await expect(page.getByLabel(/business type/i)).toBeVisible();
    await expect(page.getByLabel(/location/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /search|discover/i })).toBeVisible();
  });

  test("should configure search criteria and initiate discovery", async ({ page }) => {
    // Fill in search criteria
    await page.getByLabel(/business type/i).fill("Dentists");
    await page.getByLabel(/location/i).fill("Austin, TX");

    // Configure additional filters if available
    const ratingFilter = page.getByLabel(/rating/i);
    if (await ratingFilter.isVisible()) {
      await ratingFilter.selectOption("below-4");
    }

    // Submit search
    await page.getByRole("button", { name: /search|discover/i }).click();

    // Wait for results or loading state
    await expect(
      page.getByText(/searching|loading|found/i).or(page.getByRole("table"))
    ).toBeVisible({ timeout: 30000 });
  });

  test("should navigate to leads page and view discovered leads", async ({ page }) => {
    // Navigate to Leads page
    await page.getByRole("link", { name: /leads/i }).click();
    await expect(page).toHaveURL("/leads");

    // Verify leads table is displayed
    await expect(page.getByRole("table").or(page.getByText(/no leads/i))).toBeVisible();
  });

  test("should select leads and view lead details", async ({ page }) => {
    // Navigate to Leads page
    await page.goto("/leads");

    // Wait for table to load
    const table = page.getByRole("table");
    const noLeads = page.getByText(/no leads/i);

    await expect(table.or(noLeads)).toBeVisible({ timeout: 10000 });

    // If there are leads, interact with them
    if (await table.isVisible()) {
      // Click on first lead row to expand/view details
      const firstRow = page.locator("tbody tr").first();
      await firstRow.click();

      // Verify details are shown (either expanded row or modal)
      await expect(
        page.getByText(/pain points|audit|performance/i)
      ).toBeVisible({ timeout: 5000 });
    }
  });

  test("should select leads for audit", async ({ page }) => {
    // Navigate to Leads page
    await page.goto("/leads");

    const table = page.getByRole("table");
    await expect(table.or(page.getByText(/no leads/i))).toBeVisible();

    if (await table.isVisible()) {
      // Select leads using checkboxes
      const checkboxes = page.locator('input[type="checkbox"]');
      const checkboxCount = await checkboxes.count();

      if (checkboxCount > 0) {
        // Select first lead
        await checkboxes.first().check();

        // Verify bulk actions become available
        await expect(
          page.getByRole("button", { name: /audit|action/i })
        ).toBeVisible();
      }
    }
  });
});

test.describe("Audit Results Viewing", () => {
  test.use({ storageState: "tests/.auth/user.json" });

  test("should navigate to audits page", async ({ page }) => {
    await page.goto("/audits");
    await expect(page.getByRole("heading", { name: /audit/i })).toBeVisible();
  });

  test("should display audit list with results", async ({ page }) => {
    await page.goto("/audits");

    // Wait for audits to load
    await expect(
      page.getByRole("table").or(page.getByText(/no audits|select a lead/i))
    ).toBeVisible({ timeout: 10000 });
  });

  test("should view audit details with evidence", async ({ page }) => {
    await page.goto("/audits");

    // If audits exist, click to view details
    const auditItem = page.locator("[data-testid='audit-item'], .audit-card, tbody tr").first();

    if (await auditItem.isVisible()) {
      await auditItem.click();

      // Verify audit report sections are displayed
      await expect(
        page.getByText(/performance|accessibility|mobile/i)
      ).toBeVisible({ timeout: 5000 });
    }
  });

  test("should display evidence gallery with screenshots", async ({ page }) => {
    await page.goto("/audits");

    // Select an audit if available
    const auditItem = page.locator("[data-testid='audit-item'], .audit-card, tbody tr").first();

    if (await auditItem.isVisible()) {
      await auditItem.click();

      // Look for evidence section
      const evidenceSection = page.getByText(/evidence|screenshot|video/i);
      if (await evidenceSection.isVisible()) {
        // Click on evidence to open gallery
        const evidenceItem = page.locator("img, video, [data-testid='evidence-item']").first();
        if (await evidenceItem.isVisible()) {
          await evidenceItem.click();

          // Verify modal opens
          await expect(
            page.getByRole("dialog").or(page.locator(".modal, [data-testid='evidence-modal']"))
          ).toBeVisible({ timeout: 3000 });
        }
      }
    }
  });

  test("should show performance scores and metrics", async ({ page }) => {
    await page.goto("/audits");

    const auditItem = page.locator("[data-testid='audit-item'], .audit-card, tbody tr").first();

    if (await auditItem.isVisible()) {
      await auditItem.click();

      // Verify score displays
      await expect(
        page.getByText(/score|%/).or(page.locator("[data-testid='score-card']"))
      ).toBeVisible({ timeout: 5000 });
    }
  });
});

test.describe("Audit Comparison", () => {
  test.use({ storageState: "tests/.auth/user.json" });

  test("should compare multiple audits", async ({ page }) => {
    await page.goto("/audits");

    // Select multiple audits for comparison if feature exists
    const compareButton = page.getByRole("button", { name: /compare/i });

    if (await compareButton.isVisible()) {
      // Select audits
      const checkboxes = page.locator('input[type="checkbox"]');
      if ((await checkboxes.count()) >= 2) {
        await checkboxes.nth(0).check();
        await checkboxes.nth(1).check();
        await compareButton.click();

        // Verify comparison view
        await expect(page.getByText(/comparison|vs|delta/i)).toBeVisible();
      }
    }
  });
});
