/**
 * Integration tests for GET /api/nodes/:id/install.sh
 *
 * Run with:   node --test artifacts/api-server/src/routes/__tests__/nodes-install-sh.test.mjs
 * Requires:   API server running, DATABASE_URL set, admin credentials seeded.
 */
import { describe, it, before } from "node:test";
import assert from "node:assert/strict";

const BASE = `http://localhost:${process.env.PORT ?? 3000}`;
const ADMIN = { email: "admin@eghpanel.com", password: "admin123" };

let token;
let nodeId;
let registrationToken;

before(async () => {
  // Authenticate
  const loginRes = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(ADMIN),
  });
  assert.equal(loginRes.status, 200, "Admin login should succeed");
  const loginData = await loginRes.json();
  token = loginData.token;
  assert.ok(token, "JWT token should be present");

  // Pick the first node and regen its token so we have a known good value
  const nodesRes = await fetch(`${BASE}/api/nodes`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  assert.equal(nodesRes.status, 200, "Nodes list should return 200");
  const nodes = await nodesRes.json();
  assert.ok(nodes.length > 0, "At least one node must exist");
  nodeId = nodes[0].id;

  const regenRes = await fetch(`${BASE}/api/nodes/${nodeId}/regen-token`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  assert.equal(regenRes.status, 200, "Token regen should succeed");
  const regenData = await regenRes.json();
  registrationToken = regenData.registrationToken;
  assert.ok(registrationToken?.startsWith("reg_"), "Token should start with reg_");
});

describe("GET /api/nodes/:id/install.sh", () => {
  it("returns 200 with a bash script for a valid token", async () => {
    const res = await fetch(
      `${BASE}/api/nodes/${nodeId}/install.sh?token=${registrationToken}`
    );
    assert.equal(res.status, 200, "Should return HTTP 200");

    const ct = res.headers.get("content-type") ?? "";
    assert.ok(ct.includes("shellscript") || ct.includes("sh"), `Content-Type should indicate shell script, got: ${ct}`);

    const body = await res.text();
    assert.ok(body.startsWith("#!/usr/bin/env bash"), "Script must start with shebang");
    assert.ok(body.includes("EGH_PANEL_URL"), "Script must define EGH_PANEL_URL");
    assert.ok(body.includes("EGH_NODE_TOKEN"), "Script must define EGH_NODE_TOKEN");
    assert.ok(body.includes(registrationToken), "Script must embed the registration token");
  });

  it("returns 401 shell-safe response when token is missing", async () => {
    const res = await fetch(`${BASE}/api/nodes/${nodeId}/install.sh`);
    assert.equal(res.status, 401, "Missing token should return HTTP 401");

    const body = await res.text();
    assert.ok(body.includes("exit 1"), "Error body must include 'exit 1' for shell safety");
  });

  it("returns 403 shell-safe response for an incorrect token", async () => {
    const res = await fetch(
      `${BASE}/api/nodes/${nodeId}/install.sh?token=reg_thisiswrong`
    );
    assert.equal(res.status, 403, "Wrong token should return HTTP 403");

    const body = await res.text();
    assert.ok(body.includes("exit 1"), "Error body must include 'exit 1' for shell safety");
  });

  it("returns 404 shell-safe response for an unknown node id", async () => {
    const res = await fetch(
      `${BASE}/api/nodes/9999999/install.sh?token=${registrationToken}`
    );
    assert.equal(res.status, 404, "Unknown node should return HTTP 404");

    const body = await res.text();
    assert.ok(body.includes("exit 1"), "Error body must include 'exit 1' for shell safety");
  });
});
