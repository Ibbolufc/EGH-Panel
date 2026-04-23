/**
 * Provider Registry
 *
 * Resolves the correct INodeProvider implementation for a given node.
 *
 * Selection logic:
 *   - WingsProvider  → node has a daemonToken AND EGH_MOCK_PROVIDER != "true"
 *   - MockProvider   → fallback (dev, testing, or nodes without tokens)
 *
 * To force mock in any environment:  EGH_MOCK_PROVIDER=true
 * To use real Wings in development:  ensure node.daemonToken is set
 *   (it is populated automatically from registrationToken when building
 *    a ProviderNode — see serverService.ts)
 */

import type { INodeProvider, ProviderNode } from "./types";
import { mockProvider } from "./mock";
import { wingsProvider } from "./wings";

const FORCE_MOCK = process.env.EGH_MOCK_PROVIDER === "true";

export function getProviderForNode(node: ProviderNode): INodeProvider {
  if (!FORCE_MOCK && node.daemonToken) {
    return wingsProvider;
  }
  return mockProvider;
}

export { mockProvider, wingsProvider };
