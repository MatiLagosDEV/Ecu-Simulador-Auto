# --- Estado persistente del motor ---
import os
from flask import Flask, jsonify, request
from flask_cors import CORS
import requests
from vininfo import Vin
from conexion_ecu import ecu, enviar_pid
from pids_motor import pids_motor
from pids_bateria import pids_bateria
from decodificadores import decodificar_consumo_combustible

# --- Archivos para persistencia ---
MOTOR_STATE_FILE = 'motor_state.txt'

def get_motor_state():
    if os.path.exists(MOTOR_STATE_FILE):
        with open(MOTOR_STATE_FILE, 'r') as f:
            estado = f.read().strip()
            return estado == '1'
    return False

def set_motor_state(encendido):
    with open(MOTOR_STATE_FILE, 'w') as f:
        f.write('1' if encendido else '0')

def toggle_motor():
    encendido = get_motor_state()
    try:
        if encendido:
            ecu.write(b"MOTOR_OFF\n")
            set_motor_state(False)
        else:
            ecu.write(b"MOTOR_ON\n")
            set_motor_state(True)
    except Exception as e:
        print(f"Error al enviar comando a ECU: {e}")
        # No cambiar el estado si hay error

# --- Función para leer VIN ---
def leer_vin():
    """Lee VIN desde Arduino y decodifica marca, país, año aproximado y modelo vía NHTSA"""
    try:
        ecu.write(b"0902\n")  # PID estándar para VIN
        resp = ecu.readline().decode().strip()
        parts = resp.split()
        if len(parts) >= 3:
            vin = "".join(parts[2:])[:17]
        else:
            vin = ""
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

        # Modelo vía NHTSA
        try:
            url = f"https://vpic.nhtsa.dot.gov/api/vehicles/decodevin/{vin}?format=json"
            resp_api = requests.get(url, timeout=5).json()
            modelo = next((x["Value"] for x in resp_api["Results"] if x["Variable"]=="Model"), "Desconocido")
        except:
            modelo = "Desconocido"

        return {
            "vin": vin,
            "marca": vin_obj.manufacturer,
            "pais": vin_obj.country,
            "año": año,
            "modelo": modelo
        }

    except Exception as e:
        return {"vin": "Error", "marca": "-", "pais": "-", "año": "-", "modelo": "-", "error": str(e)}

# --- Función para decodificar PIDs ---
def decodificar_pid(pid, respuesta):
    datos = respuesta.split()
    if pid == "010C":  # RPM
        if len(datos) >= 4:
            try:
                A = int(datos[2], 16)
                B = int(datos[3], 16)
                rpm = ((A * 256) + B) // 4
                return f"{rpm} rpm"
            except:
                return respuesta
        return respuesta
    elif pid == "010D":  # Velocidad
        if len(datos) >= 3:
            try:
                velocidad = int(datos[2], 16)
                return f"{velocidad} km/h"
            except:
                return respuesta
        return respuesta
    elif pid == "0105":  # Temp Motor
        if len(datos) >= 3:
            try:
                temp = int(datos[2], 16) - 40
                return f"{temp} °C"
            except:
                return respuesta
        return respuesta
    elif pid == "0123":  # Consumo de combustible
        try:
            return decodificar_consumo_combustible(datos)
        except:
            return respuesta
    elif pid == "015E":  # Consumo de combustible
        try:
            return decodificar_consumo_combustible(datos)
        except:
            return respuesta
    elif pid == "0142":  # Voltaje Batería
        return respuesta
    elif pid == "0101":  # Check Engine
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

# --- Obtener todos los datos ---
def get_all_data():
    data = {}
    pids_todos = {**pids_motor, **pids_bateria}
    for pid, nombre in pids_todos.items():
        valor_crudo = enviar_pid(pid)
        valor = decodificar_pid(pid, valor_crudo)
        data[pid] = {'nombre': nombre, 'valor': valor}

    # Estado del motor
    motor_actual = get_motor_state()
    data['motor'] = 'Encendido' if motor_actual else 'Apagado'

    # VIN y info del vehículo
    data['vehiculo'] = leer_vin()
    return data

# --- Flask API ---
app = Flask(__name__)
CORS(app)

@app.route('/datos', methods=['GET'])
def datos():
    return jsonify(get_all_data())

@app.route('/motor/toggle', methods=['POST'])
def motor_toggle():
    toggle_motor()
    estado = 'Encendido' if get_motor_state() else 'Apagado'
    return jsonify({'motor': estado})

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, threaded=False, processes=1)