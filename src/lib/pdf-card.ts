import { mitigationById, substrateById, type SiteContext } from "./mitigations";
import type { DayWindow, FieldCardData, ForecastBundle } from "./types";

function wrap(doc: import("jspdf").jsPDF, text: string, maxWidth: number): string[] {
  const t = (text || "—").replace(/\s+/g, " ").trim();
  return doc.splitTextToSize(t, maxWidth) as string[];
}

function join(items: string[] | undefined, fallback = "—") {
  const list = (items ?? []).map((s) => s.trim()).filter(Boolean);
  return list.length ? list.join(" · ") : fallback;
}

export async function downloadFieldCard(
  card: FieldCardData,
  forecast: ForecastBundle | null,
  site?: SiteContext,
) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "letter", orientation: "portrait" });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 36;
  const width = pageW - margin * 2;

  const ink = { r: 22, g: 24, b: 28 };
  const muted = { r: 92, g: 97, b: 104 };
  const rail = { r: 196, g: 69, b: 10 };
  const rule = { r: 210, g: 204, b: 192 };
  const paper = { r: 243, g: 239, b: 230 };

  doc.setFillColor(paper.r, paper.g, paper.b);
  doc.rect(0, 0, pageW, doc.internal.pageSize.getHeight(), "F");

  doc.setFillColor(rail.r, rail.g, rail.b);
  doc.rect(0, 0, 14, doc.internal.pageSize.getHeight(), "F");

  let y = 44;
  doc.setTextColor(rail.r, rail.g, rail.b);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("COATINGS CONDUCTOR  ·  FIELD CARD", margin, y);

  doc.setTextColor(muted.r, muted.g, muted.b);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(card.product.revision || "Verify against current PDS", pageW - margin, y, { align: "right" });

  y += 22;
  doc.setTextColor(ink.r, ink.g, ink.b);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  const nameLines = wrap(doc, card.product.name || "Unnamed product", width);
  doc.text(nameLines, margin, y);
  y += nameLines.length * 20 + 4;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(muted.r, muted.g, muted.b);
  const sub = [card.product.manufacturer, card.product.productType, card.product.service]
    .filter(Boolean)
    .join("  ·  ");
  doc.text(wrap(doc, sub || "—", width), margin, y);
  y += 18;

  doc.setDrawColor(rail.r, rail.g, rail.b);
  doc.setLineWidth(1.2);
  doc.line(margin, y, pageW - margin, y);
  y += 16;

  type Row = { n: string; title: string; body: string };
  const env = card.environmentals;
  const envBits = [
    env.ambientTempMinF != null || env.ambientTempMaxF != null
      ? `Air ${env.ambientTempMinF ?? "—"}–${env.ambientTempMaxF ?? "—"}°F`
      : "",
    env.substrateTempMinF != null || env.substrateTempMaxF != null
      ? `Substrate ${env.substrateTempMinF ?? "—"}–${env.substrateTempMaxF ?? "—"}°F`
      : "",
    env.dewPointSpreadMinF != null ? `Dew spread ≥ ${env.dewPointSpreadMinF}°F` : "",
    env.relativeHumidityMax != null ? `RH ≤ ${env.relativeHumidityMax}%` : "",
    env.precipitationAllowed === false ? "No precip" : "",
    env.windMaxMph != null ? `Wind ≤ ${env.windMaxMph} mph` : "",
  ]
    .filter(Boolean)
    .join("  ·  ");

  const rows: Row[] = [
    {
      n: "01",
      title: "STORE",
      body: [card.storage.temperatureRange, join(card.storage.conditions, ""), card.storage.notes, `Shelf unopened: ${card.shelfLife.unopened || "—"}`, card.shelfLife.notes]
        .filter(Boolean)
        .join(" — "),
    },
    {
      n: "02",
      title: "QUALIFY",
      body: [join(card.credentials.required), card.credentials.notes].filter(Boolean).join(" — "),
    },
    {
      n: "03",
      title: "PREP",
      body: [
        join(card.surfacePrep.substrates),
        join(card.surfacePrep.methods),
        card.surfacePrep.profile ? `Profile ${card.surfacePrep.profile}` : "",
        card.surfacePrep.cleanliness,
        card.surfacePrep.moisture,
        card.surfacePrep.notes,
      ]
        .filter(Boolean)
        .join(" — "),
    },
    {
      n: "04",
      title: "AMBIENT",
      body: [envBits, env.notes, env.directSunNotes, ...(env.additional ?? [])].filter(Boolean).join(" — "),
    },
    {
      n: "05",
      title: "MIX",
      body: [
        card.mixing.components,
        card.mixing.ratio ? `Ratio ${card.mixing.ratio}` : "",
        card.mixing.inductionTime ? `Induction ${card.mixing.inductionTime}` : "",
        card.mixing.potLife ? `Pot life ${card.mixing.potLife}` : "",
        card.mixing.thinning,
        `Mixed life ${card.shelfLife.mixedPotLife || "—"}`,
        card.mixing.notes,
      ]
        .filter(Boolean)
        .join(" — "),
    },
    {
      n: "06",
      title: "APPLY",
      body: [
        join(card.installation.methods),
        card.installation.filmThickness,
        card.installation.coverage,
        card.installation.numberOfCoats,
        join(card.installation.sequence, ""),
        card.installation.notes,
      ]
        .filter(Boolean)
        .join(" — "),
    },
    {
      n: "07",
      title: "HOLD",
      body: card.holdPoints
        .map((h) => `${h.step}. ${h.name} — ${h.criteria} (${h.owner}; ${h.timing}${h.source === "inferred" ? "; inferred" : ""})`)
        .join("  |  "),
    },
    {
      n: "08",
      title: "INSPECT",
      body: [join(card.inspection.methods), join(card.inspection.acceptance, ""), card.inspection.documentation]
        .filter(Boolean)
        .join(" — "),
    },
    {
      n: "09",
      title: "CURE",
      body: [
        card.cure.touch ? `Touch ${card.cure.touch}` : "",
        card.cure.handle ? `Handle ${card.cure.handle}` : "",
        card.cure.recoatMin ? `Recoat min ${card.cure.recoatMin}` : "",
        card.cure.recoatMax ? `Recoat max ${card.cure.recoatMax}` : "",
        card.cure.fullCure ? `Full ${card.cure.fullCure}` : "",
        card.cure.immersionService,
        card.cure.temperatureDependence,
      ]
        .filter(Boolean)
        .join(" — "),
    },
    {
      n: "10",
      title: "SAFETY",
      body: [join(card.safety.ppe), card.safety.ventilation, join(card.safety.hazards, "")].filter(Boolean).join(" — "),
    },
  ];

  const bottom = doc.internal.pageSize.getHeight() - 48;

  for (const row of rows) {
    const titleW = 78;
    const bodyLines = wrap(doc, row.body || "—", width - titleW - 8);
    const needed = Math.max(22, bodyLines.length * 11 + 14);
    if (y + needed > bottom) {
      footer(doc, card, 1);
      doc.addPage();
      doc.setFillColor(paper.r, paper.g, paper.b);
      doc.rect(0, 0, pageW, doc.internal.pageSize.getHeight(), "F");
      doc.setFillColor(rail.r, rail.g, rail.b);
      doc.rect(0, 0, 14, doc.internal.pageSize.getHeight(), "F");
      y = 48;
    }

    doc.setFont("courier", "bold");
    doc.setFontSize(9);
    doc.setTextColor(rail.r, rail.g, rail.b);
    doc.text(row.n, margin, y + 9);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(ink.r, ink.g, ink.b);
    doc.text(row.title, margin + 22, y + 9);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(ink.r, ink.g, ink.b);
    doc.text(bodyLines, margin + titleW, y + 9);
    y += needed;
    doc.setDrawColor(rule.r, rule.g, rule.b);
    doc.setLineWidth(0.6);
    doc.line(margin, y - 6, pageW - margin, y - 6);
  }

  footer(doc, card, 1);

  if (forecast) {
    doc.addPage();
    doc.setFillColor(paper.r, paper.g, paper.b);
    doc.rect(0, 0, pageW, doc.internal.pageSize.getHeight(), "F");
    doc.setFillColor(rail.r, rail.g, rail.b);
    doc.rect(0, 0, 14, doc.internal.pageSize.getHeight(), "F");

    y = 44;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(rail.r, rail.g, rail.b);
    doc.text("APPLICATION WINDOWS  ·  NOAA", margin, y);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(muted.r, muted.g, muted.b);
    doc.setFontSize(8);
    doc.text(`${forecast.city}, ${forecast.state}  ${forecast.zip}`, pageW - margin, y, { align: "right" });
    y += 20;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(ink.r, ink.g, ink.b);
    doc.text(wrap(doc, forecast.headline, width), margin, y);
    y += 28;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(muted.r, muted.g, muted.b);
    const siteLine = [
      site ? `Substrate: ${substrateById(site.substrate).label}` : null,
      site?.mitigations.length
        ? `Mitigations: ${site.mitigations.map((id) => mitigationById(id)?.label ?? id).join(", ")}`
        : "Mitigations: none",
      "Est. substrate = air + solar gain (not a substitute for a surface thermometer)",
    ]
      .filter(Boolean)
      .join("  ·  ");
    doc.text(wrap(doc, siteLine, width), margin, y);
    y += 22;

    drawCalendar(doc, forecast.days, margin, y, width);
    y += 210;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(ink.r, ink.g, ink.b);
    doc.text("FIELD AMBIENT LOG  (fill in)", margin, y);
    y += 12;

    const cols = ["Date / time", "Air °F", "Steel °F", "RH %", "Dew °F", "Spread", "Sky / wind", "Initials"];
    const colW = width / cols.length;
    doc.setFillColor(22, 24, 28);
    doc.rect(margin, y, width, 16, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(243, 239, 230);
    cols.forEach((c, i) => doc.text(c, margin + i * colW + 4, y + 11));
    y += 16;
    doc.setTextColor(ink.r, ink.g, ink.b);
    doc.setDrawColor(rule.r, rule.g, rule.b);
    for (let r = 0; r < 10; r++) {
      doc.setLineWidth(0.5);
      doc.rect(margin, y, width, 18);
      for (let i = 1; i < cols.length; i++) doc.line(margin + i * colW, y, margin + i * colW, y + 18);
      y += 18;
    }

    y += 16;
    doc.setFont("helvetica", "italic");
    doc.setFontSize(8);
    doc.setTextColor(muted.r, muted.g, muted.b);
    const caveats = wrap(
      doc,
      "Forecast is air at the ZIP. Substrate temperature is estimated from solar load and selected mitigations — measure steel at the workface. Windows are guidance — the PDS and project spec govern. " +
        (forecast.source || ""),
      width,
    );
    doc.text(caveats, margin, y);

    footer(doc, card, 2);
  }

  const safe = (card.product.name || "field-card").replace(/[^\w]+/g, "-").slice(0, 48);
  doc.save(`${safe}-field-card.pdf`);
}

