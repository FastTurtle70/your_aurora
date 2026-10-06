# Norrsken

Säger om det finns chans att se norrsken på en given plats, utifrån norrskensaktivitet, moln och mörker.

## Köra skriptet

1. Installera Python 3 (python.org).
2. `python -m pip install -r requirements.txt`
3. `python norrsken.py 65.617 22.137` (latitud longitud, här LTU i Luleå)
4. Lägg till `--24h` för en bedömning timme för timme ett dygn framåt.

På Mac/Linux: `python3` i stället för `python`.

## Hemsidan / appen (PWA)

`index.html`, `style.css`, `app.js`, `sw.js`, `manifest.webmanifest` och `icons/` är en statisk sida
med samma logik som skriptet. Den hämtar data direkt från NOAA och Open-Meteo, så ingen server behövs.

Testa lokalt: `python -m http.server 8000` i mappen och öppna http://localhost:8000.
Publiceras med GitHub Pages (Settings → Pages → Deploy from branch → `main` / root).
På telefonen: öppna sidan och välj "Lägg till på hemskärmen".

## Mappen

- `norrsken.py` – skriptet
- `CLAUDE.md` – projektkontext för Claude Code
- `docs/datakallor.md` – var datan kommer ifrån
- `docs/pwa-plan.md` – plan för hemsida/telefonapp
