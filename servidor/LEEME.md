# Servidor del buzón de Mis Lucas

Recibe los correos del banco que cada persona reenvía desde su Gmail a su dirección
propia (`código@dominio`) y las compras con Apple Pay que manda el atajo del iPhone.
Guarda cada cosa **solo hasta que la app la recoge** (máximo 30 días) y luego la borra.

## Puesta en marcha (una vez)
1. Cuenta en Cloudflare y dominio (ej. `mislucas.app`) en Cloudflare Registrar.
2. Workers & Pages → Crear Worker «mislucas-buzon» → pegar `buzon.js`.
3. Storage → KV → crear «BUZON» y enlazarlo al Worker con el nombre `BUZON`.
4. Variable del Worker: `DOMINIO = <dominio>`.
5. Dominio personalizado del Worker: `buzon.<dominio>`.
6. Email → Email Routing → activar → «Catch-all» → «Send to a Worker» → mislucas-buzon.
7. En `index.html`, `BUZON_API = "https://buzon.<dominio>"`.

## API
- `POST /api/registro` → `{code, key, address}`
- `GET  /api/buzon?c=&k=` → lo pendiente
- `POST /api/buzon/ok {c,k,ids}` → borra lo ya recogido
- `POST /api/ap?c=&k=` (form `l=ML|…`) → compra Apple Pay
- `POST /api/baja {c,k}` → desactiva y borra todo

## Estado actual (3-oct-2026)
- Dominio: mislucasapp.com (Cloudflare Registrar, renovación automática).
- Worker: `worker-lucky-mud-48f7` con dominio `buzon.mislucasapp.com`, KV `BUZON`, variable `DOMINIO`.
- Email Routing: registros DNS listos; catch-all → Worker (activo).
- Pendiente: regla `contacto@` → Gmail del dueño (requiere verificar la dirección).
