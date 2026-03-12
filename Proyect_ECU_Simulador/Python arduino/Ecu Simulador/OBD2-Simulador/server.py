# --- Estado persistente del motor ---
import time
from flask import Flask, jsonify, request
from flask_cors import CORS
import requests
from vininfo import Vin
from conexion_ecu import ecu, enviar_pid, leer_dtc, borrar_codigos as _borrar_arduino
from pids_motor import pids_motor
from pids_bateria import pids_bateria
from decodificadores import decodificar_consumo_combustible

# --- Comunicación robusta con Arduino ---
def enviar_comando_limpio(comando):
    """
    Envía un comando y limpia la respuesta de textos como 'SEARCHING...'
    o ecos del comando enviado.
    """
    try:
        ecu.write((comando + '\n').encode())
        for _ in range(3):
            resp = ecu.readline().decode().strip().upper()
            if not resp or resp == comando.upper():
                continue
            if 'SEARCHING' in resp:
                continue
            return resp
    except Exception as e:
        print(f"Error Serial: {e}")
    return 'NO DATA'

# --- Protocolos OBD-II ---
PROTOCOLOS = {
    0: 'AUTO',
    1: 'SAE J1850 PWM',
    2: 'SAE J1850 VPW',
    3: 'ISO 9141-2',
    4: 'ISO 14230-4 KWP (5 baud)',
    5: 'ISO 14230-4 KWP (fast)',
    6: 'ISO 15765-4 CAN 11/500',
    7: 'ISO 15765-4 CAN 29/500',
    8: 'ISO 15765-4 CAN 11/250',
    9: 'ISO 15765-4 CAN 29/250',
}

# Estado global del protocolo activo (persiste entre requests)
protocolo_activo = {'numero': 0, 'nombre': 'No detectado', 'conectado': False}

def _inicializar_elm():
    """
    Secuencia estándar de inicialización que hace todo escáner real al conectarse:
    ATZ (reset) -> ATE0 (echo off) -> ATL0 (linefeeds off) -> ATH1 (headers on)
    """
    try:
        ecu.reset_input_buffer()
        ecu.write(b'ATZ\n')
        time.sleep(1.0)  # ELM327 necesita ~1s para reiniciarse
        ecu.reset_input_buffer()
        for cmd in [b'ATE0\n', b'ATL0\n', b'ATH1\n']:
            ecu.write(cmd)
            time.sleep(0.1)
            ecu.readline()  # Consumir respuesta "OK"
        return True
    except Exception:
        return False

def _probar_protocolo(numero):
    """
    Activa el protocolo `numero` y verifica con el PID 010C (RPM).
    Igual que un escáner real: si 010C devuelve datos válidos → protocolo correcto.
    Devuelve True si el protocolo funciona, False si no.
    """
    try:
        ecu.write(f'ATSP{numero}\n'.encode())

        # Arduino envía "SEARCHING..." (sin salto) + 1 s de delay + "OK\r\n"
        # Usamos timeout extendido para capturar todo correctamente
        old_timeout = ecu.timeout
        ecu.timeout = 2.5
        encontrado_ok = False
        for _ in range(5):
            resp = ecu.readline().decode().strip().upper()
            if 'OK' in resp:
                encontrado_ok = True
                break
            if 'UNABLE' in resp or 'ERROR' in resp:
                ecu.timeout = old_timeout
                return False
        ecu.timeout = old_timeout

        if not encontrado_ok:
            return False

        # Probar con PID real: si responde con datos → protocolo válido
        ecu.write(b'010C\n')
        resp = ecu.readline().decode().strip().upper()
        return (bool(resp)
                and 'NO DATA'     not in resp
                and 'UNABLE'      not in resp
                and 'ERROR'       not in resp
                and 'SEARCHING'   not in resp)
    except Exception:
        return False

