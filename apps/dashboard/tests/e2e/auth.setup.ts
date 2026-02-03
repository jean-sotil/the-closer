import { test as setup, expect } from "@playwright/test";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const authFile = path.join(__dirname, "../.auth/user.json");

/**
 * Authentication setup - runs before all tests
 * Logs in and saves session state for reuse
 */
setup("authenticate", async ({ page }) => {
  // Navigate to login page
  await page.goto("/login");

  // Fill in credentials from environment
  const email = process.env.TEST_USER_EMAIL ?? "test@example.com";
  const password = process.env.TEST_USER_PASSWORD ?? "testpassword123";

  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill(password);

  // Click sign in button
  await page.getByRole("button", { name: /sign in/i }).click();

  // Wait for navigation to dashboard
  await expect(page).toHaveURL("/", { timeout: 15000 });

  // Verify we're logged in by checking for user menu
  await expect(page.getByRole("button", { name: /@/ })).toBeVisible();

  // Save signed-in state
  await page.context().storageState({ path: authFile });
});

/**
 * Test data seeding - creates test leads, audits, and campaigns
 */
setup("seed test data", async ({ request }) => {
  const apiUrl = process.env.SUPABASE_URL;
  const apiKey = process.env.SUPABASE_ANON_KEY;

  if (!apiUrl || !apiKey) {
    console.warn("Skipping data seeding - Supabase credentials not configured");
    return;
  }

  // Seed test leads
  const testLeads = [
    {
      id: "test-lead-001",
      business_name: "Test Dentist Office",
      business_category: "Dentist",
      website_url: "https://test-dentist.example.com",
      phone_number: "+1-555-0101",
      address: "123 Test St, Austin, TX",
      rating: 3.5,
      review_count: 42,
      contact_status: "pending",
      pain_points: [
        { type: "SLOW_LOAD", value: "5.2s", severity: "HIGH" },
        { type: "MOBILE_ISSUES", value: "3 issues", severity: "MEDIUM" },
      ],
      performance_score: 45,
      discovered_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: "test-lead-002",
      business_name: "Test Law Firm",
      business_category: "Attorney",
      website_url: "https://test-law.example.com",
      phone_number: "+1-555-0102",
      address: "456 Legal Ave, Austin, TX",
      rating: 4.2,
      review_count: 156,
      contact_status: "pending",
      pain_points: [
        { type: "WCAG_VIOLATION", value: "8 errors", severity: "HIGH" },
      ],
      performance_score: 68,
      discovered_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: "test-lead-003",
      business_name: "Test Restaurant",
      business_category: "Restaurant",
      website_url: "https://test-restaurant.example.com",
      phone_number: "+1-555-0103",
      address: "789 Food St, Austin, TX",
      rating: 4.8,
      review_count: 523,
      contact_status: "emailed",
      pain_points: [
        { type: "UNUSED_CSS", value: "75%", severity: "MEDIUM" },
      ],
      performance_score: 72,
      discovered_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ];

  // Upsert test leads
  const response = await request.post(`${apiUrl}/rest/v1/lead_profiles`, {
    headers: {
      apikey: apiKey,
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates",
    },
    data: testLeads,
  });

  if (!response.ok()) {
    console.warn("Failed to seed test leads:", await response.text());
  }
});
