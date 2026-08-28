import {
  inShift,
  mitigationById,
  sanitizeMitigations,
  skyFactor,
  solarEnvelope,
  substrateById,
  type Limiter,
  type SiteContext,
} from "./mitigations.ts";
import { axes, DEFAULT_CALIBRATION, lerp } from "./learning.ts";
import type { DayWindow, Environmentals, ForecastBundle, HourWindow, WindowStatus } from "./types.ts";

export type RawHour = {
  startIso: string;
  tempF: number | null;
  rh: number | null;
  dewpointF: number | null;
  pop: number | null;
  precipIn: number | null;
  windMph: number | null;
  shortForecast: string;
  cloudCover?: number | null;
};

function zoned(iso: string, timeZone: string) {
  const naive = iso.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2})(?::(\d{2}))?(?!.*(?:Z|[+-]\d{2}:\d{2}))/);
  if (naive) {
    const month = Number(naive[2]);
    const day = Number(naive[3]);
    const hour = Number(naive[4]);
    const weekday = new Date(`${naive[1]}-${naive[2]}-${naive[3]}T12:00:00Z`).toLocaleDateString("en-US", {
      weekday: "short",
      timeZone: "UTC",
    });
    return {
      hour,
      weekday,
      dateLabel: `${month}/${day}`,
      dateKey: `${naive[1]}-${naive[2]}-${naive[3]}`,
    };
  }
  const d = new Date(iso);
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    hour: "2-digit",
    hourCycle: "h23",
    month: "numeric",
    day: "numeric",
    year: "numeric",
  });
  const map: Record<string, string> = {};
  for (const p of fmt.formatToParts(d)) {
    if (p.type !== "literal") map[p.type] = p.value;
  }
  const hour = Number(map.hour);
  const month = Number(map.month);
  const day = Number(map.day);
  const year = Number(map.year);
  return {
    hour: Number.isFinite(hour) ? hour : d.getHours(),
    weekday: map.weekday ?? "",
    dateLabel: `${month}/${day}`,
    dateKey: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
  };
}

function hasNumericWindow(env: Environmentals) {
  return (
    env.ambientTempMinF != null ||
    env.ambientTempMaxF != null ||
    env.substrateTempMinF != null ||
    env.substrateTempMaxF != null ||
    env.relativeHumidityMax != null ||
    env.dewPointSpreadMinF != null ||
    env.windMaxMph != null ||
    env.precipitationAllowed === false
  );
}

function wetForecast(text: string) {
  return /\b(rain|shower|storm|thunder|snow|sleet|drizzle|precip)/i.test(text);
}

function frozenPrecip(text: string) {
  return /\b(snow|sleet|ice|freezing rain)\b/i.test(text);
}

function round1(n: number) {
  return Math.round(n * 10) / 10;
}

function overLimit(value: number, max: number, axis: number, unitSoft = 8): "hard" | "soft" | null {
  const hardPad = lerp(10, 0, axis);
  const softStart = lerp(unitSoft, 3, axis);
  if (value > max + hardPad) return "hard";
  if (value > max - softStart) return "soft";
  return null;
}

function underLimit(value: number, min: number, axis: number, unitSoft = 8): "hard" | "soft" | null {
  const hardPad = lerp(10, 0, axis);
  const softStart = lerp(unitSoft, 3, axis);
  if (value < min - hardPad) return "hard";
  if (value < min + softStart) return "soft";
  return null;
}