def escanear_protocolo():
    """
    Detecta el protocolo OBD-II disponible, exactamente como un escáner real:
      1. Inicializa el adaptador (ATZ + configuración básica)
      2. Intenta auto-detección con ATSP0
      3. Si falla, prueba cada protocolo del 1 al 9 uno por uno
    Actualiza el global `protocolo_activo` y lo devuelve.
    """
    global protocolo_activo

    _inicializar_elm()

    # Paso 1: auto-detección (el ELM327 real también empieza aquí)
    if _probar_protocolo(0):
        try:
            ecu.write(b'ATDPN\n')
            time.sleep(0.1)
            num = int(ecu.readline().decode().strip())
        except Exception:
            num = 6  # Fallback a CAN 11/500 si ATDPN falla
        protocolo_activo = {
            'numero': num,
            'nombre': PROTOCOLOS.get(num, 'Desconocido'),
            'conectado': True
        }
        return protocolo_activo

    # Paso 2: escaneo manual protocolo a protocolo
    for num in range(1, 10):
        if _probar_protocolo(num):
            protocolo_activo = {
                'numero': num,
                'nombre': PROTOCOLOS.get(num, 'Desconocido'),
                'conectado': True
            }
            return protocolo_activo

    # Ningún protocolo funcionó
    protocolo_activo = {'numero': 0, 'nombre': 'Sin conexión', 'conectado': False}
    return protocolo_activo

# --- Override de marcas chinas modernas no reconocidas por vininfo ---
# Clave: prefijo del VIN (WMI de 3 chars o más específico), Valor: marca correcta
VIN_MARCA_OVERRIDE = {
    # Leapmotor (零跑汽车)
    'LSVFA': 'Leapmotor',
    'LS5AA': 'Leapmotor',
    'LS5AB': 'Leapmotor',
    'LFPAB': 'Leapmotor',
    # BYD (比亚迪)
    'LBW':   'BYD',
    'LNBSC': 'BYD',
    'LFP':   'BYD',
    'LGXCE': 'BYD',
    # Geely (吉利)
    'LJC':   'Geely',
    'LGXC':  'Geely',
    # Chery (奇瑞)
    'LVV':   'Chery',
}

def _detectar_marca_override(vin):
    """Busca coincidencia de prefijo VIN en el override, de más específico a menos."""
    for prefijo in sorted(VIN_MARCA_OVERRIDE, key=len, reverse=True):
        if vin.upper().startswith(prefijo.upper()):
            return VIN_MARCA_OVERRIDE[prefijo]
    return None

# --- Override de modelos europeos/asiáticos no reconocidos por NHTSA ---
# Clave: prefijo VIN (WMI + código de modelo, cuanto más específico mejor)
VIN_MODELO_OVERRIDE = {
    # Renault (VF1 = Renault SA France)
    'VF1KZ': 'Clio',
    'VF1KC': 'Kangoo',
    'VF1BB': 'Megane',
    'VF1BA': 'Megane',
    'VF1BC': 'Laguna',
    'VF1JL': 'Captur',
    'VF1RJ': 'Koleos',
    'VF1FB': 'Twingo',
    'VF1LB': 'Scenic',
    'VF1LC': 'Scenic',
    # Peugeot (VF3 = PSA Peugeot)
    'VF3CC': '207',
    'VF3CD': '208',
    'VF3MC': '307',
    'VF3MD': '308',
    'VF3AH': '3008',
    # Citroën
    'VF7AA': 'C1',
    'VF7SC': 'C3',
    'VF7RD': 'C4',
    # Volkswagen (WVW = VW AG Germany)
    'WVWZZZ': 'Golf',
    'WVGZZZ': 'Touareg',
    # BMW
    'WBA': 'Serie 3',
    'WBS': 'M3',
    # Mercedes
    'WDB': 'Clase C',
    'WDD': 'Clase C',
    # Toyota (JT = Japan Toyota)
    'JT2': 'Camry',
    'JT3': 'RAV4',
    # Honda (JHM = Honda Japan)
    'JHM': 'Civic',
}

