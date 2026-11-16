# Adventní okénka v Bohuticích

Statický web pro adventní hru ve dvou režimech:

1. **Přihlašování** (`"rezim": "prihlasovani"`) – sousedé si v kalendáři zamlouvají dny, kdy nazdobí okno. Rezervace se ukládají do Google Tabulky přes Apps Script.
2. **Nápovědy** (`"rezim": "napovedy"`) – od 1. do 24. prosince se každý den v 17:00 odemkne okénko s nápovědou, kde hledat nazdobené okno.

Princip svícení: okno se ve svůj den v 17:00 poprvé rozsvítí a pak svítí **každý večer až do 24. prosince** – okna tedy postupně přibývají.

Čisté HTML + CSS + JS, bez buildu. Hostováno na GitHub Pages (větev `main`, kořen repozitáře) na doméně **https://okenka-bohutice.site** (soubor `CNAME`, DNS u Wedosu: 4× A + 4× AAAA na GitHub Pages, `www` CNAME na `alias0d.github.io`).

## Nastavení – `okenka.json`

| Pole | Význam |
|---|---|
| `rezim` | `prihlasovani` nebo `napovedy` – přepnutí = změnit a pushnout |
| `prihlasovaniOd` | pražský čas spuštění přihlašování, např. `2026-11-17T10:00`. Do té doby jsou okénka zavřená se štítkem „Brzy“, bez statistik a bez volání tabulky; otevřené stránky se v ten čas odemknou samy. Prázdné/chybějící = spuštěno hned. Test: `?spusteno=ano` / `?spusteno=ne` |
| `apiUrl` | URL nasazeného Apps Scriptu; prázdné = testovací simulace v prohlížeči |
| `prihlasovaniDo` | text v úvodu („Přihlašování otevřeno do …“) |
| `kontaktEmail` | kam posílat nápovědy dodatečně |
| `napovedaDniPredem` | kolik dní předem musí nápověda dorazit |
| `rok`, `hodinaOdemceni` | rok konání; hodina (pražský čas), kdy se okno poprvé rozsvítí a na webu odemkne nápověda |
| `okenka[].napoveda` | nápovědy pro režim nápověd – sem je zkopírujte z tabulky |

## Google Tabulka a Apps Script (jednorázově)

1. Na [sheets.new](https://sheets.new) vytvořte novou tabulku, např. „Adventní okénka – rezervace“.
2. **Rozšíření → Apps Script**. Smažte obsah `Kód.gs` a vložte celý [`apps-script/Code.gs`](apps-script/Code.gs). Uložte.
3. V horní liště vyberte funkci **`pripravit`** a klikněte **Spustit**. Google požádá o oprávnění (Pokročilé → Přejít na projekt → Povolit). Vznikne list **Rezervace** s 24 řádky, den 24 je předvyplněný jako `UZAMČENO`.
4. **Nasadit → Nové nasazení → typ Webová aplikace**:
   - *Spustit jako:* **Já**
   - *Kdo má přístup:* **Kdokoli**
5. Zkopírujte **URL webové aplikace** (končí `/exec`) do `apiUrl` v `okenka.json`.

Kontrola: otevřete URL v prohlížeči – musí vrátit např. `{"obsazene":[],"uzamcene":[24]}`.

> Po úpravě `Code.gs` je potřeba **Nasadit → Spravovat nasazení → upravit → Nová verze**, jinak běží stará verze (URL zůstává stejná).

### Správa v tabulce

Stav okénka určuje sloupec **E-mail**:

| Hodnota | Stav na webu |
|---|---|
| prázdná | volné |
| `UZAMČENO` | uzamčené (nedá se rezervovat) |
| cokoli jiného (e-mail, jméno…) | obsazené – takto jde den i předem zabukovat ručně |

Zrušení rezervace = smazat buňky v řádku. Do tabulky se nikdy nedostane nikdo jiný než vlastník (a lidé, se kterými ji sdílíte); web vidí jen čísla obsazených dnů.

Upozornění na nové rezervace: v tabulce **Nástroje → Pravidla oznámení → Při provedení změn**.

## Přepnutí do režimu nápověd

1. Zkopírujte nápovědy z tabulky do `okenka[].napoveda` v `okenka.json`.
2. Nastavte `"rezim": "napovedy"` a pushněte.
3. Nápovědy, které dorazí později, doplňte stejně (úprava `okenka.json` + push).

## Nasazení změn

V `index.html` mají `style.css` a `app.js` parametr `?v=…`. **Při každé změně těchto souborů ho zvyšte** (např. na aktuální datum a čas `202611151230`), jinak mohou prohlížeče až 10 minut používat starou kopii z cache a kombinovat ji s novým HTML.

## Testování

```sh
python3 -m http.server 8000
# http://localhost:8000
```

- Bez `apiUrl` běží simulace rezervací v `localStorage` (červený pruh dole). Reset: v konzoli `localStorage.removeItem('okenka-simulace')`.
- Web si pamatuje poslední stav obsazenosti (`localStorage` klíč `okenka-stavy`) a při další návštěvě ho ukáže hned, než dorazí čerstvá data z tabulky. Skeleton načítání uvidíte po `localStorage.removeItem('okenka-stavy')`.
- `?rezim=napovedy` – vyzkoušet druhý režim bez úpravy configu
- `?rezim=napovedy&den=8` – 8. prosince po 17:00; `&hodina=10` – dopoledne; `?den=25` – po adventu

## Struktura

```
index.html          stránka (obsah obou režimů)
style.css           vzhled
app.js              logika režimů, rezervace, modal s animací
okenka.json         nastavení a nápovědy
apps-script/Code.gs backend pro rezervace (vkládá se do Google Apps Scriptu)
assets/             znak obce, logo SDH
```
