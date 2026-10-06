// Your Aurorum – samma logik som norrsken.py, körs helt i webbläsaren.
"use strict";

const OVATION_URL = "https://services.swpc.noaa.gov/json/ovation_aurora_latest.json";
const KP_URL = "https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json";
const KP_FORECAST_URL = "https://services.swpc.noaa.gov/products/noaa-planetary-k-index-forecast.json";
const METEO_URL = "https://api.open-meteo.com/v1/forecast";
const GEOCODE_URL = "https://geocoding-api.open-meteo.com/v1/search";
const HOUR = 3600 * 1000;

const $ = (id) => document.getElementById(id);

// ---------- Lagring (bara bekvämlighet, sidan fungerar utan) ----------
const store = {
  get(key) { try { return JSON.parse(localStorage.getItem(key)); } catch { return null; } },
  set(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* ignoreras */ } },
};

// ---------- Datahämtning ----------
// "2026-10-06T23:00" eller "2026-10-06T23:00:00" som UTC. Tolkas för hand,
// Safari är petig med datumsträngar som saknar sekunder.
function parseUtc(s) {
  const [d, t = "0:0"] = s.split("T");
  const [y, mo, da] = d.split("-").map(Number);
  const [h, mi, se = 0] = t.split(":").map(Number);
  return Date.UTC(y, mo - 1, da, h, mi, se);
}

