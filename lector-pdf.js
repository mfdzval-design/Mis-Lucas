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

  function detect(pages) {
    const all = N(pages.flat().map(lineText).join(" "));
    const card = /TARJETA DE CREDITO/.test(all) && /PERIODO FACTURADO/.test(all);
    const itau = /ITAU/.test(all) || /ESTADO DE CUENTA PERSONAL/.test(all);
    const sant = /SANTANDER/.test(all);
    const bank = sant && !/ITAU/.test(all) ? "Santander" : itau ? "Itaú" : sant ? "Santander" : "";
    const vista = /CUENTA VISTA/.test(all);
    return { card, bank, vista };
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
        const cg = l.items.find(x => /CARGOS?$/.test(N(x.s)));
        const ab = l.items.find(x => /ABONOS?$/.test(N(x.s)));
        if (cg && ab) {
          const near = lines.slice(Math.max(0, idx - 3), idx + 3).flatMap(z => z.items);
          const sd = near.find(x => /^SALDO/.test(N(x.s)) && x.x > ab.x);
          const c = x => (x.x + x.r) / 2;
          cols = { cargo: c(cg), abono: c(ab), saldo: sd ? c(sd) : Infinity };
          return;
        }
        if (!cols) return;
        const it = l.items; const d = it[0] && it[0].s.match(DATE);
        if (!d || it[0].x > 90) return;
        const amts = it.slice(1).filter(x => AMT.test(x.s.replace(/\s/g, "")) && x.x > 300);
        if (!amts.length) return;
        let cargo = 0, abono = 0;
        amts.forEach(a => {
          const cx = (a.x + a.r) / 2;
          const best = [["cargo", Math.abs(cx - cols.cargo)], ["abono", Math.abs(cx - cols.abono)], ["saldo", Math.abs(cx - cols.saldo)]].sort((p, q) => p[1] - q[1])[0][0];
          if (best === "cargo") cargo = Math.abs(num(a.s)); else if (best === "abono") abono = Math.abs(num(a.s));
        });
        if (!cargo && !abono) return;
        const desc = it.slice(1).filter(x => !amts.includes(x) && x.x > 110 && !/^\d{3,}$/.test(x.s) && !/^[A-Z]\.[A-Za-z]+$/.test(x.s) && x.x < 400)
          .map(x => x.s).join(" ").replace(/^\d{9}[\dK] /, "").replace(/\s+/g, " ").trim();
        if (/SALDO DIA|^---/i.test(desc)) return;
        let y = d[3] ? (d[3].length === 2 ? 2000 + +d[3] : +d[3]) : (+d[2] > endM ? endY - 1 : endY);
        rows.push([`${y}-${d[2]}-${d[1]}`, desc || "(sin descripción)", cargo || "", abono || ""]);
      });
    }
    return rows;
  }

  function parseStatement(pages) {
    const lines = pages.flat();
    const info = detect(pages);
    const period = periodOf(lines);
    const rows = info.card ? parseCard(lines, period) : parseAccount(pages, period);
    const account = info.card ? (info.bank === "Itaú" ? "Itaú TC" : "Santander TC") : (info.bank === "Itaú" ? "Itaú Cta. Cte." : "Santander Cta. Cte.");
    return { ...info, period, account, rows };
  }

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

  const api = { parseStatement, pdfToPages };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.BankPDF = api;
})(typeof window !== "undefined" ? window : this);
