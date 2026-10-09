// Pruebas del servidor de conexión bancaria: node servidor/pruebas/prueba-conecta.mjs
import assert from "node:assert/strict";
import worker from "../buzon.js";
import { kvMemoria } from "./kv-memoria.mjs";

const env = { BUZON: kvMemoria(), DOMINIO: "mislucasapp.com", CONECTA_SECRETO: "secreto-de-prueba-muy-largo-1234567890",
  FINTOC_SECRET_KEY: "sk_test_x", FINTOC_PUBLIC_KEY: "pk_test_x", FINTOC_WEBHOOK_SECRET: "whsec_x", KHIPU_API_KEY: "kh_x" };
let ok = 0; const t = async (n, f) => { await f(); ok++; console.log("✓", n); };

/* ---- Bancos falsos: respuestas con la forma documentada de Fintoc y Khipu ---- */
const llamadas = [];
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, o = {}) => {
  url = String(url); llamadas.push({ url, o });
  const J = (x, st = 200, h = {}) => new Response(JSON.stringify(x), { status: st, headers: { "Content-Type": "application/json", ...h } });
  if (url.startsWith("https://api.fintoc.com/v1/")) {
    assert.equal(o.headers.Authorization, "sk_test_x");
    if (url.endsWith("/link_intents")) return J({ id: "li_1", object: "link_intent", widget_token: "wt_123", status: "created" }, 201);
    if (url.includes("/links/exchange?exchange_token=li_1_exc")) return J({ id: "link_A", link_token: "link_A_token_secret", institution: { id: "cl_banco_santander", name: "Banco Santander" }, accounts: [] });
    if (url.includes("/links/exchange")) return J({ error: { message: "invalid exchange token" } }, 403);
    if (url.includes("/accounts?link_token=link_A_token_secret")) return J([{ id: "acc_1", type: "checking_account", name: "Cuenta Corriente", official_name: "Cuenta Corriente Santander", number: "000012345678", currency: "CLP", balance: { available: 900000, current: 950000, limit: 1400000 }, refreshed_at: "2026-10-08T10:00:00Z" }]);
    if (url.includes("/accounts/acc_1/movements") && !url.includes("page=2")) return J([{ id: "mov_1", description: "Transferencia a Juan", amount: -50000, currency: "CLP", post_date: "2026-10-07T00:00:00Z", transaction_date: "2026-10-07T00:00:00Z", type: "transfer", recipient_account: { holder_name: "Juan Pérez" }, pending: false }], 200, { Link: '<https://api.fintoc.com/v1/accounts/acc_1/movements?link_token=link_A_token_secret&page=2>; rel="next"' });
    if (url.includes("page=2")) return J([{ id: "mov_2", description: "ABONO REMUNERACIONES", amount: 1850000, currency: "CLP", post_date: "2026-09-30T00:00:00Z", type: "transfer", sender_account: { holder_name: "Empresa SpA" } }]);
    if (url.includes("/refresh_intents")) return J({ id: "ri_1", status: "created" }, 201);
    if (o.method === "DELETE") return J({}, 200);
  }
  if (url.startsWith("https://api.khipu.com/")) {
    assert.equal(o.headers["x-api-key"], "kh_x");
    const body = JSON.parse(o.body || "{}");
    const R = d => J({ OperationId: "op", Status: "OK", Data: d, AdditionalInformation: null, Error: null, LifeSpan: null });
    if (url.endsWith("/token")) return body.Password === "buena" ? R({ AccountLink: "AL_123" }) : J({ OperationId: "op", Status: "ERROR", Data: null, Error: { Code: "AUTH", Type: "DO_NOT_RETRY", Description: "Credenciales inválidas" } }, 401);
    assert.equal(body.RequestData.AccountCredential.AccountLink, "AL_123");
    assert.ok(!JSON.stringify(body).includes("buena"), "la clave no debe reenviarse después de obtener el token");
    if (url.endsWith("/products")) return R({ Product: [{ AccountId: "tc1", ProductType: "CreditCard", Name: "Visa Platinum", LastDigits: "9134" }] });
    if (url.endsWith("/current-balances")) return R({ Balance: [{ AccountId: "tc1", Type: "CreditLimit", Amount: { Amount: 2000000, Currency: "CLP" } }, { AccountId: "tc1", Type: "Available", Amount: { Amount: 1500000, Currency: "CLP" } }] });
    if (url.endsWith("/unbilled-transactions") && body.RequestData.TransactionType === "National") return R({ Transaction: [{ AccountId: "tc1", BookingDateTime: new Date().toISOString(), CreditDebitIndicator: "Debit", Status: "Pending", TransactionId: "k1", TransactionInformation: "JUMBO", Amount: { Amount: 25990, Currency: "CLP" }, Instalment: { CurrentInstalmentNumber: 1, InstalmentsNumber: 1 } }] });
    if (url.includes("transactions")) return R({ Transaction: [] });
  }
  throw new Error("fetch inesperado " + url);
};

