# Adventní okénka v Bohuticích

Statický web pro adventní hru: od 1. do 24. prosince se každý večer v Bohuticích rozsvítí jedno nazdobené okno a na webu se v 17:00 odemkne nápověda, kde ho hledat.

Čisté HTML + CSS + JS, bez buildu. Hostováno na GitHub Pages (větev `main`, kořen repozitáře).

## Úprava obsahu

Vše podstatné je v [`okenka.json`](okenka.json):

| Pole | Význam |
|---|---|
| `rok` | rok konání (okénka se odemykají v prosinci tohoto roku) |
| `hodinaOdemceni` | hodina (pražský čas), kdy se odemkne okénko daného dne |
| `sviti` | text „svítí 17:00–20:00“ v detailu okénka |
| `okenka[].napoveda` | text nápovědy pro daný den |

Po pushnutí do `main` se web do minuty aktualizuje.

> Nápovědy jsou ve zdrojovém kódu veřejné – zamykání je jen v JavaScriptu.

## Testování

Lokálně (kvůli `fetch` je potřeba server, ne `file://`):

```sh
python3 -m http.server 8000
# http://localhost:8000
```

Simulace data přes URL parametry:

- `?den=8` – 8. prosince po 17:00 (okénka 1–8 otevřená)
- `?den=8&hodina=10` – 8. prosince dopoledne (dnešní okénko ještě zamčené)
- `?den=25` – po adventu, vše otevřené

## Struktura

```
index.html      stránka
style.css       vzhled
app.js          logika odemykání a modal s animací
okenka.json     obsah – nápovědy
assets/         znak obce, logo SDH
```
