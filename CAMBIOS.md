# Mis Lucas · Historial de versiones

Cada versión publicada queda anotada aquí. El número de versión se ve al pie de la app.

## Próxima versión · (sin publicar)
- Arreglo del cálculo del mes: lo que te devuelven (amigos, seguros, reembolsos de oficina) ya no puede dejar «Salió» en $0. Ahora el reembolso de oficina solo descuenta los gastos de oficina del mismo mes, y el resto de lo que te devuelven se suma a «Entró» (se ve como «Incluye $X de devoluciones»). Así «Salió» siempre muestra lo que de verdad pagaste.

## 1.10.0 beta · 2-oct-2026
- «Revisa antes de importar» rediseñado: arriba un resumen (leídos, con categoría, por categorizar, entre tus cuentas, ya anotados). Lo que la app no supo categorizar aparece agrupado por comercio, con un botón «Elegir categoría». Si la app tiene una idea, la propone al lado («¿Es Supermercado?») para aceptarla con un toque.
- Nueva hoja «Elige una categoría»: buscador, pestañas Gastos / Ingresos / Traspaso y todas las categorías con su ícono. Abajo, «Recordar: los movimientos que digan ___ van siempre a esta categoría», con el texto editable; se aplica también a los demás movimientos de la cartola que lo digan.
- «+ Nueva categoría» desde ahí mismo: nombre, si es gasto o ingreso, si normalmente es fijo o variable, e ícono. «Crear y usar» la deja creada y asignada. También se pueden crear categorías de ingresos.
- Lo que ya está listo queda en secciones plegadas; cada movimiento muestra su categoría y se cambia con un toque. «No importar» para saltar un comercio. Botón «Importar N movimientos» al final.

- Se puede crear una categoría también desde un movimiento (botón «＋ Nueva» en la lista de categorías). Las categorías de ingresos propias aparecen en el menú «Categorías de gastos» para borrarlas.
- Si la app no sabe de qué cuenta es un Excel o CSV, ahora lo pregunta (antes lo dejaba en Efectivo).
- Al cambiar la cuenta en la revisión ya no se pierde lo que habías categorizado.
- Volver a subir una cartola que se cruza con otra ya no duplica movimientos que habías anotado y que ya calzaron con el banco.
- «Eliminar» funciona directo desde la ficha de un movimiento.
- Eliminar una cuenta con movimientos: ahora ofrece pasarlos a otra cuenta o borrarlos junto con ella. Renombrar una cuenta mantiene su historial de cartolas.
- Si una cartola de la cola falla, la app sigue con la siguiente.
- La clave de un PDF puede tener letras (antes se borraban).
- «Borrar todo» también borra la clave guardada de los PDF y las fotos de boletas.
- «Entre mis cuentas» reemplaza a «Traspaso / pago TC» en toda la app.
- Textos más claros: «te sobró» en el anillo del inicio, «Ahorros e inversiones» en el acceso a Patrimonio, «Bloquear ahora» en el menú, «Leer» en el cuadro para escribir o pegar, y la guía «Anotar gastos al instante» numerada del 1 al 6.
- Primeros pasos en un orden más lógico (subir cartola → revisar categorías → ordenar).
- La proyección «a este ritmo terminarías el mes en…» solo aparece cuando ya hay meses anteriores para comparar.
- Las reglas automáticas y los datos de ejemplo usan las categorías nuevas; se limpiaron reglas antiguas que apuntaban a «Otros gastos».
- Arreglos internos: la pantalla Patrimonio quedaba fuera del ancho normal en computador; la app funciona sin internet también al leer PDF; los indicadores ya no muestran valores viejos como recientes.

