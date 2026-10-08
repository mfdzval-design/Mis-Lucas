/**
 * Mis Lucas · Banco de prueba («Banco Demo»)
 * ------------------------------------------------------------
 * Simula un banco chileno real para probar la conexión bancaria de punta
 * a punta sin datos reales: una cuenta corriente con línea de crédito y una
 * tarjeta de crédito con cupo, facturación, pago mínimo y vencimiento.
 * Los movimientos se generan de forma determinista a partir de una semilla y
 * de la hora: si sincronizas más tarde, aparecen las compras nuevas del día.
 *
 * El mismo archivo lo usa el servidor (Cloudflare Worker) y la app (modo
 * local cuando el servidor todavía no tiene la conexión bancaria activa).
 * Devuelve datos en el MODELO NORMALIZADO de Mis Lucas Conecta (ver
 * servidor/conecta/MODELO.md), igual que los demás proveedores.
 */
(function (root) {
  "use strict";
  const DAY = 864e5;
  // PRNG pequeño y determinista (mulberry32)
  function rng(seed) { let a = seed >>> 0; return function () { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function hash(s) { let h = 2166136261 >>> 0; s = String(s); for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  const pad = n => String(n).padStart(2, "0");
  const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const atLocal = (y, m, d, h = 0, mi = 0) => new Date(y, m, d, h, mi).getTime();

  // Comercios típicos (monto mínimo, máximo, peso). Todo inventado.
  const TC_SHOPS = [
    ["JUMBO LAS CONDES", 18000, 95000, 6], ["LIDER EXPRESS PROVIDENCIA", 6000, 40000, 6], ["UBER *TRIP", 3500, 14000, 7], ["UBER EATS", 9000, 26000, 4],
    ["RAPPI CHILE", 8000, 28000, 4], ["STARBUCKS COSTANERA", 3800, 7900, 5], ["COPEC APP", 25000, 55000, 3], ["FARMACIAS AHUMADA", 4000, 30000, 2],
    ["MERCADOPAGO*TIENDA", 12000, 60000, 2], ["CINEPLANET", 9000, 22000, 1], ["SPORTLIFE", 39990, 39990, 0.25], ["H&M COSTANERA", 15000, 70000, 1],
    ["PEDIDOSYA", 8000, 22000, 3], ["MC DONALDS", 5000, 12000, 2], ["SODIMAC HOMECENTER", 10000, 80000, 1], ["ENTEL PCS", 18990, 18990, 0.2],
  ];
  const SUBS = [["NETFLIX.COM", 9490, 8], ["SPOTIFY", 6490, 12], ["APPLE.COM/BILL", 2990, 15]];
  const DEB_SHOPS = [["UNIMARC", 4000, 25000], ["CAFE CENTRAL", 2500, 6000], ["PUNTO BIP", 5000, 15000], ["PANADERIA LA ESPIGA", 2000, 6000]];

  const CIERRE = 22;      // día de cierre de la tarjeta
  const VENCE = 5;        // día de vencimiento (mes siguiente al cierre)
  const PAGA = 6;         // día en que el titular paga el total facturado
  const CUPO = 1800000, CUPO_INT = 1000; // cupo nacional (CLP) e internacional (USD)
  const LINEA = 500000;

  /** Genera todos los movimientos «crudos» entre desde y hasta (ms). */
  function generar(seed, desde, hasta) {
    const out = [];
    const d0 = new Date(desde); d0.setHours(0, 0, 0, 0);
    for (let t = d0.getTime(); t <= hasta; t += DAY) {
      const d = new Date(t), y = d.getFullYear(), m = d.getMonth(), day = d.getDate();
      const r = rng(hash(seed + "|" + ymd(d)));
      const push = (acc, h, mi, desc, amount, kind, extra) => {
        const ts = atLocal(y, m, day, h, mi); if (ts < desde || ts > hasta) return;
        out.push(Object.assign({ id: "demo_" + (hash(seed + desc + ts + amount) >>> 0).toString(36), accountId: acc, ts, date: ymd(d), desc, amount, currency: "CLP", kind }, extra || {}));
      };
      // Tarjeta de crédito: 0 a 3 compras al día
      const n = Math.floor(r() * 3.4);
      const tot = TC_SHOPS.reduce((a, s) => a + s[3], 0);
      for (let i = 0; i < n; i++) {
        let x = r() * tot, s = TC_SHOPS[0]; for (const c of TC_SHOPS) { x -= c[3]; if (x <= 0) { s = c; break; } }
        const amt = Math.round((s[1] + r() * (s[2] - s[1])) / 10) * 10;
        push("demo_tc", 9 + Math.floor(r() * 13), Math.floor(r() * 60), s[0], -amt, "compra");
      }
      SUBS.forEach(([desc, amt, dd]) => { if (day === dd) push("demo_tc", 4, 10, desc, -amt, "compra"); });
      // Compra en cuotas una vez al mes
      if (day === 14) push("demo_tc", 18, 30, "FALABELLA.COM 3 CUOTAS", -79990, "compra", { installments: { n: 1, total: 3, each: 79990 } });
      // Compra internacional (en dólares) de vez en cuando
      if (r() < 0.06) { const usd = Math.round(25 + r() * 60); push("demo_tc", 12, 5, "AMAZON MKTPLACE", -usd * 950, "compra", { original: { currency: "USD", amount: usd } }); }
      // Cuenta corriente
      if (r() < 0.35) { const s = DEB_SHOPS[Math.floor(r() * DEB_SHOPS.length)]; push("demo_cc", 8 + Math.floor(r() * 12), Math.floor(r() * 60), "COMPRA DEBITO " + s[0], -Math.round((s[1] + r() * (s[2] - s[1])) / 10) * 10, "compra"); }
      if (day === 5) push("demo_cc", 10, 0, "TRANSF A INMOBILIARIA LOS ALAMOS", -550000, "transferencia", { counterpart: "Inmobiliaria Los Álamos" });
      if (day === 10) push("demo_cc", 7, 30, "PAC SEGURO AUTO", -32990, "cargo");
      if (day === 28 || (day === new Date(y, m + 1, 0).getDate() && day < 28)) push("demo_cc", 9, 0, "ABONO REMUNERACIONES EMPRESA DEMO SPA", 1850000, "abono", { counterpart: "Empresa Demo SpA" });
      if (r() < 0.05) push("demo_cc", 19, 15, "TRANSF DE CAMILA ROJAS", Math.round(5 + r() * 30) * 1000, "transferencia", { counterpart: "Camila Rojas" });
      if (day === 1) push("demo_cc", 6, 0, "COMISION MANTENCION CUENTA", -4990, "comision");
    }
    return out.sort((a, b) => a.ts - b.ts);
  }

  /** Periodo de facturación que contiene la fecha t: [inicio, fin] en ms. */
  function periodo(t) { const d = new Date(t); let y = d.getFullYear(), m = d.getMonth(); if (d.getDate() > CIERRE) m++; const fin = atLocal(y, m, CIERRE, 23, 59); const ini = atLocal(y, m - 1, CIERRE + 1, 0, 0); return [ini, fin]; }

  /**
   * Snapshot completo de la conexión de prueba, en el modelo normalizado.
   * @param {string} seed  semilla de la conexión (la crea el servidor o la app)
   * @param {number} creada  cuándo se conectó (ms)
   * @param {number} ahora   hora actual (ms)
   * @param {number} desde   desde cuándo devolver movimientos (ms)
   */
  function snapshot(seed, creada, ahora, desde) {
    ahora = ahora || Date.now();
    const inicio = Math.min(desde || ahora - 90 * DAY, ahora - 90 * DAY);
    const todo = generar(seed, inicio - 70 * DAY, ahora);
    // Pago automático del total facturado de la tarjeta desde la cuenta corriente, el día PAGA
    const pagos = [];
    for (let k = -4; k <= 0; k++) {
      const ref = new Date(ahora); const y = ref.getFullYear(), m = ref.getMonth() + k;
      const [ini, fin] = periodo(atLocal(y, m - 1, CIERRE, 12));
      const fact = -todo.filter(x => x.accountId === "demo_tc" && x.ts >= ini && x.ts <= fin).reduce((a, x) => a + x.amount, 0);
      const ts = atLocal(y, m, PAGA, 8, 0);
      if (fact > 0 && ts <= ahora && ts >= inicio - 70 * DAY) {
        const d = new Date(ts);
        pagos.push({ id: "demo_p" + hash(seed + ts).toString(36), accountId: "demo_cc", ts, date: ymd(d), desc: "PAGO TARJETA DE CREDITO VISA", amount: -fact, currency: "CLP", kind: "pago" });
        pagos.push({ id: "demo_q" + hash(seed + ts).toString(36), accountId: "demo_tc", ts: ts + 6e4, date: ymd(d), desc: "PAGO RECIBIDO GRACIAS", amount: fact, currency: "CLP", kind: "pago" });
      }
    }
    const all = todo.concat(pagos).sort((a, b) => a.ts - b.ts);
    // Saldos
    const cc = all.filter(x => x.accountId === "demo_cc");
    const saldoCC = 1250000 + cc.reduce((a, x) => a + x.amount, 0);
    const lineaUsada = saldoCC < 0 ? Math.min(LINEA, -saldoCC) : 0;
    const [pIni] = periodo(ahora);
    const [fIni, fFin] = periodo(pIni - DAY); // último periodo cerrado
    const tc = all.filter(x => x.accountId === "demo_tc");
    const facturado = -tc.filter(x => x.ts >= fIni && x.ts <= fFin && x.kind !== "pago").reduce((a, x) => a + x.amount, 0);
    const pagado = tc.filter(x => x.kind === "pago" && x.ts > fFin).reduce((a, x) => a + x.amount, 0);
    const noFacturado = -tc.filter(x => x.ts > fFin && x.kind !== "pago").reduce((a, x) => a + x.amount, 0);
    // cuotas futuras de compras en cuotas aún no facturadas
    // (la compra muestra la primera cuota; las que faltan siguen ocupando cupo)
    const cierres = t => { let n = 0, c = periodo(t)[1]; while (c < ahora) { n++; c = periodo(c + DAY)[1]; } return n; };
    const cuotas = tc.filter(x => x.installments && x.ts > ahora - 100 * DAY).reduce((a, x) => a + x.installments.each * Math.max(0, x.installments.total - 1 - cierres(x.ts)), 0);
    const deudaFact = Math.max(0, facturado - pagado);
    const usado = deudaFact + noFacturado + cuotas;
    const vence = new Date(fFin); vence.setMonth(vence.getMonth() + 1); vence.setDate(VENCE);
    const accounts = [
      { id: "demo_cc", type: "cc", name: "Cuenta Corriente", officialName: "Cuenta Corriente Plan Demo", last4: "4821", currency: "CLP",
        balance: { available: Math.max(saldoCC, 0), current: saldoCC },
        creditLine: { limit: LINEA, used: lineaUsada, available: LINEA - lineaUsada } },
      { id: "demo_tc", type: "tc", name: "Tarjeta Visa Signature", last4: "9134", currency: "CLP",
        balance: { available: CUPO - usado, current: -usado },
        credit: { limit: CUPO, used: usado, available: Math.max(0, CUPO - usado), billed: deudaFact, billedTotal: facturado, unbilled: noFacturado, installmentsPending: cuotas,
          minPayment: deudaFact ? Math.max(Math.round(deudaFact * 0.05), Math.min(deudaFact, 20000)) : 0, dueDate: ymd(vence), closeDate: ymd(new Date(fFin)),
          nextCloseDate: ymd(new Date(periodo(ahora)[1])), intlLimit: CUPO_INT, intlUsed: 0, intlCurrency: "USD" } },
    ];
    const lim = desde || inicio;
    const movements = all.filter(x => x.ts >= lim && x.ts <= ahora).map(x => {
      const o = { id: x.id, accountId: x.accountId, date: x.date, ts: x.ts, desc: x.desc, amount: x.amount, currency: "CLP", kind: x.kind, pending: x.accountId === "demo_tc" && x.ts > fFin && x.kind !== "pago" };
      if (x.installments) o.installments = x.installments; if (x.original) o.original = x.original; if (x.counterpart) o.counterpart = x.counterpart; return o;
    });
    return { institution: { id: "demo", name: "Banco Demo" }, at: ahora, accounts, movements };
  }

  const API = {
    id: "demo", name: "Banco Demo (de prueba)",
    // Credenciales de prueba: cualquier RUT válido + clave «demo»
    login(rut, clave) { return /^demo$/i.test(String(clave || "").trim()) && /\d/.test(String(rut || "")); },
    snapshot,
  };
  root.MLDemoBank = API;
})(typeof globalThis !== "undefined" ? globalThis : this);
