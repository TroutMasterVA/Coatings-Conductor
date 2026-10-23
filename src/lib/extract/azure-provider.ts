import type { ExtractProvider } from "./provider.ts";

/** Placeholder until BE-2 lands: Azure is never configured, so extract runs on-device. */
export function azureFromEnv(): ExtractProvider | null {
  return null;
}
