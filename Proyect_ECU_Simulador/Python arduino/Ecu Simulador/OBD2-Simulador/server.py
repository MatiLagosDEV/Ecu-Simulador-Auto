# --- Estado persistente del motor ---
import time
import math
import random
import serial.tools.list_ports
from flask import Flask, jsonify, request
from flask_cors import CORS
import requests
from vininfo import Vin
from pids_motor import pids_motor
from pids_bateria import pids_bateria
from decodificadores import (
    decodificar_carga_motor,
    decodificar_tps,
    decodificar_maf,
    decodificar_map,
    decodificar_rpm,
    decodificar_vel,
    decodificar_temp,
    decodificar_volt,
    decodificar_temp_aire,
    decodificar_avance_encendido,
    decodificar_presion_combustible,
    decodificar_o2_sensor,
    decodificar_distancia_mil,
    decodificar_consumo_combustible,
    decodificar_consumo_cilindros,
    calcular_consumo_desde_maf,
    calcular_consumo_desde_map,
    hex_val,
)

# Modo simulador / real
MODO_SIMULADOR = True  # Cambia a False cuando uses la ECU real

try:
    import obd  # Opcional, solo para modo simulador avanzado
except ImportError:  # Si no está instalado, seguiremos con simulación simple
    obd = None

if not MODO_SIMULADOR:
    # Importación normal: usa la ECU real/ELM327 vía conexion_ecu
    from conexion_ecu import (
        ecu,
        enviar_pid as _enviar_pid_hw,
        leer_dtc as _leer_dtc_hw,
        borrar_codigos as _borrar_arduino_hw,
    )
else:
    # En modo simulador no abrimos ningún puerto serie
    ecu = None
    _enviar_pid_hw = None
    _leer_dtc_hw = None
    _borrar_arduino_hw = None

    # Conexión de depuración interna opcional usando python-obd
    _obd_debug_connection = None
    if obd is not None:
        try:
            _obd_debug_connection = obd.OBD(portstr="debug")
        except Exception:
            _obd_debug_connection = None


# --- Motor de simulación OBD-II ---
_sim_t0 = time.monotonic()

# Estado simulado del motor (para /estado-motor y RPM)
_sim_estado = 'CONTACTO'      # CONTACTO inicial simulando llave en ON
_sim_ts_estado = _sim_t0
_sim_primera_vez = True       # Para aplicar la espera inicial de 15 s

# Variables simuladas (basadas en la lógica original de PIDSMOTOR.H)
_sim_rpm = 0
_sim_velocidad = 0
_sim_temperatura = 70

_sim_carga_motor = 0
_sim_tps = 0
_sim_maf = 0
_sim_map_sensor = 30

_sim_temp_aire = 25
_sim_avance_encendido = 10
_sim_presion_combustible = 300
_sim_o2_sensor = 450
_sim_distancia_mil = 120
_sim_consumo_combustible = 5

_sim_num_cilindros = 4
_sim_consumo_cilindros = [0, 0, 0, 0, 0, 0]
_sim_ultimo_cambio = _sim_t0

# Marcha simulada para relacionar RPM y velocidad
_sim_marcha = 1  # 1 a 6, aproximación de caja manual/deportiva

# Batería simulada (basada en PIDSBATERIA_H)
_sim_volt = 12.3
_sim_bateria_mala = False

# Diagnóstico / códigos de falla simulados (basados en PIDSCODIGO_H)
_sim_check_engine = False
_sim_ultimo_chequeo_dtc = _sim_t0
_sim_codigos_posibles = [
    'P0300',
    'P0301',
    'P0302',
    'P0171',
    'P0172',
    'P0420',
    'B0001',
]
_sim_dtc_guardados = []  # lista de códigos actuales
_sim_dtc_pendientes = []  # lista de códigos pendientes (Mode 07)
_sim_cantidad_fallas = 0


def _sim_estado_motor():
    """Pequeña máquina de estados para el motor simulado.

    Ciclo:
      - CONTACTO inicial
        · Espera 15 s antes del primer ENCEDIDO
      - ENCENDIDO durante 60 s
      - CONTACTO durante 60 s
      - ENCENDIDO 60 s
      - ... (se repite CONTACTO/ENCENDIDO cada minuto)
    """
    global _sim_estado, _sim_ts_estado, _sim_primera_vez

    ahora = time.monotonic()
    dt = ahora - _sim_ts_estado

    if _sim_estado == 'APAGADO':
        # Desde APAGADO pasamos a CONTACTO tras unos segundos
        if dt >= 5.0:
            _sim_estado = 'CONTACTO'
            _sim_ts_estado = ahora

    elif _sim_estado == 'CONTACTO':
        if _sim_primera_vez:
            # Primer arranque: esperar 15 s en contacto antes de encender
            if dt >= 15.0:
                _sim_estado = 'ENCENDIDO'
                _sim_ts_estado = ahora
                _sim_primera_vez = False
        else:
            # Contacto normal entre ciclos: 60 s
            if dt >= 60.0:
                _sim_estado = 'ENCENDIDO'
                _sim_ts_estado = ahora

    elif _sim_estado == 'ENCENDIDO':
        # Motor encendido durante 60 s antes de volver a CONTACTO
        if dt >= 60.0:
            _sim_estado = 'CONTACTO'
            _sim_ts_estado = ahora

    return _sim_estado


