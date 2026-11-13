// Adventní okénka Bohutice
//
// Dva režimy podle `rezim` v okenka.json:
//   „prihlasovani“ – okénka slouží k rezervaci dnů (stav drží Google Tabulka přes Apps Script)
//   „napovedy“     – okénko N se odemkne N. prosince v `hodinaOdemceni` (pražského času)
//
// Pro testování lze v URL přepsat:
//   ?rezim=napovedy           režim bez úpravy okenka.json
//   ?den=8&hodina=18          datum v režimu nápověd

const parametry = new URLSearchParams(location.search);
const datumText = (den) => `${den}. prosince`;

// ---------- Režim nápověd ----------

function prazskyCas() {
  const casti = new Intl.DateTimeFormat('cs-CZ', {
    timeZone: 'Europe/Prague',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    hourCycle: 'h23',
  }).formatToParts(new Date());
  const hodnota = (typ) => Number(casti.find((c) => c.type === typ).value);
  return { rok: hodnota('year'), mesic: hodnota('month'), den: hodnota('day'), hodina: hodnota('hour') };
}

function aktualniStav(config) {
  const cas = prazskyCas();

  if (parametry.has('den')) {
    cas.rok = config.rok;
    cas.mesic = 12;
    cas.den = Number(parametry.get('den'));
    cas.hodina = parametry.has('hodina') ? Number(parametry.get('hodina')) : 18;
  }

  const poOdemceni = cas.hodina >= config.hodinaOdemceni;

  // Před adventem: vše zamčené. Po 24. 12. (nebo v dalším roce): vše otevřené.
  if (cas.rok < config.rok || (cas.rok === config.rok && cas.mesic < 12)) {
    return { otevrenoDo: 0, dnes: null, faze: 'pred' };
  }
  if (cas.rok > config.rok || cas.den > 24) {
    return { otevrenoDo: 24, dnes: null, faze: 'po' };
  }
  return {
    otevrenoDo: poOdemceni ? cas.den : cas.den - 1,
    dnes: cas.den,
    poOdemceni,
    faze: 'probiha',
  };
}

function textStavu(stav, config) {
  if (stav.faze === 'pred') return `Začínáme 1. prosince v ${config.hodinaOdemceni}:00. Už se těšíme!`;
  if (stav.faze === 'po') return 'Letošní advent skončil – děkujeme všem, kdo zdobili i hledali!';
  if (stav.poOdemceni) return `Dnes je ${datumText(stav.dnes)} · klikni na rozsvícené okno a otevři ho`;
  return `Dnes je ${datumText(stav.dnes)} · dnešní okénko se odemkne v ${config.hodinaOdemceni}:00`;
}

function vytvorOkno(n) {
  const bunka = document.createElement('div');
  bunka.className = 'okno-bunka';

  const tlacitko = document.createElement('button');
  tlacitko.type = 'button';
  tlacitko.className = 'okno';
  tlacitko.innerHTML = `<span class="okno-cislo">${n}</span>`;

  const datum = document.createElement('span');
  datum.className = 'okno-datum';

  bunka.append(tlacitko, datum);
  return { bunka, tlacitko, datum };
}

function vykresliNapovedy(config, stav, modal) {
  const kontejner = document.getElementById('okna');
  kontejner.replaceChildren();

  for (const okenko of config.okenka) {
    const n = okenko.den;
    const otevrene = n <= stav.otevrenoDo;
    const jeDnes = n === stav.dnes;
    const { bunka, tlacitko, datum } = vytvorOkno(n);
    datum.textContent = `${n}. 12.`;

    if (otevrene) {
      tlacitko.classList.add(jeDnes ? 'dnes' : 'otevrene');
      tlacitko.setAttribute('aria-haspopup', 'dialog');
      tlacitko.setAttribute('aria-label', `Otevřít okénko ${n}`);
      tlacitko.addEventListener('click', () => modal.ukazNapovedu(okenko));
      if (jeDnes) tlacitko.insertAdjacentHTML('beforeend', '<span class="okno-stitek">Dnes</span>');
    } else {
      tlacitko.disabled = true;
      tlacitko.setAttribute('aria-label', `Okénko ${n}, otevře se ${datumText(n)} v ${config.hodinaOdemceni}:00`);
      if (jeDnes) {
        tlacitko.classList.add('dnes-ceka');
        tlacitko.insertAdjacentHTML('beforeend', `<span class="okno-stitek">Od ${config.hodinaOdemceni}:00</span>`);
      }
    }

    kontejner.append(bunka);
  }
}

