def mostrar_menu(motor_encendido):

    estado="Apagar motor" if motor_encendido else "Encender motor"

    print("\n=== MENU ===")
    print(f"1. {estado}")
    print("2. Motor")
    print("3. Código")
    print("4. Salir")
    return input("Elige opción: ").strip()

def mostrar_menu_codigos():
    print("\n--- CÓDIGOS ---")
    print("1. Ver códigos de falla")
    print("2. Borrar códigos de error")
    print("3. Volver")
    return input("Elige opción: ").strip()