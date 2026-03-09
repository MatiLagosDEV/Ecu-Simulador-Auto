#ifndef PIDSVIN_H
#define PIDSVIN_H

#include <Arduino.h>

extern bool motor_encendido;

// VIN simulado
String vin_actual = "VF1KZ000647300914";

// responder comando OBD para VIN
void responderVIN(String cmd) {
  // PID estándar para VIN: 0902 o 09 02
  if (cmd == "0902" || cmd == "09 02") {
    Serial.print("49 02 "); // respuesta estándar
    for (int i = 0; i < vin_actual.length(); i++) {
      Serial.print(vin_actual[i]);
    }
    Serial.println();
  }
}

#endif