## 1.9.0 beta · 1-oct-2026
- La franja de indicadores ahora es un carrusel que avanza solo (se detiene al tocarla). El conversor funciona en ambos sentidos y entre cualquier par: pesos, dólares, euros, UF y UTM, con botón para invertir.
- Transferencias entre tus propias cuentas: al subir la cartola de una cuenta, la app busca en tus otras cuentas el mismo monto en sentido contrario (±3 días) y marca ambos movimientos como traspaso, para que no cuenten como gasto ni ingreso. Incluye el pago de la tarjeta desde la cuenta corriente.
- Categorías de gastos más simples (12): Vivienda, Supermercado, Restaurantes, Delivery, Salidas, Auto y bencina, Vestuario, Deporte, Suscripciones, Oficina (te la devuelven), Ahorro e inversión y Otros gastos. Los movimientos, topes y reglas con categorías anteriores se pasan solos a la nueva que corresponde.
- Cada persona puede renombrar, cambiar el emoji, borrar o crear categorías en el menú «Categorías de gastos» (aparece también una vez en Primeros pasos).
- Al categorizar: después de guardar, el botón principal es «Siguiente ›» (abre el próximo sin categoría ya en edición). «Editar» queda al lado de «Eliminar».

## 1.8.0 beta · 1-oct-2026
- Subir cartola rediseñado: eliges varias cartolas a la vez y la app lee cada una y la asigna sola a su cuenta, una tras otra. Debajo, la lista de tus cuentas con hasta qué mes está cargada cada una y su historial de cartolas (mes, archivo, movimientos y fecha de carga). «+ Nueva cuenta» siempre a mano.
- El formulario de nueva cuenta ya no aparece prellenado con datos de otra cuenta.
- Categorizar una vez y listo: al cambiar la categoría de un movimiento, se aplica sola a los parecidos y a los próximos con ese texto, con un botón «Deshacer». «Solo este» para excepciones.
- Recordatorio de respaldo semanal en el Inicio: con un toque lo guardas en Archivos o iCloud.
- Indicadores económicos arriba en el Inicio: dólar (con variación del día), UF, euro y UTM. Al tocarlos se abre el detalle con IPC, tasa de política monetaria, gráfico del dólar del último año y un conversor a pesos (dólar, euro, UF, UTM). Datos del Banco Central vía mindicador.cl, guardados para verlos sin conexión.
- Gastos en otra moneda: «gasté 20 dólares en Netflix», «US$ 12,99 spotify», «2 UF de arriendo» o un aviso del banco en US$ se pasan solos a pesos con el valor del día, y el movimiento guarda la conversión.
- El buscador de Movimientos busca en todos los meses y muestra cuántos resultados y cuánto suman.

## 1.7.1 beta · 1-oct-2026
- Lector de PDF más robusto: entiende cartolas donde el texto viene con cada letra por separado o con varias columnas juntas.
- Si un PDF no trae texto legible (escaneado o generado como imagen), la app lo lee como imagen dentro del teléfono.
- Lee la cartola de cuenta corriente Santander donde la fecha y la sucursal vienen pegadas.
- Mensaje más claro cuando un PDF no se puede leer, con alternativas (Excel o captura).

## 1.7.0 beta · 1-oct-2026
- Anotar con frases normales: al tocar + escribes o dictas «gasté 20 mil en el Jumbo», «ayer almuerzo 12.500 en efectivo» o «me pagaron el arriendo 450.000» y la app arma el movimiento con monto, fecha, categoría y cuenta. Entiende mil, lucas, palos, ayer, débito, crédito, efectivo y el nombre de tu banco.
- Atajo de Siri «Anotar gasto»: le dictas el gasto a Siri y queda en la lista del iPhone; entra a la app pegándola en el cuadro de texto, sin duplicar. Guía paso a paso en el menú.
- Foto de la boleta: al comprar tocas + → 📷 Boleta o captura → Tomar foto. La app lee el total, el comercio y la fecha (y si dice débito, crédito o efectivo), tú tocas con qué pagaste y queda anotado con la foto guardada en el movimiento («🧾 Ver foto»), solo en este teléfono.
- El botón «Pegar aviso» se reemplaza por «📄 Subir cartola». Los avisos del banco y las listas de Apple Pay o Siri se pegan en el mismo cuadro donde escribes el gasto.
- Al anotar, botones «¿Con qué pagaste?» con tus tarjetas, cuentas y efectivo a un toque.
- Al subir la cartola, los gastos anotados con monto aproximado se juntan con el cobro real (por ejemplo 20 mil con $19.990 en JUMBO): queda el monto exacto del banco y tu categoría.

## 1.6.1 beta · 1-oct-2026
- Tocar el logo «Mis Lucas» arriba a la izquierda te lleva al Inicio desde cualquier pestaña.

