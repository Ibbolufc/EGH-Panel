/**
 * Provider Registry
 *
 * Resolves the correct INodeProvider implementation for a given node.
 *
 * Current selection logic:
 *   - live provider path when a node has a daemon token and mock mode is not forced
 *   - mock provider fallback for development/testing
 *
 * To force mock in any environment:
 *   EGH_MOCK_PROVIDER=true
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
