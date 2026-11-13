# Adventní okénka v Bohuticích

Statický web pro adventní hru ve dvou režimech:

1. **Přihlašování** (`"rezim": "prihlasovani"`) – sousedé si v kalendáři zamlouvají dny, kdy nazdobí okno. Rezervace se ukládají do Google Tabulky přes Apps Script.
2. **Nápovědy** (`"rezim": "napovedy"`) – od 1. do 24. prosince se každý den v 17:00 odemkne okénko s nápovědou, kde hledat nazdobené okno.

Čisté HTML + CSS + JS, bez buildu. Hostováno na GitHub Pages (větev `main`, kořen repozitáře).

## Nastavení – `okenka.json`

| Pole | Význam |
|---|---|
| `rezim` | `prihlasovani` nebo `napovedy` – přepnutí = změnit a pushnout |
| `apiUrl` | URL nasazeného Apps Scriptu; prázdné = testovací simulace v prohlížeči |
| `prihlasovaniDo` | text v úvodu („Přihlašování otevřeno do …“) |
| `kontaktEmail` | kam posílat nápovědy dodatečně |
| `napovedaDniPredem` | kolik dní předem musí nápověda dorazit |
| `rok`, `hodinaOdemceni`, `sviti` | rok konání, hodina odemčení (pražský čas), text „svítí 17:00–20:00“ |
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

## Testování

```sh
python3 -m http.server 8000
# http://localhost:8000
```

- Bez `apiUrl` běží simulace rezervací v `localStorage` (červený pruh dole). Reset: v konzoli `localStorage.removeItem('okenka-simulace')`.
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