## 1.6.0 beta · 1-oct-2026
- Abierta a cualquier banco: nuevo "Mis cuentas y tarjetas" (en tu menú) para agregar cuentas corrientes, vista/RUT, ahorro, tarjetas de crédito, prepago, billeteras digitales (Tenpo, Mercado Pago, MACH, Prex), efectivo e inversiones de cualquier banco. Tus cuentas actuales se convierten solas.
- El lector de PDF reconoce los principales bancos y emisores de Chile, distingue tarjeta, cuenta corriente, vista o billetera, y asigna la cartola a tu cuenta; si no la tienes, la crea sola. Para formatos que no conoce usa un modo general y te pide revisar los tipos.
- "➕ Nueva cuenta…" directo al anotar un movimiento o al subir una cartola.
- Inicio con "Primeros pasos" (7 tareas con ✓ y barra de avance) y luego "Cierre del mes": qué cartolas faltan por cuenta y si todo está categorizado, hasta marcar "Mes cerrado".
- Cada cuenta muestra hasta qué mes está cargada.
- Pagos que se repiten (en Presupuesto): detecta solo tus suscripciones, seguros, arriendos, sueldo y otros pagos fijos, muestra si ya se pagaron este mes y avisa si suben de precio o aparece uno nuevo. Puedes marcar "No es un pago fijo".
- Proyección a fin de mes: cuánto te quedaría, sumando los ingresos y pagos fijos que faltan, las cuotas del mes y tu gasto variable promedio.
- Avisos en la campana de arriba (junto al ojo), con un número de cuántos hay: al tocarla se despliegan, y al tocar uno ves su detalle. Incluyen topes al 80 % y excedidos, proyección negativa, alzas de precio, pagos nuevos y respaldo atrasado. Cada aviso se puede descartar.
- "Lo destacado del mes" e informe mensual con comparación de cada categoría contra tus meses anteriores, y botón para compartir el resumen.
- Nueva pestaña Patrimonio y metas: patrimonio neto (lo que tienes menos lo que debes) con su evolución mes a mes, metas de ahorro con el monto a apartar cada mes, deudas (créditos, líneas) y compras en cuotas detectadas solas en tus cartolas, intereses pagados en el año y otros bienes (saldos, propiedad, auto).
- Anotar gastos al instante: "📋 Pegar aviso" lee el texto del correo o la notificación del banco (monto, comercio, fecha, tarjeta y si es transferencia) y lo deja listo con su categoría. También importa de una vez las compras de Apple Pay que el iPhone anota solo con un atajo, sin duplicar las que ya estaban. Guía paso a paso en el menú: "Anotar gastos al instante".
- Leer capturas de pantalla: eliges una o varias capturas de los movimientos en la app de tu banco (o de una notificación de compra) y la app lee fecha, comercio y monto, en tu teléfono, sin subirlas a ningún lado. Muestra la lista para revisar, marca las que ya tenías y al llegar la cartola se juntan solas.
- Al anotar a mano aparecen tus comercios frecuentes (un toque y solo pones el monto) y la categoría se elige sola al escribir un nombre conocido.
- Los gastos anotados por aviso o Apple Pay se juntan con la cartola aunque los hayas puesto en otra tarjeta del mismo tipo.
- Aviso en la campana cuando falta la cartola del mes anterior de alguna cuenta.
- Modo privado: el ojo arriba oculta todos los montos con un toque.
- Entrar con Face ID o huella (en PIN y contraseña), sin servidor: la verificación la hace tu teléfono.

