#ifndef PIDSMOTOR_H
#define PIDSMOTOR_H

int rpm = 0;
int vel = 0;
int temp = 25; // temperatura inicial ambiente

void actualizarMotor(bool encendido) {

  if (encendido) {

    // RPM tipo ralentí o aceleración
    rpm = random(700, 3500);

    // velocidad depende de rpm
    if (rpm < 1200) {
      vel = random(0, 10);
    } else if (rpm < 2000) {
      vel = random(10, 40);
    } else {
      vel = random(40, 120);
    }

    // temperatura sube lentamente hasta ~95
    if (temp < 95) {
      temp += random(0,2);
    }

  } 
  else {

    // motor apagado
    rpm = 0;
    vel = 0;

    // temperatura baja lentamente hasta ambiente
    if (temp > 25) {
      temp -= random(0,2);
    }
  }
}

void responderMotor(String comando) {

  if (comando == "010C") { // RPM
    int valor = rpm * 4;   // fórmula OBD real
    int highByte = valor >> 8;
    int lowByte = valor & 0xFF;

    Serial.print("41 0C ");
    Serial.print(highByte, HEX);
    Serial.print(" ");
    Serial.println(lowByte, HEX);
  }

  else if (comando == "010D") { // Velocidad
    Serial.print("41 0D ");
    Serial.println(vel, HEX);
  }

  else if (comando == "0105") { // Temperatura
    int valor = temp + 40; // fórmula OBD real
    Serial.print("41 05 ");
    Serial.println(valor, HEX);
  }
}

#endif