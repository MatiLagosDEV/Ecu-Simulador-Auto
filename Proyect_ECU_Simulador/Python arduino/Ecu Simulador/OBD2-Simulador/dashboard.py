from conexion_ecu import enviar_pid
from decodificadores import *

def obtener_valor(pid):

    resp = enviar_pid(pid)

    if resp == "" or "NO DATA" in resp:
        return "N/A"

    b = resp.split()

    if pid == "010C" and len(b) >= 4:
        return decodificar_rpm(b)
    if pid == "010D" and len(b) >= 3:
        return decodificar_vel(b)
    if pid == "0105" and len(b) >= 3:
        return decodificar_temp(b)
    if pid == "0142" and len(b) >= 3:
        return decodificar_volt(b)
    if pid == "0104" and len(b) >= 3:
        return decodificar_carga_motor(b)
    if pid == "0111" and len(b) >= 3:
        return decodificar_tps(b)
    if pid == "0110" and len(b) >= 4:
        return decodificar_maf(b)
    if pid == "010B" and len(b) >= 3:
        return decodificar_map(b)
    if pid == "010F" and len(b) >= 3:
        return decodificar_temp_aire(b)
    if pid == "010E" and len(b) >= 3:
        return decodificar_avance_encendido(b)
    if pid == "0123" and len(b) >= 3:
        return decodificar_presion_combustible(b)
    if pid == "0133" and len(b) >= 4:
        return decodificar_o2_sensor(b)
    if pid == "0131" and len(b) >= 4:
        return decodificar_distancia_mil(b)
    if pid == "015E" and len(b) >= 4:
        return decodificar_consumo_combustible(b)
    return "N/A"


def mostrar_dashboard(pids, motor_encendido, check_engine_estado):

    valores = {}

    for pid, nombre in pids.items():
        valores[nombre] = obtener_valor(pid)

    valores["Motor"] = "Encendido" if motor_encendido else "Apagado"
    valores["Check Engine"] = check_engine_estado

    linea = " | ".join(f"{k}: {v}" for k, v in valores.items())

    print(f"\r{linea} | Presiona 'm' para volver al menú", end="", flush=True)


def mostrar_dashboard_principal(motor_encendido, check_engine_estado):

    import time
    import msvcrt
    try:
        while True:
            pids_principales = {
                "RPM": obtener_valor("010C"),
                "Velocidad": obtener_valor("010D"),
                "Temp Motor": obtener_valor("0105"),
                "Voltaje Batería": obtener_valor("0142")
            }
            pids_principales["Motor"] = "Encendido" if motor_encendido else "Apagado"
            pids_principales["Check Engine"] = check_engine_estado
            linea = " | ".join(f"{k}: {v}" for k, v in pids_principales.items())
            print(f"\r{linea} | Presiona ENTER para volver", end="", flush=True)
            time.sleep(0.5)
            if msvcrt.kbhit():
                if msvcrt.getwch() == '\r':
                    print()
                    break
    except KeyboardInterrupt:
        print()


def mostrar_dashboard_avanzado():

    import time
    import msvcrt
    try:
        while True:
            pids_avanzados = {
                "Carga Motor": obtener_valor("0104"),
                "TPS": obtener_valor("0111"),
                "MAF": obtener_valor("0110"),
                "MAP": obtener_valor("010B"),
                "Temp Aire": obtener_valor("010F"),
                "Avance Encendido": obtener_valor("010E"),
                "Presión Combustible": obtener_valor("0123"),
                "O2 Sensor": obtener_valor("0133"),
                "Distancia MIL": obtener_valor("0131"),
                "Consumo Combustible": obtener_valor("015E")
            }
            # Consumo por cilindro
            resp_cilindros = enviar_pid("015F")
            b_cilindros = resp_cilindros.split()
            consumos = []
            if len(b_cilindros) > 2:
                consumos = decodificar_consumo_cilindros(b_cilindros)
            linea = " | ".join(f"{k}: {v}" for k, v in pids_avanzados.items())
            if consumos:
                # Calcular promedio
                if len(consumos) > 1:
                    promedio = sum([c for c in consumos if isinstance(c, int)]) / len([c for c in consumos if isinstance(c, int)])
                    def estado_cilindro(c):
                        if isinstance(c, int) and abs(c - promedio) > 2:
                            return f"{c} (Gastando)"
                        elif isinstance(c, int):
                            return f"{c} (Normal)"
                        else:
                            return f"{c}"
                    linea += " | Consumo cilindros: " + ", ".join(estado_cilindro(c) for c in consumos)
                else:
                    linea += " | Consumo cilindros: " + ", ".join(str(c) for c in consumos)
            print(f"\rSensores avanzados: {linea} | Presiona ENTER para volver", end="", flush=True)
            time.sleep(0.5)
            if msvcrt.kbhit():
                if msvcrt.getwch() == '\r':
                    print()
                    break
    except KeyboardInterrupt:
        print()