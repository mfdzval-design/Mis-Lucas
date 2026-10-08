# Mis Lucas Conecta · conexión con bancos

Conecta las cuentas y tarjetas de cada persona para ver al instante saldos, cupos, deudas,
vencimientos y cada compra o transferencia, sin subir cartolas.

## Cómo funciona

```
 App (teléfono)                        Servidor Mis Lucas (Cloudflare Worker)          Proveedor            Banco
 ──────────────                        ──────────────────────────────────────          ─────────            ─────
 1. Elige banco + autoriza  ─────────▶ /api/conecta/iniciar ───────────────────────▶  Fintoc / Khipu
 2. Escribe su clave en el widget de Fintoc (la app y el servidor nunca la ven)  ───▶  Fintoc  ────────▶  Banco
    o, para tarjetas (Khipu), la clave pasa UNA vez y se descarta
 3. /completar  ─────────────────────▶ guarda solo el TOKEN del proveedor, cifrado (AES-GCM)
                                       lee cuentas, cupos y movimientos ◀──────────  API del proveedor
                                       los cifra con la llave pública del teléfono (RSA-OAEP + AES-GCM)
 4. /datos  ◀───────────────────────── cola cifrada (se borra apenas la app la recoge)
 5. Los movimientos entran a la lista de Mis Lucas, con categoría, y se juntan con buzón,
    Apple Pay, capturas y cartolas sin duplicar.
 6. Solo: cron cada 30 min + webhooks de Fintoc → datos frescos aunque la app esté cerrada.
```

| Qué | Proveedor | Estado |
|---|---|---|
| Cuentas corrientes y vista (saldos, transferencias, sueldo, débito) — Banco de Chile, Santander, Itaú, BCI, BancoEstado, Scotiabank, BICE | **Fintoc** (widget propio, la clave nunca pasa por Mis Lucas) | Listo; probado con respuestas simuladas según su documentación. Falta probar con llaves `sk_test_` reales. |
| Tarjetas de crédito (cupo, facturado, no facturado, cuotas, vencimiento) — Santander, Banco de Chile, Itaú, BCI, Consorcio | **Khipu Open Data** | Preparado según su documentación pública. Requiere contrato con Khipu y confirmar 2 rutas (`RUTAS` en `khipu.js`). |
| Banco de prueba con cuenta + tarjeta | **Banco Demo** | Funciona hoy (en el servidor y dentro del teléfono). |
| Todo lo anterior por vía oficial | **Sistema de Finanzas Abiertas (CMF)** | Obligatorio para bancos desde jul-2027 en adelante (por etapas). Agregar un adaptador más con la misma interfaz. |

Mientras un banco no tenga tarjetas por API, sus compras con tarjeta siguen entrando solas por el
**buzón** (correos del banco) y Apple Pay, y el cupo con la cartola PDF.

## Puesta en marcha (una vez)

1. **Clave de cifrado del servidor** (obligatoria, cualquier texto largo al azar):
   `cd servidor && npx wrangler secret put CONECTA_SECRETO`
   ⚠️ Si se pierde o cambia, hay que reconectar todos los bancos.
2. **Fintoc** (cuentas): crear cuenta en https://dashboard.fintoc.com → API Keys.
   - `npx wrangler secret put FINTOC_SECRET_KEY` (sk_test_… para probar, sk_live_… en producción)
   - en `wrangler.toml` → `[vars] FINTOC_PUBLIC_KEY = "pk_test_…"`
   - Webhooks → nuevo endpoint `https://buzon.mislucasapp.com/api/conecta/webhook/fintoc`, evento
     `account.refresh_intent.succeeded`; copiar su secreto: `npx wrangler secret put FINTOC_WEBHOOK_SECRET`
   - Pedir a Fintoc el permiso de «refresh intents» bajo demanda (si no, se actualiza según su calendario).
3. **Khipu** (tarjetas): pedir acceso a Open Data / Banking API a Khipu → `npx wrangler secret put KHIPU_API_KEY`.
   Con su documentación privada, confirmar las rutas `productos` y `saldos` en `khipu.js`.
4. Publicar: `cd servidor && npx wrangler deploy` (sube buzón + conexión bancaria juntos; el buzón sigue igual).
5. En la app no hay nada que cambiar: detecta sola qué bancos están disponibles (`/api/conecta/estado`).

Sin pasos 2 y 3, la app ofrece solo el **Banco Demo**. Sin el paso 1, el servidor no conecta nada.

## Probar en el computador

```
node servidor/pruebas/prueba-conecta.mjs          # 20 pruebas del servidor (Fintoc, Khipu y Demo simulados)
node servidor/pruebas/servidor-local.mjs 8787     # app + servidor en http://localhost:8787
node servidor/pruebas/e2e-conecta.mjs . servidor  # navegador: conectar, sincronizar, no duplicar, desconectar
node servidor/pruebas/e2e-conecta.mjs . local     # lo mismo sin servidor (Banco Demo en el teléfono)
node servidor/pruebas/e2e-juntar.mjs              # se junta con el buzón; pendiente→confirmado sin duplicar
```
(Las pruebas de navegador usan Playwright: `npm i playwright`.)

## Archivos
- `conecta.js` — rutas, cifrado, sincronización, cron.
- `fintoc.js`, `khipu.js`, `demo.js` — un adaptador por proveedor, todos devuelven el modelo de `MODELO.md`.
- `../../conecta-demo.js` — motor del Banco Demo (lo usan el servidor y la app).
- En `index.html`, el bloque `MIS LUCAS CONECTA` (antes de `boot()`): pantalla «Bancos conectados»,
  tarjeta del Inicio, avisos de vencimiento y cupo, y la unión con buzón y cartolas.
- `LEGAL.md` — marco legal y qué falta antes de abrirlo a usuarios externos.

## Costos
- Cloudflare: dentro del plan gratis para decenas de usuarios (KV + cron).
- Fintoc: según su plan de Movimientos (consultar; en 2026 tenían un tramo gratis para pocas cuentas de personas).
- Khipu: según contrato.
