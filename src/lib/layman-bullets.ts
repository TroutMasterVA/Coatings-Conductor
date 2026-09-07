import type { FieldCardData } from "./types.ts";

/**
 * Tight stated attributes for extract notes / tooling.
 * Primary card face is FieldCardView (prep gates + go gates) — this is not the default UI dump.
 */
export function buildLaymanBullets(card: FieldCardData): string[] {
  const bullets: string[] = [];
  const name = card.product.name?.trim();
  const maker = card.product.manufacturer?.trim();
  const type = card.product.productType?.trim();
  const service = card.product.service?.trim();

  if (name) {
    const who = [maker, type].filter(Boolean).join(" · ");
    bullets.push(who ? `${name} (${who}).` : `${name}.`);
  }

  if (service) bullets.push(`Service: ${service}.`);

  const substrates = (card.surfacePrep.substrates ?? []).filter(Boolean);
  if (substrates.length) bullets.push(`Substrates: ${substrates.join(", ")}.`);

  const prep = [
    ...(card.surfacePrep.methods ?? []),
    ...(card.credentials.required ?? []),
  ].filter((s) => /SSPC|NACE|AMPP|ASTM|ISO|ICR|PCI|CIP|SP\s?\d+/i.test(s));
  const uniqPrep = [...new Set(prep.map((s) => s.trim()).filter(Boolean))];
  if (card.surfacePrep.profile?.trim()) uniqPrep.push(`profile ${card.surfacePrep.profile.trim()}`);
  if (uniqPrep.length) bullets.push(`Prep gates: ${uniqPrep.slice(0, 8).join("; ")}.`);

  const env = card.environmentals;
  const gates: string[] = [];
  if (env.ambientTempMinF != null || env.ambientTempMaxF != null) {
    gates.push(`air ${env.ambientTempMinF ?? "—"}–${env.ambientTempMaxF ?? "—"}°F`);
  }
  if (env.substrateTempMinF != null || env.substrateTempMaxF != null) {
    gates.push(`substrate ${env.substrateTempMinF ?? "—"}–${env.substrateTempMaxF ?? "—"}°F`);
  }
  if (env.dewPointSpreadMinF != null) {
    gates.push(`dew spread ≥ ${env.dewPointSpreadMinF}°F`);
  } else {
    gates.push("dew spread not stated");
  }
  if (env.relativeHumidityMax != null) gates.push(`RH ≤ ${env.relativeHumidityMax}%`);
  if (env.precipitationAllowed === false) gates.push("no rain/wet");
  if (env.windMaxMph != null) gates.push(`wind ≤ ${env.windMaxMph} mph`);
  if (gates.length) bullets.push(`Go gates: ${gates.join("; ")}.`);

  const mix = card.product.mixRatio || card.mixing.ratio;
  if (mix) bullets.push(`Mix: ${mix}.`);
  if (card.installation.filmThickness) bullets.push(`Film: ${card.installation.filmThickness}.`);
  if (card.cure.recoatMin || card.cure.recoatMax) {
    bullets.push(
      `Recoat: ${[card.cure.recoatMin && `min ${card.cure.recoatMin}`, card.cure.recoatMax && `max ${card.cure.recoatMax}`].filter(Boolean).join("; ")}.`,
    );
  }

  return bullets;
}
