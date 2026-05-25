import serial
import time
import threading
from pids.codigos import nombre_codigos
import serial.tools.list_ports

_serial_lock = threading.RLock()
ecu = None


def listar_puertos_disponibles():
    """Devuelve los puertos disponibles con metadatos útiles para la UI."""
    puertos = []
    for puerto in serial.tools.list_ports.comports():
        descripcion = puerto.description or ""
        hwid = puerto.hwid or ""
        descripcion_lower = descripcion.lower()
        hwid_lower = hwid.lower()
        puertos.append({
            "device": puerto.device,
            "description": descripcion,
            "hwid": hwid,
            "es_bluetooth": any(
                keyword in descripcion_lower
                for keyword in ["bluetooth", "rfcomm", "serial over bluetooth", "incoming", "outgoing"]
            ) or "bluetooth" in hwid_lower,
            "es_elm327": any(keyword in descripcion_lower for keyword in ["elm", "elm327", "obd"]),
        })
    return puertos


def encontrar_puerto_elm327():
    """Devuelve un puerto probable para un ELM327 sin abrirlo todavía."""
    puertos = listar_puertos_disponibles()

    for puerto in puertos:
        descripcion = puerto["description"].lower()
        hwid = puerto["hwid"].lower()
        if any(keyword in descripcion for keyword in ["elm", "elm327", "obd"]):
            return puerto["device"]
        if any(keyword in descripcion for keyword in ["bluetooth", "rfcomm", "serial over bluetooth", "outgoing"]) or "bluetooth" in hwid:
            return puerto["device"]

    if puertos:
        return puertos[0]["device"]
    return None


def _cerrar_ecu_actual():
    global ecu
    if ecu is not None:
        try:
            ecu.close()
        except Exception:
            pass
    ecu = None


def conectar_elm327(puerto=None, baudrate=9600, timeout=0.5):
    """Abre el puerto indicado y hace una inicialización ligera del ELM327."""
    global ecu

    with _serial_lock:
        if ecu is not None:
            try:
                if getattr(ecu, "port", None) == puerto and getattr(ecu, "is_open", True):
                    return {"ok": True, "puerto": puerto, "message": "ELM327 ya estaba conectado"}
            except Exception:
                pass
            _cerrar_ecu_actual()

        puerto_objetivo = puerto or encontrar_puerto_elm327()
        if not puerto_objetivo:
            return {
                "ok": False,
                "puerto": None,
                "error": "No se detectó ningún puerto compatible"
            }

        try:
            ecu = serial.Serial(puerto_objetivo, baudrate, timeout=timeout)
            time.sleep(1.0)
            ecu.reset_input_buffer()
            ecu.write(b'ATZ\n')
            time.sleep(1.0)
            ecu.reset_input_buffer()

            for comando in [b'ATE0\n', b'ATL0\n', b'ATH1\n']:
                ecu.write(comando)
                time.sleep(0.12)
                try:
                    ecu.readline()
                except Exception:
                    pass

            ecu.reset_input_buffer()
            return {
                "ok": True,
                "puerto": puerto_objetivo,
                "message": f"ELM327 conectado en {puerto_objetivo}"
            }
        except Exception as error:
            _cerrar_ecu_actual()
            return {
                "ok": False,
                "puerto": puerto_objetivo,
                "error": str(error)
            }


def desconectar_elm327():
    with _serial_lock:
        _cerrar_ecu_actual()
    return {"ok": True}

# --- FUNCIONES OBD ---
def enviar_pid(pid):
    if ecu is None:
        return "NO DATA"

    with _serial_lock:
        try:
            ecu.write((pid + "\n").encode())
            resp = ecu.readline().decode().strip()
            time.sleep(0.03)  # 30 ms — previene saturación del ELM327
            return resp or "NO DATA"
        except Exception as error:
            print(f"[ECU] Error enviando PID {pid}: {error}")
            return "NO DATA"

def leer_dtc():
    if ecu is None:
        return []

    with _serial_lock:
        try:
            ecu.write(b"03\n")
            resp = ecu.readline().decode().strip()
            time.sleep(0.03)
        except Exception as error:
            print(f"[ECU] Error leyendo DTC: {error}")
            return []
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
    if ecu is None:
        return []

    with _serial_lock:
        try:
            ecu.write(b"07\n")
            resp = ecu.readline().decode().strip()
            time.sleep(0.03)
        except Exception:
            return []
    if resp == "" or "NO DATA" in resp:
        return []
    b = resp.split()
    codigos = [c for c in b[1:] if c.startswith("P") and len(c) == 5]
    return codigos

def borrar_codigos():
    if ecu is None:
        return "NO CONNECTION"

    with _serial_lock:
        try:
            ecu.write(b"04\n")
            resp = ecu.readline().decode().strip()
            time.sleep(0.03)
            return resp
        except Exception as error:
            print(f"[ECU] Error borrando códigos: {error}")
            return "NO CONNECTION"

def borrar_codigo(codigo):
    if ecu is None:
        return "NO CONNECTION"

    with _serial_lock:
        try:
            comando = f"DEL {codigo}\n"
            ecu.write(comando.encode())
            resp = ecu.readline().decode().strip()
            time.sleep(0.03)
            return resp
        except Exception as error:
            print(f"[ECU] Error borrando código {codigo}: {error}")
            return "NO CONNECTION"