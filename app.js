// Adventní okénka Bohutice
// Okénko N se odemkne N. prosince v `hodinaOdemceni` (pražského času).
// Pro testování lze datum přepsat v URL: ?den=8&hodina=18

const datumText = (den) => `${den}. prosince`;

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
  const parametry = new URLSearchParams(location.search);
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

function vykresliOkna(config, stav, otevri) {
  const kontejner = document.getElementById('okna');
  kontejner.replaceChildren();

  for (const okenko of config.okenka) {
    const n = okenko.den;
    const otevrene = n <= stav.otevrenoDo;
    const jeDnes = n === stav.dnes;

    const bunka = document.createElement('div');
    bunka.className = 'okno-bunka';

    const tlacitko = document.createElement('button');
    tlacitko.type = 'button';
    tlacitko.className = 'okno';
    tlacitko.innerHTML = `<span class="okno-cislo">${n}</span>`;

    if (otevrene) {
      tlacitko.classList.add(jeDnes ? 'dnes' : 'otevrene');
      tlacitko.setAttribute('aria-haspopup', 'dialog');
      tlacitko.setAttribute('aria-label', `Otevřít okénko ${n}`);
      tlacitko.addEventListener('click', () => otevri(okenko));
      if (jeDnes) tlacitko.insertAdjacentHTML('beforeend', '<span class="okno-stitek">Dnes</span>');
    } else {
      tlacitko.disabled = true;
      tlacitko.setAttribute('aria-label', `Okénko ${n}, otevře se ${datumText(n)} v ${config.hodinaOdemceni}:00`);
      if (jeDnes) {
        tlacitko.classList.add('dnes-ceka');
        tlacitko.insertAdjacentHTML('beforeend', `<span class="okno-stitek">Od ${config.hodinaOdemceni}:00</span>`);
      }
    }

    const datum = document.createElement('span');
    datum.className = 'okno-datum';
    datum.textContent = `${n}. 12.`;

    bunka.append(tlacitko, datum);
    kontejner.append(bunka);
  }
}

function pripravModal(config) {
  const modal = document.getElementById('modal');

  modal.querySelectorAll('[data-zavrit]').forEach((b) => b.addEventListener('click', () => modal.close()));
  // Kliknutí mimo kartu (na pozadí) modal zavře
  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.close();
  });

  return (okenko) => {
    document.getElementById('modal-cislo').textContent = okenko.den;
    document.getElementById('modal-datum').textContent = `${datumText(okenko.den)} · svítí ${config.sviti}`;
    document.getElementById('modal-napoveda').textContent = `„${okenko.napoveda}“`;

    // Restart animace otevírání
    modal.classList.remove('otevira');
    void modal.offsetWidth;
    modal.classList.add('otevira');
    modal.showModal();
  };
}

async function start() {
  const stavEl = document.getElementById('stav');
  let config;
  try {
    const odpoved = await fetch('okenka.json', { cache: 'no-cache' });
    config = await odpoved.json();
  } catch (chyba) {
    stavEl.textContent = 'Okénka se nepodařilo načíst. Zkuste stránku obnovit.';
    console.error(chyba);
    return;
  }

  document.getElementById('rok').textContent = config.rok;
  const otevri = pripravModal(config);

  const obnov = () => {
    const stav = aktualniStav(config);
    stavEl.textContent = textStavu(stav, config);
    vykresliOkna(config, stav, otevri);
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
    if (posledni) otevri(posledni);
    else document.getElementById('okenka').scrollIntoView({ behavior: 'smooth' });
  });
}

start();
