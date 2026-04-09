/**
 * Provider Registry
 *
 * Resolves the correct INodeProvider implementation for a given node.
 * Currently always returns the MockProvider.
 *
 * To add a real Wings or custom daemon provider:
 *   1. Implement INodeProvider in a new file (e.g. wings.ts)
 *   2. Register it here using the node's daemonToken or a config flag
 */

import type { INodeProvider, ProviderNode } from "./types";
import { mockProvider } from "./mock";

export function getProviderForNode(_node: ProviderNode): INodeProvider {
  return mockProvider;
}

export { mockProvider };
