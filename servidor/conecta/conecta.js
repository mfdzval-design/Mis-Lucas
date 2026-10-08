/**
 * Mis Lucas Conecta · conexión con bancos (servidor)
 * ------------------------------------------------------------
 * Une a la app con proveedores de datos bancarios (Fintoc para cuentas,
 * Khipu para tarjetas de crédito, Banco Demo para pruebas y, desde 2027,
 * el Sistema de Finanzas Abiertas de la CMF) y deja todo en un MODELO
 * NORMALIZADO (ver MODELO.md) para que la app no dependa del proveedor.
 *
 * Seguridad:
 *  - La app se registra con su LLAVE PÚBLICA. Todo lo que el servidor manda
 *    a la app (saldos, cupos, movimientos) se guarda cifrado con esa llave
 *    (RSA-OAEP + AES-GCM) y se borra apenas la app lo recoge: el servidor no
 *    acumula tus movimientos y quien lo administra no puede leerlos.
 *  - Los tokens de acceso de cada proveedor (nunca claves del banco) se
 *    guardan cifrados con AES-GCM usando el secreto CONECTA_SECRETO del Worker.
 *  - Cada conexión requiere consentimiento explícito (queda registrado con
 *    fecha y versión del texto) y se puede revocar en cualquier momento:
 *    al desconectar se avisa al proveedor y se borra todo.
 *
 * Rutas (todas bajo /api/conecta):
 *   GET  /estado                          → proveedores activos y bancos disponibles
 *   POST /registro {pub}                  → {u,k}
 *   POST /iniciar {u,k,prov,banco}        → qué necesita la app (widget o clave)
 *   POST /completar {u,k,prov,banco,consentimiento,…} → crea la conexión y trae los datos
 *   GET  /conexiones?u&k                  → lista (solo estado, sin datos)
 *   POST /sincronizar {u,k,cid?}          → pide datos frescos
 *   GET  /datos?u&k                       → lo pendiente (cifrado)
 *   POST /ok {u,k,ids}                    → borra lo ya recogido
 *   POST /desconectar {u,k,cid}           → revoca y borra
 *   POST /baja {u,k}                      → borra todo
 *   POST /webhook/fintoc                  → avisos de Fintoc (firma verificada)
 * Más un cron (scheduled) que sincroniza solo cada cierto tiempo.
 */
import { fintoc } from "./fintoc.js";
import { khipu } from "./khipu.js";
import { demo } from "./demo.js";

export const PROVEEDORES = { fintoc, khipu, demo };
export const CONSENTIMIENTO_V = "2026-10-08";
const TTL_COLA = 30 * 24 * 3600;
const PRIMERA_VEZ = 90;      // días de historia en la primera conexión
const SOLAPE = 10;           // días que se vuelven a pedir en cada sincronización (pendientes que se confirman)
const MIN_MANUAL = 60e3;     // mínimo entre sincronizaciones pedidas por la app
const CADA = { fintoc: 4 * 3600e3, khipu: 6 * 3600e3, demo: 3600e3 }; // sincronización automática

// Catálogo de bancos para la app: qué proveedor trae cuentas y cuál tarjetas
export const BANCOS = [
  { id: "santander", name: "Santander", fintoc: "cl_banco_santander", khipu: "santander" },
  { id: "chile", name: "Banco de Chile / Edwards", fintoc: "cl_banco_de_chile", khipu: "chile" },
  { id: "itau", name: "Itaú", fintoc: "cl_banco_itau", khipu: "itau" },
  { id: "bci", name: "BCI", fintoc: "cl_banco_bci", khipu: "bci" },
  { id: "estado", name: "BancoEstado", fintoc: "cl_banco_estado" },
  { id: "scotiabank", name: "Scotiabank", fintoc: "cl_banco_scotiabank" },
  { id: "bice", name: "BICE", fintoc: "cl_banco_bice" },
  { id: "consorcio", name: "Banco Consorcio", khipu: "consorcio" },
  { id: "demo", name: "Banco Demo (prueba)", demo: "demo" },
];

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET,POST,OPTIONS", "Access-Control-Allow-Headers": "Content-Type", "Access-Control-Max-Age": "86400" };
const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...cors } });
const ALFA = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
function azar(n) { const b = crypto.getRandomValues(new Uint8Array(n)); let s = ""; for (const x of b) s += ALFA[x % ALFA.length]; return s; }
async function sha(s) { const h = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)); return [...new Uint8Array(h)].map(b => b.toString(16).padStart(2, "0")).join(""); }
const b64 = buf => { let s = ""; const b = new Uint8Array(buf); for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]); return btoa(s); };
const unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
const uOk = u => /^[A-Za-z0-9]{12}$/.test(u || "");
const cidOk = c => /^[A-Za-z0-9]{10}$/.test(c || "");
const err = (msg, status = 400) => Object.assign(new Error(msg), { status });

