/**
 * Integration tests for the node install feature.
 *
 * Covers:
 *  - GET /api/nodes/:id/install.sh  (the new Quick Install one-liner backend route)
 *  - API data surfaces that underpin the three install UI entry-points:
 *      • Nodes list page → InstallCommandModal (GET /api/nodes)
 *      • Node detail page → Install tab (GET /api/nodes/:id)
 *      • Create Node success step (POST /api/nodes response)
 *
 * UI rendering of those surfaces is validated separately via the Playwright
 * testing runner (external to this codebase, no browser available in CI).
 *
 * Run with:
 *   PORT=8080 node --test artifacts/api-server/src/routes/__tests__/nodes-install-sh.test.mjs
 */
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { execSync } from "node:child_process";

const BASE = `http://localhost:${process.env.PORT ?? 8080}`;
const ADMIN = { email: "admin@eghpanel.com", password: "admin123" };

let jwtToken;
let nodeId;
let registrationToken;

// Deterministic setup: creates a dedicated test node so the suite never
// depends on pre-existing seeded data.
before(async () => {
  // ── Authenticate ────────────────────────────────────────────────────────────
  const loginRes = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(ADMIN),
  });
  assert.equal(loginRes.status, 200, "Admin login should return 200");
  const loginData = await loginRes.json();
  jwtToken = loginData.token;
  assert.ok(jwtToken, "JWT token must be present in login response");

  // ── Create a dedicated test node ─────────────────────────────────────────────
  const createRes = await fetch(`${BASE}/api/nodes`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${jwtToken}`,
    },
    body: JSON.stringify({
      name: `install-sh-test-${Date.now()}`,
      fqdn: "install-sh-test.example.com",
      daemonPort: 8888,
      scheme: "http",
      isPublic: false,
      memoryTotal: 1024,
      memoryOverallocate: 0,
      diskTotal: 10240,
      diskOverallocate: 0,
      location: "test",
    }),
  });
  assert.equal(createRes.status, 201, "Test node creation must return 201");
  const created = await createRes.json();
  nodeId = created.id;
  registrationToken = created.registrationToken;
  assert.ok(registrationToken?.startsWith("reg_"), "New node must have a registrationToken");
});

// Teardown: remove the test node created in setup.
after(async () => {
  if (nodeId && jwtToken) {
    await fetch(`${BASE}/api/nodes/${nodeId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${jwtToken}` },
    });
  }
});

// ── GET /api/nodes/:id/install.sh ──────────────────────────────────────────────
describe("GET /api/nodes/:id/install.sh", () => {
  it("returns 200 with a valid bash script for a correct token", async () => {
    const res = await fetch(
      `${BASE}/api/nodes/${nodeId}/install.sh?token=${registrationToken}`
    );
    assert.equal(res.status, 200, "Should return HTTP 200");

    const ct = res.headers.get("content-type") ?? "";
    assert.ok(
      ct.includes("shellscript") || ct.includes("sh"),
      `Content-Type should indicate shell script, got: ${ct}`
    );

    const body = await res.text();
    assert.ok(body.startsWith("#!/usr/bin/env bash"), "Script must start with shebang");
    assert.ok(body.includes("EGH_PANEL_URL"), "Script must define EGH_PANEL_URL");
    assert.ok(body.includes("EGH_NODE_TOKEN"), "Script must define EGH_NODE_TOKEN");
    assert.ok(body.includes(registrationToken), "Script must embed the registration token");
    assert.ok(body.includes("egh-node"), "Script must reference egh-node binary");
  });

  it("returns 401 with a shell-safe error body when token is missing", async () => {
    const res = await fetch(`${BASE}/api/nodes/${nodeId}/install.sh`);
    assert.equal(res.status, 401, "Missing token must return HTTP 401");
    const body = await res.text();
    assert.ok(body.includes("exit 1"), "Error body must include 'exit 1' for shell safety");
  });

  it("returns 403 with a shell-safe error body for an incorrect token", async () => {
    const res = await fetch(
      `${BASE}/api/nodes/${nodeId}/install.sh?token=reg_thisiswrongtoken`
    );
    assert.equal(res.status, 403, "Wrong token must return HTTP 403");
    const body = await res.text();
    assert.ok(body.includes("exit 1"), "Error body must include 'exit 1' for shell safety");
  });

  it("returns 404 with a shell-safe error body for an unknown node", async () => {
    const res = await fetch(
      `${BASE}/api/nodes/9999999/install.sh?token=${registrationToken}`
    );
    assert.equal(res.status, 404, "Unknown node must return HTTP 404");
    const body = await res.text();
    assert.ok(body.includes("exit 1"), "Error body must include 'exit 1' for shell safety");
  });
});

// ── Nodes list API — data surface for InstallCommandModal ──────────────────────
describe("GET /api/nodes — nodes list (InstallCommandModal data source)", () => {
  it("returns an array with registrationToken so the modal can build the one-liner", async () => {
    const res = await fetch(`${BASE}/api/nodes`, {
      headers: { Authorization: `Bearer ${jwtToken}` },
    });
    assert.equal(res.status, 200, "Nodes list must return 200");
    const nodes = await res.json();
    assert.ok(Array.isArray(nodes), "Response must be an array");

    const node = nodes.find((n) => n.id === nodeId);
    assert.ok(node, "Test node must appear in the list");
    assert.ok(
      typeof node.registrationToken === "string" && node.registrationToken.startsWith("reg_"),
      "registrationToken must be returned so the UI can build the one-liner URL"
    );
    assert.ok(typeof node.fqdn === "string", "fqdn must be present for script generation");
    assert.ok(typeof node.daemonPort === "number", "daemonPort must be present for script generation");
  });
});

// ── Node detail API — data surface for Install tab ─────────────────────────────
describe("GET /api/nodes/:id — node detail (Install tab data source)", () => {
  it("returns full node data including registrationToken for the Install tab script", async () => {
    const res = await fetch(`${BASE}/api/nodes/${nodeId}`, {
      headers: { Authorization: `Bearer ${jwtToken}` },
    });
    assert.equal(res.status, 200, "Node detail must return 200");
    const node = await res.json();

    assert.equal(node.id, nodeId, "Returned node must have the expected id");
    assert.ok(
      typeof node.registrationToken === "string" && node.registrationToken.startsWith("reg_"),
      "registrationToken must be present so the Install tab can render the script"
    );
    assert.ok(typeof node.fqdn === "string", "fqdn must be present");
    assert.ok(typeof node.daemonPort === "number", "daemonPort must be present");
    assert.ok(typeof node.scheme === "string", "scheme must be present");
    assert.ok(typeof node.name === "string", "name must be present");
  });
});

// ── Create Node API — data surface for Create Node success step ────────────────
describe("POST /api/nodes — create node (Create Node success step data source)", () => {
  it("returns registrationToken and registrationTokenExpiresAt (~48h) in create response", async () => {
    const res = await fetch(`${BASE}/api/nodes`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${jwtToken}`,
      },
      body: JSON.stringify({
        name: `install-sh-create-test-${Date.now()}`,
        fqdn: "install-sh-create-test.example.com",
        daemonPort: 8889,
        scheme: "http",
        isPublic: false,
        memoryTotal: 1024,
        memoryOverallocate: 0,
        diskTotal: 10240,
        diskOverallocate: 0,
        location: "test",
      }),
    });
    assert.equal(res.status, 201, "Node creation must return 201");
    const created = await res.json();

    assert.ok(typeof created.id === "number", "Created node must have an id");
    assert.ok(
      typeof created.registrationToken === "string" &&
        created.registrationToken.startsWith("reg_"),
      "registrationToken must be returned in create response for the success step one-liner"
    );
    assert.ok(
      typeof created.registrationTokenExpiresAt === "string",
      "registrationTokenExpiresAt must be returned so the UI can show expiry"
    );
    const expiryMs = new Date(created.registrationTokenExpiresAt).getTime() - Date.now();
    assert.ok(expiryMs > 47 * 3600000, "Token expiry must be approximately 48h in the future");
    assert.ok(expiryMs < 49 * 3600000, "Token expiry must not exceed 48h by more than an hour");

    // Clean up the transient node created for this test
    await fetch(`${BASE}/api/nodes/${created.id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${jwtToken}` },
    });
  });
});

