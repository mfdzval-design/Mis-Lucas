/* Mis Lucas · lector de cartolas PDF (Santander / Itaú, tarjeta y cuenta).
   Recibe las líneas de texto con posición (x a la izquierda, r a la derecha) y
   devuelve filas [fecha ISO, descripción, cargo, abono] listas para el importador. */
(function (root) {
  "use strict";
  const N = s => String(s || "").toUpperCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim();
  const AMT = /^-?\$?\s?-?\d{1,3}(\.\d{3})*(,\d{1,2})?$/;
  const DATE = /^(\d{2})\/(\d{2})(?:\/(\d{2}|\d{4}))?$/;
  const num = s => { const neg = /-/.test(s); const v = parseInt(String(s).replace(/[^\d,]/g, "").split(",")[0], 10) || 0; return neg ? -v : v; };
  const pad = n => String(n).padStart(2, "0");
  const lineText = l => l.items.map(i => i.s).join(" ");

  function periodOf(lines) {
    // último par de fechas completas en una línea con DESDE/HASTA o PERIODO FACTURADO
    let end = null, start = null;
    for (const l of lines) {
      const t = N(lineText(l));
      if (/PERIODO FACTURADO|^PERIODO|CARTOLA|FECHA ESTADO DE CUENTA|DESDE|PERIODO :/.test(t) || /\d{2}\/\d{2}\/\d{4}\s*-\s*\d{2}\/\d{2}\/\d{4}/.test(t)) {
        const ds = [...lineText(l).matchAll(/(\d{2})\/(\d{2})\/(\d{4})/g)];
        if (ds.length >= 2 && !/ANTERIOR|PROXIMO/.test(t)) { start = ds[ds.length - 2]; end = ds[ds.length - 1]; if (/FACTURADO|PERIODO/.test(t)) break; }
      }
    }
    if (!end) lines.forEach((l, i) => { if (end) return; const t = N(lineText(l)); if (/DESDE/.test(t) && /HASTA/.test(t)) for (const z of lines.slice(i, i + 3)) { const ds = [...lineText(z).matchAll(/(\d{2})\/(\d{2})\/(\d{4})/g)]; if (ds.length >= 2) { start = ds[0]; end = ds[1]; break; } } });
    const iso = m => m ? `${m[3]}-${m[2]}-${m[1]}` : null;
    return { start: iso(start), end: iso(end) };
  }

  // Bancos y emisores de Chile (el primero que aparezca con más peso gana). Se puede ampliar sin tocar el resto.
  const BANKS = [
    ["BancoEstado", /BANCOESTADO|BANCO ?DEL ?ESTADO|CUENTA ?RUT/], ["Banco de Chile", /BANCO DE CHILE|BANCOCHILE|BANCO EDWARDS|BANCO CREDICHILE/],
    ["Santander", /SANTANDER|BANEFE/], ["BCI", /\bBCI\b|BANCO DE CREDITO E INVERSIONES|MACH\b/], ["Scotiabank", /SCOTIABANK|SCOTIA\b/],
    ["Itaú", /\bITAU\b|BANCO ITAU/], ["Banco Falabella", /FALABELLA|CMR/], ["Banco Ripley", /RIPLEY/], ["Banco Security", /SECURITY/],
    ["BICE", /\bBICE\b/], ["Banco Consorcio", /CONSORCIO/], ["Banco Internacional", /BANCO INTERNACIONAL/], ["Coopeuch", /COOPEUCH/],
    ["Tenpo", /TENPO/], ["Mercado Pago", /MERCADO ?PAGO/], ["Prex", /\bPREX\b/], ["Lider BCI", /LIDER ?BCI|TARJETA LIDER/], ["Cencosud", /CENCOSUD|SCOTIABANK CENCOSUD/]
  ];
  function detect(pages) {
    const all = N(pages.flat().map(lineText).join(" "));
    const isTx = l => l.items.some(x => DATE.test(x.s)) && l.items.some(x => AMT.test(x.s.replace(/\s/g, "")) && /[.$]/.test(x.s));
    const meta = N(pages.flat().filter(l => !isTx(l)).map(lineText).join(" "));
    const head = N(pages[0].slice(0, 25).filter(l => !isTx(l)).map(lineText).join(" "));
    const card = /TARJETA DE CREDITO/.test(all) && /PERIODO FACTURADO|MONTO TOTAL FACTURADO|CUPO (TOTAL|UTILIZADO)/.test(all);
    let bank = "", best = 0;
    BANKS.forEach(([name, re]) => { const n = (meta.match(new RegExp(re.source, "g")) || []).length + (re.test(head) ? 3 : 0); if (n > best) { best = n; bank = name; } });
    if (!bank && /ESTADO DE CUENTA PERSONAL/.test(all)) bank = "Itaú";
    const wallet = ["Tenpo", "Mercado Pago", "Prex", "MACH"].includes(bank);
    const kind = card ? "tc" : wallet ? "billetera" : /CUENTA ?RUT|CUENTA VISTA|CHEQUERA ELECTRONICA/.test(all) ? "vista" : /CUENTA DE AHORRO|LIBRETA/.test(all) ? "ahorro" : /PREPAGO/.test(all) ? "prepago" : "cc";
    return { card, bank, kind, vista: kind === "vista" };
  }

  function parseCard(lines, period) {
    const rows = [];
    for (const l of lines) {
      const it = l.items;
      const di = it.findIndex((x, k) => k < 3 && x.x < 170 && DATE.test(x.s));
      if (di < 0) continue;
      const m = it[di].s.match(DATE); if (!m[3]) continue;
      const amts = it.slice(di + 1).filter(x => AMT.test(x.s.replace(/\s/g, "")) && /\$/.test(x.s));
      if (!amts.length) continue;
      const descParts = [];
      for (const x of it.slice(di + 1)) {
        if (/\$/.test(x.s) || /^\d{2}\/\d{2}$/.test(x.s) || /%$/.test(x.s) || /^(US|CL)$/.test(x.s)) break;
        if (/^[\d\s]+$/.test(x.s) || /^\d+,\d+$/.test(x.s) || /^\d{1,3}(\.\d{3})*,\d{2}$/.test(x.s)) continue;
        if (/N\/CUOTAS|PRECIO/i.test(x.s)) continue;
        descParts.push(x.s);
      }
      let desc = descParts.join(" ").replace(/\s+/g, " ").trim();
      if (!desc || /^TOTAL/i.test(desc)) continue;
      const amount = num(amts[amts.length - 1].s);
      if (!amount) continue;
      let y = m[3].length === 2 ? "20" + m[3] : m[3];
      let date = `${y}-${m[2]}-${m[1]}`;
      const cuota = it.find(x => /^\d{2}\/\d{2}$/.test(x.s) && x.x > 400);
      if (cuota && cuota.s !== "01/01") { desc += " cuota " + cuota.s; if (period.end) date = period.end; }
      rows.push(amount > 0 ? [date, desc, amount, ""] : [date, desc, "", -amount]);
    }
    return rows;
  }

  function parseAccount(pages, period) {
    const rows = [];
    const endY = period.end ? +period.end.slice(0, 4) : new Date().getFullYear();
    const endM = period.end ? +period.end.slice(5, 7) : 12;
    for (const lines of pages) {
      const pt = N(lines.map(lineText).join(" "));
      if (/ESTADO DE LINEA DE CREDITO|LIQ\. DE INTERESES/.test(pt) && !/ESTADO DE CUENTA PERSONAL/.test(pt)) continue;
      if (/MONEDA: DOLAR/.test(pt) && !/MONEDA: PESO/.test(pt)) continue;
      let cols = null, stop = false;
      lines.forEach((l, idx) => {
        if (stop) return;
        const t = N(lineText(l));
        if (/RESUMEN DE COMISIONES|RESUMEN DE MOVIMIENTOS|INFORMACION DE CUENTA|RESUMEN DE SALDOS/.test(t)) { if (cols) stop = true; return; }
        const cg = l.items.find(x => /(CARGOS?|GIROS?|DEBITOS?|EGRESOS?|RETIROS?)$/.test(N(x.s)));
        const ab = l.items.find(x => /(ABONOS?|DEPOSITOS?|INGRESOS?)$/.test(N(x.s)) || (/^CREDITOS?$/.test(N(x.s))));
        if (cg && ab) {
          const near = lines.slice(Math.max(0, idx - 3), idx + 3).flatMap(z => z.items);
          const sd = near.find(x => /^SALDO/.test(N(x.s)) && x.x > ab.x);
          const c = x => (x.x + x.r) / 2;
          const dh = near.find(x => /^(DESCRIPCION|DESCRIPCION DEL MOVIMIENTO|DETALLE|GLOSA|CONCEPTO|MOVIMIENTO|DESCRIPCION MOVIMIENTO)$/.test(N(x.s)));
          cols = { cargo: c(cg), abono: c(ab), saldo: sd ? c(sd) : Infinity, dx: dh ? dh.x - 25 : null, ax: Math.min(cg.x, ab.x) - 40 };
          return;
        }
        if (!cols) return;
        const it = l.items; const d = it[0] && it[0].s.match(DATE);
        if (!d || it[0].x > 90) return;
        const amts = it.slice(1).filter(x => AMT.test(x.s.replace(/\s/g, "")) && x.r > cols.ax);
        if (!amts.length) return;
        let cargo = 0, abono = 0;
        amts.forEach(a => {
          const cx = (a.x + a.r) / 2;
          const best = [["cargo", Math.abs(cx - cols.cargo)], ["abono", Math.abs(cx - cols.abono)], ["saldo", Math.abs(cx - cols.saldo)]].sort((p, q) => p[1] - q[1])[0][0];
          if (best === "cargo") cargo = Math.abs(num(a.s)); else if (best === "abono") abono = Math.abs(num(a.s));
        });
        if (!cargo && !abono) return;
        const desc = it.slice(1).filter(x => !amts.includes(x) && (cols.dx == null ? x.x > 110 : x.x >= cols.dx) && !/^\d{3,}$/.test(x.s) && !/^[A-Z]\.[A-Za-z]+$/.test(x.s) && x.r < cols.ax + 40)
          .map(x => x.s).join(" ").replace(/^\d{9}[\dK] /, "").replace(/\s+/g, " ").trim();
        if (/SALDO DIA|^---/i.test(desc)) return;
        let y = d[3] ? (d[3].length === 2 ? 2000 + +d[3] : +d[3]) : (+d[2] > endM ? endY - 1 : endY);
        rows.push([`${y}-${d[2]}-${d[1]}`, desc || "(sin descripción)", cargo || "", abono || ""]);
      });
    }
    return rows;
  }

  function parseLoose(lines, period, card) {
    const rows = []; let prevSaldo = null;
    const endY = period.end ? +period.end.slice(0, 4) : new Date().getFullYear(), endM = period.end ? +period.end.slice(5, 7) : 12;
    for (const l of lines) {
      const it = l.items; const di = it.findIndex((x, k) => k < 3 && DATE.test(x.s)); if (di < 0) continue;
      const d = it[di].s.match(DATE);
      const amts = it.slice(di + 1).filter(x => AMT.test(x.s.replace(/[\s+]/g, "")) && /[.,$+-]/.test(x.s));
      if (!amts.length) continue;
      const desc = it.slice(di + 1).filter(x => !amts.includes(x) && !/^\d{3,}$/.test(x.s)).map(x => x.s).join(" ").replace(/\s+/g, " ").trim();
      if (!desc || /^(SALDO|TOTAL)/i.test(desc)) continue;
      let mov = num(amts[0].s), saldo = amts.length > 1 ? num(amts[amts.length - 1].s) : null;
      let cargo;
      if (mov < 0) cargo = true; else if (saldo != null && prevSaldo != null) cargo = saldo < prevSaldo; else cargo = true;
      if (card && mov < 0) cargo = false;
      if (saldo != null) prevSaldo = saldo;
      const y = d[3] ? (d[3].length === 2 ? 2000 + +d[3] : +d[3]) : (+d[2] > endM ? endY - 1 : endY);
      const a = Math.abs(mov); if (!a) continue;
      rows.push([`${y}-${d[2]}-${d[1]}`, desc, cargo ? a : "", cargo ? "" : a]);
    }
    return rows;
  }
  // Algunos PDF traen cada fila (o varias columnas) como un solo texto: lo separamos en palabras
  // estimando la posición de cada una según su lugar dentro del texto.
  function splitPages(pages) {
    return pages.map(lines => lines.map(l => {
      const items = [];
      l.items.forEach(it => {
        const s = it.s, w = Math.max(1, it.r - it.x), cw = w / Math.max(1, s.length);
        const re = /\$\s?-?[\d.,]+|\S+/g; let m; let n = 0;
        while ((m = re.exec(s))) { n++; items.push({ x: Math.round(it.x + m.index * cw), r: Math.round(it.x + (m.index + m[0].length) * cw), s: m[0] }); }
        if (!n) items.push(it);
      });
      items.sort((a, b) => a.x - b.x);
      return { y: l.y, items };
    }));
  }
  // Otros PDF traen cada letra por separado: juntamos las letras pegadas en palabras.
  function mergeTight(pages) {
    return pages.map(lines => lines.map(l => {
      const out = [];
      l.items.forEach(it => {
        const cur = out[out.length - 1];
        if (cur) {
          const cw = Math.max(1, (cur.r - cur.x) / Math.max(1, cur.s.length)), gap = it.x - cur.r;
          if (gap <= Math.max(0.8, cw * 0.3)) { cur.s += it.s; cur.r = Math.max(cur.r, it.r); return; }
          if (gap <= cw * 1.8 && !/\s$/.test(cur.s)) { cur.s += " " + it.s; cur.r = Math.max(cur.r, it.r); return; }
        }
        out.push({ x: it.x, r: it.r, s: it.s });
      });
      return { y: l.y, items: out };
    }));
  }
  function parseOnce(pages) {
    const lines = pages.flat();
    const info = detect(pages);
    const period = periodOf(lines);
    let rows = info.card ? parseCard(lines, period) : parseAccount(pages, period);
    let loose = false;
    if (!rows.length) { rows = parseLoose(lines, period, info.card); loose = rows.length > 0; }
    return { ...info, period, rows, loose };
  }
  function parseStatement(pages) {
    const r = parseOnce(pages);
    if (r.rows.length >= 3 && !r.loose) return r;
    const score = x => x.rows.length * (x.loose ? 1 : 2);
    return [r, parseOnce(splitPages(pages)), parseOnce(splitPages(mergeTight(pages)))].sort((a, b) => score(b) - score(a))[0];
  }
  function textSize(pages) { return pages.flat().reduce((a, l) => a + l.items.reduce((b, i) => b + (i.s.match(/[A-Za-z0-9]/g) || []).length, 0), 0); }

  /* Convierte páginas de PDF.js en líneas con posición */
  async function pdfToPages(pdfjsLib, data, password) {
    const doc = await pdfjsLib.getDocument({ data, password, isEvalSupported: false }).promise;
    const pages = [];
    for (let p = 1; p <= doc.numPages; p++) {
      const tc = await (await doc.getPage(p)).getTextContent();
      const L = [];
      tc.items.forEach(i => { if (!i.str || !i.str.trim()) return; const x = i.transform[4], y = i.transform[5];
        let l = L.find(l => Math.abs(l.y - y) < 2.5); if (!l) { l = { y, items: [] }; L.push(l); }
        l.items.push({ x: Math.round(x), r: Math.round(x + i.width), s: i.str.trim() }); });
      L.sort((a, b) => b.y - a.y).forEach(l => l.items.sort((a, b) => a.x - b.x));
      pages.push(L);
    }
    return pages;
  }

  const api = { parseStatement, pdfToPages, splitPages, textSize };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.BankPDF = api;
})(typeof window !== "undefined" ? window : this);
