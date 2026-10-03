/**
 * Mis Lucas · Servidor del buzón (Cloudflare Worker)
 * ------------------------------------------------------------
 * CIFRADO: al activar, la app manda su llave pública. Cada cosa que llega
 * se guarda cifrada con esa llave (AES-GCM + RSA-OAEP): solo la app de
 * esa persona puede leerla. Ni el administrador del servidor puede.
 *
 * Cada persona activa su buzón desde la app y recibe una dirección
 * propia (código@DOMINIO). Lo que llega ahí —correos del banco
 * reenviados desde Gmail, o compras con Apple Pay que manda el atajo—
 * queda guardado SOLO hasta que la app lo recoge, y luego se borra.
 *
 * Necesita:
 *  - Un espacio KV enlazado como BUZON.
 *  - Variable DOMINIO (ej: mislucas.app).
 *  - Email Routing del dominio con «catch-all» → este Worker.
 */

const TTL = 30 * 24 * 3600;          // lo no recogido se borra solo a los 30 días
const MAX_TEXTO = 3000;
const ALFA = "abcdefghjkmnpqrstuvwxyz23456789"; // sin letras que se confunden

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
};
const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...cors } });

function azar(n, alfa = ALFA) { const b = crypto.getRandomValues(new Uint8Array(n)); let s = ""; for (const x of b) s += alfa[x % alfa.length]; return s; }
async function sha(s) { const h = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)); return [...new Uint8Array(h)].map(b => b.toString(16).padStart(2, "0")).join(""); }
const codigoOk = c => /^[a-z0-9]{8}$/.test(c || "");

async function autoriza(env, c, k) {
  if (!codigoOk(c) || !k) return null;
  const u = await env.BUZON.get("u:" + c, "json");
  if (!u || u.h !== await sha(k)) return null;
  return u;
}

const b64 = buf => { let s = ""; const b = new Uint8Array(buf); for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]); return btoa(s); };
async function cifrar(pubJwk, obj) {
  const pub = await crypto.subtle.importKey("jwk", pubJwk, { name: "RSA-OAEP", hash: "SHA-256" }, false, ["encrypt"]);
  const aes = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt"]);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, aes, new TextEncoder().encode(JSON.stringify(obj)));
  const k = await crypto.subtle.encrypt({ name: "RSA-OAEP" }, pub, await crypto.subtle.exportKey("raw", aes));
  return { k: b64(k), iv: b64(iv), ct: b64(ct) };
}

async function guardar(env, c, item, u) {
  const rec = Date.now();
  const id = rec.toString(36) + azar(4);
  const datos = { text: String(item.text || "").slice(0, MAX_TEXTO), subject: String(item.subject || "").slice(0, 200), from: String(item.from || "").slice(0, 200) };
  if (item.extra) datos.extra = item.extra;
  if (!u) u = await env.BUZON.get("u:" + c, "json");
  const it = { id, rec, date: item.date || rec, kind: item.kind };
  if (u && u.pub) it.enc = await cifrar(u.pub, datos); else Object.assign(it, datos);
  await env.BUZON.put(`m:${c}:${String(rec).padStart(14, "0")}:${id}`, JSON.stringify(it), { expirationTtl: TTL });
  return it;
}