function spustNapovedy(config, modal) {
  const stavEl = document.getElementById('stav');
  const obnov = () => {
    const stav = aktualniStav(config);
    stavEl.textContent = textStavu(stav, config);
    vykresliNapovedy(config, stav, modal);
    return stav;
  };
  let stav = obnov();

  // Když stránka zůstane otevřená přes 17:00, okénko se odemkne samo
  setInterval(() => {
    const novy = aktualniStav(config);
    if (novy.otevrenoDo !== stav.otevrenoDo || novy.dnes !== stav.dnes) stav = obnov();
  }, 60 * 1000);

  document.getElementById('otevrit-dnesni').addEventListener('click', () => {
    const posledni = config.okenka.find((o) => o.den === stav.otevrenoDo);
    if (posledni) modal.ukazNapovedu(posledni);
    else document.getElementById('okenka').scrollIntoView({ behavior: 'smooth' });
  });
}

// ---------- Režim přihlašování ----------

// Komunikace s Apps Scriptem. Bez `apiUrl` běží simulace v localStorage (jen pro vývoj).
function vytvorApi(apiUrl, predem) {
  if (apiUrl) {
    return {
      async stavy() {
        if (predem) {
          const vysledek = predem;
          predem = null;
          return vysledek;
        }
        const odpoved = await fetch(apiUrl);
        return odpoved.json();
      },
      async zamluvit(data) {
        // text/plain = „jednoduchý“ požadavek bez CORS preflightu, který Apps Script neumí
        const odpoved = await fetch(apiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify(data),
        });
        return odpoved.json();
      },
    };
  }

  const pruh = document.createElement('div');
  pruh.className = 'testovaci-pruh';
  pruh.textContent = 'Testovací režim – rezervace se ukládají jen v tomto prohlížeči';
  document.body.append(pruh);

  const KLIC = 'okenka-simulace';
  const nacti = () => {
    try {
      return JSON.parse(localStorage.getItem(KLIC)) || { obsazene: [3, 7, 12], uzamcene: [24] };
    } catch (_) {
      return { obsazene: [3, 7, 12], uzamcene: [24] };
    }
  };
  const pockej = () => new Promise((r) => setTimeout(r, 700));

  return {
    async stavy() {
      await pockej();
      return nacti();
    },
    async zamluvit(data) {
      await pockej();
      const stav = nacti();
      if (stav.obsazene.includes(data.den) || stav.uzamcene.includes(data.den)) {
        return { ok: false, chyba: 'obsazeno', ...stav };
      }
      stav.obsazene.push(data.den);
      try {
        localStorage.setItem(KLIC, JSON.stringify(stav));
      } catch (_) {}
      console.info('Simulovaná rezervace', data);
      return { ok: true, ...stav };
    },
  };
}

function denVTydnu(config, n, format = 'short') {
  return new Date(config.rok, 11, n).toLocaleDateString('cs-CZ', { weekday: format });
}

function terminNapovedy(config, n) {
  return new Date(config.rok, 11, n - config.napovedaDniPredem).toLocaleDateString('cs-CZ', {
    day: 'numeric',
    month: 'long',
  });
}

