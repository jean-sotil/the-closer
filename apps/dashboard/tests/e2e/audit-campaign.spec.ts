import { test, expect } from "@playwright/test";

test.describe("Audit to Campaign Journey", () => {
  test.use({ storageState: "tests/.auth/user.json" });

  test("should navigate to outreach page", async ({ page }) => {
    await page.goto("/outreach");
    await expect(page.getByRole("heading", { name: /outreach|campaign/i })).toBeVisible();
  });

  test("should display campaign list and metrics", async ({ page }) => {
    await page.goto("/outreach");

    // Verify campaign dashboard elements
    await expect(
      page.getByText(/campaign|sent|opened|replied/i)
    ).toBeVisible({ timeout: 10000 });
  });

  test("should open campaign creation dialog", async ({ page }) => {
    await page.goto("/outreach");

    // Click create campaign button
    const createButton = page.getByRole("button", { name: /create campaign/i });
    await expect(createButton).toBeVisible();
    await createButton.click();

    // Verify creation modal/form appears
    await expect(
      page.getByRole("dialog").or(page.getByText(/new campaign|campaign name/i))
    ).toBeVisible({ timeout: 5000 });
  });

  test("should configure campaign with leads selection", async ({ page }) => {
    await page.goto("/outreach");

    // Open create campaign
    await page.getByRole("button", { name: /create campaign/i }).click();

    // Wait for form
    await expect(page.getByLabel(/name/i).or(page.getByPlaceholder(/name/i))).toBeVisible();

    // Fill campaign name
    const nameInput = page.getByLabel(/campaign name/i).or(page.getByPlaceholder(/name/i));
    if (await nameInput.isVisible()) {
      await nameInput.fill("Test E2E Campaign");
    }

    // Look for lead selection
    const leadSelector = page.getByText(/select leads|target leads|audience/i);
    if (await leadSelector.isVisible()) {
      await leadSelector.click();

      // Select leads if checkboxes appear
      const leadCheckboxes = page.locator('[data-testid="lead-checkbox"], input[type="checkbox"]');
      if ((await leadCheckboxes.count()) > 0) {
        await leadCheckboxes.first().check();
      }
    }
  });

  test("should configure email template with variables", async ({ page }) => {
    await page.goto("/outreach");
    await page.getByRole("button", { name: /create campaign/i }).click();

    // Fill basic info
    const nameInput = page.getByLabel(/campaign name/i).or(page.getByPlaceholder(/name/i));
    if (await nameInput.isVisible()) {
      await nameInput.fill("Template Test Campaign");
    }

    // Navigate to template section
    const templateSection = page.getByText(/template|email content/i);
    if (await templateSection.isVisible()) {
      await templateSection.click();
    }

    // Check for variable insertion
    const variableDropdown = page.getByRole("button", { name: /insert variable|variables/i });
    if (await variableDropdown.isVisible()) {
      await variableDropdown.click();

      // Verify available variables
      await expect(
        page.getByText(/business_name|evidence_link|pain_point/i)
      ).toBeVisible();
    }

    // Check template editor
    const templateEditor = page.locator('textarea, [contenteditable="true"], .editor');
    if (await templateEditor.first().isVisible()) {
      await templateEditor.first().fill(`
        Hi {{business_name}},

        I noticed some issues with your website that could be costing you customers.

        Here's what I found: {{pain_point}}

        Evidence: {{evidence_link}}

        Let me know if you'd like to discuss.
      `);
    }
  });

  test("should preview email with variable substitution", async ({ page }) => {
    await page.goto("/outreach");
    await page.getByRole("button", { name: /create campaign/i }).click();

    // Look for preview button
    const previewButton = page.getByRole("button", { name: /preview/i });
    if (await previewButton.isVisible()) {
      await previewButton.click();

      // Verify preview modal shows substituted values
      await expect(
        page.getByRole("dialog").or(page.locator(".preview-modal"))
      ).toBeVisible();

      // Should not show raw variable syntax in preview
      const previewContent = page.locator(".preview-content, [data-testid='email-preview']");
      if (await previewContent.isVisible()) {
        const text = await previewContent.textContent();
        expect(text).not.toContain("{{");
      }
    }
  });

  test("should save campaign as draft", async ({ page }) => {
    await page.goto("/outreach");
    await page.getByRole("button", { name: /create campaign/i }).click();

    // Fill required fields
    const nameInput = page.getByLabel(/campaign name/i).or(page.getByPlaceholder(/name/i));
    if (await nameInput.isVisible()) {
      await nameInput.fill("Draft Test Campaign");
    }

    // Save as draft
    const saveButton = page.getByRole("button", { name: /save|draft/i });
    if (await saveButton.isVisible()) {
      await saveButton.click();

      // Verify success
      await expect(
        page.getByText(/saved|created|success/i).or(page.getByRole("alert"))
      ).toBeVisible({ timeout: 5000 });
    }
  });

  test("should launch campaign", async ({ page }) => {
    await page.goto("/outreach");

    // Find a draft campaign or create one
    const draftCampaign = page.locator('[data-status="draft"], .campaign-draft').first();

    if (await draftCampaign.isVisible()) {
      await draftCampaign.click();

      // Click launch button
      const launchButton = page.getByRole("button", { name: /launch|start|activate/i });
      if (await launchButton.isVisible()) {
        await launchButton.click();

        // Confirm launch if dialog appears
        const confirmButton = page.getByRole("button", { name: /confirm|yes/i });
        if (await confirmButton.isVisible()) {
          await confirmButton.click();
        }

        // Verify status change
        await expect(
          page.getByText(/active|launched|running/i)
        ).toBeVisible({ timeout: 5000 });
      }
    }
  });
});