function footer(doc: import("jspdf").jsPDF, card: FieldCardData, page: number) {
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(120, 124, 128);
  doc.text(
    "Extracted from PDS for field reference. Confirm against the current manufacturer revision and the project specification. Not a substitute for the SDS or ITP.",
    36,
    pageH - 22,
    { maxWidth: pageW - 90 },
  );
  doc.text(`p.${page}`, pageW - 36, pageH - 22, { align: "right" });
  void card;
}

function drawCalendar(
  doc: import("jspdf").jsPDF,
  days: DayWindow[],
  x: number,
  y: number,
  width: number,
) {
  const show = days.slice(0, 7);
  if (!show.length) return;
  const gap = 6;
  const w = (width - gap * (show.length - 1)) / show.length;
  show.forEach((d, i) => {
    const cx = x + i * (w + gap);
    const color =
      d.status === "go" ? { r: 63, g: 125, b: 92 } : d.status === "caution" ? { r: 160, g: 122, b: 58 } : d.status === "nogo" ? { r: 154, g: 78, b: 70 } : { r: 120, g: 124, b: 128 };
    doc.setDrawColor(210, 204, 192);
    doc.setFillColor(255, 252, 246);
    doc.roundedRect(cx, y, w, 188, 4, 4, "FD");
    doc.setFillColor(color.r, color.g, color.b);
    doc.rect(cx, y, w, 6, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(22, 24, 28);
    doc.text(d.weekday.toUpperCase(), cx + w / 2, y + 22, { align: "center" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(d.dateLabel, cx + w / 2, y + 36, { align: "center" });
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(color.r, color.g, color.b);
    doc.text(d.status.toUpperCase(), cx + w / 2, y + 52, { align: "center" });
    doc.setFont("helvetica", "normal");
    doc.setTextColor(22, 24, 28);
    doc.setFontSize(7.5);
    doc.text(d.bestRange ?? "no window", cx + w / 2, y + 68, { align: "center" });
    doc.setTextColor(92, 97, 104);
    doc.setFontSize(6.5);
    doc.text(`${d.goHours}h go`, cx + w / 2, y + 82, { align: "center" });
    const limit = (d.limiting[0] || "—").slice(0, 28);
    const lines = doc.splitTextToSize(limit, w - 8) as string[];
    doc.text(lines.slice(0, 3), cx + w / 2, y + 100, { align: "center" });

    const stripY = y + 148;
    const usable = d.hours.filter((h) => h.hour >= 5 && h.hour <= 20);
    const cell = (w - 8) / Math.max(usable.length, 1);
    usable.forEach((h, idx) => {
      const fill =
        h.status === "go" ? { r: 63, g: 125, b: 92 } : h.status === "caution" ? { r: 196, g: 154, b: 80 } : { r: 180, g: 120, b: 114 };
      doc.setFillColor(fill.r, fill.g, fill.b);
      doc.rect(cx + 4 + idx * cell, stripY, Math.max(cell - 0.6, 1), 10, "F");
    });
    doc.setFontSize(6);
    doc.setTextColor(120, 124, 128);
    doc.text("05h", cx + 4, stripY + 22);
    doc.text("20h", cx + w - 4, stripY + 22, { align: "right" });
  });
}
