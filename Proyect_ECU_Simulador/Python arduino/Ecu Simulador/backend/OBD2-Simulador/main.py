import time
import msvcrt

from pids_motor import pids_motor
from pids_bateria import pids_bateria

from dashboard import mostrar_dashboard, mostrar_dashboard_principal, mostrar_dashboard_avanzado
from menu import mostrar_menu, mostrar_menu_motor, mostrar_menu_codigos
from conexion_ecu import ecu, leer_dtc, borrar_codigos, borrar_codigo

from pids.codigos import nombre_codigos


pids = {**pids_motor, **pids_bateria}

motor_encendido = False
en_menu = True


# -----------------------------
# CONSULTAR ESTADO CHECK ENGINE
# -----------------------------
def consultar_check_engine():

    ecu.write(b'0101\n')
    respuesta = ecu.readline().decode().strip()

    datos = respuesta.split()

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
            return "DESCONOCIDO"

    return "DESCONOCIDO"


# -----------------------------
# ENCENDER / APAGAR MOTOR
# -----------------------------
def toggle_motor():

    global motor_encendido

    if motor_encendido:
        ecu.write(b"MOTOR_OFF\n")
        motor_encendido = False
    else:
        ecu.write(b"MOTOR_ON\n")
        motor_encendido = True


# -----------------------------
# PROGRAMA PRINCIPAL
# -----------------------------
if __name__ == "__main__":
    try:
        while True:
            check_engine_estado = consultar_check_engine()
            if en_menu:
                opcion = mostrar_menu(motor_encendido)
                if opcion == "1":
                    toggle_motor()
                elif opcion == "2":
                    while True:
                        subopcion = mostrar_menu_motor()
                        if subopcion == "1":
                            mostrar_dashboard_principal(motor_encendido, check_engine_estado)
                            input("\nPresiona ENTER para volver al menú motor...")
                        elif subopcion == "2":
                            mostrar_dashboard_avanzado()
                            input("\nPresiona ENTER para volver al menú motor...")
                        elif subopcion == "3":
                            break
                elif opcion == "3":
                    while True:
                        subopcion = mostrar_menu_codigos()
                        # -----------------
                        # VER CÓDIGOS
                        # -----------------
                        if subopcion == "1":
                            codigos = leer_dtc()
                            if codigos:
                                print("\n⚠️ Códigos de error encontrados:")
                                for idx, c in enumerate(codigos, 1):
                                    nombre = nombre_codigos.get(c, "Descripción desconocida")
                                    print(f"{idx}. {c}: {nombre}")
                            else:
                                print("No hay códigos de falla")
                        # -----------------
                        # BORRAR CÓDIGOS
                        # -----------------
                        if subopcion == "2":
                            codigos = leer_dtc()
                            if codigos:
                                print("\n0. Borrar todos los códigos")
                                for idx, c in enumerate(codigos, 1):
                                    nombre = nombre_codigos.get(c, "Descripción desconocida")
                                    print(f"{idx}. {c}: {nombre}")
                                seleccion = input(
                                    "Selecciona el número del código a borrar (o 0 para borrar todos, vacío para no borrar): "
                                ).strip()
                                if seleccion == "0":
                                    resp = borrar_codigos()
                                    print("Respuesta ECU al borrar todos los códigos:", resp)
                                elif seleccion.isdigit() and 1 <= int(seleccion) <= len(codigos):
                                    codigo = codigos[int(seleccion) - 1].strip()
                                    print("Código a borrar:", codigo)  # Debug para verificar formato
                                    resp = borrar_codigo(codigo)
                                    print(f"Respuesta ECU al borrar {codigo}: {resp}")
                            else:
                                print("No hay códigos de falla")
                        if subopcion == "3":
                            break
                elif opcion == "4":
                    break
            else:
                mostrar_dashboard(pids, motor_encendido, check_engine_estado)
                if msvcrt.kbhit():
                    if msvcrt.getwch().lower() == "m":
                        en_menu = True
                time.sleep(0.2)
    except KeyboardInterrupt:
        print("\nPrograma terminado.")