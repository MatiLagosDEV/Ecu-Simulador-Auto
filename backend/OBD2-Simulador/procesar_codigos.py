import json
from deep_translator import GoogleTranslator

# Nombre del archivo que descargaste
archivo_entrada = 'Codigos-obd2.json'
archivo_salida = 'fallas_es.json'

def traducir_base_datos():
    try:
        with open(archivo_entrada, 'r', encoding='utf-8') as f:
            datos = json.load(f)
        
        translator = GoogleTranslator(source='pt', target='es')
        db_final = {}
        
        total = len(datos)
        print(f"Detectados {total} códigos. Iniciando traducción...")

        for i, item in enumerate(datos):
            codigo = item['Code']
            desc_pt = item['Description']
            
            # Traducir descripción
            try:
                desc_es = translator.translate(desc_pt)
                db_final[codigo] = desc_es
            except:
                db_final[codigo] = desc_pt  # Si falla el internet, guarda el original
            
            # Mostrar progreso cada 50 códigos
            if i % 50 == 0:
                print(f"Progreso: {i}/{total} - Último: {codigo}: {db_final[codigo]}")
        
        # Guardar el resultado
        with open(archivo_salida, 'w', encoding='utf-8') as f:
            json.dump(db_final, f, ensure_ascii=False, indent=4)
            
        print(f"\n¡Listo! Se ha creado '{archivo_salida}' con éxito.")

    except FileNotFoundError:
        print(f"Error: No encontré el archivo {archivo_entrada}. Asegúrate de que esté en la misma carpeta.")

if __name__ == "__main__":
    traducir_base_datos()
