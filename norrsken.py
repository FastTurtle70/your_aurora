#!/usr/bin/env python3
"""Norrskenschans för en given position.

Användning:  python norrsken.py LATITUD LONGITUD [--24h]
Exempel:     python norrsken.py 65.58 22.15         (Luleå, just nu)
             python norrsken.py 65.58 22.15 --24h   (även timme för timme 24 h framåt)
"""
import argparse
import math
import sys
from datetime import datetime, timedelta, timezone

import requests

OVATION_URL = "https://services.swpc.noaa.gov/json/ovation_aurora_latest.json"
KP_URL = "https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json"
KP_FORECAST_URL = "https://services.swpc.noaa.gov/products/noaa-planetary-k-index-forecast.json"
METEO_URL = "https://api.open-meteo.com/v1/forecast"
TIMEOUT = 20


def aurora_probability(lat, lon):
    """Norrskenssannolikhet (%) i närmaste rutnätspunkt i OVATION-modellen."""
    data = requests.get(OVATION_URL, timeout=TIMEOUT).json()
    glat, glon = round(lat), round(lon) % 360  # rutnät: lon 0-359, lat -90..90
    for p_lon, p_lat, p_aurora in data["coordinates"]:
        if p_lon == glon and p_lat == glat:
            return float(p_aurora), data.get("Forecast Time", "?")
    raise ValueError("Hittade ingen rutnätspunkt för positionen")


def latest_kp():
    """Senaste planetära Kp-index, eller None om det inte går att läsa."""
    try:
        rows = requests.get(KP_URL, timeout=TIMEOUT).json()
        last = rows[-1]
        if isinstance(last, dict):
            return float(last.get("Kp", last.get("kp_index")))
        return float(last[1])
    except Exception:
        return None


def kp_forecast():
    """Kp per 3-timmarsblock: lista av (start i UTC, kp, typ), där typ är
    observed/estimated/predicted. NOAA prognostiserar ca 3 dygn framåt."""
    rows = requests.get(KP_FORECAST_URL, timeout=TIMEOUT).json()
    return [
        (
            datetime.fromisoformat(r["time_tag"]).replace(tzinfo=timezone.utc),
            float(r["kp"]),
            r["observed"],
        )
        for r in rows
    ]


def kp_at(blocks, when):
    """Kp för blocket som innehåller tidpunkten `when`, eller None."""
    for start, kp, _ in blocks:
        if start <= when < start + timedelta(hours=3):
            return kp
    return None


def cloud_cover(lat, lon, hours=6):
    """Molntäcke (%) nu samt per timme de närmaste `hours` timmarna.
    Timmarna returneras som (lokal tid som text, tid i UTC, molntäcke)."""
    params = {
        "latitude": lat,
        "longitude": lon,
        "current": "cloud_cover",
        "hourly": "cloud_cover",
        "forecast_hours": hours,
        "timezone": "auto",
    }
    data = requests.get(METEO_URL, params=params, timeout=TIMEOUT).json()
    now = float(data["current"]["cloud_cover"])
    offset = timedelta(seconds=data.get("utc_offset_seconds", 0))
    hourly = [
        (t, datetime.fromisoformat(t).replace(tzinfo=timezone.utc) - offset, float(c))
        for t, c in zip(data["hourly"]["time"], data["hourly"]["cloud_cover"])
    ]
    return now, hourly


# Geomagnetisk nordpol (IGRF, ca 2025). Räcker för en dipolapproximation.
GEOMAG_POLE_LAT, GEOMAG_POLE_LON = 80.85, -72.6


def geomagnetic_latitude(lat, lon):
    """Geomagnetisk latitud i grader (dipolmodell)."""
    phi, lam = math.radians(lat), math.radians(lon)
    pphi, plam = math.radians(GEOMAG_POLE_LAT), math.radians(GEOMAG_POLE_LON)
    return math.degrees(math.asin(
        math.sin(phi) * math.sin(pphi)
        + math.cos(phi) * math.cos(pphi) * math.cos(lam - plam)
    ))


def aurora_from_kp(mag_lat, kp):
    """Grov norrskenssannolikhet (%) utifrån Kp och geomagnetisk latitud.

    OVATION räcker bara ca en timme framåt, så för längre prognoser används Kp.
    Norrskensovalen modelleras som en klocka kring en mittlatitud som flyttas
    söderut när Kp ökar. Konstanterna är anpassade mot OVATION på nattsidan
    2026-10-06 (Kp ca 1.7: topp ca 22 % vid magn. lat 66-67, halva vid ca 61,
    under 5 % söder om 58).
    Värden vid höga Kp är extrapolerade och okalibrerade."""
    mag_lat = abs(mag_lat)  # samma modell för södra halvklotet
    center = 70.0 - 2.0 * kp
    width = 4.2 + 0.4 * kp
    peak = min(90.0, 8.0 + 8.0 * kp)
    return peak * math.exp(-0.5 * ((mag_lat - center) / width) ** 2)


