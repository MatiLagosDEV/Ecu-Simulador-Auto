#include <Arduino.h>
#include "PIDsMotor.h"
#include "PIDsBateria.h"
#include "PIDSCODIGO.h"
#include "PIDsVin.h"    // <-- nuevo include

bool motor_encendido = false;
String comando = "";

void setup() {

  Serial.begin(9600);
  pinMode(LED_BUILTIN, OUTPUT);

  randomSeed(analogRead(0));
}

void loop() {

  // actualizar sistema de diagnóstico
  actualizarDiagnostico();

  // actualizar estado del Check Engine
  actualizarCheckEngine();

  // actualizar simulación constantemente
  actualizarMotor(motor_encendido);
  actualizarBateria(motor_encendido ? rpm : 0);

  // revisar comandos
  if (Serial.available()) {

    comando = Serial.readStringUntil('\n');
    comando.trim();

    if (comando == "MOTOR_ON") {

      motor_encendido = true;

    } 
    else if (comando == "MOTOR_OFF") {

      motor_encendido = false;

    } 
    else if (comando == "0101") {   // estado MIL
      responderEstadoMIL();
    }

    else if (comando == "03") {     // leer DTC
      enviarCodigos();
    }

    else if (comando == "04") {     // borrar DTC
      borrarCodigos();
    }

    else if (comando.startsWith("DEL")) {

      String codigo = comando.substring(4);
      codigo.trim();
      borrarCodigo(codigo);
    }

    else if (comando.startsWith("09")) {  // <-- nuevo: PID VIN
      responderVIN(comando);
    }

    else {

      // responder sensores
      responderMotor(comando);
      responderBateria(comando);

    }

    // LED actividad serial
    digitalWrite(LED_BUILTIN, HIGH);
    delay(50);
    digitalWrite(LED_BUILTIN, LOW);
  }

  delay(50);
}