def _detectar_modelo_override(vin):
    """Busca coincidencia de prefijo VIN para obtener modelo, de más específico a menos."""
    for prefijo in sorted(VIN_MODELO_OVERRIDE, key=len, reverse=True):
        if vin.upper().startswith(prefijo.upper()):
            return VIN_MODELO_OVERRIDE[prefijo]
    return None

# --- Caché global del VIN (se resuelve una sola vez) ---
_vin_cache = None

# --- Función para leer VIN ---
def leer_vin():
    """Lee VIN desde Arduino y decodifica marca, país, año aproximado y modelo vía NHTSA"""
    global _vin_cache
    # Si ya tenemos un resultado completo (modelo != "-"), devolverlo directamente
    if _vin_cache and _vin_cache.get("modelo", "-") != "-":
        return _vin_cache
    try:
        ecu.write(b"0902\n")  # PID estándar para VIN
        resp = ecu.readline().decode().strip()
        datos = resp.split()
        vin = ""

        # Primero intenta decodificar como bytes HEX ASCII (formato OBD-II real)
        # Arduino envía: "49 02 01 38 47 42..." donde 38 47 42... son bytes ASCII del VIN
        if len(datos) > 3:
            try:
                hex_vin = "".join(datos[3:])
                vin_candidato = bytes.fromhex(hex_vin).decode('ascii', errors='ignore').strip()
                vin_candidato = ''.join(c for c in vin_candidato if c.isalnum())[:17]
                if len(vin_candidato) >= 10:
                    vin = vin_candidato
            except Exception:
                pass

        # Fallback: el Arduino envió el VIN como texto plano tras el encabezado
        if not vin and len(datos) >= 3:
            vin = "".join(datos[2:])[:17]

        if not vin:
            return {"vin": "Desconocido", "marca": "-", "pais": "-", "año": "-", "modelo": "-"}
        
        vin_obj = Vin(vin)
        # Año aproximado según 10º carácter
        año_caracter = vin[9].upper()
        año_mapping = {
            'A': 2010, 'B': 2011, 'C': 2012, 'D': 2013, 'E': 2014,
            'F': 2015, 'G': 2016, 'H': 2017, 'J': 2018, 'K': 2019,
            'L': 2020, 'M': 2021, 'N': 2022, 'P': 2023, 'R': 2024,
            'S': 2025, 'T': 2026, 'V': 2027, 'W': 2028, 'X': 2029,
            'Y': 2030, '1': 2001, '2': 2002, '3': 2003, '4': 2004,
            '5': 2005, '6': 2006, '7': 2007, '8': 2008, '9': 2009
        }
        año = año_mapping.get(año_caracter, "Desconocido")

        # Modelo vía NHTSA (funciona bien con VINs norteamericanos)
        modelo = "-"
        try:
            url = f"https://vpic.nhtsa.dot.gov/api/vehicles/decodevin/{vin}?format=json"
            resp_api = requests.get(url, timeout=5).json()
            valor = next((x["Value"] for x in resp_api["Results"] if x["Variable"] == "Model"), None)
            if valor and valor.strip() and valor.strip().lower() != "null":
                modelo = valor.strip()
        except:
            pass

        # Si NHTSA no devolvió modelo, buscar en tabla de overrides europeos/asiáticos
        if modelo == "-":
            modelo = _detectar_modelo_override(vin) or "-"

        # Usar override de marca si existe, si no usar vininfo
        marca = _detectar_marca_override(vin) or vin_obj.manufacturer

        resultado = {
            "vin": vin,
            "marca": marca,
            "pais": vin_obj.country,
            "año": año,
            "modelo": modelo
        }
        # Solo cachear si el modelo se resolvió correctamente
        if modelo != "-":
            _vin_cache = resultado
        return resultado

    except Exception as e:
        return {"vin": "Error", "marca": "-", "pais": "-", "año": "-", "modelo": "-", "error": str(e)}

