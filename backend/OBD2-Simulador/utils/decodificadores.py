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

def calcular_consumo_desde_maf(maf_gs):
    """
    Calcula el consumo de combustible en L/h a partir del flujo MAF en g/s.
    Fórmula estequiométrica gasolina:
      Relación aire/combustible = 14.7:1
      Densidad gasolina ≈ 750 g/L
    """
    if maf_gs is None or maf_gs < 0:
        return None
    return round((maf_gs / 14.7 / 750) * 3600, 2)

def calcular_consumo_desde_map(map_kpa, rpm, iat_c, cilindrada_L=1.6):
    """
    Speed Density: calcula consumo L/h desde MAP (kPa), RPM y
    temperatura de aire de admisión (°C).
    cilindrada_L: se obtiene del VIN vía NHTSA; default 1.6L (motor más universal).
    """
    if rpm is None or rpm <= 0 or map_kpa is None or map_kpa <= 0:
        return None
    T_K = (iat_c if iat_c is not None else 25) + 273.15
    VE      = 0.85          # Eficiencia volumétrica típica
    R_aire  = 287.1         # J/(kg·K) — constante específica del aire
    Vd_m3   = cilindrada_L / 1000.0
    MAP_Pa  = map_kpa * 1000.0
    N_rev_s = rpm / 60.0    # revoluciones por segundo
    # Motor 4 tiempos: N/2 ciclos por segundo
    maf_kg_s = (MAP_Pa * Vd_m3 * VE * (N_rev_s / 2)) / (R_aire * T_K)
    maf_gs   = maf_kg_s * 1000
    return round((maf_gs / 14.7 / 750) * 3600, 2)