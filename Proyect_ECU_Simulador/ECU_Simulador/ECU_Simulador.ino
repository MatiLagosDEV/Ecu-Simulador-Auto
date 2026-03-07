#include <Arduino.h>
#include "PIDsMotor.h"
#include "PIDsBateria.h"
#include "PIDSCODIGO.h"

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
    else {

      // actualizar simulación del motor
      actualizarMotor(motor_encendido);

      // actualizar batería
      actualizarBateria(motor_encendido ? rpm : 0);

      // responder PIDs
      responderMotor(comando);
      responderBateria(comando);

      // leer códigos de error
      if (comando == "03") {
        enviarCodigos();
      }

      // borrar todos los códigos
      else if (comando == "04") {
        borrarCodigos();
      }

      // borrar un código específico
      else if (comando.startsWith("DEL")) {

        String codigo = comando.substring(4);
        codigo.trim();

        borrarCodigo(codigo);
      }

    }

    // LED indica recepción de comando
    digitalWrite(LED_BUILTIN, HIGH);
    delay(50);
    digitalWrite(LED_BUILTIN, LOW);
  }

  delay(50);
}