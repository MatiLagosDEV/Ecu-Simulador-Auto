#ifndef PIDSBATERIA_H
#define PIDSBATERIA_H

#include <Arduino.h>

// Variables globales estáticas
static float volt = 12.3;          
static bool bateria_mala = false;   

// Función para actualizar el voltaje
static void actualizarBateria(int rpmActual) {
    if (bateria_mala) {
        volt = random(50, 110) / 10.0;  // 5.0V a 11.0V
    } 
    else if (rpmActual > 0) { 
        volt = random(135, 145) / 10.0; // 13.5V a 14.5V
    } 
    else { 
        volt = random(110, 125) / 10.0; // 11.0V a 12.5V
    }

    // Simular batería completamente muerta
    if (!rpmActual && random(0, 1000) < 5) { 
        volt = random(0, 40) / 10.0; // 0V a 4V
    }
}

// Función para responder al PID 0142
static void responderBateria(String comando) {
    if (comando == "0142") { 
        int voltInt = (int)(volt * 100); // centésimas
        Serial.print("41 42 ");
        if (voltInt < 16) Serial.print("0"); // para formato 2 dígitos
        Serial.println(voltInt, HEX);
    }
}

#endif