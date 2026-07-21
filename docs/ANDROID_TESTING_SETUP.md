# Configuracion de Pruebas en Android Studio - Resumen

## Descripcion

Este documento describe la configuracion realizadas para permitir la ejecucion de pruebas en Android Studio para las aplicaciones `app-conductor` y `app-usuario`.

## Tipo de Proyecto

- **Framework**: Capacitor.js (puente entre Next.js y Android)
- **Estructura**: Monorepo con dos aplicaciones Android independientes
- **Build System**: Gradle 8.13.0
- **SDK**: Android API Level 36 (Android 14)
- **JDK**: Java 21

## Cambios Realizados

### 1. Correccion de Package Name en Tests

**Problema**: Los archivos de prueba de ejemplo usaban el package `com.getcapacitor.myapp` en lugar del package correcto de cada aplicacion.

**Solucion**: 
- Mover archivos de prueba a la estructura de directorios correcta
- Actualizar el package name en los archivos Java

**Archivos modificados**:
- `apps/app-conductor/android/app/src/test/java/com/moviliax/ruumruum/conductor/ExampleUnitTest.java`
- `apps/app-conductor/android/app/src/androidTest/java/com/moviliax/ruumruum/conductor/ExampleInstrumentedTest.java`
- `apps/app-usuario/android/app/src/test/java/com/moviliax/ruumruum/usuario/ExampleUnitTest.java`
- `apps/app-usuario/android/app/src/androidTest/java/com/moviliax/ruumruum/usuario/ExampleInstrumentedTest.java`

**Package names corregidos**:
- app-conductor: `com.moviliax.ruumruum.conductor`
- app-usuario: `com.moviliax.ruumruum.usuario`

### 2. Adicion de Dependencias de Pruebas

**Archivos modificados**:
- `apps/app-conductor/android/variables.gradle`
- `apps/app-usuario/android/variables.gradle`
- `apps/app-conductor/android/app/build.gradle`
- `apps/app-usuario/android/app/build.gradle`

**Nuevas versiones de dependencias**:
```gradle
// Testing libraries
mockitoVersion = '5.15.0'
mockitoKotlinVersion = '5.4.0'
coroutinesTestVersion = '1.9.0'
androidxTestCoreVersion = '1.6.1'
androidxTestRunnerVersion = '1.6.2'
androidxTestRulesVersion = '1.6.1'
```

**Nuevas dependencias en build.gradle**:
```gradle
// Unit testing
testImplementation "junit:junit:$junitVersion"
testImplementation "org.mockito:mockito-core:$mockitoVersion"
testImplementation "org.mockito.kotlin:mockito-kotlin:$mockitoKotlinVersion"
testImplementation "org.jetbrains.kotlinx:kotlinx-coroutines-test:$coroutinesTestVersion"

// Instrumentation testing
androidTestImplementation "androidx.test.ext:junit:$androidxJunitVersion"
androidTestImplementation "androidx.test.espresso:espresso-core:$androidxEspressoCoreVersion"
androidTestImplementation "androidx.test:core:$androidxTestCoreVersion"
androidTestImplementation "androidx.test:runner:$androidxTestRunnerVersion"
androidTestImplementation "androidx.test:rules:$androidxTestRulesVersion"
```

### 3. Documentacion

**Nuevos archivos**:
- `apps/app-conductor/android/docs/TESTING_GUIDE.md`
- `apps/app-usuario/android/docs/TESTING_GUIDE.md`

Contenido:
- Guia completa de configuracion
- Ejemplos de pruebas unitarias e instrumentadas
- Ejemplos de pruebas con Espresso (UI Testing)
- Solucion de problemas comunes
- Comandos utiles de Gradle

### 4. Script de Automatizacion

**Nuevo archivo**: `scripts/run-android-tests.sh`

Un script Bash que permite ejecutar pruebas de manera sencilla:

```bash
# Ejecutar pruebas unitarias de app-conductor
./scripts/run-android-tests.sh conductor unit

# Ejecutar pruebas instrumentadas de app-usuario
./scripts/run-android-tests.sh usuario instrumented

# Ejecutar todas las pruebas de todas las apps
./scripts/run-android-tests.sh all all
```

## Estructura de Directorios

