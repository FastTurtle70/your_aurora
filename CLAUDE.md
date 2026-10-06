# Norrskensappen

Personligt projekt: en app som säger om det finns chans att se norrsken där användaren är.
Användaren (Melker) skriver på svenska; svara på svenska och håll text i appen på svenska.

## Läget just nu

- `norrsken.py` – fungerande utgångspunkt som kommandoradsskript (Python, kräver `requests`).
  Körs med `python norrsken.py LAT LON`, t.ex. `python norrsken.py 65.617 22.137` (LTU, Luleå).
- Skriptet är kört mot riktig data 2026-10-06 och fungerar (NOAA OVATION, Kp, Open-Meteo).
  I Windows-konsolen blir å/ä/ö fel i utskriften (teckenkodning), själva logiken påverkas inte.
- `--24h` ger bedömning timme för timme ett dygn framåt (se Logik). På hemsidan blir det ett tillval.
- Projektet är ett git-repo (gren `main`), ingen fjärrkälla kopplad än.
- Nästa steg: bygga en hemsida/PWA av samma logik. Se `docs/pwa-plan.md`.

## Logik

Chans = norrskenssannolikhet (OVATION) × andel klar himmel × mörkerfaktor.

- Mörkerfaktor: solen under -10° = 1.0, mellan -6° och -10° = 0.5, annars 0.
- 24 h framåt: OVATION räcker bara ca en timme, så där används NOAA:s Kp-prognos (3-timmarsblock)
  i en grov modell `aurora_from_kp`: en klocka över geomagnetisk latitud, mitt 70 - 2·Kp, bredd 4.2 + 0.4·Kp,
  topp 8 + 8·Kp %. Kalibrerad mot en enda OVATION-ögonblicksbild (Kp ca 1.7), okalibrerad vid höga Kp.
  De närmaste ca 6 timmarna justeras mot OVATION nu så att de hänger ihop med nulägesbedömningen.
- Gränser för poängen: >=30 "God chans", >=10 "Viss chans", >=2 "Liten chans", annars "Mycket liten chans".
  Gränserna är grova gissningar och ska justeras mot verkliga kvällar.

## Datakällor

Se `docs/datakallor.md`. Alla är gratis och utan API-nyckel.

## Öppna frågor (obesvarade av användaren)

1. Hosting för PWA:n: GitHub Pages (förslag), Netlify eller Cloudflare Pages?
2. Ska sidan använda webbläsarens platstjänst, eller bara manuell inmatning av koordinater?
