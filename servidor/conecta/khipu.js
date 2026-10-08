/**
 * Proveedor Khipu «Open Data» — TARJETAS DE CRÉDITO (y cuentas).
 * ------------------------------------------------------------
 * Fintoc no trae tarjetas de crédito; Khipu sí expone, por banco, los
 * movimientos facturados y no facturados de la tarjeta.
 *   https://docs.khipu.com/en/apis/v1/cl/banking/personal/<banco>/openapi
 *
 * IMPORTANTE (privacidad): Khipu no tiene widget propio para esto. La clave
 * del banco viaja UNA VEZ por este servidor hacia Khipu para obtener un
 * «AccountLink» (token). El servidor NO guarda la clave: solo guarda el token,
 * cifrado. La app se lo explica a la persona antes de pedirla.
 *
 * ESTADO: adaptador preparado según la documentación pública (oct-2026), aún
 * sin probar contra el API real: requiere contrato con Khipu (KHIPU_API_KEY).
 * Las rutas que no están 100% confirmadas están juntas en RUTAS para
 * ajustarlas en un solo lugar cuando Khipu entregue el acceso.
 */
const BASE = "https://api.khipu.com/v1/cl/banking/personal";
const RUTAS = {
  token: "/token",                                   // confirmado (marcado «deprecated», migrar a OAuth)
  productos: "/products",                            // por confirmar
  saldos: "/current-balances",                       // por confirmar
  noFacturados: "/credit-card/unbilled-transactions",// confirmado
  facturados: "/credit-card/billed-transactions",    // confirmado
};
// Bancos con API personal documentada en Khipu (slug de Khipu)
const BANCOS = { santander: "santander.cl", itau: "itau.cl", chile: "bancochile.cl", bci: "bci.cl", consorcio: "consorcio.cl" };