export function scoreHour(
  raw: RawHour,
  env: Environmentals,
  timeZone = "UTC",
  site?: SiteContext,
): HourWindow {
  const z = zoned(raw.startIso, timeZone);
  const reasons: string[] = [];
  let hard = 0;
  let soft = 0;

  const mits = sanitizeMitigations((site?.mitigations ?? []).filter((id) => Boolean(mitigationById(id))));
  const sub = substrateById(site?.substrate ?? "bare_steel");
  const shiftOk = inShift(z.hour, mits);
  const discipline = site?.discipline ?? "coatings";
  const cal = axes(site?.calibration ?? DEFAULT_CALIBRATION);
  const customActive = (site?.customMitigations ?? []).filter((c) => site?.customMitigationIds?.includes(c.id));

  let air = raw.tempF;
  let rh = raw.rh;
  let dew = raw.dewpointF;
  let wind = raw.windMph;
  let precipBlocked = env.precipitationAllowed === false;

  const sky = skyFactor(raw.shortForecast, raw.cloudCover);
  let sun = solarEnvelope(z.hour) * sky;
  const envelope = solarEnvelope(z.hour);

  const rainTarp = mits.includes("rain_tarp");
  const lightTent = mits.includes("light_tent");
  const darkTent = mits.includes("dark_tent");
  const dehu = mits.includes("dehumidify_tent");
  const humid = mits.includes("humidity_tent");
  const climate = mits.includes("climate_tent");
  const canopy = mits.includes("canopy");
  const windBlock = mits.includes("windscreen");
  const enclosed = climate || lightTent || darkTent || dehu || humid;

  // One owner per axis — never multiply the same limiter twice.
  if (climate) sun = 0;
  else if (lightTent) sun *= 0.08;
  else if (darkTent) sun *= 0.12;
  else if (dehu || humid) sun *= 0.1;
  else if (canopy) sun *= 0.12;

  if (climate) wind = 0;
  else if (lightTent || darkTent || dehu || humid) wind = wind != null ? wind * 0.25 : wind;
  else if (windBlock) wind = wind != null ? wind * 0.4 : wind;

  if (enclosed || rainTarp) precipBlocked = false;

  if (climate && air != null) air = round1(air + (72 - air) * 0.65);
  else if (mits.includes("heaters") && air != null) air = round1(air + 16);
  else if (lightTent && air != null) air = round1(air + 2 * envelope);
  else if (darkTent && air != null) {
    air = round1(air + 12 * Math.max(envelope, sky > 0.4 && z.hour >= 8 && z.hour <= 18 ? 0.35 : 0));
  }

  if (climate) {
    if (rh != null) rh = round1(rh + (48 - rh) * 0.7);
    if (dew != null && air != null) dew = round1(Math.min(dew, air - 8));
  } else if (dehu) {
    if (rh != null) rh = Math.max(20, rh - 18);
    if (dew != null) dew = round1(dew - 4);
  } else if (humid) {
    if (rh != null) rh = Math.max(rh, discipline === "cementitious" ? 70 : 85);
  }

  for (const cm of customActive) {
    sun *= cm.sunMul > 0 ? cm.sunMul : 1;
    if (air != null) air = round1(air + (cm.dAirF || 0));
    if (rh != null) rh = Math.max(0, Math.min(100, rh + (cm.dRh || 0)));
    if (dew != null) dew = round1(dew + (cm.dDewF || 0));
    if (wind != null) wind = Math.max(0, wind + (cm.dWindMph || 0));
  }

  let solarGain = sun * sub.peakGainF * lerp(0.58, 1.18, cal.solar);
  if (z.hour >= 4 && z.hour <= 7) solarGain -= 2;

  let substrateF = air != null ? round1(air + solarGain) : null;
  if (mits.includes("preheat") && sub.metal && substrateF != null && !climate) {
    substrateF = round1(substrateF + 14);
  }
  if (mits.includes("heaters") && substrateF != null && !climate) {
    substrateF = round1(substrateF + 10);
  }
  let fogged = false;
  if (mits.includes("fog_mist") && substrateF != null && solarGain > 3) {
    if (sub.metal) {
      substrateF = round1(substrateF - 22);
      fogged = true;
    } else if (sub.id === "concrete") {
      substrateF = round1(substrateF - 10);
      if (air != null) air = round1(air - 3);
      fogged = true;
    }
  }
  for (const cm of customActive) {
    if (substrateF != null) substrateF = round1(substrateF + (cm.dSubstrateF || 0));
  }

  const skipRhMax = humid && discipline === "cementitious";
  const skipDew = humid && discipline === "cementitious";

  const airMin = env.ambientTempMinF;
  const airMax = env.ambientTempMaxF;
  const subMin = env.substrateTempMinF ?? env.ambientTempMinF;
  const subMax = env.substrateTempMaxF ?? env.ambientTempMaxF;

  if (air != null && airMin != null) {
    const hit = underLimit(air, airMin, cal.thermal);
    if (hit === "hard") {
      reasons.push(`Air ${air}°F below min ${airMin}°F`);
      hard += 1;
    } else if (hit === "soft") {
      reasons.push(`Air ${air}°F near min ${airMin}°F`);
      soft += 1;
    }
  }
  if (air != null && airMax != null) {
    const hit = overLimit(air, airMax, cal.thermal);
    if (hit === "hard") {
      reasons.push(`Air ${air}°F above max ${airMax}°F`);
      hard += 1;
    } else if (hit === "soft") {
      reasons.push(`Air ${air}°F near max ${airMax}°F`);
      soft += 1;
    }
  }

  if (substrateF != null && subMin != null) {
    const hit = underLimit(substrateF, subMin, cal.thermal);
    if (hit === "hard") {
      reasons.push(`${sub.label} ${substrateF}°F below min ${subMin}°F`);
      hard += 1;
    } else if (hit === "soft") {
      reasons.push(`${sub.label} ${substrateF}°F near min`);
      soft += 1;
    }
  }
  if (substrateF != null && subMax != null) {
    const hit = overLimit(substrateF, subMax, cal.thermal);
    if (hit === "hard") {
      reasons.push(`${sub.label} ${substrateF}°F > max ${subMax}°F (air ${air ?? "—"}° + sun ${round1(Math.max(0, solarGain))}°)`);
      hard += 1;
    } else if (hit === "soft") {
      reasons.push(`${sub.label} ${substrateF}°F near max`);
      soft += 1;
    }
  }

  if (rh != null && env.relativeHumidityMax != null && !skipRhMax) {
    const hit = overLimit(rh, env.relativeHumidityMax, cal.moisture, 6);
    if (hit === "hard") {
      reasons.push(`RH ${rh}% above max ${env.relativeHumidityMax}%`);
      hard += 1;
    } else if (hit === "soft") {
      reasons.push(`RH ${rh}% near max`);
      soft += 1;
    }
  }

  const spread =
    substrateF != null && dew != null
      ? round1(substrateF - dew)
      : air != null && dew != null
        ? round1(air - dew)
        : null;
  if (spread != null && env.dewPointSpreadMinF != null && !skipDew) {
    const hardPad = lerp(3, 0, cal.moisture);
    const softPad = lerp(4, 1.5, cal.moisture);
    if (spread < env.dewPointSpreadMinF - hardPad) {
      reasons.push(`Dew spread ${spread}°F < ${env.dewPointSpreadMinF}°F`);
      hard += 1;
    } else if (spread < env.dewPointSpreadMinF + softPad) {
      reasons.push(`Dew spread ${spread}°F is thin`);
      soft += 1;
    }
  }

  if (precipBlocked) {
    const nogoPop = lerp(68, 32, cal.precip);
    const softPop = lerp(42, 15, cal.precip);
    if ((raw.pop != null && raw.pop >= nogoPop) || (raw.precipIn != null && raw.precipIn > 0.02) || wetForecast(raw.shortForecast)) {
      reasons.push(
        raw.pop != null ? `Precip ${raw.pop}% · ${raw.shortForecast || "wet"}` : raw.shortForecast || "Precipitation risk",
      );
      hard += 1;
    } else if (raw.pop != null && raw.pop >= softPop) {
      reasons.push(`Precip ${raw.pop}%`);
      soft += 1;
    }
  } else if (rainTarp && !lightTent && !darkTent && !dehu && !humid && !climate) {
    if (frozenPrecip(raw.shortForecast)) {
      reasons.push("Rain tarp does not cover snow/sleet — hold");
      hard += 1;
    } else if (/\b(thunder|severe)\b/i.test(raw.shortForecast) || ((wind ?? 0) >= 28 && wetForecast(raw.shortForecast))) {
      reasons.push("Rain tarp — stake and pitch; wind-driven rain can still wet the face");
      soft += 1;
    }
  }

  if (wind != null && env.windMaxMph != null) {
    const hit = overLimit(wind, env.windMaxMph, cal.wind, 6);
    if (hit === "hard") {
      reasons.push(`Wind ${Math.round(wind)} mph > ${env.windMaxMph}`);
      hard += 1;
    } else if (hit === "soft") {
      reasons.push(`Wind ${Math.round(wind)} mph near limit`);
      soft += 1;
    }
  }

  if (fogged) {
    if (discipline === "cementitious" || site?.moistureTolerant) {
      reasons.push("Fog/mist cooldown — confirm SSD or dry per PDS before placing");
      soft += 1;
    } else {
      reasons.push("Fog/mist cooldown — wipe dry and re-log dew point before coating (NACE/SSPC)");
      soft += 1;
    }
  }

  if (!shiftOk) {
    reasons.unshift(
      mits.includes("night_shift") ? "Outside night shift (19:00–06:00)" : "Outside dawn window (05:00–10:00)",
    );
    hard += 1;
  }

  let status: WindowStatus = "go";
  if (!hasNumericWindow(env)) status = "unknown";
  else if (hard > 0) status = "nogo";
  else if (soft > 0) status = "caution";
  else if (env.dewPointSpreadMinF == null && !skipDew) {
    status = "unknown";
    reasons.push("Dew spread not stated");
  }

  if (status === "go" && reasons.length === 0) {
    const extra = mits.length ? ` after ${mits.map((id) => mitigationById(id)?.label ?? id).join(", ")}` : "";
    reasons.push(`Inside PDS window${extra}`);
  }

  return {
    startIso: raw.startIso,
    hour: z.hour,
    weekday: z.weekday,
    dateLabel: z.dateLabel,
    status,
    reasons,
    tempF: raw.tempF,
    rh: raw.rh,
    dewpointF: raw.dewpointF,
    spreadF: spread,
    pop: raw.pop,
    precipIn: raw.precipIn,
    windMph: raw.windMph,
    shortForecast: raw.shortForecast,
    dateKey: z.dateKey,
    substrateF,
    solarGainF: round1(Math.max(0, solarGain)),
    inShift: shiftOk,
  };
}

