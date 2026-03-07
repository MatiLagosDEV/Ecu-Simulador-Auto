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
    if 90 <= temp <= 105 or temp == 95:
        estado = "Normal"
    elif 110 <= temp <= 120:
        estado = "Alta"
    else:
        estado = "Frío"
    return f"{temp}°C ({estado})"


def decodificar_volt(b):
    A = hex_val(b[2])
    if A is None:
        return "N/A"
    return round(A*0.1,1)