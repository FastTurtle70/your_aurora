# Plan: hemsida + telefonapp (PWA)

Målet: en snygg hemsida som fungerar bra på dator och som kan installeras på telefonen
som en app, där appen egentligen bara är hemsidan. Det kallas PWA (Progressive Web App):
egen ikon på hemskärmen, helskärm utan adressfält, på både iPhone och Android.

## Tänkt innehåll

- Responsiv sida: stor översikt på dator, kompakt vy i mobil, mörkt norrskenstema.
- Samma data och logik som `norrsken.py`, hämtat direkt i webbläsaren (ingen server).
  Solhöjden räknas ut i JavaScript.
- Position: webbläsarens platstjänst (användaren godkänner) plus manuell inmatning av koordinater/ort.
- Tydlig bedömning överst, sedan norrskenssannolikhet, Kp, moln per timme och när det blir mörkt.
- Tillval: "Kommande 24 timmar" timme för timme (samma logik som `--24h` i skriptet), dolt som standard.
- App-delen: `manifest.json`, ikoner, service worker så att sidan öppnas utan nät med senast hämtade data.

## Krav

Sidan måste ligga på en https-adress för att kunna installeras.
Gratis alternativ: GitHub Pages (förslag), Netlify, Cloudflare Pages.

## Att kontrollera

- ~~CORS~~ Kontrollerat 2026-10-06: NOAA (OVATION, Kp) och Open-Meteo skickar
  `Access-Control-Allow-Origin: *`, så sidan kan hämta direkt från webbläsaren.
- OVATION-filen är ca 900 kB; cacha den i service workern i stället för att hämta vid varje vy.

## Obesvarade frågor

1. Har användaren GitHub-konto, eller ska sidan ligga någon annanstans?
2. Platstjänst eller bara manuell inmatning?
