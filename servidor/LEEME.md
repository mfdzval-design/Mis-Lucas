# Servidor del buzón de Mis Lucas

Recibe los correos del banco que cada persona reenvía desde su Gmail a la dirección común
`buzon@dominio` (igual para todos) y las compras con Apple Pay que manda el atajo del iPhone.
El servidor reconoce de quién es cada correo por el correo desde el que llega: al activar, la app
registra ese correo y el servidor guarda solo su huella (SHA-256), nunca el correo en texto.
Para Gmail se normaliza (minúsculas, sin puntos ni «+etiqueta»). Gmail reenvía con el remitente
`usuario+caf_=…@gmail.com` y el encabezado `X-Forwarded-For`; la confirmación de reenvío trae el
correo de la persona en el texto. Los buzones antiguos (`código@dominio`) siguen funcionando.
Un correo no puede quedar conectado a dos buzones (evita que alguien se quede con los avisos de otro).
Si alguien reinstala sin respaldo y su correo quedó tomado, se libera borrando la clave `e:<huella>` en KV.
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
- `POST /api/registro {pub, correos:[…]}` → `{code, key, address:"buzon@…", comun:true}`
- `POST /api/correos {c,k,correos:[…]}` → cambia los correos reconocidos (máx. 3)
- `GET  /api/buzon?c=&k=` → lo pendiente
- `POST /api/buzon/ok {c,k,ids}` → borra lo ya recogido
- `POST /api/ap?c=&k=` (form `l=ML|…`) → compra Apple Pay
- `POST /api/baja {c,k}` → desactiva y borra todo

## Estado actual (3-oct-2026)
- Dominio: mislucasapp.com (Cloudflare Registrar, renovación automática).
- Worker: `worker-lucky-mud-48f7` con dominio `buzon.mislucasapp.com`, KV `BUZON`, variable `DOMINIO`.
- Email Routing: registros DNS listos; catch-all → Worker (activo).
- Pendiente: regla `contacto@` → Gmail del dueño (requiere verificar la dirección).