```
ruum/
├── apps/
│   ├── app-conductor/
│   │   └── android/
│   │       ├── app/
│   │       │   ├── src/
│   │       │   │   ├── main/                    # Codigo principal
│   │       │   │   │   └── java/com/moviliax/ruumruum/conductor/
│   │       │   │   │       └── MainActivity.java
│   │       │   │   ├── test/                    # Pruebas unitarias
│   │       │   │   │   └── java/com/moviliax/ruumruum/conductor/
│   │       │   │   │       └── ExampleUnitTest.java
│   │       │   │   └── androidTest/             # Pruebas instrumentadas
│   │       │   │       └── java/com/moviliax/ruumruum/conductor/
│   │       │   │           └── ExampleInstrumentedTest.java
│   │       │   └── build.gradle
│   │       ├── build.gradle
│   │       ├── variables.gradle
│   │       └── docs/
│   │           └── TESTING_GUIDE.md
│   │
│   └── app-usuario/
│       └── android/                          # Estructura similar a app-conductor
│
└── scripts/
    └── run-android-tests.sh
```

## Como Empezar a Hacer Pruebas

### Requisitos Previos

1. **Android Studio** (2024.1 o superior)
2. **Java JDK 21**
3. **Android SDK** con API Level 36
4. **Dispositivo o emulador** conectado

### Pasos para Abrir en Android Studio

1. Abrir Android Studio
2. **File > Open**
3. Navegar a:
   - `ruum/apps/app-conductor/android/` para la app de conductor
   - `ruum/apps/app-usuario/android/` para la app de usuario
4. Android Studio sincronizara automaticamente Gradle

### Ejecutar Pruebas

#### Desde Android Studio

1. Abrir el panel **Project**
2. Navegar a: `app/src/test/java/` para pruebas unitarias
3. Click derecho en la clase de prueba
4. Seleccionar **Run 'ClassName'**

#### Desde Terminal

```bash
# Navegar al proyecto Android
cd apps/app-conductor/android

# Ejecutar pruebas unitarias
./gradlew test

# Ejecutar pruebas instrumentadas (requiere dispositivo)
./gradlew connectedAndroidTest

# Usando el script
cd ../..
./scripts/run-android-tests.sh conductor all
```

### Crear Nuevas Pruebas

#### Prueba Unitaria

```java
package com.moviliax.ruumruum.conductor;

import static org.junit.Assert.*;
import org.junit.Test;

public class MyNewTest {
    @Test
    public void testMyFunction() {
        int result = 2 + 2;
        assertEquals(4, result);
    }
}
```

Guardar en: `apps/app-conductor/android/app/src/test/java/com/moviliax/ruumruum/conductor/MyNewTest.java`

#### Prueba Instrumentada

```java
package com.moviliax.ruumruum.conductor;

import android.content.Context;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import org.junit.Test;
import org.junit.runner.RunWith;

@RunWith(AndroidJUnit4.class)
public class MyInstrumentedTest {
    @Test
    public void testAppContext() {
        Context appContext = InstrumentationRegistry.getInstrumentation().getTargetContext();
        assertEquals("com.moviliax.ruumruum.conductor", appContext.getPackageName());
    }
}
```

Guardar en: `apps/app-conductor/android/app/src/androidTest/java/com/moviliax/ruumruum/conductor/MyInstrumentedTest.java`

## Depuracion de Problemas Comunes

### El test no aparece en Android Studio
- Verificar que el archivo este en el directorio correcto
- Verificar que el package name sea correcto
- **File > Sync Project with Gradle Files**
- **File > Invalidate Caches / Restart**

### Error de compilacion
```
./gradlew --refresh-dependencies
```

### No se detectan dispositivos
```
adb devices
# Si no hay dispositivos, iniciar emulador o conectar dispositivo fisico
```

### Pruebas instrumentadas fallan
- Verificar que el emulador este completamente iniciado
- Verificar que el dispositivo tenga suficiente almacenamiento
- Verificar que la app se instale correctamente

## Recursos Adicionales

- [Documentacion de Android Testing](https://developer.android.com/training/testing)
- [JUnit 4 User Guide](https://junit.org/junit4/)
- [Mockito Documentation](https://site.mockito.org/)
- [Espresso Testing Guide](https://developer.android.com/training/testing/espresso)
- [Capacitor Android Guide](https://capacitorjs.com/docs/android)

## Notas Adicionales

- Las aplicaciones usan Capacitor.js para cargar la web app desde un servidor
- Para pruebas locales, configurar `RUUM_CAPACITOR_SERVER_URL=http://localhost:3000`
- Despues de cambios en la web app, ejecutar `npx cap sync android` para sincronizar
- Las pruebas unitarias se ejecutan en la JVM (rapido)
- Las pruebas instrumentadas requieren un dispositivo/emulador (mas lento)

## Comandos Gradle Utiles

```bash
# Compilar
./gradlew assembleDebug

# Instalar en dispositivo
./gradlew installDebug

# Limpiar
./gradlew clean

# Ver tareas disponibles
./gradlew tasks

# Ver dependencias
./gradlew dependencies

# Actualizar dependencias
./gradlew --refresh-dependencies
```
