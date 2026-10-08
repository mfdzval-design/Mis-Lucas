/**
 * Proveedor «Banco Demo»: banco de prueba completo (cuenta + tarjeta con cupo)
 * para probar todo el flujo sin datos reales. Usa el mismo motor que la app.
 */
import "../../conecta-demo.js";
const B = globalThis.MLDemoBank;

export const demo = {
  id: "demo",
  nombre: "Banco Demo",
  activo: () => true,
  cubre: { cuentas: true, tarjetas: true },
  bancos: ["demo"],
  pideClave: true,
  async iniciar() {
    return { tipo: "clave", campos: [{ id: "rut", label: "RUT (cualquiera)", ph: "11.111.111-1" }, { id: "clave", label: "Clave (escribe «demo»)", secreta: true }] };
  },
  async completar(env, { rut, clave }) {
    if (!B.login(rut, clave)) throw Object.assign(new Error("RUT o clave incorrectos (la clave de prueba es «demo»)"), { status: 400 });
    const seed = [...crypto.getRandomValues(new Uint8Array(8))].map(b => b.toString(16).padStart(2, "0")).join("");
    return { secreto: { seed, creada: Date.now() }, indice: null, institucion: { id: "demo", name: "Banco Demo" } };
  },
  async leer(env, s, { desde }) { const x = B.snapshot(s.seed, s.creada, Date.now(), desde); return { accounts: x.accounts, movements: x.movements }; },
  async refrescar() { return { pedido: false }; },
  async desconectar() {},
};