function vykresliPrihlasovani(config, stavy, modal) {
  const kontejner = document.getElementById('okna');
  kontejner.replaceChildren();
  const zamek =
    '<svg aria-hidden="true" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>';

  for (let n = 1; n <= 24; n++) {
    const { bunka, tlacitko, datum } = vytvorOkno(n);
    datum.textContent = `${denVTydnu(config, n)} ${n}. 12.`;

    if (!stavy) {
      tlacitko.disabled = true;
      tlacitko.classList.add('nacita');
      tlacitko.setAttribute('aria-label', `Okénko ${n} – načítám`);
      tlacitko.style.setProperty('--i', n);
      tlacitko.insertAdjacentHTML('beforeend', '<span class="okno-trpyt" aria-hidden="true"></span><span class="okno-stitek">Načítám</span>');
    } else if (stavy.uzamcene.includes(n)) {
      tlacitko.disabled = true;
      tlacitko.classList.add('uzamcene');
      tlacitko.setAttribute('aria-label', `Okénko ${n} – uzamčeno`);
      tlacitko.insertAdjacentHTML('beforeend', `<span class="okno-stitek">${zamek}Uzamčeno</span>`);
    } else if (stavy.obsazene.includes(n)) {
      tlacitko.disabled = true;
      tlacitko.classList.add('obsazene');
      tlacitko.setAttribute('aria-label', `Okénko ${n} – obsazeno`);
      tlacitko.insertAdjacentHTML('beforeend', '<span class="okno-stitek">Obsazeno</span>');
    } else {
      tlacitko.classList.add('volne');
      tlacitko.setAttribute('aria-haspopup', 'dialog');
      tlacitko.setAttribute('aria-label', `Zamluvit okénko ${n}`);
      tlacitko.insertAdjacentHTML('beforeend', '<span class="okno-stitek">Volné</span>');
      tlacitko.addEventListener('click', () => modal.ukazFormular(n));
    }

    kontejner.append(bunka);
  }
}

// Poslední známý stav obsazenosti – při další návštěvě se okénka zobrazí hned
const KLIC_STAVY = 'okenka-stavy';

function nactiUlozeneStavy(apiUrl) {
  try {
    const ulozene = JSON.parse(localStorage.getItem(KLIC_STAVY));
    return ulozene && ulozene.apiUrl === apiUrl ? ulozene : null;
  } catch (_) {
    return null;
  }
}

function ulozStavy(apiUrl, stavy) {
  try {
    localStorage.setItem(KLIC_STAVY, JSON.stringify({ apiUrl, obsazene: stavy.obsazene, uzamcene: stavy.uzamcene }));
  } catch (_) {}
}

function spustPrihlasovani(config, modal, predem) {
  const api = vytvorApi(config.apiUrl, predem);
  const stavEl = document.getElementById('stav');
  const spinner = '<span class="spinner" aria-hidden="true"></span>';

  const zobraz = (stavy) => {
    const volnych = 24 - stavy.obsazene.length - stavy.uzamcene.length;
    stavEl.textContent = volnych > 0
      ? `Volných okének: ${volnych} z 24 · klikni na volné okénko a zamluv si ho`
      : 'Všechna okénka jsou obsazená – děkujeme!';
    vykresliPrihlasovani(config, stavy, modal);
    if (config.apiUrl) ulozStavy(config.apiUrl, stavy);
  };

  const ulozene = config.apiUrl ? nactiUlozeneStavy(config.apiUrl) : null;
  if (ulozene) {
    vykresliPrihlasovani(config, ulozene, modal);
    stavEl.innerHTML = `${spinner}Ověřuji aktuální obsazenost…`;
  } else {
    vykresliPrihlasovani(config, null, modal);
    stavEl.innerHTML = `${spinner}Načítám volná okénka…`;
  }

  (async () => {
    try {
      zobraz(await api.stavy());
    } catch (chyba) {
      console.error(chyba);
      stavEl.textContent = ulozene
        ? 'Aktuální obsazenost se nepodařilo ověřit – zobrazený stav nemusí být úplně aktuální.'
        : 'Obsazenost se nepodařilo načíst. Zkuste stránku obnovit.';
    }
  })();

  modal.priOdeslani(async (data) => {
    let vysledek;
    try {
      vysledek = await api.zamluvit(data);
    } catch (chyba) {
      console.error(chyba);
      return { ok: false, chyba: 'sit' };
    }
    if (vysledek.obsazene) zobraz(vysledek);
    return vysledek;
  });
}

// ---------- Modal ----------

