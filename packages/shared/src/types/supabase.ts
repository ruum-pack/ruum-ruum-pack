// Tipos de la base de datos de Supabase, en el formato que produce
// `supabase gen types typescript`.
//
// IMPORTANTE: este archivo se escribió a mano, derivado directamente del
// esquema validado en supabase/migrations/0001–0008 (se aplicaron y
// probaron contra una instancia real de Postgres durante el desarrollo).
// NO se generó con el comando oficial porque `supabase gen types --db-url`
// internamente requiere Docker/Podman para levantar el contenedor
// `postgres-meta`, que no estaba disponible en el entorno donde se escribió.
//
// En cuanto tengas Docker Desktop corriendo, reemplázalo con la versión
// canónica:
//   pnpm db:start
//   pnpm db:reset
//   pnpm db:types

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: {
      admins: {
        Row: {
          id: string;
          auth_user_id: string | null;
          nombre: string;
          creado_en: string;
        };
        Insert: {
          id?: string;
          auth_user_id?: string | null;
          nombre: string;
          creado_en?: string;
        };
        Update: {
          id?: string;
          auth_user_id?: string | null;
          nombre?: string;
          creado_en?: string;
        };
        Relationships: [];
      };
      usuarios: {
        Row: {
          id: string;
          auth_user_id: string | null;
          tipo_cuenta: string;
          rol: Database["public"]["Enums"]["rol_usuario"];
          empresa_id: string | null;
          estado_verificacion: Database["public"]["Enums"]["estado_verificacion"];
          traslados_completados_sin_incidencia: number;
          metodo_pago_registrado: boolean;
          creado_en: string;
          actualizado_en: string;
        };
        Insert: {
          id?: string;
          auth_user_id?: string | null;
          tipo_cuenta: string;
          rol?: Database["public"]["Enums"]["rol_usuario"];
          empresa_id?: string | null;
          estado_verificacion?: Database["public"]["Enums"]["estado_verificacion"];
          traslados_completados_sin_incidencia?: number;
          metodo_pago_registrado?: boolean;
          creado_en?: string;
          actualizado_en?: string;
        };
        Update: {
          id?: string;
          auth_user_id?: string | null;
          tipo_cuenta?: string;
          rol?: Database["public"]["Enums"]["rol_usuario"];
          empresa_id?: string | null;
          estado_verificacion?: Database["public"]["Enums"]["estado_verificacion"];
          traslados_completados_sin_incidencia?: number;
          metodo_pago_registrado?: boolean;
          creado_en?: string;
          actualizado_en?: string;
        };
        Relationships: [
          {
            foreignKeyName: "usuarios_empresa_id_fkey";
            columns: ["empresa_id"];
            referencedRelation: "empresas";
            referencedColumns: ["id"];
          }
        ];
      };
      empresas: {
        Row: {
          id: string;
          nombre: string;
          creado_en: string;
          actualizado_en: string;
        };
        Insert: {
          id?: string;
          nombre: string;
          creado_en?: string;
          actualizado_en?: string;
        };
        Update: {
          id?: string;
          nombre?: string;
          creado_en?: string;
          actualizado_en?: string;
        };
        Relationships: [];
      };
      conductores: {
        Row: {
          id: string;
          auth_user_id: string | null;
          nombre: string;
          nivel_por_experiencia: Database["public"]["Enums"]["nivel_concer"];
          nivel_por_calificacion: Database["public"]["Enums"]["nivel_concer"];
          estado: Database["public"]["Enums"]["estado_conductor"];
          calificacion_promedio: number;
          traslados_completados: number;
          suspensiones_activas: number;
          no_presentaciones_6m: number;
          cancelaciones_sin_justificacion_count: number;
          documentos_vigentes: boolean;
          incidencias_graves_6m: number;
          incidencias_graves_12m: number;
          // Columna generada (STORED) — ver migración 0003. Solo lectura.
          nivel_operativo_vigente: Database["public"]["Enums"]["nivel_concer"];
          creado_en: string;
          actualizado_en: string;
        };
        Insert: {
          id?: string;
          auth_user_id?: string | null;
          nombre: string;
          nivel_por_experiencia?: Database["public"]["Enums"]["nivel_concer"];
          nivel_por_calificacion?: Database["public"]["Enums"]["nivel_concer"];
          estado?: Database["public"]["Enums"]["estado_conductor"];
          calificacion_promedio?: number;
          traslados_completados?: number;
          suspensiones_activas?: number;
          no_presentaciones_6m?: number;
          cancelaciones_sin_justificacion_count?: number;
          documentos_vigentes?: boolean;
          incidencias_graves_6m?: number;
          incidencias_graves_12m?: number;
          creado_en?: string;
          actualizado_en?: string;
        };
        Update: {
          id?: string;
          auth_user_id?: string | null;
          nombre?: string;
          nivel_por_experiencia?: Database["public"]["Enums"]["nivel_concer"];
          nivel_por_calificacion?: Database["public"]["Enums"]["nivel_concer"];
          estado?: Database["public"]["Enums"]["estado_conductor"];
          calificacion_promedio?: number;
          traslados_completados?: number;
          suspensiones_activas?: number;
          no_presentaciones_6m?: number;
          cancelaciones_sin_justificacion_count?: number;
          documentos_vigentes?: boolean;
          incidencias_graves_6m?: number;
          incidencias_graves_12m?: number;
          creado_en?: string;
          actualizado_en?: string;
        };
        Relationships: [];
      };
      vehiculos: {
        Row: {
          id: string;
          usuario_id: string;
          tipo: Database["public"]["Enums"]["tipo_vehiculo"];
          marca: string;
          modelo: string;
          anio: number;
          tiene_tarjeta_circulacion: boolean;
          tiene_verificacion: boolean;
          tiene_placas: boolean;
          permiso_especial_vigente: string | null;
          puede_circular_rodando: boolean;
          creado_en: string;
        };
        Insert: {
          id?: string;
          usuario_id: string;
          tipo: Database["public"]["Enums"]["tipo_vehiculo"];
          marca: string;
          modelo: string;
          anio: number;
          tiene_tarjeta_circulacion?: boolean;
          tiene_verificacion?: boolean;
          tiene_placas?: boolean;
          permiso_especial_vigente?: string | null;
          puede_circular_rodando?: boolean;
          creado_en?: string;
        };
        Update: {
          id?: string;
          usuario_id?: string;
          tipo?: Database["public"]["Enums"]["tipo_vehiculo"];
          marca?: string;
          modelo?: string;
          anio?: number;
          tiene_tarjeta_circulacion?: boolean;
          tiene_verificacion?: boolean;
          tiene_placas?: boolean;
          permiso_especial_vigente?: string | null;
          puede_circular_rodando?: boolean;
          creado_en?: string;
        };
        Relationships: [
          {
            foreignKeyName: "vehiculos_usuario_id_fkey";
            columns: ["usuario_id"];
            referencedRelation: "usuarios";
            referencedColumns: ["id"];
          }
        ];
      };
      traslados: {
        Row: {
          id: string;
          estado: Database["public"]["Enums"]["estado_traslado"];
          usuario_id: string;
          vehiculo_id: string;
          conductor_id: string | null;
          contacto_entrega_nombre: string;
          contacto_entrega_telefono: string;
          contacto_recepcion_nombre: string;
          contacto_recepcion_telefono: string;
          origen_lat: number;
          origen_lng: number;
          origen_direccion: string;
          origen_ciudad: string;
          destino_lat: number;
          destino_lng: number;
          destino_direccion: string;
          destino_ciudad: string;
          precio_cotizado: number | null;
          precio_final: number | null;
          tipo_pago: Database["public"]["Enums"]["tipo_pago"];
          causa_fallido: Database["public"]["Enums"]["causa_fallido"] | null;
          tiene_incidencia_abierta: boolean;
          creado_en: string;
          actualizado_en: string;
        };
        Insert: {
          id?: string;
          estado?: Database["public"]["Enums"]["estado_traslado"];
          usuario_id: string;
          vehiculo_id: string;
          conductor_id?: string | null;
          contacto_entrega_nombre: string;
          contacto_entrega_telefono: string;
          contacto_recepcion_nombre: string;
          contacto_recepcion_telefono: string;
          origen_lat: number;
          origen_lng: number;
          origen_direccion: string;
          origen_ciudad: string;
          destino_lat: number;
          destino_lng: number;
          destino_direccion: string;
          destino_ciudad: string;
          precio_cotizado?: number | null;
          precio_final?: number | null;
          tipo_pago?: Database["public"]["Enums"]["tipo_pago"];
          causa_fallido?: Database["public"]["Enums"]["causa_fallido"] | null;
          tiene_incidencia_abierta?: boolean;
          creado_en?: string;
          actualizado_en?: string;
        };
        Update: {
          id?: string;
          estado?: Database["public"]["Enums"]["estado_traslado"];
          usuario_id?: string;
          vehiculo_id?: string;
          conductor_id?: string | null;
          contacto_entrega_nombre?: string;
          contacto_entrega_telefono?: string;
          contacto_recepcion_nombre?: string;
          contacto_recepcion_telefono?: string;
          origen_lat?: number;
          origen_lng?: number;
          origen_direccion?: string;
          origen_ciudad?: string;
          destino_lat?: number;
          destino_lng?: number;
          destino_direccion?: string;
          destino_ciudad?: string;
          precio_cotizado?: number | null;
          precio_final?: number | null;
          tipo_pago?: Database["public"]["Enums"]["tipo_pago"];
          causa_fallido?: Database["public"]["Enums"]["causa_fallido"] | null;
          tiene_incidencia_abierta?: boolean;
          creado_en?: string;
          actualizado_en?: string;
        };
        Relationships: [
          {
            foreignKeyName: "traslados_usuario_id_fkey";
            columns: ["usuario_id"];
            referencedRelation: "usuarios";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "traslados_vehiculo_id_fkey";
            columns: ["vehiculo_id"];
            referencedRelation: "vehiculos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "traslados_conductor_id_fkey";
            columns: ["conductor_id"];
            referencedRelation: "conductores";
            referencedColumns: ["id"];
          }
        ];
      };
      estado_transiciones_validas: {
        Row: {
          estado_actual: Database["public"]["Enums"]["estado_traslado"];
          estado_siguiente: Database["public"]["Enums"]["estado_traslado"];
        };
        Insert: {
          estado_actual: Database["public"]["Enums"]["estado_traslado"];
          estado_siguiente: Database["public"]["Enums"]["estado_traslado"];
        };
        Update: {
          estado_actual?: Database["public"]["Enums"]["estado_traslado"];
          estado_siguiente?: Database["public"]["Enums"]["estado_traslado"];
        };
        Relationships: [];
      };
      evidencia_fotos: {
        Row: {
          id: string;
          traslado_id: string;
          tipo: Database["public"]["Enums"]["tipo_evidencia"];
          angulo: Database["public"]["Enums"]["angulo_evidencia"];
          url: string | null;
          local_path: string | null;
          capturada_en: string;
          lat: number | null;
          lng: number | null;
          sincronizada: boolean;
        };
        Insert: {
          id?: string;
          traslado_id: string;
          tipo: Database["public"]["Enums"]["tipo_evidencia"];
          angulo: Database["public"]["Enums"]["angulo_evidencia"];
          url?: string | null;
          local_path?: string | null;
          capturada_en?: string;
          lat?: number | null;
          lng?: number | null;
          sincronizada?: boolean;
        };
        Update: {
          id?: string;
          traslado_id?: string;
          tipo?: Database["public"]["Enums"]["tipo_evidencia"];
          angulo?: Database["public"]["Enums"]["angulo_evidencia"];
          url?: string | null;
          local_path?: string | null;
          capturada_en?: string;
          lat?: number | null;
          lng?: number | null;
          sincronizada?: boolean;
        };
        Relationships: [
          {
            foreignKeyName: "evidencia_fotos_traslado_id_fkey";
            columns: ["traslado_id"];
            referencedRelation: "traslados";
            referencedColumns: ["id"];
          }
        ];
      };
      pagos: {
        Row: {
          id: string;
          traslado_id: string;
          monto: number;
          momento: Database["public"]["Enums"]["momento_pago"];
          estado: Database["public"]["Enums"]["estado_pago"];
          metodo: string;
          registrado_en: string;
        };
        Insert: {
          id?: string;
          traslado_id: string;
          monto: number;
          momento: Database["public"]["Enums"]["momento_pago"];
          estado?: Database["public"]["Enums"]["estado_pago"];
          metodo: string;
          registrado_en?: string;
        };
        Update: {
          id?: string;
          traslado_id?: string;
          monto?: number;
          momento?: Database["public"]["Enums"]["momento_pago"];
          estado?: Database["public"]["Enums"]["estado_pago"];
          metodo?: string;
          registrado_en?: string;
        };
        Relationships: [
          {
            foreignKeyName: "pagos_traslado_id_fkey";
            columns: ["traslado_id"];
            referencedRelation: "traslados";
            referencedColumns: ["id"];
          }
        ];
      };
      incidencias: {
        Row: {
          id: string;
          traslado_id: string;
          tipo: Database["public"]["Enums"]["tipo_incidencia"];
          momento: Database["public"]["Enums"]["momento_incidencia"];
          reportada_por: Database["public"]["Enums"]["actor_reporte"];
          descripcion: string;
          resuelta: boolean;
          creada_en: string;
          resuelta_en: string | null;
        };
        Insert: {
          id?: string;
          traslado_id: string;
          tipo: Database["public"]["Enums"]["tipo_incidencia"];
          momento: Database["public"]["Enums"]["momento_incidencia"];
          reportada_por: Database["public"]["Enums"]["actor_reporte"];
          descripcion: string;
          resuelta?: boolean;
          creada_en?: string;
          resuelta_en?: string | null;
        };
        Update: {
          id?: string;
          traslado_id?: string;
          tipo?: Database["public"]["Enums"]["tipo_incidencia"];
          momento?: Database["public"]["Enums"]["momento_incidencia"];
          reportada_por?: Database["public"]["Enums"]["actor_reporte"];
          descripcion?: string;
          resuelta?: boolean;
          creada_en?: string;
          resuelta_en?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "incidencias_traslado_id_fkey";
            columns: ["traslado_id"];
            referencedRelation: "traslados";
            referencedColumns: ["id"];
          }
        ];
      };
      calificaciones_traslado: {
        Row: {
          traslado_id: string;
          conductor_id: string;
          estrellas: number;
          comentario: string | null;
          calificado_en: string;
        };
        Insert: {
          traslado_id: string;
          conductor_id: string;
          estrellas: number;
          comentario?: string | null;
          calificado_en?: string;
        };
        Update: {
          traslado_id?: string;
          conductor_id?: string;
          estrellas?: number;
          comentario?: string | null;
          calificado_en?: string;
        };
        Relationships: [
          {
            foreignKeyName: "calificaciones_traslado_traslado_id_fkey";
            columns: ["traslado_id"];
            referencedRelation: "traslados";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "calificaciones_traslado_conductor_id_fkey";
            columns: ["conductor_id"];
            referencedRelation: "conductores";
            referencedColumns: ["id"];
          }
        ];
      };
      modo_prueba_supervisada: {
        Row: {
          id: string;
          conductor_id: string;
          traslados_asignados: number;
          traslados_completados: number;
          iniciado_en: string;
          finalizado_en: string | null;
          recuperado: boolean | null;
        };
        Insert: {
          id?: string;
          conductor_id: string;
          traslados_asignados: number;
          traslados_completados?: number;
          iniciado_en?: string;
          finalizado_en?: string | null;
          recuperado?: boolean | null;
        };
        Update: {
          id?: string;
          conductor_id?: string;
          traslados_asignados?: number;
          traslados_completados?: number;
          iniciado_en?: string;
          finalizado_en?: string | null;
          recuperado?: boolean | null;
        };
        Relationships: [
          {
            foreignKeyName: "modo_prueba_supervisada_conductor_id_fkey";
            columns: ["conductor_id"];
            referencedRelation: "conductores";
            referencedColumns: ["id"];
          }
        ];
      };
      disputas: {
        Row: {
          id: string;
          traslado_id: string;
          abierta_por: Database["public"]["Enums"]["abierta_por_actor"];
          tipo: Database["public"]["Enums"]["tipo_disputa"];
          estado: Database["public"]["Enums"]["estado_disputa"];
          resolucion: Database["public"]["Enums"]["resolucion_disputa"] | null;
          abierta_en: string;
          resuelta_en: string | null;
          escalada_en: string | null;
        };
        Insert: {
          id?: string;
          traslado_id: string;
          abierta_por: Database["public"]["Enums"]["abierta_por_actor"];
          tipo: Database["public"]["Enums"]["tipo_disputa"];
          estado?: Database["public"]["Enums"]["estado_disputa"];
          resolucion?: Database["public"]["Enums"]["resolucion_disputa"] | null;
          abierta_en?: string;
          resuelta_en?: string | null;
          escalada_en?: string | null;
        };
        Update: {
          id?: string;
          traslado_id?: string;
          abierta_por?: Database["public"]["Enums"]["abierta_por_actor"];
          tipo?: Database["public"]["Enums"]["tipo_disputa"];
          estado?: Database["public"]["Enums"]["estado_disputa"];
          resolucion?: Database["public"]["Enums"]["resolucion_disputa"] | null;
          abierta_en?: string;
          resuelta_en?: string | null;
          escalada_en?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "disputas_traslado_id_fkey";
            columns: ["traslado_id"];
            referencedRelation: "traslados";
            referencedColumns: ["id"];
          }
        ];
      };
      reclamos_seguro: {
        Row: {
          id: string;
          traslado_id: string;
          estado: Database["public"]["Enums"]["estado_reclamo_seguro"];
          abierto_en: string;
          resuelto_en: string | null;
          responsable_pago: string | null;
          notas_admin: string | null;
        };
        Insert: {
          id?: string;
          traslado_id: string;
          estado?: Database["public"]["Enums"]["estado_reclamo_seguro"];
          abierto_en?: string;
          resuelto_en?: string | null;
          responsable_pago?: string | null;
          notas_admin?: string | null;
        };
        Update: {
          id?: string;
          traslado_id?: string;
          estado?: Database["public"]["Enums"]["estado_reclamo_seguro"];
          abierto_en?: string;
          resuelto_en?: string | null;
          responsable_pago?: string | null;
          notas_admin?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "reclamos_seguro_traslado_id_fkey";
            columns: ["traslado_id"];
            referencedRelation: "traslados";
            referencedColumns: ["id"];
          }
        ];
      };
      mensajes_chat: {
        Row: {
          id: string;
          traslado_id: string;
          remitente: Database["public"]["Enums"]["remitente_chat"];
          contenido: string;
          enviado_en: string;
          reportado: boolean;
        };
        Insert: {
          id?: string;
          traslado_id: string;
          remitente: Database["public"]["Enums"]["remitente_chat"];
          contenido: string;
          enviado_en?: string;
          reportado?: boolean;
        };
        Update: {
          id?: string;
          traslado_id?: string;
          remitente?: Database["public"]["Enums"]["remitente_chat"];
          contenido?: string;
          enviado_en?: string;
          reportado?: boolean;
        };
        Relationships: [
          {
            foreignKeyName: "mensajes_chat_traslado_id_fkey";
            columns: ["traslado_id"];
            referencedRelation: "traslados";
            referencedColumns: ["id"];
          }
        ];
      };
      llamadas_enmascaradas: {
        Row: {
          id: string;
          traslado_id: string;
          iniciada_por: Database["public"]["Enums"]["remitente_chat"];
          numero_virtual: string;
          duracion_segundos: number | null;
          iniciada_en: string;
          finalizada_en: string | null;
        };
        Insert: {
          id?: string;
          traslado_id: string;
          iniciada_por: Database["public"]["Enums"]["remitente_chat"];
          numero_virtual: string;
          duracion_segundos?: number | null;
          iniciada_en?: string;
          finalizada_en?: string | null;
        };
        Update: {
          id?: string;
          traslado_id?: string;
          iniciada_por?: Database["public"]["Enums"]["remitente_chat"];
          numero_virtual?: string;
          duracion_segundos?: number | null;
          iniciada_en?: string;
          finalizada_en?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "llamadas_enmascaradas_traslado_id_fkey";
            columns: ["traslado_id"];
            referencedRelation: "traslados";
            referencedColumns: ["id"];
          }
        ];
      };
      registro_auditoria: {
        Row: {
          id: string;
          traslado_id: string | null;
          evento: Database["public"]["Enums"]["evento_auditable"];
          actor: Database["public"]["Enums"]["actor_auditoria"];
          actor_id: string;
          datos: Json;
          ip: string | null;
          dispositivo: string | null;
          timestamp: string;
        };
        Insert: {
          id?: string;
          traslado_id?: string | null;
          evento: Database["public"]["Enums"]["evento_auditable"];
          actor: Database["public"]["Enums"]["actor_auditoria"];
          actor_id: string;
          datos?: Json;
          ip?: string | null;
          dispositivo?: string | null;
          timestamp?: string;
        };
        Update: {
          id?: string;
          traslado_id?: string | null;
          evento?: Database["public"]["Enums"]["evento_auditable"];
          actor?: Database["public"]["Enums"]["actor_auditoria"];
          actor_id?: string;
          datos?: Json;
          ip?: string | null;
          dispositivo?: string | null;
          timestamp?: string;
        };
        Relationships: [
          {
            foreignKeyName: "registro_auditoria_traslado_id_fkey";
            columns: ["traslado_id"];
            referencedRelation: "traslados";
            referencedColumns: ["id"];
          }
        ];
      };
      notas_internas_traslado: {
        Row: {
          id: string;
          traslado_id: string;
          admin_id: string;
          contenido: string;
          creada_en: string;
        };
        Insert: {
          id?: string;
          traslado_id: string;
          admin_id: string;
          contenido: string;
          creada_en?: string;
        };
        Update: {
          id?: string;
          traslado_id?: string;
          admin_id?: string;
          contenido?: string;
          creada_en?: string;
        };
        Relationships: [
          {
            foreignKeyName: "notas_internas_traslado_traslado_id_fkey";
            columns: ["traslado_id"];
            referencedRelation: "traslados";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "notas_internas_traslado_admin_id_fkey";
            columns: ["admin_id"];
            referencedRelation: "admins";
            referencedColumns: ["id"];
          }
        ];
      };
    };
    Views: {
      // PRD §5.1 — Pasaporte Digital de Traslado (migración 0008). Vista de
      // solo lectura con security_invoker = true (respeta el RLS de cada
      // tabla subyacente).
      pasaporte_digital: {
        Row: {
          traslado_id: string;
          usuario_id: string;
          vehiculo_id: string;
          conductor_id: string | null;
          estado: Database["public"]["Enums"]["estado_traslado"];
          tiene_incidencia_abierta: boolean;
          tipo_pago: Database["public"]["Enums"]["tipo_pago"];
          causa_fallido: Database["public"]["Enums"]["causa_fallido"] | null;
          precio_cotizado: number | null;
          precio_final: number | null;
          creado_en: string;
          actualizado_en: string;
          vehiculo_tipo: Database["public"]["Enums"]["tipo_vehiculo"] | null;
          vehiculo_marca: string | null;
          vehiculo_modelo: string | null;
          vehiculo_anio: number | null;
          conductor_nombre: string | null;
          conductor_estado: Database["public"]["Enums"]["estado_conductor"] | null;
          conductor_nivel: Database["public"]["Enums"]["nivel_concer"] | null;
          conductor_calificacion: number | null;
          evidencia_inicial_fotos_sincronizadas: number;
          evidencia_final_fotos_sincronizadas: number;
          incidencias_abiertas: number;
          monto_pagado: number;
        };
        Relationships: [];
      };
    };
    Functions: {
      es_admin: {
        Args: Record<string, never>;
        Returns: boolean;
      };
      recalcular_calificacion_conductor: {
        Args: { p_conductor_id: string };
        Returns: undefined;
      };
    };
    Enums: {
      rol_usuario: "personal" | "titular_empresa" | "usuario_autorizado";
      estado_verificacion: "pendiente" | "en_revision" | "verificado" | "rechazado";
      nivel_concer: "basico" | "ejecutivo" | "luxury" | "coleccion";
      estado_conductor:
        | "activo"
        | "suspendido_7d"
        | "suspendido_14d"
        | "suspendido_30d"
        | "suspendido_indefinido"
        | "bloqueado_permanente"
        | "modo_prueba_supervisada"
        | "pendiente_verificacion";
      tipo_vehiculo: "sedan" | "suv" | "pick_up" | "van" | "luxury" | "coleccion";
      estado_traslado:
        | "usuario_pendiente_verificacion"
        | "usuario_verificado"
        | "solicitud_creada"
        | "documentacion_pendiente"
        | "documentacion_en_revision"
        | "documentacion_validada"
        | "cotizacion_generada"
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
        | "disputa_resuelta";
      causa_fallido: "imputable_cliente" | "operativo" | "fuerza_mayor" | "documentacion" | "vehiculo_no_circulable";
      tipo_pago: "anticipado" | "al_cierre";
      tipo_evidencia: "inicial" | "final";
      angulo_evidencia: "frente" | "lado_piloto" | "lado_copiloto" | "trasera" | "tablero" | "dano_previo" | "adicional";
      momento_pago: "anticipado" | "al_cierre";
      estado_pago: "pendiente" | "completado" | "reembolsado" | "fallido";
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
        | "dano_no_reportado";
      momento_incidencia: "recoleccion" | "durante_traslado" | "entrega" | "post_cierre";
      actor_reporte: "usuario" | "conductor" | "admin" | "sistema";
      tipo_disputa:
        | "cobro_incorrecto"
        | "cancelacion_fuera_de_politica"
        | "dano_no_reconocido"
        | "no_presentacion"
        | "calificacion_injusta";
      estado_disputa: "abierta" | "en_revision" | "resuelta" | "escalada" | "resuelta_senior";
      resolucion_disputa: "favor_reclamante" | "en_contra" | "solucion_parcial";
      abierta_por_actor: "usuario" | "conductor";
      estado_reclamo_seguro: "abierto" | "en_revision" | "resuelto";
      remitente_chat: "usuario" | "conductor";
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
        | "resultado_modo_prueba_supervisada";
      actor_auditoria: "usuario" | "conductor" | "admin" | "sistema";
    };
    CompositeTypes: Record<string, never>;
  };
}