async function limite(env, clave, max, segs) {
  const k = "rl:" + clave; const n = +(await env.BUZON.get(k)) || 0;
  if (n >= max) return false;
  await env.BUZON.put(k, String(n + 1), { expirationTtl: segs });
  return true;
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (req.method === "OPTIONS") return new Response(null, { headers: cors });
    const p = url.pathname.replace(/\/+$/, "");
    try {
      // 1. Activar un buzón nuevo
      if (p === "/api/registro" && req.method === "POST") {
        const ip = req.headers.get("CF-Connecting-IP") || "x";
        if (!(await limite(env, "reg:" + ip, 10, 3600))) return json({ ok: false, error: "demasiados intentos, prueba en una hora" }, 429);
        let c; for (let i = 0; i < 5; i++) { c = azar(8); if (!(await env.BUZON.get("u:" + c))) break; }
        const k = azar(32, "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789");
        const body = await req.json().catch(() => ({}));
        let pub = null;
        if (body && body.pub && body.pub.kty === "RSA" && body.pub.n && body.pub.e) {
          try { await crypto.subtle.importKey("jwk", body.pub, { name: "RSA-OAEP", hash: "SHA-256" }, false, ["encrypt"]); pub = { kty: "RSA", n: body.pub.n, e: body.pub.e, alg: "RSA-OAEP-256", ext: true }; } catch (e) { pub = null; }
        }
        await env.BUZON.put("u:" + c, JSON.stringify({ h: await sha(k), at: Date.now(), pub }));
        return json({ ok: true, code: c, key: k, address: `${c}@${env.DOMINIO}`, cifrado: !!pub });
      }
      // 2. La app pide lo nuevo
      if (p === "/api/buzon" && req.method === "GET") {
        const c = url.searchParams.get("c"), k = url.searchParams.get("k");
        if (!(await autoriza(env, c, k))) return json({ ok: false, error: "clave" }, 403);
        const L = await env.BUZON.list({ prefix: `m:${c}:`, limit: 100 });
        const items = (await Promise.all(L.keys.map(x => env.BUZON.get(x.name, "json")))).filter(Boolean);
        return json({ ok: true, items, more: !L.list_complete, now: Date.now() });
      }
      // 3. La app confirma lo que ya guardó → se borra del servidor
      if (p === "/api/buzon/ok" && req.method === "POST") {
        const b = await req.json().catch(() => ({}));
        if (!(await autoriza(env, b.c, b.k))) return json({ ok: false, error: "clave" }, 403);
        const ids = new Set((b.ids || []).map(String).slice(0, 200));
        const L = await env.BUZON.list({ prefix: `m:${b.c}:`, limit: 1000 });
        const del = L.keys.filter(x => ids.has(x.name.split(":").pop()));
        await Promise.all(del.map(x => env.BUZON.delete(x.name)));
        return json({ ok: true, borrados: del.length });
      }
      // 4. Compras con Apple Pay desde el atajo del iPhone
      if (p === "/api/ap" && req.method === "POST") {
        const c = url.searchParams.get("c"), k = url.searchParams.get("k");
        const u = await autoriza(env, c, k);
        if (!u) return json({ ok: false, error: "clave" }, 403);
        const ct = req.headers.get("Content-Type") || "";
        let l = "";
        if (/form/.test(ct)) { const f = await req.formData(); l = f.get("l") || f.get("linea") || ""; }
        else if (/json/.test(ct)) { const j = await req.json().catch(() => ({})); l = j.l || j.linea || ""; }
        else l = await req.text();
        l = String(l).trim();
        if (!l) return json({ ok: false, error: "vacío" }, 400);
        if (!(await limite(env, "ap:" + c, 300, 86400))) return json({ ok: false, error: "límite diario" }, 429);
        const kind = /^MLV\s*\|/.test(l) ? "voz" : /^ML\s*\|/.test(l) ? "ap" : "texto";
        await guardar(env, c, { kind, text: l.slice(0, 1000), from: "atajo" }, u);
        return json({ ok: true });
      }
      // 5. Desactivar (borra todo)
      if (p === "/api/baja" && req.method === "POST") {
        const b = await req.json().catch(() => ({}));
        if (!(await autoriza(env, b.c, b.k))) return json({ ok: false, error: "clave" }, 403);
        const L = await env.BUZON.list({ prefix: `m:${b.c}:`, limit: 1000 });
        await Promise.all(L.keys.map(x => env.BUZON.delete(x.name)));
        await env.BUZON.delete("u:" + b.c);
        return json({ ok: true });
      }
      if (p === "" || p === "/api") return json({ ok: true, app: "Mis Lucas · buzón", v: 1 });
      return json({ ok: false, error: "no existe" }, 404);
    } catch (e) {
      return json({ ok: false, error: "error interno" }, 500);
    }
  },

  // Correos que llegan a código@DOMINIO
  async email(message, env) {
    const c = String(message.to || "").split("@")[0].toLowerCase().replace(/\+.*$/, "");
    const u = codigoOk(c) ? await env.BUZON.get("u:" + c, "json") : null;
    if (!u) { message.setReject("Buzón no existe"); return; }
    if (!(await limite(env, "mail:" + c, 500, 86400))) { message.setReject("Límite diario"); return; }
    const raw = new Uint8Array(await new Response(message.raw).arrayBuffer());
    const m = leerCorreo(raw);
    const from = m.headers["from"] || message.from || "";
    const subject = m.headers["subject"] || "";
    const fecha = Date.parse(m.headers["date"] || "") || Date.now();
    const texto = (m.text || htmlATexto(m.html) || "").replace(/\s+/g, " ").trim();
    // Confirmación de reenvío de Gmail: mostrar el código dentro de la app
    if (/forwarding-noreply@google\.com/i.test(from) || /gmail.*(forwarding|reenv[ií]o)/i.test(subject)) {
      const cod = (subject.match(/#\s?(\d{6,12})/) || texto.match(/(?:c[oó]digo de confirmaci[oó]n|confirmation code)[^\d]{0,20}(\d{6,12})/i) || [])[1] || "";
      const link = (texto.match(/https:\/\/mail(?:-settings)?\.google\.com\/mail\/[^\s"'<>]+/) || [])[0] || "";
      await guardar(env, c, { kind: "confirm", subject, from, date: fecha, text: cod ? `Código ${cod}` : texto.slice(0, 300), extra: { code: cod, link } }, u);
      return;
    }
    await guardar(env, c, { kind: "mail", subject, from, date: fecha, text: texto }, u);
  },
};

/* ---------- lector mínimo de correos (MIME) ---------- */
function bytesATexto(b, charset) {
  const cs = String(charset || "utf-8").toLowerCase().replace(/^"|"$/g, "");
  try { return new TextDecoder(/8859|latin|1252|ascii/.test(cs) ? "windows-1252" : cs).decode(b); }
  catch (e) { return new TextDecoder("utf-8").decode(b); }
}
function decodificar(cuerpo, enc, charset) {
  enc = String(enc || "").toLowerCase();
  if (enc === "base64") { const s = atob(cuerpo.replace(/[^A-Za-z0-9+/=]/g, "")); const b = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i); return bytesATexto(b, charset); }
  if (enc === "quoted-printable") {
    const s = cuerpo.replace(/=\r?\n/g, ""); const out = [];
    for (let i = 0; i < s.length; i++) { if (s[i] === "=" && /^[0-9A-F]{2}$/i.test(s.substr(i + 1, 2))) { out.push(parseInt(s.substr(i + 1, 2), 16)); i += 2; } else out.push(s.charCodeAt(i) & 255); }
    return bytesATexto(new Uint8Array(out), charset);
  }
  const b = new Uint8Array(cuerpo.length); for (let i = 0; i < cuerpo.length; i++) b[i] = cuerpo.charCodeAt(i) & 255;
  return bytesATexto(b, charset);
}
function utf8Crudo(s) { // encabezados en UTF-8 sin codificar (se leyeron como latin1)
  if (!/[\u0080-\u00ff]/.test(s)) return s;
  const b = new Uint8Array([...s].map(ch => ch.charCodeAt(0) & 255));
  try { return new TextDecoder("utf-8", { fatal: true }).decode(b); } catch (e) { return s; }
}
function encabezadoMime(v) { // =?UTF-8?B?...?= / =?ISO-8859-1?Q?...?=
  return utf8Crudo(String(v || "")).replace(/=\?([^?]+)\?([bqBQ])\?([^?]*)\?=\s*/g, (_, cs, t, d) => t.toUpperCase() === "B" ? decodificar(d, "base64", cs) : decodificar(d.replace(/_/g, " "), "quoted-printable", cs));
}
function separar(txt) {
  const i = txt.search(/\r?\n\r?\n/); const h = i < 0 ? txt : txt.slice(0, i); const body = i < 0 ? "" : txt.slice(i).replace(/^\r?\n\r?\n/, "");
  const headers = {}; h.replace(/\r?\n[ \t]+/g, " ").split(/\r?\n/).forEach(l => { const j = l.indexOf(":"); if (j > 0) { const k = l.slice(0, j).trim().toLowerCase(); if (!(k in headers)) headers[k] = l.slice(j + 1).trim(); } });
  return { headers, body };
}
function parteMime(txt, out, nivel = 0) {
  const { headers, body } = separar(txt);
  const ct = headers["content-type"] || "text/plain"; const enc = headers["content-transfer-encoding"];
  const charset = (ct.match(/charset="?([^";\s]+)/i) || [])[1];
  const bnd = (ct.match(/boundary="?([^";]+)"?/i) || [])[1];
  if (/^multipart\//i.test(ct) && bnd && nivel < 6) {
    body.split("--" + bnd).slice(1).forEach(p => { if (/^--/.test(p)) return; parteMime(p.replace(/^\r?\n/, ""), out, nivel + 1); });
  } else if (/^message\/rfc822/i.test(ct) && nivel < 6) { parteMime(body, out, nivel + 1); }
  else if (/^text\/plain/i.test(ct)) out.text += decodificar(body, enc, charset) + " ";
  else if (/^text\/html/i.test(ct)) out.html += decodificar(body, enc, charset) + " ";
  return headers;
}
function leerCorreo(raw) {
  const txt = new TextDecoder("latin1").decode(raw);
  const out = { text: "", html: "" };
  const h = parteMime(txt, out);
  const headers = {}; Object.keys(h).forEach(k => headers[k] = encabezadoMime(h[k]));
  return { headers, text: out.text.trim(), html: out.html.trim() };
}
function htmlATexto(h) {
  if (!h) return "";
  const ent = { nbsp: " ", amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", dollar: "$", aacute: "á", eacute: "é", iacute: "í", oacute: "ó", uacute: "ú", ntilde: "ñ", Aacute: "Á", Eacute: "É", Iacute: "Í", Oacute: "Ó", Uacute: "Ú", Ntilde: "Ñ", uuml: "ü", deg: "°", ordm: "º" };
  return h.replace(/<(style|script|head)[\s\S]*?<\/\1>/gi, " ").replace(/<br\s*\/?>|<\/(p|div|tr|td|th|li|h\d)>/gi, " ").replace(/<[^>]+>/g, " ")
    .replace(/&#x([0-9a-f]+);/gi, (_, x) => String.fromCodePoint(parseInt(x, 16))).replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d)).replace(/&([a-z]+);/gi, (m, n) => ent[n] ?? m);
}
