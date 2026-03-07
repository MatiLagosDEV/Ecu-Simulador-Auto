import serial
import time

ecu = serial.Serial("COM3",9600,timeout=1)
time.sleep(2)

def enviar_pid(pid):
    ecu.write((pid+"\n").encode())
    resp = ecu.readline().decode().strip()
    return resp

def leer_dtc():
    ecu.write(b"03\n")
    resp = ecu.readline().decode().strip()

    if resp=="" or "NO DATA" in resp:
        return []

    b = resp.split()
    codigos=[]
    for i in range(1,len(b),2):
        if i+1 < len(b):
            if b[i]=="00" and b[i+1]=="00":
                break
            codigo="P"+b[i]+b[i+1]
            codigos.append(codigo)
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