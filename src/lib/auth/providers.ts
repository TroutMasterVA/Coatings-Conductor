/**
 * Email/password only. The Grok auth broker is not in the auth path.
 * Provider buttons and genericOAuth federation are gone.
 */
export type GrokProvider = {
  providerId: string;
  idp: string;
  label: string;
};

export const GROK_PROVIDERS: readonly GrokProvider[] = [];
