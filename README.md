# Norrsken

Säger om det finns chans att se norrsken på en given plats, utifrån norrskensaktivitet, moln och mörker.

## Köra skriptet

1. Installera Python 3 (python.org).
2. `python -m pip install -r requirements.txt`
3. `python norrsken.py 65.617 22.137` (latitud longitud, här LTU i Luleå)
4. Lägg till `--24h` för en bedömning timme för timme ett dygn framåt.

På Mac/Linux: `python3` i stället för `python`.

## Mappen

- `norrsken.py` – skriptet
- `CLAUDE.md` – projektkontext för Claude Code
- `docs/datakallor.md` – var datan kommer ifrån
- `docs/pwa-plan.md` – plan för hemsida/telefonapp
