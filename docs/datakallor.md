# Datakällor

Adresserna är inte verifierade mot live-tjänsterna; kontrollera mot respektive dokumentation.

## Norrskensaktivitet – NOAA SWPC (ingen API-nyckel)

- OVATION-modellen: `https://services.swpc.noaa.gov/json/ovation_aurora_latest.json`
  Sannolikhet för norrsken per lat/long, ca 30–90 min framåt.
  Rutnät på hela grader: longitud 0–359, latitud -90–90. Fältet `coordinates` är en lista av `[lon, lat, aurora]`.
- Kp-index: `https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json`
- Kp-prognos (används för `--24h`): `https://services.swpc.noaa.gov/products/noaa-planetary-k-index-forecast.json`
  Lista av `{time_tag, kp, observed}` där `observed` är observed/estimated/predicted, 3-timmarsblock i UTC, ca 3 dygn framåt.
  Det finns även 3-dygnsprognos för Kp och solvindsdata (Bz, hastighet, densitet) hos SWPC.

## Molntäcke

- Open-Meteo (används i skriptet): `https://api.open-meteo.com/v1/forecast`
  med `current=cloud_cover&hourly=cloud_cover`. Enklast att komma igång med.
- Alternativ: SMHI:s öppna API för punktprognoser, MET Norway (api.met.no).

## Mörker

Räknas ut lokalt från solens höjd under horisonten (egen formel i skriptet).
Bibliotek som alternativ: SunCalc (JavaScript), Astral (Python). Månfas kan fås på samma sätt.

## Lokal data för norra Sverige

Institutet för rymdfysik (IRF) i Kiruna har magnetometrar och allskykamera.
Mer träffsäkert än globalt Kp, men inget lika färdigt API.

## Koordinater

- LTU, campus Porsön: ca 65.617, 22.137
- Centrala Luleå: ca 65.58, 22.15