/* ---------- cifrado ---------- */
async function cifrarPara(pubJwk, obj) {
  const pub = await crypto.subtle.importKey("jwk", pubJwk, { name: "RSA-OAEP", hash: "SHA-256" }, false, ["encrypt"]);
  const aes = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt"]);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, aes, new TextEncoder().encode(JSON.stringify(obj)));
  const k = await crypto.subtle.encrypt({ name: "RSA-OAEP" }, pub, await crypto.subtle.exportKey("raw", aes));
  return { k: b64(k), iv: b64(iv), ct: b64(ct) };
}
async function llaveServidor(env) {
  if (!env.CONECTA_SECRETO || String(env.CONECTA_SECRETO).length < 24) throw err("El servidor no tiene configurado CONECTA_SECRETO", 503);
  const raw = await crypto.subtle.digest("SHA-256", new TextEncoder().encode("mislucas-conecta|" + env.CONECTA_SECRETO));
  return crypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}
async function sellar(env, obj, aad) {
  const key = await llaveServidor(env); const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: new TextEncoder().encode(aad) }, key, new TextEncoder().encode(JSON.stringify(obj)));
  return b64(iv) + "." + b64(ct);
}
async function abrir(env, s, aad) {
  const key = await llaveServidor(env); const [iv, ct] = String(s).split(".");
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(iv), additionalData: new TextEncoder().encode(aad) }, key, unb64(ct));
  return JSON.parse(new TextDecoder().decode(pt));
}

/* ---------- almacenamiento ---------- */
const KV = env => env.CONECTA || env.BUZON;
async function usuario(env, u, k) {
  if (!uOk(u) || !k) return null;
  const x = await KV(env).get("cu:" + u, "json");
  return x && x.h === await sha(k) ? x : null;
}
async function conexiones(env, u) {
  const L = await KV(env).list({ prefix: `cn:${u}:` });
  return (await Promise.all(L.keys.map(x => KV(env).get(x.name, "json")))).filter(Boolean);
}
const publica = c => ({ cid: c.cid, prov: c.prov, banco: c.banco, inst: c.inst, estado: c.estado, creada: c.creada, ultima: c.ultima || 0, err: c.err || null, cubre: (PROVEEDORES[c.prov] || {}).cubre || {} });
async function limite(env, clave, max, segs) {
  const k = "rl:" + clave; const n = +(await KV(env).get(k)) || 0;
  if (n >= max) return false; await KV(env).put(k, String(n + 1), { expirationTtl: segs }); return true;
}

