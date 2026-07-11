export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      admins: {
        Row: {
          id: string
          auth_user_id: string | null
          nombre: string
          creado_en: string
        };
        Insert: {
          id?: string
          auth_user_id?: string | null
          nombre: string
          creado_en?: string
        };
        Update: {
          id?: string
          auth_user_id?: string | null
          nombre?: string
          creado_en?: string
        };
        Relationships: [];
      };
      calificaciones_traslado: {
        Row: {
          traslado_id: string
          conductor_id: string
          estrellas: number
          comentario: string | null
          calificado_en: string
        };
        Insert: {
          traslado_id: string
          conductor_id: string
          estrellas: number
          comentario?: string | null
          calificado_en?: string
        };
        Update: {
          traslado_id?: string
          conductor_id?: string
          estrellas?: number
          comentario?: string | null
          calificado_en?: string
        };
        Relationships: [];
      };
      conductores: {
        Row: {
          id: string
          auth_user_id: string | null
          nombre: string
          nivel_por_experiencia: Database["public"]["Enums"]["nivel_concer"]
          nivel_por_calificacion: Database["public"]["Enums"]["nivel_concer"]
          estado: Database["public"]["Enums"]["estado_conductor"]
          estado_expediente: Database["public"]["Enums"]["estado_expediente_conductor"]
          calificacion_promedio: number
          traslados_completados: number
          suspensiones_activas: number
          no_presentaciones_6m: number
          documentos_vigentes: boolean
          incidencias_graves_6m: number
          incidencias_graves_12m: number
          creado_en: string
          actualizado_en: string
          nivel_operativo_vigente: Database["public"]["Enums"]["nivel_concer"] | null
          cancelaciones_sin_justificacion_count: number
          telefono: string | null
        };
        Insert: {
          id?: string
          auth_user_id?: string | null
          nombre: string
          nivel_por_experiencia?: Database["public"]["Enums"]["nivel_concer"]
          nivel_por_calificacion?: Database["public"]["Enums"]["nivel_concer"]
          estado?: Database["public"]["Enums"]["estado_conductor"]
          estado_expediente?: Database["public"]["Enums"]["estado_expediente_conductor"]
          calificacion_promedio?: number
          traslados_completados?: number
          suspensiones_activas?: number
          no_presentaciones_6m?: number
          documentos_vigentes?: boolean
          incidencias_graves_6m?: number
          incidencias_graves_12m?: number
          creado_en?: string
          actualizado_en?: string
          nivel_operativo_vigente?: Database["public"]["Enums"]["nivel_concer"] | null
          cancelaciones_sin_justificacion_count?: number
          telefono?: string | null
        };
        Update: {
          id?: string
          auth_user_id?: string | null
          nombre?: string
          nivel_por_experiencia?: Database["public"]["Enums"]["nivel_concer"]
          nivel_por_calificacion?: Database["public"]["Enums"]["nivel_concer"]
          estado?: Database["public"]["Enums"]["estado_conductor"]
          estado_expediente?: Database["public"]["Enums"]["estado_expediente_conductor"]
          calificacion_promedio?: number
          traslados_completados?: number
          suspensiones_activas?: number
          no_presentaciones_6m?: number
          documentos_vigentes?: boolean
          incidencias_graves_6m?: number
          incidencias_graves_12m?: number
          creado_en?: string
          actualizado_en?: string
          nivel_operativo_vigente?: Database["public"]["Enums"]["nivel_concer"] | null
          cancelaciones_sin_justificacion_count?: number
          telefono?: string | null
        };
        Relationships: [];
      };
      cuentas_conductor_stripe: {
        Row: {
          id: string
          conductor_id: string
          stripe_account_id: string
          estado: Database["public"]["Enums"]["estado_cuenta_stripe"]
          creado_en: string
          actualizado_en: string
        };
        Insert: {
          id?: string
          conductor_id: string
          stripe_account_id: string
          estado?: Database["public"]["Enums"]["estado_cuenta_stripe"]
          creado_en?: string
          actualizado_en?: string
        };
        Update: {
          id?: string
          conductor_id?: string
          stripe_account_id?: string
          estado?: Database["public"]["Enums"]["estado_cuenta_stripe"]
          creado_en?: string
          actualizado_en?: string
        };
        Relationships: [];
      };
      disputas: {
        Row: {
          id: string
          traslado_id: string
          abierta_por: Database["public"]["Enums"]["abierta_por_actor"]
          tipo: Database["public"]["Enums"]["tipo_disputa"]
          estado: Database["public"]["Enums"]["estado_disputa"]
          resolucion: Database["public"]["Enums"]["resolucion_disputa"] | null
          abierta_en: string
          resuelta_en: string | null
          escalada_en: string | null
          descripcion: string
          resolucion_detalle: string | null
        };
        Insert: {
          id?: string
          traslado_id: string
          abierta_por: Database["public"]["Enums"]["abierta_por_actor"]
          tipo: Database["public"]["Enums"]["tipo_disputa"]
          estado?: Database["public"]["Enums"]["estado_disputa"]
          resolucion?: Database["public"]["Enums"]["resolucion_disputa"] | null
          abierta_en?: string
          resuelta_en?: string | null
          escalada_en?: string | null
          descripcion?: string
          resolucion_detalle?: string | null
        };
        Update: {
          id?: string
          traslado_id?: string
          abierta_por?: Database["public"]["Enums"]["abierta_por_actor"]
          tipo?: Database["public"]["Enums"]["tipo_disputa"]
          estado?: Database["public"]["Enums"]["estado_disputa"]
          resolucion?: Database["public"]["Enums"]["resolucion_disputa"] | null
          abierta_en?: string
          resuelta_en?: string | null
          escalada_en?: string | null
          descripcion?: string
          resolucion_detalle?: string | null
        };
        Relationships: [];
      };
      documentos_conductor: {
        Row: {
          id: string
          conductor_id: string | null
          solicitud_id: string | null
          tipo: string
          nombre_archivo: string
          url: string
          estado: string
          notas_admin: string | null
          version: number
          documento_anterior_id: string | null
          es_actual: boolean
          reemplazado_en: string | null
          revisado_por: string | null
          revisado_en: string | null
          motivo_rechazo: string | null
          creado_en: string
          actualizado_en: string
        };
        Insert: {
          id?: string
          conductor_id?: string | null
          solicitud_id?: string | null
          tipo: string
          nombre_archivo: string
          url: string
          estado?: string
          notas_admin?: string | null
          version?: number
          documento_anterior_id?: string | null
          es_actual?: boolean
          reemplazado_en?: string | null
          revisado_por?: string | null
          revisado_en?: string | null
          motivo_rechazo?: string | null
          creado_en?: string
          actualizado_en?: string
        };
        Update: {
          id?: string
          conductor_id?: string | null
          solicitud_id?: string | null
          tipo?: string
          nombre_archivo?: string
          url?: string
          estado?: string
          notas_admin?: string | null
          version?: number
          documento_anterior_id?: string | null
          es_actual?: boolean
          reemplazado_en?: string | null
          revisado_por?: string | null
          revisado_en?: string | null
          motivo_rechazo?: string | null
          creado_en?: string
          actualizado_en?: string
        };
        Relationships: [];
      };
      consentimientos_usuario: {
        Row: {
          id: string
          auth_user_id: string
          solicitud_id: string | null
          tipo_documento: Database["public"]["Enums"]["tipo_documento_consentimiento"]
          version: number
          aceptado_en: string
          canal: "web" | "android" | "ios" | "legacy_migracion"
          version_app: string
          hash_documento: string
        };
        Insert: {
          id?: string
          auth_user_id: string
          solicitud_id?: string | null
          tipo_documento: Database["public"]["Enums"]["tipo_documento_consentimiento"]
          version: number
          aceptado_en?: string
          canal: "web" | "android" | "ios" | "legacy_migracion"
          version_app: string
          hash_documento: string
        };
        Update: {
          id?: string
          auth_user_id?: string
          solicitud_id?: string | null
          tipo_documento?: Database["public"]["Enums"]["tipo_documento_consentimiento"]
          version?: number
          aceptado_en?: string
          canal?: "web" | "android" | "ios" | "legacy_migracion"
          version_app?: string
          hash_documento?: string
        };
        Relationships: [];
      };
      versiones_documento_consentimiento: {
        Row: {
          tipo_documento: Database["public"]["Enums"]["tipo_documento_consentimiento"]
          version: number
          hash_documento: string
          referencia: string
          vigente_desde: string
          vigente_hasta: string | null
        };
        Insert: {
          tipo_documento: Database["public"]["Enums"]["tipo_documento_consentimiento"]
          version: number
          hash_documento: string
          referencia: string
          vigente_desde: string
          vigente_hasta?: string | null
        };
        Update: {
          tipo_documento?: Database["public"]["Enums"]["tipo_documento_consentimiento"]
          version?: number
          hash_documento?: string
          referencia?: string
          vigente_desde?: string
          vigente_hasta?: string | null
        };
        Relationships: [];
      };
      solicitudes_conductor: {
        Row: {
          id: string
          auth_user_id: string
          conductor_id: string | null
          estado: Database["public"]["Enums"]["estado_expediente_conductor"]
          paso_actual: number
          datos_personales: Json
          domicilio: Json
          licencia: Json
          contacto_emergencia: Json
          curp_normalizada: string | null
          telefono_normalizado: string | null
          licencia_normalizada: string | null
          creado_en: string
          actualizado_en: string
          enviado_en: string | null
          version_registro: number
          origen_modelo: "legacy_metadata" | "v2_minimo"
        };
        Insert: {
          id?: string
          auth_user_id: string
          conductor_id?: string | null
          estado?: Database["public"]["Enums"]["estado_expediente_conductor"]
          paso_actual?: number
          datos_personales?: Json
          domicilio?: Json
          licencia?: Json
          contacto_emergencia?: Json
          creado_en?: string
          actualizado_en?: string
          enviado_en?: string | null
          version_registro?: number
          origen_modelo?: "legacy_metadata" | "v2_minimo"
        };
        Update: {
          conductor_id?: string | null
          estado?: Database["public"]["Enums"]["estado_expediente_conductor"]
          paso_actual?: number
          datos_personales?: Json
          domicilio?: Json
          licencia?: Json
          contacto_emergencia?: Json
          actualizado_en?: string
          enviado_en?: string | null
          version_registro?: number
          origen_modelo?: "legacy_metadata" | "v2_minimo"
        };
        Relationships: [];
      };
      historial_estados_solicitud_conductor: {
        Row: {
          id: string
          solicitud_id: string
          documento_id: string | null
          revisado_por: string | null
          revisado_en: string
          decision: "registro_inicial" | "cambio_estado" | "aprobar_documento" | "rechazar_documento" | "vencer_documento" | "solicitar_correccion" | "aprobar_solicitud" | "rechazar_solicitud"
          motivo: string | null
          estado_anterior: Database["public"]["Enums"]["estado_expediente_conductor"]
          estado_nuevo: Database["public"]["Enums"]["estado_expediente_conductor"]
          creado_en: string
        };
        Insert: {
          id?: string
          solicitud_id: string
          documento_id?: string | null
          revisado_por?: string | null
          revisado_en?: string
          decision: "registro_inicial" | "cambio_estado" | "aprobar_documento" | "rechazar_documento" | "vencer_documento" | "solicitar_correccion" | "aprobar_solicitud" | "rechazar_solicitud"
          motivo?: string | null
          estado_anterior: Database["public"]["Enums"]["estado_expediente_conductor"]
          estado_nuevo: Database["public"]["Enums"]["estado_expediente_conductor"]
          creado_en?: string
        };
        Update: {
          id?: string
          solicitud_id?: string
          documento_id?: string | null
          revisado_por?: string | null
          revisado_en?: string
          decision?: "registro_inicial" | "cambio_estado" | "aprobar_documento" | "rechazar_documento" | "vencer_documento" | "solicitar_correccion" | "aprobar_solicitud" | "rechazar_solicitud"
          motivo?: string | null
          estado_anterior?: Database["public"]["Enums"]["estado_expediente_conductor"]
          estado_nuevo?: Database["public"]["Enums"]["estado_expediente_conductor"]
          creado_en?: string
        };
        Relationships: [];
      };
      empresas: {
        Row: {
          id: string
          nombre: string
          creado_en: string
          actualizado_en: string
          rfc: string | null
          razon_social: string | null
          regimen_fiscal: string | null
          codigo_postal_fiscal: string | null
          uso_cfdi: string | null
          correo_facturacion: string | null
          estado_verificacion: Database["public"]["Enums"]["estado_verificacion"]
          condiciones_pago: string | null
        };
        Insert: {
          id?: string
          nombre: string
          creado_en?: string
          actualizado_en?: string
          rfc?: string | null
          razon_social?: string | null
          regimen_fiscal?: string | null
          codigo_postal_fiscal?: string | null
          uso_cfdi?: string | null
          correo_facturacion?: string | null
          estado_verificacion?: Database["public"]["Enums"]["estado_verificacion"]
          condiciones_pago?: string | null
        };
        Update: {
          id?: string
          nombre?: string
          creado_en?: string
          actualizado_en?: string
          rfc?: string | null
          razon_social?: string | null
          regimen_fiscal?: string | null
          codigo_postal_fiscal?: string | null
          uso_cfdi?: string | null
          correo_facturacion?: string | null
          estado_verificacion?: Database["public"]["Enums"]["estado_verificacion"]
          condiciones_pago?: string | null
        };
        Relationships: [];
      };
      estado_transiciones_validas: {
        Row: {
          estado_actual: Database["public"]["Enums"]["estado_traslado"]
          estado_siguiente: Database["public"]["Enums"]["estado_traslado"]
        };
        Insert: {
          estado_actual: Database["public"]["Enums"]["estado_traslado"]
          estado_siguiente: Database["public"]["Enums"]["estado_traslado"]
        };
        Update: {
          estado_actual?: Database["public"]["Enums"]["estado_traslado"]
          estado_siguiente?: Database["public"]["Enums"]["estado_traslado"]
        };
        Relationships: [];
      };
      evidencia_fotos: {
        Row: {
          id: string
          traslado_id: string
          tipo: Database["public"]["Enums"]["tipo_evidencia"]
          angulo: Database["public"]["Enums"]["angulo_evidencia"]
          url: string | null
          local_path: string | null
          capturada_en: string
          lat: number | null
          lng: number | null
          sincronizada: boolean
        };
        Insert: {
          id?: string
          traslado_id: string
          tipo: Database["public"]["Enums"]["tipo_evidencia"]
          angulo: Database["public"]["Enums"]["angulo_evidencia"]
          url?: string | null
          local_path?: string | null
          capturada_en?: string
          lat?: number | null
          lng?: number | null
          sincronizada?: boolean
        };
        Update: {
          id?: string
          traslado_id?: string
          tipo?: Database["public"]["Enums"]["tipo_evidencia"]
          angulo?: Database["public"]["Enums"]["angulo_evidencia"]
          url?: string | null
          local_path?: string | null
          capturada_en?: string
          lat?: number | null
          lng?: number | null
          sincronizada?: boolean
        };
        Relationships: [];
      };
      incidencias: {
        Row: {
          id: string
          traslado_id: string
          tipo: Database["public"]["Enums"]["tipo_incidencia"]
          momento: Database["public"]["Enums"]["momento_incidencia"]
          reportada_por: Database["public"]["Enums"]["actor_reporte"]
          descripcion: string
          resuelta: boolean
          creada_en: string
          resuelta_en: string | null
        };
        Insert: {
          id?: string
          traslado_id: string
          tipo: Database["public"]["Enums"]["tipo_incidencia"]
          momento: Database["public"]["Enums"]["momento_incidencia"]
          reportada_por: Database["public"]["Enums"]["actor_reporte"]
          descripcion: string
          resuelta?: boolean
          creada_en?: string
          resuelta_en?: string | null
        };
        Update: {
          id?: string
          traslado_id?: string
          tipo?: Database["public"]["Enums"]["tipo_incidencia"]
          momento?: Database["public"]["Enums"]["momento_incidencia"]
          reportada_por?: Database["public"]["Enums"]["actor_reporte"]
          descripcion?: string
          resuelta?: boolean
          creada_en?: string
          resuelta_en?: string | null
        };
        Relationships: [];
      };
      llamadas_enmascaradas: {
        Row: {
          id: string
          traslado_id: string
          iniciada_por: Database["public"]["Enums"]["remitente_chat"]
          numero_virtual: string
          duracion_segundos: number | null
          iniciada_en: string
          finalizada_en: string | null
          sesion_proxy_id: string | null
        };
        Insert: {
          id?: string
          traslado_id: string
          iniciada_por: Database["public"]["Enums"]["remitente_chat"]
          numero_virtual: string
          duracion_segundos?: number | null
          iniciada_en?: string
          finalizada_en?: string | null
          sesion_proxy_id?: string | null
        };
        Update: {
          id?: string
          traslado_id?: string
          iniciada_por?: Database["public"]["Enums"]["remitente_chat"]
          numero_virtual?: string
          duracion_segundos?: number | null
          iniciada_en?: string
          finalizada_en?: string | null
          sesion_proxy_id?: string | null
        };
        Relationships: [];
      };
      mensajes_chat: {
        Row: {
          id: string
          traslado_id: string
          remitente: Database["public"]["Enums"]["remitente_chat"]
          contenido: string
          enviado_en: string
          reportado: boolean
        };
        Insert: {
          id?: string
          traslado_id: string
          remitente: Database["public"]["Enums"]["remitente_chat"]
          contenido: string
          enviado_en?: string
          reportado?: boolean
        };
        Update: {
          id?: string
          traslado_id?: string
          remitente?: Database["public"]["Enums"]["remitente_chat"]
          contenido?: string
          enviado_en?: string
          reportado?: boolean
        };
        Relationships: [];
      };
      modo_prueba_supervisada: {
        Row: {
          id: string
          conductor_id: string
          traslados_asignados: number
          traslados_completados: number
          iniciado_en: string
          finalizado_en: string | null
          recuperado: boolean | null
        };
        Insert: {
          id?: string
          conductor_id: string
          traslados_asignados: number
          traslados_completados?: number
          iniciado_en?: string
          finalizado_en?: string | null
          recuperado?: boolean | null
        };
        Update: {
          id?: string
          conductor_id?: string
          traslados_asignados?: number
          traslados_completados?: number
          iniciado_en?: string
          finalizado_en?: string | null
          recuperado?: boolean | null
        };
        Relationships: [];
      };
      notas_internas_traslado: {
        Row: {
          id: string
          traslado_id: string
          admin_id: string
          contenido: string
          creada_en: string
        };
        Insert: {
          id?: string
          traslado_id: string
          admin_id: string
          contenido: string
          creada_en?: string
        };
        Update: {
          id?: string
          traslado_id?: string
          admin_id?: string
          contenido?: string
          creada_en?: string
        };
        Relationships: [];
      };
      pagos: {
        Row: {
          id: string
          traslado_id: string
          monto: number
          momento: Database["public"]["Enums"]["momento_pago"]
          estado: Database["public"]["Enums"]["estado_pago"]
          metodo: string
          registrado_en: string
          stripe_payment_intent_id: string | null
          stripe_event_id: string | null
        };
        Insert: {
          id?: string
          traslado_id: string
          monto: number
          momento: Database["public"]["Enums"]["momento_pago"]
          estado?: Database["public"]["Enums"]["estado_pago"]
          metodo: string
          registrado_en?: string
          stripe_payment_intent_id?: string | null
          stripe_event_id?: string | null
        };
        Update: {
          id?: string
          traslado_id?: string
          monto?: number
          momento?: Database["public"]["Enums"]["momento_pago"]
          estado?: Database["public"]["Enums"]["estado_pago"]
          metodo?: string
          registrado_en?: string
          stripe_payment_intent_id?: string | null
          stripe_event_id?: string | null
        };
        Relationships: [];
      };
      payouts_conductor: {
        Row: {
          id: string
          conductor_id: string
          periodo_inicio: string
          periodo_fin: string
          monto_bruto: number
          ajustes: number
          monto_neto: number
          estado: Database["public"]["Enums"]["estado_payout"]
          stripe_transfer_id: string | null
          creado_en: string
          procesado_en: string | null
        };
        Insert: {
          id?: string
          conductor_id: string
          periodo_inicio: string
          periodo_fin: string
          monto_bruto: number
          ajustes?: number
          monto_neto: number
          estado?: Database["public"]["Enums"]["estado_payout"]
          stripe_transfer_id?: string | null
          creado_en?: string
          procesado_en?: string | null
        };
        Update: {
          id?: string
          conductor_id?: string
          periodo_inicio?: string
          periodo_fin?: string
          monto_bruto?: number
          ajustes?: number
          monto_neto?: number
          estado?: Database["public"]["Enums"]["estado_payout"]
          stripe_transfer_id?: string | null
          creado_en?: string
          procesado_en?: string | null
        };
        Relationships: [];
      };
      preferencias_conductor: {
        Row: {
          conductor_id: string
          notificaciones_push: boolean
          modo_no_molestar: boolean
          alertas_viaje: boolean
          alertas_pago: boolean
          alertas_documentos: boolean
          alertas_admin: boolean
          viajes_locales: boolean
          viajes_foraneos: boolean
          viajes_nocturnos: boolean
          viajes_empresariales: boolean
          viajes_personales: boolean
          actualizado_en: string
        };
        Insert: {
          conductor_id: string
          notificaciones_push?: boolean
          modo_no_molestar?: boolean
          alertas_viaje?: boolean
          alertas_pago?: boolean
          alertas_documentos?: boolean
          alertas_admin?: boolean
          viajes_locales?: boolean
          viajes_foraneos?: boolean
          viajes_nocturnos?: boolean
          viajes_empresariales?: boolean
          viajes_personales?: boolean
          actualizado_en?: string
        };
        Update: {
          conductor_id?: string
          notificaciones_push?: boolean
          modo_no_molestar?: boolean
          alertas_viaje?: boolean
          alertas_pago?: boolean
          alertas_documentos?: boolean
          alertas_admin?: boolean
          viajes_locales?: boolean
          viajes_foraneos?: boolean
          viajes_nocturnos?: boolean
          viajes_empresariales?: boolean
          viajes_personales?: boolean
          actualizado_en?: string
        };
        Relationships: [];
      };
      reclamos_seguro: {
        Row: {
          id: string
          traslado_id: string
          estado: Database["public"]["Enums"]["estado_reclamo_seguro"]
          abierto_en: string
          resuelto_en: string | null
          notas_admin: string | null
          responsable_pago: string | null
        };
        Insert: {
          id?: string
          traslado_id: string
          estado?: Database["public"]["Enums"]["estado_reclamo_seguro"]
          abierto_en?: string
          resuelto_en?: string | null
          notas_admin?: string | null
          responsable_pago?: string | null
        };
        Update: {
          id?: string
          traslado_id?: string
          estado?: Database["public"]["Enums"]["estado_reclamo_seguro"]
          abierto_en?: string
          resuelto_en?: string | null
          notas_admin?: string | null
          responsable_pago?: string | null
        };
        Relationships: [];
      };
      registro_auditoria: {
        Row: {
          id: string
          traslado_id: string | null
          evento: Database["public"]["Enums"]["evento_auditable"]
          actor: Database["public"]["Enums"]["actor_auditoria"]
          actor_id: string
          datos: Json
          ip: string | null
          dispositivo: string | null
          timestamp: string
        };
        Insert: {
          id?: string
          traslado_id?: string | null
          evento: Database["public"]["Enums"]["evento_auditable"]
          actor: Database["public"]["Enums"]["actor_auditoria"]
          actor_id: string
          datos?: Json
          ip?: string | null
          dispositivo?: string | null
          timestamp?: string
        };
        Update: {
          id?: string
          traslado_id?: string | null
          evento?: Database["public"]["Enums"]["evento_auditable"]
          actor?: Database["public"]["Enums"]["actor_auditoria"]
          actor_id?: string
          datos?: Json
          ip?: string | null
          dispositivo?: string | null
          timestamp?: string
        };
        Relationships: [];
      };
      sesiones_proxy_traslado: {
        Row: {
          id: string
          traslado_id: string
          twilio_session_sid: string
          numero_virtual: string
          participante_usuario_sid: string
          participante_conductor_sid: string
          creada_en: string
          cerrada_en: string | null
        };
        Insert: {
          id?: string
          traslado_id: string
          twilio_session_sid: string
          numero_virtual: string
          participante_usuario_sid: string
          participante_conductor_sid: string
          creada_en?: string
          cerrada_en?: string | null
        };
        Update: {
          id?: string
          traslado_id?: string
          twilio_session_sid?: string
          numero_virtual?: string
          participante_usuario_sid?: string
          participante_conductor_sid?: string
          creada_en?: string
          cerrada_en?: string | null
        };
        Relationships: [];
      };
      tarifas_admin: {
        Row: {
          id: string
          nombre: string
          tipo_vehiculo: Database["public"]["Enums"]["tipo_vehiculo"]
          base: number
          por_km: number
          minima: number
          pago_conductor_porcentaje: number
          recargos_notas: string | null
          activa: boolean
          creada_por_admin_id: string | null
          creado_en: string
          actualizado_en: string
        };
        Insert: {
          id?: string
          nombre: string
          tipo_vehiculo: Database["public"]["Enums"]["tipo_vehiculo"]
          base: number
          por_km: number
          minima: number
          pago_conductor_porcentaje: number
          recargos_notas?: string | null
          activa?: boolean
          creada_por_admin_id?: string | null
          creado_en?: string
          actualizado_en?: string
        };
        Update: {
          id?: string
          nombre?: string
          tipo_vehiculo?: Database["public"]["Enums"]["tipo_vehiculo"]
          base?: number
          por_km?: number
          minima?: number
          pago_conductor_porcentaje?: number
          recargos_notas?: string | null
          activa?: boolean
          creada_por_admin_id?: string | null
          creado_en?: string
          actualizado_en?: string
        };
        Relationships: [];
      };
      traslados: {
        Row: {
          id: string
          estado: Database["public"]["Enums"]["estado_traslado"]
          usuario_id: string
          vehiculo_id: string
          conductor_id: string | null
          contacto_entrega_nombre: string
          contacto_entrega_telefono: string
          contacto_recepcion_nombre: string
          contacto_recepcion_telefono: string
          origen_lat: number
          origen_lng: number
          origen_direccion: string
          origen_ciudad: string
          destino_lat: number
          destino_lng: number
          destino_direccion: string
          destino_ciudad: string
          precio_cotizado: number | null
          precio_final: number | null
          tipo_pago: Database["public"]["Enums"]["tipo_pago"]
          causa_fallido: Database["public"]["Enums"]["causa_fallido"] | null
          tiene_incidencia_abierta: boolean
          creado_en: string
          actualizado_en: string
          origen_referencias: string | null
          destino_referencias: string | null
          instrucciones_especiales: string | null
          modalidad_programacion: string | null
          fecha_hora_programada: string | null
          tipo_ruta: string | null
          ventana_recoleccion: string | null
          ventana_entrega: string | null
          tipo_servicio: string | null
          motivo_servicio: string | null
        };
        Insert: {
          id?: string
          estado?: Database["public"]["Enums"]["estado_traslado"]
          usuario_id: string
          vehiculo_id: string
          conductor_id?: string | null
          contacto_entrega_nombre: string
          contacto_entrega_telefono: string
          contacto_recepcion_nombre: string
          contacto_recepcion_telefono: string
          origen_lat: number
          origen_lng: number
          origen_direccion: string
          origen_ciudad: string
          destino_lat: number
          destino_lng: number
          destino_direccion: string
          destino_ciudad: string
          precio_cotizado?: number | null
          precio_final?: number | null
          tipo_pago?: Database["public"]["Enums"]["tipo_pago"]
          causa_fallido?: Database["public"]["Enums"]["causa_fallido"] | null
          tiene_incidencia_abierta?: boolean
          creado_en?: string
          actualizado_en?: string
          origen_referencias?: string | null
          destino_referencias?: string | null
          instrucciones_especiales?: string | null
          modalidad_programacion?: string | null
          fecha_hora_programada?: string | null
          tipo_ruta?: string | null
          ventana_recoleccion?: string | null
          ventana_entrega?: string | null
          tipo_servicio?: string | null
          motivo_servicio?: string | null
        };
        Update: {
          id?: string
          estado?: Database["public"]["Enums"]["estado_traslado"]
          usuario_id?: string
          vehiculo_id?: string
          conductor_id?: string | null
          contacto_entrega_nombre?: string
          contacto_entrega_telefono?: string
          contacto_recepcion_nombre?: string
          contacto_recepcion_telefono?: string
          origen_lat?: number
          origen_lng?: number
          origen_direccion?: string
          origen_ciudad?: string
          destino_lat?: number
          destino_lng?: number
          destino_direccion?: string
          destino_ciudad?: string
          precio_cotizado?: number | null
          precio_final?: number | null
          tipo_pago?: Database["public"]["Enums"]["tipo_pago"]
          causa_fallido?: Database["public"]["Enums"]["causa_fallido"] | null
          tiene_incidencia_abierta?: boolean
          creado_en?: string
          actualizado_en?: string
          origen_referencias?: string | null
          destino_referencias?: string | null
          instrucciones_especiales?: string | null
          modalidad_programacion?: string | null
          fecha_hora_programada?: string | null
          tipo_ruta?: string | null
          ventana_recoleccion?: string | null
          ventana_entrega?: string | null
          tipo_servicio?: string | null
          motivo_servicio?: string | null
        };
        Relationships: [];
      };
      usuarios: {
        Row: {
          id: string
          auth_user_id: string | null
          tipo_cuenta: string
          rol: Database["public"]["Enums"]["rol_usuario"]
          empresa_id: string | null
          estado_verificacion: Database["public"]["Enums"]["estado_verificacion"]
          traslados_completados_sin_incidencia: number
          metodo_pago_registrado: boolean
          creado_en: string
          actualizado_en: string
          telefono: string | null
          nombre: string | null
          foto_url: string | null
          pais: string | null
          estado: string | null
          direccion_principal: string | null
          correo_facturacion: string | null
          notificaciones_push: boolean
          notificaciones_email: boolean
          notificaciones_sms_whatsapp: boolean
          alertas_viaje: boolean
          alertas_pago: boolean
          alertas_evidencia: boolean
          notificaciones_promocionales: boolean
          version_terminos_aceptada: number | null
          terminos_aceptados_en: string | null
          doc_identidad_url: string | null
          doc_identidad_subido_en: string | null
          codigo_postal: string | null
          ciudad: string | null
          colonia: string | null
          calle: string | null
          numero: string | null
          referencias: string | null
          rfc: string | null
          razon_social: string | null
          regimen_fiscal: string | null
          codigo_postal_fiscal: string | null
          uso_cfdi: string | null
        };
        Insert: {
          id?: string
          auth_user_id?: string | null
          tipo_cuenta: string
          rol?: Database["public"]["Enums"]["rol_usuario"]
          empresa_id?: string | null
          estado_verificacion?: Database["public"]["Enums"]["estado_verificacion"]
          traslados_completados_sin_incidencia?: number
          metodo_pago_registrado?: boolean
          creado_en?: string
          actualizado_en?: string
          telefono?: string | null
          nombre?: string | null
          foto_url?: string | null
          pais?: string | null
          estado?: string | null
          direccion_principal?: string | null
          correo_facturacion?: string | null
          notificaciones_push?: boolean
          notificaciones_email?: boolean
          notificaciones_sms_whatsapp?: boolean
          alertas_viaje?: boolean
          alertas_pago?: boolean
          alertas_evidencia?: boolean
          notificaciones_promocionales?: boolean
          version_terminos_aceptada?: number | null
          terminos_aceptados_en?: string | null
          doc_identidad_url?: string | null
          doc_identidad_subido_en?: string | null
          codigo_postal?: string | null
          ciudad?: string | null
          colonia?: string | null
          calle?: string | null
          numero?: string | null
          referencias?: string | null
          rfc?: string | null
          razon_social?: string | null
          regimen_fiscal?: string | null
          codigo_postal_fiscal?: string | null
          uso_cfdi?: string | null
        };
        Update: {
          id?: string
          auth_user_id?: string | null
          tipo_cuenta?: string
          rol?: Database["public"]["Enums"]["rol_usuario"]
          empresa_id?: string | null
          estado_verificacion?: Database["public"]["Enums"]["estado_verificacion"]
          traslados_completados_sin_incidencia?: number
          metodo_pago_registrado?: boolean
          creado_en?: string
          actualizado_en?: string
          telefono?: string | null
          nombre?: string | null
          foto_url?: string | null
          pais?: string | null
          estado?: string | null
          direccion_principal?: string | null
          correo_facturacion?: string | null
          notificaciones_push?: boolean
          notificaciones_email?: boolean
          notificaciones_sms_whatsapp?: boolean
          alertas_viaje?: boolean
          alertas_pago?: boolean
          alertas_evidencia?: boolean
          notificaciones_promocionales?: boolean
          version_terminos_aceptada?: number | null
          terminos_aceptados_en?: string | null
          doc_identidad_url?: string | null
          doc_identidad_subido_en?: string | null
          codigo_postal?: string | null
          ciudad?: string | null
          colonia?: string | null
          calle?: string | null
          numero?: string | null
          referencias?: string | null
          rfc?: string | null
          razon_social?: string | null
          regimen_fiscal?: string | null
          codigo_postal_fiscal?: string | null
          uso_cfdi?: string | null
        };
        Relationships: [];
      };
      vehiculos: {
        Row: {
          id: string
          usuario_id: string
          tipo: Database["public"]["Enums"]["tipo_vehiculo"]
          marca: string
          modelo: string
          anio: number
          tiene_tarjeta_circulacion: boolean
          tiene_verificacion: boolean
          tiene_placas: boolean
          permiso_especial_vigente: string | null
          puede_circular_rodando: boolean
          creado_en: string
          transmision: string | null
          color: string | null
          placas: string | null
          vin: string | null
          estado_general_declarado: string | null
          alias: string | null
          fotos_urls: string[]
        };
        Insert: {
          id?: string
          usuario_id: string
          tipo: Database["public"]["Enums"]["tipo_vehiculo"]
          marca: string
          modelo: string
          anio: number
          tiene_tarjeta_circulacion?: boolean
          tiene_verificacion?: boolean
          tiene_placas?: boolean
          permiso_especial_vigente?: string | null
          puede_circular_rodando?: boolean
          creado_en?: string
          transmision?: string | null
          color?: string | null
          placas?: string | null
          vin?: string | null
          estado_general_declarado?: string | null
          alias?: string | null
          fotos_urls?: string[]
        };
        Update: {
          id?: string
          usuario_id?: string
          tipo?: Database["public"]["Enums"]["tipo_vehiculo"]
          marca?: string
          modelo?: string
          anio?: number
          tiene_tarjeta_circulacion?: boolean
          tiene_verificacion?: boolean
          tiene_placas?: boolean
          permiso_especial_vigente?: string | null
          puede_circular_rodando?: boolean
          creado_en?: string
          transmision?: string | null
          color?: string | null
          placas?: string | null
          vin?: string | null
          estado_general_declarado?: string | null
          alias?: string | null
          fotos_urls?: string[]
        };
        Relationships: [];
      };
    };
    Views: {
      pasaporte_digital: {
        Row: {
          traslado_id: string | null
          usuario_id: string | null
          vehiculo_id: string | null
          conductor_id: string | null
          estado: Database["public"]["Enums"]["estado_traslado"] | null
          tiene_incidencia_abierta: boolean | null
          tipo_pago: Database["public"]["Enums"]["tipo_pago"] | null
          causa_fallido: Database["public"]["Enums"]["causa_fallido"] | null
          precio_cotizado: number | null
          precio_final: number | null
          creado_en: string | null
          actualizado_en: string | null
          vehiculo_tipo: Database["public"]["Enums"]["tipo_vehiculo"] | null
          vehiculo_marca: string | null
          vehiculo_modelo: string | null
          vehiculo_anio: number | null
          conductor_nombre: string | null
          conductor_estado: Database["public"]["Enums"]["estado_conductor"] | null
          conductor_nivel: Database["public"]["Enums"]["nivel_concer"] | null
          conductor_calificacion: number | null
          evidencia_inicial_fotos_sincronizadas: number | null
          evidencia_final_fotos_sincronizadas: number | null
          incidencias_abiertas: number | null
          monto_pagado: number | null
        };
        Relationships: [];
      };
    };
    Functions: {
      registrar_documento_identidad: {
        Args: { p_sello_id: string; p_ruta: string; p_sha256: string };
        Returns: Array<{
          ruta: string;
          estado: string;
          subido_en: string;
          ruta_anterior: string | null;
          documento_id: string;
          version: number;
        }>;
      };
      registrar_documento_identidad_usuario: {
        Args: { p_ruta: string };
        Returns: undefined;
      };
      abrir_disputa_traslado: {
        Args: { p_traslado_id: string; p_abierta_por: Database["public"]["Enums"]["abierta_por_actor"]; p_tipo: Database["public"]["Enums"]["tipo_disputa"]; p_descripcion: string };
        Returns: string;
      };
      admin_actual_id: {
        Args: Record<PropertyKey, never>;
        Returns: string;
      };
      admin_actualiza_reclamo_seguro: {
        Args: { p_reclamo_id: string; p_estado: Database["public"]["Enums"]["estado_reclamo_seguro"]; p_responsable_pago: string | null; p_notas_admin: string };
        Returns: undefined;
      };
      admin_asigna_conductor: {
        Args: { p_traslado_id: string; p_conductor_id: string };
        Returns: Database["public"]["Enums"]["estado_traslado"];
      };
      aprobar_expediente_conductor_admin: {
        Args: { p_conductor_id: string };
        Returns: undefined;
      };
      aprobar_solicitud_conductor_admin: {
        Args: { p_solicitud_id: string; p_motivo?: string | null };
        Returns: string;
      };
      rechazar_solicitud_conductor_admin: {
        Args: { p_solicitud_id: string; p_motivo: string };
        Returns: undefined;
      };
      admin_marca_traslado_fallido: {
        Args: { p_traslado_id: string; p_causa: Database["public"]["Enums"]["causa_fallido"]; p_cargo_aplica_cliente: boolean; p_requiere_reagendamiento: boolean; p_porcentaje_descuento_segundo_intento: number | null; p_mensaje: string };
        Returns: undefined;
      };
      admin_resuelve_disputa: {
        Args: { p_disputa_id: string; p_estado: Database["public"]["Enums"]["estado_disputa"]; p_resolucion: Database["public"]["Enums"]["resolucion_disputa"] | null; p_detalle: string };
        Returns: undefined;
      };
      chat_disponible: {
        Args: { p_estado: Database["public"]["Enums"]["estado_traslado"] };
        Returns: boolean;
      };
      conductor_acepta_viaje: {
        Args: { p_traslado_id: string };
        Returns: Database["public"]["Enums"]["estado_traslado"];
      };
      conductor_avanza_traslado: {
        Args: { p_traslado_id: string; p_evento: string };
        Returns: Database["public"]["Enums"]["estado_traslado"];
      };
      completar_solicitud_conductor_v2: {
        Args: {
          p_datos_personales: Json;
          p_domicilio: Json;
          p_licencia: Json;
          p_contacto_emergencia: Json;
        };
        Returns: string;
      };
      iniciar_solicitud_conductor: {
        Args: Record<PropertyKey, never>;
        Returns: Array<{
          solicitud_id: string | null;
          conductor_id: string | null;
          estado: Database["public"]["Enums"]["estado_expediente_conductor"] | null;
          paso_actual: number | null;
        }>;
      };
      guardar_borrador_conductor: {
        Args: {
          p_paso_actual: number;
          p_datos_personales?: Json | null;
          p_domicilio?: Json | null;
          p_licencia?: Json | null;
          p_contacto_emergencia?: Json | null;
        };
        Returns: Array<{
          solicitud_id: string;
          conductor_id: string | null;
          estado: Database["public"]["Enums"]["estado_expediente_conductor"];
          paso_actual: number;
        }>;
      };
      enviar_solicitud_conductor: {
        Args: Record<PropertyKey, never>;
        Returns: Array<{
          solicitud_id: string;
          conductor_id: string | null;
          estado: Database["public"]["Enums"]["estado_expediente_conductor"];
          paso_actual: number;
        }>;
      };
      crear_incidencia_sistema_dano_no_reportado: {
        Args: { p_traslado_id: string; p_descripcion: string };
        Returns: string;
      };
      empresa_id_del_titular_actual: {
        Args: Record<PropertyKey, never>;
        Returns: string;
      };
      enviar_mensaje_chat: {
        Args: { p_traslado_id: string; p_contenido: string };
        Returns: unknown;
      };
      es_admin: {
        Args: Record<PropertyKey, never>;
        Returns: boolean;
      };
      recalcular_calificacion_conductor: {
        Args: { p_conductor_id: string };
        Returns: undefined;
      };
      revisar_documento_conductor_admin: {
        Args: { p_documento_id: string; p_estado: string; p_notas?: string | null };
        Returns: undefined;
      };
      registrar_documento_conductor: {
        Args: { p_objetivo_id: string; p_tipo: string; p_nombre_archivo: string; p_ruta: string };
        Returns: string;
      };
      registrar_consentimientos_conductor: {
        Args: { p_solicitud_id: string; p_consentimientos: Json; p_canal: string; p_version_app: string };
        Returns: number;
      };
      reemplazar_documento_conductor: {
        Args: { p_documento_anterior_id: string; p_nombre_archivo: string; p_ruta: string };
        Returns: string;
      };
      traslado_tiene_metodo_pago_registrado: {
        Args: { p_traslado_id: string };
        Returns: boolean;
      };
      usuario_cancela_traslado: {
        Args: { p_traslado_id: string; p_motivo: string; p_porcentaje_cargo: number; p_monto_cargo: number; p_mensaje: string };
        Returns: undefined;
      };
      usuario_crea_traslado: {
        Args: { p_vehiculo_id: string | null; p_vehiculo: Json | null; p_traslado: Json };
        Returns: string;
      };
    };
    Enums: {
      abierta_por_actor: "usuario" | "conductor";
      actor_auditoria: "usuario" | "conductor" | "admin" | "sistema";
      actor_reporte: "usuario" | "conductor" | "admin" | "sistema";
      angulo_evidencia: "frente" | "lado_piloto" | "lado_copiloto" | "trasera" | "tablero" | "dano_previo" | "adicional";
      causa_fallido: "imputable_cliente" | "operativo" | "fuerza_mayor" | "documentacion" | "vehiculo_no_circulable";
      estado_conductor: "activo" | "suspendido_7d" | "suspendido_14d" | "suspendido_30d" | "suspendido_indefinido" | "bloqueado_permanente" | "modo_prueba_supervisada" | "pendiente_verificacion";
      estado_expediente_conductor: "borrador" | "correo_pendiente" | "datos_incompletos" | "documentos_pendientes" | "listo_para_enviar" | "en_revision" | "requiere_correccion" | "aprobado" | "rechazado" | "suspendido";
      estado_cuenta_stripe: "pendiente_onboarding" | "activa" | "rechazada" | "deshabilitada";
      estado_disputa: "abierta" | "en_revision" | "resuelta" | "escalada" | "resuelta_senior";
      estado_pago: "pendiente" | "completado" | "reembolsado" | "fallido";
      estado_payout: "pendiente" | "procesado" | "fallido";
      estado_reclamo_seguro: "abierto" | "en_revision" | "resuelto";
      estado_traslado: "usuario_pendiente_verificacion" | "usuario_verificado" | "solicitud_creada" | "documentacion_pendiente" | "documentacion_en_revision" | "documentacion_validada" | "cotizacion_generada" | "servicio_confirmado" | "pendiente_de_conductor" | "conductor_asignado" | "conductor_en_camino_al_origen" | "conductor_en_punto_de_recoleccion" | "verificacion_vehiculo_en_proceso" | "evidencia_inicial_en_proceso" | "evidencia_inicial_completada" | "vehiculo_recibido" | "traslado_en_curso" | "incidencia_reportada" | "llegada_a_destino" | "evidencia_final_en_proceso" | "evidencia_final_completada" | "entrega_confirmada" | "pago_pendiente" | "pago_completado" | "servicio_cerrado" | "servicio_cancelado" | "traslado_fallido" | "dano_no_reportado_en_revision" | "reclamo_abierto" | "reclamo_resuelto" | "cierre_operativo_con_incidencia_abierta" | "disputa_abierta" | "disputa_resuelta";
      estado_verificacion: "pendiente" | "en_revision" | "verificado" | "rechazado";
      evento_auditable: "creacion_cuenta" | "verificacion_cuenta" | "carga_documentos" | "validacion_documentos" | "creacion_solicitud_traslado" | "generacion_cotizacion" | "confirmacion_servicio" | "asignacion_conductor" | "aceptacion_traslado_conductor" | "llegada_conductor_origen" | "captura_evidencia_inicial" | "confirmacion_vehiculo_recibido" | "inicio_traslado" | "reporte_incidencia" | "llegada_destino" | "captura_evidencia_final" | "confirmacion_entrega" | "registro_pago" | "cierre_traslado" | "cancelacion_traslado" | "apertura_disputa" | "resolucion_disputa" | "apertura_reclamo_seguro" | "resolucion_reclamo_seguro" | "suspension_conductor" | "modificacion_traslado_activo" | "activacion_soporte_emergencia" | "comunicacion_usuario_conductor" | "calificacion_conductor" | "exportacion_pasaporte_pdf" | "asignacion_modo_prueba_supervisada" | "resultado_modo_prueba_supervisada" | "aceptacion_terminos" | "carga_documento_identidad";
      momento_incidencia: "recoleccion" | "durante_traslado" | "entrega" | "post_cierre";
      momento_pago: "anticipado" | "al_cierre";
      nivel_concer: "basico" | "ejecutivo" | "luxury" | "coleccion";
      remitente_chat: "usuario" | "conductor";
      resolucion_disputa: "favor_reclamante" | "en_contra" | "solucion_parcial";
      rol_usuario: "personal" | "titular_empresa" | "usuario_autorizado";
      tipo_disputa: "cobro_incorrecto" | "cancelacion_fuera_de_politica" | "dano_no_reconocido" | "no_presentacion" | "calificacion_injusta";
      tipo_evidencia: "inicial" | "final";
      tipo_incidencia: "vehiculo_no_enciende" | "contacto_no_localizado" | "documentacion_incompleta" | "dano_previo_relevante" | "colision_robo_asalto" | "emergencia_medica_conductor" | "descompostura_en_ruta" | "infraccion_autoridad_vial" | "conductor_enfermo" | "perdida_conectividad" | "dano_no_reportado";
      tipo_documento_consentimiento: "terminos_servicio" | "aviso_privacidad" | "autorizacion_antecedentes" | "declaracion_suspensiones";
      tipo_pago: "anticipado" | "al_cierre";
      tipo_vehiculo: "sedan" | "suv" | "pick_up" | "van" | "luxury" | "coleccion";
    };
    CompositeTypes: Record<never, never>;
  };
};