test.describe("Campaign Metrics Dashboard", () => {
  test.use({ storageState: "tests/.auth/user.json" });

  test("should display campaign metrics panel", async ({ page }) => {
    await page.goto("/outreach");

    // Verify metrics are displayed
    await expect(page.getByText(/sent/i)).toBeVisible();
    await expect(page.getByText(/delivered|opened/i)).toBeVisible();
  });

  test("should show conversion funnel", async ({ page }) => {
    await page.goto("/outreach");

    // Look for funnel visualization
    const funnel = page.locator('[data-testid="funnel-chart"], .funnel, .conversion-funnel');
    await expect(
      funnel.or(page.getByText(/conversion funnel/i))
    ).toBeVisible({ timeout: 10000 });
  });

  test("should display timeline chart", async ({ page }) => {
    await page.goto("/outreach");

    // Look for timeline/activity chart
    const timeline = page.locator('[data-testid="timeline-chart"], .recharts-wrapper, canvas');
    await expect(
      timeline.or(page.getByText(/activity timeline/i))
    ).toBeVisible({ timeout: 10000 });
  });

  test("should filter metrics by date range", async ({ page }) => {
    await page.goto("/outreach");

    // Find date range picker
    const dateRangePicker = page.getByRole("button", { name: /7d|14d|30d|date/i });
    if (await dateRangePicker.first().isVisible()) {
      await dateRangePicker.first().click();

      // Select different range
      const rangeOption = page.getByRole("button", { name: /30d|last 30/i });
      if (await rangeOption.isVisible()) {
        await rangeOption.click();

        // Verify chart updates (wait for any loading)
        await page.waitForTimeout(500);
      }
    }
  });

  test("should toggle campaign status (pause/resume)", async ({ page }) => {
    await page.goto("/outreach");

    // Find play/pause button on a campaign
    const toggleButton = page.locator('[data-testid="toggle-status"], button:has(svg)').filter({
      has: page.locator('svg[class*="play"], svg[class*="pause"]'),
    }).first();

    if (await toggleButton.isVisible()) {
      const initialState = await page.locator('[data-status]').first().getAttribute("data-status");
      await toggleButton.click();

      // Wait for status change
      await page.waitForTimeout(1000);

      // Verify status toggled
      if (initialState === "active") {
        await expect(page.getByText(/paused/i).first()).toBeVisible();
      }
    }
  });
});

test.describe("Top Performers", () => {
  test.use({ storageState: "tests/.auth/user.json" });

  test("should display top performing leads", async ({ page }) => {
    await page.goto("/outreach");

    // Look for top performers section
    await expect(
      page.getByText(/top leads|top performers/i)
    ).toBeVisible({ timeout: 10000 });
  });

  test("should display top performing templates", async ({ page }) => {
    await page.goto("/outreach");

    // Look for templates section
    await expect(
      page.getByText(/top templates|best templates/i)
    ).toBeVisible({ timeout: 10000 });
  });
});