/* ---------- sincronizar una conexión ---------- */
export async function sincronizar(env, u, cid, { motivo = "app" } = {}) {
  const key = `cn:${u}:${cid}`;
  const c = await KV(env).get(key, "json"); if (!c) throw err("conexión no existe", 404);
  const usr = await KV(env).get("cu:" + u, "json"); if (!usr || !usr.pub) throw err("usuario no existe", 404);
  const P = PROVEEDORES[c.prov]; if (!P || !P.activo(env)) throw err("proveedor no disponible", 503);
  const sec = await abrir(env, c.sec, key);
  const primera = !c.ultima;
  const desde = primera ? Date.now() - PRIMERA_VEZ * 864e5 : Math.min(c.ultima, Date.now()) - SOLAPE * 864e5;
  try {
    const { accounts, movements } = await P.leer(env, sec, { desde });
    const snap = { kind: "snapshot", cid, prov: c.prov, banco: c.banco, inst: c.inst, at: Date.now(), desde, primera, motivo, accounts, movements };
    const id = Date.now().toString(36) + azar(4);
    await KV(env).put(`cq:${u}:${String(Date.now()).padStart(14, "0")}:${id}`, JSON.stringify({ id, rec: Date.now(), enc: await cifrarPara(usr.pub, snap) }), { expirationTtl: TTL_COLA });
    c.ultima = Date.now(); c.estado = "ok"; delete c.err; c.n = (c.n || 0) + 1;
    await KV(env).put(key, JSON.stringify(c));
    return { ok: true, cuentas: accounts.length, movimientos: movements.length };
  } catch (e) {
    c.estado = e.status === 401 || e.status === 403 ? "requiere_accion" : "error"; c.err = String(e.message || e).slice(0, 160); c.intento = Date.now();
    await KV(env).put(key, JSON.stringify(c));
    throw e;
  }
}

