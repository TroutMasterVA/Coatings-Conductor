import { createMiddleware, createServerFn } from "@tanstack/react-start";
import type { ExtractRequest, ExtractResponse } from "./provider.ts";
import { EXTRACT_DEFAULT_MAX_FILE_MB, runExtract, type RateStore } from "./extract-core.ts";
import { onDeviceProvider } from "./on-device-provider.ts";
import { publicErrors } from "../errors/server-fn-middleware.ts";

/**
 * Like `authMiddleware`, but a missing session becomes `userId: null` so the handler can return
 * the coded UNAUTHENTICATED error instead of a thrown 500. Cross-site requests still throw (403).
 */
const extractAuth = createMiddleware({ type: "function" })
  .client(async ({ next }) => {
    const { getBearerToken } = await import("../auth/client");
    return next({ sendContext: { bearerToken: getBearerToken() ?? undefined } });
  })
  .server(async ({ next, context }) => {
    const { assertSameSiteRequest } = await import("../auth/isolation.server");
    const { requireUserId, UnauthorizedError } = await import("../auth/verify.server");
    assertSameSiteRequest();
    let userId: string | null = null;
    try {
      userId = await requireUserId(context.bearerToken);
    } catch (err) {
      if (!(err instanceof UnauthorizedError)) throw err;
      userId = null;
    }
    return next({ context: { userId } });
  });

const g = globalThis as typeof globalThis & { __ccExtractRate__?: RateStore };
/** In-memory, per instance. Multi-instance deploys get 10/min per user per instance. */
function rateStore(): RateStore {
  g.__ccExtractRate__ ??= new Map();
  return g.__ccExtractRate__;
}

/** Env MAX_UPLOAD_MB (decoded file size; default 10, practice on Vercel sets 3). */
export function maxUploadMb(): number {
  const mb = Number(process.env.MAX_UPLOAD_MB);
  return Number.isFinite(mb) && mb > 0 ? mb : EXTRACT_DEFAULT_MAX_FILE_MB;
}

function maxFileBytes(): number {
  return Math.floor(maxUploadMb() * 1024 * 1024);
}

/** Public upload limit so the UI shows the same number the server enforces. No auth; no secrets. */
export const getExtractLimits = createServerFn({ method: "GET" })
  .middleware([publicErrors])
  .handler(
  async (): Promise<{ maxUploadMb: number }> => ({ maxUploadMb: maxUploadMb() }),
);

export const extractSheet = createServerFn({ method: "POST" })
  .middleware([publicErrors, extractAuth])
  .validator((input: ExtractRequest): ExtractRequest => {
    // Coerce shape only. Size, base64 and magic-byte checks happen in runExtract (before decoding)
    // so they come back as coded errors instead of a thrown 500.
    const i = (input ?? {}) as Partial<ExtractRequest>;
    return {
      fileBase64: typeof i.fileBase64 === "string" ? i.fileBase64 : undefined,
      mimeType: typeof i.mimeType === "string" ? i.mimeType.slice(0, 200) : undefined,
      fileName: typeof i.fileName === "string" ? i.fileName.slice(0, 200) : undefined,
      text: typeof i.text === "string" ? i.text : undefined,
      pages: Array.isArray(i.pages) ? i.pages.filter((p): p is string => typeof p === "string").slice(0, 200) : undefined,
      jobId: typeof i.jobId === "string" && i.jobId ? i.jobId.slice(0, 200) : undefined,
    };
  })
  .handler(async ({ data, context }): Promise<ExtractResponse> => {
    const { azureFromEnv } = await import("./azure-provider.ts");
    const res = await runExtract({
      userId: context.userId,
      input: data,
      azure: azureFromEnv(),
      onDevice: onDeviceProvider,
      rate: rateStore(),
      maxFileBytes: maxFileBytes(),
      log: (entry) => console.info(JSON.stringify(entry)),
      // Closed job -> { ok: false, error: { code: "JOB_CLOSED" } } (CONTRACT.md "Job closeout").
      jobClosed: async (jobId) => {
        const userId = context.userId;
        if (!userId) return false;
        const [{ getSql }, { isJobClosed }] = await Promise.all([import("../db"), import("../job-close.ts")]);
        return isJobClosed(await getSql(), userId, jobId);
      },
    });
    if (!res.ok || !context.userId) return res;
    // Sign the read for this user so a save can prove which values came from it (server-only).
    const { authSecret } = await import("../auth/secret.server");
    const { signRead } = await import("./read-signature.ts");
    return { ...res, serverRead: signRead(authSecret(), context.userId, res) };
  });
