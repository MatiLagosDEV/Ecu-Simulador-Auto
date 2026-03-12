import serial
import time
import threading
from pids_codigos import nombre_codigos

# Conexión con Arduino
ecu = serial.Serial("COM3", 9600, timeout=1)
time.sleep(2)  # Esperar a que el Arduino reinicie

# Lock reentrant — evita colisiones si Flask atiende peticiones en paralelo
_serial_lock = threading.RLock()

# --- Inicialización del adaptador OBD-II ---
# Sin este paso el Arduino está en estado 0 (OFF) y responde "NO DATA" a todo.
# Equivale a lo que hace cualquier escáner al enchufarse:
try:
    ecu.reset_input_buffer()
    ecu.write(b'ATZ\n')      # Reset del chip
    time.sleep(1.0)
    ecu.reset_input_buffer()
    for _cmd in [b'ATE0\n', b'ATL0\n', b'ATH1\n']:
        ecu.write(_cmd)
        time.sleep(0.1)
        ecu.readline()       # Consumir "OK"
    # Activar protocolo CAN 11/500 (protocolo 6) para pasar Arduino a CONTACTO
    ecu.write(b'ATSP6\n')
    time.sleep(1.5)          # Arduino demora 1 s con "SEARCHING..." antes del OK
    ecu.reset_input_buffer() # Limpiar SEARCHING...OK del buffer
    print("[ECU] Protocolo CAN activado. Arduino en estado CONTACTO.")
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