/* ---------- rutas ---------- */
export async function conecta(req, env, url) {
  const p = url.pathname.replace(/^\/api\/conecta/, "").replace(/\/+$/, "") || "/";
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    if (p === "/estado" && req.method === "GET") {
      const activos = Object.values(PROVEEDORES).filter(x => x.activo(env)).map(x => ({ id: x.id, nombre: x.nombre, cubre: x.cubre }));
      const on = id => activos.some(a => a.id === id);
      const bancos = BANCOS.map(b => ({ id: b.id, name: b.name, cuentas: b.fintoc && on("fintoc") ? "fintoc" : b.khipu && on("khipu") ? "khipu" : b.demo ? "demo" : null, tarjetas: b.khipu && on("khipu") ? "khipu" : b.demo ? "demo" : null, fintocId: b.fintoc || null }));
      return json({ ok: true, v: 1, consentimiento: CONSENTIMIENTO_V, proveedores: activos, bancos, cifrado: !!env.CONECTA_SECRETO });
    }
    if (p === "/registro" && req.method === "POST") {
      const ip = req.headers.get("CF-Connecting-IP") || "x";
      if (!(await limite(env, "cxreg:" + ip, 10, 3600))) return json({ ok: false, error: "demasiados intentos, prueba en una hora" }, 429);
      const b = await req.json().catch(() => ({}));
      if (!b.pub || b.pub.kty !== "RSA" || !b.pub.n || !b.pub.e) return json({ ok: false, error: "falta la llave pública" }, 400);
      try { await crypto.subtle.importKey("jwk", b.pub, { name: "RSA-OAEP", hash: "SHA-256" }, false, ["encrypt"]); } catch (e) { return json({ ok: false, error: "llave pública inválida" }, 400); }
      let u; for (let i = 0; i < 5; i++) { u = azar(12); if (!(await KV(env).get("cu:" + u))) break; }
      const k = azar(40);
      await KV(env).put("cu:" + u, JSON.stringify({ h: await sha(k), at: Date.now(), pub: { kty: "RSA", n: b.pub.n, e: b.pub.e, alg: "RSA-OAEP-256", ext: true } }));
      return json({ ok: true, u, k });
    }
    if (p === "/webhook/fintoc" && req.method === "POST") {
      const cuerpo = await req.text();
      if (!(await fintoc.verificarWebhook(env, req, cuerpo))) return json({ ok: false }, 401);
      const ev = JSON.parse(cuerpo || "{}");
      if (/refresh_intent\.succeeded$/.test(ev.type || "")) {
        const idx = fintoc.indiceDeWebhook(ev); const ref = idx && await KV(env).get("ci:fintoc:" + idx);
        if (ref) { const [u, cid] = ref.split(":"); try { await sincronizar(env, u, cid, { motivo: "webhook" }); } catch (e) { /* queda anotado en la conexión */ } }
      }
      return json({ ok: true });
    }

    // Desde aquí, todo requiere u + k
    const b = req.method === "GET" ? Object.fromEntries(url.searchParams) : await req.json().catch(() => ({}));
    const usr = await usuario(env, b.u, b.k);
    if (!usr) return json({ ok: false, error: "clave" }, 403);
    const u = b.u;

    if (p === "/iniciar" && req.method === "POST") {
      const P = PROVEEDORES[b.prov]; if (!P || !P.activo(env)) return json({ ok: false, error: "proveedor no disponible" }, 400);
      const banco = BANCOS.find(x => x.id === b.banco); if (!banco) return json({ ok: false, error: "banco no disponible" }, 400);
      if (!(await limite(env, "cxini:" + u, 30, 3600))) return json({ ok: false, error: "demasiados intentos, prueba en una hora" }, 429);
      const r = await P.iniciar(env, { banco: banco[b.prov] || banco.id });
      if (r.widget === "fintoc" && banco.fintoc) r.institutionId = banco.fintoc;
      return json({ ok: true, ...r });
    }
    if (p === "/completar" && req.method === "POST") {
      const P = PROVEEDORES[b.prov]; if (!P || !P.activo(env)) return json({ ok: false, error: "proveedor no disponible" }, 400);
      const banco = BANCOS.find(x => x.id === b.banco); if (!banco) return json({ ok: false, error: "banco no disponible" }, 400);
      const cons = b.consentimiento || {};
      if (!cons.acepto || cons.v !== CONSENTIMIENTO_V) return json({ ok: false, error: "falta tu autorización" }, 400);
      if (!(await limite(env, "cxfin:" + u, 15, 3600))) return json({ ok: false, error: "demasiados intentos, prueba en una hora" }, 429);
      const actuales = await conexiones(env, u); if (actuales.length >= 12) return json({ ok: false, error: "máximo 12 conexiones" }, 400);
      // La clave del banco (si el proveedor la pide) se usa aquí y no se guarda en ninguna parte.
      const r = await P.completar(env, { banco: banco[b.prov] || banco.id, exchangeToken: b.exchangeToken, rut: b.rut, clave: b.clave });
      const cid = azar(10), key = `cn:${u}:${cid}`;
      const c = { cid, prov: P.id, banco: banco.id, inst: r.institucion, estado: "ok", creada: Date.now(), ultima: 0, sec: await sellar(env, r.secreto, key),
        consentimiento: { v: CONSENTIMIENTO_V, at: Date.now(), alcance: P.cubre, plazo: cons.plazo || "hasta que la revoques" } };
      await KV(env).put(key, JSON.stringify(c));
      if (r.indice) await KV(env).put(`ci:${P.id}:${r.indice}`, `${u}:${cid}`);
      let sync = null; try { sync = await sincronizar(env, u, cid, { motivo: "primera" }); } catch (e) { sync = { ok: false, error: String(e.message || e) }; }
      return json({ ok: true, conexion: publica((await KV(env).get(key, "json")) || c), sync });
    }
    if (p === "/conexiones" && req.method === "GET") return json({ ok: true, conexiones: (await conexiones(env, u)).map(publica) });
    if (p === "/sincronizar" && req.method === "POST") {
      const L = (await conexiones(env, u)).filter(c => !b.cid || c.cid === b.cid);
      const res = [];
      for (const c of L) {
        if (c.ultima && Date.now() - c.ultima < MIN_MANUAL && !b.cid) { res.push({ cid: c.cid, ok: true, omitida: "reciente" }); continue; }
        try {
          const P = PROVEEDORES[c.prov];
          if (P.refrescar && c.prov === "fintoc" && Date.now() - (c.refresco || 0) > 6 * 60e3) { const sec = await abrir(env, c.sec, `cn:${u}:${c.cid}`); const rf = await P.refrescar(env, sec); if (rf.pedido) { c.refresco = Date.now(); await KV(env).put(`cn:${u}:${c.cid}`, JSON.stringify(c)); } }
          res.push({ cid: c.cid, ...(await sincronizar(env, u, c.cid, { motivo: "app" })) });
        } catch (e) { res.push({ cid: c.cid, ok: false, error: String(e.message || e).slice(0, 160) }); }
      }
      return json({ ok: true, resultados: res });
    }
    if (p === "/datos" && req.method === "GET") {
      const L = await KV(env).list({ prefix: `cq:${u}:`, limit: 50 });
      const items = (await Promise.all(L.keys.map(x => KV(env).get(x.name, "json")))).filter(Boolean);
      return json({ ok: true, items, more: !L.list_complete, conexiones: (await conexiones(env, u)).map(publica) });
    }
    if (p === "/ok" && req.method === "POST") {
      const ids = new Set((b.ids || []).map(String).slice(0, 200));
      const L = await KV(env).list({ prefix: `cq:${u}:`, limit: 1000 });
      const del = L.keys.filter(x => ids.has(x.name.split(":").pop()));
      await Promise.all(del.map(x => KV(env).delete(x.name)));
      return json({ ok: true, borrados: del.length });
    }
    if (p === "/desconectar" && req.method === "POST") {
      if (!cidOk(b.cid)) return json({ ok: false, error: "conexión" }, 400);
      const key = `cn:${u}:${b.cid}`; const c = await KV(env).get(key, "json");
      if (c) await borrarConexion(env, u, c);
      return json({ ok: true });
    }
    if (p === "/baja" && req.method === "POST") {
      for (const c of await conexiones(env, u)) await borrarConexion(env, u, c);
      const L = await KV(env).list({ prefix: `cq:${u}:`, limit: 1000 }); await Promise.all(L.keys.map(x => KV(env).delete(x.name)));
      await KV(env).delete("cu:" + u);
      return json({ ok: true });
    }
    return json({ ok: false, error: "no existe" }, 404);
  } catch (e) {
    const st = e.status && e.status >= 400 && e.status < 600 ? e.status : 500;
    return json({ ok: false, error: st === 500 ? "error interno" : String(e.message || e).slice(0, 200) }, st);
  }
}