def _map_int(x, in_min, in_max, out_min, out_max):
    """Equivalente entero de map() clásico."""
    if x <= in_min:
        return out_min
    if x >= in_max:
        return out_max
    return int((x - in_min) * (out_max - out_min) / (in_max - in_min) + out_min)


def _sim_actualizar_motor():
    """Actualiza las variables simuladas imitando PIDSMOTOR.H."""
    global _sim_rpm, _sim_velocidad, _sim_temperatura
    global _sim_carga_motor, _sim_tps, _sim_maf, _sim_map_sensor
    global _sim_temp_aire, _sim_avance_encendido, _sim_presion_combustible
    global _sim_o2_sensor, _sim_distancia_mil, _sim_consumo_combustible
    global _sim_consumo_cilindros, _sim_ultimo_cambio
    global _sim_volt, _sim_bateria_mala
    global _sim_check_engine, _sim_ultimo_chequeo_dtc, _sim_dtc_guardados, _sim_dtc_pendientes, _sim_cantidad_fallas

    estado = _sim_estado_motor()
    encendido = (estado == 'ENCENDIDO')

    # Motor apagado / solo contacto: valores en reposo
    if not encendido:
        _sim_rpm = 0
        _sim_velocidad = 0
        _sim_carga_motor = 0
        _sim_tps = 0
        _sim_maf = 0
        _sim_map_sensor = 30
        # Enfriamiento progresivo del refrigerante hacia una "temperatura ambiente"
        # para que el dashboard pase por Frío/Normal al ciclar el simulador.
        temperatura_ambiente = 40
        if _sim_temperatura > temperatura_ambiente:
            # Enfría más rápido si venimos muy calientes
            delta = 2 if _sim_temperatura > 95 else 1
            _sim_temperatura = max(temperatura_ambiente, _sim_temperatura - delta)
        for i in range(len(_sim_consumo_cilindros)):
            _sim_consumo_cilindros[i] = 0
        # Actualizar batería en reposo
        # Basado en PIDSBATERIA_H: 11.0–12.5 V cuando rpm==0 y batería sana
        _sim_volt = random.uniform(11.0, 12.5) if not _sim_bateria_mala else random.uniform(5.0, 11.0)
        return

    ahora = time.monotonic()
    # Cada 1500 ms variamos TPS aleatoriamente para simular carga
    if ahora - _sim_ultimo_cambio > 1.5:
        _sim_ultimo_cambio = ahora
        variacion = random.randint(-10, 19)
        _sim_tps = max(5, min(90, _sim_tps + variacion))

    # Mapeos equivalentes a actualizarMotor(true)
    _sim_rpm = _map_int(_sim_tps, 5, 90, 800, 4200)
    _sim_velocidad = _map_int(_sim_rpm, 800, 4200, 0, 140)

    # Simulación de ECT: sube hasta zona alta y oscila para probar todos los estados
    # Frío (<60°C), Normal (~80–100°C) y Caliente (>105°C)
    if _sim_temperatura < 108:
        # Calentamiento mientras el motor está encendido
        _sim_temperatura += random.randint(0, 2)
    else:
        # Simular actuación del electroventilador bajando un poco la temperatura
        _sim_temperatura -= random.randint(0, 1)

    _sim_carga_motor = _map_int(_sim_tps, 5, 90, 10, 85)
    _sim_map_sensor = _map_int(_sim_tps, 5, 90, 25, 95)
    _sim_maf = _map_int(_sim_rpm, 800, 4200, 3, 75)
    _sim_temp_aire = _map_int(_sim_map_sensor, 25, 95, 20, 45)
    _sim_avance_encendido = _map_int(_sim_rpm, 800, 4200, 5, 35)
    _sim_presion_combustible = _map_int(_sim_carga_motor, 10, 85, 250, 400)
    _sim_o2_sensor = random.randint(200, 800)
    _sim_consumo_combustible = _map_int(_sim_tps, 5, 90, 2, 12)

    # Reparto de consumo entre cilindros
    if _sim_num_cilindros <= 0:
        _sim_num_cilindros_local = 4
    else:
        _sim_num_cilindros_local = _sim_num_cilindros

    base = _sim_consumo_combustible / max(1, _sim_num_cilindros_local)
    for i in range(_sim_num_cilindros_local):
        ruido = random.randint(-1, 1)
        val = int(base + ruido)
        if val < 0:
            val = 0
        _sim_consumo_cilindros[i] = val

    # --- Actualizar batería (PIDSBATERIA_H) ---
    if _sim_bateria_mala:
        # 5.0V a 11.0V
        _sim_volt = random.uniform(5.0, 11.0)
    elif _sim_rpm > 0:
        # 13.5V a 14.5V con motor encendido
        _sim_volt = random.uniform(13.5, 14.5)
    else:
        # 11.0V a 12.5V con motor parado pero batería bien
        _sim_volt = random.uniform(11.0, 12.5)

    # Simular batería completamente muerta con baja probabilidad
    if _sim_rpm == 0 and random.randint(0, 999) < 5:
        _sim_volt = random.uniform(0.0, 4.0)

    # --- Generar y evolucionar fallas progresivamente (PIDSCODIGO_H) ---
    if encendido:
        ahora = time.monotonic()
        if ahora - _sim_ultimo_chequeo_dtc > 7.0:
            _sim_ultimo_chequeo_dtc = ahora

            # 1) Promover un código pendiente a confirmado (simula que la ECU lo "consolida")
            if _sim_dtc_pendientes:
                codigo_promovido = _sim_dtc_pendientes.pop(0)
                if codigo_promovido not in _sim_dtc_guardados:
                    _sim_dtc_guardados.append(codigo_promovido)

            # 2) Si aún quedan códigos por generar, crear uno nuevo como pendiente
            codigos_usados = set(_sim_dtc_guardados) | set(_sim_dtc_pendientes)
            disponibles = [c for c in _sim_codigos_posibles if c not in codigos_usados]
            if disponibles:
                codigo_nuevo = random.choice(disponibles)
                _sim_dtc_pendientes.append(codigo_nuevo)

            # 3) Actualizar contadores y estado del MIL
            _sim_cantidad_fallas = len(_sim_dtc_guardados) + len(_sim_dtc_pendientes)
            _sim_check_engine = _sim_cantidad_fallas > 0


