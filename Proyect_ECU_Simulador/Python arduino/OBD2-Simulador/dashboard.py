from conexion_ecu import enviar_pid
from decodificadores import *

def obtener_valor(pid):

    resp = enviar_pid(pid)

    if resp=="" or "NO DATA" in resp:
        return "N/A"

    b = resp.split()

    if pid=="010C" and len(b)>=4:
        return decodificar_rpm(b)

    if pid=="010D" and len(b)>=3:
        return decodificar_vel(b)

    if pid=="0105" and len(b)>=3:
        return decodificar_temp(b)

    if pid=="0142" and len(b)>=3:
        return decodificar_volt(b)

    return "N/A"


def mostrar_dashboard(pids, motor_encendido):

    valores={}

    for pid,nombre in pids.items():
        valores[nombre]=obtener_valor(pid)

    valores["Motor"]="Encendido" if motor_encendido else "Apagado"

    linea=" | ".join(f"{k}: {v}" for k,v in valores.items())

    print(f"\r{linea} | Presiona 'm' para volver al menú",end="",flush=True)