function bestRange(hours: HourWindow[], wrapNight = false): string | null {
  if (hours.length === 0) return null;
  const preferGo = hours.some((h) => h.status === "go");
  const ok = (h: HourWindow) => (preferGo ? h.status === "go" : h.status === "go" || h.status === "caution");

  let bestStart = -1;
  let bestLen = 0;
  let i = 0;
  while (i < hours.length) {
    if (!ok(hours[i])) {
      i += 1;
      continue;
    }
    let j = i;
    while (j < hours.length && ok(hours[j])) j += 1;
    const len = j - i;
    if (len > bestLen) {
      bestLen = len;
      bestStart = i;
    }
    i = j;
  }

  const fmt = (h: number) => `${String(h).padStart(2, "0")}:00`;

  if (wrapNight && hours.length > 4) {
    let prefix = 0;
    while (prefix < hours.length && ok(hours[prefix])) prefix += 1;
    let suffix = 0;
    while (suffix < hours.length && ok(hours[hours.length - 1 - suffix])) suffix += 1;
    if (prefix > 0 && suffix > 0 && prefix + suffix < hours.length && prefix + suffix >= bestLen) {
      const startH = hours[hours.length - suffix].hour;
      let endH = hours[prefix - 1].hour + 1;
      if (endH >= 24) endH = 24;
      return `${fmt(startH)}–${fmt(endH)}`;
    }
  }

  if (bestStart < 0) return null;
  if (bestLen >= 18) return "All day";
  const a = hours[bestStart];
  const b = hours[bestStart + bestLen - 1];
  let endHour = b.hour + 1;
  if (endHour >= 24) endHour = 24;
  return `${fmt(a.hour)}–${fmt(endHour)}`;
}

