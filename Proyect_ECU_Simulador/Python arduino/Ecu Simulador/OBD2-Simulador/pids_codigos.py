import json
import os

_BASE = os.path.dirname(os.path.abspath(__file__))

# Archivos por categoría OBD-II:
# P = Powertrain (motor y transmisión)
# B = Body (carrocería: airbags, clima, cierres)
# C = Chassis (ABS, ESP, dirección, suspensión)
# U = Network (CAN Bus, comunicación entre módulos)
_ARCHIVOS = {
    'P': 'fallas_P.json',
    'B': 'fallas_B.json',
    'C': 'fallas_C.json',
    'U': 'fallas_U.json',
}

codigos_db = {}
nombre_codigos = {}

for _categoria, _nombre_archivo in _ARCHIVOS.items():
    _ruta = os.path.join(_BASE, _nombre_archivo)
    try:
        with open(_ruta, 'r', encoding='utf-8') as _f:
            _data = json.load(_f)
        codigos_db.update(_data)
        nombre_codigos.update({k: v['d'] for k, v in _data.items()})
    except Exception:
        pass  # Si el archivo no existe aún, se ignora sin romper el programa