export const khipu = {
  id: "khipu",
  nombre: "Khipu Open Data",
  activo: env => !!env.KHIPU_API_KEY,
  cubre: { cuentas: true, tarjetas: true },
  bancos: Object.keys(BANCOS),
  pideClave: true,

  async req(env, banco, ruta, body) {
    const slug = BANCOS[banco]; if (!slug) throw Object.assign(new Error("banco no disponible con Khipu"), { status: 400 });
    const r = await fetch(`${BASE}/${slug}${ruta}`, { method: "POST", headers: { "x-api-key": env.KHIPU_API_KEY, "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify(body || {}) });
    const j = await r.json().catch(() => null);
    if (!r.ok || !j || j.Status !== "OK") {
      const e = (j && j.Error) || {};
      const err = new Error(e.Description || `Khipu ${r.status}`); err.status = r.status === 401 ? 401 : r.status >= 500 ? 502 : 400; err.reintentar = e.Type; throw err;
    }
    return j.Data;
  },

  async iniciar(env, { banco }) {
    if (!BANCOS[banco]) throw Object.assign(new Error("banco no disponible"), { status: 400 });
    return { tipo: "clave", campos: [{ id: "rut", label: "RUT", ph: "12.345.678-9" }, { id: "clave", label: "Clave de internet del banco", secreta: true }] };
  },

  /** Recibe RUT y clave, los usa una sola vez para obtener el token y los olvida. */
  async completar(env, { banco, rut, clave }) {
    if (!rut || !clave) throw Object.assign(new Error("falta RUT o clave"), { status: 400 });
    let data;
    try { data = await this.req(env, banco, RUTAS.token, { Username: String(rut).slice(0, 12), Password: String(clave).slice(0, 24) }); }
    catch (e) { if (e.status === 401 || e.status === 400) throw Object.assign(new Error("El banco no aceptó el RUT o la clave"), { status: 400 }); throw e; }
    if (!data || !data.AccountLink) throw Object.assign(new Error("el banco no aceptó la conexión"), { status: 400 });
    return { secreto: { banco, link: data.AccountLink }, indice: null, institucion: { id: banco, name: nombreBanco(banco) } };
  },

  async leer(env, s, { desde }) {
    const cred = { AccountLink: s.link };
    const accounts = [], movements = [];
    let prods = [];
    try { const d = await this.req(env, s.banco, RUTAS.productos, { RequestData: { AccountCredential: cred } }); prods = (d && (d.Product || d.Products || d.Account || d.Accounts)) || []; } catch (e) { prods = []; }
    let saldos = [];
    try { const d = await this.req(env, s.banco, RUTAS.saldos, { RequestData: { AccountCredential: cred } }); saldos = (d && (d.Balance || d.Balances)) || []; } catch (e) { saldos = []; }
    for (const p of prods) {
      const id = String(p.AccountId || p.ProductId || p.Id || p.Number || "");
      const esTC = /credit|cr[eé]dito|tarjeta/i.test(String(p.ProductType || p.Type || p.Name || ""));
      const sal = saldos.filter(b => String(b.AccountId || "") === id);
      const monto = t => { const b = sal.find(x => new RegExp(t, "i").test(String(x.Type || x.BalanceType || ""))); return b ? Math.round(Number((b.Amount && b.Amount.Amount) || b.Amount || 0)) : null; };
      const last4 = String(p.LastDigits || p.Number || id).replace(/\D/g, "").slice(-4);
      if (esTC) {
        const limit = monto("limit|cupo|credit ?line"), avail = monto("available|disponible");
        accounts.push({ id, type: "tc", name: p.Name || "Tarjeta de crédito", last4, currency: "CLP", credit: { limit, available: avail, used: limit != null && avail != null ? limit - avail : null, billed: monto("billed|facturad"), minPayment: monto("minimum|m[ií]nimo"), dueDate: p.DueDate || null } });
        for (const tipo of ["National", "International"]) {
          for (const ruta of [RUTAS.noFacturados, RUTAS.facturados]) {
            try {
              const d = await this.req(env, s.banco, ruta, { RequestData: { TransactionType: tipo, LastDigits: last4, AccountCredential: cred } });
              for (const t of (d && d.Transaction) || []) movements.push(mov(id, t, ruta === RUTAS.noFacturados, tipo));
            } catch (e) { if (e.status === 401) throw e; }
          }
        }
      } else {
        accounts.push({ id, type: /vista|rut|sight/i.test(String(p.ProductType || p.Name || "")) ? "vista" : "cc", name: p.Name || "Cuenta", last4, currency: "CLP", balance: { available: monto("available|disponible"), current: monto("current|contable|booked") } });
      }
    }
    const lim = desde ? new Date(desde).toISOString().slice(0, 10) : "";
    return { accounts, movements: movements.filter(m => !lim || m.date >= lim) };
  },
  async refrescar() { return { pedido: false, motivo: "Khipu se consulta directo al sincronizar" }; },
  async desconectar() { /* el token se borra de este servidor; Khipu no requiere aviso */ },
};

function nombreBanco(b) { return { santander: "Santander", itau: "Itaú", chile: "Banco de Chile", bci: "BCI", consorcio: "Banco Consorcio" }[b] || b; }
function mov(accountId, t, pendiente, tipo) {
  const amt = Math.round(Number((t.Amount && t.Amount.Amount) || 0));
  const signo = t.CreditDebitIndicator === "Credit" ? 1 : -1;
  const o = { id: String(t.TransactionId), accountId, date: String(t.BookingDateTime || "").slice(0, 10), desc: String(t.TransactionInformation || "Compra").trim(), amount: signo * Math.abs(amt), currency: (t.Amount && t.Amount.Currency) || "CLP", kind: signo > 0 ? "pago" : "compra", pending: pendiente || t.Status === "Pending" };
  if (t.Instalment && t.Instalment.InstalmentsNumber > 1) o.installments = { n: t.Instalment.CurrentInstalmentNumber, total: t.Instalment.InstalmentsNumber };
  if (tipo === "International") o.international = true;
  return o;
}
