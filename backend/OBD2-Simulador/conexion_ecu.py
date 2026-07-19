import serial
import time
import threading
from pids.codigos import nombre_codigos
import serial.tools.list_ports

_serial_lock = threading.RLock()
ecu = None
_connect_cancel = threading.Event()


def _clasificar_puerto(puerto):
    descripcion = (puerto.description or "").lower()
    hwid = (puerto.hwid or "").lower()

    es_bluetooth = any(
        keyword in descripcion
        for keyword in ["bluetooth", "rfcomm", "serial over bluetooth", "incoming", "outgoing"]
    ) or "bluetooth" in hwid

    es_elm327 = any(keyword in descripcion for keyword in ["elm", "elm327", "obd"])

    prioridad = 0
    if es_elm327:
        prioridad += 100
    if es_bluetooth:
        prioridad += 50
    if any(keyword in descripcion for keyword in ["outgoing", "salida"]):
        prioridad += 10
    if any(keyword in descripcion for keyword in ["incoming", "entrada"]):
        prioridad -= 5

    return {
        "device": puerto.device,
        "description": puerto.description or "",
        "hwid": puerto.hwid or "",
        "es_bluetooth": es_bluetooth,
        "es_elm327": es_elm327,
        "prioridad": prioridad,
    }


def listar_puertos_disponibles():
    """Devuelve los puertos disponibles con metadatos útiles para la UI."""
    puertos = [_clasificar_puerto(puerto) for puerto in serial.tools.list_ports.comports()]
    return sorted(puertos, key=lambda puerto: (-puerto["prioridad"], puerto["device"]))


def obtener_candidatos_elm327(preferido=None):
    """Devuelve puertos candidatos ordenados por probabilidad de ser el ELM327."""
    puertos = listar_puertos_disponibles()
    candidatos = []
    vistos = set()

    def _agregar(device):
        if device and device not in vistos:
            vistos.add(device)
            candidatos.append(device)

    if preferido:
        _agregar(preferido)

    for puerto in puertos:
        if puerto["es_elm327"] or puerto["es_bluetooth"]:
            _agregar(puerto["device"])

    for puerto in puertos:
        _agregar(puerto["device"])

    return candidatos


def encontrar_puerto_elm327():
    """Devuelve un puerto probable para un ELM327 sin abrirlo todavía."""
    candidatos = obtener_candidatos_elm327()
    return candidatos[0] if candidatos else None


def _cerrar_ecu_actual():
    global ecu
    if ecu is not None:
        try:
            ecu.close()
        except Exception:
            pass
    ecu = None


def cancelar_conexion_en_curso():
    """Marca cualquier intento de conexión en curso para que termine cuanto antes."""
    _connect_cancel.set()


def _conexion_cancelada():
    return _connect_cancel.is_set()


def conectar_elm327(puerto=None, baudrate=9600, timeout=0.5):
    """Abre el puerto indicado y hace una inicialización ligera del ELM327."""
    global ecu

    _connect_cancel.clear()

    if ecu is not None:
        try:
            if getattr(ecu, "port", None) == puerto and getattr(ecu, "is_open", True):
                return {"ok": True, "puerto": puerto, "message": "ELM327 ya estaba conectado"}
        except Exception:
            pass
        with _serial_lock:
            _cerrar_ecu_actual()

    candidatos = obtener_candidatos_elm327(preferido=puerto)
    if not candidatos:
        return {
            "ok": False,
            "puerto": None,
            "error": "No se detectó ningún puerto compatible"
        }

    def _esperar(ms_total, paso=0.05):
        restante = ms_total
        while restante > 0:
            if _conexion_cancelada():
                return False
            tramo = min(paso, restante)
            time.sleep(tramo)
            restante -= tramo
        return not _conexion_cancelada()

    ultimo_error = None
    for puerto_objetivo in candidatos:
        if _conexion_cancelada():
            break

        try:
            with _serial_lock:
                _cerrar_ecu_actual()
                ecu_local = serial.Serial(puerto_objetivo, baudrate, timeout=timeout)
                ecu = ecu_local

            if not _esperar(0.15):
                with _serial_lock:
                    _cerrar_ecu_actual()
                return {
                    "ok": False,
                    "puerto": puerto_objetivo,
                    "error": "Conexión cancelada"
                }

            with _serial_lock:
                if ecu is None:
                    raise RuntimeError("Conexión cancelada antes de inicializar")
                ecu.reset_input_buffer()
                ecu.write(b'ATZ\n')

            if not _esperar(0.4):
                with _serial_lock:
                    _cerrar_ecu_actual()
                return {
                    "ok": False,
                    "puerto": puerto_objetivo,
                    "error": "Conexión cancelada"
                }

            with _serial_lock:
                if ecu is None:
                    raise RuntimeError("Conexión cancelada durante reinicio")
                ecu.reset_input_buffer()

            for comando in [b'ATE0\n', b'ATL0\n', b'ATH1\n']:
                if _conexion_cancelada():
                    raise RuntimeError("Conexión cancelada")
                with _serial_lock:
                    if ecu is None:
                        raise RuntimeError("Conexión cancelada")
                    ecu.write(comando)
                if not _esperar(0.04):
                    raise RuntimeError("Conexión cancelada")
                with _serial_lock:
                    if ecu is not None:
                        try:
                            ecu.readline()
                        except Exception:
                            pass

            with _serial_lock:
                if ecu is not None:
                    ecu.reset_input_buffer()

            if _conexion_cancelada():
                raise RuntimeError("Conexión cancelada")

            return {
                "ok": True,
                "puerto": puerto_objetivo,
                "message": f"ELM327 conectado en {puerto_objetivo}"
            }
        except Exception as error:
            ultimo_error = error
            with _serial_lock:
                _cerrar_ecu_actual()

    return {
        "ok": False,
        "puerto": candidatos[0],
        "error": str(ultimo_error) if ultimo_error else "No se pudo abrir ningún puerto compatible"
    }


def desconectar_elm327():
    _connect_cancel.set()
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