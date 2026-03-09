import serial
import time
import requests
from vininfo import Vin
from pids_codigos import nombre_codigos

# Conexión con Arduino
ecu = serial.Serial("COM3", 9600, timeout=1)
time.sleep(2)

def leer_vin():
    """Lee el VIN desde Arduino y decodifica marca, país, año aproximado y modelo vía NHTSA"""
    ecu.write(b"0902\n")  # PID estándar para VIN
    resp = ecu.readline().decode().strip()
    print(f"Respuesta cruda VIN: '{resp}'")
    # Limpiar respuesta y quedarnos con los 17 caracteres del VIN
    parts = resp.split()
    print(f"Partes de la respuesta: {parts}")
    if len(parts) >= 3:
        vin = "".join(parts[2:])[:17]
    else:
        vin = ""
    print(f"VIN extraído: '{vin}'")
    if vin:
        try:
            vin_obj = Vin(vin)
            print(f"Marca detectada: {vin_obj.manufacturer}")
            print(f"País de origen: {vin_obj.country}")
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
            print(f"Año aproximado: {año}")

            # Consultar modelo vía NHTSA
            try:
                url = f"https://vpic.nhtsa.dot.gov/api/vehicles/decodevin/{vin}?format=json"
                resp_api = requests.get(url, timeout=5).json()
                modelo = next((x["Value"] for x in resp_api["Results"] if x["Variable"]=="Model"), "Desconocido")
                print(f"Modelo detectado: {modelo}")
            except Exception as e:
                print("No se pudo obtener el modelo desde NHTSA:", e)

        except Exception as e:
            print("No se pudo decodificar el VIN:", e)
    else:
        print("No se pudo obtener el VIN del vehículo.")

# --- FUNCIONES OBD --- (igual que antes)
def enviar_pid(pid):
    ecu.write((pid+"\n").encode())
    resp = ecu.readline().decode().strip()
    return resp

def leer_dtc():
    ecu.write(b"03\n")
    resp = ecu.readline().decode().strip()
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

def borrar_codigos():
    ecu.write(b"04\n")
    resp = ecu.readline().decode().strip()
    return resp

def borrar_codigo(codigo):
    comando = f"DEL {codigo}\n"
    ecu.write(comando.encode())
    resp = ecu.readline().decode().strip()
    return resp

# --- EJEMPLO DE USO ---
leer_vin()
# dtc = leer_dtc()
# borrar_codigos()