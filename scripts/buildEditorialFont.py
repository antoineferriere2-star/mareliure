"""Regenerate the normal and semibold editorial fonts without removing characters.

Development-only: Python 3.12, fonttools[woff]==4.67.0, brotli==1.2.0.
The original variable font remains available for all other weights.
"""
from pathlib import Path
from hashlib import sha256
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont

root = Path(__file__).resolve().parent.parent
source = root / "public/fonts/fraunces-latin-var.woff2"
assert sha256(source.read_bytes()).hexdigest() == "7234ed860a9cc83045413c4faee63c960a8f2d1917adcf728119307d56e0d783"
font = TTFont(source, recalcTimestamp=False)
for weight, name in [(400, "regular"), (600, "semibold")]:
    instance = instantiateVariableFont(font, {"wght": weight}, inplace=False)
    instance.flavor = "woff2"
    destination = root / f"public/fonts/fraunces-latin-{name}-opsz.woff2"
    instance.save(destination)
    print(destination.name, destination.stat().st_size, sha256(destination.read_bytes()).hexdigest())
