# Norrskensappen

Personligt projekt: en app som säger om det finns chans att se norrsken där användaren är.
Användaren (Melker) skriver på svenska; svara på svenska och håll text i appen på svenska.

## Läget just nu

- `norrsken.py` – fungerande utgångspunkt som kommandoradsskript (Python, kräver `requests`).
  Körs med `python norrsken.py LAT LON`, t.ex. `python norrsken.py 65.617 22.137` (LTU, Luleå).
- Skriptet är kört mot riktig data 2026-10-06 och fungerar (NOAA OVATION, Kp, Open-Meteo).
  I Windows-konsolen blir å/ä/ö fel i utskriften (teckenkodning), själva logiken påverkas inte.
- `--24h` ger bedömning timme för timme ett dygn framåt (se Logik). På hemsidan blir det ett tillval.
- Git-repo, gren `main`, origin = GitHub (se Hosting nedan). Inga betaltjänster på GitHub.
- PWA:n är byggd (2026-10-06): `index.html`, `style.css`, `app.js` (logiken portad från `norrsken.py`, håll dem i synk),
  `sw.js`, `manifest.webmanifest`, `icons/`. Testad lokalt i Edge, JS ger samma siffror som Python-skriptet.
  Plats: knapp för platstjänst + sök på ort (Open-Meteo geocoding) eller koordinater. 24 h är en kryssruta.
- Sidor: `om-norrsken.html` (guide, innehåll för AdSense) och `integritet.html` (policy, beskriver exakt vad appen skickar/sparar – uppdatera den om det ändras, t.ex. när annonser läggs till).
- Annonser: Google AdSense planeras men kräver egen domän (köps senare). Behöver då samtyckesruta (CMP) och uppdaterad policy.
- Hosting: GitHub Pages, repo https://github.com/FastTurtle70/your_aurora (publikt, gratis), adress https://fastturtle70.github.io/your_aurora/. Ändrar man filerna i appen: höj `VERSION` i `sw.js`.

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

## Beslut

- Hosting: GitHub Pages. Plats: både platstjänst och manuell inmatning.
