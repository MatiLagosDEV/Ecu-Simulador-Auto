#ifndef PIDSBATERIA_H
#define PIDSBATERIA_H

float volt = 12.3;            // Voltaje inicial
bool bateria_mala = false;     // true = batería descargada / defectuosa

// Actualiza el voltaje según motor encendido/apagado y estado de la batería
void actualizarBateria(int rpmActual) {
  
  if (bateria_mala) {
    // Batería descargada o defectuosa
    volt = random(50, 110)/10.0;  // 5.0V a 11.0V
  } 
  else if (rpmActual > 0) { // motor encendido
    volt = random(135, 145)/10.0; // 13.5V a 14.5V
  } else { // motor apagado
    volt = random(110, 125)/10.0; // 11.0V a 12.5V
  }

  // Simular batería completamente muerta de vez en cuando
  if (!rpmActual && random(0,1000) < 5) { // 0.5% de probabilidad
    volt = random(0, 40)/10.0; // 0V a 4V
  }
}

// Responde al PID 0142 con el voltaje en formato OBD
void responderBateria(String comando) {
  if (comando == "0142") { // Voltaje batería
    int voltInt = (int)(volt * 10);
    Serial.print("41 42 ");
    Serial.println(voltInt, HEX);
  }
}

#endif