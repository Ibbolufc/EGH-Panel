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
import { describe, it, before } from "node:test";
import assert from "node:assert/strict";

const BASE = `http://localhost:${process.env.PORT ?? 8080}`;
const ADMIN = { email: "admin@eghpanel.com", password: "admin123" };

let jwtToken;
let nodeId;
let registrationToken;

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

  // ── Grab first node and regen token ─────────────────────────────────────────
  const nodesRes = await fetch(`${BASE}/api/nodes`, {
    headers: { Authorization: `Bearer ${jwtToken}` },
  });
  assert.equal(nodesRes.status, 200, "Nodes list must return 200");
  const nodes = await nodesRes.json();
  assert.ok(nodes.length > 0, "At least one node must exist for install tests");
  nodeId = nodes[0].id;

  const regenRes = await fetch(`${BASE}/api/nodes/${nodeId}/regen-token`, {
    method: "POST",
    headers: { Authorization: `Bearer ${jwtToken}` },
  });
  assert.equal(regenRes.status, 200, "Token regen must return 200");
  const regenData = await regenRes.json();
  registrationToken = regenData.registrationToken;
  assert.ok(registrationToken?.startsWith("reg_"), "Registration token must start with 'reg_'");
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
    assert.ok(nodes.length > 0, "At least one node must be present");

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
  it("returns a registrationToken in the create response so the success step can render the one-liner", async () => {
    const res = await fetch(`${BASE}/api/nodes`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${jwtToken}`,
      },
      body: JSON.stringify({
        name: `test-install-sh-${Date.now()}`,
        fqdn: "test-install.example.com",
        daemonPort: 8080,
        scheme: "http",
        isPublic: false,
        memoryTotal: 1024,
        memoryOverallocate: 0,
        diskTotal: 10240,
        diskOverallocate: 0,
        location: "test-install",
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

    // Clean up the test node
    await fetch(`${BASE}/api/nodes/${created.id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${jwtToken}` },
    });
  });
});
