import http from "k6/http";
import { check, sleep } from "k6";
import { Counter, Rate, Trend } from "k6/metrics";

// Custom metrics for audit throughput
const auditStartTime = new Trend("audit_start_time", true);
const auditCompleteTime = new Trend("audit_complete_time", true);
const auditsCompleted = new Counter("audits_completed");
const auditErrors = new Rate("audit_errors");

// Test configuration for audit throughput
// Target: 100 sites/hour = ~1.67 sites/minute
export const options = {
  scenarios: {
    // Sustained audit load test
    audit_throughput: {
      executor: "constant-arrival-rate",
      rate: 2, // 2 audits per minute (120/hour)
      timeUnit: "1m",
      duration: "10m",
      preAllocatedVUs: 10,
      maxVUs: 50,
    },
  },
  thresholds: {
    // Audit initiation should be fast
    audit_start_time: ["p(95)<1000"],
    // Audit completion (polling) should resolve
    audit_complete_time: ["p(95)<60000"], // 60 seconds max
    // Error rate should be < 5%
    audit_errors: ["rate<0.05"],
  },
};

const API_URL = __ENV.API_URL || "http://localhost:3001";
const headers = {
  "Content-Type": "application/json",
  Authorization: `Bearer ${__ENV.TEST_TOKEN || "test-token"}`,
};

// Sample test websites for auditing
const testSites = [
  "https://example.com",
  "https://httpbin.org",
  "https://jsonplaceholder.typicode.com",
];

export default function () {
  const siteUrl = testSites[Math.floor(Math.random() * testSites.length)];

  // Start audit
  const startTime = Date.now();
  const startRes = http.post(
    `${API_URL}/api/audits`,
    JSON.stringify({
      url: siteUrl,
      options: {
        mobile: true,
        lighthouse: true,
        accessibility: true,
      },
    }),
    { headers }
  );

  auditStartTime.add(Date.now() - startTime);

  const startSuccess = check(startRes, {
    "audit started": (r) => r.status === 200 || r.status === 201 || r.status === 202,
  });

  if (!startSuccess) {
    auditErrors.add(1);
    console.error(`Failed to start audit: ${startRes.status} - ${startRes.body}`);
    return;
  }

  // Parse audit ID from response
  let auditId;
  try {
    const body = JSON.parse(startRes.body);
    auditId = body.id || body.auditId;
  } catch (e) {
    auditErrors.add(1);
    console.error("Failed to parse audit response");
    return;
  }

  if (!auditId) {
    // If no polling needed, audit completed synchronously
    auditsCompleted.add(1);
    auditCompleteTime.add(Date.now() - startTime);
    return;
  }

  // Poll for audit completion
  const pollStart = Date.now();
  const maxPollTime = 120000; // 2 minutes max
  const pollInterval = 2000; // 2 seconds

  while (Date.now() - pollStart < maxPollTime) {
    sleep(pollInterval / 1000);

    const pollRes = http.get(`${API_URL}/api/audits/${auditId}`, { headers });

    if (pollRes.status === 200) {
      try {
        const body = JSON.parse(pollRes.body);
        if (body.status === "completed") {
          auditsCompleted.add(1);
          auditCompleteTime.add(Date.now() - startTime);

          check(body, {
            "has performance score": (b) => b.performanceScore !== undefined,
            "has accessibility score": (b) => b.accessibilityScore !== undefined,
          });

          return;
        } else if (body.status === "failed") {
          auditErrors.add(1);
          console.error(`Audit failed: ${body.error}`);
          return;
        }
      } catch (e) {
        // Continue polling
      }
    }
  }

  // Timeout
  auditErrors.add(1);
  console.error(`Audit ${auditId} timed out`);
}

export function handleSummary(data) {
  const { metrics } = data;
  const completed = metrics.audits_completed?.values?.count || 0;
  const duration = data.state?.testRunDurationMs || 600000; // Default 10 min
  const throughputPerHour = (completed / (duration / 3600000)).toFixed(1);

  const lines = [
    "=".repeat(60),
    "AUDIT THROUGHPUT TEST SUMMARY",
    "=".repeat(60),
    "",
    `Audits Completed: ${completed}`,
    `Test Duration: ${(duration / 60000).toFixed(1)} minutes`,
    `Throughput: ${throughputPerHour} audits/hour`,
    `Target: 100 audits/hour`,
    `Status: ${parseFloat(throughputPerHour) >= 100 ? "✅ PASSED" : "❌ BELOW TARGET"}`,
    "",
    `Error Rate: ${((metrics.audit_errors?.values?.rate || 0) * 100).toFixed(2)}%`,
    "",
    "Audit Start Time (ms):",
    `  p50: ${metrics.audit_start_time?.values?.["p(50)"]?.toFixed(0) || "N/A"}`,
    `  p95: ${metrics.audit_start_time?.values?.["p(95)"]?.toFixed(0) || "N/A"}`,
    "",
    "Audit Complete Time (ms):",
    `  p50: ${metrics.audit_complete_time?.values?.["p(50)"]?.toFixed(0) || "N/A"}`,
    `  p95: ${metrics.audit_complete_time?.values?.["p(95)"]?.toFixed(0) || "N/A"}`,
    "",
    "=".repeat(60),
  ];

  return {
    "tests/load/audit-summary.json": JSON.stringify(data, null, 2),
    stdout: lines.join("\n"),
  };
}
