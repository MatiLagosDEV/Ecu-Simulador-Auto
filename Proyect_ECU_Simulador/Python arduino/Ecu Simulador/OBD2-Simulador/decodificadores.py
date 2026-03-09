def decodificar_carga_motor(b):
    A = hex_val(b[2])
    if A is None:
        return "N/A"
    return f"{round(A*100/255,1)}%"

def decodificar_tps(b):
    A = hex_val(b[2])
    if A is None:
        return "N/A"
    return f"{round(A*100/255,1)}%"

def decodificar_maf(b):
    A = hex_val(b[2])
    B = hex_val(b[3])
    if A is None or B is None:
        return "N/A"
    return f"{round(((A*256)+B)/100,2)} g/s"

def decodificar_map(b):
    A = hex_val(b[2])
    if A is None:
        return "N/A"
    return f"{A} kPa"
def hex_val(val):
    try:
        return int(val,16)
    except:
        return None


def decodificar_rpm(b):
    A = hex_val(b[2])
    B = hex_val(b[3])
    if A is None or B is None:
        return "N/A"
    return int(((A*256)+B)/4)


def decodificar_vel(b):
    return hex_val(b[2])


def decodificar_temp(b):
    A = hex_val(b[2])
    if A is None:
        return "N/A"
    temp = A - 40
    if 80 <= temp <= 105:
        estado = "Normal"
    elif temp > 105:
        estado = "Alta"
    else:
        estado = "Frío"
    return f"{temp}°C ({estado})"

def decodificar_volt(b):
    A = hex_val(b[2])
    if A is None:
        return "N/A"
    return round(A*0.1,1)


def decodificar_temp_aire(b):
    A = hex_val(b[2])
    if A is None:
        return "N/A"
    temp = A - 40
    return f"{temp}°C"

def decodificar_avance_encendido(b):
    A = hex_val(b[2])
    if A is None:
        return "N/A"
    avance = (A - 128) / 2
    return f"{avance}°"

def decodificar_presion_combustible(b):
    A = hex_val(b[2])
    if A is None:
        return "N/A"
    presion = A * 10
    return f"{presion} kPa"

def decodificar_o2_sensor(b):
    A = hex_val(b[2])
    if A is None:
        return "N/A"
    voltaje = A * 5
    return f"{voltaje} mV"

def decodificar_distancia_mil(b):
    A = hex_val(b[2])
    B = hex_val(b[3])
    if A is None or B is None:
        return "N/A"
    distancia = (A * 256) + B
    return f"{distancia} km"

def decodificar_consumo_combustible(b):
    A = hex_val(b[2])
    B = hex_val(b[3])
    if A is None or B is None:
        return "N/A"
    consumo = ((A * 256) + B) / 20
    return f"{consumo:.1f} L/h"

def decodificar_consumo_cilindros(b):
    # b[2:] contiene los valores de cada cilindro en HEX
    consumos = []
    for val in b[2:]:
        try:
            consumos.append(int(val, 16))
        except:
            consumos.append("N/A")
    return consumos