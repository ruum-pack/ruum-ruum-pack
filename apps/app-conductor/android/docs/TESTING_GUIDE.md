# Guia de Configuracion de Pruebas - Android (Capacitor)

## Estructura del Proyecto

Este proyecto usa **Capacitor.js** como puente entre la aplicacion web (Next.js) y Android. Las pruebas se dividen en:

1. **Pruebas Unitarias (Unit Tests)**: Se ejecutan en la JVM local
2. **Pruebas Instrumentadas (Instrumentation Tests)**: Se ejecutan en un dispositivo o emulador Android

## Configuracion Inicial

### Requisitos Previos

1. **Android Studio** (version recomendada: 2024.1 o superior)
2. **Java JDK 21** (requerido por Gradle 8.13.0)
3. **Android SDK** con:
   - API Level 36 (Android 14)
   - Android Emulator
   - Herramientas de build (Android SDK Command-line Tools)

### Configuracion del Entorno

1. Abrir Android Studio
2. Seleccionar **File > Open** y navegar a:
   - `apps/app-conductor/android/` para la app de conductor
   - `apps/app-usuario/android/` para la app de usuario

3. Android Studio sincronizara automaticamente las dependencias de Gradle

## Ejecutar Pruebas

### Pruebas Unitarias

```bash
# Desde Android Studio:
# 1. Abrir el panel "Project" 
# 2. Navegar a: app/src/test/java/com/moviliax/ruumruum/conductor
# 3. Hacer click derecho en el archivo de prueba
# 4. Seleccionar "Run 'TestClassName'"

# Desde linea de comandos:
cd apps/app-conductor/android
./gradlew test
```

### Pruebas Instrumentadas

```bash
# Conectar un dispositivo o iniciar un emulador
# Verificar dispositivos disponibles:
adb devices

# Ejecutar todas las pruebas instrumentadas:
./gradlew connectedAndroidTest

# Ejecutar una clase especifica:
./gradlew connectedAndroidTest -P android.testInstrumentationRunnerArguments.class=com.moviliax.ruumruum.conductor.ExampleInstrumentedTest
```

## Estructura de Directorios

```
android/
├── app/
│   ├── src/
│   │   ├── main/           # Codigo principal de la aplicacion
│   │   │   └── java/com/moviliax/ruumruum/conductor/
│   │   │       └── MainActivity.java
│   │   ├── test/           # Pruebas unitarias
│   │   │   └── java/com/moviliax/ruumruum/conductor/
│   │   │       └── ExampleUnitTest.java
│   │   └── androidTest/    # Pruebas instrumentadas
│   │       └── java/com/moviliax/ruumruum/conductor/
│   │           └── ExampleInstrumentedTest.java
│   └── build.gradle
├── build.gradle
└── variables.gradle        # Version de dependencias
```

## Dependencias de Pruebas Configuradas

### Versiones (variables.gradle)

```gradle
// JUnit 4
junitVersion = '4.13.2'

// AndroidX Testing
androidxJunitVersion = '1.3.0'
androidxEspressoCoreVersion = '3.7.0'
androidxTestCoreVersion = '1.6.1'
androidxTestRunnerVersion = '1.6.2'
androidxTestRulesVersion = '1.6.1'

// Mocking
mockitoVersion = '5.15.0'
mockitoKotlinVersion = '5.4.0'

// Coroutines para pruebas
coroutinesTestVersion = '1.9.0'
```

### Dependencias (app/build.gradle)

```gradle
// Pruebas unitarias
testImplementation "junit:junit:$junitVersion"
testImplementation "org.mockito:mockito-core:$mockitoVersion"
testImplementation "org.mockito.kotlin:mockito-kotlin:$mockitoKotlinVersion"
testImplementation "org.jetbrains.kotlinx:kotlinx-coroutines-test:$coroutinesTestVersion"

// Pruebas instrumentadas
androidTestImplementation "androidx.test.ext:junit:$androidxJunitVersion"
androidTestImplementation "androidx.test.espresso:espresso-core:$androidxEspressoCoreVersion"
androidTestImplementation "androidx.test:core:$androidxTestCoreVersion"
androidTestImplementation "androidx.test:runner:$androidxTestRunnerVersion"
androidTestImplementation "androidx.test:rules:$androidxTestRulesVersion"
```

## Crear Nuevas Pruebas

### Prueba Unitaria Ejemplo

```java
package com.moviliax.ruumruum.conductor;

import static org.junit.Assert.*;
import org.junit.Test;
import org.mockito.Mockito;

public class MyUnitTest {
    
    @Test
    public void testSomething() {
        // Arrange
        int expected = 4;
        
        // Act
        int actual = 2 + 2;
        
        // Assert
        assertEquals(expected, actual);
    }
    
    @Test
    public void testWithMockito() {
        // Crear mock
        SomeInterface mock = Mockito.mock(SomeInterface.class);
        
        // Configurar comportamiento
        Mockito.when(mock.someMethod()).thenReturn("test");
        
        // Verificar
        assertEquals("test", mock.someMethod());
        Mockito.verify(mock).someMethod();
    }
}
```

### Prueba Instrumentada Ejemplo

