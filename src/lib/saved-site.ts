import type { SiteContext, SubstrateId } from "./mitigations.ts";

/**
 * The site as saved for a signed-in job (`projects.site_json`), rebuilt for the client. Keeps the
 * material reading and the time it was taken (QA D3, Oct 30), so a signed-in reading survives
 * sign-out / sign-in the same way a guest reading survives a reload. A reading without a valid time
 * is dropped (it could never count). The surface gauge reading is left as it was (known issue: it
 * has no timestamp yet).
 */
export function savedSite(site: Partial<SiteContext>): SiteContext {
  const out: SiteContext = {
    substrate: (site.substrate ?? "bare_steel") as SubstrateId,
    mitigations: site.mitigations ?? [],
    customMitigationIds: site.customMitigationIds ?? [],
    moistureTolerant: site.moistureTolerant,
    discipline: site.discipline,
    bodies: site.bodies,
  };
  const v = site.measuredMaterialTempF;
  const at = site.measuredMaterialAt;
  if (typeof v === "number" && Number.isFinite(v) && typeof at === "string" && Number.isFinite(Date.parse(at))) {
    out.measuredMaterialTempF = v;
    out.measuredMaterialAt = at;
  }
  return out;
}
