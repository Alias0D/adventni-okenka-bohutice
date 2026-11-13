// Adventní okénka Bohutice – backend pro rezervace okének (Google Apps Script)
//
// List „Rezervace“: řádek 1 = hlavička, řádky 2–25 = dny 1–24.
// Stav okénka určuje sloupec B (E-mail):
//   prázdný      → volné
//   „UZAMČENO“   → uzamčené (nedá se rezervovat, např. 24. 12.)
//   cokoli jiného → obsazené (i ručně vepsané jméno = předem zabukované)
//
// GET  → { obsazene: [3, 7], uzamcene: [24] }   bez osobních údajů
// POST → { den, email, telefon, cp, napoveda }  → { ok, chyba?, obsazene, uzamcene }

const LIST = 'Rezervace';
const HLAVICKA = ['Den', 'E-mail', 'Telefon', 'Číslo popisné', 'Nápověda', 'Rezervováno'];
const UZAMCENO = 'UZAMČENO';

// Spustit jednou ručně z editoru – připraví list s 24 řádky.
function pripravit() {
  const tabulka = SpreadsheetApp.getActive();
  const list = tabulka.getSheetByName(LIST) || tabulka.insertSheet(LIST);
  if (list.getLastRow() > 0) throw new Error(`List „${LIST}“ už obsahuje data.`);

  list.getRange(1, 1, 1, HLAVICKA.length).setValues([HLAVICKA]).setFontWeight('bold');
  const radky = Array.from({ length: 24 }, (_, i) => [i + 1, i === 23 ? UZAMCENO : '', '', '', '', '']);
  list.getRange(2, 1, 24, HLAVICKA.length).setValues(radky);
  // Textový formát, aby se „+420…“ nebo „=…“ neinterpretovalo jako vzorec
  list.getRange(2, 2, 24, 4).setNumberFormat('@');
  list.getRange(2, 6, 24, 1).setNumberFormat('d. m. yyyy h:mm');
  list.setFrozenRows(1);
  list.autoResizeColumns(1, HLAVICKA.length);
}

function doGet() {
  return json(stavy());
}

function doPost(e) {
  let data;
  try {
    data = JSON.parse(e.postData.contents);
  } catch (_) {
    return json({ ok: false, chyba: 'neplatna-data' });
  }

  const den = Number(data.den);
  const email = text(data.email);
  if (!(den >= 1 && den <= 24) || !/^\S+@\S+\.\S+$/.test(email)) {
    return json({ ok: false, chyba: 'neplatna-data' });
  }

  // Zámek zajistí, že dvě současné rezervace stejného dne neprojdou obě
  const zamek = LockService.getScriptLock();
  zamek.waitLock(15000);
  try {
    const radek = list().getRange(den + 1, 2, 1, 5);
    if (text(radek.getValues()[0][0])) {
      return json({ ok: false, chyba: 'obsazeno', ...stavy() });
    }
    radek.setValues([[email, text(data.telefon), text(data.cp), text(data.napoveda, 1000), new Date()]]);
    SpreadsheetApp.flush();
    return json({ ok: true, ...stavy() });
  } finally {
    zamek.releaseLock();
  }
}

function stavy() {
  const obsazene = [];
  const uzamcene = [];
  for (const [den, email] of list().getRange(2, 1, 24, 2).getValues()) {
    const hodnota = text(email);
    if (!hodnota) continue;
    (hodnota.toUpperCase() === UZAMCENO ? uzamcene : obsazene).push(Number(den));
  }
  return { obsazene, uzamcene };
}

function list() {
  return SpreadsheetApp.getActive().getSheetByName(LIST);
}

function text(hodnota, max = 200) {
  return String(hodnota ?? '').trim().slice(0, max);
}

function json(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}
