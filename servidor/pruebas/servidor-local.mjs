// Servidor local para probar la app + conexión bancaria sin Cloudflare:
//   node servidor/pruebas/servidor-local.mjs [puerto]
// Sirve la app en http://localhost:PUERTO/ y el Worker en /api/… (KV en memoria, solo Banco Demo
// salvo que pongas FINTOC_SECRET_KEY / FINTOC_PUBLIC_KEY / KHIPU_API_KEY en el entorno).
import http from "node:http";
import { readFile } from "node:fs/promises";
import { join, extname, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import worker from "../buzon.js";
import { kvMemoria } from "./kv-memoria.mjs";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const PUERTO = +(process.argv[2] || 8787);
const env = { BUZON: kvMemoria(), DOMINIO: "localhost", CONECTA_SECRETO: process.env.CONECTA_SECRETO || "solo-para-pruebas-locales-0123456789",
  FINTOC_SECRET_KEY: process.env.FINTOC_SECRET_KEY, FINTOC_PUBLIC_KEY: process.env.FINTOC_PUBLIC_KEY, KHIPU_API_KEY: process.env.KHIPU_API_KEY };
const TIPOS = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css", ".png": "image/png", ".woff2": "font/woff2", ".webmanifest": "application/manifest+json", ".json": "application/json" };

http.createServer(async (rq, rs) => {
  try {
    const url = new URL(rq.url, `http://localhost:${PUERTO}`);
    if (url.pathname.startsWith("/api")) {
      const body = ["GET", "HEAD", "OPTIONS"].includes(rq.method) ? undefined : await new Promise(r => { const c = []; rq.on("data", d => c.push(d)); rq.on("end", () => r(Buffer.concat(c))); });
      const r = await worker.fetch(new Request(url, { method: rq.method, headers: rq.headers, body }), env, {});
      rs.writeHead(r.status, Object.fromEntries(r.headers)); rs.end(Buffer.from(await r.arrayBuffer())); return;
    }
    const f = join(RAIZ, decodeURIComponent(url.pathname === "/" ? "/index.html" : url.pathname));
    if (!f.startsWith(RAIZ) || f.includes("/servidor/")) { rs.writeHead(404); rs.end(); return; }
    const data = await readFile(f); rs.writeHead(200, { "Content-Type": TIPOS[extname(f)] || "application/octet-stream" }); rs.end(data);
  } catch (e) { rs.writeHead(404); rs.end("no existe"); }
}).listen(PUERTO, () => console.log(`Mis Lucas local: http://localhost:${PUERTO}/  (API en /api)`));