async function getJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} från ${new URL(url).host}`);
  return res.json();
}

async function auroraProbability(lat, lon) {
  const data = await getJSON(OVATION_URL);
  const glat = Math.round(lat);
  const glon = ((Math.round(lon) % 360) + 360) % 360; // rutnät: lon 0-359, lat -90..90
  const hit = data.coordinates.find(([pLon, pLat]) => pLon === glon && pLat === glat);
  if (!hit) throw new Error("Hittade ingen rutnätspunkt för positionen");
  return { aurora: Number(hit[2]), forecastTime: data["Forecast Time"] };
}

async function latestKp() {
  try {
    const rows = await getJSON(KP_URL);
    const last = rows[rows.length - 1];
    return Array.isArray(last) ? Number(last[1]) : Number(last.Kp ?? last.kp_index);
  } catch {
    return null;
  }
}

async function kpForecast() {
  const rows = await getJSON(KP_FORECAST_URL);
  return rows.map((r) => ({ start: parseUtc(r.time_tag), kp: Number(r.kp), type: r.observed }));
}

function kpAt(blocks, when) {
  const b = blocks.find((x) => x.start <= when && when < x.start + 3 * HOUR);
  return b ? b.kp : null;
}

async function cloudCover(lat, lon, hours) {
  const params = new URLSearchParams({
    latitude: lat, longitude: lon, current: "cloud_cover", hourly: "cloud_cover",
    forecast_hours: hours, timezone: "auto",
  });
  const data = await getJSON(`${METEO_URL}?${params}`);
  const offset = (data.utc_offset_seconds || 0) * 1000;
  const hourly = data.hourly.time.map((t, i) => ({
    local: t.slice(11, 16),
    when: parseUtc(t) - offset,
    clouds: Number(data.hourly.cloud_cover[i]),
  }));
  return { now: Number(data.current.cloud_cover), hourly };
}

async function geocode(name) {
  const params = new URLSearchParams({ name, count: 5, language: "sv", format: "json" });
  const data = await getJSON(`${GEOCODE_URL}?${params}`);
  return data.results || [];
}

// ---------- Beräkningar ----------
const rad = (d) => (d * Math.PI) / 180;
const deg = (r) => (r * 180) / Math.PI;

function sunElevation(lat, lon, when = Date.now()) {
  const n = (when - Date.UTC(2000, 0, 1, 12)) / 86400000;
  const meanLon = rad((280.460 + 0.9856474 * n) % 360);
  const g = rad((357.528 + 0.9856003 * n) % 360);
  const eclLon = meanLon + rad(1.915 * Math.sin(g) + 0.020 * Math.sin(2 * g));
  const eps = rad(23.439 - 0.0000004 * n);
  const decl = Math.asin(Math.sin(eps) * Math.sin(eclLon));
  const ra = Math.atan2(Math.cos(eps) * Math.sin(eclLon), Math.cos(eclLon));
  const gmstDeg = (((18.697374558 + 24.06570982441908 * n) % 24) + 24) % 24 * 15;
  const hourAngle = rad(gmstDeg + lon) - ra;
  const phi = rad(lat);
  return deg(Math.asin(Math.sin(phi) * Math.sin(decl) + Math.cos(phi) * Math.cos(decl) * Math.cos(hourAngle)));
}

function darkness(elev) {
  if (elev < -10) return { text: "mörkt", factor: 1.0 };
  if (elev < -6) return { text: "skymning", factor: 0.5 };
  return { text: "för ljust", factor: 0.0 };
}

// Geomagnetisk nordpol (IGRF, ca 2025), dipolapproximation.
const POLE_LAT = 80.85, POLE_LON = -72.6;

function geomagneticLatitude(lat, lon) {
  const phi = rad(lat), lam = rad(lon), pphi = rad(POLE_LAT), plam = rad(POLE_LON);
  return deg(Math.asin(Math.sin(phi) * Math.sin(pphi) + Math.cos(phi) * Math.cos(pphi) * Math.cos(lam - plam)));
}

// Grov sannolikhet utifrån Kp, se aurora_from_kp i norrsken.py för kalibreringen.
function auroraFromKp(magLat, kp) {
  const center = 70.0 - 2.0 * kp;
  const width = 4.2 + 0.4 * kp;
  const peak = Math.min(90, 8 + 8 * kp);
  return peak * Math.exp(-0.5 * ((Math.abs(magLat) - center) / width) ** 2);
}

const chanceScore = (aurora, clouds, factor) => aurora * (1 - clouds / 100) * factor;

function verdict(aurora, clouds, factor) {
  if (factor === 0) return { text: "För ljust", cls: "none" };
  const s = chanceScore(aurora, clouds, factor);
  if (s >= 30) return { text: "God chans", cls: "good" };
  if (s >= 10) return { text: "Viss chans", cls: "some" };
  if (s >= 2) return { text: "Liten chans", cls: "little" };
  return { text: "Mycket liten chans", cls: "none" };
}

function hourlyForecast(lat, lon, hourly, blocks, auroraNow) {
  const magLat = geomagneticLatitude(lat, lon);
  const now = Date.now();
  const kpNow = kpAt(blocks, now);
  let ratio = 1;
  if (kpNow !== null) {
    const modelled = auroraFromKp(magLat, kpNow);
    if (modelled >= 1) ratio = Math.min(2, Math.max(0.5, auroraNow / modelled));
  }
  const rows = [];
  for (const h of hourly) {
    const kp = kpAt(blocks, h.when);
    if (kp === null) continue;
    const weight = Math.max(0, 1 - Math.max(0, (h.when - now) / HOUR) / 6);
    const aurora = auroraFromKp(magLat, kp) * (1 + (ratio - 1) * weight);
    const elev = sunElevation(lat, lon, h.when);
    rows.push({ ...h, kp, aurora, elev, verdict: verdict(aurora, h.clouds, darkness(elev).factor) });
  }
  return rows;
}

// ---------- Visning ----------
function setStatus(text, isError = false) {
  $("status").textContent = text;
  $("status").classList.toggle("error", isError);
}

const pct = (x) => `${Math.round(x)} %`;

function renderNow(d) {
  const dark = darkness(d.elev);
  const v = d.elev >= -6 ? { text: "För ljust just nu", cls: "none" } : verdict(d.aurora, d.cloudsNow, dark.factor);
  $("verdict").textContent = v.text;
  $("verdict").className = `verdict ${v.cls}`;
  const score = chanceScore(d.aurora, d.cloudsNow, dark.factor);
  $("meter-fill").style.width = `${Math.min(100, (score / 40) * 100)}%`;
  $("f-aurora").textContent = pct(d.aurora);
  $("f-clouds").textContent = pct(d.cloudsNow);
  $("f-light").innerHTML = `${dark.text}<small>solen ${d.elev.toFixed(0)}°</small>`;
  $("f-kp").textContent = d.kp === null ? "okänt" : d.kp.toFixed(1);
  const t = new Date(d.fetchedAt).toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit" });
  $("updated").textContent = `Uppdaterat ${t}${d.offline ? " (sparad data, ingen uppkoppling)" : ""}`;
  $("now").hidden = false;

  $("cloud-strip").innerHTML = d.hourly.slice(0, 6).map((h) => `
    <li><time>${h.local}</time>
      <div class="bar"><span style="height:${Math.max(4, h.clouds * 0.4)}px"></span></div>
      ${pct(h.clouds)}</li>`).join("");
  $("clouds").hidden = false;
  $("day").hidden = false;
}

function renderDay(rows) {
  $("day-rows").innerHTML = rows.map((r) => `
    <tr class="${r.verdict.text === "För ljust" ? "light" : ""}">
      <td>${r.local}</td><td class="${r.verdict.cls}">${r.verdict.text}</td>
      <td>${pct(r.aurora)}</td><td>${pct(r.clouds)}</td>
      <td>${r.elev.toFixed(0)}°</td><td>${r.kp.toFixed(1)}</td></tr>`).join("");
}

// ---------- Flöde ----------
let current = null;  // { lat, lon, name }
let lastData = null;

let dayOpen = false;

async function update() {
  if (!current) return;
  const { lat, lon } = current;
  setStatus("Hämtar data …");
  try {
    const [ov, clouds, kp] = await Promise.all([
      auroraProbability(lat, lon), cloudCover(lat, lon, 25), latestKp(),
    ]);
    lastData = {
      lat, lon, aurora: ov.aurora, cloudsNow: clouds.now, hourly: clouds.hourly, kp,
      elev: sunElevation(lat, lon), fetchedAt: Date.now(), offline: !navigator.onLine,
    };
    renderNow(lastData);
    setStatus("");
    if (dayOpen) await updateDay();
  } catch (err) {
    setStatus(`Kunde inte hämta data: ${err.message}`, true);
  }
}

// 24 timmar hämtas separat så att ett fel där inte stoppar resten av sidan.
async function updateDay() {
  if (!lastData) return;
  const d = lastData;
  $("day-status").textContent = "Hämtar Kp-prognos …";
  try {
    const rows = hourlyForecast(d.lat, d.lon, d.hourly, await kpForecast(), d.aurora);
    renderDay(rows);
    $("day-status").textContent = rows.length ? "" : "Ingen prognos tillgänglig just nu.";
  } catch (err) {
    $("day-status").textContent = `Kunde inte hämta 24-timmarsprognosen: ${err.message}`;
  }
}

function setDayOpen(on) {
  dayOpen = on;
  store.set("showDay", on);
  $("day-body").hidden = !on;
  $("day-toggle").setAttribute("aria-expanded", String(on));
  $("day-toggle").firstElementChild.textContent = on ? "Dölj kommande 24 timmar" : "Visa kommande 24 timmar";
}

function choosePlace(place) {
  current = place;
  store.set("place", place);
  $("place-name").textContent = place.name;
  $("results").hidden = true;
  update();
}

const coordName = (lat, lon) => `${lat.toFixed(2)}, ${lon.toFixed(2)}`;

$("locate").addEventListener("click", () => {
  if (!("geolocation" in navigator)) {
    setStatus("Webbläsaren saknar platstjänst. Sök på en ort i stället.", true);
    return;
  }
  $("locate").disabled = true;
  setStatus("Hämtar din plats …");
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      $("locate").disabled = false;
      const { latitude: lat, longitude: lon } = pos.coords;
      choosePlace({ lat, lon, name: `Din plats (${coordName(lat, lon)})` });
    },
    (err) => {
      $("locate").disabled = false;
      setStatus(err.code === 1
        ? "Platstjänsten nekades. Sök på en ort i stället."
        : "Kunde inte hitta din plats. Sök på en ort i stället.", true);
    },
    { enableHighAccuracy: false, timeout: 15000, maximumAge: 10 * 60 * 1000 },
  );
});

$("search").addEventListener("submit", async (e) => {
  e.preventDefault();
  const q = $("query").value.trim();
  if (!q) return;
  const m = q.match(/^\s*(-?\d+(?:[.,]\d+)?)\s*[,;\s]\s*(-?\d+(?:[.,]\d+)?)\s*$/);
  if (m) {
    const lat = Number(m[1].replace(",", ".")), lon = Number(m[2].replace(",", "."));
    if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return setStatus("Ogiltiga koordinater.", true);
    return choosePlace({ lat, lon, name: coordName(lat, lon) });
  }
  setStatus("Söker …");
  try {
    const hits = await geocode(q);
    if (!hits.length) return setStatus(`Hittade ingen ort som heter "${q}".`, true);
    setStatus("");
    const ul = $("results");
    ul.innerHTML = "";
    for (const h of hits) {
      const li = document.createElement("li");
      const b = document.createElement("button");
      b.type = "button";
      const region = [h.admin1, h.country].filter(Boolean).join(", ");
      b.innerHTML = `${h.name} <small>${region}</small>`;
      b.addEventListener("click", () => choosePlace({ lat: h.latitude, lon: h.longitude, name: h.name }));
      li.append(b);
      ul.append(li);
    }
    ul.hidden = false;
  } catch (err) {
    setStatus(`Sökningen misslyckades: ${err.message}`, true);
  }
});

$("day-toggle").addEventListener("click", () => {
  setDayOpen(!dayOpen);
  if (dayOpen) updateDay();
});

// Start
setDayOpen(!!store.get("showDay"));
const saved = store.get("place");
if (saved) choosePlace(saved);
else setStatus("Välj plats för att se chansen.");

// Uppdatera när appen visas igen och var 10:e minut
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && lastData && Date.now() - lastData.fetchedAt > 10 * 60 * 1000) update();
});
setInterval(() => { if (document.visibilityState === "visible") update(); }, 10 * 60 * 1000);

// ---------- Installera appen ----------
// Chrome/Edge/Samsung ger en riktig installationsdialog (beforeinstallprompt).
// Safari på iPhone har ingen sådan, där visas instruktioner i stället.
let installEvent = null;
const isInstalled = () =>
  window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
const isIos = () =>
  /iphone|ipad|ipod/i.test(navigator.userAgent) ||
  (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1); // iPadOS säger sig vara Mac

if (!isInstalled()) $("install").hidden = false;

window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  installEvent = e;
});

window.addEventListener("appinstalled", () => {
  $("install").hidden = true;
  installEvent = null;
});

$("install").addEventListener("click", async () => {
  if (installEvent) {
    installEvent.prompt();
    const { outcome } = await installEvent.userChoice;
    installEvent = null;
    if (outcome === "accepted") $("install").hidden = true;
    return;
  }
  const ios = isIos();
  $("install-ios").hidden = !ios;
  $("install-other").hidden = ios;
  const dlg = $("install-help");
  if (dlg.showModal) dlg.showModal(); else dlg.setAttribute("open", "");
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
}
