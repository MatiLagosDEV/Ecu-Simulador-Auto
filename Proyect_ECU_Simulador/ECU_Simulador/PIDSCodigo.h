#ifndef PIDSCODIGO_H
#define PIDSCODIGO_H

#include <Arduino.h>

extern bool motor_encendido;

bool checkEngine = false;
unsigned long ultimoChequeo = 0;

String codigos_posibles[] = {
  "0133",
  "0300",
  "0420",
  "0171",
  "0100",
  "0113",
  "0128"
};

String dtc_guardados[5];
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

  if (!motor_encendido)
    return;

  if (millis() - ultimoChequeo > 7000) {

    ultimoChequeo = millis();

    if (cantidad_fallas < 5) {

      int idx = random(0,7);
      String nuevo = codigos_posibles[idx];

      if (!codigoExiste(nuevo)) {

        dtc_guardados[cantidad_fallas] = nuevo;
        cantidad_fallas++;

        checkEngine = true;
      }
    }
  }
}


// enviar todos los códigos
void enviarCodigos() {

  Serial.print("43 ");

  for (int i = 0; i < cantidad_fallas; i++) {

    Serial.print(dtc_guardados[i].substring(0,2));
    Serial.print(" ");
    Serial.print(dtc_guardados[i].substring(2,4));
    Serial.print(" ");
  }

  Serial.println("00");
}


// borrar un código específico
void borrarCodigo(String codigo) {

  for (int i = 0; i < cantidad_fallas; i++) {

    if (dtc_guardados[i] == codigo) {

      for (int j = i; j < cantidad_fallas - 1; j++) {
        dtc_guardados[j] = dtc_guardados[j+1];
      }

      cantidad_fallas--;
      break;
    }
  }

  if (cantidad_fallas == 0)
    checkEngine = false;

  Serial.println("OK");
}


// borrar todos
void borrarCodigos() {

  cantidad_fallas = 0;
  checkEngine = false;

  Serial.println("44");
}


void actualizarDiagnostico() {

  generarFallas();
}

#endif