# Manual de usuario: Modulo Configuracion Admin

## 1. Objetivo del modulo

El modulo **Configuracion** concentra los parametros administrativos que gobiernan la operacion de Ruum Ruum desde Torre de Control. Permite consultar y administrar dos dominios principales:

- **Roles y capacidades:** accesos efectivos de los colaboradores administrativos.
- **Normativa activa:** reglas operativas, financieras, de comunicacion y seguridad que usa la plataforma.

Cada cambio sensible requiere un motivo, se ejecuta mediante funciones controladas en backend y queda registrado para auditoria.

## 2. Acceso al modulo

1. Inicia sesion en la aplicacion Admin.
2. En la barra lateral, selecciona **Configuracion**.
3. El sistema mostrara el encabezado **Configuracion** y el bloque informativo **Cerebro normativo de Ruum Ruum**.

Si el modulo no aparece o muestra una pantalla de acceso denegado, tu usuario no cuenta con la capacidad necesaria.

## 3. Permisos requeridos

El acceso se controla por capacidades administrativas:

- `configuracion:leer`: permite consultar el modulo y revisar la normativa activa.
- `configuracion:editar`: permite guardar cambios en normativa.
- `capacidades:administrar`: permite administrar roles y capacidades de otros colaboradores.

Los perfiles con acceso pueden variar segun la configuracion vigente. En general, **Direccion** cuenta con acceso integral y los roles operativos tienen acceso limitado segun su responsabilidad.

## 4. Estructura de la pantalla

La pantalla tiene dos pestanas:

- **Roles y capacidades:** administracion de colaboradores, rol base, capacidades efectivas y matriz de roles.
- **Normativa activa:** consulta y edicion de reglas agrupadas por categoria.

Tambien puede mostrar mensajes superiores de exito o error despues de una accion.

## 5. Roles y capacidades

Esta pestana permite revisar y modificar los accesos efectivos de un colaborador de Torre de Control.

### 5.1 Seleccionar colaborador

1. Abre la pestana **Roles y capacidades**.
2. En el campo **Colaborador**, selecciona un administrador registrado.
3. El sistema mostrara su nombre, fecha de alta y rol operativo actual.

Al seleccionar un colaborador, se cargan sus capacidades efectivas.

### 5.2 Cambiar rol operativo base

El rol operativo base define dashboard, navegacion, rutas permitidas e indicadores visibles.

Roles disponibles:

- **Operador:** ejecucion diaria, asignacion y atencion inmediata.
- **Supervisor:** excepciones, escalamiento y control de calidad operativo.
- **Finanzas:** cierres, pagos y politica tarifaria.
- **Compliance:** documentacion, incidencias, SLA y evidencia auditable.
- **Direccion:** acceso integral a operacion, riesgos y resultados.

Para cambiar el rol:

1. Selecciona el colaborador.
2. En **Rol operativo base**, elige el nuevo rol.
3. Escribe el **Motivo del cambio de rol** con minimo 10 caracteres.
4. Presiona **Preparar cambio de rol**.
5. Revisa el dialogo **Confirmar cambio critico de rol**.
6. Presiona **Confirmar cambio de rol**.

El cambio modifica accesos, navegacion y capacidades base. Por seguridad, no se permite que un usuario de Direccion se quite a si mismo el rol Direccion.

### 5.3 Revisar capacidades efectivas

La seccion **Capacidades efectivas** muestra las capacidades agrupadas por categoria:

- Operacion
- Conductores
- Empresas
- Finanzas
- Seguridad
- Configuracion

Cada capacidad muestra:

- Nombre tecnico de la capacidad.
- Origen: **Rol base** u **Override individual**.
- Estado: **Concedida** o **Revocada**.
- Motivo asociado, si existe.

Usa **Buscar capacidad** para filtrar por nombre, origen, motivo o categoria.

### 5.4 Conceder o revocar una capacidad

1. Selecciona un colaborador.
2. Presiona **Configurar capacidad** o usa el enlace **Conceder/Revocar** junto a una capacidad existente.
3. Elige la **Capacidad**.
4. Selecciona la accion: **Conceder** o **Revocar**.
5. Escribe un **Motivo** de minimo 10 caracteres.
6. Confirma la accion.

La capacidad `capacidades:administrar` aparece como no auto-asignable para evitar escalamiento accidental de privilegios.

### 5.5 Matriz efectiva de roles

La seccion **Matriz efectiva de roles** muestra una vista comparativa de los roles existentes. Incluye la descripcion de cada rol, cantidad de rutas base y una barra proporcional de alcance.

Esta matriz es de consulta. Sirve para entender el impacto de asignar un rol antes de confirmar cambios.

## 6. Normativa activa

Esta pestana permite consultar y editar parametros normativos. Las normas se agrupan por categoria:

- **Operacion**
- **Finanzas**
- **Comunicacion**
- **Seguridad**

Cada tarjeta normativa muestra:

- Nombre de la norma.
- Descripcion.
- Estado: **Vigente**, **Pendiente de revision** o **Desactualizada**.
- Resumen de la configuracion actual.
- Version vigente.
- Fecha de actualizacion.
- Acciones **Editar norma** y **Ver auditoria**.

Estados por antiguedad:

- **Vigente:** actualizada en los ultimos 90 dias.
- **Pendiente de revision:** mas de 90 dias sin actualizacion.
- **Desactualizada:** mas de 180 dias sin actualizacion.

