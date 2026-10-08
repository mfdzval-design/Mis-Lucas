/**
 * Proveedor Fintoc (agregador chileno) — cuentas corrientes y vista.
 * ------------------------------------------------------------
 * La persona escribe su clave del banco en el WIDGET DE FINTOC (dentro de la
 * app, pero servido por Fintoc): ni la app ni este servidor ven la clave.
 * Fintoc entrega un «link_token» que permite leer saldos y movimientos.
 *
 * Docs: https://docs.fintoc.com — Movements API
 *   POST /v1/link_intents            {country, holder_type, product} → widget_token
 *   GET  /v1/links/exchange?exchange_token=…                          → link (con link_token)
 *   GET  /v1/accounts?link_token=…                                    → cuentas
 *   GET  /v1/accounts/{id}/movements?link_token=…&since=…             → movimientos (paginado, encabezado Link)
 *   POST /v1/refresh_intents?link_token=…                             → pide datos frescos (mín. 5 min entre pedidos)
 *   DELETE /v1/links/{id}?link_token=…                                → desconecta
 *   Webhooks: account.refresh_intent.succeeded / failed / rejected
 *
 * Variables del Worker: FINTOC_SECRET_KEY (secreta), FINTOC_PUBLIC_KEY,
 * FINTOC_WEBHOOK_SECRET (secreta, para verificar la firma de los webhooks).
 * Con llaves de prueba (sk_test_…) funciona con los bancos de prueba de Fintoc.
 */
const API = "https://api.fintoc.com/v1";

