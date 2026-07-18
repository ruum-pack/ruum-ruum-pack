export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      admins: {
        Row: {
          auth_user_id: string | null
          creado_en: string
          id: string
          nombre: string
        }
        Insert: {
          auth_user_id?: string | null
          creado_en?: string
          id?: string
          nombre: string
        }
        Update: {
          auth_user_id?: string | null
          creado_en?: string
          id?: string
          nombre?: string
        }
        Relationships: []
      }
      calificaciones_traslado: {
        Row: {
          calificado_en: string
          comentario: string | null
          conductor_id: string
          estrellas: number
          traslado_id: string
        }
        Insert: {
          calificado_en?: string
          comentario?: string | null
          conductor_id: string
          estrellas: number
          traslado_id: string
        }
        Update: {
          calificado_en?: string
          comentario?: string | null
          conductor_id?: string
          estrellas?: number
          traslado_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "calificaciones_traslado_conductor_id_fkey"
            columns: ["conductor_id"]
            isOneToOne: false
            referencedRelation: "conductores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calificaciones_traslado_traslado_id_fkey"
            columns: ["traslado_id"]
            isOneToOne: true
            referencedRelation: "pasaporte_digital"
            referencedColumns: ["traslado_id"]
          },
          {
            foreignKeyName: "calificaciones_traslado_traslado_id_fkey"
            columns: ["traslado_id"]
            isOneToOne: true
            referencedRelation: "traslados"
            referencedColumns: ["id"]
          },
        ]
      }
      catalogo_vehiculos_tarifa: {
        Row: {
          categoria_tarifa: Database["public"]["Enums"]["categoria_tarifa_vehiculo"]
          gama: Database["public"]["Enums"]["gama_vehiculo"]
          id: string
          marca: string
          modelo: string
        }
        Insert: {
          categoria_tarifa: Database["public"]["Enums"]["categoria_tarifa_vehiculo"]
          gama: Database["public"]["Enums"]["gama_vehiculo"]
          id?: string
          marca: string
          modelo: string
        }
        Update: {
          categoria_tarifa?: Database["public"]["Enums"]["categoria_tarifa_vehiculo"]
          gama?: Database["public"]["Enums"]["gama_vehiculo"]
          id?: string
          marca?: string
          modelo?: string
        }
        Relationships: []
      }
      certificacion_pago_conductor: {
        Row: {
          actualizado_en: string
          actualizado_por_admin_id: string | null
          certificacion: Database["public"]["Enums"]["certificacion_conductor"]
          porcentaje: number
        }
        Insert: {
          actualizado_en?: string
          actualizado_por_admin_id?: string | null
          certificacion: Database["public"]["Enums"]["certificacion_conductor"]
          porcentaje: number
        }
        Update: {
          actualizado_en?: string
          actualizado_por_admin_id?: string | null
          certificacion?: Database["public"]["Enums"]["certificacion_conductor"]
          porcentaje?: number
        }
        Relationships: [
          {
            foreignKeyName: "certificacion_pago_conductor_actualizado_por_admin_id_fkey"
            columns: ["actualizado_por_admin_id"]
            isOneToOne: false
            referencedRelation: "admins"
            referencedColumns: ["id"]
          },
        ]
      }
      conductores: {
        Row: {
          actualizado_en: string
          auth_user_id: string | null
          autoriza_verificacion_antecedentes: boolean
          calificacion_promedio: number
          calle: string | null
          cancelaciones_sin_justificacion_count: number
          ciudad_municipio: string | null
          codigo_postal: string | null
          colonia: string | null
          contacto_emergencia_nombre: string | null
          contacto_emergencia_telefono: string | null
          creado_en: string
          curp: string | null
          declara_sin_suspensiones: boolean
          documentos_vigentes: boolean
          estado: Database["public"]["Enums"]["estado_conductor"]
          estado_expediente: Database["public"]["Enums"]["estado_expediente_conductor"]
          estado_residencia: string | null
          foto_perfil_url: string | null
          id: string
          incidencias_graves_12m: number
          incidencias_graves_6m: number
          licencia_numero: string | null
          licencia_tipo: string | null
          licencia_vigencia: string | null
          marca_terminos: string | null
          nivel_operativo_vigente:
            | Database["public"]["Enums"]["nivel_concer"]
            | null
          nivel_por_calificacion: Database["public"]["Enums"]["nivel_concer"]
          nivel_por_experiencia: Database["public"]["Enums"]["nivel_concer"]
          no_presentaciones_6m: number
          nombre: string
          numero: string | null
          referencias: string | null
          suspensiones_activas: number
          telefono: string | null
          terminos_aceptados_en: string | null
          traslados_completados: number
          version_terminos_aceptada: number | null
        }
        Insert: {
          actualizado_en?: string
          auth_user_id?: string | null
          autoriza_verificacion_antecedentes?: boolean
          calificacion_promedio?: number
          calle?: string | null
          cancelaciones_sin_justificacion_count?: number
          ciudad_municipio?: string | null
          codigo_postal?: string | null
          colonia?: string | null
          contacto_emergencia_nombre?: string | null
          contacto_emergencia_telefono?: string | null
          creado_en?: string
          curp?: string | null
          declara_sin_suspensiones?: boolean
          documentos_vigentes?: boolean
          estado?: Database["public"]["Enums"]["estado_conductor"]
          estado_expediente?: Database["public"]["Enums"]["estado_expediente_conductor"]
          estado_residencia?: string | null
          foto_perfil_url?: string | null
          id?: string
          incidencias_graves_12m?: number
          incidencias_graves_6m?: number
          licencia_numero?: string | null
          licencia_tipo?: string | null
          licencia_vigencia?: string | null
          marca_terminos?: string | null
          nivel_operativo_vigente?:
            | Database["public"]["Enums"]["nivel_concer"]
            | null
          nivel_por_calificacion?: Database["public"]["Enums"]["nivel_concer"]
          nivel_por_experiencia?: Database["public"]["Enums"]["nivel_concer"]
          no_presentaciones_6m?: number
          nombre: string
          numero?: string | null
          referencias?: string | null
          suspensiones_activas?: number
          telefono?: string | null
          terminos_aceptados_en?: string | null
          traslados_completados?: number
          version_terminos_aceptada?: number | null
        }
        Update: {
          actualizado_en?: string
          auth_user_id?: string | null
          autoriza_verificacion_antecedentes?: boolean
          calificacion_promedio?: number
          calle?: string | null
          cancelaciones_sin_justificacion_count?: number
          ciudad_municipio?: string | null
          codigo_postal?: string | null
          colonia?: string | null
          contacto_emergencia_nombre?: string | null
          contacto_emergencia_telefono?: string | null
          creado_en?: string
          curp?: string | null
          declara_sin_suspensiones?: boolean
          documentos_vigentes?: boolean
          estado?: Database["public"]["Enums"]["estado_conductor"]
          estado_expediente?: Database["public"]["Enums"]["estado_expediente_conductor"]
          estado_residencia?: string | null
          foto_perfil_url?: string | null
          id?: string
          incidencias_graves_12m?: number
          incidencias_graves_6m?: number
          licencia_numero?: string | null
          licencia_tipo?: string | null
          licencia_vigencia?: string | null
          marca_terminos?: string | null
          nivel_operativo_vigente?:
            | Database["public"]["Enums"]["nivel_concer"]
            | null
          nivel_por_calificacion?: Database["public"]["Enums"]["nivel_concer"]
          nivel_por_experiencia?: Database["public"]["Enums"]["nivel_concer"]
          no_presentaciones_6m?: number
          nombre?: string
          numero?: string | null
          referencias?: string | null
          suspensiones_activas?: number
          telefono?: string | null
          terminos_aceptados_en?: string | null
          traslados_completados?: number
          version_terminos_aceptada?: number | null
        }
        Relationships: []
      }
      configuracion_contactos_soporte: {
        Row: {
          actualizado_en: string
          ambiente: string
          emergencia_telefono: string
          soporte_correo: string
          soporte_telefono: string
        }
        Insert: {
          actualizado_en?: string
          ambiente: string
          emergencia_telefono: string
          soporte_correo: string
          soporte_telefono: string
        }
        Update: {
          actualizado_en?: string
          ambiente?: string
          emergencia_telefono?: string
          soporte_correo?: string
          soporte_telefono?: string
        }
        Relationships: []
      }
      consentimientos_usuario: {
        Row: {
          aceptado_en: string
          auth_user_id: string
          canal: string
          hash_documento: string
          id: string
          solicitud_id: string | null
          tipo_documento: Database["public"]["Enums"]["tipo_documento_consentimiento"]
          version: number
          version_app: string
        }
        Insert: {
          aceptado_en?: string
          auth_user_id: string
          canal: string
          hash_documento: string
          id?: string
          solicitud_id?: string | null
          tipo_documento: Database["public"]["Enums"]["tipo_documento_consentimiento"]
          version: number
          version_app: string
        }
        Update: {
          aceptado_en?: string
          auth_user_id?: string
          canal?: string
          hash_documento?: string
          id?: string
          solicitud_id?: string | null
          tipo_documento?: Database["public"]["Enums"]["tipo_documento_consentimiento"]
          version?: number
          version_app?: string
        }
        Relationships: [
          {
            foreignKeyName: "consentimientos_usuario_solicitud_id_fkey"
            columns: ["solicitud_id"]
            isOneToOne: false
            referencedRelation: "solicitudes_conductor"
            referencedColumns: ["id"]
          },
        ]
      }
      datos_bancarios_conductor: {
        Row: {
          actualizado_en: string
          banco: string
          clabe: string
          conductor_id: string
          creado_en: string
          estado: Database["public"]["Enums"]["estado_datos_bancarios_conductor"]
          id: string
          motivo_rechazo: string | null
          numero_tarjeta: string
          titular_cuenta: string
        }
        Insert: {
          actualizado_en?: string
          banco: string
          clabe: string
          conductor_id: string
          creado_en?: string
          estado?: Database["public"]["Enums"]["estado_datos_bancarios_conductor"]
          id?: string
          motivo_rechazo?: string | null
          numero_tarjeta: string
          titular_cuenta: string
        }
        Update: {
          actualizado_en?: string
          banco?: string
          clabe?: string
          conductor_id?: string
          creado_en?: string
          estado?: Database["public"]["Enums"]["estado_datos_bancarios_conductor"]
          id?: string
          motivo_rechazo?: string | null
          numero_tarjeta?: string
          titular_cuenta?: string
        }
        Relationships: [
          {
            foreignKeyName: "datos_bancarios_conductor_conductor_id_fkey"
            columns: ["conductor_id"]
            isOneToOne: true
            referencedRelation: "conductores"
            referencedColumns: ["id"]
          },
        ]
      }
      disputas: {
        Row: {
          abierta_en: string
          abierta_por: Database["public"]["Enums"]["abierta_por_actor"]
          descripcion: string
          escalada_en: string | null
          estado: Database["public"]["Enums"]["estado_disputa"]
          id: string
          resolucion: Database["public"]["Enums"]["resolucion_disputa"] | null
          resolucion_detalle: string | null
          resuelta_en: string | null
          tipo: Database["public"]["Enums"]["tipo_disputa"]
          traslado_id: string
        }
        Insert: {
          abierta_en?: string
          abierta_por: Database["public"]["Enums"]["abierta_por_actor"]
          descripcion?: string
          escalada_en?: string | null
          estado?: Database["public"]["Enums"]["estado_disputa"]
          id?: string
          resolucion?: Database["public"]["Enums"]["resolucion_disputa"] | null
          resolucion_detalle?: string | null
          resuelta_en?: string | null
          tipo: Database["public"]["Enums"]["tipo_disputa"]
          traslado_id: string
        }
        Update: {
          abierta_en?: string
          abierta_por?: Database["public"]["Enums"]["abierta_por_actor"]
          descripcion?: string
          escalada_en?: string | null
          estado?: Database["public"]["Enums"]["estado_disputa"]
          id?: string
          resolucion?: Database["public"]["Enums"]["resolucion_disputa"] | null
          resolucion_detalle?: string | null
          resuelta_en?: string | null
          tipo?: Database["public"]["Enums"]["tipo_disputa"]
          traslado_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "disputas_traslado_id_fkey"
            columns: ["traslado_id"]
            isOneToOne: false
            referencedRelation: "pasaporte_digital"
            referencedColumns: ["traslado_id"]
          },
          {
            foreignKeyName: "disputas_traslado_id_fkey"
            columns: ["traslado_id"]
            isOneToOne: false
            referencedRelation: "traslados"
            referencedColumns: ["id"]
          },
        ]
      }
      documento_conductor_transiciones: {
        Row: {
          destino: string
          origen: string
        }
        Insert: {
          destino: string
          origen: string
        }
        Update: {
          destino?: string
          origen?: string
        }
        Relationships: []
      }
      documentos_conductor: {
        Row: {
          actualizado_en: string
          conductor_id: string | null
          creado_en: string
          documento_anterior_id: string | null
          es_actual: boolean
          estado: string
          id: string
          motivo_rechazo: string | null
          nombre_archivo: string
          notas_admin: string | null
          reemplazado_en: string | null
          revisado_en: string | null
          revisado_por: string | null
          solicitud_id: string | null
          tipo: string
          url: string
          version: number
        }
        Insert: {
          actualizado_en?: string
          conductor_id?: string | null
          creado_en?: string
          documento_anterior_id?: string | null
          es_actual?: boolean
          estado?: string
          id?: string
          motivo_rechazo?: string | null
          nombre_archivo: string
          notas_admin?: string | null
          reemplazado_en?: string | null
          revisado_en?: string | null
          revisado_por?: string | null
          solicitud_id?: string | null
          tipo: string
          url: string
          version?: number
        }
        Update: {
          actualizado_en?: string
          conductor_id?: string | null
          creado_en?: string
          documento_anterior_id?: string | null
          es_actual?: boolean
          estado?: string
          id?: string
          motivo_rechazo?: string | null
          nombre_archivo?: string
          notas_admin?: string | null
          reemplazado_en?: string | null
          revisado_en?: string | null
          revisado_por?: string | null
          solicitud_id?: string | null
          tipo?: string
          url?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "documentos_conductor_conductor_id_fkey"
            columns: ["conductor_id"]
            isOneToOne: false
            referencedRelation: "conductores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documentos_conductor_documento_anterior_id_fkey"
            columns: ["documento_anterior_id"]
            isOneToOne: false
            referencedRelation: "documentos_conductor"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documentos_conductor_revisado_por_fkey"
            columns: ["revisado_por"]
            isOneToOne: false
            referencedRelation: "admins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documentos_conductor_solicitud_id_fkey"
            columns: ["solicitud_id"]
            isOneToOne: false
            referencedRelation: "solicitudes_conductor"
            referencedColumns: ["id"]
          },
        ]
      }
      documentos_identidad_storage_validados: {
        Row: {
          auth_user_id: string
          consumido_en: string | null
          creado_en: string
          expira_en: string
          id: string
          mime: string
          ruta: string
          sha256: string
          tamano_bytes: number
          usuario_id: string
        }
        Insert: {
          auth_user_id: string
          consumido_en?: string | null
          creado_en?: string
          expira_en?: string
          id?: string
          mime: string
          ruta: string
          sha256: string
          tamano_bytes: number
          usuario_id: string
        }
        Update: {
          auth_user_id?: string
          consumido_en?: string | null
          creado_en?: string
          expira_en?: string
          id?: string
          mime?: string
          ruta?: string
          sha256?: string
          tamano_bytes?: number
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "documentos_identidad_storage_validados_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      documentos_identidad_usuario: {
        Row: {
          creado_en: string
          documento_anterior_id: string | null
          eliminado_storage_en: string | null
          error_eliminacion: string | null
          es_actual: boolean
          estado: string
          id: string
          intentos_eliminacion: number
          mime: string
          reemplazado_en: string | null
          requiere_alerta_eliminacion: boolean
          ruta: string
          sello_id: string
          sha256: string
          tamano_bytes: number
          ultimo_intento_eliminacion_en: string | null
          usuario_id: string
          version: number
        }
        Insert: {
          creado_en?: string
          documento_anterior_id?: string | null
          eliminado_storage_en?: string | null
          error_eliminacion?: string | null
          es_actual?: boolean
          estado?: string
          id?: string
          intentos_eliminacion?: number
          mime: string
          reemplazado_en?: string | null
          requiere_alerta_eliminacion?: boolean
          ruta: string
          sello_id: string
          sha256: string
          tamano_bytes: number
          ultimo_intento_eliminacion_en?: string | null
          usuario_id: string
          version: number
        }
        Update: {
          creado_en?: string
          documento_anterior_id?: string | null
          eliminado_storage_en?: string | null
          error_eliminacion?: string | null
          es_actual?: boolean
          estado?: string
          id?: string
          intentos_eliminacion?: number
          mime?: string
          reemplazado_en?: string | null
          requiere_alerta_eliminacion?: boolean
          ruta?: string
          sello_id?: string
          sha256?: string
          tamano_bytes?: number
          ultimo_intento_eliminacion_en?: string | null
          usuario_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "documentos_identidad_usuario_documento_anterior_id_fkey"
            columns: ["documento_anterior_id"]
            isOneToOne: false
            referencedRelation: "documentos_identidad_usuario"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documentos_identidad_usuario_sello_id_fkey"
            columns: ["sello_id"]
            isOneToOne: true
            referencedRelation: "documentos_identidad_storage_validados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documentos_identidad_usuario_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      documentos_storage_validados: {
        Row: {
          auth_user_id: string
          consumido_en: string | null
          creado_en: string
          objetivo_id: string
          ruta: string
          sha256: string
          tipo: string
        }
        Insert: {
          auth_user_id: string
          consumido_en?: string | null
          creado_en?: string
          objetivo_id: string
          ruta: string
          sha256: string
          tipo: string
        }
        Update: {
          auth_user_id?: string
          consumido_en?: string | null
          creado_en?: string
          objetivo_id?: string
          ruta?: string
          sha256?: string
          tipo?: string
        }
        Relationships: []
      }
      empresas: {
        Row: {
          actualizado_en: string
          codigo_postal_fiscal: string | null
          condiciones_pago: string | null
          correo_facturacion: string | null
          creado_en: string
          estado_verificacion: Database["public"]["Enums"]["estado_verificacion"]
          id: string
          nombre: string
          razon_social: string | null
          regimen_fiscal: string | null
          rfc: string | null
          uso_cfdi: string | null
        }
        Insert: {
          actualizado_en?: string
          codigo_postal_fiscal?: string | null
          condiciones_pago?: string | null
          correo_facturacion?: string | null
          creado_en?: string
          estado_verificacion?: Database["public"]["Enums"]["estado_verificacion"]
          id?: string
          nombre: string
          razon_social?: string | null
          regimen_fiscal?: string | null
          rfc?: string | null
          uso_cfdi?: string | null
        }
        Update: {
          actualizado_en?: string
          codigo_postal_fiscal?: string | null
          condiciones_pago?: string | null
          correo_facturacion?: string | null
          creado_en?: string
          estado_verificacion?: Database["public"]["Enums"]["estado_verificacion"]
          id?: string
          nombre?: string
          razon_social?: string | null
          regimen_fiscal?: string | null
          rfc?: string | null
          uso_cfdi?: string | null
        }
        Relationships: []
      }
      estado_transiciones_validas: {
        Row: {
          estado_actual: Database["public"]["Enums"]["estado_traslado"]
          estado_siguiente: Database["public"]["Enums"]["estado_traslado"]
        }
        Insert: {
          estado_actual: Database["public"]["Enums"]["estado_traslado"]
          estado_siguiente: Database["public"]["Enums"]["estado_traslado"]
        }
        Update: {
          estado_actual?: Database["public"]["Enums"]["estado_traslado"]
          estado_siguiente?: Database["public"]["Enums"]["estado_traslado"]
        }
        Relationships: []
      }
      eventos_registro_conductor: {
        Row: {
          auth_user_id: string | null
          codigo: string | null
          creado_en: string
          duracion_ms: number | null
          evento: string
          id: string
          paso: number | null
          sesion_id: string
          solicitud_id: string | null
        }
        Insert: {
          auth_user_id?: string | null
          codigo?: string | null
          creado_en?: string
          duracion_ms?: number | null
          evento: string
          id?: string
          paso?: number | null
          sesion_id: string
          solicitud_id?: string | null
        }
        Update: {
          auth_user_id?: string | null
          codigo?: string | null
          creado_en?: string
          duracion_ms?: number | null
          evento?: string
          id?: string
          paso?: number | null
          sesion_id?: string
          solicitud_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "eventos_registro_conductor_solicitud_id_fkey"
            columns: ["solicitud_id"]
            isOneToOne: false
            referencedRelation: "solicitudes_conductor"
            referencedColumns: ["id"]
          },
        ]
      }
      evidencia_fotos: {
        Row: {
          angulo: Database["public"]["Enums"]["angulo_evidencia"]
          capturada_en: string
          id: string
          lat: number | null
          lng: number | null
          local_path: string | null
          sincronizada: boolean
          tipo: Database["public"]["Enums"]["tipo_evidencia"]
          traslado_id: string
          url: string | null
        }
        Insert: {
          angulo: Database["public"]["Enums"]["angulo_evidencia"]
          capturada_en?: string
          id?: string
          lat?: number | null
          lng?: number | null
          local_path?: string | null
          sincronizada?: boolean
          tipo: Database["public"]["Enums"]["tipo_evidencia"]
          traslado_id: string
          url?: string | null
        }
        Update: {
          angulo?: Database["public"]["Enums"]["angulo_evidencia"]
          capturada_en?: string
          id?: string
          lat?: number | null
          lng?: number | null
          local_path?: string | null
          sincronizada?: boolean
          tipo?: Database["public"]["Enums"]["tipo_evidencia"]
          traslado_id?: string
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "evidencia_fotos_traslado_id_fkey"
            columns: ["traslado_id"]
            isOneToOne: false
            referencedRelation: "pasaporte_digital"
            referencedColumns: ["traslado_id"]
          },
          {
            foreignKeyName: "evidencia_fotos_traslado_id_fkey"
            columns: ["traslado_id"]
            isOneToOne: false
            referencedRelation: "traslados"
            referencedColumns: ["id"]
          },
        ]
      }
      evidencia_inspecciones: {
        Row: {
          actualizado_en: string
          combustible: string | null
          creado_en: string
          holograma_verificacion: boolean | null
          id: string
          kilometraje: number | null
          llaves_recibidas: string | null
          notas: string | null
          placa_delantera: string | null
          placa_trasera: string | null
          talon_verificacion: string | null
          tarjeta_circulacion: string | null
          tipo: Database["public"]["Enums"]["tipo_evidencia"]
          traslado_id: string
        }
        Insert: {
          actualizado_en?: string
          combustible?: string | null
          creado_en?: string
          holograma_verificacion?: boolean | null
          id?: string
          kilometraje?: number | null
          llaves_recibidas?: string | null
          notas?: string | null
          placa_delantera?: string | null
          placa_trasera?: string | null
          talon_verificacion?: string | null
          tarjeta_circulacion?: string | null
          tipo: Database["public"]["Enums"]["tipo_evidencia"]
          traslado_id: string
        }
        Update: {
          actualizado_en?: string
          combustible?: string | null
          creado_en?: string
          holograma_verificacion?: boolean | null
          id?: string
          kilometraje?: number | null
          llaves_recibidas?: string | null
          notas?: string | null
          placa_delantera?: string | null
          placa_trasera?: string | null
          talon_verificacion?: string | null
          tarjeta_circulacion?: string | null
          tipo?: Database["public"]["Enums"]["tipo_evidencia"]
          traslado_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "evidencia_inspecciones_traslado_id_fkey"
            columns: ["traslado_id"]
            isOneToOne: false
            referencedRelation: "pasaporte_digital"
            referencedColumns: ["traslado_id"]
          },
          {
            foreignKeyName: "evidencia_inspecciones_traslado_id_fkey"
            columns: ["traslado_id"]
            isOneToOne: false
            referencedRelation: "traslados"
            referencedColumns: ["id"]
          },
        ]
      }
      expediente_conductor_transiciones: {
        Row: {
          destino: Database["public"]["Enums"]["estado_expediente_conductor"]
          origen: Database["public"]["Enums"]["estado_expediente_conductor"]
        }
        Insert: {
          destino: Database["public"]["Enums"]["estado_expediente_conductor"]
          origen: Database["public"]["Enums"]["estado_expediente_conductor"]
        }
        Update: {
          destino?: Database["public"]["Enums"]["estado_expediente_conductor"]
          origen?: Database["public"]["Enums"]["estado_expediente_conductor"]
        }
        Relationships: []
      }
      historial_estados_solicitud_conductor: {
        Row: {
          creado_en: string
          decision: string
          documento_id: string | null
          estado_anterior: Database["public"]["Enums"]["estado_expediente_conductor"]
          estado_nuevo: Database["public"]["Enums"]["estado_expediente_conductor"]
          id: string
          motivo: string | null
          revisado_en: string
          revisado_por: string | null
          solicitud_id: string
        }
        Insert: {
          creado_en?: string
          decision: string
          documento_id?: string | null
          estado_anterior: Database["public"]["Enums"]["estado_expediente_conductor"]
          estado_nuevo: Database["public"]["Enums"]["estado_expediente_conductor"]
          id?: string
          motivo?: string | null
          revisado_en?: string
          revisado_por?: string | null
          solicitud_id: string
        }
        Update: {
          creado_en?: string
          decision?: string
          documento_id?: string | null
          estado_anterior?: Database["public"]["Enums"]["estado_expediente_conductor"]
          estado_nuevo?: Database["public"]["Enums"]["estado_expediente_conductor"]
          id?: string
          motivo?: string | null
          revisado_en?: string
          revisado_por?: string | null
          solicitud_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "historial_estados_solicitud_conductor_documento_id_fkey"
            columns: ["documento_id"]
            isOneToOne: false
            referencedRelation: "documentos_conductor"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "historial_estados_solicitud_conductor_revisado_por_fkey"
            columns: ["revisado_por"]
            isOneToOne: false
            referencedRelation: "admins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "historial_estados_solicitud_conductor_solicitud_id_fkey"
            columns: ["solicitud_id"]
            isOneToOne: false
            referencedRelation: "solicitudes_conductor"
            referencedColumns: ["id"]
          },
        ]
      }
      incidencias: {
        Row: {
          creada_en: string
          descripcion: string
          id: string
          momento: Database["public"]["Enums"]["momento_incidencia"]
          reportada_por: Database["public"]["Enums"]["actor_reporte"]
          resuelta: boolean
          resuelta_en: string | null
          tipo: Database["public"]["Enums"]["tipo_incidencia"]
          traslado_id: string
        }
        Insert: {
          creada_en?: string
          descripcion: string
          id?: string
          momento: Database["public"]["Enums"]["momento_incidencia"]
          reportada_por: Database["public"]["Enums"]["actor_reporte"]
          resuelta?: boolean
          resuelta_en?: string | null
          tipo: Database["public"]["Enums"]["tipo_incidencia"]
          traslado_id: string
        }
        Update: {
          creada_en?: string
          descripcion?: string
          id?: string
          momento?: Database["public"]["Enums"]["momento_incidencia"]
          reportada_por?: Database["public"]["Enums"]["actor_reporte"]
          resuelta?: boolean
          resuelta_en?: string | null
          tipo?: Database["public"]["Enums"]["tipo_incidencia"]
          traslado_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "incidencias_traslado_id_fkey"
            columns: ["traslado_id"]
            isOneToOne: false
            referencedRelation: "pasaporte_digital"
            referencedColumns: ["traslado_id"]
          },
          {
            foreignKeyName: "incidencias_traslado_id_fkey"
            columns: ["traslado_id"]
            isOneToOne: false
            referencedRelation: "traslados"
            referencedColumns: ["id"]
          },
        ]
      }
      llamadas_enmascaradas: {
        Row: {
          duracion_segundos: number | null
          finalizada_en: string | null
          id: string
          iniciada_en: string
          iniciada_por: Database["public"]["Enums"]["remitente_chat"]
          numero_virtual: string
          sesion_proxy_id: string | null
          traslado_id: string
        }
        Insert: {
          duracion_segundos?: number | null
          finalizada_en?: string | null
          id?: string
          iniciada_en?: string
          iniciada_por: Database["public"]["Enums"]["remitente_chat"]
          numero_virtual: string
          sesion_proxy_id?: string | null
          traslado_id: string
        }
        Update: {
          duracion_segundos?: number | null
          finalizada_en?: string | null
          id?: string
          iniciada_en?: string
          iniciada_por?: Database["public"]["Enums"]["remitente_chat"]
          numero_virtual?: string
          sesion_proxy_id?: string | null
          traslado_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "llamadas_enmascaradas_sesion_proxy_id_fkey"
            columns: ["sesion_proxy_id"]
            isOneToOne: false
            referencedRelation: "sesiones_proxy_traslado"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "llamadas_enmascaradas_traslado_id_fkey"
            columns: ["traslado_id"]
            isOneToOne: false
            referencedRelation: "pasaporte_digital"
            referencedColumns: ["traslado_id"]
          },
          {
            foreignKeyName: "llamadas_enmascaradas_traslado_id_fkey"
            columns: ["traslado_id"]
            isOneToOne: false
            referencedRelation: "traslados"
            referencedColumns: ["id"]
          },
        ]
      }
      mensajes_chat: {
        Row: {
          contenido: string
          enviado_en: string
          id: string
          remitente: Database["public"]["Enums"]["remitente_chat"]
          reportado: boolean
          traslado_id: string
        }
        Insert: {
          contenido: string
          enviado_en?: string
          id?: string
          remitente: Database["public"]["Enums"]["remitente_chat"]
          reportado?: boolean
          traslado_id: string
        }
        Update: {
          contenido?: string
          enviado_en?: string
          id?: string
          remitente?: Database["public"]["Enums"]["remitente_chat"]
          reportado?: boolean
          traslado_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mensajes_chat_traslado_id_fkey"
            columns: ["traslado_id"]
            isOneToOne: false
            referencedRelation: "pasaporte_digital"
            referencedColumns: ["traslado_id"]
          },
          {
            foreignKeyName: "mensajes_chat_traslado_id_fkey"
            columns: ["traslado_id"]
            isOneToOne: false
            referencedRelation: "traslados"
            referencedColumns: ["id"]
          },
        ]
      }
      modo_prueba_supervisada: {
        Row: {
          conductor_id: string
          finalizado_en: string | null
          id: string
          iniciado_en: string
          recuperado: boolean | null
          traslados_asignados: number
          traslados_completados: number
        }
        Insert: {
          conductor_id: string
          finalizado_en?: string | null
          id?: string
          iniciado_en?: string
          recuperado?: boolean | null
          traslados_asignados: number
          traslados_completados?: number
        }
        Update: {
          conductor_id?: string
          finalizado_en?: string | null
          id?: string
          iniciado_en?: string
          recuperado?: boolean | null
          traslados_asignados?: number
          traslados_completados?: number
        }
        Relationships: [
          {
            foreignKeyName: "modo_prueba_supervisada_conductor_id_fkey"
            columns: ["conductor_id"]
            isOneToOne: false
            referencedRelation: "conductores"
            referencedColumns: ["id"]
          },
        ]
      }
      notas_internas_traslado: {
        Row: {
          admin_id: string
          contenido: string
          creada_en: string
          id: string
          traslado_id: string
        }
        Insert: {
          admin_id: string
          contenido: string
          creada_en?: string
          id?: string
          traslado_id: string
        }
        Update: {
          admin_id?: string
          contenido?: string
          creada_en?: string
          id?: string
          traslado_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notas_internas_traslado_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "admins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notas_internas_traslado_traslado_id_fkey"
            columns: ["traslado_id"]
            isOneToOne: false
            referencedRelation: "pasaporte_digital"
            referencedColumns: ["traslado_id"]
          },
          {
            foreignKeyName: "notas_internas_traslado_traslado_id_fkey"
            columns: ["traslado_id"]
            isOneToOne: false
            referencedRelation: "traslados"
            referencedColumns: ["id"]
          },
        ]
      }
      pagos: {
        Row: {
          estado: Database["public"]["Enums"]["estado_pago"]
          id: string
          metodo: string
          momento: Database["public"]["Enums"]["momento_pago"]
          monto: number
          registrado_en: string
          stripe_event_id: string | null
          stripe_payment_intent_id: string | null
          traslado_id: string
        }
        Insert: {
          estado?: Database["public"]["Enums"]["estado_pago"]
          id?: string
          metodo: string
          momento: Database["public"]["Enums"]["momento_pago"]
          monto: number
          registrado_en?: string
          stripe_event_id?: string | null
          stripe_payment_intent_id?: string | null
          traslado_id: string
        }
        Update: {
          estado?: Database["public"]["Enums"]["estado_pago"]
          id?: string
          metodo?: string
          momento?: Database["public"]["Enums"]["momento_pago"]
          monto?: number
          registrado_en?: string
          stripe_event_id?: string | null
          stripe_payment_intent_id?: string | null
          traslado_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pagos_traslado_id_fkey"
            columns: ["traslado_id"]
            isOneToOne: false
            referencedRelation: "pasaporte_digital"
            referencedColumns: ["traslado_id"]
          },
          {
            foreignKeyName: "pagos_traslado_id_fkey"
            columns: ["traslado_id"]
            isOneToOne: false
            referencedRelation: "traslados"
            referencedColumns: ["id"]
          },
        ]
      }
      payouts_conductor: {
        Row: {
          ajustes: number
          conductor_id: string
          creado_en: string
          estado: Database["public"]["Enums"]["estado_payout"]
          id: string
          monto_bruto: number
          monto_neto: number
          periodo_fin: string
          periodo_inicio: string
          procesado_en: string | null
          referencia_pago: string | null
        }
        Insert: {
          ajustes?: number
          conductor_id: string
          creado_en?: string
          estado?: Database["public"]["Enums"]["estado_payout"]
          id?: string
          monto_bruto: number
          monto_neto: number
          periodo_fin: string
          periodo_inicio: string
          procesado_en?: string | null
          referencia_pago?: string | null
        }
        Update: {
          ajustes?: number
          conductor_id?: string
          creado_en?: string
          estado?: Database["public"]["Enums"]["estado_payout"]
          id?: string
          monto_bruto?: number
          monto_neto?: number
          periodo_fin?: string
          periodo_inicio?: string
          procesado_en?: string | null
          referencia_pago?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payouts_conductor_conductor_id_fkey"
            columns: ["conductor_id"]
            isOneToOne: false
            referencedRelation: "conductores"
            referencedColumns: ["id"]
          },
        ]
      }
      preferencias_conductor: {
        Row: {
          actualizado_en: string
          alertas_admin: boolean
          alertas_documentos: boolean
          alertas_pago: boolean
          alertas_viaje: boolean
          conductor_id: string
          modo_no_molestar: boolean
          notificaciones_push: boolean
          viajes_empresariales: boolean
          viajes_foraneos: boolean
          viajes_locales: boolean
          viajes_nocturnos: boolean
          viajes_personales: boolean
        }
        Insert: {
          actualizado_en?: string
          alertas_admin?: boolean
          alertas_documentos?: boolean
          alertas_pago?: boolean
          alertas_viaje?: boolean
          conductor_id: string
          modo_no_molestar?: boolean
          notificaciones_push?: boolean
          viajes_empresariales?: boolean
          viajes_foraneos?: boolean
          viajes_locales?: boolean
          viajes_nocturnos?: boolean
          viajes_personales?: boolean
        }
        Update: {
          actualizado_en?: string
          alertas_admin?: boolean
          alertas_documentos?: boolean
          alertas_pago?: boolean
          alertas_viaje?: boolean
          conductor_id?: string
          modo_no_molestar?: boolean
          notificaciones_push?: boolean
          viajes_empresariales?: boolean
          viajes_foraneos?: boolean
          viajes_locales?: boolean
          viajes_nocturnos?: boolean
          viajes_personales?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "preferencias_conductor_conductor_id_fkey"
            columns: ["conductor_id"]
            isOneToOne: true
            referencedRelation: "conductores"
            referencedColumns: ["id"]
          },
        ]
      }
      reclamos_seguro: {
        Row: {
          abierto_en: string
          estado: Database["public"]["Enums"]["estado_reclamo_seguro"]
          id: string
          notas_admin: string | null
          responsable_pago: string | null
          resuelto_en: string | null
          traslado_id: string
        }
        Insert: {
          abierto_en?: string
          estado?: Database["public"]["Enums"]["estado_reclamo_seguro"]
          id?: string
          notas_admin?: string | null
          responsable_pago?: string | null
          resuelto_en?: string | null
          traslado_id: string
        }
        Update: {
          abierto_en?: string
          estado?: Database["public"]["Enums"]["estado_reclamo_seguro"]
          id?: string
          notas_admin?: string | null
          responsable_pago?: string | null
          resuelto_en?: string | null
          traslado_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reclamos_seguro_traslado_id_fkey"
            columns: ["traslado_id"]
            isOneToOne: false
            referencedRelation: "pasaporte_digital"
            referencedColumns: ["traslado_id"]
          },
          {
            foreignKeyName: "reclamos_seguro_traslado_id_fkey"
            columns: ["traslado_id"]
            isOneToOne: false
            referencedRelation: "traslados"
            referencedColumns: ["id"]
          },
        ]
      }
      registro_auditoria: {
        Row: {
          actor: Database["public"]["Enums"]["actor_auditoria"]
          actor_id: string
          datos: Json
          dispositivo: string | null
          evento: Database["public"]["Enums"]["evento_auditable"]
          id: string
          ip: unknown
          timestamp: string
          traslado_id: string | null
        }
        Insert: {
          actor: Database["public"]["Enums"]["actor_auditoria"]
          actor_id: string
          datos?: Json
          dispositivo?: string | null
          evento: Database["public"]["Enums"]["evento_auditable"]
          id?: string
          ip?: unknown
          timestamp?: string
          traslado_id?: string | null
        }
        Update: {
          actor?: Database["public"]["Enums"]["actor_auditoria"]
          actor_id?: string
          datos?: Json
          dispositivo?: string | null
          evento?: Database["public"]["Enums"]["evento_auditable"]
          id?: string
          ip?: unknown
          timestamp?: string
          traslado_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "registro_auditoria_traslado_id_fkey"
            columns: ["traslado_id"]
            isOneToOne: false
            referencedRelation: "pasaporte_digital"
            referencedColumns: ["traslado_id"]
          },
          {
            foreignKeyName: "registro_auditoria_traslado_id_fkey"
            columns: ["traslado_id"]
            isOneToOne: false
            referencedRelation: "traslados"
            referencedColumns: ["id"]
          },
        ]
      }
      sesiones_proxy_traslado: {
        Row: {
          cerrada_en: string | null
          creada_en: string
          id: string
          numero_virtual: string
          participante_conductor_sid: string
          participante_usuario_sid: string
          traslado_id: string
          twilio_session_sid: string
        }
        Insert: {
          cerrada_en?: string | null
          creada_en?: string
          id?: string
          numero_virtual: string
          participante_conductor_sid: string
          participante_usuario_sid: string
          traslado_id: string
          twilio_session_sid: string
        }
        Update: {
          cerrada_en?: string | null
          creada_en?: string
          id?: string
          numero_virtual?: string
          participante_conductor_sid?: string
          participante_usuario_sid?: string
          traslado_id?: string
          twilio_session_sid?: string
        }
        Relationships: [
          {
            foreignKeyName: "sesiones_proxy_traslado_traslado_id_fkey"
            columns: ["traslado_id"]
            isOneToOne: true
            referencedRelation: "pasaporte_digital"
            referencedColumns: ["traslado_id"]
          },
          {
            foreignKeyName: "sesiones_proxy_traslado_traslado_id_fkey"
            columns: ["traslado_id"]
            isOneToOne: true
            referencedRelation: "traslados"
            referencedColumns: ["id"]
          },
        ]
      }
      solicitudes_conductor: {
        Row: {
          actualizado_en: string
          auth_user_id: string
          conductor_id: string | null
          contacto_emergencia: Json
          creado_en: string
          curp_normalizada: string | null
          datos_personales: Json
          domicilio: Json
          enviado_en: string | null
          estado: Database["public"]["Enums"]["estado_expediente_conductor"]
          id: string
          licencia: Json
          licencia_normalizada: string | null
          origen_modelo: string
          paso_actual: number
          telefono_normalizado: string | null
          version_registro: number
        }
        Insert: {
          actualizado_en?: string
          auth_user_id: string
          conductor_id?: string | null
          contacto_emergencia?: Json
          creado_en?: string
          curp_normalizada?: string | null
          datos_personales?: Json
          domicilio?: Json
          enviado_en?: string | null
          estado?: Database["public"]["Enums"]["estado_expediente_conductor"]
          id?: string
          licencia?: Json
          licencia_normalizada?: string | null
          origen_modelo?: string
          paso_actual?: number
          telefono_normalizado?: string | null
          version_registro?: number
        }
        Update: {
          actualizado_en?: string
          auth_user_id?: string
          conductor_id?: string | null
          contacto_emergencia?: Json
          creado_en?: string
          curp_normalizada?: string | null
          datos_personales?: Json
          domicilio?: Json
          enviado_en?: string | null
          estado?: Database["public"]["Enums"]["estado_expediente_conductor"]
          id?: string
          licencia?: Json
          licencia_normalizada?: string | null
          origen_modelo?: string
          paso_actual?: number
          telefono_normalizado?: string | null
          version_registro?: number
        }
        Relationships: [
          {
            foreignKeyName: "solicitudes_conductor_conductor_id_fkey"
            columns: ["conductor_id"]
            isOneToOne: true
            referencedRelation: "conductores"
            referencedColumns: ["id"]
          },
        ]
      }
      tarifas_condicion: {
        Row: {
          actualizado_en: string
          actualizado_por_admin_id: string | null
          condicion: Database["public"]["Enums"]["condicion_vehiculo"]
          factor: number
        }
        Insert: {
          actualizado_en?: string
          actualizado_por_admin_id?: string | null
          condicion: Database["public"]["Enums"]["condicion_vehiculo"]
          factor: number
        }
        Update: {
          actualizado_en?: string
          actualizado_por_admin_id?: string | null
          condicion?: Database["public"]["Enums"]["condicion_vehiculo"]
          factor?: number
        }
        Relationships: [
          {
            foreignKeyName: "tarifas_condicion_actualizado_por_admin_id_fkey"
            columns: ["actualizado_por_admin_id"]
            isOneToOne: false
            referencedRelation: "admins"
            referencedColumns: ["id"]
          },
        ]
      }
      tarifas_config: {
        Row: {
          actualizado_en: string
          actualizado_por_admin_id: string | null
          estado: Database["public"]["Enums"]["estado_politica_tarifaria"]
          id: boolean
          nombre_version: string
          notas: string | null
          tarifa_hora: number
          tope_factor_variable: number
          vigente_desde: string
        }
        Insert: {
          actualizado_en?: string
          actualizado_por_admin_id?: string | null
          estado?: Database["public"]["Enums"]["estado_politica_tarifaria"]
          id?: boolean
          nombre_version?: string
          notas?: string | null
          tarifa_hora: number
          tope_factor_variable: number
          vigente_desde?: string
        }
        Update: {
          actualizado_en?: string
          actualizado_por_admin_id?: string | null
          estado?: Database["public"]["Enums"]["estado_politica_tarifaria"]
          id?: boolean
          nombre_version?: string
          notas?: string | null
          tarifa_hora?: number
          tope_factor_variable?: number
          vigente_desde?: string
        }
        Relationships: [
          {
            foreignKeyName: "tarifas_config_actualizado_por_admin_id_fkey"
            columns: ["actualizado_por_admin_id"]
            isOneToOne: false
            referencedRelation: "admins"
            referencedColumns: ["id"]
          },
        ]
      }
      tarifas_dia: {
        Row: {
          actualizado_en: string
          actualizado_por_admin_id: string | null
          dia: Database["public"]["Enums"]["dia_traslado"]
          factor: number
        }
        Insert: {
          actualizado_en?: string
          actualizado_por_admin_id?: string | null
          dia: Database["public"]["Enums"]["dia_traslado"]
          factor: number
        }
        Update: {
          actualizado_en?: string
          actualizado_por_admin_id?: string | null
          dia?: Database["public"]["Enums"]["dia_traslado"]
          factor?: number
        }
        Relationships: [
          {
            foreignKeyName: "tarifas_dia_actualizado_por_admin_id_fkey"
            columns: ["actualizado_por_admin_id"]
            isOneToOne: false
            referencedRelation: "admins"
            referencedColumns: ["id"]
          },
        ]
      }
      tarifas_gama: {
        Row: {
          actualizado_en: string
          actualizado_por_admin_id: string | null
          factor: number
          gama: Database["public"]["Enums"]["gama_vehiculo"]
        }
        Insert: {
          actualizado_en?: string
          actualizado_por_admin_id?: string | null
          factor: number
          gama: Database["public"]["Enums"]["gama_vehiculo"]
        }
        Update: {
          actualizado_en?: string
          actualizado_por_admin_id?: string | null
          factor?: number
          gama?: Database["public"]["Enums"]["gama_vehiculo"]
        }
        Relationships: [
          {
            foreignKeyName: "tarifas_gama_actualizado_por_admin_id_fkey"
            columns: ["actualizado_por_admin_id"]
            isOneToOne: false
            referencedRelation: "admins"
            referencedColumns: ["id"]
          },
        ]
      }
      tarifas_horario: {
        Row: {
          actualizado_en: string
          actualizado_por_admin_id: string | null
          factor: number
          horario: Database["public"]["Enums"]["horario_traslado"]
        }
        Insert: {
          actualizado_en?: string
          actualizado_por_admin_id?: string | null
          factor: number
          horario: Database["public"]["Enums"]["horario_traslado"]
        }
        Update: {
          actualizado_en?: string
          actualizado_por_admin_id?: string | null
          factor?: number
          horario?: Database["public"]["Enums"]["horario_traslado"]
        }
        Relationships: [
          {
            foreignKeyName: "tarifas_horario_actualizado_por_admin_id_fkey"
            columns: ["actualizado_por_admin_id"]
            isOneToOne: false
            referencedRelation: "admins"
            referencedColumns: ["id"]
          },
        ]
      }
      tarifas_vehiculo: {
        Row: {
          actualizado_en: string
          actualizado_por_admin_id: string | null
          base: number
          categoria: Database["public"]["Enums"]["categoria_tarifa_vehiculo"]
          id: string
          por_km: number
          rango: Database["public"]["Enums"]["rango_distancia"]
        }
        Insert: {
          actualizado_en?: string
          actualizado_por_admin_id?: string | null
          base: number
          categoria: Database["public"]["Enums"]["categoria_tarifa_vehiculo"]
          id?: string
          por_km: number
          rango: Database["public"]["Enums"]["rango_distancia"]
        }
        Update: {
          actualizado_en?: string
          actualizado_por_admin_id?: string | null
          base?: number
          categoria?: Database["public"]["Enums"]["categoria_tarifa_vehiculo"]
          id?: string
          por_km?: number
          rango?: Database["public"]["Enums"]["rango_distancia"]
        }
        Relationships: [
          {
            foreignKeyName: "tarifas_vehiculo_actualizado_por_admin_id_fkey"
            columns: ["actualizado_por_admin_id"]
            isOneToOne: false
            referencedRelation: "admins"
            referencedColumns: ["id"]
          },
        ]
      }
      traslados: {
        Row: {
          actualizado_en: string
          causa_fallido: Database["public"]["Enums"]["causa_fallido"] | null
          clave_idempotencia: string
          conductor_id: string | null
          contacto_entrega_nombre: string
          contacto_entrega_telefono: string
          contacto_recepcion_nombre: string
          contacto_recepcion_telefono: string
          cotizacion_expira_en: string | null
          creado_en: string
          destino_ciudad: string
          destino_direccion: string
          destino_lat: number | null
          destino_lng: number | null
          destino_referencias: string | null
          distancia_km: number | null
          estado: Database["public"]["Enums"]["estado_traslado"]
          fecha_hora_programada: string | null
          id: string
          instrucciones_especiales: string | null
          modalidad_programacion: string | null
          motivo_servicio: string | null
          origen_ciudad: string
          origen_direccion: string
          origen_lat: number | null
          origen_lng: number | null
          origen_referencias: string | null
          precio_cotizado: number | null
          precio_final: number | null
          presupuesto_usuario: number | null
          tiempo_estimado_horas: number | null
          tiene_incidencia_abierta: boolean
          tipo_pago: Database["public"]["Enums"]["tipo_pago"]
          tipo_ruta: string | null
          tipo_servicio: string | null
          usuario_id: string
          vehiculo_id: string
          ventana_entrega: string | null
          ventana_recoleccion: string | null
        }
        Insert: {
          actualizado_en?: string
          causa_fallido?: Database["public"]["Enums"]["causa_fallido"] | null
          clave_idempotencia: string
          conductor_id?: string | null
          contacto_entrega_nombre: string
          contacto_entrega_telefono: string
          contacto_recepcion_nombre: string
          contacto_recepcion_telefono: string
          cotizacion_expira_en?: string | null
          creado_en?: string
          destino_ciudad: string
          destino_direccion: string
          destino_lat?: number | null
          destino_lng?: number | null
          destino_referencias?: string | null
          distancia_km?: number | null
          estado?: Database["public"]["Enums"]["estado_traslado"]
          fecha_hora_programada?: string | null
          id?: string
          instrucciones_especiales?: string | null
          modalidad_programacion?: string | null
          motivo_servicio?: string | null
          origen_ciudad: string
          origen_direccion: string
          origen_lat?: number | null
          origen_lng?: number | null
          origen_referencias?: string | null
          precio_cotizado?: number | null
          precio_final?: number | null
          presupuesto_usuario?: number | null
          tiempo_estimado_horas?: number | null
          tiene_incidencia_abierta?: boolean
          tipo_pago?: Database["public"]["Enums"]["tipo_pago"]
          tipo_ruta?: string | null
          tipo_servicio?: string | null
          usuario_id: string
          vehiculo_id: string
          ventana_entrega?: string | null
          ventana_recoleccion?: string | null
        }
        Update: {
          actualizado_en?: string
          causa_fallido?: Database["public"]["Enums"]["causa_fallido"] | null
          clave_idempotencia?: string
          conductor_id?: string | null
          contacto_entrega_nombre?: string
          contacto_entrega_telefono?: string
          contacto_recepcion_nombre?: string
          contacto_recepcion_telefono?: string
          cotizacion_expira_en?: string | null
          creado_en?: string
          destino_ciudad?: string
          destino_direccion?: string
          destino_lat?: number | null
          destino_lng?: number | null
          destino_referencias?: string | null
          distancia_km?: number | null
          estado?: Database["public"]["Enums"]["estado_traslado"]
          fecha_hora_programada?: string | null
          id?: string
          instrucciones_especiales?: string | null
          modalidad_programacion?: string | null
          motivo_servicio?: string | null
          origen_ciudad?: string
          origen_direccion?: string
          origen_lat?: number | null
          origen_lng?: number | null
          origen_referencias?: string | null
          precio_cotizado?: number | null
          precio_final?: number | null
          presupuesto_usuario?: number | null
          tiempo_estimado_horas?: number | null
          tiene_incidencia_abierta?: boolean
          tipo_pago?: Database["public"]["Enums"]["tipo_pago"]
          tipo_ruta?: string | null
          tipo_servicio?: string | null
          usuario_id?: string
          vehiculo_id?: string
          ventana_entrega?: string | null
          ventana_recoleccion?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "traslados_conductor_id_fkey"
            columns: ["conductor_id"]
            isOneToOne: false
            referencedRelation: "conductores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "traslados_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "traslados_vehiculo_id_fkey"
            columns: ["vehiculo_id"]
            isOneToOne: false
            referencedRelation: "vehiculos"
            referencedColumns: ["id"]
          },
        ]
      }
      ubicaciones_traslado: {
        Row: {
          conductor_id: string
          id: string
          lat: number
          lng: number
          precision_m: number | null
          registrado_en: string
          traslado_id: string
          velocidad_mps: number | null
        }
        Insert: {
          conductor_id: string
          id?: string
          lat: number
          lng: number
          precision_m?: number | null
          registrado_en?: string
          traslado_id: string
          velocidad_mps?: number | null
        }
        Update: {
          conductor_id?: string
          id?: string
          lat?: number
          lng?: number
          precision_m?: number | null
          registrado_en?: string
          traslado_id?: string
          velocidad_mps?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ubicaciones_traslado_conductor_id_fkey"
            columns: ["conductor_id"]
            isOneToOne: false
            referencedRelation: "conductores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ubicaciones_traslado_traslado_id_fkey"
            columns: ["traslado_id"]
            isOneToOne: false
            referencedRelation: "pasaporte_digital"
            referencedColumns: ["traslado_id"]
          },
          {
            foreignKeyName: "ubicaciones_traslado_traslado_id_fkey"
            columns: ["traslado_id"]
            isOneToOne: false
            referencedRelation: "traslados"
            referencedColumns: ["id"]
          },
        ]
      }
      usuarios: {
        Row: {
          actualizado_en: string
          alertas_evidencia: boolean
          alertas_pago: boolean
          alertas_viaje: boolean
          auth_user_id: string | null
          calle: string | null
          ciudad: string | null
          codigo_postal: string | null
          codigo_postal_fiscal: string | null
          colonia: string | null
          correo_facturacion: string | null
          creado_en: string
          direccion_principal: string | null
          doc_identidad_subido_en: string | null
          doc_identidad_url: string | null
          empresa_id: string | null
          estado: string | null
          estado_verificacion: Database["public"]["Enums"]["estado_verificacion"]
          foto_url: string | null
          id: string
          metodo_pago_registrado: boolean
          nombre: string | null
          notificaciones_email: boolean
          notificaciones_promocionales: boolean
          notificaciones_push: boolean
          notificaciones_sms_whatsapp: boolean
          numero: string | null
          pais: string | null
          razon_social: string | null
          referencias: string | null
          regimen_fiscal: string | null
          rfc: string | null
          rol: Database["public"]["Enums"]["rol_usuario"]
          telefono: string | null
          terminos_aceptados_en: string | null
          tipo_cuenta: string
          traslados_completados_sin_incidencia: number
          uso_cfdi: string | null
          version_terminos_aceptada: number | null
        }
        Insert: {
          actualizado_en?: string
          alertas_evidencia?: boolean
          alertas_pago?: boolean
          alertas_viaje?: boolean
          auth_user_id?: string | null
          calle?: string | null
          ciudad?: string | null
          codigo_postal?: string | null
          codigo_postal_fiscal?: string | null
          colonia?: string | null
          correo_facturacion?: string | null
          creado_en?: string
          direccion_principal?: string | null
          doc_identidad_subido_en?: string | null
          doc_identidad_url?: string | null
          empresa_id?: string | null
          estado?: string | null
          estado_verificacion?: Database["public"]["Enums"]["estado_verificacion"]
          foto_url?: string | null
          id?: string
          metodo_pago_registrado?: boolean
          nombre?: string | null
          notificaciones_email?: boolean
          notificaciones_promocionales?: boolean
          notificaciones_push?: boolean
          notificaciones_sms_whatsapp?: boolean
          numero?: string | null
          pais?: string | null
          razon_social?: string | null
          referencias?: string | null
          regimen_fiscal?: string | null
          rfc?: string | null
          rol?: Database["public"]["Enums"]["rol_usuario"]
          telefono?: string | null
          terminos_aceptados_en?: string | null
          tipo_cuenta: string
          traslados_completados_sin_incidencia?: number
          uso_cfdi?: string | null
          version_terminos_aceptada?: number | null
        }
        Update: {
          actualizado_en?: string
          alertas_evidencia?: boolean
          alertas_pago?: boolean
          alertas_viaje?: boolean
          auth_user_id?: string | null
          calle?: string | null
          ciudad?: string | null
          codigo_postal?: string | null
          codigo_postal_fiscal?: string | null
          colonia?: string | null
          correo_facturacion?: string | null
          creado_en?: string
          direccion_principal?: string | null
          doc_identidad_subido_en?: string | null
          doc_identidad_url?: string | null
          empresa_id?: string | null
          estado?: string | null
          estado_verificacion?: Database["public"]["Enums"]["estado_verificacion"]
          foto_url?: string | null
          id?: string
          metodo_pago_registrado?: boolean
          nombre?: string | null
          notificaciones_email?: boolean
          notificaciones_promocionales?: boolean
          notificaciones_push?: boolean
          notificaciones_sms_whatsapp?: boolean
          numero?: string | null
          pais?: string | null
          razon_social?: string | null
          referencias?: string | null
          regimen_fiscal?: string | null
          rfc?: string | null
          rol?: Database["public"]["Enums"]["rol_usuario"]
          telefono?: string | null
          terminos_aceptados_en?: string | null
          tipo_cuenta?: string
          traslados_completados_sin_incidencia?: number
          uso_cfdi?: string | null
          version_terminos_aceptada?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "usuarios_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      vehiculos: {
        Row: {
          alias: string | null
          anio: number
          categoria_tarifa:
            | Database["public"]["Enums"]["categoria_tarifa_vehiculo"]
            | null
          color: string | null
          condicion: Database["public"]["Enums"]["condicion_vehiculo"] | null
          creado_en: string
          estado_general_declarado: string | null
          fotos_urls: string[]
          gama: Database["public"]["Enums"]["gama_vehiculo"] | null
          id: string
          marca: string
          modelo: string
          permiso_especial_vigente: string | null
          placas: string | null
          puede_circular_rodando: boolean
          tiene_placas: boolean
          tiene_tarjeta_circulacion: boolean
          tiene_verificacion: boolean
          tipo: Database["public"]["Enums"]["tipo_vehiculo"]
          transmision: string | null
          usuario_id: string
          vin: string | null
        }
        Insert: {
          alias?: string | null
          anio: number
          categoria_tarifa?:
            | Database["public"]["Enums"]["categoria_tarifa_vehiculo"]
            | null
          color?: string | null
          condicion?: Database["public"]["Enums"]["condicion_vehiculo"] | null
          creado_en?: string
          estado_general_declarado?: string | null
          fotos_urls?: string[]
          gama?: Database["public"]["Enums"]["gama_vehiculo"] | null
          id?: string
          marca: string
          modelo: string
          permiso_especial_vigente?: string | null
          placas?: string | null
          puede_circular_rodando?: boolean
          tiene_placas?: boolean
          tiene_tarjeta_circulacion?: boolean
          tiene_verificacion?: boolean
          tipo: Database["public"]["Enums"]["tipo_vehiculo"]
          transmision?: string | null
          usuario_id: string
          vin?: string | null
        }
        Update: {
          alias?: string | null
          anio?: number
          categoria_tarifa?:
            | Database["public"]["Enums"]["categoria_tarifa_vehiculo"]
            | null
          color?: string | null
          condicion?: Database["public"]["Enums"]["condicion_vehiculo"] | null
          creado_en?: string
          estado_general_declarado?: string | null
          fotos_urls?: string[]
          gama?: Database["public"]["Enums"]["gama_vehiculo"] | null
          id?: string
          marca?: string
          modelo?: string
          permiso_especial_vigente?: string | null
          placas?: string | null
          puede_circular_rodando?: boolean
          tiene_placas?: boolean
          tiene_tarjeta_circulacion?: boolean
          tiene_verificacion?: boolean
          tipo?: Database["public"]["Enums"]["tipo_vehiculo"]
          transmision?: string | null
          usuario_id?: string
          vin?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vehiculos_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      versiones_documento_consentimiento: {
        Row: {
          hash_documento: string
          referencia: string
          tipo_documento: Database["public"]["Enums"]["tipo_documento_consentimiento"]
          version: number
          vigente_desde: string
          vigente_hasta: string | null
        }
        Insert: {
          hash_documento: string
          referencia: string
          tipo_documento: Database["public"]["Enums"]["tipo_documento_consentimiento"]
          version: number
          vigente_desde: string
          vigente_hasta?: string | null
        }
        Update: {
          hash_documento?: string
          referencia?: string
          tipo_documento?: Database["public"]["Enums"]["tipo_documento_consentimiento"]
          version?: number
          vigente_desde?: string
          vigente_hasta?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      pasaporte_digital: {
        Row: {
          actualizado_en: string | null
          causa_fallido: Database["public"]["Enums"]["causa_fallido"] | null
          conductor_calificacion: number | null
          conductor_estado:
            | Database["public"]["Enums"]["estado_conductor"]
            | null
          conductor_id: string | null
          conductor_nivel: Database["public"]["Enums"]["nivel_concer"] | null
          conductor_nombre: string | null
          contacto_entrega_nombre: string | null
          contacto_entrega_telefono: string | null
          contacto_recepcion_nombre: string | null
          contacto_recepcion_telefono: string | null
          creado_en: string | null
          destino_ciudad: string | null
          destino_direccion: string | null
          destino_lat: number | null
          destino_lng: number | null
          destino_referencias: string | null
          distancia_km: number | null
          estado: Database["public"]["Enums"]["estado_traslado"] | null
          evidencia_final_fotos_sincronizadas: number | null
          evidencia_inicial_fotos_sincronizadas: number | null
          incidencias_abiertas: number | null
          monto_pagado: number | null
          origen_ciudad: string | null
          origen_direccion: string | null
          origen_lat: number | null
          origen_lng: number | null
          origen_referencias: string | null
          precio_cotizado: number | null
          precio_final: number | null
          tiempo_estimado_horas: number | null
          tiene_incidencia_abierta: boolean | null
          tipo_pago: Database["public"]["Enums"]["tipo_pago"] | null
          traslado_id: string | null
          usuario_id: string | null
          vehiculo_anio: number | null
          vehiculo_categoria_tarifa:
            | Database["public"]["Enums"]["categoria_tarifa_vehiculo"]
            | null
          vehiculo_color: string | null
          vehiculo_condicion:
            | Database["public"]["Enums"]["condicion_vehiculo"]
            | null
          vehiculo_gama: Database["public"]["Enums"]["gama_vehiculo"] | null
          vehiculo_id: string | null
          vehiculo_marca: string | null
          vehiculo_modelo: string | null
          vehiculo_placas: string | null
          vehiculo_tipo: Database["public"]["Enums"]["tipo_vehiculo"] | null
          vehiculo_vin: string | null
        }
        Relationships: [
          {
            foreignKeyName: "traslados_conductor_id_fkey"
            columns: ["conductor_id"]
            isOneToOne: false
            referencedRelation: "conductores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "traslados_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "traslados_vehiculo_id_fkey"
            columns: ["vehiculo_id"]
            isOneToOne: false
            referencedRelation: "vehiculos"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      abrir_disputa_traslado: {
        Args: {
          p_abierta_por: Database["public"]["Enums"]["abierta_por_actor"]
          p_descripcion: string
          p_tipo: Database["public"]["Enums"]["tipo_disputa"]
          p_traslado_id: string
        }
        Returns: string
      }
      admin_actual_id: { Args: never; Returns: string }
      admin_actualiza_reclamo_seguro: {
        Args: {
          p_estado: Database["public"]["Enums"]["estado_reclamo_seguro"]
          p_notas_admin: string
          p_reclamo_id: string
          p_responsable_pago: string
        }
        Returns: undefined
      }
      admin_actualizar_politica_tarifaria_normativa: {
        Args: { p_payload: Json }
        Returns: Json
      }
      admin_asigna_conductor: {
        Args: { p_conductor_id: string; p_traslado_id: string }
        Returns: Database["public"]["Enums"]["estado_traslado"]
      }
      admin_emite_cotizacion: {
        Args: { p_precio: number; p_traslado_id: string }
        Returns: undefined
      }
      admin_marca_traslado_fallido: {
        Args: {
          p_cargo_aplica_cliente: boolean
          p_causa: Database["public"]["Enums"]["causa_fallido"]
          p_mensaje: string
          p_porcentaje_descuento_segundo_intento: number
          p_requiere_reagendamiento: boolean
          p_traslado_id: string
        }
        Returns: undefined
      }
      admin_resuelve_disputa: {
        Args: {
          p_detalle: string
          p_disputa_id: string
          p_estado: Database["public"]["Enums"]["estado_disputa"]
          p_resolucion: Database["public"]["Enums"]["resolucion_disputa"]
        }
        Returns: undefined
      }
      admin_sugerir_tarifa_traslado: {
        Args: { p_traslado_id: string }
        Returns: number
      }
      aprobar_expediente_conductor_admin: {
        Args: { p_conductor_id: string }
        Returns: undefined
      }
      aprobar_solicitud_conductor_admin: {
        Args: { p_motivo?: string; p_solicitud_id: string }
        Returns: string
      }
      auth_es_conductor_de_traslado: {
        Args: { p_conductor_id: string; p_traslado_id: string }
        Returns: boolean
      }
      auth_es_conductor_de_traslado_activo: {
        Args: { p_conductor_id: string; p_traslado_id: string }
        Returns: boolean
      }
      auth_es_usuario_de_traslado: {
        Args: { p_traslado_id: string }
        Returns: boolean
      }
      calcular_tarifa_traslado: {
        Args: {
          p_categoria: Database["public"]["Enums"]["categoria_tarifa_vehiculo"]
          p_condicion: Database["public"]["Enums"]["condicion_vehiculo"]
          p_dia: Database["public"]["Enums"]["dia_traslado"]
          p_distancia_km: number
          p_gama: Database["public"]["Enums"]["gama_vehiculo"]
          p_horario: Database["public"]["Enums"]["horario_traslado"]
          p_rango: Database["public"]["Enums"]["rango_distancia"]
          p_tiempo_horas: number
        }
        Returns: number
      }
      cambiar_estado_expediente_conductor: {
        Args: {
          p_conductor_id: string
          p_destino: Database["public"]["Enums"]["estado_expediente_conductor"]
        }
        Returns: undefined
      }
      cambiar_estado_solicitud_conductor: {
        Args: {
          p_destino: Database["public"]["Enums"]["estado_expediente_conductor"]
          p_solicitud_id: string
        }
        Returns: undefined
      }
      catalogar_vehiculo_para_tarifa: {
        Args: { p_marca: string; p_modelo: string }
        Returns: {
          categoria_tarifa: Database["public"]["Enums"]["categoria_tarifa_vehiculo"]
          gama: Database["public"]["Enums"]["gama_vehiculo"]
        }[]
      }
      chat_disponible: {
        Args: { p_estado: Database["public"]["Enums"]["estado_traslado"] }
        Returns: boolean
      }
      clasificar_registro_conductor: {
        Args: { p_auth_user_id: string }
        Returns: string
      }
      completar_solicitud_conductor_v2: {
        Args: {
          p_contacto_emergencia: Json
          p_datos_personales: Json
          p_domicilio: Json
          p_licencia: Json
        }
        Returns: string
      }
      conductor_acepta_viaje: {
        Args: { p_traslado_id: string }
        Returns: Database["public"]["Enums"]["estado_traslado"]
      }
      conductor_avanza_traslado: {
        Args: { p_evento: string; p_traslado_id: string }
        Returns: Database["public"]["Enums"]["estado_traslado"]
      }
      conductor_confirmar_llegada_destino: {
        Args: {
          p_distancia_m?: number
          p_fuera_geocerca?: boolean
          p_traslado_id: string
        }
        Returns: Database["public"]["Enums"]["estado_traslado"]
      }
      conductor_guarda_datos_bancarios: {
        Args: {
          p_banco: string
          p_clabe: string
          p_numero_tarjeta: string
          p_titular_cuenta: string
        }
        Returns: {
          actualizado_en: string
          banco: string
          clabe: string
          conductor_id: string
          creado_en: string
          estado: Database["public"]["Enums"]["estado_datos_bancarios_conductor"]
          id: string
          motivo_rechazo: string | null
          numero_tarjeta: string
          titular_cuenta: string
        }
        SetofOptions: {
          from: "*"
          to: "datos_bancarios_conductor"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      conductor_operativamente_aprobado: {
        Args: { p_auth_user_id?: string }
        Returns: boolean
      }
      consentimientos_solicitud_completos: {
        Args: { p_solicitud_id: string }
        Returns: boolean
      }
      crear_incidencia_sistema_dano_no_reportado: {
        Args: { p_descripcion: string; p_traslado_id: string }
        Returns: string
      }
      crear_usuario_legacy_desde_auth: {
        Args: { p_usuario: unknown }
        Returns: undefined
      }
      determinar_tipo_pago_usuario: {
        Args: { p_usuario_id: string }
        Returns: Database["public"]["Enums"]["tipo_pago"]
      }
      dia_desde_timestamp: {
        Args: { p_ts: string }
        Returns: Database["public"]["Enums"]["dia_traslado"]
      }
      empresa_id_del_titular_actual: { Args: never; Returns: string }
      enviar_mensaje_chat: {
        Args: { p_contenido: string; p_traslado_id: string }
        Returns: {
          contenido: string
          enviado_en: string
          id: string
          remitente: Database["public"]["Enums"]["remitente_chat"]
          reportado: boolean
          traslado_id: string
        }
        SetofOptions: {
          from: "*"
          to: "mensajes_chat"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      enviar_solicitud_conductor: {
        Args: never
        Returns: {
          conductor_id: string
          estado: Database["public"]["Enums"]["estado_expediente_conductor"]
          paso_actual: number
          solicitud_id: string
        }[]
      }
      es_admin: { Args: never; Returns: boolean }
      expediente_conductor_tiene_datos: {
        Args: { p_conductor_id: string }
        Returns: boolean
      }
      guardar_borrador_conductor: {
        Args: {
          p_contacto_emergencia?: Json
          p_datos_personales?: Json
          p_domicilio?: Json
          p_licencia?: Json
          p_paso_actual: number
        }
        Returns: {
          conductor_id: string
          estado: Database["public"]["Enums"]["estado_expediente_conductor"]
          paso_actual: number
          solicitud_id: string
        }[]
      }
      horario_desde_timestamp: {
        Args: { p_ts: string }
        Returns: Database["public"]["Enums"]["horario_traslado"]
      }
      iniciar_solicitud_conductor: {
        Args: never
        Returns: {
          conductor_id: string
          estado: Database["public"]["Enums"]["estado_expediente_conductor"]
          paso_actual: number
          solicitud_id: string
        }[]
      }
      objetivo_documento_pertenece_auth: {
        Args: { p_auth_user_id?: string; p_objetivo_id: string }
        Returns: boolean
      }
      objetivo_documento_texto_pertenece_auth: {
        Args: { p_objetivo: string }
        Returns: boolean
      }
      obtener_metricas_registro_conductor: {
        Args: { p_desde?: string; p_hasta?: string }
        Returns: Json
      }
      rango_desde_distancia: {
        Args: { p_km: number }
        Returns: Database["public"]["Enums"]["rango_distancia"]
      }
      recalcular_calificacion_conductor: {
        Args: { p_conductor_id: string }
        Returns: undefined
      }
      rechazar_solicitud_conductor_admin: {
        Args: { p_motivo: string; p_solicitud_id: string }
        Returns: undefined
      }
      reclamar_limpieza_documentos_identidad: {
        Args: { p_limite?: number }
        Returns: {
          documento_id: string
          intento: number
          ruta: string
        }[]
      }
      reemplazar_documento_conductor: {
        Args: {
          p_documento_anterior_id: string
          p_nombre_archivo: string
          p_ruta: string
        }
        Returns: string
      }
      registrar_consentimientos_conductor: {
        Args: {
          p_canal: string
          p_consentimientos: Json
          p_solicitud_id: string
          p_version_app: string
        }
        Returns: number
      }
      registrar_documento_conductor: {
        Args: {
          p_nombre_archivo: string
          p_objetivo_id: string
          p_ruta: string
          p_tipo: string
        }
        Returns: string
      }
      registrar_documento_identidad: {
        Args: { p_ruta: string; p_sello_id: string; p_sha256: string }
        Returns: {
          documento_id: string
          estado: string
          ruta: string
          ruta_anterior: string
          subido_en: string
          version: number
        }[]
      }
      registrar_documento_identidad_usuario: {
        Args: { p_ruta: string }
        Returns: undefined
      }
      registrar_evento_registro_conductor: {
        Args: {
          p_codigo?: string
          p_duracion_ms?: number
          p_evento: string
          p_paso?: number
          p_sesion_id: string
        }
        Returns: string
      }
      revisar_documento_conductor_admin: {
        Args: { p_documento_id: string; p_estado: string; p_notas?: string }
        Returns: undefined
      }
      ruta_documento_validada_para_auth: {
        Args: { p_ruta: string }
        Returns: boolean
      }
      ruta_identidad_validada_para_auth: {
        Args: { p_ruta: string }
        Returns: boolean
      }
      solicitud_conductor_datos_completos: {
        Args: { p_solicitud_id: string }
        Returns: boolean
      }
      traslado_tiene_metodo_pago_registrado: {
        Args: { p_traslado_id: string }
        Returns: boolean
      }
      unaccent: { Args: { "": string }; Returns: string }
      usuario_acepta_cotizacion: {
        Args: { p_traslado_id: string }
        Returns: Database["public"]["Enums"]["estado_traslado"]
      }
      usuario_cancela_traslado: {
        Args: {
          p_mensaje: string
          p_monto_cargo: number
          p_motivo: string
          p_porcentaje_cargo: number
          p_traslado_id: string
        }
        Returns: undefined
      }
      usuario_crea_traslado: {
        Args: {
          p_clave_idempotencia: string
          p_traslado: Json
          p_vehiculo: Json
          p_vehiculo_id: string
        }
        Returns: Json
      }
      usuario_previsualizar_tarifa: {
        Args: {
          p_condicion?: Database["public"]["Enums"]["condicion_vehiculo"]
          p_distancia_km: number
          p_fecha_hora?: string
          p_marca: string
          p_modelo: string
          p_tiempo_estimado_horas: number
        }
        Returns: Json
      }
      validar_ruta_documento_conductor: {
        Args: {
          p_auth_user_id?: string
          p_objetivo_id: string
          p_ruta: string
          p_tipo: string
        }
        Returns: undefined
      }
    }
    Enums: {
      abierta_por_actor: "usuario" | "conductor"
      actor_auditoria: "usuario" | "conductor" | "admin" | "sistema"
      actor_reporte: "usuario" | "conductor" | "admin" | "sistema"
      angulo_evidencia:
        | "frente"
        | "lado_piloto"
        | "lado_copiloto"
        | "trasera"
        | "tablero"
        | "dano_previo"
        | "adicional"
      categoria_tarifa_vehiculo: "ligero_a" | "ligero_b" | "mediano" | "camion"
      causa_fallido:
        | "imputable_cliente"
        | "operativo"
        | "fuerza_mayor"
        | "documentacion"
        | "vehiculo_no_circulable"
      certificacion_conductor: "estandar" | "tipo_b" | "federal" | "premium"
      condicion_vehiculo: "nueva" | "seminueva" | "rescate_mecanico"
      dia_traslado: "entre_semana" | "fin_semana"
      estado_conductor:
        | "activo"
        | "suspendido_7d"
        | "suspendido_14d"
        | "suspendido_30d"
        | "suspendido_indefinido"
        | "bloqueado_permanente"
        | "modo_prueba_supervisada"
        | "pendiente_verificacion"
      estado_datos_bancarios_conductor:
        | "en_revision"
        | "verificada"
        | "rechazada"
      estado_disputa:
        | "abierta"
        | "en_revision"
        | "resuelta"
        | "escalada"
        | "resuelta_senior"
      estado_expediente_conductor:
        | "borrador"
        | "correo_pendiente"
        | "datos_incompletos"
        | "documentos_pendientes"
        | "listo_para_enviar"
        | "en_revision"
        | "requiere_correccion"
        | "aprobado"
        | "rechazado"
        | "suspendido"
      estado_pago: "pendiente" | "completado" | "reembolsado" | "fallido"
      estado_payout: "pendiente" | "procesado" | "fallido"
      estado_politica_tarifaria: "borrador" | "vigente" | "archivada"
      estado_reclamo_seguro: "abierto" | "en_revision" | "resuelto"
      estado_traslado:
        | "usuario_pendiente_verificacion"
        | "usuario_verificado"
        | "solicitud_creada"
        | "documentacion_pendiente"
        | "documentacion_en_revision"
        | "documentacion_validada"
        | "cotizacion_generada"
        | "cotizacion_aceptada"
        | "servicio_confirmado"
        | "pendiente_de_conductor"
        | "conductor_asignado"
        | "conductor_en_camino_al_origen"
        | "conductor_en_punto_de_recoleccion"
        | "verificacion_vehiculo_en_proceso"
        | "evidencia_inicial_en_proceso"
        | "evidencia_inicial_completada"
        | "vehiculo_recibido"
        | "traslado_en_curso"
        | "incidencia_reportada"
        | "llegada_a_destino"
        | "evidencia_final_en_proceso"
        | "evidencia_final_completada"
        | "entrega_confirmada"
        | "pago_pendiente"
        | "pago_completado"
        | "servicio_cerrado"
        | "servicio_cancelado"
        | "traslado_fallido"
        | "dano_no_reportado_en_revision"
        | "reclamo_abierto"
        | "reclamo_resuelto"
        | "cierre_operativo_con_incidencia_abierta"
        | "disputa_abierta"
        | "disputa_resuelta"
      estado_verificacion:
        | "pendiente"
        | "en_revision"
        | "verificado"
        | "rechazado"
      evento_auditable:
        | "creacion_cuenta"
        | "verificacion_cuenta"
        | "carga_documentos"
        | "validacion_documentos"
        | "creacion_solicitud_traslado"
        | "generacion_cotizacion"
        | "confirmacion_servicio"
        | "asignacion_conductor"
        | "aceptacion_traslado_conductor"
        | "llegada_conductor_origen"
        | "captura_evidencia_inicial"
        | "confirmacion_vehiculo_recibido"
        | "inicio_traslado"
        | "reporte_incidencia"
        | "llegada_destino"
        | "captura_evidencia_final"
        | "confirmacion_entrega"
        | "registro_pago"
        | "cierre_traslado"
        | "cancelacion_traslado"
        | "apertura_disputa"
        | "resolucion_disputa"
        | "apertura_reclamo_seguro"
        | "resolucion_reclamo_seguro"
        | "suspension_conductor"
        | "modificacion_traslado_activo"
        | "activacion_soporte_emergencia"
        | "comunicacion_usuario_conductor"
        | "calificacion_conductor"
        | "exportacion_pasaporte_pdf"
        | "asignacion_modo_prueba_supervisada"
        | "resultado_modo_prueba_supervisada"
        | "aceptacion_terminos"
        | "carga_documento_identidad"
        | "actualizacion_datos_bancarios_conductor"
      gama_vehiculo: "entrada" | "media" | "alta" | "premium"
      horario_traslado: "diurno" | "nocturno"
      momento_incidencia:
        | "recoleccion"
        | "durante_traslado"
        | "entrega"
        | "post_cierre"
      momento_pago: "anticipado" | "al_cierre"
      nivel_concer: "basico" | "ejecutivo" | "luxury" | "coleccion"
      rango_distancia: "rango_1" | "rango_2" | "rango_3" | "rango_4"
      remitente_chat: "usuario" | "conductor"
      resolucion_disputa: "favor_reclamante" | "en_contra" | "solucion_parcial"
      rol_usuario: "personal" | "titular_empresa" | "usuario_autorizado"
      tipo_disputa:
        | "cobro_incorrecto"
        | "cancelacion_fuera_de_politica"
        | "dano_no_reconocido"
        | "no_presentacion"
        | "calificacion_injusta"
      tipo_documento_consentimiento:
        | "terminos_servicio"
        | "aviso_privacidad"
        | "autorizacion_antecedentes"
        | "declaracion_suspensiones"
      tipo_evidencia: "inicial" | "final"
      tipo_incidencia:
        | "vehiculo_no_enciende"
        | "contacto_no_localizado"
        | "documentacion_incompleta"
        | "dano_previo_relevante"
        | "colision_robo_asalto"
        | "emergencia_medica_conductor"
        | "descompostura_en_ruta"
        | "infraccion_autoridad_vial"
        | "conductor_enfermo"
        | "perdida_conectividad"
        | "dano_no_reportado"
      tipo_pago: "anticipado" | "al_cierre"
      tipo_vehiculo:
        | "sedan"
        | "suv"
        | "pick_up"
        | "van"
        | "luxury"
        | "coleccion"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  storage: {
    Tables: {
      buckets: {
        Row: {
          allowed_mime_types: string[] | null
          avif_autodetection: boolean | null
          created_at: string | null
          file_size_limit: number | null
          id: string
          name: string
          owner: string | null
          owner_id: string | null
          public: boolean | null
          type: Database["storage"]["Enums"]["buckettype"]
          updated_at: string | null
        }
        Insert: {
          allowed_mime_types?: string[] | null
          avif_autodetection?: boolean | null
          created_at?: string | null
          file_size_limit?: number | null
          id: string
          name: string
          owner?: string | null
          owner_id?: string | null
          public?: boolean | null
          type?: Database["storage"]["Enums"]["buckettype"]
          updated_at?: string | null
        }
        Update: {
          allowed_mime_types?: string[] | null
          avif_autodetection?: boolean | null
          created_at?: string | null
          file_size_limit?: number | null
          id?: string
          name?: string
          owner?: string | null
          owner_id?: string | null
          public?: boolean | null
          type?: Database["storage"]["Enums"]["buckettype"]
          updated_at?: string | null
        }
        Relationships: []
      }
      buckets_analytics: {
        Row: {
          created_at: string
          deleted_at: string | null
          format: string
          id: string
          name: string
          type: Database["storage"]["Enums"]["buckettype"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          format?: string
          id?: string
          name: string
          type?: Database["storage"]["Enums"]["buckettype"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          format?: string
          id?: string
          name?: string
          type?: Database["storage"]["Enums"]["buckettype"]
          updated_at?: string
        }
        Relationships: []
      }
      buckets_vectors: {
        Row: {
          created_at: string
          id: string
          type: Database["storage"]["Enums"]["buckettype"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          id: string
          type?: Database["storage"]["Enums"]["buckettype"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          type?: Database["storage"]["Enums"]["buckettype"]
          updated_at?: string
        }
        Relationships: []
      }
      iceberg_namespaces: {
        Row: {
          bucket_name: string
          catalog_id: string
          created_at: string
          id: string
          metadata: Json
          name: string
          updated_at: string
        }
        Insert: {
          bucket_name: string
          catalog_id: string
          created_at?: string
          id?: string
          metadata?: Json
          name: string
          updated_at?: string
        }
        Update: {
          bucket_name?: string
          catalog_id?: string
          created_at?: string
          id?: string
          metadata?: Json
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "iceberg_namespaces_catalog_id_fkey"
            columns: ["catalog_id"]
            isOneToOne: false
            referencedRelation: "buckets_analytics"
            referencedColumns: ["id"]
          },
        ]
      }
      iceberg_tables: {
        Row: {
          bucket_name: string
          catalog_id: string
          created_at: string
          id: string
          location: string
          name: string
          namespace_id: string
          remote_table_id: string | null
          shard_id: string | null
          shard_key: string | null
          updated_at: string
        }
        Insert: {
          bucket_name: string
          catalog_id: string
          created_at?: string
          id?: string
          location: string
          name: string
          namespace_id: string
          remote_table_id?: string | null
          shard_id?: string | null
          shard_key?: string | null
          updated_at?: string
        }
        Update: {
          bucket_name?: string
          catalog_id?: string
          created_at?: string
          id?: string
          location?: string
          name?: string
          namespace_id?: string
          remote_table_id?: string | null
          shard_id?: string | null
          shard_key?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "iceberg_tables_catalog_id_fkey"
            columns: ["catalog_id"]
            isOneToOne: false
            referencedRelation: "buckets_analytics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "iceberg_tables_namespace_id_fkey"
            columns: ["namespace_id"]
            isOneToOne: false
            referencedRelation: "iceberg_namespaces"
            referencedColumns: ["id"]
          },
        ]
      }
      migrations: {
        Row: {
          executed_at: string | null
          hash: string
          id: number
          name: string
        }
        Insert: {
          executed_at?: string | null
          hash: string
          id: number
          name: string
        }
        Update: {
          executed_at?: string | null
          hash?: string
          id?: number
          name?: string
        }
        Relationships: []
      }
      objects: {
        Row: {
          bucket_id: string | null
          created_at: string | null
          id: string
          last_accessed_at: string | null
          metadata: Json | null
          name: string | null
          owner: string | null
          owner_id: string | null
          path_tokens: string[] | null
          updated_at: string | null
          user_metadata: Json | null
          version: string | null
        }
        Insert: {
          bucket_id?: string | null
          created_at?: string | null
          id?: string
          last_accessed_at?: string | null
          metadata?: Json | null
          name?: string | null
          owner?: string | null
          owner_id?: string | null
          path_tokens?: string[] | null
          updated_at?: string | null
          user_metadata?: Json | null
          version?: string | null
        }
        Update: {
          bucket_id?: string | null
          created_at?: string | null
          id?: string
          last_accessed_at?: string | null
          metadata?: Json | null
          name?: string | null
          owner?: string | null
          owner_id?: string | null
          path_tokens?: string[] | null
          updated_at?: string | null
          user_metadata?: Json | null
          version?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "objects_bucketId_fkey"
            columns: ["bucket_id"]
            isOneToOne: false
            referencedRelation: "buckets"
            referencedColumns: ["id"]
          },
        ]
      }
      s3_multipart_uploads: {
        Row: {
          bucket_id: string
          created_at: string
          id: string
          in_progress_size: number
          key: string
          metadata: Json | null
          owner_id: string | null
          upload_signature: string
          user_metadata: Json | null
          version: string
        }
        Insert: {
          bucket_id: string
          created_at?: string
          id: string
          in_progress_size?: number
          key: string
          metadata?: Json | null
          owner_id?: string | null
          upload_signature: string
          user_metadata?: Json | null
          version: string
        }
        Update: {
          bucket_id?: string
          created_at?: string
          id?: string
          in_progress_size?: number
          key?: string
          metadata?: Json | null
          owner_id?: string | null
          upload_signature?: string
          user_metadata?: Json | null
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "s3_multipart_uploads_bucket_id_fkey"
            columns: ["bucket_id"]
            isOneToOne: false
            referencedRelation: "buckets"
            referencedColumns: ["id"]
          },
        ]
      }
      s3_multipart_uploads_parts: {
        Row: {
          bucket_id: string
          created_at: string
          etag: string
          id: string
          key: string
          owner_id: string | null
          part_number: number
          size: number
          upload_id: string
          version: string
        }
        Insert: {
          bucket_id: string
          created_at?: string
          etag: string
          id?: string
          key: string
          owner_id?: string | null
          part_number: number
          size?: number
          upload_id: string
          version: string
        }
        Update: {
          bucket_id?: string
          created_at?: string
          etag?: string
          id?: string
          key?: string
          owner_id?: string | null
          part_number?: number
          size?: number
          upload_id?: string
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "s3_multipart_uploads_parts_bucket_id_fkey"
            columns: ["bucket_id"]
            isOneToOne: false
            referencedRelation: "buckets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "s3_multipart_uploads_parts_upload_id_fkey"
            columns: ["upload_id"]
            isOneToOne: false
            referencedRelation: "s3_multipart_uploads"
            referencedColumns: ["id"]
          },
        ]
      }
      vector_indexes: {
        Row: {
          bucket_id: string
          created_at: string
          data_type: string
          dimension: number
          distance_metric: string
          id: string
          metadata_configuration: Json | null
          name: string
          updated_at: string
        }
        Insert: {
          bucket_id: string
          created_at?: string
          data_type: string
          dimension: number
          distance_metric: string
          id?: string
          metadata_configuration?: Json | null
          name: string
          updated_at?: string
        }
        Update: {
          bucket_id?: string
          created_at?: string
          data_type?: string
          dimension?: number
          distance_metric?: string
          id?: string
          metadata_configuration?: Json | null
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "vector_indexes_bucket_id_fkey"
            columns: ["bucket_id"]
            isOneToOne: false
            referencedRelation: "buckets_vectors"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      allow_any_operation: {
        Args: { expected_operations: string[] }
        Returns: boolean
      }
      allow_only_operation: {
        Args: { expected_operation: string }
        Returns: boolean
      }
      can_insert_object: {
        Args: { bucketid: string; metadata: Json; name: string; owner: string }
        Returns: undefined
      }
      extension: { Args: { name: string }; Returns: string }
      filename: { Args: { name: string }; Returns: string }
      foldername: { Args: { name: string }; Returns: string[] }
      get_common_prefix: {
        Args: { p_delimiter: string; p_key: string; p_prefix: string }
        Returns: string
      }
      get_size_by_bucket: {
        Args: never
        Returns: {
          bucket_id: string
          size: number
        }[]
      }
      list_multipart_uploads_with_delimiter: {
        Args: {
          bucket_id: string
          delimiter_param: string
          max_keys?: number
          next_key_token?: string
          next_upload_token?: string
          prefix_param: string
        }
        Returns: {
          created_at: string
          id: string
          key: string
        }[]
      }
      list_objects_with_delimiter: {
        Args: {
          _bucket_id: string
          delimiter_param: string
          max_keys?: number
          next_token?: string
          prefix_param: string
          sort_order?: string
          start_after?: string
        }
        Returns: {
          created_at: string
          id: string
          last_accessed_at: string
          metadata: Json
          name: string
          updated_at: string
        }[]
      }
      operation: { Args: never; Returns: string }
      search: {
        Args: {
          bucketname: string
          levels?: number
          limits?: number
          offsets?: number
          prefix: string
          search?: string
          sortcolumn?: string
          sortorder?: string
        }
        Returns: {
          created_at: string
          id: string
          last_accessed_at: string
          metadata: Json
          name: string
          updated_at: string
        }[]
      }
      search_by_timestamp: {
        Args: {
          p_bucket_id: string
          p_level: number
          p_limit: number
          p_prefix: string
          p_sort_column: string
          p_sort_column_after: string
          p_sort_order: string
          p_start_after: string
        }
        Returns: {
          created_at: string
          id: string
          key: string
          last_accessed_at: string
          metadata: Json
          name: string
          updated_at: string
        }[]
      }
      search_v2: {
        Args: {
          bucket_name: string
          levels?: number
          limits?: number
          prefix: string
          sort_column?: string
          sort_column_after?: string
          sort_order?: string
          start_after?: string
        }
        Returns: {
          created_at: string
          id: string
          key: string
          last_accessed_at: string
          metadata: Json
          name: string
          updated_at: string
        }[]
      }
    }
    Enums: {
      buckettype: "STANDARD" | "ANALYTICS" | "VECTOR"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      abierta_por_actor: ["usuario", "conductor"],
      actor_auditoria: ["usuario", "conductor", "admin", "sistema"],
      actor_reporte: ["usuario", "conductor", "admin", "sistema"],
      angulo_evidencia: [
        "frente",
        "lado_piloto",
        "lado_copiloto",
        "trasera",
        "tablero",
        "dano_previo",
        "adicional",
      ],
      categoria_tarifa_vehiculo: ["ligero_a", "ligero_b", "mediano", "camion"],
      causa_fallido: [
        "imputable_cliente",
        "operativo",
        "fuerza_mayor",
        "documentacion",
        "vehiculo_no_circulable",
      ],
      certificacion_conductor: ["estandar", "tipo_b", "federal", "premium"],
      condicion_vehiculo: ["nueva", "seminueva", "rescate_mecanico"],
      dia_traslado: ["entre_semana", "fin_semana"],
      estado_conductor: [
        "activo",
        "suspendido_7d",
        "suspendido_14d",
        "suspendido_30d",
        "suspendido_indefinido",
        "bloqueado_permanente",
        "modo_prueba_supervisada",
        "pendiente_verificacion",
      ],
      estado_datos_bancarios_conductor: [
        "en_revision",
        "verificada",
        "rechazada",
      ],
      estado_disputa: [
        "abierta",
        "en_revision",
        "resuelta",
        "escalada",
        "resuelta_senior",
      ],
      estado_expediente_conductor: [
        "borrador",
        "correo_pendiente",
        "datos_incompletos",
        "documentos_pendientes",
        "listo_para_enviar",
        "en_revision",
        "requiere_correccion",
        "aprobado",
        "rechazado",
        "suspendido",
      ],
      estado_pago: ["pendiente", "completado", "reembolsado", "fallido"],
      estado_payout: ["pendiente", "procesado", "fallido"],
      estado_politica_tarifaria: ["borrador", "vigente", "archivada"],
      estado_reclamo_seguro: ["abierto", "en_revision", "resuelto"],
      estado_traslado: [
        "usuario_pendiente_verificacion",
        "usuario_verificado",
        "solicitud_creada",
        "documentacion_pendiente",
        "documentacion_en_revision",
        "documentacion_validada",
        "cotizacion_generada",
        "cotizacion_aceptada",
        "servicio_confirmado",
        "pendiente_de_conductor",
        "conductor_asignado",
        "conductor_en_camino_al_origen",
        "conductor_en_punto_de_recoleccion",
        "verificacion_vehiculo_en_proceso",
        "evidencia_inicial_en_proceso",
        "evidencia_inicial_completada",
        "vehiculo_recibido",
        "traslado_en_curso",
        "incidencia_reportada",
        "llegada_a_destino",
        "evidencia_final_en_proceso",
        "evidencia_final_completada",
        "entrega_confirmada",
        "pago_pendiente",
        "pago_completado",
        "servicio_cerrado",
        "servicio_cancelado",
        "traslado_fallido",
        "dano_no_reportado_en_revision",
        "reclamo_abierto",
        "reclamo_resuelto",
        "cierre_operativo_con_incidencia_abierta",
        "disputa_abierta",
        "disputa_resuelta",
      ],
      estado_verificacion: [
        "pendiente",
        "en_revision",
        "verificado",
        "rechazado",
      ],
      evento_auditable: [
        "creacion_cuenta",
        "verificacion_cuenta",
        "carga_documentos",
        "validacion_documentos",
        "creacion_solicitud_traslado",
        "generacion_cotizacion",
        "confirmacion_servicio",
        "asignacion_conductor",
        "aceptacion_traslado_conductor",
        "llegada_conductor_origen",
        "captura_evidencia_inicial",
        "confirmacion_vehiculo_recibido",
        "inicio_traslado",
        "reporte_incidencia",
        "llegada_destino",
        "captura_evidencia_final",
        "confirmacion_entrega",
        "registro_pago",
        "cierre_traslado",
        "cancelacion_traslado",
        "apertura_disputa",
        "resolucion_disputa",
        "apertura_reclamo_seguro",
        "resolucion_reclamo_seguro",
        "suspension_conductor",
        "modificacion_traslado_activo",
        "activacion_soporte_emergencia",
        "comunicacion_usuario_conductor",
        "calificacion_conductor",
        "exportacion_pasaporte_pdf",
        "asignacion_modo_prueba_supervisada",
        "resultado_modo_prueba_supervisada",
        "aceptacion_terminos",
        "carga_documento_identidad",
        "actualizacion_datos_bancarios_conductor",
      ],
      gama_vehiculo: ["entrada", "media", "alta", "premium"],
      horario_traslado: ["diurno", "nocturno"],
      momento_incidencia: [
        "recoleccion",
        "durante_traslado",
        "entrega",
        "post_cierre",
      ],
      momento_pago: ["anticipado", "al_cierre"],
      nivel_concer: ["basico", "ejecutivo", "luxury", "coleccion"],
      rango_distancia: ["rango_1", "rango_2", "rango_3", "rango_4"],
      remitente_chat: ["usuario", "conductor"],
      resolucion_disputa: ["favor_reclamante", "en_contra", "solucion_parcial"],
      rol_usuario: ["personal", "titular_empresa", "usuario_autorizado"],
      tipo_disputa: [
        "cobro_incorrecto",
        "cancelacion_fuera_de_politica",
        "dano_no_reconocido",
        "no_presentacion",
        "calificacion_injusta",
      ],
      tipo_documento_consentimiento: [
        "terminos_servicio",
        "aviso_privacidad",
        "autorizacion_antecedentes",
        "declaracion_suspensiones",
      ],
      tipo_evidencia: ["inicial", "final"],
      tipo_incidencia: [
        "vehiculo_no_enciende",
        "contacto_no_localizado",
        "documentacion_incompleta",
        "dano_previo_relevante",
        "colision_robo_asalto",
        "emergencia_medica_conductor",
        "descompostura_en_ruta",
        "infraccion_autoridad_vial",
        "conductor_enfermo",
        "perdida_conectividad",
        "dano_no_reportado",
      ],
      tipo_pago: ["anticipado", "al_cierre"],
      tipo_vehiculo: ["sedan", "suv", "pick_up", "van", "luxury", "coleccion"],
    },
  },
  storage: {
    Enums: {
      buckettype: ["STANDARD", "ANALYTICS", "VECTOR"],
    },
  },
} as const
