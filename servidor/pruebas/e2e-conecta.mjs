// Prueba de punta a punta en un navegador (Chromium + Playwright):
//   node servidor/pruebas/servidor-local.mjs 8787 &   (en otra terminal)
//   node servidor/pruebas/e2e-conecta.mjs [carpeta-capturas] [modo: servidor|local]
import { chromium } from "playwright";
const OUT = process.argv[2] || ".";
const MODO = process.argv[3] || "servidor";
const BASE = "http://localhost:8787/";
const log = (...a) => console.log("•", ...a);

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || "/opt/pw-browsers/chromium", args: ["--no-sandbox"] });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: "es-CL", serviceWorkers: "block" });
const page = await ctx.newPage();
const errores = [];
page.on("pageerror", e => errores.push(String(e)));
page.on("console", m => { if (m.type() === "error" && !/mindicador|Failed to load resource/.test(m.text())) errores.push(m.text()); });
if (MODO === "local") await page.route("**/api/conecta/**", r => r.fulfill({ status: 404, body: "{}" }));

// Espacio de prueba: perfil sin PIN, una cuenta Santander ya creada y una compra anotada por el buzón
await page.addInitScript(() => {
  if (localStorage.getItem("e2e")) return; localStorage.setItem("e2e", "1"); localStorage.setItem("ml_seen", "1");
  const hoy = new Date(); const ym = hoy.toISOString().slice(0, 7);
  localStorage.setItem("mislucas.profile.v1", JSON.stringify({ name: "Prueba", pin: null, email: "", mode: "pin", autoLock: 0, theme: "light", catsSeen: 1 }));
  localStorage.setItem("mislucas.data.v1", JSON.stringify({ v: 1, savedAt: new Date().toISOString(), config: { started: true, createdAt: Date.now(), accounts: [{ id: "a1", name: "Efectivo", bank: "", type: "efectivo" }] }, months: { [ym]: { tx: [] } } }));
});
await page.goto(BASE); await page.waitForTimeout(1500);
await page.screenshot({ path: `${OUT}/01-inicio.png` });