function pripravModal(config) {
  const modal = document.getElementById('modal');
  const karta = modal.querySelector('.m-karta');
  const formular = document.getElementById('formular');
  const chybaEl = document.getElementById('formular-chyba');
  const odeslatEl = document.getElementById('formular-odeslat');
  let aktualniDen = null;
  let odeslat = null;

  modal.querySelectorAll('[data-zavrit]').forEach((b) => b.addEventListener('click', () => modal.close()));
  // Kliknutí mimo kartu (na pozadí) modal zavře
  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.close();
  });

  const ukazSekci = (nazev) => {
    for (const sekce of modal.querySelectorAll('[data-sekce]')) {
      const aktivni = sekce.dataset.sekce === nazev;
      sekce.classList.toggle('aktivni', aktivni);
      if (aktivni) modal.setAttribute('aria-labelledby', sekce.querySelector('[data-nadpis]').id);
    }
    karta.classList.toggle('formularovy', nazev !== 'napoveda');
  };

  const otevri = (n, datum) => {
    document.getElementById('modal-cislo').textContent = n;
    document.getElementById('modal-datum').textContent = datum;
    // Restart animace otevírání
    modal.classList.remove('otevira');
    void modal.offsetWidth;
    modal.classList.add('otevira');
    modal.showModal();
  };

  const ukazChybu = (text) => {
    chybaEl.textContent = text;
    chybaEl.hidden = !text;
  };

  formular.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!odeslat || odeslatEl.disabled) return;

    const pole = new FormData(formular);
    const data = { den: aktualniDen };
    for (const nazev of ['email', 'telefon', 'cp', 'napoveda']) data[nazev] = String(pole.get(nazev) || '').trim();

    ukazChybu('');
    odeslatEl.disabled = true;
    odeslatEl.textContent = 'Ukládám…';
    const vysledek = await odeslat(data);
    odeslatEl.textContent = 'Zamluvit okénko';

    if (vysledek.ok) {
      const zamluveno = `Okénko č. ${aktualniDen} (${denVTydnu(config, aktualniDen, 'long')} ${datumText(aktualniDen)}) je zamluvené na ${data.email}. Okno poprvé rozsviťte v ${config.hodinaOdemceni}:00 a pak ho nechte svítit každý večer až do 24. prosince.`;
      document.getElementById('hotovo-text').textContent = data.napoveda
        ? `${zamluveno} Nápovědu máme. Děkujeme a těšíme se na vaše okno!`
        : `${zamluveno} Nezapomeňte poslat nápovědu nejpozději ${terminNapovedy(config, aktualniDen)} na ${config.kontaktEmail}.`;
      formular.reset();
      odeslatEl.disabled = false;
      ukazSekci('hotovo');
    } else if (vysledek.chyba === 'obsazeno') {
      ukazChybu('Tohle okénko si mezitím zamluvil někdo jiný. Zavřete prosím okno a vyberte jiný volný den.');
    } else if (vysledek.chyba === 'neplatna-data') {
      odeslatEl.disabled = false;
      ukazChybu('Zkontrolujte prosím zadaný e-mail.');
    } else {
      odeslatEl.disabled = false;
      ukazChybu('Rezervaci se nepodařilo odeslat. Zkontrolujte připojení a zkuste to znovu.');
    }
  });

  return {
    ukazNapovedu(okenko) {
      document.getElementById('modal-napoveda').textContent = `„${okenko.napoveda}“`;
      ukazSekci('napoveda');
      otevri(okenko.den, `Svítí každý večer od ${datumText(okenko.den)}`);
    },
    ukazFormular(n) {
      aktualniDen = n;
      ukazChybu('');
      odeslatEl.disabled = false;
      document.getElementById('termin-napovedy').textContent = terminNapovedy(config, n);
      ukazSekci('formular');
      otevri(n, `${denVTydnu(config, n, 'long')} ${datumText(n)} · poprvé rozsvítit v ${config.hodinaOdemceni}:00`);
    },
    priOdeslani(fn) {
      odeslat = fn;
    },
  };
}

// ---------- Start ----------

async function start() {
  let config;
  let predemStavy = null;
  try {
    ({ config, stavy: predemStavy } = await window.predNacteni);
  } catch (chyba) {
    document.getElementById('stav').textContent = 'Okénka se nepodařilo načíst. Zkuste stránku obnovit.';
    console.error(chyba);
    return;
  }

  const rezim = parametry.get('rezim') || config.rezim;
  document.body.dataset.rezim = rezim;
  for (const el of document.querySelectorAll('[data-pole]')) el.textContent = config[el.dataset.pole] ?? '';

  const modal = pripravModal(config);
  if (rezim === 'prihlasovani') spustPrihlasovani(config, modal, predemStavy);
  else spustNapovedy(config, modal);
}

start();