async function borrarConexion(env, u, c) {
  const key = `cn:${u}:${c.cid}`;
  try { const P = PROVEEDORES[c.prov]; if (P && P.activo(env)) { const sec = await abrir(env, c.sec, key); await P.desconectar(env, sec); if (sec.linkId) await KV(env).delete(`ci:${c.prov}:${sec.linkId}`); } } catch (e) { /* se borra igual */ }
  await KV(env).delete(key);
}

/** Cron: sincroniza solas las conexiones que llevan rato sin actualizarse. */
export async function conectaProgramado(env) {
  let cursor, n = 0;
  do {
    const L = await KV(env).list({ prefix: "cn:", cursor, limit: 500 }); cursor = L.list_complete ? null : L.cursor;
    for (const x of L.keys) {
      if (n >= 40) return n; // tope por ejecución (límite de subpedidos del Worker)
      const c = await KV(env).get(x.name, "json"); if (!c || c.estado === "requiere_accion") continue;
      const [, u] = x.name.split(":");
      if (Date.now() - (c.ultima || 0) < (CADA[c.prov] || 6 * 3600e3)) continue;
      if (c.intento && Date.now() - c.intento < 3600e3) continue;
      try {
        if (c.prov === "fintoc") { const sec = await abrir(env, c.sec, x.name); const rf = await fintoc.refrescar(env, sec); if (rf.pedido) { c.refresco = Date.now(); c.ultima = Date.now() - CADA.fintoc + 3600e3; await KV(env).put(x.name, JSON.stringify(c)); continue; } }
        await sincronizar(env, u, c.cid, { motivo: "automatica" }); n++;
      } catch (e) { /* queda anotado */ }
    }
  } while (cursor);
  return n;
}