const llamar = async (ruta, body, metodo) => {
  const m = metodo || (body ? "POST" : "GET");
  const r = await worker.fetch(new Request("https://buzon.mislucasapp.com/api/conecta" + ruta, { method: m, headers: { "Content-Type": "application/json" }, body: m === "POST" ? JSON.stringify(body) : undefined }), env, {});
  return { st: r.status, j: await r.json() };
};
// La app: par de llaves; la privada nunca sale de aquí
const kp = await crypto.subtle.generateKey({ name: "RSA-OAEP", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" }, true, ["encrypt", "decrypt"]);
const pub = await crypto.subtle.exportKey("jwk", kp.publicKey);
const unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
async function descifrar(it) {
  const raw = await crypto.subtle.decrypt({ name: "RSA-OAEP" }, kp.privateKey, unb64(it.enc.k));
  const aes = await crypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, false, ["decrypt"]);
  return JSON.parse(new TextDecoder().decode(await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(it.enc.iv) }, aes, unb64(it.enc.ct))));
}
const CONS = { acepto: true, v: "2026-10-08" };
let U, K;

await t("estado: lista proveedores y bancos", async () => {
  const { j } = await llamar("/estado");
  assert.ok(j.ok); assert.deepEqual(j.proveedores.map(p => p.id).sort(), ["demo", "fintoc", "khipu"]);
  const san = j.bancos.find(b => b.id === "santander"); assert.equal(san.cuentas, "fintoc"); assert.equal(san.tarjetas, "khipu");
});
await t("estado sin llaves: solo el banco demo", async () => {
  const r = await worker.fetch(new Request("https://x/api/conecta/estado"), { BUZON: kvMemoria() }, {}); const j = await r.json();
  assert.deepEqual(j.proveedores.map(p => p.id), ["demo"]); assert.equal(j.bancos.find(b => b.id === "santander").cuentas, null);
});
await t("registro exige llave pública", async () => { const { st } = await llamar("/registro", {}); assert.equal(st, 400); });
await t("registro", async () => { const { j } = await llamar("/registro", { pub }); assert.ok(j.ok); U = j.u; K = j.k; assert.equal(U.length, 12); });
await t("sin clave → 403", async () => { const { st } = await llamar(`/conexiones?u=${U}&k=mala`); assert.equal(st, 403); });
await t("demo: sin consentimiento no conecta", async () => { const { st, j } = await llamar("/completar", { u: U, k: K, prov: "demo", banco: "demo", rut: "1-9", clave: "demo" }); assert.equal(st, 400); assert.match(j.error, /autorizaci/); });
await t("demo: clave incorrecta", async () => { const { st } = await llamar("/completar", { u: U, k: K, prov: "demo", banco: "demo", rut: "1-9", clave: "x", consentimiento: CONS }); assert.equal(st, 400); });
let cidDemo;
await t("demo: conectar y recibir cuentas, cupos y movimientos cifrados", async () => {
  const ini = await llamar("/iniciar", { u: U, k: K, prov: "demo", banco: "demo" }); assert.equal(ini.j.tipo, "clave");
  const { j } = await llamar("/completar", { u: U, k: K, prov: "demo", banco: "demo", rut: "11.111.111-1", clave: "demo", consentimiento: CONS });
  assert.ok(j.ok, JSON.stringify(j)); assert.ok(j.sync.ok); cidDemo = j.conexion.cid;
  const d = await llamar(`/datos?u=${U}&k=${K}`); assert.equal(d.j.items.length, 1);
  assert.ok(!JSON.stringify(d.j).includes("Visa"), "los datos deben ir cifrados");
  const s = await descifrar(d.j.items[0]);
  assert.equal(s.kind, "snapshot"); assert.equal(s.accounts.length, 2);
  const tc = s.accounts.find(a => a.type === "tc"); assert.ok(tc.credit.limit === 1800000 && tc.credit.used + tc.credit.available === 1800000);
  assert.ok(s.movements.length > 50);
  const ok2 = await llamar("/ok", { u: U, k: K, ids: [d.j.items[0].id] }); assert.equal(ok2.j.borrados, 1);
  const d2 = await llamar(`/datos?u=${U}&k=${K}`); assert.equal(d2.j.items.length, 0);
});
await t("el token del proveedor queda cifrado en el servidor", async () => {
  const raw = [...env.BUZON._m.entries()].filter(([k]) => k.startsWith("cn:")).map(([, v]) => v.v).join("");
  assert.ok(!/seed|link_A_token_secret|AL_123/.test(raw));
});
await t("fintoc: widget → exchange → cuentas y movimientos paginados", async () => {
  const ini = await llamar("/iniciar", { u: U, k: K, prov: "fintoc", banco: "santander" });
  assert.equal(ini.j.widgetToken, "wt_123"); assert.equal(ini.j.publicKey, "pk_test_x"); assert.equal(ini.j.institutionId, "cl_banco_santander");
  const bad = await llamar("/completar", { u: U, k: K, prov: "fintoc", banco: "santander", exchangeToken: "otro", consentimiento: CONS }); assert.equal(bad.st, 403);
  const { j } = await llamar("/completar", { u: U, k: K, prov: "fintoc", banco: "santander", exchangeToken: "li_1_exc", consentimiento: CONS });
  assert.ok(j.ok && j.sync.ok, JSON.stringify(j));
  const d = await llamar(`/datos?u=${U}&k=${K}`); const s = await descifrar(d.j.items[0]);
  assert.equal(s.accounts[0].type, "cc"); assert.equal(s.accounts[0].last4, "5678"); assert.equal(s.accounts[0].balance.available, 900000);
  assert.deepEqual(s.movements.map(m => m.id), ["mov_1", "mov_2"]); assert.equal(s.movements[0].counterpart, "Juan Pérez"); assert.equal(s.movements[1].amount, 1850000);
  await llamar("/ok", { u: U, k: K, ids: d.j.items.map(i => i.id) });
});
await t("fintoc: webhook con firma mala se rechaza", async () => {
  const r = await worker.fetch(new Request("https://x/api/conecta/webhook/fintoc", { method: "POST", headers: { "Fintoc-Signature": "t=1,v1=00" }, body: "{}" }), env, {}); assert.equal(r.status, 401);
});
await t("fintoc: webhook válido sincroniza solo", async () => {
  const body = JSON.stringify({ type: "account.refresh_intent.succeeded", data: { refreshed_object: "link", refreshed_object_id: "link_A" } });
  const ts = Math.floor(Date.now() / 1000);
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode("whsec_x"), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = [...new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${ts}.${body}`)))].map(b => b.toString(16).padStart(2, "0")).join("");
  const r = await worker.fetch(new Request("https://x/api/conecta/webhook/fintoc", { method: "POST", headers: { "Fintoc-Signature": `t=${ts},v1=${sig}` }, body }), env, {});
  assert.equal(r.status, 200);
  const d = await llamar(`/datos?u=${U}&k=${K}`); assert.equal(d.j.items.length, 1); const s = await descifrar(d.j.items[0]); assert.equal(s.motivo, "webhook");
  await llamar("/ok", { u: U, k: K, ids: d.j.items.map(i => i.id) });
});
await t("khipu: clave mala no conecta y no queda guardada", async () => {
  const { st } = await llamar("/completar", { u: U, k: K, prov: "khipu", banco: "santander", rut: "12.345.678-9", clave: "mala", consentimiento: CONS }); assert.equal(st, 400);
});
await t("khipu: tarjeta con cupo y compras no facturadas; la clave no se guarda", async () => {
  const { j } = await llamar("/completar", { u: U, k: K, prov: "khipu", banco: "santander", rut: "12.345.678-9", clave: "buena", consentimiento: CONS });
  assert.ok(j.ok && j.sync.ok, JSON.stringify(j));
  const d = await llamar(`/datos?u=${U}&k=${K}`); const s = await descifrar(d.j.items[0]);
  const tc = s.accounts[0]; assert.equal(tc.type, "tc"); assert.equal(tc.credit.limit, 2000000); assert.equal(tc.credit.used, 500000);
  assert.equal(s.movements[0].desc, "JUMBO"); assert.equal(s.movements[0].amount, -25990); assert.ok(s.movements[0].pending);
  const todo = [...env.BUZON._m.values()].map(x => x.v).join(""); assert.ok(!todo.includes("buena"), "la clave del banco no puede quedar en el servidor");
  await llamar("/ok", { u: U, k: K, ids: d.j.items.map(i => i.id) });
});
await t("conexiones y sincronizar todo", async () => {
  const c = await llamar(`/conexiones?u=${U}&k=${K}`); assert.equal(c.j.conexiones.length, 3); assert.ok(c.j.conexiones.every(x => !x.sec));
  const s = await llamar("/sincronizar", { u: U, k: K, cid: cidDemo }); assert.ok(s.j.resultados[0].ok);
});
await t("cron: sincroniza las que están atrasadas", async () => {
  for (const [k, x] of env.BUZON._m) if (k.startsWith("cn:")) { const c = JSON.parse(x.v); c.ultima = 0; x.v = JSON.stringify(c); }
  const n0 = llamadas.length; const { conectaProgramado } = await import("../conecta/conecta.js"); const n = await conectaProgramado(env);
  assert.ok(n >= 2); assert.ok(llamadas.slice(n0).some(l => l.url.includes("/refresh_intents")), "a Fintoc se le pide refrescar");
});
await t("permiso: vence a los 12 meses, bloquea la sincronización y se renueva", async () => {
  const c0 = (await llamar(`/conexiones?u=${U}&k=${K}`)).j.conexiones.find(x => x.prov === "demo");
  assert.ok(c0.permiso.vence - Date.now() > 360 * 864e5);
  const key = `cn:${U}:${c0.cid}`; const raw = JSON.parse(await env.BUZON.get(key)); raw.consentimiento.vence = Date.now() - 1000; await env.BUZON.put(key, JSON.stringify(raw));
  const c1 = (await llamar(`/conexiones?u=${U}&k=${K}`)).j.conexiones.find(x => x.cid === c0.cid); assert.equal(c1.estado, "vencido");
  const s = await llamar("/sincronizar", { u: U, k: K, cid: c0.cid }); assert.ok(!s.j.resultados[0].ok); assert.match(s.j.resultados[0].error, /venci/);
  const sin = await llamar("/renovar", { u: U, k: K, cid: c0.cid }); assert.equal(sin.st, 400);
  const r = await llamar("/renovar", { u: U, k: K, cid: c0.cid, consentimiento: CONS }); assert.ok(r.j.ok); assert.equal(r.j.conexion.estado, "ok"); assert.ok(r.j.conexion.permiso.renovado);
  const s2 = await llamar("/sincronizar", { u: U, k: K, cid: c0.cid }); assert.ok(s2.j.resultados[0].ok);
});
await t("desconectar avisa al proveedor y borra", async () => {
  const c = (await llamar(`/conexiones?u=${U}&k=${K}`)).j.conexiones.find(x => x.prov === "fintoc");
  await llamar("/desconectar", { u: U, k: K, cid: c.cid });
  assert.ok(llamadas.some(l => l.o.method === "DELETE" && l.url.includes("/links/link_A")));
  assert.equal((await llamar(`/conexiones?u=${U}&k=${K}`)).j.conexiones.length, 2);
  assert.equal(await env.BUZON.get("ci:fintoc:link_A"), null);
});
await t("baja borra todo", async () => {
  await llamar("/baja", { u: U, k: K }); const quedan = [...env.BUZON._m.keys()].filter(k => /^(cu|cn|cq|ci):/.test(k)); assert.deepEqual(quedan, []);
});
await t("sin CONECTA_SECRETO no conecta bancos reales", async () => {
  const e2 = { BUZON: kvMemoria() }; const r = await worker.fetch(new Request("https://x/api/conecta/registro", { method: "POST", body: JSON.stringify({ pub }) }), e2, {}); const j = await r.json();
  const r2 = await worker.fetch(new Request("https://x/api/conecta/completar", { method: "POST", body: JSON.stringify({ u: j.u, k: j.k, prov: "demo", banco: "demo", rut: "1", clave: "demo", consentimiento: CONS }) }), e2, {});
  assert.equal(r2.status, 503);
});
await t("el buzón sigue funcionando igual", async () => { const r = await worker.fetch(new Request("https://x/api"), env, {}); assert.equal((await r.json()).app, "Mis Lucas · buzón"); });
globalThis.fetch = realFetch;
console.log(`\n${ok} pruebas OK`);