# --- Función para decodificar PIDs ---
def decodificar_pid(pid, respuesta):
    # Ignorar respuestas vacías, NO DATA o texto de búsqueda de protocolo
    if not respuesta or 'NO DATA' in respuesta.upper() or 'SEARCHING' in respuesta.upper() or 'ERROR' in respuesta.upper():
        return '0'
    datos = respuesta.split()
    if pid == "010C":  # RPM
        if len(datos) >= 4:
            try:
                A = int(datos[2], 16)
                B = int(datos[3], 16)
                rpm = ((A * 256) + B) // 4
                return f"{rpm} rpm"
            except:
                return respuesta
        return respuesta
    elif pid == "010D":  # Velocidad
        if len(datos) >= 3:
            try:
                velocidad = int(datos[2], 16)
                return f"{velocidad} km/h"
            except:
                return respuesta
        return respuesta
    elif pid == "0105":  # Temp Motor
        if len(datos) >= 3:
            try:
                temp = int(datos[2], 16) - 40
                return f"{temp} °C"
            except:
                return respuesta
        return respuesta
    elif pid == "0123":  # Consumo de combustible
        try:
            return decodificar_consumo_combustible(datos)
        except:
            return respuesta
    elif pid == "015E":  # Consumo de combustible
        try:
            return decodificar_consumo_combustible(datos)
        except:
            return respuesta
    elif pid == "0142":  # Voltaje Batería
        return respuesta
    elif pid == "0101":  # Check Engine
        if len(datos) >= 3:
            try:
                estado = int(datos[2], 16)
                mil = (estado & 0x80) != 0
                cantidad = estado & 0x7F
                if mil:
                    return f"ENCENDIDO ({cantidad} códigos)"
                else:
                    return "APAGADO"
            except:
                return respuesta
        return respuesta
    else:
        return respuesta

# --- Obtener todos los datos ---
def get_all_data():
    data = {}
    pids_todos = {**pids_motor, **pids_bateria}
    for pid, nombre in pids_todos.items():
        valor_crudo = enviar_pid(pid)
        valor = decodificar_pid(pid, valor_crudo)
        data[pid] = {'nombre': nombre, 'valor': valor}

    # VIN y info del vehículo
    data['vehiculo'] = leer_vin()
    return data

# --- Flask API ---
app = Flask(__name__)
CORS(app)

@app.route('/datos', methods=['GET'])
def datos():
    return jsonify(get_all_data())

@app.route('/codigos', methods=['GET'])
def get_codigos():
    from pids_codigos import nombre_codigos, codigos_db
    try:
        lista = leer_dtc()  # Mode 03 — códigos confirmados
    except Exception as e:
        return jsonify({'error': str(e), 'mil': False, 'codigos': [], 'pendientes': [], 'freeze_frame': None})

    def _info(c):
        entry = codigos_db.get(c, {})
        return {
            'code': c,
            'desc': entry.get('d') or nombre_codigos.get(c, 'Código desconocido'),
            'rec':  entry.get('r', ''),
        }

    codigos = [_info(c) for c in lista]

    # Mode 07 — códigos pendientes (aún no confirmados por la ECU)
    # Se excluyen los que ya están en confirmados (Mode 03 tiene jerarquía superior)
    pendientes = []
    try:
        from conexion_ecu import leer_pending_dtc
        codigos_confirmados = {c['code'] for c in codigos}
        lista_p = leer_pending_dtc()
        pendientes = [
            _info(c)
            for c in lista_p
            if c not in codigos_confirmados
        ]
    except Exception:
        pass

    # Freeze Frame básico (RPM, velocidad, temperatura al momento del escaneo)
    freeze_frame = None
    if codigos:
        try:
            from decodificadores import decodificar_pid as _dec
            from conexion_ecu import enviar_pid as _enviar
            freeze_frame = {
                'rpm':   _dec('010C', _enviar('010C')),
                'vel':   _dec('010D', _enviar('010D')),
                'temp':  _dec('0105', _enviar('0105')),
            }
        except Exception:
            pass

    return jsonify({
        'mil': len(codigos) > 0,
        'codigos': codigos,
        'pendientes': pendientes,
        'freeze_frame': freeze_frame,
    })