### 6.1 Editar una norma

1. Abre la categoria correspondiente.
2. Ubica la norma.
3. Presiona **Editar norma**.
4. Ajusta los campos del editor.
5. Escribe el **Motivo del cambio** con minimo 10 caracteres.
6. Presiona **Guardar cambio**.

El sistema valida la estructura de la norma antes de guardar. Si otro usuario modifico la misma norma mientras estaba abierta, el sistema rechazara el guardado por conflicto de version y deberas recargar la informacion antes de intentar de nuevo.

### 6.2 Ver auditoria

Para revisar evidencia de cambios:

1. En la tarjeta de la norma, presiona **Ver auditoria**.
2. El sistema abrira Auditoria filtrada por la clave normativa.
3. Revisa actor, accion, fecha, motivo, valor anterior y valor nuevo segun disponibilidad.

## 7. Normas disponibles y uso

### 7.1 Zonas de operacion

Controla cobertura geografica y comportamiento fuera de cobertura.

Campos principales:

- **Zonas de operacion:** una zona por linea con formato `codigo | nombre | activa`.
- **Permitir solicitudes fuera de cobertura:** habilita o bloquea solicitudes fuera de las zonas configuradas.

Ejemplo de zona:

```text
mx_cdmx | Ciudad de Mexico | activa
```

### 7.2 Tipos de servicio y vehiculo

Define catalogos operativos admitidos para solicitudes, asignacion y compatibilidad vehicular.

Campos:

- **Servicios habilitados:** un servicio por linea.
- **Tipos de vehiculo:** un tipo por linea.

### 7.3 Reglas de evidencia

Define evidencia minima para el inicio y la entrega del traslado.

Campos de inicio:

- Fotos minimas.
- Requiere odometro.

Campos de entrega:

- Fotos minimas.
- Requiere firma.

### 7.4 Estados de traslado

Controla candados normativos para transiciones operativas.

Opciones:

- Cancelacion especial requiere supervisor.
- Cierre con incidencia requiere aprobacion.
- Reasignacion de conductor requiere motivo.
- Bloquear cierre sin evidencias.

### 7.5 Plantillas de notificacion

Define canales y reglas para avisos transaccionales.

Campos:

- Canales transaccionales: push, email, SMS o WhatsApp.
- Recordatorio antes del traslado en minutos.
- Notificar cancelaciones.
- Notificar incidencias criticas.

### 7.6 Metodos de pago

Controla metodos aceptados, pasarela principal y reglas de conciliacion/cobro.

Campos:

- Metodos aceptados: tarjeta de credito, tarjeta de debito, transferencia, SPEI, PayPal, Mercado Pago o credito corporativo.
- Pasarela principal: Stripe, Mercado Pago, PayPal o Manual/Banco.
- Requiere referencia.
- Conciliacion automatica.
- Permitir credito corporativo.
- Bloquear traslado sin pago confirmado.

### 7.7 Datos fiscales

Configura datos fiscales de Ruum Ruum como emisor y requisitos fiscales para clientes.

Datos de Ruum Ruum:

- RFC emisor.
- Razon social.
- Regimen fiscal.
- Codigo postal fiscal.
- Correo de facturacion.

Requisitos para clientes:

- Persona fisica: RFC obligatorio.
- Persona fisica: constancia fiscal.
- Persona moral: razon social obligatoria.
- Persona moral: constancia fiscal.
- Bloquear facturacion si faltan datos.

### 7.8 Seguridad

Define politicas administrativas de sesion y cambios criticos.

Campos:

- Duracion de sesion admin en minutos.
- Motivo minimo en caracteres.
- Intentos fallidos maximos.
- Reautenticacion para cambios criticos en minutos.
- Aprobacion dual para cambios criticos.
- MFA requerido para Direccion.

Valores minimos relevantes:

- La sesion administrativa no debe ser menor a 15 minutos.
- El motivo minimo no debe ser menor a 10 caracteres.

## 8. Mensajes y errores comunes

- **Escribe al menos 10 caracteres:** el motivo no cumple el minimo requerido.
- **JSON invalido:** la configuracion no se puede interpretar. Corrige la estructura antes de guardar.
- **Permiso insuficiente:** tu rol o capacidades no permiten ejecutar la accion.
- **Configuracion modificada por otro usuario:** otro administrador guardo cambios sobre la misma norma. Recarga la pantalla y revisa la version vigente.
- **Roles no disponibles:** hubo un problema al cargar colaboradores o capacidades. Usa **Reintentar**.

## 9. Buenas practicas operativas

- Cambia roles y capacidades solo con una justificacion clara y trazable.
- Antes de revocar una capacidad critica, valida que no interrumpa tareas activas del colaborador.
- Usa la matriz de roles para revisar alcance antes de confirmar un cambio.
- En normativa, evita cambios simultaneos sobre la misma clave.
- Documenta motivos con contexto suficiente: que se cambia, por que, y desde cuando aplica.
- Revisa auditoria despues de cambios criticos o cuando exista duda sobre la version vigente.

## 10. Checklist antes de guardar cambios criticos

- El colaborador o norma seleccionada es correcta.
- El impacto operativo fue revisado.
- El motivo tiene minimo 10 caracteres y explica la causa real.
- El cambio fue validado con el area responsable.
- Se revisara auditoria si el cambio afecta seguridad, finanzas o accesos.