## 1.5.0 beta · 1-oct-2026
- La barra de pestañas del celular ocupa todo el ancho (sin espacio vacío) y el texto es más grande.
- Confirmación visual al guardar: el botón se pone verde con "✓ Guardado", el aviso sale en verde y el movimiento o tope editado se ilumina. Mientras tienes cambios sin guardar, el botón "Guardar" queda resaltado.
- El aviso ya no queda tapado por la barra de abajo en el celular.
- Al tocar un movimiento se abre su ficha en modo lectura, con el botón "✎ Editar" (o "Categorizar" si está sin categoría). Al guardar, la ficha queda en verde "✓ Guardado" y el movimiento queda marcado "✓ Revisado por ti", también cuando lo vuelves a abrir y en la lista.
- Después de categorizar aparece "Siguiente sin categoría ›" para ordenar el mes seguido.
- Nueva bienvenida a pantalla completa la primera vez: "Crear mi espacio", "Ver con datos de ejemplo" o "Tengo un respaldo".
- Configuración inicial en 3 pasos con barra de avance: nombre y correo, protección (PIN, contraseña o sin código, confirmando dos veces) y por dónde partir (subir cartola, anotar un gasto o explorar).
- Nueva pantalla de inicio de sesión: tu inicial, 4 puntos y teclado numérico grande (o campo de contraseña), "¿Olvidaste tu código?" con las salidas posibles, y espera de 30 segundos tras 5 intentos fallidos.

## 1.4.0 beta · 30-sep-2026
- Oficina deja de ser un sistema aparte: es la categoría de gasto "Oficina (te la devuelven)" y el reembolso de la empresa se resta de tus gastos, igual que las devoluciones de amigos. Se elimina la pestaña Rendir; tus gastos y reembolsos de oficina se convierten solos.
- Un solo formulario para agregar y editar movimientos (el "+" abre la misma ficha).
- Movimientos: una sola lista, un buscador y un selector (Todo, Gastos, Ingresos, Ahorro, Traspasos, Por categorizar). "Subir cartola" queda dentro de Movimientos.
- Resumen sin tarjetas repetidas (fijo vs variable, gastos más grandes, oficina aparte, conciliación).
- 5 pestañas: Inicio, Movimientos, Presupuesto, Ahorro y Ajustes. Ajustes sin la lista de fijos ni la tarjeta de conexión bancaria; reglas con buscador.
- Arreglo: los botones que llevaban a otra pestaña no respondían.
- Menú de cuenta al tocar tu inicial (arriba a la derecha): perfil personal, cuenta y correo de ingreso, PIN o contraseña (crear, cambiar, quitar), bloqueo automático, apariencia (claro/oscuro), reglas, respaldo y datos, acerca de, y cerrar sesión. Ajustes sale de la barra de abajo: quedan 4 pestañas.

## 1.3.0 beta · 30-sep-2026
- Toca un movimiento para editarlo completo: nombre, monto, fecha, tipo, categoría, personal u oficina, cuenta y fijo/variable.
- Al cambiar la categoría puedes aplicarla a los movimientos parecidos y recordarla como regla para las próximas cartolas.
- Nuevo filtro "Por categorizar" y aviso en el resumen con los movimientos que quedaron en "Otros".

## 1.2.0 beta · 29-sep-2026
- Toca cualquier bloque del resumen (gastos fijos, variables, ahorro, resultado del mes, una categoría o una cuenta) y ves los movimientos que lo componen; tocando uno vas directo a editarlo.
- Las devoluciones (amigos que te pagan su parte, reembolsos de seguros) se restan del gasto en vez de sumarse como ingreso.
- Nueva categoría de ingreso "Arriendos".
- Mensaje más claro cuando ahorraste más de lo que te sobró en el mes.

## 1.1.0 beta · 29-sep-2026
- Lee directo el PDF del estado de cuenta de tarjeta y de la cartola de cuenta (Santander e Itaú), incluso con clave. Detecta sola la cuenta y el período. El PDF se procesa en el teléfono, no se sube a ningún lado.
- Opción de recordar la clave del PDF en el teléfono.
- Corrige fechas que quedaban un día antes al importar CSV.
- Más reglas de categorías: seguros, licorerías, papelerías, boleterías, hipotecario, Fintual/fondos mutuos, movimientos de línea de crédito, etc.

## 1.0.0 beta · 29-sep-2026
Primera versión pública.
- Resumen del mes: ingresos y gastos (fijo/variable), ahorro, tasa de ahorro y uso del presupuesto, con gráficos.
- Importación de cartolas Santander e Itaú (Excel/CSV), con categorías automáticas, conciliación y sin duplicados.
- Movimientos, presupuesto por categoría, fijos y reglas editables.
- Diseño para celular, instalable en la pantalla de inicio y utilizable sin internet.
- Respaldo y restauración de datos; PIN opcional.
