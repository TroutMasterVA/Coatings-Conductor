/** Test helpers: mocked Azure HTTP, credential and clock. No network, no real keys. */
import type { ModelOutput } from "../schema.ts";
import type { TokenSource } from "../auth.ts";
import type { Clock } from "../http.ts";

export const DI = "https://cc-test-docintel.cognitiveservices.azure.com";
export const OA = "https://cc-test-openai.openai.azure.com";

export const ENV_MI: Record<string, string> = {
  AZURE_DOCINTEL_ENDPOINT: `${DI}/`,
  AZURE_OPENAI_ENDPOINT: `${OA}/`,
  AZURE_OPENAI_DEPLOYMENT: "gpt-4o-vision",
  AZURE_OPENAI_API_VERSION: "2024-10-21",
};
export const ENV_KEYS: Record<string, string> = {
  ...ENV_MI,
  AZURE_DOCINTEL_KEY: "test-docintel-key-not-real",
  AZURE_OPENAI_API_KEY: "test-openai-key-not-real",
};

export const b64 = (s: string | number[]) =>
  (typeof s === "string" ? Buffer.from(s, "latin1") : Buffer.from(s)).toString("base64");
export const FAKE_PDF = b64("%PDF-1.7\n% fake bytes for mocked tests\n");
export const FAKE_PNG = b64([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0x0d]);
export const FAKE_TIFF = b64([0x49, 0x49, 0x2a, 0x00, 8, 0, 0, 0, 0, 0, 0, 0]);
export const FAKE_DOCX = b64([0x50, 0x4b, 0x03, 0x04, 0x14, 0, 0, 0, 0, 0, 0, 0]);

export function blankOutput(): ModelOutput {
  return {
    confidence: "medium",
    extractionNotes: [],
    product: {
      name: "",
      manufacturer: "",
      productType: "",
      systemRole: "",
      revision: "",
      documentDate: "",
      voc: "",
      mixRatio: "",
      service: "",
      colors: [],
    },
    storage: { temperatureRange: "", notes: "", conditions: [] },
    shelfLife: { unopened: "", opened: "", mixedPotLife: "", notes: "" },
    credentials: { notes: "", required: [] },
    surfacePrep: {
      substrates: [],
      methods: [],
      profile: "",
      cleanliness: "",
      moisture: "",
      notes: "",
      prepGates: [],
    },
    environmentals: {
      ambientTempMinF: null,
      ambientTempMaxF: null,
      substrateTempMinF: null,
      substrateTempMaxF: null,
      relativeHumidityMax: null,
      relativeHumidityMin: null,
      dewPointSpreadMinF: null,
      precipitationAllowed: false,
      windMaxMph: null,
      directSunNotes: "",
      notes: "",
      additional: [],
    },
    mixing: { components: "", ratio: "", inductionTime: "", potLife: "", thinning: "", notes: "" },
    installation: {
      filmThickness: "",
      coverage: "",
      numberOfCoats: "",
      notes: "",
      methods: [],
      sequence: [],
    },
    holdPoints: [],
    inspection: { documentation: "", methods: [], acceptance: [] },
    cure: {
      touch: "",
      handle: "",
      recoatMin: "",
      recoatMax: "",
      fullCure: "",
      immersionService: "",
      temperatureDependence: "",
    },
    safety: { ventilation: "", ppe: [], hazards: [] },
    provenance: [],
  };
}

type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends (infer U)[] ? U[] : T[K] extends object ? DeepPartial<T[K]> : T[K];
};

export function output(p: DeepPartial<ModelOutput>): ModelOutput {
  const base = blankOutput() as unknown as Record<string, unknown>;
  for (const [k, v] of Object.entries(p)) {
    if (v && typeof v === "object" && !Array.isArray(v)) base[k] = { ...(base[k] as object), ...v };
    else base[k] = v;
  }
  return base as unknown as ModelOutput;
}