```java
package com.moviliax.ruumruum.conductor;

import static org.junit.Assert.*;

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

## Pruebas con Espresso (UI Testing)

```java
package com.moviliax.ruumruum.conductor;

import static androidx.test.espresso.Espresso.onView;
import static androidx.test.espresso.action.ViewActions.click;
import static androidx.test.espresso.assertion.ViewAssertions.matches;
import static androidx.test.espresso.matcher.ViewMatchers.withId;
import static androidx.test.espresso.matcher.ViewMatchers.withText;

import androidx.test.ext.junit.rules.ActivityScenarioRule;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import org.junit.Rule;
import org.junit.Test;
import org.junit.runner.RunWith;

@RunWith(AndroidJUnit4.class)
public class UiTest {
    
    @Rule
    public ActivityScenarioRule<MainActivity> activityRule = 
        new ActivityScenarioRule<>(MainActivity.class);
    
    @Test
    public void testButtonClick() {
        // Hacer click en un boton y verificar resultado
        onView(withId(R.id.myButton))
            .perform(click());
        
        onView(withId(R.id.resultText))
            .check(matches(withText("Button clicked")));
    }
}
```

## Solucion de Problemas Comunes

### Error: Package name no coincide

**Problema:** `assertEquals("com.getcapacitor.app", appContext.getPackageName())` falla

**Solucion:** Asegurate que el package name en los tests coincida con el de la aplicacion:
- app-conductor: `com.moviliax.ruumruum.conductor`
- app-usuario: `com.moviliax.ruumruum.usuario`

### Error: No se encuentran clases de prueba

**Problema:** Android Studio no detecta los tests

**Solucion:**
1. Verifica que los archivos .java esten en el directorio correcto:
   - Unit tests: `app/src/test/java/com/moviliax/ruumruum/[app]/`
   - Instrumentation tests: `app/src/androidTest/java/com/moviliax/ruumruum/[app]/`
2. Sincroniza Gradle: **File > Sync Project with Gradle Files**
3. Invalida cache: **File > Invalidate Caches / Restart**

### Error: Dependencias no resueltas

**Problema:** Gradle no puede descargar dependencias

**Solucion:**
1. Verifica conexion a internet
2. Ejecuta: `./gradlew --refresh-dependencies`
3. Verifica que el archivo `settings.gradle` tenga los repositorios correctos

### Error: SDK no encontrado

**Problema:** `Failed to install Android SDK`

**Solucion:**
1. Abre Android Studio
2. Ve a **File > Settings > Appearance & Behavior > System Settings > Android SDK**
3. Instala el SDK para API Level 36

## Configuracion de Dispositivo/Emulador

### Crear un Emulador

1. Abrir **Android Studio > AVD Manager**
2. Clic en **Create Virtual Device**
3. Seleccionar un dispositivo (ej: Pixel 6)
4. Seleccionar una imagen del sistema (API Level 36)
5. Configurar nombre y finalizar

### Habilitar Modo Desarrollador en Dispositivo Fisico

1. Ve a **Ajustes > Acerca del telefono**
2. Toca **Numero de compilacion** 7 veces
3. Ve a **Ajustes > Opciones de desarrollador**
4. Activa **Depuracion USB**
5. Conecta el dispositivo a la computadora
6. Ejecuta `adb devices` para verificar que el dispositivo este conectado

## Variables de Entorno para Capacitor

El proyecto usa Capacitor con una configuracion especial:

```typescript
// capacitor.config.ts
{
  appId: "com.moviliax.ruumruum.conductor",
  appName: "Ruum Ruum Conductor",
  webDir: "cap-shell",
  server: {
    androidScheme: "https",
    url: process.env.RUUM_CAPACITOR_SERVER_URL || "https://www.concer.ruumruum-moviliax.online"
  }
}
```

Para pruebas locales, puedes configurar la variable de entorno:

```bash
# Linux/Mac
export RUUM_CAPACITOR_SERVER_URL="http://localhost:3000"

# Windows
set RUUM_CAPACITOR_SERVER_URL=http://localhost:3000
```

## Sincronizacion con Capacitor

Despues de hacer cambios en la aplicacion web (Next.js), sincroniza con Android:

```bash
# Navegar al directorio de la app
cd apps/app-conductor

# Copiar assets web a Android
npx cap sync android

# Abrir en Android Studio
npx cap open android
```

## Comandos Utiles

```bash
# Compilar el proyecto
./gradlew assembleDebug

# Instalar en dispositivo conectado
./gradlew installDebug

# Ejecutar pruebas unitarias
./gradlew test

# Ejecutar pruebas instrumentadas
./gradlew connectedAndroidTest

# Limpiar el proyecto
./gradlew clean

# Ver todas las tareas disponibles
./gradlew tasks

# Ver dependencias
./gradlew dependencies
```

## Recursos Adicionales

- [Documentacion oficial de Android Testing](https://developer.android.com/training/testing)
- [Guia de Capacitor Testing](https://capacitorjs.com/docs/guides/testing)
- [AndroidX Test Libraries](https://developer.android.com/jetpack/androidx/releases/test)
- [Espresso Documentation](https://developer.android.com/training/testing/espresso)