def sun_elevation(lat, lon, when=None):
    """Solens höjd över horisonten i grader (negativt = under horisonten)."""
    when = when or datetime.now(timezone.utc)
    j2000 = datetime(2000, 1, 1, 12, tzinfo=timezone.utc)
    n = (when - j2000).total_seconds() / 86400.0

    mean_lon = math.radians((280.460 + 0.9856474 * n) % 360)
    g = math.radians((357.528 + 0.9856003 * n) % 360)
    ecl_lon = mean_lon + math.radians(1.915 * math.sin(g) + 0.020 * math.sin(2 * g))
    eps = math.radians(23.439 - 0.0000004 * n)

    decl = math.asin(math.sin(eps) * math.sin(ecl_lon))
    ra = math.atan2(math.cos(eps) * math.sin(ecl_lon), math.cos(ecl_lon))

    gmst_deg = ((18.697374558 + 24.06570982441908 * n) % 24) * 15
    hour_angle = math.radians(gmst_deg + lon) - ra

    phi = math.radians(lat)
    elev = math.asin(
        math.sin(phi) * math.sin(decl)
        + math.cos(phi) * math.cos(decl) * math.cos(hour_angle)
    )
    return math.degrees(elev)


def darkness_label(elev):
    if elev < -10:
        return "mörkt", 1.0
    if elev < -6:
        return "skymning/gryning", 0.5
    return "för ljust", 0.0


def chance_score(aurora, clouds, dark_factor):
    return aurora * (1 - clouds / 100) * dark_factor


def verdict(aurora, clouds, dark_factor):
    if dark_factor == 0:
        return "Ingen chans just nu (för ljust)"
    score = chance_score(aurora, clouds, dark_factor)
    if score >= 30:
        return "God chans"
    if score >= 10:
        return "Viss chans"
    if score >= 2:
        return "Liten chans"
    return "Mycket liten chans"


def hourly_forecast(lat, lon, hourly_clouds, kp_blocks, aurora_now):
    """Bedömning per timme. Norrskenssannolikheten kommer från Kp-modellen,
    justerad mot OVATION nu (faktorn klingar av till 1 under 6 timmar) så att
    de närmaste timmarna hänger ihop med nulägesbedömningen."""
    mag_lat = geomagnetic_latitude(lat, lon)
    now = datetime.now(timezone.utc)
    kp_now = kp_at(kp_blocks, now)
    ratio = 1.0
    if kp_now is not None:
        modelled_now = aurora_from_kp(mag_lat, kp_now)
        if modelled_now >= 1:
            ratio = min(2.0, max(0.5, aurora_now / modelled_now))

    rows = []
    for local_text, when, clouds in hourly_clouds:
        kp = kp_at(kp_blocks, when)
        if kp is None:
            continue
        hours_ahead = max(0.0, (when - now).total_seconds() / 3600)
        weight = max(0.0, 1 - hours_ahead / 6)
        aurora = aurora_from_kp(mag_lat, kp) * (1 + (ratio - 1) * weight)
        elev = sun_elevation(lat, lon, when)
        _, dark_factor = darkness_label(elev)
        text = verdict(aurora, clouds, dark_factor) if dark_factor else "För ljust"
        rows.append((local_text, kp, aurora, clouds, elev, text))
    return rows


def main():
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")  # å/ä/ö även i Windows/Git Bash

    parser = argparse.ArgumentParser(
        description="Norrskenschans för en given position.")
    parser.add_argument("lat", type=float, help="latitud, t.ex. 65.58")
    parser.add_argument("lon", type=float, help="longitud, t.ex. 22.15")
    parser.add_argument("--24h", dest="day", action="store_true",
                        help="visa även bedömning timme för timme 24 h framåt")
    args = parser.parse_args()
    lat, lon = args.lat, args.lon
    if not (-90 <= lat <= 90 and -180 <= lon <= 360):
        sys.exit("Ogiltig position")

    try:
        aurora, forecast_time = aurora_probability(lat, lon)
        clouds_now, hourly = cloud_cover(lat, lon, 25 if args.day else 6)
        kp_blocks = kp_forecast() if args.day else None
    except requests.RequestException as e:
        sys.exit(f"Kunde inte hämta data: {e}")
    kp = latest_kp()

    elev = sun_elevation(lat, lon)
    dark_text, dark_factor = darkness_label(elev)

    print(f"Position: {lat:.2f}, {lon:.2f}")
    print(f"Chans:    {verdict(aurora, clouds_now, dark_factor)}")
    print()
    print(f"Norrsken (OVATION): {aurora:.0f} %   (prognos för {forecast_time})")
    print(f"Kp-index:           {kp if kp is not None else 'okänt'}")
    print(f"Molntäcke nu:       {clouds_now:.0f} %")
    print(f"Ljus:               {dark_text} (solen {elev:.1f}° över horisonten)")
    print()
    if not args.day:
        print("Moln kommande timmar:")
        for t, _, c in hourly:
            print(f"  {t[11:16]}  {c:.0f} %")
        return

    print("Kommande 24 timmar (lokal tid):")
    print("  Tid    Kp   Norrsken  Moln   Sol   Bedömning")
    for t, kp_h, a, c, e, v in hourly_forecast(lat, lon, hourly, kp_blocks, aurora):
        print(f"  {t[11:16]}  {kp_h:3.1f}  {a:5.0f} %  {c:4.0f} %  {e:4.0f}°  {v}")
    print()
    print("Norrsken längre fram än ca en timme bygger på NOAA:s Kp-prognos och en")
    print("grov modell, inte på OVATION. Ta det som en fingervisning.")


if __name__ == "__main__":
    main()
