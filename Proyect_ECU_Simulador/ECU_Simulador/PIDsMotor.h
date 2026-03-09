#ifndef PIDSMOTOR_H
#define PIDSMOTOR_H

#include <Arduino.h>

extern bool motor_encendido;

int rpm = 0;
int velocidad = 0;
int temperatura = 70;

int carga_motor = 0;
int tps = 0;
int maf = 0;
int map_sensor = 30;

// nuevos sensores
int temp_aire = 25;
int avance_encendido = 10;
int presion_combustible = 300;
int o2_sensor = 450;
int distancia_mil = 120;
int consumo_combustible = 5;

// configuración de cilindros
int num_cilindros = 4; // Cambia a 6 para simular 6 cilindros
int consumo_cilindros[6] = {0, 0, 0, 0, 0, 0};

unsigned long ultimoCambio = 0;

// actualizar valores simulados
void actualizarMotor(bool encendido) {
  if (!encendido) {
    rpm = 0;
    velocidad = 0;
    carga_motor = 0;
    tps = 0;
    maf = 0;
    map_sensor = 30;
    if (temperatura > 70)
      temperatura--;
    for (int i = 0; i < num_cilindros; i++) consumo_cilindros[i] = 0;
    return;
  }

  if (millis() - ultimoCambio > 1500) {
    ultimoCambio = millis();
    int variacion = random(-10, 20);
    tps = constrain(tps + variacion, 5, 90);
  }

  rpm = map(tps, 5, 90, 800, 4200);
  velocidad = map(rpm, 800, 4200, 0, 140);
  if (temperatura < 92)
    temperatura += random(0,2);
  carga_motor = map(tps, 5, 90, 10, 85);
  map_sensor = map(tps, 5, 90, 25, 95);
  maf = map(rpm, 800, 4200, 3, 75);
  temp_aire = map(map_sensor, 25, 95, 20, 45);
  avance_encendido = map(rpm, 800, 4200, 5, 35);
  presion_combustible = map(carga_motor, 10, 85, 250, 400);
  o2_sensor = random(200, 800);
  consumo_combustible = map(tps, 5, 90, 2, 12);
  for (int i = 0; i < num_cilindros; i++) {
    consumo_cilindros[i] = consumo_combustible / num_cilindros + random(-1, 2);
    if (consumo_cilindros[i] < 0) consumo_cilindros[i] = 0;
  }
}

// responder comandos OBD
void responderMotor(String cmd) {
  if (cmd == "010C") {
    int valor = rpm * 4;
    int A = valor / 256;
    int B = valor % 256;
    Serial.print("41 0C ");
    Serial.print(A, HEX);
    Serial.print(" ");
    Serial.println(B, HEX);
  }
  else if (cmd == "010D") {
    Serial.print("41 0D ");
    Serial.println(velocidad, HEX);
  }
  else if (cmd == "0105") {
    int A = temperatura + 40;
    Serial.print("41 05 ");
    Serial.println(A, HEX);
  }
  else if (cmd == "0104") {
    int A = carga_motor * 255 / 100;
    Serial.print("41 04 ");
    Serial.println(A, HEX);
  }
  else if (cmd == "0111") {
    int A = tps * 255 / 100;
    Serial.print("41 11 ");
    Serial.println(A, HEX);
  }
  else if (cmd == "0110") {
    int valor = maf * 100;
    int A = valor / 256;
    int B = valor % 256;
    Serial.print("41 10 ");
    Serial.print(A, HEX);
    Serial.print(" ");
    Serial.println(B, HEX);
  }
  else if (cmd == "010B") {
    Serial.print("41 0B ");
    Serial.println(map_sensor, HEX);
  }
  else if (cmd == "010F") {
    int A = temp_aire + 40;
    Serial.print("41 0F ");
    Serial.println(A, HEX);
  }
  else if (cmd == "010E") {
    int A = (avance_encendido * 2) + 128;
    Serial.print("41 0E ");
    Serial.println(A, HEX);
  }
  else if (cmd == "0123") {
    int A = presion_combustible / 10;
    Serial.print("41 23 ");
    Serial.println(A, HEX);
  }
  else if (cmd == "0133") {
    int A = o2_sensor / 5;
    int B = 128;
    Serial.print("41 33 ");
    Serial.print(A, HEX);
    Serial.print(" ");
    Serial.println(B, HEX);
  }
  else if (cmd == "0131") {
    int A = distancia_mil / 256;
    int B = distancia_mil % 256;
    Serial.print("41 31 ");
    Serial.print(A, HEX);
    Serial.print(" ");
    Serial.println(B, HEX);
  }
  else if (cmd == "015E") {
    int valor = consumo_combustible * 20;
    int A = valor / 256;
    int B = valor % 256;
    Serial.print("41 5E ");
    Serial.print(A, HEX);
    Serial.print(" ");
    Serial.println(B, HEX);
  }
  else if (cmd == "015F") { // Consumo por cilindro
    int consumo_simulado[6];
    for (int i = 0; i < num_cilindros; i++) {
      consumo_simulado[i] = consumo_cilindros[i];
    }
    if (num_cilindros >= 2) {
      consumo_simulado[1] += 4;
    }
    Serial.print("41 5F ");
    for (int i = 0; i < num_cilindros; i++) {
      Serial.print(consumo_simulado[i], HEX);
      if (i < num_cilindros - 1) Serial.print(" ");
    }
    Serial.println();
  }
} // <-- Fin de la función responderMotor

#endif // <-- Fuera de cualquier función