// ── Token expiry feature ────────────────────────────────────────────────────────
describe("Token expiry — regen-token and install.sh expiry enforcement", () => {
  it("regen-token returns registrationTokenExpiresAt ~48h in the future", async () => {
    const res = await fetch(`${BASE}/api/nodes/${nodeId}/regen-token`, {
      method: "POST",
      headers: { Authorization: `Bearer ${jwtToken}` },
    });
    assert.equal(res.status, 200, "Regen must return 200");
    const data = await res.json();

    assert.ok(
      typeof data.registrationTokenExpiresAt === "string",
      "registrationTokenExpiresAt must be in the regen response"
    );
    const expiryMs = new Date(data.registrationTokenExpiresAt).getTime() - Date.now();
    assert.ok(expiryMs > 47 * 3600000, "Expiry must be approximately 48h from now");
    assert.ok(expiryMs < 49 * 3600000, "Expiry must not be more than ~48h");

    // Update shared token for later tests (regen invalidates the old token)
    registrationToken = data.registrationToken;
  });

  it("node list includes registrationTokenExpiresAt so the UI can show expiry badges", async () => {
    const res = await fetch(`${BASE}/api/nodes`, {
      headers: { Authorization: `Bearer ${jwtToken}` },
    });
    assert.equal(res.status, 200, "Nodes list must return 200");
    const nodes = await res.json();
    const node = nodes.find((n) => n.id === nodeId);
    assert.ok(node, "Test node must appear in the list");
    assert.ok(
      typeof node.registrationTokenExpiresAt === "string",
      "registrationTokenExpiresAt must be present in the nodes list for UI expiry badges"
    );
  });

  it("node detail includes registrationTokenExpiresAt for the Install tab badge", async () => {
    const res = await fetch(`${BASE}/api/nodes/${nodeId}`, {
      headers: { Authorization: `Bearer ${jwtToken}` },
    });
    assert.equal(res.status, 200, "Node detail must return 200");
    const node = await res.json();
    assert.ok(
      typeof node.registrationTokenExpiresAt === "string",
      "registrationTokenExpiresAt must be in node detail for the Install tab badge"
    );
  });

  it("install.sh returns shell-safe 403 when the token has expired", async () => {
    const dbUrl = process.env.DATABASE_URL;
    assert.ok(dbUrl, "DATABASE_URL must be set for the expired-token test");

    const psql = (sql) =>
      execSync(`psql "${dbUrl}" -c "${sql.replace(/"/g, '\\"')}"`, { stdio: "pipe" });

    try {
      // Backdate the token expiry 1 second into the past so the server rejects it
      psql(`UPDATE nodes SET registration_token_expires_at = NOW() - INTERVAL '1 second' WHERE id = ${nodeId}`);

      const res = await fetch(
        `${BASE}/api/nodes/${nodeId}/install.sh?token=${registrationToken}`
      );
      assert.equal(res.status, 403, "Expired token must return HTTP 403");
      const body = await res.text();
      assert.ok(body.includes("exit 1"), "Error body must include 'exit 1' for shell safety");
      assert.ok(
        body.toLowerCase().includes("expired"),
        "Error body must mention 'expired' so sysadmins know to regen the token"
      );
    } finally {
      // Restore a valid 48h expiry so remaining tests using this token still work
      psql(`UPDATE nodes SET registration_token_expires_at = NOW() + INTERVAL '48 hours' WHERE id = ${nodeId}`);
    }
  });
});
