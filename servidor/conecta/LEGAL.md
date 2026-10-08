# Conexión con bancos · marco legal y resguardos (oct-2026)

> Resumen de investigación para tomar decisiones, **no es asesoría legal**. Antes de abrir la conexión
> bancaria a usuarios externos conviene validarlo con un abogado (datos personales + fintec).

## 1. Qué dice la regulación hoy

**Ley Fintec (Ley 21.521, 2023) y Sistema de Finanzas Abiertas (SFA).** Crea un sistema oficial para que
bancos, emisores de tarjetas y otras instituciones compartan datos de sus clientes **por API y con su
consentimiento** con terceros registrados en la CMF. La CMF lo reglamentó con la NCG 514 y la modificó con la
**NCG 569 (junio 2026)**, que fija las reglas técnicas: las APIs serán el único canal dentro del SFA, más detalle
sobre otorgar, administrar y revocar consentimientos, y un régimen simplificado para proveedores de información
con menos de 100.000 clientes. Entra en vigencia en **julio de 2027**; bancos y emisores de tarjetas de crédito
quedan obligados por etapas entre 5 y 18 meses después. → La vía oficial para tarjetas y cuentas recién estará
completa entre fines de 2027 y 2028.

**Mientras tanto** las apps chilenas (SaveMoney, Fintoc y otros) se conectan con agregadores que usan la clave
del cliente. En lo revisado no encontramos una prohibición legal expresa de esto fuera del SFA, pero:
- los términos y condiciones de los bancos suelen prohibir compartir la clave con terceros, y el riesgo
  (si alguien la usa mal) recae en el cliente;
- por eso la arquitectura de Mis Lucas **nunca guarda claves** y prefiere proveedores donde la clave ni siquiera
  pasa por nosotros (Fintoc).

**Datos personales.** Hoy rige la Ley 19.628. La **Ley 21.719** (nueva ley de datos personales, con Agencia de
Protección de Datos y multas altas) entra en vigencia el **1-dic-2026**; el Gobierno ingresó en sept-2026 un
proyecto para postergarla a dic-2027 (en trámite). Conviene diseñar ya como si rigiera. Pide, entre otras cosas:
consentimiento libre, informado y específico; finalidad acotada; minimización; seguridad adecuada;
derechos de acceso, rectificación, supresión, oposición y portabilidad; y avisar brechas de seguridad.

## 2. Cómo responde el diseño de Mis Lucas Conecta

| Exigencia | Cómo se cumple |
|---|---|
| Consentimiento informado y específico | Pantalla de autorización por banco: qué se lee, para qué, quién se conecta, dónde quedan los datos y hasta cuándo. Casilla obligatoria. El servidor rechaza conexiones sin consentimiento y guarda fecha, versión del texto (`CONSENTIMIENTO_V`) y alcance. |
| Finalidad acotada | Solo mostrar sus finanzas en la app. Sin venta, sin publicidad, sin perfilamiento. |
| Solo lectura | Proveedores en modo «movimientos/agregación»: no pueden pagar ni transferir. |
| Minimización | No se guarda la clave del banco ni el RUT. El servidor guarda solo el token del proveedor (cifrado) y estado de la conexión. Movimientos: solo en tránsito, cifrados, y se borran al recogerlos (máx. 30 días). |
| Seguridad | Tokens cifrados con AES-GCM (secreto del Worker). Datos hacia la app cifrados de punta a punta con la llave pública del teléfono (RSA-OAEP 2048 + AES-GCM 256): quien administra el servidor no puede leerlos. HTTPS, límites de intentos, firma verificada en webhooks. |
| Revocación y supresión | «Desconectar» revoca el acceso en el proveedor (Fintoc: borra el link) y borra todo del servidor. «Baja» borra la identidad completa. |
| Acceso / portabilidad | Todo vive en el teléfono de la persona y sale en su respaldo (JSON) y exportaciones. |

## 3. Riesgos que quedan y cómo bajarlos

1. **Khipu (tarjetas) recibe la clave a través de nuestro servidor** (una vez, en memoria, sin guardarla). Es el
   punto más sensible. Recomendación: partir solo con Fintoc (cuentas) + buzón/Apple Pay/cartola (tarjetas), y
   activar Khipu después de firmar contrato, revisar su seguridad y pedirle un flujo OAuth/widget (su API ya
   marca el método de clave como «deprecated» en favor de OAuth).
2. **Términos de los bancos**: avisar con claridad en la autorización (ya está) y en los Términos de uso.
3. **Responsable del tratamiento**: hoy la app no es una empresa. Antes de abrirla a muchos usuarios conviene
   tener una persona jurídica responsable, Términos de uso y Política de privacidad publicados en mislucasapp.com,
   y un correo para ejercer derechos (contacto@mislucasapp.com).
4. **Contratos con proveedores**: el contrato con Fintoc/Khipu define quién es responsable de qué (encargado de
   tratamiento). Leerlos antes de pasar a llaves `live`.
5. **SFA en 2027**: para recibir datos directo de los bancos habrá que inscribirse en la CMF como proveedor de
   servicios basados en información (con el régimen simplificado si hay < 100.000 clientes) o seguir a través de un
   proveedor inscrito. El adaptador nuevo se suma sin tocar la app.

## 4. Antes de abrirlo a usuarios externos (lista)
- [ ] Términos de uso y Política de privacidad publicados (incluyen la conexión bancaria y los proveedores).
- [ ] Contrato y llaves `live` de Fintoc; webhook configurado.
- [ ] Revisión legal breve (datos personales + fintec).
- [ ] Decidir si se activa Khipu o se espera OAuth/SFA.
- [ ] Probar con 2–3 personas de confianza con sus bancos reales.

Fuentes: Cuatrecasas sobre la NCG 569 (jun-2026); CMF, comunicado de modificación de la NCG 514; Carey sobre la
Ley 21.719 y el proyecto de postergación (sept-2026); documentación pública de Fintoc y Khipu; Chócale sobre
«Lisa» de SaveMoney (mayo 2026).
