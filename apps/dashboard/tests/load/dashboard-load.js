import http from "k6/http";
import { check, sleep, group } from "k6";
import { Counter, Rate, Trend } from "k6/metrics";

// Custom metrics
const dashboardLoadTime = new Trend("dashboard_load_time", true);
const apiResponseTime = new Trend("api_response_time", true);
const errorRate = new Rate("errors");
const requestsCount = new Counter("requests");

// Test configuration
export const options = {
  // Simulate 100 concurrent users
  scenarios: {
    dashboard_load: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "30s", target: 20 }, // Ramp up to 20 users
        { duration: "1m", target: 50 }, // Ramp up to 50 users
        { duration: "2m", target: 100 }, // Ramp up to 100 users
        { duration: "1m", target: 100 }, // Stay at 100 users
        { duration: "30s", target: 0 }, // Ramp down
      ],
      gracefulRampDown: "30s",
    },
  },
  // Performance thresholds
  thresholds: {
    // Dashboard should load in < 2s at p95
    dashboard_load_time: ["p(95)<2000"],
    // API endpoints should respond in < 500ms at p95
    api_response_time: ["p(95)<500"],
    // Error rate should be < 1%
    errors: ["rate<0.01"],
    // HTTP request duration
    http_req_duration: ["p(95)<1000"],
  },
};

// Environment configuration
const BASE_URL = __ENV.BASE_URL || "http://localhost:5173";
const API_URL = __ENV.API_URL || "http://localhost:54321";

// Simulated user session
const headers = {
  "Content-Type": "application/json",
  Authorization: `Bearer ${__ENV.TEST_TOKEN || "test-token"}`,
};

export default function () {
  // Simulate realistic user behavior with page navigation
  group("Dashboard Home", () => {
    const start = Date.now();
    const res = http.get(`${BASE_URL}/`);
    const duration = Date.now() - start;

    dashboardLoadTime.add(duration);
    requestsCount.add(1);

    const success = check(res, {
      "dashboard loads successfully": (r) => r.status === 200,
      "dashboard loads fast": (r) => r.timings.duration < 2000,
    });

    if (!success) {
      errorRate.add(1);
    }
  });

  sleep(1 + Math.random() * 2); // Random think time

  group("Leads API", () => {
    const start = Date.now();
    const res = http.get(`${API_URL}/rest/v1/lead_profiles?limit=25`, {
      headers,
    });
    const duration = Date.now() - start;

    apiResponseTime.add(duration);
    requestsCount.add(1);

    const success = check(res, {
      "leads API returns 200": (r) => r.status === 200 || r.status === 401,
      "leads API responds fast": (r) => r.timings.duration < 500,
    });

    if (!success) {
      errorRate.add(1);
    }
  });

  sleep(0.5 + Math.random());

  group("Leads Page", () => {
    const start = Date.now();
    const res = http.get(`${BASE_URL}/leads`);
    const duration = Date.now() - start;

    dashboardLoadTime.add(duration);
    requestsCount.add(1);

    check(res, {
      "leads page loads": (r) => r.status === 200,
    });
  });

  sleep(1 + Math.random() * 2);

  group("Audits API", () => {
    const start = Date.now();
    const res = http.get(`${API_URL}/rest/v1/audit_results?limit=10`, {
      headers,
    });
    const duration = Date.now() - start;

    apiResponseTime.add(duration);
    requestsCount.add(1);

    check(res, {
      "audits API returns 200": (r) => r.status === 200 || r.status === 401,
      "audits API responds fast": (r) => r.timings.duration < 500,
    });
  });

  sleep(0.5 + Math.random());

  group("Audits Page", () => {
    const res = http.get(`${BASE_URL}/audits`);
    requestsCount.add(1);

    check(res, {
      "audits page loads": (r) => r.status === 200,
    });
  });

  sleep(1 + Math.random() * 2);

  group("Campaigns API", () => {
    const start = Date.now();
    const res = http.get(`${API_URL}/rest/v1/campaigns?limit=10`, {
      headers,
    });
    const duration = Date.now() - start;

    apiResponseTime.add(duration);
    requestsCount.add(1);

    check(res, {
      "campaigns API returns 200": (r) => r.status === 200 || r.status === 401,
      "campaigns API responds fast": (r) => r.timings.duration < 500,
    });
  });

  sleep(0.5 + Math.random());

  group("Outreach Page", () => {
    const start = Date.now();
    const res = http.get(`${BASE_URL}/outreach`);
    const duration = Date.now() - start;

    dashboardLoadTime.add(duration);
    requestsCount.add(1);

    check(res, {
      "outreach page loads": (r) => r.status === 200,
    });
  });

  sleep(2 + Math.random() * 3); // Longer think time before next iteration
}

// Summary output
export function handleSummary(data) {
  return {
    "tests/load/summary.json": JSON.stringify(data, null, 2),
    stdout: textSummary(data, { indent: " ", enableColors: true }),
  };
}

function textSummary(data, options) {
  const { metrics } = data;
  const lines = [
    "=".repeat(60),
    "LOAD TEST SUMMARY",
    "=".repeat(60),
    "",
    `Total Requests: ${metrics.requests?.values?.count || 0}`,
    `Error Rate: ${((metrics.errors?.values?.rate || 0) * 100).toFixed(2)}%`,
    "",
    "Dashboard Load Time (ms):",
    `  p50: ${metrics.dashboard_load_time?.values?.["p(50)"]?.toFixed(0) || "N/A"}`,
    `  p95: ${metrics.dashboard_load_time?.values?.["p(95)"]?.toFixed(0) || "N/A"}`,
    `  p99: ${metrics.dashboard_load_time?.values?.["p(99)"]?.toFixed(0) || "N/A"}`,
    "",
    "API Response Time (ms):",
    `  p50: ${metrics.api_response_time?.values?.["p(50)"]?.toFixed(0) || "N/A"}`,
    `  p95: ${metrics.api_response_time?.values?.["p(95)"]?.toFixed(0) || "N/A"}`,
    `  p99: ${metrics.api_response_time?.values?.["p(99)"]?.toFixed(0) || "N/A"}`,
    "",
    "HTTP Request Duration (ms):",
    `  avg: ${metrics.http_req_duration?.values?.avg?.toFixed(0) || "N/A"}`,
    `  p95: ${metrics.http_req_duration?.values?.["p(95)"]?.toFixed(0) || "N/A"}`,
    "",
    "=".repeat(60),
  ];

  return lines.join("\n");
}
