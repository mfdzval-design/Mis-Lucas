// KV en memoria con la misma interfaz que Cloudflare KV (para pruebas locales)
export function kvMemoria() {
  const m = new Map();
  const vivo = k => { const x = m.get(k); if (!x) return null; if (x.exp && x.exp < Date.now()) { m.delete(k); return null; } return x; };
  return {
    _m: m,
    async get(k, tipo) { const x = vivo(k); if (!x) return null; return tipo === "json" ? JSON.parse(x.v) : x.v; },
    async put(k, v, o = {}) { m.set(k, { v: String(v), exp: o.expirationTtl ? Date.now() + o.expirationTtl * 1000 : 0 }); },
    async delete(k) { m.delete(k); },
    async list({ prefix = "", limit = 1000, cursor } = {}) {
      const ks = [...m.keys()].filter(k => k.startsWith(prefix) && vivo(k)).sort();
      const ini = cursor ? +cursor : 0; const page = ks.slice(ini, ini + limit);
      const fin = ini + limit >= ks.length;
      return { keys: page.map(name => ({ name })), list_complete: fin, cursor: fin ? undefined : String(ini + limit) };
    },
  };
}
