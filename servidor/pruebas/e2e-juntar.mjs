// Prueba: lo que llega del banco se junta con lo ya anotado y con la cartola, sin duplicar.
//   node servidor/pruebas/e2e-juntar.mjs   (con servidor-local.mjs corriendo en 8787)
import { chromium } from "playwright";
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || "/opt/pw-browsers/chromium", args: ["--no-sandbox"] });
const page = await (await browser.newContext({ serviceWorkers: "block" })).newPage();
const errores = []; page.on("pageerror", e => errores.push(String(e)));
const hoy = new Date(); const pad = n => String(n).padStart(2, "0"); const D = `${hoy.getFullYear()}-${pad(hoy.getMonth() + 1)}-${pad(hoy.getDate())}`; const YM = D.slice(0, 7);
await page.addInitScript(([D, YM]) => {
  if (localStorage.getItem("e2e")) return; localStorage.setItem("e2e", "1"); localStorage.setItem("ml_seen", "1");
  localStorage.setItem("mislucas.profile.v1", JSON.stringify({ name: "Prueba", pin: null, mode: "pin", autoLock: 0, theme: "light", catsSeen: 1 }));
  localStorage.setItem("mislucas.data.v1", JSON.stringify({ v: 1, config: { started: true, createdAt: Date.now(), accounts: [{ id: "a1", name: "Efectivo", type: "efectivo", bank: "" }, { id: "a2", name: "Santander TC", type: "tc", bank: "Santander", last4: "1111" }] },
    months: { [YM]: { tx: [
      { id: "s1", date: D, desc: "Jumbo", amount: 20000, type: "gasto", cat: "Supermercado", account: "Santander TC", source: "aviso", checked: false, approx: true },
      { id: "s2", date: D, desc: "Café", amount: 3500, type: "gasto", cat: "Restaurantes", account: "Efectivo", source: "manual", checked: false } ] } } }));
}, [D, YM]);
await page.goto("http://localhost:8787/"); await page.waitForTimeout(1200);
const snap = (movs) => ({ kind: "snapshot", cid: "T1", prov: "test", banco: "santander", at: Date.now(), accounts: [{ id: "x", type: "tc", last4: "1111", name: "Visa", credit: { limit: 1000000, used: 100000, available: 900000, billed: 50000, minPayment: 20000, dueDate: D } }], movements: movs });
const r1 = await page.evaluate(([s]) => window.MLConecta.aplicar(s, { cid: "T1", banco: "santander", prov: "test" }), [snap([
  { id: "m1", accountId: "x", date: D, desc: "COMPRA NAC JUMBO LA REINA", amount: -19990, pending: true },
  { id: "m2", accountId: "x", date: D, desc: "STARBUCKS", amount: -4500 }])]);
console.log("1ª vez:", r1);
const ver = async () => { await page.waitForTimeout(400); return page.evaluate(() => { const d = JSON.parse(localStorage.getItem("mislucas.data.v1")); return { tx: Object.values(d.months).flatMap(m => m.tx), acc: d.config.accounts }; }); };
let v = await ver();
const s1 = v.tx.find(t => t.id === "s1");
if (!(s1.extId === "bk|test|m1" && s1.amount === 19990 && s1.cat === "Supermercado" && s1.pending && !s1.approx)) throw new Error("no se juntó con el aviso: " + JSON.stringify(s1));
if (v.tx.length !== 3) throw new Error("cantidad inesperada " + v.tx.length);
if (v.acc.filter(a => a.type === "tc").length !== 1 || !v.acc.find(a => a.name === "Santander TC").cx) throw new Error("no reconoció la tarjeta existente por sus 4 dígitos");
console.log("✓ se junta con el aviso del buzón y usa la tarjeta que ya existía");
// El banco confirma la compra (nuevo id, ya no pendiente) → se actualiza la misma, no se duplica
const r2 = await page.evaluate(([s]) => window.MLConecta.aplicar(s), [snap([{ id: "m1b", accountId: "x", date: D, desc: "JUMBO LA REINA", amount: -19990 }, { id: "m2", accountId: "x", date: D, desc: "STARBUCKS", amount: -4500 }])]);
v = await ver(); console.log("2ª vez:", r2);
if (v.tx.length !== 3) throw new Error("pendiente→confirmado duplicó: " + v.tx.length);
const s1b = v.tx.find(t => t.id === "s1"); if (s1b.pending || !s1b.checked) throw new Error("no quedó confirmada " + JSON.stringify(s1b));
console.log("✓ pendiente que se confirma con otro id no se duplica");
const al = await page.evaluate(() => { document.querySelector("#bellBtn").click(); return document.querySelector("#npList").innerText; });
if (!/vence hoy/.test(al)) throw new Error("falta aviso de vencimiento: " + al);
console.log("✓ aviso «vence hoy» en la campana");
if (errores.length) { console.log(errores.join("\n")); process.exitCode = 1; } else console.log("✓ sin errores");
await browser.close();