export type AnalyzeResultMock = {
  pages: { pageNumber: number; lines: { content: string }[] }[];
  tables?: {
    rowCount: number;
    columnCount: number;
    cells: { rowIndex: number; columnIndex: number; content: string }[];
    boundingRegions?: { pageNumber: number }[];
  }[];
};

export function pagesFrom(pages: string[]): AnalyzeResultMock["pages"] {
  return pages.map((t, i) => ({
    pageNumber: i + 1,
    lines: t
      .split("\n")
      .filter((l) => l.trim())
      .map((content) => ({ content })),
  }));
}

export function tableFrom(rows: string[][], page: number) {
  return {
    rowCount: rows.length,
    columnCount: rows[0]!.length,
    cells: rows.flatMap((r, ri) =>
      r.map((content, ci) => ({ rowIndex: ri, columnIndex: ci, content })),
    ),
    boundingRegions: [{ pageNumber: page }],
  };
}

export type Call = { url: string; method: string; headers: Record<string, string>; body?: string };

export type MockOpts = {
  analyze: AnalyzeResultMock;
  /** Model reply content string, or an object to JSON-encode. */
  reply?: unknown;
  replyRaw?: string;
  finishReason?: string;
  pollsBeforeDone?: number;
  openaiStatus?: number;
  docintelStatus?: number;
  operationLocation?: string;
  hang?: "docintel" | "openai";
  neverFinish?: boolean;
};

export function mockAzure(o: MockOpts) {
  const calls: Call[] = [];
  let polls = 0;
  const opLoc =
    o.operationLocation ??
    `${DI}/documentintelligence/documentModels/prebuilt-layout/analyzeResults/op-123?api-version=2024-11-30`;
  const fetch = async (url: string, init: RequestInit): Promise<Response> => {
    const headers = Object.fromEntries(
      Object.entries((init.headers ?? {}) as Record<string, string>).map(([k, v]) => [
        k.toLowerCase(),
        v,
      ]),
    );
    calls.push({
      url,
      method: init.method ?? "GET",
      headers,
      body: typeof init.body === "string" ? init.body : undefined,
    });
    const hang = () =>
      new Promise<Response>((_, reject) => {
        const sig = init.signal;
        const fail = () => reject(Object.assign(new Error("aborted"), { name: "AbortError" }));
        if (sig?.aborted) return fail();
        sig?.addEventListener("abort", fail, { once: true });
      });
    if (url.startsWith(`${DI}/`) && url.includes(":analyze")) {
      if (o.hang === "docintel") return hang();
      if (o.docintelStatus) return new Response("{}", { status: o.docintelStatus });
      return new Response(null, { status: 202, headers: { "Operation-Location": opLoc } });
    }
    if (url === opLoc) {
      polls++;
      if (o.neverFinish || polls <= (o.pollsBeforeDone ?? 1))
        return Response.json({ status: "running" });
      return Response.json({ status: "succeeded", analyzeResult: o.analyze });
    }
    if (url.startsWith(`${OA}/openai/deployments/`)) {
      if (o.hang === "openai") return hang();
      if (o.openaiStatus) return new Response("{}", { status: o.openaiStatus });
      const content = o.replyRaw ?? JSON.stringify(o.reply);
      return Response.json({
        choices: [{ finish_reason: o.finishReason ?? "stop", message: { content } }],
      });
    }
    throw new Error(`unexpected fetch in test: ${url}`);
  };
  return { fetch, calls, polls: () => polls };
}

export function fakeClock(): Clock {
  let t = 1_760_000_000_000;
  return { now: () => t, sleep: async (ms) => void (t += ms) };
}

export function miCredential(token = "mi-token-not-real") {
  const scopes: (string | string[])[] = [];
  const cred: TokenSource = { getToken: async (s) => (scopes.push(s), { token }) };
  return { make: async () => cred, scopes };
}

export function noCredential(): () => Promise<TokenSource> {
  return async () => ({
    getToken: async () => {
      throw new Error("CredentialUnavailableError: no managed identity in test");
    },
  });
}