export function bundleDays(
  hours: HourWindow[],
  meta: Omit<ForecastBundle, "days" | "headline">,
  env: Environmentals,
  site?: SiteContext,
): ForecastBundle {
  const byDate = new Map<string, HourWindow[]>();
  for (const h of hours) {
    const key = h.dateKey || h.startIso.slice(0, 10);
    const list = byDate.get(key) ?? [];
    list.push(h);
    byDate.set(key, list);
  }

  const wrapNight = Boolean(site?.mitigations.includes("night_shift"));
  const days: DayWindow[] = [];
  for (const [date, list] of byDate) {
    const goHours = list.filter((h) => h.status === "go").length;
    const cautionHours = list.filter((h) => h.status === "caution").length;
    const nogoHours = list.filter((h) => h.status === "nogo").length;
    const goNeed = Math.round(lerp(2, 5, site?.calibration?.master ?? 0.55));
    const cautionNeed = Math.round(lerp(2, 5, site?.calibration?.master ?? 0.55));
    let status: WindowStatus = "unknown";
    if (goHours >= goNeed) status = "go";
    else if (goHours > 0 || cautionHours >= cautionNeed) status = "caution";
    else if (list.some((h) => h.status !== "unknown")) status = "nogo";

    const reasonCount = new Map<string, number>();
    for (const h of list) {
      if (h.status === "nogo" || h.status === "caution") {
        const key = h.reasons[0] ?? "";
        if (key) reasonCount.set(key, (reasonCount.get(key) ?? 0) + 1);
      }
    }
    const limiting = [...reasonCount.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 2)
      .map(([k]) => k);

    days.push({
      date,
      weekday: list[0]?.weekday ?? "",
      dateLabel: list[0]?.dateLabel ?? date,
      status,
      goHours,
      cautionHours,
      nogoHours,
      bestRange: bestRange(list, wrapNight),
      limiting,
      hours: list,
    });
  }

  days.sort((a, b) => a.date.localeCompare(b.date));

  const scored = hasNumericWindow(env);
  const best = [...days].filter((d) => d.status === "go").sort((a, b) => b.goHours - a.goHours)[0];
  const alt = [...days].filter((d) => d.bestRange).sort((a, b) => b.goHours + b.cautionHours - (a.goHours + a.cautionHours))[0];
  const mitLabel = (site?.mitigations ?? [])
    .map((id) => mitigationById(id)?.label)
    .filter(Boolean)
    .join(" + ");
  const withMits = mitLabel ? ` with ${mitLabel}` : "";

  let headline = "Forecast loaded — PDS has no numeric application window to score against.";
  if (scored && best?.bestRange) {
    headline = `Best window${withMits}: ${best.weekday} ${best.dateLabel}  ${best.bestRange}  (${best.goHours} go hours)`;
  } else if (scored && alt?.bestRange) {
    headline = `No clean go-day${withMits}. Least-bad: ${alt.weekday} ${alt.dateLabel}  ${alt.bestRange}`;
  } else if (scored) {
    headline = mitLabel
      ? `Still no in-window hours with ${mitLabel}. Add another mitigation or hold the product.`
      : "No in-window hours in this forecast. Hold the product or add a mitigation.";
  }

  return { ...meta, days, headline };
}

