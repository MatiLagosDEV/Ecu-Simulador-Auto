import json
import os

_BASE = os.path.dirname(os.path.abspath(__file__))
_JSON = os.path.join(_BASE, 'fallas_es_opt.json')

try:
    with open(_JSON, 'r', encoding='utf-8') as _f:
        _data = json.load(_f)
    # codigos_db  → dict completo  {"P0001": {"d": "...", "r": "..."}}
    codigos_db = _data
    # nombre_codigos → solo descripción, compatible con main.py y conexion_ecu.py
    nombre_codigos = {k: v['d'] for k, v in _data.items()}
except Exception:
    codigos_db = {}
    nombre_codigos = {}