@app.route('/codigos/borrar', methods=['POST'])
def borrar_codigos_endpoint():
    try:
        _borrar_arduino()  # Envía "04" al Arduino
    except Exception as e:
        return jsonify({'error': str(e), 'ok': False})
    return jsonify({'ok': True, 'mil': False, 'codigos': [], 'pendientes': [], 'freeze_frame': None})

def _leer_rpm_raw():
    """
    Lee RPM desde el Arduino.
    Devuelve el valor numérico si la ECU responde, o -1 si hay error de comunicación.
    -1  → APAGADO  (sin respuesta)
     0  → CONTACTO (ECU activa, motor detenido)
    >400→ ENCENDIDO
    """
    try:
        ecu.write(b"010C\n")
        resp = ecu.readline().decode().strip()
        if not resp or "NO DATA" in resp.upper() or "ERROR" in resp.upper():
            return -1
        datos = resp.split()
        if len(datos) >= 4:
            A = int(datos[2], 16)
            B = int(datos[3], 16)
            return ((A * 256) + B) // 4
    except Exception:
        pass
    return -1

def _leer_voltaje_raw():
    """Lee voltaje de batería desde el Arduino. Devuelve el valor en V o 0.0."""
    try:
        ecu.write(b"0142\n")
        resp = ecu.readline().decode().strip()
        datos = resp.split()
        if len(datos) >= 3:
            byte = int(datos[2], 16)
            return round(byte * 0.01, 2)
    except Exception:
        pass
    return 0.0

@app.route('/estado-motor', methods=['GET'])
def estado_motor_inteligente():
    """
    Determina el estado del sistema de forma inteligente:
      - APAGADO:    La ECU no responde (sin comunicación)
      - CONECTANDO: La ECU responde texto pero aún no datos válidos
      - CONTACTO:   La ECU responde con datos, RPM == 0 (llave en ON)
      - ENCENDIDO:  RPM > 400
    """
    voltaje = _leer_voltaje_raw()

    try:
        ecu.write(b'010C\n')
        resp = ecu.readline().decode().strip()

        if not resp or 'NO DATA' in resp.upper():
            return jsonify({'estado': 'APAGADO', 'rpm': 0, 'voltaje': voltaje})

        if 'SEARCHING' in resp.upper() or 'ERROR' in resp.upper():
            return jsonify({'estado': 'CONECTANDO', 'rpm': 0, 'voltaje': voltaje})

        datos = resp.split()
        if len(datos) >= 4:
            A = int(datos[2], 16)
            B = int(datos[3], 16)
            valor_rpm = ((A * 256) + B) // 4
            if valor_rpm > 400:
                return jsonify({'estado': 'ENCENDIDO', 'rpm': valor_rpm, 'voltaje': voltaje})
            else:
                return jsonify({'estado': 'CONTACTO', 'rpm': valor_rpm, 'voltaje': voltaje})

        return jsonify({'estado': 'CONECTANDO', 'rpm': 0, 'voltaje': voltaje})

    except Exception:
        return jsonify({'estado': 'APAGADO', 'rpm': 0, 'voltaje': voltaje})

@app.route('/protocolo', methods=['GET'])
def get_protocolo_actual():
    """Devuelve el protocolo actualmente activo sin re-escanear."""
    return jsonify(protocolo_activo)

@app.route('/protocolo/escanear', methods=['GET'])
def protocolo_escanear():
    """
    Lanza un escaneo completo de protocolos (ATZ + ATSP0 + fallback 1-9).
    Tarda entre 1 y 10 segundos según cuántos protocolos haya que probar.
    """
    resultado = escanear_protocolo()
    return jsonify(resultado)

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, threaded=False, processes=1)