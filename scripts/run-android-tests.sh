#!/bin/bash

# Script para ejecutar pruebas en Android
# Uso: ./scripts/run-android-tests.sh [app] [tipo]
# 
# Parametros:
#   app:   conductor | usuario (default: conductor)
#   tipo:  unit | instrumented | all (default: all)

set -e

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Funcion para mostrar ayuda
show_help() {
    echo "Uso: $0 [app] [tipo]"
    echo ""
    echo "Parametros:"
    echo "  app:   conductor | usuario (default: conductor)"
    echo "  tipo:  unit | instrumented | all (default: all)"
    echo ""
    echo "Ejemplos:"
    echo "  $0 conductor unit          - Ejecutar pruebas unitarias de app-conductor"
    echo "  $0 usuario instrumented    - Ejecutar pruebas instrumentadas de app-usuario"
    echo "  $0 all all                 - Ejecutar todas las pruebas de todas las apps"
    echo ""
}

# Validar parametros
APP="$1"
TYPE="$2"

if [ -z "$APP" ] || [ "$APP" == "help" ] || [ "$APP" == "-h" ] || [ "$APP" == "--help" ]; then
    show_help
    exit 0
fi

# Determinar que apps ejecutar
case "$APP" in
    "conductor")
        APPS_TO_TEST=("app-conductor")
        ;;
    "usuario")
        APPS_TO_TEST=("app-usuario")
        ;;
    "all")
        APPS_TO_TEST=("app-conductor" "app-usuario")
        ;;
    *)
        echo -e "${RED}Error: App no valida. Opciones: conductor, usuario, all${NC}"
        show_help
        exit 1
        ;;
esac

# Determinar que tipo de pruebas ejecutar
case "$TYPE" in
    "unit")
        TEST_TYPE="unit"
        ;;
    "instrumented")
        TEST_TYPE="instrumented"
        ;;
    "all"|"")
        TEST_TYPE="all"
        ;;
    *)
        echo -e "${RED}Error: Tipo no valido. Opciones: unit, instrumented, all${NC}"
        show_help
        exit 1
        ;;
esac

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Ejecutando pruebas Android${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Funcion para ejecutar pruebas de una app
run_tests_for_app() {
    local app_name="$1"
    local test_type="$2"
    
    local android_dir="apps/${app_name}/android"
    local package_name=""
    
    case "$app_name" in
        "app-conductor")
            package_name="com.moviliax.ruumruum.conductor"
            ;;
        "app-usuario")
            package_name="com.moviliax.ruumruum.usuario"
            ;;
    esac
    
    echo -e "${YELLOW}App: ${app_name} (${package_name})${NC}"
    echo ""
    
    # Verificar que el directorio exista
    if [ ! -d "$android_dir" ]; then
        echo -e "${RED}Error: Directorio no encontrado: $android_dir${NC}"
        return 1
    fi
    
    # Navegar al directorio
    pushd "$android_dir" > /dev/null
    
    # Ejecutar pruebas segun el tipo
    if [ "$test_type" == "unit" ] || [ "$test_type" == "all" ]; then
        echo -e "${GREEN}[${app_name}] Ejecutando pruebas unitarias...${NC}"
        if ./gradlew test; then
            echo -e "${GREEN}[${app_name}] Pruebas unitarias completadas exitosamente${NC}"
        else
            echo -e "${RED}[${app_name}] Pruebas unitarias fallaron${NC}"
            popd > /dev/null
            return 1
        fi
        echo ""
    fi
    
    if [ "$test_type" == "instrumented" ] || [ "$test_type" == "all" ]; then
        echo -e "${GREEN}[${app_name}] Ejecutando pruebas instrumentadas...${NC}"
        echo "  Verificando dispositivos conectados..."
        
        # Verificar si hay dispositivos conectados
        local devices=$(adb devices 2>/dev/null | grep -v "List of devices" | grep device | wc -l)
        
        if [ "$devices" -eq 0 ]; then
            echo -e "${YELLOW}  Advertencia: No hay dispositivos conectados. Iniciando emulador...${NC}"
            echo "  Puedes iniciar un emulador manualmente o conectar un dispositivo."
            echo "  Usando comando: adb devices"
            
            # Intentar con emulador por defecto
            if adb start-server 2>/dev/null; then
                sleep 2
                devices=$(adb devices 2>/dev/null | grep -v "List of devices" | grep device | wc -l)
                if [ "$devices" -eq 0 ]; then
                    echo -e "${RED}  Error: No se pudo conectar a ningun dispositivo o emulador${NC}"
                    echo "  Para usar un emulador, primeroinitialo con:"
                    echo "    androidstudio -> AVD Manager -> Iniciar emulador"
                    popd > /dev/null
                    return 1
                fi
            fi
        fi
        
        if ./gradlew connectedAndroidTest; then
            echo -e "${GREEN}[${app_name}] Pruebas instrumentadas completadas exitosamente${NC}"
        else
            echo -e "${RED}[${app_name}] Pruebas instrumentadas fallaron${NC}"
            popd > /dev/null
            return 1
        fi
        echo ""
    fi
    
    popd > /dev/null
    return 0
}

# Ejecutar pruebas para cada app
ALL_PASSED=true
for app in "${APPS_TO_TEST[@]}"; do
    if ! run_tests_for_app "$app" "$TEST_TYPE"; then
        ALL_PASSED=false
    fi
done

if [ "$ALL_PASSED" = true ]; then
    echo -e "${GREEN}========================================${NC}"
    echo -e "${GREEN}  Todas las pruebas se ejecutaron correctamente${NC}"
    echo -e "${GREEN}========================================${NC}"
    exit 0
else
    echo -e "${RED}========================================${NC}"
    echo -e "${RED}  Algunas pruebas fallaron${NC}"
    echo -e "${RED}========================================${NC}"
    exit 1
fi