export const fintoc = {
  id: "fintoc",
  nombre: "Fintoc",
  activo: env => !!(env.FINTOC_SECRET_KEY && env.FINTOC_PUBLIC_KEY),
  // Qué trae: solo cuentas (Fintoc no agrega tarjetas de crédito, oct-2026)
  cubre: { cuentas: true, tarjetas: false },
  bancos: ["cl_banco_de_chile", "cl_banco_santander", "cl_banco_itau", "cl_banco_bice", "cl_banco_scotiabank", "cl_banco_bci", "cl_banco_estado"],

  async req(env, method, path, body) {
    const r = await fetch(API + path, { method, headers: { Authorization: env.FINTOC_SECRET_KEY, Accept: "application/json", ...(body ? { "Content-Type": "application/json" } : {}) }, body: body ? JSON.stringify(body) : undefined });
    const txt = await r.text(); let j = null; try { j = txt ? JSON.parse(txt) : null; } catch (e) { j = null; }
    if (!r.ok) { const err = new Error((j && j.error && (j.error.message || j.error.code)) || `Fintoc ${r.status}`); err.status = r.status; err.code = j && j.error && j.error.code; throw err; }
    return { data: j, link: r.headers.get("Link") || "" };
  },

  /** Paso 1: la app pide abrir el widget. */
  async iniciar(env) {
    const { data } = await this.req(env, "POST", "/link_intents", { country: "cl", holder_type: "individual", product: "movements" });
    return { tipo: "widget", widget: "fintoc", publicKey: env.FINTOC_PUBLIC_KEY, widgetToken: data.widget_token, intent: data.id };
  },

  /** Paso 2: el widget terminó bien y la app nos manda el exchange_token. */
  async completar(env, { exchangeToken }) {
    if (!exchangeToken) throw Object.assign(new Error("falta exchange_token"), { status: 400 });
    const { data } = await this.req(env, "GET", "/links/exchange?exchange_token=" + encodeURIComponent(exchangeToken));
    return {
      secreto: { linkToken: data.link_token, linkId: data.id },
      indice: data.id, // para encontrar la conexión cuando llega un webhook
      institucion: { id: (data.institution && data.institution.id) || "", name: (data.institution && data.institution.name) || "Banco" },
    };
  },

  /** Lee cuentas y movimientos y los devuelve en el modelo normalizado. */
  async leer(env, secreto, { desde }) {
    const lt = encodeURIComponent(secreto.linkToken);
    const { data: cuentas } = await this.req(env, "GET", `/accounts?link_token=${lt}`);
    const accounts = [], movements = [];
    for (const a of cuentas || []) {
      const type = /sight/.test(a.type) ? "vista" : /saving/.test(a.type) ? "ahorro" : "cc";
      const b = a.balance || {};
      const acc = { id: a.id, type, name: a.name || a.official_name || "Cuenta", officialName: a.official_name || "", last4: String(a.number || "").slice(-4), currency: a.currency || "CLP",
        balance: { available: num(b.available), current: num(b.current) }, refreshedAt: a.refreshed_at || null };
      // Fintoc entrega «limit» = disponible incluyendo la línea de crédito
      if (num(b.limit) > num(b.available)) acc.balance.withLine = num(b.limit);
      accounts.push(acc);
      let url = `/accounts/${a.id}/movements?link_token=${lt}&per_page=300${desde ? "&since=" + new Date(desde).toISOString().slice(0, 10) : ""}`;
      for (let page = 0; url && page < 10; page++) {
        const { data, link } = await this.req(env, "GET", url);
        for (const m of data || []) movements.push(movimiento(a.id, m));
        const next = (link.match(/<([^>]+)>;\s*rel="next"/) || [])[1];
        url = next ? next.replace(API, "") : null;
      }
    }
    return { accounts, movements };
  },

  /** Pide a Fintoc que vaya al banco por datos frescos (responde por webhook). */
  async refrescar(env, secreto) {
    try { await this.req(env, "POST", `/refresh_intents?link_token=${encodeURIComponent(secreto.linkToken)}`); return { pedido: true }; }
    catch (e) { if (e.status === 400 || e.status === 403) return { pedido: false, motivo: e.message }; throw e; }
  },

  async desconectar(env, secreto) {
    try { await this.req(env, "DELETE", `/links/${secreto.linkId}?link_token=${encodeURIComponent(secreto.linkToken)}`); } catch (e) { /* si ya no existe, igual se borra aquí */ }
  },

  /** Verifica la firma «Fintoc-Signature: t=…,v1=…» (HMAC-SHA256 de "t.cuerpo"). */
  async verificarWebhook(env, req, cuerpo) {
    if (!env.FINTOC_WEBHOOK_SECRET) return false;
    const h = req.headers.get("Fintoc-Signature") || "";
    const t = (h.match(/t=(\d+)/) || [])[1], v1 = (h.match(/v1=([0-9a-f]+)/) || [])[1];
    if (!t || !v1 || Math.abs(Date.now() / 1000 - +t) > 600) return false;
    const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(env.FINTOC_WEBHOOK_SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${t}.${cuerpo}`)));
    const hex = [...sig].map(b => b.toString(16).padStart(2, "0")).join("");
    return igual(hex, v1);
  },
  /** De un webhook saca el id del link para encontrar la conexión. */
  indiceDeWebhook(ev) { const d = (ev && ev.data) || {}; return d.refreshed_object === "link" ? d.refreshed_object_id : (d.link_id || (d.link && d.link.id) || null); },
};

function num(x) { const n = Number(x); return isFinite(n) ? n : 0; }
function igual(a, b) { if (a.length !== b.length) return false; let r = 0; for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i); return r === 0; }
function movimiento(accountId, m) {
  const date = String(m.transaction_date || m.post_date || "").slice(0, 10);
  const kind = m.type === "transfer" ? "transferencia" : m.amount > 0 ? "abono" : "compra";
  const cp = m.amount > 0 ? m.sender_account : m.recipient_account;
  const o = { id: m.id, accountId, date, postDate: String(m.post_date || "").slice(0, 10), desc: String(m.description || "").trim() || (kind === "transferencia" ? "Transferencia" : "Movimiento"), amount: Math.round(num(m.amount)), currency: m.currency || "CLP", kind, pending: !!m.pending };
  if (cp && cp.holder_name) o.counterpart = cp.holder_name;
  if (m.comment) o.comment = String(m.comment).slice(0, 140);
  return o;
}
