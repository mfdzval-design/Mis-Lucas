# Modelo normalizado (lo que todo proveedor entrega a la app)

Cada sincronización produce un **snapshot**, que viaja cifrado a la app:

```js
{
  kind: "snapshot", cid, prov, banco, inst: { id, name }, at, desde, primera, motivo,
  accounts: [Cuenta], movements: [Movimiento]
}
```

## Cuenta
| Campo | Tipo | Notas |
|---|---|---|
| `id` | string | id del proveedor (estable) |
| `type` | `cc` · `vista` · `ahorro` · `tc` | igual a los tipos de cuenta de la app |
| `name`, `officialName` | string | |
| `last4` | string | para reconocer la cuenta que ya existe en la app |
| `currency` | `CLP` · `USD` | |
| `balance` | `{ available, current, withLine? }` | cuentas: saldo disponible y contable |
| `creditLine` | `{ limit, used, available }` | línea de crédito de la cuenta corriente (si viene) |
| `credit` | ver abajo | solo tarjetas de crédito |

`credit`: `{ limit, used, available, billed, billedTotal, unbilled, installmentsPending, minPayment, dueDate, closeDate, nextCloseDate, intlLimit, intlUsed, intlCurrency }`
(cualquier campo puede venir `null` si el proveedor no lo entrega).

## Movimiento
| Campo | Tipo | Notas |
|---|---|---|
| `id` | string | id del proveedor; la app lo guarda como `extId = "bk|<prov>|<id>"` |
| `accountId` | string | |
| `date` | `AAAA-MM-DD` | fecha de la transacción |
| `postDate` | `AAAA-MM-DD` | fecha contable (opcional) |
| `desc` | string | texto del banco |
| `amount` | número | **con signo**: negativo = cargo/compra, positivo = abono/pago |
| `currency` | string | si no es CLP la app lo convierte con el dólar del día |
| `kind` | `compra` · `transferencia` · `abono` · `pago` · `cargo` · `comision` | `pago` = pago de tarjeta (va a «Entre mis cuentas») |
| `pending` | bool | compra no facturada / no contabilizada; al confirmarse se actualiza la misma |
| `installments` | `{ n, total }` | cuotas |
| `counterpart` | string | nombre de quien envía o recibe una transferencia |
| `original` | `{ currency, amount }` | monto original de una compra internacional |

## Cómo lo usa la app
- Cuenta: se busca por `cx` (vínculo guardado), luego por últimos 4 dígitos y tipo, luego por banco y tipo; si no existe se crea.
- Movimiento: si ya existe su `extId`, se ignora (o se marca confirmado si era pendiente). Si calza con algo anotado
  a mano / buzón / Apple Pay / captura (mismo monto o ±6 % con palabra en común, ±5 días, misma cuenta o mismo tipo),
  se **junta** (queda el monto del banco y la categoría de la persona). Si no, entra nuevo con categoría.
- Al subir después una cartola de una cuenta conectada, lo que ya trajo el banco aparece como «repetido».
