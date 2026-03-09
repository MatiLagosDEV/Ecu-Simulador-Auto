#ifndef PIDSCODIGO_H
#define PIDSCODIGO_H

#include <Arduino.h>

extern bool motor_encendido;

bool checkEngine = false;
unsigned long ultimoChequeo = 0;

// Solo códigos reales
String codigos_posibles[] = {
  "P0300",
  "P0301",
  "P0302",
  "P0171",
  "P0172",
  "P0420"
};

String dtc_guardados[6];  // tamaño igual a codigos_posibles
int cantidad_fallas = 0;

// verificar si un código ya existe
bool codigoExiste(String c) {
  for (int i = 0; i < cantidad_fallas; i++) {
    if (dtc_guardados[i] == c)
      return true;
  }
  return false;
}

// generar fallas progresivamente
void generarFallas() {
  if (!motor_encendido) return;

  if (millis() - ultimoChequeo > 7000) {
    ultimoChequeo = millis();

    if (cantidad_fallas < 6) {  // máximo igual al tamaño del array
      // Crear lista de códigos disponibles que aún no están en dtc_guardados
      String disponibles[6];
      int cont = 0;
      for (int i = 0; i < 6; i++) {
        if (!codigoExiste(codigos_posibles[i])) {
          disponibles[cont++] = codigos_posibles[i];
        }
      }

      // Si hay códigos disponibles, agregar uno al azar
      if (cont > 0) {
        int idx = random(0, cont);
        dtc_guardados[cantidad_fallas] = disponibles[idx];
        cantidad_fallas++;
        checkEngine = true;
      }
    }
  }
}

// detectar si hay misfire
bool hayMisfire() {
  for (int i = 0; i < cantidad_fallas; i++) {
    if (dtc_guardados[i] == "P0300") return true;
  }
  return false;
}

// controlar LED check engine
void actualizarCheckEngine() {
  if (!checkEngine) {
    digitalWrite(LED_BUILTIN, LOW);
    return;
  }

  if (hayMisfire()) {
    static unsigned long t = 0;
    if (millis() - t > 200) {
      t = millis();
      digitalWrite(LED_BUILTIN, !digitalRead(LED_BUILTIN));
    }
  } else {
    digitalWrite(LED_BUILTIN, HIGH);
  }
}

// enviar todos los códigos
void enviarCodigos() {
  Serial.print("43 ");
  for (int i = 0; i < cantidad_fallas; i++) {
    // asegurarse de imprimir código completo
    Serial.print(dtc_guardados[i]);
    if (i < cantidad_fallas - 1) Serial.print(" ");
  }
  Serial.println();
}

// borrar un código específico
void borrarCodigo(String codigo) {
  bool borrado = false;
  for (int i = 0; i < cantidad_fallas; i++) {
    if (dtc_guardados[i] == codigo) {
      for (int j = i; j < cantidad_fallas - 1; j++) {
        dtc_guardados[j] = dtc_guardados[j + 1];
      }
      dtc_guardados[cantidad_fallas - 1] = "";
      cantidad_fallas--;
      borrado = true;
      break;
    }
  }
  if (cantidad_fallas == 0) checkEngine = false;
  Serial.println(borrado ? "OK" : "NO CODE");
}

// borrar todos los códigos
void borrarCodigos() {
  cantidad_fallas = 0;
  checkEngine = false;
  for (int i = 0; i < 6; i++) dtc_guardados[i] = "";
  Serial.println("44");
}

// responder estado MIL (PID 0101)
void responderEstadoMIL() {
  byte estado = cantidad_fallas;
  if (checkEngine) estado |= 0x80;
  Serial.print("41 01 ");
  Serial.print(estado, HEX);
  Serial.println(" 00 00 00");
}

// actualizar diagnóstico
void actualizarDiagnostico() {
  generarFallas();
}

#endif