import json
import os
import sys

# Directorio actual del módulo (pids)
_THIS_DIR = os.path.abspath(os.path.dirname(__file__))

# Directorio `data` esperado (carpeta hermana de `pids`)
_DATA_DIR = os.path.normpath(os.path.join(_THIS_DIR, '..', 'data'))

# Si estamos ejecutando desde PyInstaller onefile, preferimos los datos
# extraídos en sys._MEIPASS/data cuando existan.
if getattr(sys, 'frozen', False) and getattr(sys, '_MEIPASS', None):
    _MEI_DATA = os.path.join(sys._MEIPASS, 'data')
    if os.path.exists(_MEI_DATA):
        _DATA_DIR = _MEI_DATA

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
    _ruta = os.path.join(_DATA_DIR, _nombre_archivo)
    try:
        with open(_ruta, 'r', encoding='utf-8') as _f:
            _data = json.load(_f)
        # Merge de la DB principal y mapeo de descripciones
        codigos_db.update(_data)
        for k, v in _data.items():
            try:
                nombre_codigos[k] = v.get('d', '').strip() if isinstance(v, dict) else str(v)
            except Exception:
                nombre_codigos[k] = ''
    except FileNotFoundError:
        print(f"[pids.codigos] Aviso: archivo no encontrado: {_ruta}")
    except json.JSONDecodeError as e:
        print(f"[pids.codigos] Error parseando JSON {_ruta}: {e}")
    except Exception as e:
        print(f"[pids.codigos] Error cargando {_ruta}: {e}")