export function rescoreForecast(
  forecast: ForecastBundle,
  env: Environmentals,
  site: SiteContext,
): ForecastBundle {
  const raw = forecast.rawHours ?? [];
  if (!raw.length) return forecast;
  const hours = raw.map((h) => scoreHour(h, env, forecast.timezone, site));
  return bundleDays(
    hours,
    {
      zip: forecast.zip,
      city: forecast.city,
      state: forecast.state,
      lat: forecast.lat,
      lon: forecast.lon,
      timezone: forecast.timezone,
      source: forecast.source,
      issuedAt: forecast.issuedAt,
      rawHours: raw,
    },
    env,
    site,
  );
}

export function goHourCount(forecast: ForecastBundle, env: Environmentals, site: SiteContext) {
  const raw = forecast.rawHours ?? [];
  return raw.map((h) => scoreHour(h, env, forecast.timezone, site)).filter((h) => h.status === "go").length;
}

export function unlockedGoHours(forecast: ForecastBundle, env: Environmentals, site: SiteContext) {
  const raw = forecast.rawHours ?? [];
  const none: SiteContext = { ...site, mitigations: [] };
  let n = 0;
  for (const h of raw) {
    const a = scoreHour(h, env, forecast.timezone, none);
    const b = scoreHour(h, env, forecast.timezone, site);
    if (a.status !== "go" && b.status === "go") n += 1;
  }
  return n;
}

export function detectLimiters(forecast: ForecastBundle, env: Environmentals, site: SiteContext): Limiter[] {
  const raw = forecast.rawHours ?? [];
  const none: SiteContext = { ...site, mitigations: [] };
  const counts: Record<Limiter, number> = {
    heat: 0,
    solar: 0,
    cold: 0,
    rh: 0,
    dew: 0,
    rain: 0,
    wind: 0,
  };
  for (const h of raw) {
    const scored = scoreHour(h, env, forecast.timezone, none);
    if (scored.status !== "nogo" && scored.status !== "caution") continue;
    const text = scored.reasons.join(" ");
    if (/sun |solar/.test(text) || ((scored.solarGainF ?? 0) > 10 && /above max/.test(text))) counts.solar += 1;
    if (/above max/.test(text)) counts.heat += 1;
    if (/below min/.test(text)) counts.cold += 1;
    if (/\bRH\b/.test(text)) counts.rh += 1;
    if (/Dew/.test(text)) counts.dew += 1;
    if (/Precip|wet/i.test(text)) counts.rain += 1;
    if (/Wind/.test(text)) counts.wind += 1;
  }
  return (Object.entries(counts) as [Limiter, number][])
    .filter(([, n]) => n >= 2)
    .sort((a, b) => b[1] - a[1])
    .map(([k]) => k);
}
