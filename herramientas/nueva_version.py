"""Sube el número de versión de Mis Lucas en todos los lugares necesarios.

Uso:  python3 herramientas/nueva_version.py "1.1.0 beta"

Cambia APP_VERSION en index.html y el nombre de caché en sw.js. Cambiar la caché
es lo que hace que los teléfonos detecten la versión nueva y muestren
"Hay una versión nueva · Actualizar".
"""
import pathlib
import re
import sys

raiz = pathlib.Path(__file__).resolve().parent.parent
if len(sys.argv) != 2:
    sys.exit('Uso: python3 herramientas/nueva_version.py "1.1.0 beta"')
v = sys.argv[1].strip()

idx = raiz / "index.html"
t = idx.read_text(encoding="utf-8")
t, n = re.subn(r'APP_VERSION\s*=\s*"[^"]*"', f'APP_VERSION = "{v}"', t, count=1)
if n != 1:
    sys.exit("No encontré APP_VERSION en index.html")
idx.write_text(t, encoding="utf-8")

sw = raiz / "sw.js"
s = sw.read_text(encoding="utf-8")
cache = "mislucas-" + re.sub(r"[^a-z0-9]+", "-", v.lower()).strip("-")
s, n = re.subn(r'const CACHE = "[^"]*"', f'const CACHE = "{cache}"', s, count=1)
if n != 1:
    sys.exit("No encontré CACHE en sw.js")
sw.write_text(s, encoding="utf-8")
print(f"Versión {v} · caché {cache}")