def _sim_rpm_actual():
    """Devuelve las RPM simuladas (actualizando primero el estado)."""
    _sim_actualizar_motor()
    return _sim_rpm


def _sim_hex_rpm():
    rpm = _sim_rpm_actual()
    # Fórmula estándar: RPM = ((A*256)+B) / 4
    val = int(rpm * 4)
    A = (val // 256) & 0xFF
    B = val % 256
    return f"41 0C {A:02X} {B:02X}"


def _sim_hex_speed():
    """Velocidad simulada según RPM."""
    _sim_actualizar_motor()
    speed = max(0, min(255, _sim_velocidad))
    return f"41 0D {speed:02X}"


def _sim_hex_temp():
    """Temperatura de refrigerante simulada."""
    _sim_actualizar_motor()
    temp_c = _sim_temperatura
    raw = temp_c + 40  # PID 0105: valor = temp + 40
    return f"41 05 {raw:02X}"


def _sim_hex_voltage():
    """Voltaje de batería aproximado para PID 0142.

    Codificamos como A*0.1 V para encajar con el frontend.
    """
    # _sim_volt ya ha sido actualizado en _sim_actualizar_motor
    raw = int(max(0, min(255, round(_sim_volt * 10))))
    return f"41 42 {raw:02X}"


def _sim_hex_maf():
    """MAF simulado (PID 0110) usando la misma fórmula que el firmware anterior."""
    _sim_actualizar_motor()
    # En PIDSMOTOR.H: int valor = maf * 100; A=valor/256, B=valor%256
    val = int(_sim_maf * 100)
    A = (val // 256) & 0xFF
    B = val % 256
    return f"41 10 {A:02X} {B:02X}"


def _sim_hex_map():
    """MAP simulado (PID 010B)."""
    _sim_actualizar_motor()
    return f"41 0B {_sim_map_sensor:02X}"


def _sim_hex_iat():
    """Temperatura de aire de admisión (PID 010F)."""
    _sim_actualizar_motor()
    raw = _sim_temp_aire + 40  # estándar OBD-II
    return f"41 0F {raw:02X}"


def _sim_hex_carga():
    """Carga motor (0104)."""
    _sim_actualizar_motor()
    A = int(_sim_carga_motor * 255 / 100)
    return f"41 04 {A:02X}"


def _sim_hex_tps():
    """Posición del acelerador (0111)."""
    _sim_actualizar_motor()
    A = int(_sim_tps * 255 / 100)
    return f"41 11 {A:02X}"


def _sim_hex_avance():
    """Avance de encendido (010E)."""
    _sim_actualizar_motor()
    A = int((_sim_avance_encendido * 2) + 128)
    return f"41 0E {A:02X}"


def _sim_hex_presion_combustible():
    """Presión de combustible (0123)."""
    _sim_actualizar_motor()
    A = int(_sim_presion_combustible / 10)
    return f"41 23 {A:02X}"


def _sim_hex_o2():
    """Sensor O₂ (0133)."""
    _sim_actualizar_motor()
    A = int(_sim_o2_sensor / 5)
    B = 128
    return f"41 33 {A:02X} {B:02X}"


def _sim_hex_distancia_mil():
    """Distancia con MIL encendido (0131)."""
    A = (_sim_distancia_mil // 256) & 0xFF
    B = _sim_distancia_mil % 256
    return f"41 31 {A:02X} {B:02X}"


def _sim_hex_consumo_combustible():
    """Consumo de combustible global (015E)."""
    _sim_actualizar_motor()
    valor = int(_sim_consumo_combustible * 20)
    A = (valor // 256) & 0xFF
    B = valor % 256
    return f"41 5E {A:02X} {B:02X}"


def _sim_hex_consumo_cilindros():
    """Consumo por cilindro (015F)."""
    _sim_actualizar_motor()
    # Ajustamos ligeramente el cilindro 2 si existe para simular un desequilibrio leve
    vals = list(_sim_consumo_cilindros)
    if _sim_num_cilindros >= 2:
        vals[1] = vals[1] + 4
    hex_vals = " ".join(f"{max(0, int(v)) & 0xFF:02X}" for v in vals[:_sim_num_cilindros])
    return f"41 5F {hex_vals}"


def _sim_hex_mil():
    """Estado MIL (PID 0101) basado en la cantidad de fallas.

    Igual que responderEstadoMIL en PIDSCODIGO_H:
      byte estado = cantidad_fallas; if (checkEngine) estado |= 0x80;
    """
    estado = _sim_cantidad_fallas & 0x7F
    if _sim_check_engine:
        estado |= 0x80
    # En Arduino se imprimen 3 bytes de datos, pero el frontend solo usa el primero
    return f"41 01 {estado:02X} 00 00 00"


def enviar_pid(pid: str) -> str:
    """Puerta única para pedir PIDs.

    - En modo real, delega a conexion_ecu.enviar_pid
    - En modo simulador, genera respuestas HEX simuladas
    """
    pid = (pid or "").strip().upper()

    if not MODO_SIMULADOR and _enviar_pid_hw:
        return _enviar_pid_hw(pid)

    # MODO_SIMULADOR: actualizar primero el estado del motor simulado
    _sim_actualizar_motor()

    if pid == "010C":  # RPM
        return _sim_hex_rpm()
    if pid == "010D":  # Velocidad
        return _sim_hex_speed()
    if pid == "0105":  # Temperatura refrigerante
        return _sim_hex_temp()
    if pid == "0104":  # Carga motor
        return _sim_hex_carga()
    if pid == "0111":  # TPS
        return _sim_hex_tps()
    if pid == "0142":  # Voltaje batería (casi no se usa en HEX)
        return _sim_hex_voltage()
    if pid == "0110":  # MAF
        return _sim_hex_maf()
    if pid == "010B":  # MAP
        return _sim_hex_map()
    if pid == "010F":  # IAT
        return _sim_hex_iat()
    if pid == "0101":  # Estado MIL (Check Engine)
        return _sim_hex_mil()
    if pid == "0123":  # Presión combustible
        return _sim_hex_presion_combustible()
    if pid == "0133":  # Sensor O2
        return _sim_hex_o2()
    if pid == "0131":  # Distancia MIL
        return _sim_hex_distancia_mil()
    if pid == "015E":  # Consumo combustible global
        return _sim_hex_consumo_combustible()
    if pid == "015F":  # Consumo por cilindro
        return _sim_hex_consumo_cilindros()

    # Para PIDs que no simulamos devolvemos NO DATA para que la lógica
    # de consumo/inteligente y demás los ignore de forma segura.
    return "NO DATA"


def leer_dtc():
    """Lectura de códigos de error.

    - Real: usa conexion_ecu.leer_dtc
    - Simulador: devuelve la lista de códigos generados progresivamente
    """
    if not MODO_SIMULADOR and _leer_dtc_hw:
        return _leer_dtc_hw()
    # Usar los códigos simulados actuales (PIDSCODIGO_H)
    return list(_sim_dtc_guardados)


def _borrar_arduino():
    """Borrado de códigos DTC en la ECU real o simulada."""
    if not MODO_SIMULADOR and _borrar_arduino_hw:
        return _borrar_arduino_hw()

    # Borrar todos los códigos simulados (borrarCodigos en PIDSCODIGO_H)
    global _sim_dtc_guardados, _sim_dtc_pendientes, _sim_cantidad_fallas, _sim_check_engine
    _sim_dtc_guardados = []
    _sim_dtc_pendientes = []
    _sim_cantidad_fallas = 0
    _sim_check_engine = False
    return "OK"

# --- Detectar tipo de conexión (USB / Bluetooth / Serial / Simulador) ---
def detectar_tipo_conexion():
    """Describe el tipo de conexión activo (real o simulador)."""
    if MODO_SIMULADOR:
        return 'Simulador OBD-II (debug)'

    try:
        puerto = ecu.port
        for p in serial.tools.list_ports.comports():
            if p.device.upper() == str(puerto).upper():
                desc = (p.description or '').lower()
                hwid = (p.hwid or '').lower()
                if 'bluetooth' in desc or 'bt' in desc or 'rfcomm' in desc or 'bluetooth' in hwid:
                    return 'Bluetooth'
                if 'usb' in desc or 'usb' in hwid or 'ch340' in desc or 'cp210' in desc or 'ft232' in desc or 'arduino' in desc:
                    return 'USB'
                return 'Serial'
    except Exception:
        pass
    return 'USB'  # default conservador

# --- Comunicación robusta con la ECU/ELM327 ---
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

        # Algunos adaptadores envían "SEARCHING..." (sin salto) + delay + "OK\r\n"
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
    if MODO_SIMULADOR:
        # En simulador fingimos siempre CAN 11/500
        protocolo_activo = {
            'numero': 6,
            'nombre': 'ISO 15765-4 CAN 11/500 (Simulado)',
            'conectado': True,
        }
        return protocolo_activo

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

# --- Caché consumo inteligente (máximo 1 recálculo cada 2 s) ---
_consumo_cache = {'resultado': {'valor': 'N/A', 'metodo': 'N/A'}, 'ts': 0.0}
_CONSUMO_TTL = 2.0  # segundos

# --- Función para leer VIN ---
def leer_vin():
    """Lee VIN desde la ECU/ELM327 y decodifica marca, país, año aproximado y modelo vía NHTSA"""
    global _vin_cache
    # Si ya tenemos un resultado completo (modelo != "-"), devolverlo directamente
    if _vin_cache and _vin_cache.get("modelo", "-") != "-":
        return _vin_cache
    try:
        if MODO_SIMULADOR:
            # En modo simulador usamos un VIN fijo y válido
            vin = "1G1Y12D77KS120296"
        else:
            ecu.write(b"0902\n")  # PID estándar para VIN
            resp = ecu.readline().decode().strip()
            datos = resp.split()
            vin = ""

            # Primero intenta decodificar como bytes HEX ASCII (formato OBD-II real)
            # Ejemplo típico: "49 02 01 38 47 42..." donde 38 47 42... son bytes ASCII del VIN
            if len(datos) > 3:
                try:
                    hex_vin = "".join(datos[3:])
                    vin_candidato = bytes.fromhex(hex_vin).decode('ascii', errors='ignore').strip()
                    vin_candidato = ''.join(c for c in vin_candidato if c.isalnum())[:17]
                    if len(vin_candidato) >= 10:
                        vin = vin_candidato
                except Exception:
                    pass

            # Fallback: el adaptador/ECU envió el VIN como texto plano tras el encabezado
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

        # Modelo y datos del motor vía NHTSA (funciona bien con VINs norteamericanos)
        modelo = "-"
        cilindrada = None
        config_motor = None
        num_cilindros = None
        combustible = None
        try:
            url = f"https://vpic.nhtsa.dot.gov/api/vehicles/decodevin/{vin}?format=json"
            resp_api = requests.get(url, timeout=5).json()
            resultados = resp_api.get("Results", [])
            valor_modelo = next((x["Value"] for x in resultados if x["Variable"] == "Model"), None)
            if valor_modelo and valor_modelo.strip() and valor_modelo.strip().lower() != "null":
                modelo = valor_modelo.strip()

            def _nhtsa(var):
                v = next((x["Value"] for x in resultados if x["Variable"] == var), None)
                if v and v.strip() and v.strip().lower() not in ("null", "not applicable", "n/a", ""):
                    return v.strip()
                return None

            # Cilindrada del motor (Displacement L)
            valor_cil = _nhtsa("Displacement (L)")
            if valor_cil:
                try:
                    cilindrada = round(float(valor_cil), 1)
                except Exception:
                    cilindrada = None

            # Configuración, cilindros y combustible
            config_motor  = _nhtsa("Engine Configuration")
            num_cilindros = _nhtsa("Engine Number of Cylinders")
            combustible   = _nhtsa("Fuel Type - Primary")
        except Exception:
            pass

        # Traducciones de valores NHTSA al español
        _CONFIG_ES = {
            'in-line': 'En línea',
            'inline':  'En línea',
            'v-shaped': 'V',
            'v':        'V',
            'flat':     'Bóxer',
            'opposed':  'Bóxer',
            'w-shaped': 'W',
            'w':        'W',
            'rotary':   'Rotativo',
            'single cylinder': 'Monocilíndrico',
        }
        _FUEL_ES = {
            'gasoline':                            'Gasolina',
            'diesel':                              'Diésel',
            'electric':                            'Eléctrico',
            'flex fuel':                           'Flex Fuel',
            'flexible fuel vehicle (ffv)':         'Flex Fuel',
            'flexible fuel vehicle':               'Flex Fuel',
            'natural gas':                         'Gas Natural',
            'compressed natural gas (cng)':        'Gas Natural (CNG)',
            'liquefied natural gas (lng)':         'Gas Natural (LNG)',
            'hybrid':                              'Híbrido',
            'plug-in hybrid':                      'Híbrido Enchufable',
            'plug-in hybrid electric vehicle (phev)': 'Híbrido Enchufable',
            'hydrogen':                            'Hidrógeno',
            'propane':                             'Propano',
            'biofuel':                             'Biocombustible',
            'ethanol':                             'Etanol',
        }
        if config_motor:
            config_motor = _CONFIG_ES.get(config_motor.lower(), config_motor)
        if combustible:
            combustible = _FUEL_ES.get(combustible.lower(), combustible)

        # Construir descripción legible del motor
        partes_motor = []
        if cilindrada:
            partes_motor.append(f"{cilindrada}L")
        if config_motor:
            partes_motor.append(config_motor)
        if num_cilindros:
            partes_motor.append(f"{num_cilindros} cil.")
        if combustible:
            partes_motor.append(combustible)
        motor_desc = " · ".join(partes_motor) if partes_motor else "-"

        # Si NHTSA no devolvió modelo, buscar en tabla de overrides europeos/asiáticos
        if modelo == "-":
            modelo = _detectar_modelo_override(vin) or "-"

        # Usar override de marca si existe, si no usar vininfo
        marca = _detectar_marca_override(vin) or vin_obj.manufacturer

        _PAIS_ES = {
            'japan':          'Japón',
            'united states':  'EE. UU.',
            'usa':            'EE. UU.',
            'germany':        'Alemania',
            'south korea':    'Corea del Sur',
            'korea':          'Corea del Sur',
            'france':         'Francia',
            'italy':          'Italia',
            'spain':          'España',
            'united kingdom': 'Reino Unido',
            'england':        'Reino Unido',
            'mexico':         'México',
            'canada':         'Canadá',
            'china':          'China',
            'sweden':         'Suecia',
            'australia':      'Australia',
            'brazil':         'Brasil',
            'india':          'India',
            'netherlands':    'Países Bajos',
            'czech republic': 'República Checa',
            'slovakia':       'Eslovaquia',
            'austria':        'Austria',
            'belgium':        'Bélgica',
            'finland':        'Finlandia',
            'portugal':       'Portugal',
            'russia':         'Rusia',
            'turkey':         'Turquía',
            'south africa':   'Sudáfrica',
            'taiwan':         'Taiwán',
            'thailand':       'Tailandia',
            'malaysia':       'Malasia',
            'indonesia':      'Indonesia',
        }
        pais_raw = vin_obj.country or ''
        pais = _PAIS_ES.get(pais_raw.lower(), pais_raw)

        resultado = {
            "vin": vin,
            "marca": marca,
            "pais": pais,
            "año": año,
            "modelo": modelo,
            "cilindrada": cilindrada,
            "motor": motor_desc,
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
    # NOTA: usamos las funciones de decodificadores.py para mantener
    # exactamente la misma lógica que el firmware original.
    if pid == "010C":  # RPM
        try:
            rpm = decodificar_rpm(datos)
            return f"{rpm} rpm" if rpm != "N/A" else respuesta
        except Exception:
            return respuesta
    elif pid == "010D":  # Velocidad
        try:
            vel = decodificar_vel(datos)
            return f"{vel} km/h" if vel is not None else respuesta
        except Exception:
            return respuesta
    elif pid == "0105":  # Temp Motor (refrigerante)
        try:
            return decodificar_temp(datos)
        except Exception:
            return respuesta
    elif pid == "010F":  # Temperatura aire de admisión (IAT)
        try:
            return decodificar_temp_aire(datos)
        except Exception:
            return respuesta
    elif pid == "0104":  # Carga motor calculada
        try:
            return decodificar_carga_motor(datos)
        except Exception:
            return respuesta
    elif pid == "0111":  # TPS
        try:
            return decodificar_tps(datos)
        except Exception:
            return respuesta
    elif pid == "0110":  # MAF
        try:
            return decodificar_maf(datos)
        except Exception:
            return respuesta
    elif pid == "010B":  # MAP
        try:
            return decodificar_map(datos)
        except Exception:
            return respuesta
    elif pid == "0142":  # Voltaje Batería
        try:
            volt = decodificar_volt(datos)
            return f"{volt} V" if volt != "N/A" else respuesta
        except Exception:
            return respuesta
    elif pid == "010E":  # Avance encendido
        try:
            return decodificar_avance_encendido(datos)
        except Exception:
            return respuesta
    elif pid == "0123":  # Presión combustible riel
        try:
            return decodificar_presion_combustible(datos)
        except Exception:
            return respuesta
    elif pid == "0133":  # Sensor O2 (tensión)
        try:
            return decodificar_o2_sensor(datos)
        except Exception:
            return respuesta
    elif pid == "0131":  # Distancia con MIL encendido
        try:
            return decodificar_distancia_mil(datos)
        except Exception:
            return respuesta
    elif pid == "015E":  # Consumo de combustible global
        try:
            return decodificar_consumo_combustible(datos)
        except Exception:
            return respuesta
    elif pid == "015F":  # Consumo por cilindro
        try:
            consumos = decodificar_consumo_cilindros(datos)
            return ", ".join(str(c) for c in consumos)
        except Exception:
            return respuesta
    elif pid == "0101":  # Check Engine / MIL
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

# --- Consumo inteligente: MAF → MAP (cascada) ---
def _consumo_desde_raws(raws):
    """
    Calcula el consumo a partir de un dict de respuestas raw ya leídas
    {pid: respuesta_hex}. No toca el puerto serial.
    """
    def _ok(r): return bool(r) and 'NO DATA' not in r.upper() and 'ERROR' not in r.upper()

    # ── Intento 1: MAF (0110) ────────────────────────────────────
    resp_maf = raws.get('0110', '')
    if _ok(resp_maf):
        b = resp_maf.split()
        if len(b) >= 4:
            A = hex_val(b[2]); B = hex_val(b[3])
            if A is not None and B is not None:
                maf_gs = ((A * 256) + B) / 100
                lh = calcular_consumo_desde_maf(maf_gs)
                if lh is not None:
                    return {'valor': f'{lh} L/h', 'metodo': 'MAF'}

    # ── Intento 2: MAP + RPM + IAT (Speed Density) ──────────────
    resp_map = raws.get('010B', '')
    resp_rpm = raws.get('010C', '')
    resp_iat = raws.get('010F', '')

    if _ok(resp_map) and _ok(resp_rpm):
        bm = resp_map.split(); br = resp_rpm.split()
        map_kpa = hex_val(bm[2]) if len(bm) >= 3 else None
        rpm = None
        if len(br) >= 4:
            A_r = hex_val(br[2]); B_r = hex_val(br[3])
            if A_r is not None and B_r is not None:
                rpm = ((A_r * 256) + B_r) // 4
        iat_c = 25  # default si no hay sensor IAT
        if _ok(resp_iat):
            bi = resp_iat.split()
            if len(bi) >= 3:
                raw = hex_val(bi[2])
                if raw is not None:
                    iat_c = raw - 40
        cilindrada = (_vin_cache or {}).get('cilindrada') or 1.6
        lh = calcular_consumo_desde_map(map_kpa, rpm, iat_c, cilindrada_L=cilindrada)
        if lh is not None:
            return {'valor': f'{lh} L/h', 'metodo': 'MAP'}

    return {'valor': 'N/A', 'metodo': 'N/A'}


def _consumo_inteligente():
    """
    Versión con caché (TTL 2 s) para el endpoint /consumo-inteligente.
    Consulta el serial solo cuando el caché expiró.
    """
    global _consumo_cache
    if time.monotonic() - _consumo_cache['ts'] < _CONSUMO_TTL:
        return _consumo_cache['resultado']
    resultado = _consumo_desde_raws({
        '0110': enviar_pid('0110'),
        '010B': enviar_pid('010B'),
        '010C': enviar_pid('010C'),
        '010F': enviar_pid('010F'),
    })
    _consumo_cache = {'resultado': resultado, 'ts': time.monotonic()}
    return resultado


# --- Obtener todos los datos ---
def get_all_data():
    data = {}
    raws = {}  # respuestas hex crudas — reutilizadas para consumo, sin queries extra
    pids_todos = {**pids_motor, **pids_bateria}
    for pid, nombre in pids_todos.items():
        valor_crudo = enviar_pid(pid)
        raws[pid] = valor_crudo
        valor = decodificar_pid(pid, valor_crudo)
        data[pid] = {'nombre': nombre, 'valor': valor}

    # Consumo calculado desde datos ya leídos — cero queries extra al serial
    data['consumo_inteligente'] = _consumo_desde_raws(raws)

    # VIN y info del vehículo
    data['vehiculo'] = leer_vin()
    return data

# --- Flask API ---
app = Flask(__name__)
CORS(app)

@app.route('/datos', methods=['GET'])
def datos():
    return jsonify(get_all_data())

@app.route('/consumo-inteligente', methods=['GET'])
def consumo_inteligente_endpoint():
    """Devuelve el consumo calculado con MAF o MAP (cascada). Útil para polling rápido."""
    return jsonify(_consumo_inteligente())

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
    if MODO_SIMULADOR:
        # En simulador usamos la lista de códigos pendientes propia
        pendientes = [_info(c) for c in _sim_dtc_pendientes]
    else:
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
            if MODO_SIMULADOR:
                # Usar el mismo simulador de PIDs para el freeze frame
                freeze_frame = {
                    'rpm':  _dec('010C', enviar_pid('010C')),
                    'vel':  _dec('010D', enviar_pid('010D')),
                    'temp': _dec('0105', enviar_pid('0105')),
                }
            else:
                from conexion_ecu import enviar_pid as _enviar
                freeze_frame = {
                    'rpm':  _dec('010C', _enviar('010C')),
                    'vel':  _dec('010D', _enviar('010D')),
                    'temp': _dec('0105', _enviar('0105')),
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
    """Lee RPM.

    - Simulador: usa la función de RPM oscilante interna
    - Real: consulta directamente a la ECU por el PID 010C
    """
    if MODO_SIMULADOR:
        return _sim_rpm_actual()

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
    """Lee voltaje de batería. Devuelve el valor en V o 0.0."""
    if MODO_SIMULADOR:
        return 14.1

    try:
        ecu.write(b"0142\n")
        resp = ecu.readline().decode().strip()
        datos = resp.split()
        if len(datos) >= 3:
            byte = int(datos[2], 16)
            return round(byte * 0.1, 2)
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

    # En simulador usamos la máquina de estados interna sin tocar ecu
    if MODO_SIMULADOR:
        estado = _sim_estado_motor()
        rpm = _sim_rpm_actual()
        return jsonify({
            'estado': estado,
            'rpm': rpm,
            'voltaje': voltaje,
            'conexion': detectar_tipo_conexion(),
        })

    try:
        ecu.write(b'010C\n')
        resp = ecu.readline().decode().strip()

        if not resp or 'NO DATA' in resp.upper():
            return jsonify({'estado': 'APAGADO', 'rpm': 0, 'voltaje': voltaje, 'conexion': detectar_tipo_conexion()})

        if 'SEARCHING' in resp.upper() or 'ERROR' in resp.upper():
            return jsonify({'estado': 'CONECTANDO', 'rpm': 0, 'voltaje': voltaje, 'conexion': detectar_tipo_conexion()})

        datos = resp.split()
        if len(datos) >= 4:
            A = int(datos[2], 16)
            B = int(datos[3], 16)
            valor_rpm = ((A * 256) + B) // 4
            if valor_rpm > 400:
                return jsonify({'estado': 'ENCENDIDO', 'rpm': valor_rpm, 'voltaje': voltaje, 'conexion': detectar_tipo_conexion()})
            else:
                return jsonify({'estado': 'CONTACTO', 'rpm': valor_rpm, 'voltaje': voltaje, 'conexion': detectar_tipo_conexion()})

        return jsonify({'estado': 'CONECTANDO', 'rpm': 0, 'voltaje': voltaje, 'conexion': detectar_tipo_conexion()})

    except Exception:
        return jsonify({'estado': 'APAGADO', 'rpm': 0, 'voltaje': voltaje, 'conexion': detectar_tipo_conexion()})

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