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
      admin_capacidades: {
        Row: {
          admin_id: string
          capacidad: string
          concedida: boolean
          creada_en: string
          motivo: string | null
          otorgada_por: string | null
        }
        Insert: {
          admin_id: string
          capacidad: string
          concedida?: boolean
          creada_en?: string
          motivo?: string | null
          otorgada_por?: string | null
        }
        Update: {
          admin_id?: string
          capacidad?: string
          concedida?: boolean
          creada_en?: string
          motivo?: string | null
          otorgada_por?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "admin_capacidades_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "admins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_capacidades_otorgada_por_fkey"
            columns: ["otorgada_por"]
            isOneToOne: false
            referencedRelation: "admins"
            referencedColumns: ["id"]
          },
        ]
      }
      admins: {
        Row: {
          auth_user_id: string | null
          creado_en: string
          id: string
          nombre: string
          rol_operativo: Database["public"]["Enums"]["rol_admin_operativo"]
        }
        Insert: {
          auth_user_id?: string | null
          creado_en?: string
          id?: string
          nombre: string
          rol_operativo?: Database["public"]["Enums"]["rol_admin_operativo"]
        }
        Update: {
          auth_user_id?: string | null
          creado_en?: string
          id?: string
          nombre?: string
          rol_operativo?: Database["public"]["Enums"]["rol_admin_operativo"]
        }
        Relationships: []
      }
      alertas_sla_historial: {
        Row: {
          accion: string
          admin_id: string | null
          alerta_id: string
          comentario: string | null
          creado_en: string
          datos: Json
          estado_anterior: string | null
          estado_nuevo: string | null
          id: string
          responsable_anterior: string | null
          responsable_nuevo: string | null
        }
        Insert: {
          accion: string
          admin_id?: string | null
          alerta_id: string
          comentario?: string | null
          creado_en?: string
          datos?: Json
          estado_anterior?: string | null
          estado_nuevo?: string | null
          id?: string
          responsable_anterior?: string | null
          responsable_nuevo?: string | null
        }
        Update: {
          accion?: string
          admin_id?: string | null
          alerta_id?: string
          comentario?: string | null
          creado_en?: string
          datos?: Json
          estado_anterior?: string | null
          estado_nuevo?: string | null
          id?: string
          responsable_anterior?: string | null
          responsable_nuevo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "alertas_sla_historial_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "admins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alertas_sla_historial_alerta_id_fkey"
            columns: ["alerta_id"]
            isOneToOne: false
            referencedRelation: "alertas_sla_operacionales"
            referencedColumns: ["id"]
          },
        ]
      }
      alertas_sla_operacionales: {
        Row: {
          actualizado_en: string
          acuse_en: string | null
          acuse_por_admin_id: string | null
          asignado_en: string | null
          asignado_por_admin_id: string | null
          categoria: string
          cerrado_en: string | null
          cerrado_por_admin_id: string | null
          creado_en: string
          dedupe_key: string
          descripcion: string
          entidad_id: string
          entidad_tipo: string
          escalado_en: string | null
          escalado_por_admin_id: string | null
          estado: string
          folio: string
          horas_limite: number
          horas_transcurridas: number
          id: string
          metadata: Json
          notificacion_estado: string
          origen_creado_en: string
          porcentaje_consumido: number
          prioridad: number
          regla_id: string | null
          responsable: string | null
          resuelto_en: string | null
          resuelto_por_admin_id: string | null
          severidad: string
          sla_restante_horas: number
          traslado_id: string | null
          vence_en: string
        }
        Insert: {
          actualizado_en?: string
          acuse_en?: string | null
          acuse_por_admin_id?: string | null
          asignado_en?: string | null
          asignado_por_admin_id?: string | null
          categoria: string
          cerrado_en?: string | null
          cerrado_por_admin_id?: string | null
          creado_en?: string
          dedupe_key: string
          descripcion: string
          entidad_id: string
          entidad_tipo: string
          escalado_en?: string | null
          escalado_por_admin_id?: string | null
          estado?: string
          folio: string
          horas_limite: number
          horas_transcurridas?: number
          id?: string
          metadata?: Json
          notificacion_estado?: string
          origen_creado_en: string
          porcentaje_consumido?: number
          prioridad?: number
          regla_id?: string | null
          responsable?: string | null
          resuelto_en?: string | null
          resuelto_por_admin_id?: string | null
          severidad: string
          sla_restante_horas: number
          traslado_id?: string | null
          vence_en: string
        }
        Update: {
          actualizado_en?: string
          acuse_en?: string | null
          acuse_por_admin_id?: string | null
          asignado_en?: string | null
          asignado_por_admin_id?: string | null
          categoria?: string
          cerrado_en?: string | null
          cerrado_por_admin_id?: string | null
          creado_en?: string
          dedupe_key?: string
          descripcion?: string
          entidad_id?: string
          entidad_tipo?: string
          escalado_en?: string | null
          escalado_por_admin_id?: string | null
          estado?: string
          folio?: string
          horas_limite?: number
          horas_transcurridas?: number
          id?: string
          metadata?: Json
          notificacion_estado?: string
          origen_creado_en?: string
          porcentaje_consumido?: number
          prioridad?: number
          regla_id?: string | null
          responsable?: string | null
          resuelto_en?: string | null
          resuelto_por_admin_id?: string | null
          severidad?: string
          sla_restante_horas?: number
          traslado_id?: string | null
          vence_en?: string
        }
        Relationships: [
          {
            foreignKeyName: "alertas_sla_operacionales_acuse_por_admin_id_fkey"
            columns: ["acuse_por_admin_id"]
            isOneToOne: false
            referencedRelation: "admins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alertas_sla_operacionales_asignado_por_admin_id_fkey"
            columns: ["asignado_por_admin_id"]
            isOneToOne: false
            referencedRelation: "admins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alertas_sla_operacionales_cerrado_por_admin_id_fkey"
            columns: ["cerrado_por_admin_id"]
            isOneToOne: false
            referencedRelation: "admins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alertas_sla_operacionales_escalado_por_admin_id_fkey"
            columns: ["escalado_por_admin_id"]
            isOneToOne: false
            referencedRelation: "admins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alertas_sla_operacionales_regla_id_fkey"
            columns: ["regla_id"]
            isOneToOne: false
            referencedRelation: "sla_reglas_operativas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alertas_sla_operacionales_resuelto_por_admin_id_fkey"
            columns: ["resuelto_por_admin_id"]
            isOneToOne: false
            referencedRelation: "admins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alertas_sla_operacionales_traslado_id_fkey"
            columns: ["traslado_id"]
            isOneToOne: false
            referencedRelation: "pasaporte_digital"
            referencedColumns: ["traslado_id"]
          },
          {
            foreignKeyName: "alertas_sla_operacionales_traslado_id_fkey"
            columns: ["traslado_id"]
            isOneToOne: false
            referencedRelation: "traslados"
            referencedColumns: ["id"]
          },
        ]
      }
      asignaciones: {
        Row: {
          aceptada_en: string | null
          actualizado_en: string
          asignada_en: string
          cancelada_en: string | null
          completada_en: string | null
          conductor_id: string
          creado_en: string
          estado: Database["public"]["Enums"]["estado_asignacion"]
          gestionada_por: string | null
          id: string
          iniciada_en: string | null
          metadata: Json
          motivo: string | null
          ofrecida_en: string | null
          origen: string
          puntaje: number | null
          rechazada_en: string | null
          traslado_id: string
        }
        Insert: {
          aceptada_en?: string | null
          actualizado_en?: string
          asignada_en?: string
          cancelada_en?: string | null
          completada_en?: string | null
          conductor_id: string
          creado_en?: string
          estado?: Database["public"]["Enums"]["estado_asignacion"]
          gestionada_por?: string | null
          id?: string
          iniciada_en?: string | null
          metadata?: Json
          motivo?: string | null
          ofrecida_en?: string | null
          origen?: string
          puntaje?: number | null
          rechazada_en?: string | null
          traslado_id: string
        }
        Update: {
          aceptada_en?: string | null
          actualizado_en?: string
          asignada_en?: string
          cancelada_en?: string | null
          completada_en?: string | null
          conductor_id?: string
          creado_en?: string
          estado?: Database["public"]["Enums"]["estado_asignacion"]
          gestionada_por?: string | null
          id?: string
          iniciada_en?: string | null
          metadata?: Json
          motivo?: string | null
          ofrecida_en?: string | null
          origen?: string
          puntaje?: number | null
          rechazada_en?: string | null
          traslado_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "asignaciones_conductor_id_fkey"
            columns: ["conductor_id"]
            isOneToOne: false
            referencedRelation: "conductores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asignaciones_traslado_id_fkey"
            columns: ["traslado_id"]
            isOneToOne: false
            referencedRelation: "pasaporte_digital"
            referencedColumns: ["traslado_id"]
          },
          {
            foreignKeyName: "asignaciones_traslado_id_fkey"
            columns: ["traslado_id"]
            isOneToOne: false
            referencedRelation: "traslados"
            referencedColumns: ["id"]
          },
        ]
      }
      auditoria_admin_seguridad: {
        Row: {
          accion: string | null
          admin_id: string | null
          auth_user_id: string | null
          creado_en: string
          datos: Json
          id: string
          motivo: string | null
          recurso: string
          rol: string | null
          tipo: string
        }
        Insert: {
          accion?: string | null
          admin_id?: string | null
          auth_user_id?: string | null
          creado_en?: string
          datos?: Json
          id?: string
          motivo?: string | null
          recurso: string
          rol?: string | null
          tipo: string
        }
        Update: {
          accion?: string | null
          admin_id?: string | null
          auth_user_id?: string | null
          creado_en?: string
          datos?: Json
          id?: string
          motivo?: string | null
          recurso?: string
          rol?: string | null
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "auditoria_admin_seguridad_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "admins"
            referencedColumns: ["id"]
          },
        ]
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
      cargas_traslados_masivos: {
        Row: {
          cancelado_en: string | null
          cancelado_por: string | null
          creado_en: string
          creado_por_admin_id: string | null
          empresa_id: string | null
          estado: string
          filas_creadas: number
          filas_error: number
          filas_procesadas: number
          finalizado_en: string | null
          hash_archivo: string | null
          id: string
          iniciado_en: string | null
          mensaje_estado: string | null
          mime_type: string | null
          nombre_archivo: string
          operation_id: string | null
          reporte_errores_csv: string | null
          tamano_bytes: number
          total_filas: number
          usuario_id: string
        }
        Insert: {
          cancelado_en?: string | null
          cancelado_por?: string | null
          creado_en?: string
          creado_por_admin_id?: string | null
          empresa_id?: string | null
          estado?: string
          filas_creadas?: number
          filas_error?: number
          filas_procesadas?: number
          finalizado_en?: string | null
          hash_archivo?: string | null
          id?: string
          iniciado_en?: string | null
          mensaje_estado?: string | null
          mime_type?: string | null
          nombre_archivo: string
          operation_id?: string | null
          reporte_errores_csv?: string | null
          tamano_bytes?: number
          total_filas?: number
          usuario_id: string
        }
        Update: {
          cancelado_en?: string | null
          cancelado_por?: string | null
          creado_en?: string
          creado_por_admin_id?: string | null
          empresa_id?: string | null
          estado?: string
          filas_creadas?: number
          filas_error?: number
          filas_procesadas?: number
          finalizado_en?: string | null
          hash_archivo?: string | null
          id?: string
          iniciado_en?: string | null
          mensaje_estado?: string | null
          mime_type?: string | null
          nombre_archivo?: string
          operation_id?: string | null
          reporte_errores_csv?: string | null
          tamano_bytes?: number
          total_filas?: number
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cargas_traslados_masivos_cancelado_por_fkey"
            columns: ["cancelado_por"]
            isOneToOne: false
            referencedRelation: "admins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cargas_traslados_masivos_creado_por_admin_id_fkey"
            columns: ["creado_por_admin_id"]
            isOneToOne: false
            referencedRelation: "admins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cargas_traslados_masivos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cargas_traslados_masivos_operation_id_fkey"
            columns: ["operation_id"]
            isOneToOne: false
            referencedRelation: "operaciones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cargas_traslados_masivos_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
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
      certificaciones_operativas_conductor: {
        Row: {
          conductor_id: string
          creada_en: string
          id: string
          revocada_en: string | null
          tipo: string
          vigente_desde: string
          vigente_hasta: string | null
        }
        Insert: {
          conductor_id: string
          creada_en?: string
          id?: string
          revocada_en?: string | null
          tipo: string
          vigente_desde?: string
          vigente_hasta?: string | null
        }
        Update: {
          conductor_id?: string
          creada_en?: string
          id?: string
          revocada_en?: string | null
          tipo?: string
          vigente_desde?: string
          vigente_hasta?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "certificaciones_operativas_conductor_conductor_id_fkey"
            columns: ["conductor_id"]
            isOneToOne: false
            referencedRelation: "conductores"
            referencedColumns: ["id"]
          },
        ]
      }
      claves_idempotencia: {
        Row: {
          clave: string
          creado_en: string
          entidad: string
          entidad_id: string | null
          expira_en: string
          id: string
          resultado: Json | null
        }
        Insert: {
          clave: string
          creado_en?: string
          entidad: string
          entidad_id?: string | null
          expira_en?: string
          id?: string
          resultado?: Json | null
        }
        Update: {
          clave?: string
          creado_en?: string
          entidad?: string
          entidad_id?: string | null
          expira_en?: string
          id?: string
          resultado?: Json | null
        }
        Relationships: []
      }
      competencias_asignacion: {
        Row: {
          abierta_en: string
          cierra_en: string
          conductor_seleccionado_id: string | null
          detalle_resolucion: Json
          estado: string
          id: string
          politica_version: number
          resuelta_en: string | null
          traslado_id: string
        }
        Insert: {
          abierta_en?: string
          cierra_en: string
          conductor_seleccionado_id?: string | null
          detalle_resolucion?: Json
          estado?: string
          id?: string
          politica_version: number
          resuelta_en?: string | null
          traslado_id: string
        }
        Update: {
          abierta_en?: string
          cierra_en?: string
          conductor_seleccionado_id?: string | null
          detalle_resolucion?: Json
          estado?: string
          id?: string
          politica_version?: number
          resuelta_en?: string | null
          traslado_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "competencias_asignacion_conductor_seleccionado_id_fkey"
            columns: ["conductor_seleccionado_id"]
            isOneToOne: false
            referencedRelation: "conductores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "competencias_asignacion_traslado_id_fkey"
            columns: ["traslado_id"]
            isOneToOne: false
            referencedRelation: "pasaporte_digital"
            referencedColumns: ["traslado_id"]
          },
          {
            foreignKeyName: "competencias_asignacion_traslado_id_fkey"
            columns: ["traslado_id"]
            isOneToOne: false
            referencedRelation: "traslados"
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
          certificacion_pago: Database["public"]["Enums"]["certificacion_conductor"]
          ciudad_municipio: string | null
          codigo_postal: string | null
          colonia: string | null
          contacto_emergencia_nombre: string | null
          contacto_emergencia_telefono: string | null
          creado_en: string
          curp: string | null
          declara_sin_suspensiones: boolean
          documentos_vigentes: boolean
          empresa_id: string | null
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
          version: number
          version_terminos_aceptada: number | null
        }
        Insert: {
          actualizado_en?: string
          auth_user_id?: string | null
          autoriza_verificacion_antecedentes?: boolean
          calificacion_promedio?: number
          calle?: string | null
          cancelaciones_sin_justificacion_count?: number
          certificacion_pago?: Database["public"]["Enums"]["certificacion_conductor"]
          ciudad_municipio?: string | null
          codigo_postal?: string | null
          colonia?: string | null
          contacto_emergencia_nombre?: string | null
          contacto_emergencia_telefono?: string | null
          creado_en?: string
          curp?: string | null
          declara_sin_suspensiones?: boolean
          documentos_vigentes?: boolean
          empresa_id?: string | null
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
          version?: number
          version_terminos_aceptada?: number | null
        }
        Update: {
          actualizado_en?: string
          auth_user_id?: string | null
          autoriza_verificacion_antecedentes?: boolean
          calificacion_promedio?: number
          calle?: string | null
          cancelaciones_sin_justificacion_count?: number
          certificacion_pago?: Database["public"]["Enums"]["certificacion_conductor"]
          ciudad_municipio?: string | null
          codigo_postal?: string | null
          colonia?: string | null
          contacto_emergencia_nombre?: string | null
          contacto_emergencia_telefono?: string | null
          creado_en?: string
          curp?: string | null
          declara_sin_suspensiones?: boolean
          documentos_vigentes?: boolean
          empresa_id?: string | null
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
          version?: number
          version_terminos_aceptada?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "conductores_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      configuracion_admin: {
        Row: {
          actualizada_en: string
          actualizada_por: string | null
          categoria: string
          clave: string
          descripcion: string
          nombre: string
          valor: Json
          version: number
        }
        Insert: {
          actualizada_en?: string
          actualizada_por?: string | null
          categoria: string
          clave: string
          descripcion?: string
          nombre: string
          valor?: Json
          version?: number
        }
        Update: {
          actualizada_en?: string
          actualizada_por?: string | null
          categoria?: string
          clave?: string
          descripcion?: string
          nombre?: string
          valor?: Json
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "configuracion_admin_actualizada_por_fkey"
            columns: ["actualizada_por"]
            isOneToOne: false
            referencedRelation: "admins"
            referencedColumns: ["id"]
          },
        ]
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
      cotizaciones: {
        Row: {
          aceptada_en: string | null
          emitida_en: string
          emitida_por_admin_id: string | null
          estado: string
          expira_en: string | null
          id: string
          moneda: string
          politica_tarifa_version: number | null
          precio: number
          reglas_snapshot: Json
          traslado_id: string
          version: number
        }
        Insert: {
          aceptada_en?: string | null
          emitida_en?: string
          emitida_por_admin_id?: string | null
          estado?: string
          expira_en?: string | null
          id?: string
          moneda?: string
          politica_tarifa_version?: number | null
          precio: number
          reglas_snapshot?: Json
          traslado_id: string
          version: number
        }
        Update: {
          aceptada_en?: string | null
          emitida_en?: string
          emitida_por_admin_id?: string | null
          estado?: string
          expira_en?: string | null
          id?: string
          moneda?: string
          politica_tarifa_version?: number | null
          precio?: number
          reglas_snapshot?: Json
          traslado_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "cotizaciones_emitida_por_admin_id_fkey"
            columns: ["emitida_por_admin_id"]
            isOneToOne: false
            referencedRelation: "admins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cotizaciones_politica_tarifa_version_fkey"
            columns: ["politica_tarifa_version"]
            isOneToOne: false
            referencedRelation: "tarifas_politica_versiones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cotizaciones_traslado_id_fkey"
            columns: ["traslado_id"]
            isOneToOne: false
            referencedRelation: "pasaporte_digital"
            referencedColumns: ["traslado_id"]
          },
          {
            foreignKeyName: "cotizaciones_traslado_id_fkey"
            columns: ["traslado_id"]
            isOneToOne: false
            referencedRelation: "traslados"
            referencedColumns: ["id"]
          },
        ]
      }
      custodia_evento_fotos: {
        Row: {
          evento_id: string
          foto_id: string
        }
        Insert: {
          evento_id: string
          foto_id: string
        }
        Update: {
          evento_id?: string
          foto_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "custodia_evento_fotos_evento_id_fkey"
            columns: ["evento_id"]
            isOneToOne: false
            referencedRelation: "custodia_eventos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "custodia_evento_fotos_foto_id_fkey"
            columns: ["foto_id"]
            isOneToOne: false
            referencedRelation: "evidencia_fotos"
            referencedColumns: ["id"]
          },
        ]
      }
      custodia_eventos: {
        Row: {
          actor_id: string | null
          actor_tipo: string
          combustible: string | null
          creado_en: string
          firma_metodo: string | null
          firma_referencia: string | null
          hash_cadena: string
          id: string
          inspeccion_id: string | null
          lat: number | null
          lng: number | null
          metadata: Json
          n_orden: number
          notas: string | null
          ocurrido_en: string
          odometro: number | null
          pin_verificado: boolean
          prev_hash: string
          tipo: Database["public"]["Enums"]["tipo_evento_custodia"]
          traslado_id: string
          vehiculo_id: string | null
        }
        Insert: {
          actor_id?: string | null
          actor_tipo?: string
          combustible?: string | null
          creado_en?: string
          firma_metodo?: string | null
          firma_referencia?: string | null
          hash_cadena?: string
          id?: string
          inspeccion_id?: string | null
          lat?: number | null
          lng?: number | null
          metadata?: Json
          n_orden?: never
          notas?: string | null
          ocurrido_en?: string
          odometro?: number | null
          pin_verificado?: boolean
          prev_hash?: string
          tipo: Database["public"]["Enums"]["tipo_evento_custodia"]
          traslado_id: string
          vehiculo_id?: string | null
        }
        Update: {
          actor_id?: string | null
          actor_tipo?: string
          combustible?: string | null
          creado_en?: string
          firma_metodo?: string | null
          firma_referencia?: string | null
          hash_cadena?: string
          id?: string
          inspeccion_id?: string | null
          lat?: number | null
          lng?: number | null
          metadata?: Json
          n_orden?: never
          notas?: string | null
          ocurrido_en?: string
          odometro?: number | null
          pin_verificado?: boolean
          prev_hash?: string
          tipo?: Database["public"]["Enums"]["tipo_evento_custodia"]
          traslado_id?: string
          vehiculo_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "custodia_eventos_inspeccion_id_fkey"
            columns: ["inspeccion_id"]
            isOneToOne: false
            referencedRelation: "evidencia_inspecciones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "custodia_eventos_traslado_id_fkey"
            columns: ["traslado_id"]
            isOneToOne: false
            referencedRelation: "pasaporte_digital"
            referencedColumns: ["traslado_id"]
          },
          {
            foreignKeyName: "custodia_eventos_traslado_id_fkey"
            columns: ["traslado_id"]
            isOneToOne: false
            referencedRelation: "traslados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "custodia_eventos_vehiculo_id_fkey"
            columns: ["vehiculo_id"]
            isOneToOne: false
            referencedRelation: "vehiculos"
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
          numero_tarjeta: string | null
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
          numero_tarjeta?: string | null
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
          numero_tarjeta?: string | null
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
      dispositivos_push: {
        Row: {
          activo: boolean
          actualizado_en: string
          creado_en: string
          device_id: string
          id: string
          modelo: string | null
          plataforma: string
          token_push: string
          ultimo_acceso: string
          usuario_id: string
          version_app: string | null
          version_so: string | null
        }
        Insert: {
          activo?: boolean
          actualizado_en?: string
          creado_en?: string
          device_id: string
          id?: string
          modelo?: string | null
          plataforma: string
          token_push: string
          ultimo_acceso?: string
          usuario_id: string
          version_app?: string | null
          version_so?: string | null
        }
        Update: {
          activo?: boolean
          actualizado_en?: string
          creado_en?: string
          device_id?: string
          id?: string
          modelo?: string | null
          plataforma?: string
          token_push?: string
          ultimo_acceso?: string
          usuario_id?: string
          version_app?: string | null
          version_so?: string | null
        }
        Relationships: []
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
          expira_en: string | null
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
          expira_en?: string | null
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
          expira_en?: string | null
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
      empresa_miembros: {
        Row: {
          actualizado_en: string
          creado_en: string
          empresa_id: string
          estado: string
          id: string
          invitado_por: string | null
          rol_clave: string
          usuario_id: string
        }
        Insert: {
          actualizado_en?: string
          creado_en?: string
          empresa_id: string
          estado?: string
          id?: string
          invitado_por?: string | null
          rol_clave: string
          usuario_id: string
        }
        Update: {
          actualizado_en?: string
          creado_en?: string
          empresa_id?: string
          estado?: string
          id?: string
          invitado_por?: string | null
          rol_clave?: string
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "empresa_miembros_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "empresa_miembros_invitado_por_fkey"
            columns: ["invitado_por"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "empresa_miembros_rol_clave_fkey"
            columns: ["rol_clave"]
            isOneToOne: false
            referencedRelation: "empresa_roles"
            referencedColumns: ["clave"]
          },
          {
            foreignKeyName: "empresa_miembros_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      empresa_rol_permisos: {
        Row: {
          permiso: string
          rol_clave: string
        }
        Insert: {
          permiso: string
          rol_clave: string
        }
        Update: {
          permiso?: string
          rol_clave?: string
        }
        Relationships: [
          {
            foreignKeyName: "empresa_rol_permisos_rol_clave_fkey"
            columns: ["rol_clave"]
            isOneToOne: false
            referencedRelation: "empresa_roles"
            referencedColumns: ["clave"]
          },
        ]
      }
      empresa_roles: {
        Row: {
          clave: string
          descripcion: string | null
          es_sistema: boolean
          nombre: string
        }
        Insert: {
          clave: string
          descripcion?: string | null
          es_sistema?: boolean
          nombre: string
        }
        Update: {
          clave?: string
          descripcion?: string | null
          es_sistema?: boolean
          nombre?: string
        }
        Relationships: []
      }
      empresa_sucursales: {
        Row: {
          activo: boolean
          actualizado_en: string
          calle: string | null
          ciudad: string | null
          codigo_postal: string | null
          colonia: string | null
          contacto_nombre: string | null
          contacto_telefono: string | null
          creado_en: string
          direccion: string | null
          empresa_id: string
          es_principal: boolean
          estado: string | null
          id: string
          lat: number | null
          lng: number | null
          nombre: string
          numero: string | null
          referencias: string | null
        }
        Insert: {
          activo?: boolean
          actualizado_en?: string
          calle?: string | null
          ciudad?: string | null
          codigo_postal?: string | null
          colonia?: string | null
          contacto_nombre?: string | null
          contacto_telefono?: string | null
          creado_en?: string
          direccion?: string | null
          empresa_id: string
          es_principal?: boolean
          estado?: string | null
          id?: string
          lat?: number | null
          lng?: number | null
          nombre: string
          numero?: string | null
          referencias?: string | null
        }
        Update: {
          activo?: boolean
          actualizado_en?: string
          calle?: string | null
          ciudad?: string | null
          codigo_postal?: string | null
          colonia?: string | null
          contacto_nombre?: string | null
          contacto_telefono?: string | null
          creado_en?: string
          direccion?: string | null
          empresa_id?: string
          es_principal?: boolean
          estado?: string | null
          id?: string
          lat?: number | null
          lng?: number | null
          nombre?: string
          numero?: string | null
          referencias?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "empresa_sucursales_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      empresas: {
        Row: {
          actualizado_en: string
          codigo_postal_fiscal: string | null
          condiciones_pago: string | null
          correo_facturacion: string | null
          creado_en: string
          credito_disponible_mxn: number
          dias_credito: number
          estado_operativo: string
          estado_verificacion: Database["public"]["Enums"]["estado_verificacion"]
          id: string
          limite_credito_mxn: number
          motivo_suspension: string | null
          nombre: string
          razon_social: string | null
          regimen_fiscal: string | null
          requiere_orden_compra: boolean
          rfc: string | null
          suspendida_en: string | null
          suspendida_por: string | null
          uso_cfdi: string | null
        }
        Insert: {
          actualizado_en?: string
          codigo_postal_fiscal?: string | null
          condiciones_pago?: string | null
          correo_facturacion?: string | null
          creado_en?: string
          credito_disponible_mxn?: number
          dias_credito?: number
          estado_operativo?: string
          estado_verificacion?: Database["public"]["Enums"]["estado_verificacion"]
          id?: string
          limite_credito_mxn?: number
          motivo_suspension?: string | null
          nombre: string
          razon_social?: string | null
          regimen_fiscal?: string | null
          requiere_orden_compra?: boolean
          rfc?: string | null
          suspendida_en?: string | null
          suspendida_por?: string | null
          uso_cfdi?: string | null
        }
        Update: {
          actualizado_en?: string
          codigo_postal_fiscal?: string | null
          condiciones_pago?: string | null
          correo_facturacion?: string | null
          creado_en?: string
          credito_disponible_mxn?: number
          dias_credito?: number
          estado_operativo?: string
          estado_verificacion?: Database["public"]["Enums"]["estado_verificacion"]
          id?: string
          limite_credito_mxn?: number
          motivo_suspension?: string | null
          nombre?: string
          razon_social?: string | null
          regimen_fiscal?: string | null
          requiere_orden_compra?: boolean
          rfc?: string | null
          suspendida_en?: string | null
          suspendida_por?: string | null
          uso_cfdi?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "empresas_suspendida_por_fkey"
            columns: ["suspendida_por"]
            isOneToOne: false
            referencedRelation: "admins"
            referencedColumns: ["id"]
          },
        ]
      }
      empresas_cambios_sensibles: {
        Row: {
          aprobado_por: string | null
          comentario_resolucion: string | null
          datos_anteriores: Json
          datos_propuestos: Json
          empresa_id: string
          estado: string
          id: string
          motivo: string
          resuelto_en: string | null
          solicitado_en: string
          solicitado_por: string
          tipo: string
        }
        Insert: {
          aprobado_por?: string | null
          comentario_resolucion?: string | null
          datos_anteriores?: Json
          datos_propuestos?: Json
          empresa_id: string
          estado?: string
          id?: string
          motivo: string
          resuelto_en?: string | null
          solicitado_en?: string
          solicitado_por: string
          tipo: string
        }
        Update: {
          aprobado_por?: string | null
          comentario_resolucion?: string | null
          datos_anteriores?: Json
          datos_propuestos?: Json
          empresa_id?: string
          estado?: string
          id?: string
          motivo?: string
          resuelto_en?: string | null
          solicitado_en?: string
          solicitado_por?: string
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "empresas_cambios_sensibles_aprobado_por_fkey"
            columns: ["aprobado_por"]
            isOneToOne: false
            referencedRelation: "admins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "empresas_cambios_sensibles_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "empresas_cambios_sensibles_solicitado_por_fkey"
            columns: ["solicitado_por"]
            isOneToOne: false
            referencedRelation: "admins"
            referencedColumns: ["id"]
          },
        ]
      }
      empresas_condiciones_comerciales_versiones: {
        Row: {
          aprobado_por: string | null
          cambio_sensible_id: string | null
          condiciones_pago: string | null
          creado_en: string
          creado_por: string | null
          credito_disponible_mxn: number
          dias_credito: number
          empresa_id: string
          id: string
          limite_credito_mxn: number
          requiere_orden_compra: boolean
          version: number
          vigente_desde: string
          vigente_hasta: string | null
        }
        Insert: {
          aprobado_por?: string | null
          cambio_sensible_id?: string | null
          condiciones_pago?: string | null
          creado_en?: string
          creado_por?: string | null
          credito_disponible_mxn?: number
          dias_credito?: number
          empresa_id: string
          id?: string
          limite_credito_mxn?: number
          requiere_orden_compra?: boolean
          version: number
          vigente_desde?: string
          vigente_hasta?: string | null
        }
        Update: {
          aprobado_por?: string | null
          cambio_sensible_id?: string | null
          condiciones_pago?: string | null
          creado_en?: string
          creado_por?: string | null
          credito_disponible_mxn?: number
          dias_credito?: number
          empresa_id?: string
          id?: string
          limite_credito_mxn?: number
          requiere_orden_compra?: boolean
          version?: number
          vigente_desde?: string
          vigente_hasta?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "empresas_condiciones_cambio_fkey"
            columns: ["cambio_sensible_id"]
            isOneToOne: false
            referencedRelation: "empresas_cambios_sensibles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "empresas_condiciones_comerciales_versiones_aprobado_por_fkey"
            columns: ["aprobado_por"]
            isOneToOne: false
            referencedRelation: "admins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "empresas_condiciones_comerciales_versiones_creado_por_fkey"
            columns: ["creado_por"]
            isOneToOne: false
            referencedRelation: "admins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "empresas_condiciones_comerciales_versiones_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      empresas_datos_fiscales_versiones: {
        Row: {
          aprobado_por: string | null
          cambio_sensible_id: string | null
          codigo_postal_fiscal: string | null
          correo_facturacion: string | null
          creado_en: string
          creado_por: string | null
          empresa_id: string
          id: string
          razon_social: string | null
          regimen_fiscal: string | null
          rfc: string
          uso_cfdi: string | null
          version: number
          vigente_desde: string
          vigente_hasta: string | null
        }
        Insert: {
          aprobado_por?: string | null
          cambio_sensible_id?: string | null
          codigo_postal_fiscal?: string | null
          correo_facturacion?: string | null
          creado_en?: string
          creado_por?: string | null
          empresa_id: string
          id?: string
          razon_social?: string | null
          regimen_fiscal?: string | null
          rfc: string
          uso_cfdi?: string | null
          version: number
          vigente_desde?: string
          vigente_hasta?: string | null
        }
        Update: {
          aprobado_por?: string | null
          cambio_sensible_id?: string | null
          codigo_postal_fiscal?: string | null
          correo_facturacion?: string | null
          creado_en?: string
          creado_por?: string | null
          empresa_id?: string
          id?: string
          razon_social?: string | null
          regimen_fiscal?: string | null
          rfc?: string
          uso_cfdi?: string | null
          version?: number
          vigente_desde?: string
          vigente_hasta?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "empresas_datos_fiscales_cambio_fkey"
            columns: ["cambio_sensible_id"]
            isOneToOne: false
            referencedRelation: "empresas_cambios_sensibles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "empresas_datos_fiscales_versiones_aprobado_por_fkey"
            columns: ["aprobado_por"]
            isOneToOne: false
            referencedRelation: "admins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "empresas_datos_fiscales_versiones_creado_por_fkey"
            columns: ["creado_por"]
            isOneToOne: false
            referencedRelation: "admins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "empresas_datos_fiscales_versiones_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      empresas_documentos: {
        Row: {
          actualizado_en: string
          creado_en: string
          creado_por: string | null
          empresa_id: string
          estado: Database["public"]["Enums"]["estado_verificacion"]
          folio: string | null
          id: string
          nombre: string
          notas: string | null
          revisado_por: string | null
          tipo: string
          url: string | null
          vigente_desde: string | null
          vigente_hasta: string | null
        }
        Insert: {
          actualizado_en?: string
          creado_en?: string
          creado_por?: string | null
          empresa_id: string
          estado?: Database["public"]["Enums"]["estado_verificacion"]
          folio?: string | null
          id?: string
          nombre: string
          notas?: string | null
          revisado_por?: string | null
          tipo: string
          url?: string | null
          vigente_desde?: string | null
          vigente_hasta?: string | null
        }
        Update: {
          actualizado_en?: string
          creado_en?: string
          creado_por?: string | null
          empresa_id?: string
          estado?: Database["public"]["Enums"]["estado_verificacion"]
          folio?: string | null
          id?: string
          nombre?: string
          notas?: string | null
          revisado_por?: string | null
          tipo?: string
          url?: string | null
          vigente_desde?: string | null
          vigente_hasta?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "empresas_documentos_creado_por_fkey"
            columns: ["creado_por"]
            isOneToOne: false
            referencedRelation: "admins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "empresas_documentos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "empresas_documentos_revisado_por_fkey"
            columns: ["revisado_por"]
            isOneToOne: false
            referencedRelation: "admins"
            referencedColumns: ["id"]
          },
        ]
      }
      estado_operativo_transiciones_validas: {
        Row: {
          estado_actual: Database["public"]["Enums"]["estado_operativo_traslado"]
          estado_siguiente: Database["public"]["Enums"]["estado_operativo_traslado"]
        }
        Insert: {
          estado_actual: Database["public"]["Enums"]["estado_operativo_traslado"]
          estado_siguiente: Database["public"]["Enums"]["estado_operativo_traslado"]
        }
        Update: {
          estado_actual?: Database["public"]["Enums"]["estado_operativo_traslado"]
          estado_siguiente?: Database["public"]["Enums"]["estado_operativo_traslado"]
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
      eventos_observabilidad: {
        Row: {
          creado_en: string
          datos: Json
          duracion_ms: number | null
          id: number
          nivel: string
          nombre: string
          servicio: string
          trace_id: string | null
        }
        Insert: {
          creado_en?: string
          datos?: Json
          duracion_ms?: number | null
          id?: number
          nivel: string
          nombre: string
          servicio: string
          trace_id?: string | null
        }
        Update: {
          creado_en?: string
          datos?: Json
          duracion_ms?: number | null
          id?: number
          nivel?: string
          nombre?: string
          servicio?: string
          trace_id?: string | null
        }
        Relationships: []
      }
      eventos_operativos_app: {
        Row: {
          creado_en: string
          detalle: Json
          id: string
          plataforma: string
          tipo: string
          usuario_id: string | null
          version_app: string
        }
        Insert: {
          creado_en?: string
          detalle?: Json
          id?: string
          plataforma?: string
          tipo: string
          usuario_id?: string | null
          version_app: string
        }
        Update: {
          creado_en?: string
          detalle?: Json
          id?: string
          plataforma?: string
          tipo?: string
          usuario_id?: string | null
          version_app?: string
        }
        Relationships: []
      }
      eventos_registro_conductor: {
        Row: {
          auth_user_id: string | null
          codigo: string | null
          creado_en: string
          duracion_ms: number | null
          empresa_id: string | null
          evento: string
          fuente: string | null
          id: string
          paso: number | null
          recibido_en: string
          sesion_id: string
          solicitud_id: string | null
          zona: string | null
        }
        Insert: {
          auth_user_id?: string | null
          codigo?: string | null
          creado_en?: string
          duracion_ms?: number | null
          empresa_id?: string | null
          evento: string
          fuente?: string | null
          id?: string
          paso?: number | null
          recibido_en?: string
          sesion_id: string
          solicitud_id?: string | null
          zona?: string | null
        }
        Update: {
          auth_user_id?: string | null
          codigo?: string | null
          creado_en?: string
          duracion_ms?: number | null
          empresa_id?: string | null
          evento?: string
          fuente?: string | null
          id?: string
          paso?: number | null
          recibido_en?: string
          sesion_id?: string
          solicitud_id?: string | null
          zona?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "eventos_registro_conductor_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
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
      exportaciones_admin: {
        Row: {
          admin_id: string
          completada_en: string | null
          creada_en: string
          error_codigo: string | null
          estado: string
          filas: number
          filtros: Json
          formato: string
          hash_sha256: string | null
          id: string
          recurso: string
        }
        Insert: {
          admin_id: string
          completada_en?: string | null
          creada_en?: string
          error_codigo?: string | null
          estado?: string
          filas?: number
          filtros?: Json
          formato: string
          hash_sha256?: string | null
          id?: string
          recurso: string
        }
        Update: {
          admin_id?: string
          completada_en?: string | null
          creada_en?: string
          error_codigo?: string | null
          estado?: string
          filas?: number
          filtros?: Json
          formato?: string
          hash_sha256?: string | null
          id?: string
          recurso?: string
        }
        Relationships: [
          {
            foreignKeyName: "exportaciones_admin_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "admins"
            referencedColumns: ["id"]
          },
        ]
      }
      feature_flags_app: {
        Row: {
          actualizado_en: string
          clave: string
          descripcion: string | null
          habilitada: boolean
          porcentaje_rollout: number
          versiones_permitidas: string[]
        }
        Insert: {
          actualizado_en?: string
          clave: string
          descripcion?: string | null
          habilitada?: boolean
          porcentaje_rollout?: number
          versiones_permitidas?: string[]
        }
        Update: {
          actualizado_en?: string
          clave?: string
          descripcion?: string | null
          habilitada?: boolean
          porcentaje_rollout?: number
          versiones_permitidas?: string[]
        }
        Relationships: []
      }
      filas_carga_traslados_masivos: {
        Row: {
          carga_id: string
          clave_idempotencia: string | null
          creado_en: string
          datos: Json
          errores: string[]
          estado: string
          hash_fila: string | null
          id: string
          numero_fila: number
          procesado_en: string | null
          referencia_externa: string | null
          sucursal_destino_id: string | null
          sucursal_origen_id: string | null
          traslado_id: string | null
          vehiculo_id: string | null
        }
        Insert: {
          carga_id: string
          clave_idempotencia?: string | null
          creado_en?: string
          datos: Json
          errores?: string[]
          estado: string
          hash_fila?: string | null
          id?: string
          numero_fila: number
          procesado_en?: string | null
          referencia_externa?: string | null
          sucursal_destino_id?: string | null
          sucursal_origen_id?: string | null
          traslado_id?: string | null
          vehiculo_id?: string | null
        }
        Update: {
          carga_id?: string
          clave_idempotencia?: string | null
          creado_en?: string
          datos?: Json
          errores?: string[]
          estado?: string
          hash_fila?: string | null
          id?: string
          numero_fila?: number
          procesado_en?: string | null
          referencia_externa?: string | null
          sucursal_destino_id?: string | null
          sucursal_origen_id?: string | null
          traslado_id?: string | null
          vehiculo_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "filas_carga_traslados_masivos_carga_id_fkey"
            columns: ["carga_id"]
            isOneToOne: false
            referencedRelation: "cargas_traslados_masivos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "filas_carga_traslados_masivos_sucursal_destino_id_fkey"
            columns: ["sucursal_destino_id"]
            isOneToOne: false
            referencedRelation: "empresa_sucursales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "filas_carga_traslados_masivos_sucursal_origen_id_fkey"
            columns: ["sucursal_origen_id"]
            isOneToOne: false
            referencedRelation: "empresa_sucursales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "filas_carga_traslados_masivos_traslado_id_fkey"
            columns: ["traslado_id"]
            isOneToOne: false
            referencedRelation: "pasaporte_digital"
            referencedColumns: ["traslado_id"]
          },
          {
            foreignKeyName: "filas_carga_traslados_masivos_traslado_id_fkey"
            columns: ["traslado_id"]
            isOneToOne: false
            referencedRelation: "traslados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "filas_carga_traslados_masivos_vehiculo_id_fkey"
            columns: ["vehiculo_id"]
            isOneToOne: false
            referencedRelation: "vehiculos"
            referencedColumns: ["id"]
          },
        ]
      }
      gastos_traslado: {
        Row: {
          comprobante_ruta: string | null
          descripcion: string | null
          id: string
          monto: number
          registrado_en: string
          registrado_por: string | null
          tipo: string
          traslado_id: string
        }
        Insert: {
          comprobante_ruta?: string | null
          descripcion?: string | null
          id?: string
          monto: number
          registrado_en?: string
          registrado_por?: string | null
          tipo: string
          traslado_id: string
        }
        Update: {
          comprobante_ruta?: string | null
          descripcion?: string | null
          id?: string
          monto?: number
          registrado_en?: string
          registrado_por?: string | null
          tipo?: string
          traslado_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "gastos_traslado_registrado_por_fkey"
            columns: ["registrado_por"]
            isOneToOne: false
            referencedRelation: "admins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gastos_traslado_traslado_id_fkey"
            columns: ["traslado_id"]
            isOneToOne: false
            referencedRelation: "pasaporte_digital"
            referencedColumns: ["traslado_id"]
          },
          {
            foreignKeyName: "gastos_traslado_traslado_id_fkey"
            columns: ["traslado_id"]
            isOneToOne: false
            referencedRelation: "traslados"
            referencedColumns: ["id"]
          },
        ]
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
      historial_estados_traslado: {
        Row: {
          actor_id: string | null
          actor_tipo: string
          creado_en: string
          estado_anterior: Database["public"]["Enums"]["estado_traslado"]
          estado_nuevo: Database["public"]["Enums"]["estado_traslado"]
          id: string
          metadata: Json
          motivo: string | null
          operativo_anterior: Database["public"]["Enums"]["estado_operativo_traslado"]
          operativo_nuevo: Database["public"]["Enums"]["estado_operativo_traslado"]
          traslado_id: string
        }
        Insert: {
          actor_id?: string | null
          actor_tipo?: string
          creado_en?: string
          estado_anterior: Database["public"]["Enums"]["estado_traslado"]
          estado_nuevo: Database["public"]["Enums"]["estado_traslado"]
          id?: string
          metadata?: Json
          motivo?: string | null
          operativo_anterior: Database["public"]["Enums"]["estado_operativo_traslado"]
          operativo_nuevo: Database["public"]["Enums"]["estado_operativo_traslado"]
          traslado_id: string
        }
        Update: {
          actor_id?: string | null
          actor_tipo?: string
          creado_en?: string
          estado_anterior?: Database["public"]["Enums"]["estado_traslado"]
          estado_nuevo?: Database["public"]["Enums"]["estado_traslado"]
          id?: string
          metadata?: Json
          motivo?: string | null
          operativo_anterior?: Database["public"]["Enums"]["estado_operativo_traslado"]
          operativo_nuevo?: Database["public"]["Enums"]["estado_operativo_traslado"]
          traslado_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "historial_estados_traslado_traslado_id_fkey"
            columns: ["traslado_id"]
            isOneToOne: false
            referencedRelation: "pasaporte_digital"
            referencedColumns: ["traslado_id"]
          },
          {
            foreignKeyName: "historial_estados_traslado_traslado_id_fkey"
            columns: ["traslado_id"]
            isOneToOne: false
            referencedRelation: "traslados"
            referencedColumns: ["id"]
          },
        ]
      }
      incidencia_evidencia_fotos: {
        Row: {
          foto_id: string
          incidencia_id: string
        }
        Insert: {
          foto_id: string
          incidencia_id: string
        }
        Update: {
          foto_id?: string
          incidencia_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "incidencia_evidencia_fotos_foto_id_fkey"
            columns: ["foto_id"]
            isOneToOne: false
            referencedRelation: "evidencia_fotos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incidencia_evidencia_fotos_incidencia_id_fkey"
            columns: ["incidencia_id"]
            isOneToOne: false
            referencedRelation: "incidencias"
            referencedColumns: ["id"]
          },
        ]
      }
      incidencia_historial: {
        Row: {
          accion: string
          actor: string
          actor_id: string | null
          creado_en: string
          estado_anterior: string | null
          estado_nuevo: string | null
          id: string
          incidencia_id: string
          motivo: string | null
        }
        Insert: {
          accion: string
          actor?: string
          actor_id?: string | null
          creado_en?: string
          estado_anterior?: string | null
          estado_nuevo?: string | null
          id?: string
          incidencia_id: string
          motivo?: string | null
        }
        Update: {
          accion?: string
          actor?: string
          actor_id?: string | null
          creado_en?: string
          estado_anterior?: string | null
          estado_nuevo?: string | null
          id?: string
          incidencia_id?: string
          motivo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "incidencia_historial_incidencia_id_fkey"
            columns: ["incidencia_id"]
            isOneToOne: false
            referencedRelation: "incidencias"
            referencedColumns: ["id"]
          },
        ]
      }
      incidencias: {
        Row: {
          asignada_en: string | null
          creada_en: string
          descripcion: string
          escalada_en: string | null
          estado: string
          id: string
          momento: Database["public"]["Enums"]["momento_incidencia"]
          nivel_escalamiento: number
          reportada_por: Database["public"]["Enums"]["actor_reporte"]
          responsable_admin_id: string | null
          resuelta: boolean
          resuelta_en: string | null
          severidad: string
          sla_horas: number | null
          sla_vence_en: string | null
          tipo: Database["public"]["Enums"]["tipo_incidencia"]
          traslado_id: string
        }
        Insert: {
          asignada_en?: string | null
          creada_en?: string
          descripcion: string
          escalada_en?: string | null
          estado?: string
          id?: string
          momento: Database["public"]["Enums"]["momento_incidencia"]
          nivel_escalamiento?: number
          reportada_por: Database["public"]["Enums"]["actor_reporte"]
          responsable_admin_id?: string | null
          resuelta?: boolean
          resuelta_en?: string | null
          severidad?: string
          sla_horas?: number | null
          sla_vence_en?: string | null
          tipo: Database["public"]["Enums"]["tipo_incidencia"]
          traslado_id: string
        }
        Update: {
          asignada_en?: string | null
          creada_en?: string
          descripcion?: string
          escalada_en?: string | null
          estado?: string
          id?: string
          momento?: Database["public"]["Enums"]["momento_incidencia"]
          nivel_escalamiento?: number
          reportada_por?: Database["public"]["Enums"]["actor_reporte"]
          responsable_admin_id?: string | null
          resuelta?: boolean
          resuelta_en?: string | null
          severidad?: string
          sla_horas?: number | null
          sla_vence_en?: string | null
          tipo?: Database["public"]["Enums"]["tipo_incidencia"]
          traslado_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "incidencias_responsable_admin_id_fkey"
            columns: ["responsable_admin_id"]
            isOneToOne: false
            referencedRelation: "admins"
            referencedColumns: ["id"]
          },
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
      metas_registro_conductor: {
        Row: {
          activo: boolean
          actualizado_en: string
          clave: string
          nombre: string
          objetivo: number
          operador: string
          severidad: string
        }
        Insert: {
          activo?: boolean
          actualizado_en?: string
          clave: string
          nombre: string
          objetivo: number
          operador: string
          severidad?: string
        }
        Update: {
          activo?: boolean
          actualizado_en?: string
          clave?: string
          nombre?: string
          objetivo?: number
          operador?: string
          severidad?: string
        }
        Relationships: []
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
      notas_internas_solicitud_conductor: {
        Row: {
          admin_id: string | null
          creado_en: string
          id: string
          mensaje: string
          solicitud_id: string
        }
        Insert: {
          admin_id?: string | null
          creado_en?: string
          id?: string
          mensaje: string
          solicitud_id: string
        }
        Update: {
          admin_id?: string | null
          creado_en?: string
          id?: string
          mensaje?: string
          solicitud_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notas_internas_solicitud_conductor_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "admins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notas_internas_solicitud_conductor_solicitud_id_fkey"
            columns: ["solicitud_id"]
            isOneToOne: false
            referencedRelation: "solicitudes_conductor"
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
      notificaciones_admin_operativas: {
        Row: {
          alerta_id: string | null
          canal: string
          creado_en: string
          cuerpo: string
          destinatario_rol: string
          enviado_en: string | null
          estado: string
          id: string
          titulo: string
        }
        Insert: {
          alerta_id?: string | null
          canal?: string
          creado_en?: string
          cuerpo: string
          destinatario_rol?: string
          enviado_en?: string | null
          estado?: string
          id?: string
          titulo: string
        }
        Update: {
          alerta_id?: string | null
          canal?: string
          creado_en?: string
          cuerpo?: string
          destinatario_rol?: string
          enviado_en?: string | null
          estado?: string
          id?: string
          titulo?: string
        }
        Relationships: [
          {
            foreignKeyName: "notificaciones_admin_operativas_alerta_id_fkey"
            columns: ["alerta_id"]
            isOneToOne: false
            referencedRelation: "alertas_sla_operacionales"
            referencedColumns: ["id"]
          },
        ]
      }
      notificaciones_conductor: {
        Row: {
          actualizado_en: string
          creado_en: string
          cuerpo: string
          datos: Json
          destino: string
          entidad_id: string | null
          entidad_tipo: string | null
          enviada_en: string | null
          estado: string
          id: string
          idempotency_key: string
          leida_en: string | null
          prioridad: string
          tipo: string
          titulo: string
          usuario_id: string
        }
        Insert: {
          actualizado_en?: string
          creado_en?: string
          cuerpo: string
          datos?: Json
          destino: string
          entidad_id?: string | null
          entidad_tipo?: string | null
          enviada_en?: string | null
          estado?: string
          id?: string
          idempotency_key: string
          leida_en?: string | null
          prioridad?: string
          tipo: string
          titulo: string
          usuario_id: string
        }
        Update: {
          actualizado_en?: string
          creado_en?: string
          cuerpo?: string
          datos?: Json
          destino?: string
          entidad_id?: string | null
          entidad_tipo?: string | null
          enviada_en?: string | null
          estado?: string
          id?: string
          idempotency_key?: string
          leida_en?: string | null
          prioridad?: string
          tipo?: string
          titulo?: string
          usuario_id?: string
        }
        Relationships: []
      }
      notificaciones_push_entregas: {
        Row: {
          abierta_en: string | null
          actualizado_en: string
          codigo_error: string | null
          creado_en: string
          detalle_error: string | null
          dispositivo_id: string
          enviada_en: string | null
          estado: string
          fcm_message_id: string | null
          id: string
          notificacion_id: string
          recibida_en: string | null
        }
        Insert: {
          abierta_en?: string | null
          actualizado_en?: string
          codigo_error?: string | null
          creado_en?: string
          detalle_error?: string | null
          dispositivo_id: string
          enviada_en?: string | null
          estado?: string
          fcm_message_id?: string | null
          id?: string
          notificacion_id: string
          recibida_en?: string | null
        }
        Update: {
          abierta_en?: string | null
          actualizado_en?: string
          codigo_error?: string | null
          creado_en?: string
          detalle_error?: string | null
          dispositivo_id?: string
          enviada_en?: string | null
          estado?: string
          fcm_message_id?: string | null
          id?: string
          notificacion_id?: string
          recibida_en?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notificaciones_push_entregas_dispositivo_id_fkey"
            columns: ["dispositivo_id"]
            isOneToOne: false
            referencedRelation: "dispositivos_push"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notificaciones_push_entregas_notificacion_id_fkey"
            columns: ["notificacion_id"]
            isOneToOne: false
            referencedRelation: "notificaciones_conductor"
            referencedColumns: ["id"]
          },
        ]
      }
      operaciones: {
        Row: {
          actualizado_en: string
          cliente_contacto_nombre: string | null
          cliente_contacto_telefono: string | null
          creado_en: string
          descripcion: string | null
          empresa_id: string | null
          estado: Database["public"]["Enums"]["estado_operacion"]
          folio: string
          id: string
          metadata: Json
          nombre: string
          planned_end_at: string | null
          planned_start_at: string | null
          prioridad: string
          responsable_interno_admin_id: string | null
          sla_horas: number | null
          tipo: Database["public"]["Enums"]["tipo_operacion"]
        }
        Insert: {
          actualizado_en?: string
          cliente_contacto_nombre?: string | null
          cliente_contacto_telefono?: string | null
          creado_en?: string
          descripcion?: string | null
          empresa_id?: string | null
          estado?: Database["public"]["Enums"]["estado_operacion"]
          folio: string
          id?: string
          metadata?: Json
          nombre: string
          planned_end_at?: string | null
          planned_start_at?: string | null
          prioridad?: string
          responsable_interno_admin_id?: string | null
          sla_horas?: number | null
          tipo?: Database["public"]["Enums"]["tipo_operacion"]
        }
        Update: {
          actualizado_en?: string
          cliente_contacto_nombre?: string | null
          cliente_contacto_telefono?: string | null
          creado_en?: string
          descripcion?: string | null
          empresa_id?: string | null
          estado?: Database["public"]["Enums"]["estado_operacion"]
          folio?: string
          id?: string
          metadata?: Json
          nombre?: string
          planned_end_at?: string | null
          planned_start_at?: string | null
          prioridad?: string
          responsable_interno_admin_id?: string | null
          sla_horas?: number | null
          tipo?: Database["public"]["Enums"]["tipo_operacion"]
        }
        Relationships: [
          {
            foreignKeyName: "operaciones_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "operaciones_responsable_interno_admin_id_fkey"
            columns: ["responsable_interno_admin_id"]
            isOneToOne: false
            referencedRelation: "admins"
            referencedColumns: ["id"]
          },
        ]
      }
      pagos: {
        Row: {
          comision_mxn: number | null
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
          comision_mxn?: number | null
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
          comision_mxn?: number | null
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
      politicas_version_app: {
        Row: {
          actualizado_en: string
          funcionalidades_incompatibles: string[]
          mensaje: string | null
          plataforma: string
          version_minima: string
          version_recomendada: string
          version_vigente: string
        }
        Insert: {
          actualizado_en?: string
          funcionalidades_incompatibles?: string[]
          mensaje?: string | null
          plataforma: string
          version_minima: string
          version_recomendada: string
          version_vigente: string
        }
        Update: {
          actualizado_en?: string
          funcionalidades_incompatibles?: string[]
          mensaje?: string | null
          plataforma?: string
          version_minima?: string
          version_recomendada?: string
          version_vigente?: string
        }
        Relationships: []
      }
      preferencias_admin: {
        Row: {
          actualizado_en: string
          admin_id: string
          clave: string
          valor: Json
          version: number
        }
        Insert: {
          actualizado_en?: string
          admin_id: string
          clave: string
          valor?: Json
          version?: number
        }
        Update: {
          actualizado_en?: string
          admin_id?: string
          clave?: string
          valor?: Json
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "preferencias_admin_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "admins"
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
          notificar_cambios_operativos: boolean
          notificar_documentos: boolean
          notificar_ganancias: boolean
          notificar_oportunidades: boolean
          notificar_promociones: boolean
          notificar_traslados_asignados: boolean
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
          notificar_cambios_operativos?: boolean
          notificar_documentos?: boolean
          notificar_ganancias?: boolean
          notificar_oportunidades?: boolean
          notificar_promociones?: boolean
          notificar_traslados_asignados?: boolean
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
          notificar_cambios_operativos?: boolean
          notificar_documentos?: boolean
          notificar_ganancias?: boolean
          notificar_oportunidades?: boolean
          notificar_promociones?: boolean
          notificar_traslados_asignados?: boolean
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
      puntualidad_traslado: {
        Row: {
          conductor_id: string
          confirmada_en: string | null
          confirmar_despues_de: string
          creada_en: string
          diferencia_min: number
          disputa_id: string | null
          estado: string
          llegada_real_en: string
          motivo_resolucion: string | null
          objetivo_llegada_en: string
          resultado: string
          tolerancia_min: number
          traslado_id: string
        }
        Insert: {
          conductor_id: string
          confirmada_en?: string | null
          confirmar_despues_de: string
          creada_en?: string
          diferencia_min: number
          disputa_id?: string | null
          estado: string
          llegada_real_en: string
          motivo_resolucion?: string | null
          objetivo_llegada_en: string
          resultado: string
          tolerancia_min: number
          traslado_id: string
        }
        Update: {
          conductor_id?: string
          confirmada_en?: string | null
          confirmar_despues_de?: string
          creada_en?: string
          diferencia_min?: number
          disputa_id?: string | null
          estado?: string
          llegada_real_en?: string
          motivo_resolucion?: string | null
          objetivo_llegada_en?: string
          resultado?: string
          tolerancia_min?: number
          traslado_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "puntualidad_traslado_conductor_id_fkey"
            columns: ["conductor_id"]
            isOneToOne: false
            referencedRelation: "conductores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "puntualidad_traslado_disputa_id_fkey"
            columns: ["disputa_id"]
            isOneToOne: false
            referencedRelation: "disputas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "puntualidad_traslado_traslado_id_fkey"
            columns: ["traslado_id"]
            isOneToOne: true
            referencedRelation: "pasaporte_digital"
            referencedColumns: ["traslado_id"]
          },
          {
            foreignKeyName: "puntualidad_traslado_traslado_id_fkey"
            columns: ["traslado_id"]
            isOneToOne: true
            referencedRelation: "traslados"
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
          version: number
        }
        Insert: {
          abierto_en?: string
          estado?: Database["public"]["Enums"]["estado_reclamo_seguro"]
          id?: string
          notas_admin?: string | null
          responsable_pago?: string | null
          resuelto_en?: string | null
          traslado_id: string
          version?: number
        }
        Update: {
          abierto_en?: string
          estado?: Database["public"]["Enums"]["estado_reclamo_seguro"]
          id?: string
          notas_admin?: string | null
          responsable_pago?: string | null
          resuelto_en?: string | null
          traslado_id?: string
          version?: number
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
      sla_reglas_operativas: {
        Row: {
          activo: boolean
          actualizado_en: string
          cliente_segmento: string
          creado_en: string
          horas_limite: number
          id: string
          pausa_fuera_horario: boolean
          prioridad: number
          severidad_base: string
          tipo_alerta: string
          tipo_servicio: string
          umbral_alerta_pct: number
          zona_horaria: string
        }
        Insert: {
          activo?: boolean
          actualizado_en?: string
          cliente_segmento?: string
          creado_en?: string
          horas_limite: number
          id?: string
          pausa_fuera_horario?: boolean
          prioridad?: number
          severidad_base: string
          tipo_alerta: string
          tipo_servicio?: string
          umbral_alerta_pct?: number
          zona_horaria?: string
        }
        Update: {
          activo?: boolean
          actualizado_en?: string
          cliente_segmento?: string
          creado_en?: string
          horas_limite?: number
          id?: string
          pausa_fuera_horario?: boolean
          prioridad?: number
          severidad_base?: string
          tipo_alerta?: string
          tipo_servicio?: string
          umbral_alerta_pct?: number
          zona_horaria?: string
        }
        Relationships: []
      }
      solicitudes_aprobacion_admin: {
        Row: {
          accion: string
          aprobada_por: string | null
          capacidad_requerida: string
          creada_en: string
          decidida_en: string | null
          ejecutada_en: string | null
          estado: string
          expira_en: string
          id: string
          motivo_decision: string | null
          payload: Json
          recurso: string
          recurso_id: string | null
          solicitada_por: string
          tipo: string
          version: number
        }
        Insert: {
          accion: string
          aprobada_por?: string | null
          capacidad_requerida: string
          creada_en?: string
          decidida_en?: string | null
          ejecutada_en?: string | null
          estado?: string
          expira_en?: string
          id?: string
          motivo_decision?: string | null
          payload?: Json
          recurso: string
          recurso_id?: string | null
          solicitada_por: string
          tipo: string
          version?: number
        }
        Update: {
          accion?: string
          aprobada_por?: string | null
          capacidad_requerida?: string
          creada_en?: string
          decidida_en?: string | null
          ejecutada_en?: string | null
          estado?: string
          expira_en?: string
          id?: string
          motivo_decision?: string | null
          payload?: Json
          recurso?: string
          recurso_id?: string | null
          solicitada_por?: string
          tipo?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "solicitudes_aprobacion_admin_aprobada_por_fkey"
            columns: ["aprobada_por"]
            isOneToOne: false
            referencedRelation: "admins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "solicitudes_aprobacion_admin_solicitada_por_fkey"
            columns: ["solicitada_por"]
            isOneToOne: false
            referencedRelation: "admins"
            referencedColumns: ["id"]
          },
        ]
      }
      solicitudes_asignacion: {
        Row: {
          asignaciones_7d: number
          categoria_puntualidad: string
          clave_desempate: string
          competencia_id: string
          conductor_id: string
          distancia_origen_km: number | null
          elegibilidad_snapshot: Json
          estado: string
          eta_aproximado_min: number | null
          id: string
          puntualidad_muestra: number
          puntualidad_porcentaje: number | null
          solicitada_en: string
          traslado_id: string
          ubicacion_lat: number | null
          ubicacion_lng: number | null
          ultima_asignacion_en: string | null
          viabilidad: string
        }
        Insert: {
          asignaciones_7d?: number
          categoria_puntualidad: string
          clave_desempate: string
          competencia_id: string
          conductor_id: string
          distancia_origen_km?: number | null
          elegibilidad_snapshot: Json
          estado?: string
          eta_aproximado_min?: number | null
          id?: string
          puntualidad_muestra?: number
          puntualidad_porcentaje?: number | null
          solicitada_en?: string
          traslado_id: string
          ubicacion_lat?: number | null
          ubicacion_lng?: number | null
          ultima_asignacion_en?: string | null
          viabilidad: string
        }
        Update: {
          asignaciones_7d?: number
          categoria_puntualidad?: string
          clave_desempate?: string
          competencia_id?: string
          conductor_id?: string
          distancia_origen_km?: number | null
          elegibilidad_snapshot?: Json
          estado?: string
          eta_aproximado_min?: number | null
          id?: string
          puntualidad_muestra?: number
          puntualidad_porcentaje?: number | null
          solicitada_en?: string
          traslado_id?: string
          ubicacion_lat?: number | null
          ubicacion_lng?: number | null
          ultima_asignacion_en?: string | null
          viabilidad?: string
        }
        Relationships: [
          {
            foreignKeyName: "solicitudes_asignacion_competencia_id_fkey"
            columns: ["competencia_id"]
            isOneToOne: false
            referencedRelation: "competencias_asignacion"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "solicitudes_asignacion_conductor_id_fkey"
            columns: ["conductor_id"]
            isOneToOne: false
            referencedRelation: "conductores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "solicitudes_asignacion_traslado_id_fkey"
            columns: ["traslado_id"]
            isOneToOne: false
            referencedRelation: "pasaporte_digital"
            referencedColumns: ["traslado_id"]
          },
          {
            foreignKeyName: "solicitudes_asignacion_traslado_id_fkey"
            columns: ["traslado_id"]
            isOneToOne: false
            referencedRelation: "traslados"
            referencedColumns: ["id"]
          },
        ]
      }
      solicitudes_cambio_conductor: {
        Row: {
          actualizado_en: string
          conductor_id: string
          creado_en: string
          estado: Database["public"]["Enums"]["estado_solicitud_cambio_conductor"]
          id: string
          motivo_rechazo: string | null
          payload_anterior: Json
          payload_propuesto: Json
          revisado_en: string | null
          revisado_por: string | null
          tipo: Database["public"]["Enums"]["tipo_solicitud_cambio_conductor"]
        }
        Insert: {
          actualizado_en?: string
          conductor_id: string
          creado_en?: string
          estado?: Database["public"]["Enums"]["estado_solicitud_cambio_conductor"]
          id?: string
          motivo_rechazo?: string | null
          payload_anterior: Json
          payload_propuesto: Json
          revisado_en?: string | null
          revisado_por?: string | null
          tipo: Database["public"]["Enums"]["tipo_solicitud_cambio_conductor"]
        }
        Update: {
          actualizado_en?: string
          conductor_id?: string
          creado_en?: string
          estado?: Database["public"]["Enums"]["estado_solicitud_cambio_conductor"]
          id?: string
          motivo_rechazo?: string | null
          payload_anterior?: Json
          payload_propuesto?: Json
          revisado_en?: string | null
          revisado_por?: string | null
          tipo?: Database["public"]["Enums"]["tipo_solicitud_cambio_conductor"]
        }
        Relationships: [
          {
            foreignKeyName: "solicitudes_cambio_conductor_conductor_id_fkey"
            columns: ["conductor_id"]
            isOneToOne: false
            referencedRelation: "conductores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "solicitudes_cambio_conductor_revisado_por_fkey"
            columns: ["revisado_por"]
            isOneToOne: false
            referencedRelation: "admins"
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
      tarifas_politica_versiones: {
        Row: {
          creada_en: string
          creada_por: string | null
          id: number
          snapshot: Json
          xact_id: number
        }
        Insert: {
          creada_en?: string
          creada_por?: string | null
          id?: never
          snapshot: Json
          xact_id: number
        }
        Update: {
          creada_en?: string
          creada_por?: string | null
          id?: never
          snapshot?: Json
          xact_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "tarifas_politica_versiones_creada_por_fkey"
            columns: ["creada_por"]
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
      tracking_salud_traslado: {
        Row: {
          actualizado_en: string
          conductor_id: string
          fuente: string | null
          online: boolean | null
          precision_m: number | null
          traslado_id: string
          ultima_ubicacion_en: string | null
          ultimo_envio_en: string | null
          ultimo_punto_id: string | null
        }
        Insert: {
          actualizado_en?: string
          conductor_id: string
          fuente?: string | null
          online?: boolean | null
          precision_m?: number | null
          traslado_id: string
          ultima_ubicacion_en?: string | null
          ultimo_envio_en?: string | null
          ultimo_punto_id?: string | null
        }
        Update: {
          actualizado_en?: string
          conductor_id?: string
          fuente?: string | null
          online?: boolean | null
          precision_m?: number | null
          traslado_id?: string
          ultima_ubicacion_en?: string | null
          ultimo_envio_en?: string | null
          ultimo_punto_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tracking_salud_traslado_conductor_id_fkey"
            columns: ["conductor_id"]
            isOneToOne: false
            referencedRelation: "conductores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tracking_salud_traslado_traslado_id_fkey"
            columns: ["traslado_id"]
            isOneToOne: true
            referencedRelation: "pasaporte_digital"
            referencedColumns: ["traslado_id"]
          },
          {
            foreignKeyName: "tracking_salud_traslado_traslado_id_fkey"
            columns: ["traslado_id"]
            isOneToOne: true
            referencedRelation: "traslados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tracking_salud_traslado_ultimo_punto_id_fkey"
            columns: ["ultimo_punto_id"]
            isOneToOne: false
            referencedRelation: "ubicaciones_traslado"
            referencedColumns: ["id"]
          },
        ]
      }
      tracking_sesiones: {
        Row: {
          actualizado_en: string
          conductor_id: string
          creado_en: string
          desviacion_sospechosa: boolean
          estado: string
          finalizada_en: string | null
          id: string
          iniciada_en: string
          metadata: Json
          plataforma: string | null
          traslado_id: string
          ultima_bateria_pct: number | null
          ultima_distancia_destino_km: number | null
          ultima_lat: number | null
          ultima_lng: number | null
          ultima_precision_m: number | null
          ultima_velocidad_mps: number | null
          ultimo_heartbeat_en: string | null
        }
        Insert: {
          actualizado_en?: string
          conductor_id: string
          creado_en?: string
          desviacion_sospechosa?: boolean
          estado?: string
          finalizada_en?: string | null
          id?: string
          iniciada_en?: string
          metadata?: Json
          plataforma?: string | null
          traslado_id: string
          ultima_bateria_pct?: number | null
          ultima_distancia_destino_km?: number | null
          ultima_lat?: number | null
          ultima_lng?: number | null
          ultima_precision_m?: number | null
          ultima_velocidad_mps?: number | null
          ultimo_heartbeat_en?: string | null
        }
        Update: {
          actualizado_en?: string
          conductor_id?: string
          creado_en?: string
          desviacion_sospechosa?: boolean
          estado?: string
          finalizada_en?: string | null
          id?: string
          iniciada_en?: string
          metadata?: Json
          plataforma?: string | null
          traslado_id?: string
          ultima_bateria_pct?: number | null
          ultima_distancia_destino_km?: number | null
          ultima_lat?: number | null
          ultima_lng?: number | null
          ultima_precision_m?: number | null
          ultima_velocidad_mps?: number | null
          ultimo_heartbeat_en?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tracking_sesiones_conductor_id_fkey"
            columns: ["conductor_id"]
            isOneToOne: false
            referencedRelation: "conductores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tracking_sesiones_traslado_id_fkey"
            columns: ["traslado_id"]
            isOneToOne: false
            referencedRelation: "pasaporte_digital"
            referencedColumns: ["traslado_id"]
          },
          {
            foreignKeyName: "tracking_sesiones_traslado_id_fkey"
            columns: ["traslado_id"]
            isOneToOne: false
            referencedRelation: "traslados"
            referencedColumns: ["id"]
          },
        ]
      }
      traslado_paradas: {
        Row: {
          calle: string
          ciudad: string
          codigo_postal: string
          colonia: string
          contacto_nombre: string | null
          contacto_telefono: string | null
          creado_en: string
          direccion: string
          estado: string
          id: string
          instrucciones: string | null
          lat: number | null
          lng: number | null
          numero: string
          orden: number
          referencias: string | null
          requiere_evidencia: boolean
          tiempo_espera_min: number | null
          tipo: Database["public"]["Enums"]["tipo_parada"]
          tipo_tarea: Database["public"]["Enums"]["tipo_tarea_parada"] | null
          traslado_id: string
        }
        Insert: {
          calle: string
          ciudad: string
          codigo_postal: string
          colonia: string
          contacto_nombre?: string | null
          contacto_telefono?: string | null
          creado_en?: string
          direccion: string
          estado: string
          id?: string
          instrucciones?: string | null
          lat?: number | null
          lng?: number | null
          numero: string
          orden: number
          referencias?: string | null
          requiere_evidencia?: boolean
          tiempo_espera_min?: number | null
          tipo: Database["public"]["Enums"]["tipo_parada"]
          tipo_tarea?: Database["public"]["Enums"]["tipo_tarea_parada"] | null
          traslado_id: string
        }
        Update: {
          calle?: string
          ciudad?: string
          codigo_postal?: string
          colonia?: string
          contacto_nombre?: string | null
          contacto_telefono?: string | null
          creado_en?: string
          direccion?: string
          estado?: string
          id?: string
          instrucciones?: string | null
          lat?: number | null
          lng?: number | null
          numero?: string
          orden?: number
          referencias?: string | null
          requiere_evidencia?: boolean
          tiempo_espera_min?: number | null
          tipo?: Database["public"]["Enums"]["tipo_parada"]
          tipo_tarea?: Database["public"]["Enums"]["tipo_tarea_parada"] | null
          traslado_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "traslado_paradas_traslado_id_fkey"
            columns: ["traslado_id"]
            isOneToOne: false
            referencedRelation: "pasaporte_digital"
            referencedColumns: ["traslado_id"]
          },
          {
            foreignKeyName: "traslado_paradas_traslado_id_fkey"
            columns: ["traslado_id"]
            isOneToOne: false
            referencedRelation: "traslados"
            referencedColumns: ["id"]
          },
        ]
      }
      traslados: {
        Row: {
          actualizado_en: string
          causa_fallido: Database["public"]["Enums"]["causa_fallido"] | null
          cerrado_en: string | null
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
          estado_operativo: Database["public"]["Enums"]["estado_operativo_traslado"]
          fecha_hora_programada: string | null
          ganancia_conductor_congelada: number | null
          id: string
          instrucciones_especiales: string | null
          modalidad_programacion: string | null
          motivo_servicio: string | null
          operation_id: string | null
          origen_ciudad: string
          origen_direccion: string
          origen_lat: number | null
          origen_lng: number | null
          origen_referencias: string | null
          payout_id: string | null
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
          version: number
        }
        Insert: {
          actualizado_en?: string
          causa_fallido?: Database["public"]["Enums"]["causa_fallido"] | null
          cerrado_en?: string | null
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
          estado_operativo?: Database["public"]["Enums"]["estado_operativo_traslado"]
          fecha_hora_programada?: string | null
          ganancia_conductor_congelada?: number | null
          id?: string
          instrucciones_especiales?: string | null
          modalidad_programacion?: string | null
          motivo_servicio?: string | null
          operation_id?: string | null
          origen_ciudad: string
          origen_direccion: string
          origen_lat?: number | null
          origen_lng?: number | null
          origen_referencias?: string | null
          payout_id?: string | null
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
          version?: number
        }
        Update: {
          actualizado_en?: string
          causa_fallido?: Database["public"]["Enums"]["causa_fallido"] | null
          cerrado_en?: string | null
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
          estado_operativo?: Database["public"]["Enums"]["estado_operativo_traslado"]
          fecha_hora_programada?: string | null
          ganancia_conductor_congelada?: number | null
          id?: string
          instrucciones_especiales?: string | null
          modalidad_programacion?: string | null
          motivo_servicio?: string | null
          operation_id?: string | null
          origen_ciudad?: string
          origen_direccion?: string
          origen_lat?: number | null
          origen_lng?: number | null
          origen_referencias?: string | null
          payout_id?: string | null
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
          version?: number
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
            foreignKeyName: "traslados_operation_id_fkey"
            columns: ["operation_id"]
            isOneToOne: false
            referencedRelation: "operaciones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "traslados_payout_id_fkey"
            columns: ["payout_id"]
            isOneToOne: false
            referencedRelation: "payouts_conductor"
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
          altitud_m: number | null
          bateria_pct: number | null
          conductor_id: string
          direccion_grados: number | null
          dispositivo_timestamp: string | null
          estado_viaje: string | null
          fuente: string
          id: string
          lat: number
          lng: number
          local_id: string | null
          online: boolean | null
          precision_m: number | null
          registrado_en: string
          servidor_timestamp: string
          traslado_id: string
          velocidad_mps: number | null
        }
        Insert: {
          altitud_m?: number | null
          bateria_pct?: number | null
          conductor_id: string
          direccion_grados?: number | null
          dispositivo_timestamp?: string | null
          estado_viaje?: string | null
          fuente?: string
          id?: string
          lat: number
          lng: number
          local_id?: string | null
          online?: boolean | null
          precision_m?: number | null
          registrado_en?: string
          servidor_timestamp?: string
          traslado_id: string
          velocidad_mps?: number | null
        }
        Update: {
          altitud_m?: number | null
          bateria_pct?: number | null
          conductor_id?: string
          direccion_grados?: number | null
          dispositivo_timestamp?: string | null
          estado_viaje?: string | null
          fuente?: string
          id?: string
          lat?: number
          lng?: number
          local_id?: string | null
          online?: boolean | null
          precision_m?: number | null
          registrado_en?: string
          servidor_timestamp?: string
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
          estado_cuenta: string
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
          estado_cuenta?: string
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
          estado_cuenta?: string
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
          actualizado_en: string
          alias: string | null
          anio: number
          categoria_tarifa:
            | Database["public"]["Enums"]["categoria_tarifa_vehiculo"]
            | null
          color: string | null
          condicion: Database["public"]["Enums"]["condicion_vehiculo"] | null
          creado_en: string
          empresa_id: string | null
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
          version: number
          vin: string | null
        }
        Insert: {
          actualizado_en?: string
          alias?: string | null
          anio: number
          categoria_tarifa?:
            | Database["public"]["Enums"]["categoria_tarifa_vehiculo"]
            | null
          color?: string | null
          condicion?: Database["public"]["Enums"]["condicion_vehiculo"] | null
          creado_en?: string
          empresa_id?: string | null
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
          version?: number
          vin?: string | null
        }
        Update: {
          actualizado_en?: string
          alias?: string | null
          anio?: number
          categoria_tarifa?:
            | Database["public"]["Enums"]["categoria_tarifa_vehiculo"]
            | null
          color?: string | null
          condicion?: Database["public"]["Enums"]["condicion_vehiculo"] | null
          creado_en?: string
          empresa_id?: string | null
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
          version?: number
          vin?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vehiculos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehiculos_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      verificaciones_identidad_didit: {
        Row: {
          actualizado_en: string
          creado_en: string
          decision: Json | null
          estado: string
          id: string
          procesado_en: string | null
          session_id: string
          solicitud_id: string | null
          usuario_id: string | null
          workflow_id: string | null
        }
        Insert: {
          actualizado_en?: string
          creado_en?: string
          decision?: Json | null
          estado?: string
          id?: string
          procesado_en?: string | null
          session_id: string
          solicitud_id?: string | null
          usuario_id?: string | null
          workflow_id?: string | null
        }
        Update: {
          actualizado_en?: string
          creado_en?: string
          decision?: Json | null
          estado?: string
          id?: string
          procesado_en?: string | null
          session_id?: string
          solicitud_id?: string | null
          usuario_id?: string | null
          workflow_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "verificaciones_identidad_didit_solicitud_id_fkey"
            columns: ["solicitud_id"]
            isOneToOne: false
            referencedRelation: "solicitudes_conductor"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "verificaciones_identidad_didit_usuario_id_fkey"
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
          ganancia_conductor: number | null
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
      abrir_disputa_traslado:
        | {
            Args: {
              p_abierta_por: Database["public"]["Enums"]["abierta_por_actor"]
              p_descripcion: string
              p_tipo: Database["public"]["Enums"]["tipo_disputa"]
              p_traslado_id: string
            }
            Returns: string
          }
        | {
            Args: {
              p_abierta_por: Database["public"]["Enums"]["abierta_por_actor"]
              p_descripcion: string
              p_mantener_estado?: boolean
              p_tipo: Database["public"]["Enums"]["tipo_disputa"]
              p_traslado_id: string
            }
            Returns: string
          }
      aceptar_asignacion: {
        Args: { p_asignacion_id: string }
        Returns: undefined
      }
      actualizar_datos_facturacion: {
        Args: {
          p_codigo_postal_fiscal?: string
          p_correo_facturacion?: string
          p_razon_social?: string
          p_regimen_fiscal?: string
          p_rfc?: string
          p_uso_cfdi?: string
        }
        Returns: Json
      }
      admin_accion_masiva: {
        Args: { p_accion: string; p_payload?: Json; p_traslado_ids: string[] }
        Returns: Json
      }
      admin_actual_id: { Args: never; Returns: string }
      admin_actualiza_alerta_sla: {
        Args: {
          p_accion: string
          p_alerta_id: string
          p_comentario?: string
          p_responsable?: string
        }
        Returns: Json
      }
      admin_actualiza_conductor_documentos: {
        Args: { p_aprobado: boolean; p_conductor_id: string }
        Returns: undefined
      }
      admin_actualiza_empresa_corporativa: {
        Args: { p_datos: Json; p_empresa_id: string; p_motivo?: string }
        Returns: Json
      }
      admin_actualiza_reclamo_seguro:
        | {
            Args: {
              p_estado: Database["public"]["Enums"]["estado_reclamo_seguro"]
              p_notas_admin: string
              p_reclamo_id: string
              p_responsable_pago: string
            }
            Returns: undefined
          }
        | {
            Args: {
              p_estado: Database["public"]["Enums"]["estado_reclamo_seguro"]
              p_mantener_estado?: boolean
              p_notas_admin: string
              p_reclamo_id: string
              p_responsable_pago: string
            }
            Returns: undefined
          }
      admin_actualiza_usuario_verificacion: {
        Args: {
          p_estado: Database["public"]["Enums"]["estado_verificacion"]
          p_motivo?: string
          p_usuario_id: string
        }
        Returns: undefined
      }
      admin_actualizar_conductor_atomic: {
        Args: { p_conductor_id: string; p_datos: Json }
        Returns: Json
      }
      admin_actualizar_configuracion: {
        Args: {
          p_clave: string
          p_motivo: string
          p_valor: Json
          p_version_esperada: number
        }
        Returns: {
          actualizada_en: string
          actualizada_por: string | null
          categoria: string
          clave: string
          descripcion: string
          nombre: string
          valor: Json
          version: number
        }[]
        SetofOptions: {
          from: "*"
          to: "configuracion_admin"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      admin_actualizar_estado_traslado_con_version: {
        Args: {
          p_estado: Database["public"]["Enums"]["estado_traslado"]
          p_traslado_id: string
          p_version_esperada: number
        }
        Returns: number
      }
      admin_actualizar_politica_tarifaria_normativa: {
        Args: { p_aprobacion_id: string; p_payload: Json }
        Returns: Json
      }
      admin_actualizar_rol_colaborador: {
        Args: {
          p_admin_id: string
          p_motivo: string
          p_rol: Database["public"]["Enums"]["rol_admin_operativo"]
        }
        Returns: {
          creado_en: string
          id: string
          nombre: string
          rol_operativo: Database["public"]["Enums"]["rol_admin_operativo"]
        }[]
      }
      admin_actualizar_usuario_atomic: {
        Args: { p_datos: Json; p_usuario_id: string }
        Returns: Json
      }
      admin_actualizar_vehiculo: {
        Args: {
          p_datos: Json
          p_vehiculo_id: string
          p_version_esperada: number
        }
        Returns: Json
      }
      admin_ajustar_precio_final: {
        Args: {
          p_aprobacion_id: string
          p_precio_final: number
          p_traslado_id: string
        }
        Returns: Json
      }
      admin_aplica_tarifa_normativa: {
        Args: { p_traslado_id: string }
        Returns: number
      }
      admin_asigna_conductor: {
        Args: { p_conductor_id: string; p_traslado_id: string }
        Returns: Database["public"]["Enums"]["estado_traslado"]
      }
      admin_cambia_estado_empresa: {
        Args: {
          p_empresa_id: string
          p_estado_operativo: string
          p_motivo: string
        }
        Returns: Json
      }
      admin_cambiar_estado_traslado: {
        Args: {
          p_aprobacion_id?: string
          p_nuevo_estado: string
          p_traslado_id: string
          p_version_esperada?: number
        }
        Returns: Json
      }
      admin_cancela_carga_traslados_masivos: {
        Args: { p_carga_id: string; p_motivo: string }
        Returns: Json
      }
      admin_completar_exportacion: {
        Args: {
          p_error?: string
          p_filas: number
          p_hash: string
          p_id: string
        }
        Returns: undefined
      }
      admin_conceder_capacidad: {
        Args: {
          p_admin_id: string
          p_capacidad: string
          p_concedida: boolean
          p_motivo: string
        }
        Returns: undefined
      }
      admin_crea_carga_masiva_operacion: {
        Args: {
          p_empresa_id: string
          p_filas: Json
          p_hash_archivo: string
          p_mime_type: string
          p_nombre_archivo: string
          p_operacion_id: string
          p_tamano_bytes: number
          p_usuario_id: string
        }
        Returns: Json
      }
      admin_crea_empresa_corporativa: {
        Args: { p_empresa: Json; p_titular: Json }
        Returns: Json
      }
      admin_crea_traslados_masivos:
        | {
            Args: {
              p_empresa_id: string
              p_filas: Json
              p_nombre_archivo: string
              p_usuario_id: string
            }
            Returns: Json
          }
        | {
            Args: {
              p_empresa_id: string
              p_filas: Json
              p_hash_archivo: string
              p_mime_type: string
              p_nombre_archivo: string
              p_tamano_bytes: number
              p_usuario_id: string
            }
            Returns: Json
          }
      admin_decidir_aprobacion: {
        Args: {
          p_aprobar: boolean
          p_motivo: string
          p_solicitud_id: string
          p_version_esperada: number
        }
        Returns: undefined
      }
      admin_ejecutar_aprobacion: {
        Args: { p_aprobacion_id: string }
        Returns: undefined
      }
      admin_ejecutar_pago: {
        Args: {
          p_aprobacion_id: string
          p_monto?: number
          p_traslado_id: string
        }
        Returns: Json
      }
      admin_emite_cotizacion: {
        Args: { p_precio: number; p_traslado_id: string }
        Returns: undefined
      }
      admin_exportar_evidencia_firmada: {
        Args: { p_traslado_ids: string[] }
        Returns: Json
      }
      admin_finanzas_operacion: {
        Args: { p_operacion_id: string }
        Returns: Json
      }
      admin_finanzas_traslado: {
        Args: { p_traslado_id: string }
        Returns: Json
      }
      admin_generar_payouts_periodo: {
        Args: { p_periodo_fin: string; p_periodo_inicio: string }
        Returns: Json
      }
      admin_guarda_documento_empresa: {
        Args: { p_documento: Json; p_empresa_id: string }
        Returns: Json
      }
      admin_guarda_usuario_empresa: {
        Args: { p_empresa_id: string; p_usuario: Json }
        Returns: Json
      }
      admin_invitar_usuario: {
        Args: { p_correo: string; p_nombre?: string; p_tipo_cuenta?: string }
        Returns: string
      }
      admin_listar_capacidades: {
        Args: { p_admin_id?: string }
        Returns: {
          capacidad: string
          concedida: boolean
          creada_en: string
          motivo: string
          origen: string
          otorgada_por: string
        }[]
      }
      admin_listar_capacidades_catalogo: { Args: never; Returns: string[] }
      admin_listar_configuracion: {
        Args: never
        Returns: {
          actualizada_en: string
          actualizada_por: string | null
          categoria: string
          clave: string
          descripcion: string
          nombre: string
          valor: Json
          version: number
        }[]
        SetofOptions: {
          from: "*"
          to: "configuracion_admin"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      admin_listar_solicitudes_conductor_paginadas: {
        Args: {
          p_busqueda?: string
          p_filtro?: string
          p_pagina?: number
          p_tamano?: number
        }
        Returns: Json
      }
      admin_listar_vehiculos_paginados: {
        Args: { p_busqueda?: string; p_pagina?: number; p_tamano?: number }
        Returns: Json
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
      admin_mutacion_con_auditoria: {
        Args: { p_accion: string; p_payload?: Json; p_traslado_id: string }
        Returns: Json
      }
      admin_obtener_evidencia_vehiculo: {
        Args: { p_vehiculo_id: string }
        Returns: Json
      }
      admin_previsualizar_carga_masiva: {
        Args: { p_empresa_id: string; p_filas: Json; p_usuario_id: string }
        Returns: Json
      }
      admin_procesa_carga_traslados_masivos: {
        Args: { p_carga_id: string; p_limite?: number }
        Returns: Json
      }
      admin_registrar_cancelacion_injustificada: {
        Args: {
          p_aprobacion_id: string
          p_cancelaciones: number
          p_conductor_id: string
          p_nuevo_estado: string
        }
        Returns: Json
      }
      admin_registrar_exportacion: {
        Args: { p_filtros: Json; p_formato: string; p_recurso: string }
        Returns: string
      }
      admin_registrar_no_presentacion: {
        Args: {
          p_aprobacion_id: string
          p_conductor_id: string
          p_nuevo_estado: string
          p_ocurrencias: number
        }
        Returns: Json
      }
      admin_resuelve_cambio_empresa: {
        Args: { p_aprobar: boolean; p_cambio_id: string; p_comentario?: string }
        Returns: Json
      }
      admin_resuelve_disputa:
        | {
            Args: {
              p_detalle: string
              p_disputa_id: string
              p_estado: Database["public"]["Enums"]["estado_disputa"]
              p_resolucion: Database["public"]["Enums"]["resolucion_disputa"]
            }
            Returns: undefined
          }
        | {
            Args: {
              p_detalle: string
              p_disputa_id: string
              p_estado: Database["public"]["Enums"]["estado_disputa"]
              p_mantener_estado?: boolean
              p_resolucion: Database["public"]["Enums"]["resolucion_disputa"]
            }
            Returns: undefined
          }
      admin_resumen_disputas_perdidas_conductor: {
        Args: { p_conductor_id: string }
        Returns: Json
      }
      admin_sancionar_conductor: {
        Args: {
          p_aprobacion_id: string
          p_conductor_id: string
          p_dias_suspension?: number
          p_motivo: string
        }
        Returns: Json
      }
      admin_sincroniza_alertas_sla_operacionales: {
        Args: never
        Returns: {
          actualizado_en: string
          acuse_en: string | null
          acuse_por_admin_id: string | null
          asignado_en: string | null
          asignado_por_admin_id: string | null
          categoria: string
          cerrado_en: string | null
          cerrado_por_admin_id: string | null
          creado_en: string
          dedupe_key: string
          descripcion: string
          entidad_id: string
          entidad_tipo: string
          escalado_en: string | null
          escalado_por_admin_id: string | null
          estado: string
          folio: string
          horas_limite: number
          horas_transcurridas: number
          id: string
          metadata: Json
          notificacion_estado: string
          origen_creado_en: string
          porcentaje_consumido: number
          prioridad: number
          regla_id: string | null
          responsable: string | null
          resuelto_en: string | null
          resuelto_por_admin_id: string | null
          severidad: string
          sla_restante_horas: number
          traslado_id: string | null
          vence_en: string
        }[]
        SetofOptions: {
          from: "*"
          to: "alertas_sla_operacionales"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      admin_solicitar_aprobacion: {
        Args: {
          p_accion: string
          p_capacidad: string
          p_payload?: Json
          p_recurso: string
          p_recurso_id: string
          p_tipo: string
        }
        Returns: string
      }
      admin_sugerir_tarifa_traslado: {
        Args: { p_traslado_id: string }
        Returns: number
      }
      admin_suspender_conductor: {
        Args: {
          p_aprobacion_id: string
          p_conductor_id: string
          p_motivo?: string
          p_nuevo_estado: string
        }
        Returns: Json
      }
      admin_tiene_permiso: { Args: { p_permiso: string }; Returns: boolean }
      admin_validar_aprobacion: {
        Args: {
          p_accion: string
          p_aprobacion_id: string
          p_capacidad_requerida: string
          p_payload?: Json
          p_recurso: string
          p_recurso_id: string
        }
        Returns: Json
      }
      admin_validar_configuracion_normativa: {
        Args: { p_clave: string; p_valor: Json }
        Returns: undefined
      }
      aprobar_expediente_conductor_admin: {
        Args: { p_conductor_id: string }
        Returns: undefined
      }
      aprobar_solicitud_cambio_conductor: {
        Args: { p_solicitud_id: string }
        Returns: Json
      }
      aprobar_solicitud_conductor_admin: {
        Args: { p_motivo?: string; p_solicitud_id: string }
        Returns: string
      }
      aprobar_solicitud_conductor_sistema: {
        Args: { p_solicitud_id: string; p_verificacion_id: string }
        Returns: string
      }
      aprobar_usuario_por_verificacion_sistema: {
        Args: { p_usuario_id: string; p_verificacion_id: string }
        Returns: string
      }
      asignar_incidencia: {
        Args: {
          p_admin_id: string
          p_incidencia_id: string
          p_severidad?: string
        }
        Returns: undefined
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
      calcular_pago_conductor: {
        Args: {
          p_certificacion: Database["public"]["Enums"]["certificacion_conductor"]
          p_precio: number
        }
        Returns: number
      }
      calcular_pago_conductor_traslado: {
        Args: { p_conductor_id?: string; p_traslado_id: string }
        Returns: number
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
      cancelar_asignacion: {
        Args: { p_asignacion_id: string; p_motivo?: string }
        Returns: undefined
      }
      cancelar_solicitud_cambio_conductor: {
        Args: { p_solicitud_id: string }
        Returns: Json
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
          p_numero_tarjeta?: string
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
          numero_tarjeta: string | null
          titular_cuenta: string
        }
        SetofOptions: {
          from: "*"
          to: "datos_bancarios_conductor"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      conductor_id_actual: { Args: never; Returns: string }
      conductor_operativamente_aprobado: {
        Args: { p_auth_user_id?: string }
        Returns: boolean
      }
      conductor_solicita_asignacion: {
        Args: { p_lat?: number; p_lng?: number; p_traslado_id: string }
        Returns: Json
      }
      consentimientos_solicitud_completos: {
        Args: { p_solicitud_id: string }
        Returns: boolean
      }
      consumir_clave_idempotencia: {
        Args: { p_clave: string; p_entidad: string; p_entidad_id?: string }
        Returns: Json
      }
      crear_incidencia_sistema_dano_no_reportado: {
        Args: { p_descripcion: string; p_traslado_id: string }
        Returns: string
      }
      crear_usuario_legacy_desde_auth: {
        Args: { p_usuario: unknown }
        Returns: undefined
      }
      custodia_tipo_desde_estado: {
        Args: { e: Database["public"]["Enums"]["estado_traslado"] }
        Returns: Database["public"]["Enums"]["tipo_evento_custodia"]
      }
      desactivar_dispositivo_push: {
        Args: { p_device_id: string }
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
      empresa_cambiar_rol_miembro: {
        Args: { p_miembro_id: string; p_rol: string }
        Returns: undefined
      }
      empresa_id_del_titular_actual: { Args: never; Returns: string }
      empresa_invitar_miembro: {
        Args: { p_empresa_id: string; p_rol: string; p_usuario_id: string }
        Returns: string
      }
      empresa_remover_miembro: {
        Args: { p_miembro_id: string }
        Returns: undefined
      }
      empresa_tiene_permiso: {
        Args: { p_empresa_id: string; p_permiso: string }
        Returns: boolean
      }
      encolar_notificacion_conductor: {
        Args: {
          p_cuerpo: string
          p_datos?: Json
          p_destino: string
          p_entidad_id?: string
          p_entidad_tipo?: string
          p_idempotency_key: string
          p_prioridad?: string
          p_tipo: string
          p_titulo: string
          p_usuario_id: string
        }
        Returns: string
      }
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
      escalar_incidencia: {
        Args: { p_incidencia_id: string; p_motivo: string }
        Returns: undefined
      }
      evaluar_salud_tracking: { Args: { p_traslado_id: string }; Returns: Json }
      expediente_conductor_tiene_datos: {
        Args: { p_conductor_id: string }
        Returns: boolean
      }
      finalizar_sesion_tracking: {
        Args: { p_traslado_id: string }
        Returns: string
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
      guardar_preferencia_admin: {
        Args: { p_clave: string; p_valor: Json; p_version_esperada?: number }
        Returns: number
      }
      horario_desde_timestamp: {
        Args: { p_ts: string }
        Returns: Database["public"]["Enums"]["horario_traslado"]
      }
      incidencia_sla_horas: { Args: { p_severidad: string }; Returns: number }
      iniciar_sesion_tracking: {
        Args: { p_traslado_id: string }
        Returns: string
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
      is_superadmin: { Args: never; Returns: boolean }
      listar_conductores_admin_paginados: {
        Args: {
          p_busqueda?: string
          p_estado?: string
          p_pagina?: number
          p_tamano?: number
        }
        Returns: Json
      }
      listar_usuarios_admin_paginados: {
        Args: { p_busqueda?: string; p_pagina?: number; p_tamano?: number }
        Returns: Json
      }
      listar_viajes_admin_paginados: {
        Args: {
          p_busqueda?: string
          p_filtro_estado?: string
          p_orden_columna?: string
          p_orden_direccion?: string
          p_pagina?: number
          p_tamano?: number
        }
        Returns: Json
      }
      marcar_notificacion_leida: {
        Args: { p_notificacion_id: string }
        Returns: undefined
      }
      masivo_clave_dedup: { Args: { p_fila: Json }; Returns: string }
      masivo_hash_fila: {
        Args: { p_fila: Json; p_numero_fila: number }
        Returns: string
      }
      masivo_reporte_errores_csv: {
        Args: { p_carga_id: string }
        Returns: string
      }
      masivo_uuid_idempotencia: {
        Args: { p_carga_id: string; p_numero_fila: number }
        Returns: string
      }
      masivo_validar_archivo: {
        Args: {
          p_hash_archivo: string
          p_mime_type: string
          p_nombre_archivo: string
          p_rol: Database["public"]["Enums"]["rol_admin_operativo"]
          p_tamano_bytes: number
          p_total_filas: number
        }
        Returns: undefined
      }
      masivo_validar_fila: { Args: { p_fila: Json }; Returns: string[] }
      masivo_validar_fila_v2: {
        Args: { p_empresa_id: string; p_fila: Json }
        Returns: string[]
      }
      metricas_registro_conductor_segmento: {
        Args: {
          p_desde: string
          p_dimension: string
          p_empresa_id?: string
          p_fuente?: string
          p_hasta: string
          p_zona?: string
        }
        Returns: Json
      }
      mis_empresas_miembro: { Args: never; Returns: string[] }
      notificar_torre_incidencia: {
        Args: { p_accion: string; p_detalle: string; p_incidencia_id: string }
        Returns: undefined
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
      obtener_metricas_registro_conductor_v2: {
        Args: {
          p_desde?: string
          p_empresa_id?: string
          p_fuente?: string
          p_hasta?: string
          p_zona?: string
        }
        Returns: Json
      }
      obtener_paradas_traslado: {
        Args: { p_traslado_id: string }
        Returns: Json
      }
      obtener_politica_version_app: {
        Args: { p_plataforma: string; p_version_actual: string }
        Returns: Json
      }
      obtener_preferencia_admin: { Args: { p_clave: string }; Returns: Json }
      ofrecer_asignacion: {
        Args: {
          p_conductor_id: string
          p_motivo?: string
          p_traslado_id: string
        }
        Returns: string
      }
      preparar_conductor_e2e: {
        Args: { p_auth_user_id: string; p_conductor_id: string; p_datos: Json }
        Returns: string
      }
      procesar_competencias_asignacion: { Args: never; Returns: Json }
      puede_ver_tarifa_traslado: {
        Args: { p_usuario_id: string }
        Returns: boolean
      }
      rango_desde_distancia: {
        Args: { p_km: number }
        Returns: Database["public"]["Enums"]["rango_distancia"]
      }
      reasignar_conductor: {
        Args: {
          p_motivo?: string
          p_nuevo_conductor_id: string
          p_traslado_id: string
        }
        Returns: string
      }
      recalcular_calificacion_conductor: {
        Args: { p_conductor_id: string }
        Returns: undefined
      }
      rechazar_asignacion: {
        Args: { p_asignacion_id: string; p_motivo?: string }
        Returns: undefined
      }
      rechazar_solicitud_cambio_conductor: {
        Args: { p_motivo: string; p_solicitud_id: string }
        Returns: Json
      }
      rechazar_solicitud_conductor_admin: {
        Args: { p_motivo: string; p_solicitud_id: string }
        Returns: undefined
      }
      rechazar_solicitud_por_verificacion_sistema: {
        Args: {
          p_motivo?: string
          p_solicitud_id: string
          p_verificacion_id: string
        }
        Returns: undefined
      }
      rechazar_usuario_por_verificacion_sistema: {
        Args: {
          p_motivo?: string
          p_usuario_id: string
          p_verificacion_id: string
        }
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
      registrar_acceso_admin_denegado: {
        Args: { p_metodo: string; p_motivo: string; p_ruta: string }
        Returns: undefined
      }
      registrar_apertura_push: {
        Args: { p_device_id: string; p_notificacion_id: string }
        Returns: undefined
      }
      registrar_consentimiento_usuario: {
        Args: {
          p_aceptado_en?: string
          p_canal: string
          p_version: number
          p_version_app: string
        }
        Returns: Json
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
      registrar_dispositivo_push: {
        Args: {
          p_device_id: string
          p_modelo?: string
          p_plataforma?: string
          p_token_push: string
          p_version_app?: string
          p_version_so?: string
        }
        Returns: string
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
      registrar_evento_custodia: {
        Args: {
          p_combustible?: string
          p_firma_metodo?: string
          p_foto_ids?: string[]
          p_inspeccion_id?: string
          p_lat?: number
          p_lng?: number
          p_metadata?: Json
          p_notas?: string
          p_ocurrido_en?: string
          p_odometro?: number
          p_pin_verificado?: boolean
          p_tipo: Database["public"]["Enums"]["tipo_evento_custodia"]
          p_traslado_id: string
        }
        Returns: string
      }
      registrar_evento_operativo_app: {
        Args: { p_detalle?: Json; p_tipo: string; p_version_app: string }
        Returns: string
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
      registrar_evento_registro_conductor_v2: {
        Args: {
          p_codigo?: string
          p_creado_en?: string
          p_duracion_ms?: number
          p_empresa_id?: string
          p_evento: string
          p_fuente?: string
          p_paso?: number
          p_sesion_id: string
          p_zona?: string
        }
        Returns: string
      }
      registrar_heartbeat_tracking: {
        Args: {
          p_bateria_pct?: number
          p_lat: number
          p_lng: number
          p_online?: boolean
          p_plataforma?: string
          p_precision_m?: number
          p_traslado_id: string
          p_velocidad_mps?: number
        }
        Returns: Json
      }
      registrar_permiso_admin_denegado: {
        Args: { p_motivo: string; p_permiso: string }
        Returns: undefined
      }
      registrar_resultado_idempotente: {
        Args: {
          p_clave: string
          p_entidad: string
          p_entidad_id: string
          p_resultado: Json
        }
        Returns: undefined
      }
      registrar_telemetria_lote: {
        Args: { p_puntos: Json; p_traslado_id: string }
        Returns: Json
      }
      resolver_incidencia: {
        Args: {
          p_incidencia_id: string
          p_motivo?: string
          p_severidad?: string
        }
        Returns: undefined
      }
      revisar_documento_conductor_admin: {
        Args: { p_documento_id: string; p_estado: string; p_notas?: string }
        Returns: undefined
      }
      rfc_mexicano_valido: { Args: { p_rfc: string }; Returns: boolean }
      ruta_documento_validada_para_auth: {
        Args: { p_ruta: string }
        Returns: boolean
      }
      ruta_identidad_validada_para_auth: {
        Args: { p_ruta: string }
        Returns: boolean
      }
      sla_categoria_desde_tipo: {
        Args: { p_tipo: string; p_vencido: boolean }
        Returns: string
      }
      sla_horas_operativas_desde: {
        Args: { p_inicio: string; p_pausar?: boolean; p_zona_horaria: string }
        Returns: number
      }
      solicitar_cambio_expediente_conductor: {
        Args: { p_cambios: Json }
        Returns: Json
      }
      solicitud_conductor_datos_completos: {
        Args: { p_solicitud_id: string }
        Returns: boolean
      }
      titular_es_dueno_de_empresa_de_usuario: {
        Args: { p_usuario_id: string }
        Returns: boolean
      }
      traducir_estado_operativo: {
        Args: { e: Database["public"]["Enums"]["estado_traslado"] }
        Returns: Database["public"]["Enums"]["estado_operativo_traslado"]
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
          p_paradas?: Json
          p_traslado: Json
          p_vehiculo: Json
          p_vehiculo_id: string
        }
        Returns: Json
      }
      usuario_crea_traslados_masivos: {
        Args: {
          p_filas: Json
          p_hash_archivo: string
          p_mime_type: string
          p_nombre_archivo: string
          p_tamano_bytes: number
        }
        Returns: Json
      }
      usuario_id_actual: { Args: never; Returns: string }
      usuario_ids_de_traslados_asignados_conductor: {
        Args: never
        Returns: string[]
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
      usuario_procesa_carga_traslados_masivos: {
        Args: { p_carga_id: string; p_limite?: number }
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
      verificar_cadena_custodia: {
        Args: { p_traslado_id: string }
        Returns: boolean
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
      estado_asignacion:
        | "pendiente"
        | "ofrecida"
        | "aceptada"
        | "rechazada"
        | "cancelada"
        | "activa"
        | "completada"
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
      estado_operacion:
        | "borrador"
        | "planificada"
        | "en_curso"
        | "pausada"
        | "cerrada"
        | "cancelada"
      estado_operativo_traslado:
        | "draft"
        | "requested"
        | "confirmed"
        | "planned"
        | "assigned"
        | "pickup_in_progress"
        | "vehicle_received"
        | "in_transit"
        | "delivery_in_progress"
        | "delivered"
        | "closed"
        | "cancelled"
        | "failed"
      estado_pago: "pendiente" | "completado" | "reembolsado" | "fallido"
      estado_payout: "pendiente" | "procesado" | "fallido"
      estado_politica_tarifaria: "borrador" | "vigente" | "archivada"
      estado_reclamo_seguro: "abierto" | "en_revision" | "resuelto"
      estado_solicitud_cambio_conductor:
        | "pendiente"
        | "aprobado"
        | "rechazado"
        | "cancelado"
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
        | "modificacion_masiva_traslados"
        | "modificacion_vehiculo"
        | "consulta_evidencia_vehiculo"
        | "actualizacion_usuario"
        | "actualizacion_conductor"
        | "accion_masiva_admin"
        | "solicitud_cambio_conductor_creada"
        | "solicitud_cambio_conductor_aprobada"
        | "solicitud_cambio_conductor_rechazada"
        | "solicitud_cambio_conductor_cancelada"
        | "actualizacion_perfil_conductor"
        | "oferta_asignacion"
        | "aceptacion_asignacion"
        | "rechazo_asignacion"
        | "cancelacion_asignacion"
        | "reasignacion_conductor"
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
      rol_admin_operativo:
        | "operador"
        | "supervisor"
        | "finanzas"
        | "compliance"
        | "direccion"
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
      tipo_evento_custodia:
        | "pickup_started"
        | "vehicle_inspected"
        | "vehicle_received"
        | "transfer_started"
        | "stop_registered"
        | "incident_reported"
        | "destination_reached"
        | "delivery_inspection"
        | "vehicle_delivered"
        | "delivery_accepted"
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
      tipo_operacion: "corporativa" | "flota" | "evento" | "masiva" | "interna"
      tipo_pago: "anticipado" | "al_cierre"
      tipo_parada: "escala" | "tarea"
      tipo_solicitud_cambio_conductor:
        | "perfil"
        | "curp"
        | "licencia"
        | "licencia_vigencia"
        | "domicilio"
        | "contacto_emergencia"
        | "identidad"
        | "documento"
        | "datos_bancarios"
        | "empresa"
        | "legal"
        | "foto_perfil"
      tipo_tarea_parada:
        | "entrega_parcial"
        | "recoleccion"
        | "tramite"
        | "inspeccion"
        | "carga_descarga"
        | "otro"
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
      estado_asignacion: [
        "pendiente",
        "ofrecida",
        "aceptada",
        "rechazada",
        "cancelada",
        "activa",
        "completada",
      ],
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
      estado_operacion: [
        "borrador",
        "planificada",
        "en_curso",
        "pausada",
        "cerrada",
        "cancelada",
      ],
      estado_operativo_traslado: [
        "draft",
        "requested",
        "confirmed",
        "planned",
        "assigned",
        "pickup_in_progress",
        "vehicle_received",
        "in_transit",
        "delivery_in_progress",
        "delivered",
        "closed",
        "cancelled",
        "failed",
      ],
      estado_pago: ["pendiente", "completado", "reembolsado", "fallido"],
      estado_payout: ["pendiente", "procesado", "fallido"],
      estado_politica_tarifaria: ["borrador", "vigente", "archivada"],
      estado_reclamo_seguro: ["abierto", "en_revision", "resuelto"],
      estado_solicitud_cambio_conductor: [
        "pendiente",
        "aprobado",
        "rechazado",
        "cancelado",
      ],
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
        "modificacion_masiva_traslados",
        "modificacion_vehiculo",
        "consulta_evidencia_vehiculo",
        "actualizacion_usuario",
        "actualizacion_conductor",
        "accion_masiva_admin",
        "solicitud_cambio_conductor_creada",
        "solicitud_cambio_conductor_aprobada",
        "solicitud_cambio_conductor_rechazada",
        "solicitud_cambio_conductor_cancelada",
        "actualizacion_perfil_conductor",
        "oferta_asignacion",
        "aceptacion_asignacion",
        "rechazo_asignacion",
        "cancelacion_asignacion",
        "reasignacion_conductor",
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
      rol_admin_operativo: [
        "operador",
        "supervisor",
        "finanzas",
        "compliance",
        "direccion",
      ],
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
      tipo_evento_custodia: [
        "pickup_started",
        "vehicle_inspected",
        "vehicle_received",
        "transfer_started",
        "stop_registered",
        "incident_reported",
        "destination_reached",
        "delivery_inspection",
        "vehicle_delivered",
        "delivery_accepted",
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
      tipo_operacion: ["corporativa", "flota", "evento", "masiva", "interna"],
      tipo_pago: ["anticipado", "al_cierre"],
      tipo_parada: ["escala", "tarea"],
      tipo_solicitud_cambio_conductor: [
        "perfil",
        "curp",
        "licencia",
        "licencia_vigencia",
        "domicilio",
        "contacto_emergencia",
        "identidad",
        "documento",
        "datos_bancarios",
        "empresa",
        "legal",
        "foto_perfil",
      ],
      tipo_tarea_parada: [
        "entrega_parcial",
        "recoleccion",
        "tramite",
        "inspeccion",
        "carga_descarga",
        "otro",
      ],
      tipo_vehiculo: ["sedan", "suv", "pick_up", "van", "luxury", "coleccion"],
    },
  },
  storage: {
    Enums: {
      buckettype: ["STANDARD", "ANALYTICS", "VECTOR"],
    },
  },
} as const

