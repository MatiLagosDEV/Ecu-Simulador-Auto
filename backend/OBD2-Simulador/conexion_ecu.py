import serial
import time
import threading
from pids.codigos import nombre_codigos
import serial.tools.list_ports

# Función para detectar automáticamente el puerto COM del ELM327
def encontrar_puerto_elm327():
    """
    Detecta automáticamente el puerto COM del ELM327.
    Busca por descripción o VID/PID del adaptador USB.
    Retorna el puerto COM o None si no lo encuentra.
    """
    puertos = serial.tools.list_ports.comports()
    
    for puerto in puertos:
        # Buscar por descripción común del ELM327 o por VID/PID
        descripcion = puerto.description.lower()
        hwid = puerto.hwid.lower() if puerto.hwid else ""
        
        # Criterios para identificar ELM327
        if any(keyword in descripcion for keyword in ['elm', 'elm327', 'obd']):
            print(f"[ECU] ELM327 detectado en: {puerto.device} - {puerto.description}")
            return puerto.device
        
        # Alternativa: buscar por VID/PID común de adaptadores USB-Serial
        if 'vid:pid' in hwid or 'ch340' in hwid or 'ft232' in hwid:
            print(f"[ECU] Adaptador USB-Serial detectado en: {puerto.device} - {puerto.description}")
            return puerto.device
    
    print("[ECU] ERROR: No se encontró ELM327. Puertos disponibles:")
    for puerto in puertos:
        print(f"  - {puerto.device}: {puerto.description}")
    return None

# Detectar puerto automáticamente
puerto_auto = encontrar_puerto_elm327()

# Conexión serie con el adaptador OBD-II (por ejemplo, ELM327 USB/Bluetooth)
try:
    if puerto_auto:
        ecu = serial.Serial(puerto_auto, 9600, timeout=1)
    else:
        print("[ECU] Usando puerto por defecto COM3 (fallback)")
        ecu = serial.Serial("COM3", 9600, timeout=1)
except Exception as e:
    print(f"[ECU] ERROR al abrir puerto serie: {e}")
    ecu = None

if ecu:
    time.sleep(2)  # Pequeño retardo para que el adaptador quede listo

# Lock reentrant — evita colisiones si Flask atiende peticiones en paralelo
_serial_lock = threading.RLock()

# --- Inicialización del adaptador OBD-II ---
# Sin este paso muchos adaptadores quedan en un estado inicial y responden "NO DATA" a todo.
try:
    ecu.reset_input_buffer()
    ecu.write(b'ATZ\n')      # Reset del chip
    time.sleep(1.0)
    ecu.reset_input_buffer()
    for _cmd in [b'ATE0\n', b'ATL0\n', b'ATH1\n']:
        ecu.write(_cmd)
        time.sleep(0.1)
        ecu.readline()       # Consumir "OK"
    # Activar protocolo CAN 11/500 (protocolo 6) para dejar la ECU en CONTACTO
    ecu.write(b'ATSP6\n')
    time.sleep(1.5)          # Muchos adaptadores muestran "SEARCHING..." antes del OK
    ecu.reset_input_buffer() # Limpiar SEARCHING...OK del buffer
    print("[ECU] Protocolo CAN activado. Adaptador listo (CONTACTO).")
except Exception as _e:
    print(f"[ECU] Advertencia en inicialización: {_e}")

# --- FUNCIONES OBD ---
def enviar_pid(pid):
    with _serial_lock:
        ecu.write((pid+"\n").encode())
        resp = ecu.readline().decode().strip()
        time.sleep(0.03)  # 30 ms — previene saturación del ELM327
    return resp

def leer_dtc():
    with _serial_lock:
        ecu.write(b"03\n")
        resp = ecu.readline().decode().strip()
        time.sleep(0.03)
    print("\nRespuesta ECU:", resp)

    if resp == "" or "NO DATA" in resp:
        return []

    b = resp.split()
    codigos = []
    for i in range(1, len(b)):
        codigo = b[i]
        if codigo.startswith("P") and len(codigo) == 5:
            codigos.append(codigo)
    if codigos:
        print("\n⚠️ Códigos de error encontrados:")
        for codigo in codigos:
            desc = nombre_codigos.get(codigo, "Descripción desconocida")
            print(f"{codigo}: {desc}")
    return codigos

def leer_pending_dtc():
    """Mode 07 — códigos pendientes (detectados pero no confirmados aún)."""
    with _serial_lock:
        ecu.write(b"07\n")
        resp = ecu.readline().decode().strip()
        time.sleep(0.03)
    if resp == "" or "NO DATA" in resp:
        return []
    b = resp.split()
    codigos = [c for c in b[1:] if c.startswith("P") and len(c) == 5]
    return codigos

def borrar_codigos():
    with _serial_lock:
        ecu.write(b"04\n")
        resp = ecu.readline().decode().strip()
        time.sleep(0.03)
    return resp

def borrar_codigo(codigo):
    with _serial_lock:
        comando = f"DEL {codigo}\n"
        ecu.write(comando.encode())
        resp = ecu.readline().decode().strip()
        time.sleep(0.03)
    return resp