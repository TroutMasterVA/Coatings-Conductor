import { AzureExtractError, toAzureError } from "./errors.ts";

export type FetchLike = (url: string, init: RequestInit) => Promise<Response>;

export type Clock = {
  now: () => number;
  sleep: (ms: number, signal?: AbortSignal) => Promise<void>;
};

export const realClock: Clock = {
  now: () => Date.now(),
  sleep: (ms, signal) =>
    new Promise((resolve, reject) => {
      if (signal?.aborted) return reject(signal.reason ?? abortError());
      const t = setTimeout(() => {
        signal?.removeEventListener("abort", onAbort);
        resolve();
      }, ms);
      const onAbort = () => {
        clearTimeout(t);
        reject(signal?.reason ?? abortError());
      };
      signal?.addEventListener("abort", onAbort, { once: true });
    }),
};

function abortError(): Error {
  const e = new Error("aborted");
  e.name = "AbortError";
  return e;
}

/** Caller signal plus a local budget. */
export function withBudget(signal: AbortSignal | undefined, ms: number): AbortSignal {
  const t = AbortSignal.timeout(Math.max(1, ms));
  return signal ? AbortSignal.any([signal, t]) : t;
}

/** fetch that maps aborts to AZURE_TIMEOUT and non-2xx to AZURE_HTTP (status only, no body echoed). */
export async function azureFetch(
  fetchImpl: FetchLike,
  url: string,
  init: RequestInit,
  stage: string,
): Promise<Response> {
  let res: Response;
  try {
    res = await fetchImpl(url, init);
  } catch (err) {
    throw toAzureError(err, stage);
  }
  if (!res.ok && res.status !== 202) {
    throw new AzureExtractError(
      "AZURE_HTTP",
      `Azure ${stage} returned HTTP ${res.status}.`,
      res.status,
    );
  }
  return res;
}

export function retryAfterMs(res: Response, fallback: number): number {
  const h = res.headers.get("retry-after");
  const s = h ? Number(h) : NaN;
  return Number.isFinite(s) && s >= 0 ? Math.min(s * 1000, 10_000) : fallback;
}
