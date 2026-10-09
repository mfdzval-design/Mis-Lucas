// Verifica que las llaves de Fintoc funcionan (no conecta ningún banco, solo prueba las llaves):
//   FINTOC_SECRET_KEY=sk_test_… FINTOC_PUBLIC_KEY=pk_test_… node servidor/pruebas/verificar-fintoc.mjs
const sk = process.env.FINTOC_SECRET_KEY || "", pk = process.env.FINTOC_PUBLIC_KEY || "";
if (!/^sk_(test|live)_/.test(sk) || !/^pk_(test|live)_/.test(pk)) { console.log("✗ Faltan las llaves (sk_test_… y pk_test_…)"); process.exit(1); }
if (sk.split("_")[1] !== pk.split("_")[1]) { console.log("✗ Las dos llaves deben ser del mismo modo (test o live)"); process.exit(1); }
const r = await fetch("https://api.fintoc.com/v1/link_intents", { method: "POST", headers: { Authorization: sk, "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify({ country: "cl", holder_type: "individual", product: "movements" }) });
const j = await r.json().catch(() => ({}));
if (r.ok && j.widget_token) console.log(`✓ Llaves OK (modo ${j.mode}). Fintoc entregó un widget_token: el flujo de conexión de cuentas está habilitado.`);
else if (r.status === 401) console.log("✗ Fintoc rechazó la llave secreta (401). Revisa que la copiaste completa.");
else if (r.status === 402) console.log("✗ Fintoc pide activar un plan o la prueba expiró (402).");
else console.log(`✗ Fintoc respondió ${r.status}: ${JSON.stringify(j.error || j).slice(0, 200)} — puede que el producto «Movimientos» no esté activado en tu organización.`);