// Menú → Bancos conectados
await page.click("#who"); await page.waitForTimeout(300);
await page.screenshot({ path: `${OUT}/02-menu.png` });
await page.click('#umenu [data-acct="bancos"]'); await page.waitForTimeout(600);
await page.screenshot({ path: `${OUT}/03-bancos-vacio.png` });
await page.click("#cxAdd"); await page.waitForTimeout(700);
await page.screenshot({ path: `${OUT}/04-elegir-banco.png` });
await page.click('[data-cxbank="demo"]'); await page.waitForTimeout(300);
await page.screenshot({ path: `${OUT}/05-autorizacion.png`, fullPage: false });
const dis = await page.$eval("#cxGo", b => b.disabled); if (!dis) throw new Error("el botón debe partir deshabilitado sin autorización");
await page.click('[data-cxfrom="3m"]'); await page.check("#cxAcepto"); await page.click("#cxGo"); await page.waitForTimeout(300);
await page.fill("#cxRut", "11.111.111-1"); await page.fill("#cxClave", "mala"); await page.click("#cxForm button[type=submit]"); await page.waitForTimeout(1200);
const err = await page.textContent("#cxBox"); if (!/incorrect/i.test(err)) throw new Error("debía mostrar clave incorrecta: " + err.slice(0, 200));
log("clave mala rechazada");
await page.fill("#cxRut", "11.111.111-1"); await page.fill("#cxClave", "demo");
await page.screenshot({ path: `${OUT}/06-clave.png` });
await page.click("#cxForm button[type=submit]"); await page.waitForTimeout(3500);
await page.screenshot({ path: `${OUT}/07-conectado.png` });
await page.screenshot({ path: `${OUT}/07b-conectado-completo.png`, fullPage: true });
const info = await page.evaluate(() => { const d = JSON.parse(localStorage.getItem("mislucas.data.v1")); const tx = Object.values(d.months).flatMap(m => m.tx || []); return { cuentas: d.config.accounts.map(a => `${a.name}|${a.type}|${a.cx || ""}`), n: tx.length, banco: tx.filter(t => t.source === "banco").length, traspasos: tx.filter(t => t.type === "traspaso").length, pend: tx.filter(t => t.pending).length, conns: (d.config.bank || {}).conns }; });
log("cuentas:", info.cuentas.join(" ; ")); log(`movimientos: ${info.n} (banco ${info.banco}, traspasos ${info.traspasos}, pendientes ${info.pend})`);
if (info.banco < 20) throw new Error("debían entrar movimientos del banco");
if (!info.cuentas.some(c => /\|tc\|/.test(c))) throw new Error("debía crear la tarjeta de crédito");
// Sincronizar de nuevo no duplica
await page.click("[data-cxsync]"); await page.waitForTimeout(2500);
const n2 = await page.evaluate(() => Object.values(JSON.parse(localStorage.getItem("mislucas.data.v1")).months).flatMap(m => m.tx || []).length);
if (n2 !== info.n) throw new Error(`sincronizar duplicó: ${info.n} → ${n2}`);
log("resincronizar no duplica");
// Inicio con la tarjeta de cuentas
await page.click("#acctClose"); await page.waitForTimeout(400); await page.click("#homeBtn"); await page.waitForTimeout(800);
const home = await page.$("#cxHome"); if (!home || await home.isHidden()) throw new Error("falta la tarjeta del inicio");
await home.scrollIntoViewIfNeeded(); await page.waitForTimeout(300);
await home.screenshot({ path: `${OUT}/08-inicio-cuentas.png` });
await page.screenshot({ path: `${OUT}/08b-inicio.png`, fullPage: true });
// Movimientos
await page.evaluate(() => { const b = document.querySelector('nav.tabs button[data-tab="movs"]'); b && b.click(); }); await page.waitForTimeout(800);
await page.screenshot({ path: `${OUT}/09-movimientos.png` });
// Permiso vencido → renovar (en modo local, donde el permiso vive en el teléfono)
if (MODO === "local") {
  await page.evaluate(() => { const d = JSON.parse(localStorage.getItem("mislucas.data.v1")); d.config.bank.conns[0].permiso.vence = Date.now() - 1000; localStorage.setItem("mislucas.data.v1", JSON.stringify(d)); });
  await page.reload(); await page.waitForTimeout(1500);
  await page.click("#who"); await page.click('#umenu [data-acct="bancos"]'); await page.waitForTimeout(500);
  if (!/Permiso vencido/.test(await page.textContent("#cxBox"))) throw new Error("debía mostrar permiso vencido");
  await page.click("[data-cxren]"); await page.check("#cxRenOk"); await page.screenshot({ path: `${OUT}/11-renovar.png` });
  await page.click("[data-cxrenok]"); await page.waitForTimeout(1500);
  const txt = await page.textContent("#cxBox"); if (!/Conectado/.test(txt) || !/Renovaste/.test(txt)) throw new Error("no se renovó: " + txt.slice(0, 300));
  log("permiso vencido → renovado, con historial");
  await page.click("#acctClose"); await page.waitForTimeout(300);
}
// Desconectar
await page.click("#who"); await page.click('#umenu [data-acct="bancos"]'); await page.waitForTimeout(500);
await page.click("[data-cxoff]"); await page.click("[data-cxoff]"); await page.waitForTimeout(1200);
const quedan = await page.evaluate(() => ((JSON.parse(localStorage.getItem("mislucas.data.v1")).config.bank || {}).conns || []).length);
if (quedan) throw new Error("no se desconectó");
log("desconectado");
// Modo oscuro de la pantalla conectada (reconecta rápido para la captura)
if (errores.length) { console.log("ERRORES EN LA PÁGINA:\n" + errores.join("\n")); process.exitCode = 1; }
else log("sin errores de JavaScript");
await browser.close();
