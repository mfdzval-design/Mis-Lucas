# Mis Lucas · Historial de versiones

Cada versión publicada queda anotada aquí. El número de versión se ve al pie de la app.

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
