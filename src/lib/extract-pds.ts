import { createServerFn } from "@tanstack/react-start";
import { heuristicExtract } from "./heuristic-extract";
import type { FieldCardData } from "./types";

const SYSTEM = `You extract construction / protective-coatings / adhesive / sealant / grout Product Data Sheets into a field QC card.

Return ONLY valid JSON matching this TypeScript shape (no markdown):
{
  "confidence": "high" | "medium" | "low",
  "extractionNotes": string[],
  "product": { "name", "manufacturer", "productType", "systemRole", "revision", "documentDate", "voc", "mixRatio", "colors": string[], "service" },
  "storage": { "temperatureRange", "conditions": string[], "notes" },
  "shelfLife": { "unopened", "opened", "mixedPotLife", "notes" },
  "credentials": { "required": string[], "notes" },
  "surfacePrep": { "substrates": string[], "methods": string[], "profile", "cleanliness", "moisture", "notes" },
  "environmentals": {
    "ambientTempMinF": number | null,
    "ambientTempMaxF": number | null,
    "substrateTempMinF": number | null,
    "substrateTempMaxF": number | null,
    "relativeHumidityMax": number | null,
    "relativeHumidityMin": number | null,
    "dewPointSpreadMinF": number | null,
    "precipitationAllowed": boolean,
    "windMaxMph": number | null,
    "directSunNotes": string,
    "notes": string,
    "additional": string[]
  },
  "mixing": { "components", "ratio", "inductionTime", "potLife", "thinning", "notes" },
  "installation": { "methods": string[], "filmThickness", "coverage", "numberOfCoats", "sequence": string[], "notes" },
  "holdPoints": [{ "step": number, "name", "criteria", "owner", "timing", "source": "stated" | "inferred" }],
  "inspection": { "methods": string[], "acceptance": string[], "documentation" },
  "cure": { "touch", "handle", "recoatMin", "recoatMax", "fullCure", "immersionService", "temperatureDependence" },
  "safety": { "ppe": string[], "ventilation", "hazards": string[] }
}

Rules:
- Convert all temperatures to °F numbers in environmentals. Keep the original phrase in notes.
- If a value is not in the PDS, use "" or [] or null — never invent numeric limits.
- Always emit hold points in process order (receive → store → credentials → prep → ambient → mix → apply → inspect → cure). Mark inferred vs stated.
- Dew-point spread is the minimum °F the substrate must be above dew point (often 5°F).
- precipitationAllowed is false unless the PDS explicitly allows damp/wet application.
- Be terse. Field-card language, not marketing.
- If the text is not a PDS, still extract what you can and set confidence to low.`;

function parseJson(raw: string): Partial<FieldCardData> | null {
  const stripped = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  const start = stripped.indexOf("{");
  const end = stripped.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(stripped.slice(start, end + 1)) as Partial<FieldCardData>;
  } catch {
    return null;
  }
}

function mergeCard(base: FieldCardData, ai: Partial<FieldCardData>): FieldCardData {
  const env = { ...base.environmentals, ...(ai.environmentals ?? {}) };
  return {
    ...base,
    ...ai,
    id: base.id,
    extractedAt: base.extractedAt,
    confidence: ai.confidence ?? "medium",
    extractionNotes: ai.extractionNotes?.length ? ai.extractionNotes : base.extractionNotes,
    product: { ...base.product, ...(ai.product ?? {}) },
    storage: { ...base.storage, ...(ai.storage ?? {}) },
    shelfLife: { ...base.shelfLife, ...(ai.shelfLife ?? {}) },
    credentials: { ...base.credentials, ...(ai.credentials ?? {}) },
    surfacePrep: { ...base.surfacePrep, ...(ai.surfacePrep ?? {}) },
    environmentals: env,
    mixing: { ...base.mixing, ...(ai.mixing ?? {}) },
    installation: { ...base.installation, ...(ai.installation ?? {}) },
    holdPoints: ai.holdPoints?.length ? ai.holdPoints : base.holdPoints,
    inspection: { ...base.inspection, ...(ai.inspection ?? {}) },
    cure: { ...base.cure, ...(ai.cure ?? {}) },
    safety: { ...base.safety, ...(ai.safety ?? {}) },
  };
}

export const extractPds = createServerFn({ method: "POST" })
  .validator((input: { text: string }) => {
    const text = (input?.text ?? "").trim();
    if (text.length < 40) throw new Error("PDS text is too short.");
    if (text.length > 40000) throw new Error("PDS text exceeds 40,000 characters.");
    return { text: text.slice(0, 24000) };
  })
  .handler(async ({ data }): Promise<{ ok: true; card: FieldCardData; usedAi: boolean } | { ok: false; error: string }> => {
    const fallback = heuristicExtract(data.text);
    const apiKey = process.env.XAI_API_KEY;
    if (!apiKey) {
      fallback.extractionNotes = [
        "AI is not available in this environment. Fields were pattern-matched — review every number.",
      ];
      return { ok: true, card: fallback, usedAi: false };
    }

    try {
      const res = await fetch("https://api.x.ai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "grok-4.5",
          temperature: 0.1,
          max_tokens: 3500,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: SYSTEM },
            { role: "user", content: data.text },
          ],
        }),
      });
      if (!res.ok) {
        fallback.extractionNotes = [`xAI extract failed (${res.status}). Showing heuristic fields — review every number.`];
        return { ok: true, card: fallback, usedAi: false };
      }
      const body = (await res.json()) as { choices?: { message?: { content?: string } }[] };
      const content = body.choices?.[0]?.message?.content ?? "";
      const parsed = parseJson(content);
      if (!parsed) {
        fallback.extractionNotes = ["Model returned unreadable JSON. Showing heuristic fields."];
        return { ok: true, card: fallback, usedAi: false };
      }
      const card = mergeCard(fallback, parsed);
      if (!card.extractionNotes?.length) {
        card.extractionNotes = ["Extracted from PDS. Confirm against the current manufacturer revision before use."];
      }
      return { ok: true, card, usedAi: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Extract failed";
      return { ok: false, error: message };
    }
  });
