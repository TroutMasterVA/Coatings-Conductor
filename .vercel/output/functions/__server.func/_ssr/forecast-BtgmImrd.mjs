import { t as createServerFn } from "./ssr.mjs";
import { t as createServerRpc } from "./createServerRpc-A6pJPYTF.mjs";
import { b as scoreHour, i as bundleDays } from "./score-windows-494NVaej.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/forecast-BtgmImrd.js
var UA = "CoatingsConductor/1.0 (field-qc reference; nws-weather-windows)";
function cToF(c) {
	return Math.round(c * 9 / 5 + 32);
}
function parseWind(v) {
	if (typeof v === "number" && Number.isFinite(v)) return v;
	if (typeof v !== "string") return null;
	const nums = [...v.matchAll(/(\d+(?:\.\d+)?)/g)].map((m) => Number(m[1]));
	if (!nums.length) return null;
	return Math.max(...nums);
}
async function geocodeZip(zip) {
	const res = await fetch(`https://api.zippopotam.us/us/${zip}`);
	if (!res.ok) throw new Error("ZIP not found. Use a 5-digit US ZIP.");
	const body = await res.json();
	const place = body.places?.[0];
	if (!place) throw new Error("ZIP not found.");
	return {
		zip: body["post code"] ?? zip,
		city: place["place name"],
		state: place["state abbreviation"] || place.state,
		lat: Number(place.latitude),
		lon: Number(place.longitude)
	};
}
async function nwsHourly(lat, lon) {
	const points = await fetch(`https://api.weather.gov/points/${lat.toFixed(4)},${lon.toFixed(4)}`, { headers: {
		"User-Agent": UA,
		Accept: "application/geo+json"
	} });
	if (!points.ok) return null;
	const pt = await points.json();
	const hourlyUrl = pt.properties?.forecastHourly;
	if (!hourlyUrl) return null;
	const hourly = await fetch(hourlyUrl, { headers: {
		"User-Agent": UA,
		Accept: "application/geo+json"
	} });
	if (!hourly.ok) return null;
	return {
		hours: ((await hourly.json()).properties?.periods ?? []).slice(0, 168).map((p) => {
			let tempF = p.temperature;
			if (p.temperatureUnit === "C") tempF = cToF(p.temperature);
			let dewpointF = null;
			if (p.dewpoint?.value != null) dewpointF = /degC/i.test(p.dewpoint.unitCode ?? "") ? cToF(p.dewpoint.value) : p.dewpoint.value;
			return {
				startIso: p.startTime,
				tempF,
				rh: p.relativeHumidity?.value ?? null,
				dewpointF,
				pop: p.probabilityOfPrecipitation?.value ?? null,
				precipIn: null,
				windMph: parseWind(p.windSpeed),
				shortForecast: p.shortForecast ?? ""
			};
		}),
		source: "NOAA National Weather Service hourly",
		timezone: pt.properties?.timeZone ?? "local"
	};
}
async function openMeteo(lat, lon) {
	const url = new URL("https://api.open-meteo.com/v1/forecast");
	url.searchParams.set("latitude", String(lat));
	url.searchParams.set("longitude", String(lon));
	url.searchParams.set("hourly", "temperature_2m,relative_humidity_2m,dew_point_2m,precipitation_probability,precipitation,wind_speed_10m,weather_code,cloud_cover");
	url.searchParams.set("temperature_unit", "fahrenheit");
	url.searchParams.set("wind_speed_unit", "mph");
	url.searchParams.set("precipitation_unit", "inch");
	url.searchParams.set("timezone", "auto");
	url.searchParams.set("forecast_days", "7");
	const res = await fetch(url.toString());
	if (!res.ok) throw new Error("Weather forecast is unavailable.");
	const body = await res.json();
	const h = body.hourly;
	if (!h?.time?.length) throw new Error("Hourly forecast was empty.");
	const wx = (code) => {
		if (code == null) return "";
		if (code >= 95) return "Thunderstorm";
		if (code >= 80) return "Showers";
		if (code >= 71) return "Snow";
		if (code >= 61) return "Rain";
		if (code >= 51) return "Drizzle";
		if (code >= 45) return "Fog";
		if (code >= 1) return "Clouds";
		return "Clear";
	};
	return {
		hours: h.time.map((time, i) => ({
			startIso: time.length === 16 ? `${time}:00` : time,
			tempF: h.temperature_2m[i] ?? null,
			rh: h.relative_humidity_2m[i] ?? null,
			dewpointF: h.dew_point_2m[i] ?? null,
			pop: h.precipitation_probability[i] ?? null,
			precipIn: h.precipitation[i] ?? null,
			windMph: h.wind_speed_10m[i] ?? null,
			shortForecast: wx(h.weather_code[i] ?? null),
			cloudCover: h.cloud_cover?.[i] ?? null
		})),
		source: "NOAA models via Open-Meteo (NWS hourly unavailable)",
		timezone: body.timezone ?? "auto"
	};
}
var loadForecast_createServerFn_handler = createServerRpc({
	id: "dd0ffdd043195dddbd4cbc41ec11e49f69e12dfaf5d4c9ae5ca40747acb4b9d9",
	name: "loadForecast",
	filename: "src/lib/forecast.ts"
}, (opts) => loadForecast.__executeServer(opts));
var loadForecast = createServerFn({ method: "POST" }).validator((input) => {
	const zip = (input?.zip ?? "").replace(/\D/g, "").slice(0, 5);
	if (zip.length !== 5) throw new Error("Enter a 5-digit US ZIP.");
	return {
		zip,
		environmentals: input.environmentals
	};
}).handler(loadForecast_createServerFn_handler, async ({ data }) => {
	try {
		const geo = await geocodeZip(data.zip);
		let pack = await nwsHourly(geo.lat, geo.lon).catch(() => null);
		if (!pack || pack.hours.length < 12) pack = await openMeteo(geo.lat, geo.lon);
		const scored = pack.hours.map((h) => scoreHour(h, data.environmentals, pack.timezone));
		return {
			ok: true,
			forecast: bundleDays(scored, {
				zip: geo.zip,
				city: geo.city,
				state: geo.state,
				lat: geo.lat,
				lon: geo.lon,
				timezone: pack.timezone,
				source: pack.source,
				issuedAt: (/* @__PURE__ */ new Date()).toISOString(),
				rawHours: pack.hours
			}, data.environmentals)
		};
	} catch (err) {
		return {
			ok: false,
			error: err instanceof Error ? err.message : "Forecast failed"
		};
	}
});
//#endregion
export { loadForecast_createServerFn_handler };
