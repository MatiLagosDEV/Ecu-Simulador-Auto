import time
import msvcrt

from pids_motor import pids_motor
from pids_bateria import pids_bateria

from dashboard import mostrar_dashboard
from menu import mostrar_menu, mostrar_menu_codigos
from conexion_ecu import ecu, leer_dtc, borrar_codigos, borrar_codigo

pids={**pids_motor,**pids_bateria}


motor_encendido=False
en_menu=True

from pids_codigos import nombre_codigos


def toggle_motor():
    global motor_encendido

    if motor_encendido:
        ecu.write(b"MOTOR_OFF\n")
        motor_encendido=False
    else:
        ecu.write(b"MOTOR_ON\n")
        motor_encendido=True


try:

    while True:

        if en_menu:

            opcion=mostrar_menu(motor_encendido)


            if opcion=="1":
                toggle_motor()

            elif opcion=="2":
                en_menu=False

            elif opcion=="3":
                while True:
                    subopcion = mostrar_menu_codigos()
                    if subopcion == "1":
                        codigos = leer_dtc()
                        if codigos:
                            print("\n⚠️ Códigos de error encontrados:")
                            for idx, c in enumerate(codigos, 1):
                                nombre = nombre_codigos.get(c, "Descripción desconocida")
                                print(f"{idx}. {c}: {nombre}")
                        else:
                            print("No hay códigos de falla")
                    elif subopcion == "2":
                        codigos = leer_dtc()
                        if codigos:
                            print("\n0. Borrar todos los códigos")
                            for idx, c in enumerate(codigos, 1):
                                nombre = nombre_codigos.get(c, "Descripción desconocida")
                                print(f"{idx}. {c}: {nombre}")
                            seleccion = input("Selecciona el número del código a borrar (o 0 para borrar todos, vacío para no borrar): ").strip()
                            if seleccion == "0":
                                resp = borrar_codigos()
                                print("Respuesta ECU al borrar todos los códigos:", resp)
                            elif seleccion.isdigit() and 1 <= int(seleccion) <= len(codigos):
                                codigo = codigos[int(seleccion)-1]
                                resp = borrar_codigo(codigo)
                                print(f"Respuesta ECU al borrar {codigo}: {resp}")
                        else:
                            print("No hay códigos de falla")
                    elif subopcion == "3":
                        break
            elif opcion=="4":
                break

        else:

            mostrar_dashboard(pids,motor_encendido)

            if msvcrt.kbhit():
                if msvcrt.getwch().lower()=="m":
                    en_menu=True

            time.sleep(0.2)

except KeyboardInterrupt:
    print("\nPrograma terminado.")