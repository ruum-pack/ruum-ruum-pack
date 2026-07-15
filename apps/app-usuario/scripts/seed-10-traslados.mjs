import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const envLocal = leerEnvLocal(resolve(scriptDir, "..", ".env.local"));

const SUPABASE_URL = valorEnv("NEXT_PUBLIC_SUPABASE_URL");
const SUPABASE_ANON_KEY = valorEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");
const USER_EMAIL = process.env.SEED_USER_EMAIL;
const USER_PASSWORD = process.env.SEED_USER_PASSWORD;

function leerEnvLocal(ruta) {
  try {
    return Object.fromEntries(
      readFileSync(ruta, "utf8")
        .split(/\r?\n/)
        .map((linea) => linea.trim())
        .filter((linea) => linea && !linea.startsWith("#") && linea.includes("="))
        .map((linea) => {
          const [clave, ...resto] = linea.split("=");
          return [clave, resto.join("=").replace(/^["']|["']$/g, "")];
        })
    );
  } catch {
    return {};
  }
}

function valorEnv(nombre) {
  const valor = process.env[nombre];
  if (!valor || valor.startsWith("TU_")) return envLocal[nombre];
  return valor;
}

if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !USER_EMAIL || !USER_PASSWORD) {
  throw new Error("Faltan envs: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SEED_USER_EMAIL, SEED_USER_PASSWORD");
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const seeds = [
  {
    claveIdempotencia: "seed-traslado-001",
    vehiculo: { marca: "Toyota", modelo: "Corolla", anio: 2022, color: "Blanco", placas: "ABC123A", vin: "JTDBR32E720123001", tipo: "sedan", transmision: "automatica", condicion: "seminueva", tiene_tarjeta_circulacion: true, tiene_verificacion: true, tiene_placas: true, puede_circular_rodando: true },
    traslado: { origen_direccion: "Av. Insurgentes Sur 1458, Actipan", origen_ciudad: "Ciudad de Mexico, CDMX", origen_lat: 19.3719, origen_lng: -99.1775, origen_referencias: "Frente a Plaza Manacar", destino_direccion: "Av. Patria 1891, Jardines Universidad", destino_ciudad: "Zapopan, Jalisco", destino_lat: 20.7025, destino_lng: -103.4159, destino_referencias: "Entrada por caseta principal", contacto_entrega_nombre: "Carlos Mendoza", contacto_entrega_telefono: "+525512345678", contacto_recepcion_nombre: "Ana Rodriguez", contacto_recepcion_telefono: "+523331234567", fecha_hora_programada: "2026-07-16T10:00:00-06:00", modalidad_programacion: "programado", tipo_ruta: "foraneo", distancia_estimada_km: 545, tiempo_estimado_min: 390, tipo_servicio: "personal", motivo_servicio: "entrega_cliente", instrucciones_especiales: "Confirmar nivel de gasolina antes de salir." }
  },
  {
    claveIdempotencia: "seed-traslado-002",
    vehiculo: { marca: "Nissan", modelo: "Versa", anio: 2021, color: "Gris", placas: "NVA452B", vin: "3N1CN7AD1ML123002", tipo: "sedan", transmision: "manual", condicion: "seminueva", tiene_tarjeta_circulacion: true, tiene_verificacion: true, tiene_placas: true, puede_circular_rodando: true },
    traslado: { origen_direccion: "Calle Montecito 38, Napoles", origen_ciudad: "Ciudad de Mexico, CDMX", origen_lat: 19.3947, origen_lng: -99.1742, origen_referencias: "Junto al WTC", destino_direccion: "Blvd. Bernardo Quintana 4100, Centro Sur", destino_ciudad: "Queretaro, Queretaro", destino_lat: 20.5666, destino_lng: -100.3683, destino_referencias: "Recepcion de flotilla", contacto_entrega_nombre: "Mariana Torres", contacto_entrega_telefono: "+525598765432", contacto_recepcion_nombre: "Jorge Palacios", contacto_recepcion_telefono: "+524421234567", fecha_hora_programada: "2026-07-16T14:30:00-06:00", modalidad_programacion: "programado", tipo_ruta: "foraneo", distancia_estimada_km: 218, tiempo_estimado_min: 170, tipo_servicio: "empresarial", motivo_servicio: "traslado_especial", instrucciones_especiales: "Solicitar identificacion al entregar." }
  },
  {
    claveIdempotencia: "seed-traslado-003",
    vehiculo: { marca: "Mazda", modelo: "CX-5", anio: 2023, color: "Rojo", placas: "MZD909C", vin: "JM3KFBDM1P0123003", tipo: "suv", transmision: "automatica", condicion: "nueva", tiene_tarjeta_circulacion: true, tiene_verificacion: true, tiene_placas: true, puede_circular_rodando: true },
    traslado: { origen_direccion: "Av. Universidad 1001, Del Valle", origen_ciudad: "Ciudad de Mexico, CDMX", origen_lat: 19.3727, origen_lng: -99.1632, origen_referencias: "Agencia Mazda", destino_direccion: "Av. Tecnologico 650, San Salvador Tizatlalli", destino_ciudad: "Metepec, Estado de Mexico", destino_lat: 19.2676, destino_lng: -99.5998, destino_referencias: "Casa con porton negro", contacto_entrega_nombre: "Luis Herrera", contacto_entrega_telefono: "+525544332211", contacto_recepcion_nombre: "Patricia Gomez", contacto_recepcion_telefono: "+527221234567", fecha_hora_programada: "2026-07-17T09:00:00-06:00", modalidad_programacion: "programado", tipo_ruta: "foraneo", distancia_estimada_km: 62, tiempo_estimado_min: 75, tipo_servicio: "agencia", motivo_servicio: "entrega_cliente", instrucciones_especiales: "Vehiculo nuevo, no retirar plasticos interiores." }
  },
  {
    claveIdempotencia: "seed-traslado-004",
    vehiculo: { marca: "Volkswagen", modelo: "Jetta", anio: 2020, color: "Azul", placas: "VWK771D", vin: "3VW2B7AJ0LM123004", tipo: "sedan", transmision: "automatica", condicion: "seminueva", tiene_tarjeta_circulacion: true, tiene_verificacion: true, tiene_placas: true, puede_circular_rodando: true },
    traslado: { origen_direccion: "Av. Paseo de la Reforma 250, Juarez", origen_ciudad: "Ciudad de Mexico, CDMX", origen_lat: 19.4269, origen_lng: -99.1677, origen_referencias: "Lobby torre corporativa", destino_direccion: "Av. Cuitlahuac 3102, Claveria", destino_ciudad: "Ciudad de Mexico, CDMX", destino_lat: 19.4666, destino_lng: -99.1815, destino_referencias: "Estacionamiento sotano 1", contacto_entrega_nombre: "Ricardo Salinas", contacto_entrega_telefono: "+525576543210", contacto_recepcion_nombre: "Elena Rivas", contacto_recepcion_telefono: "+525565432109", fecha_hora_programada: null, modalidad_programacion: "lo_antes_posible", tipo_ruta: "local", distancia_estimada_km: 11, tiempo_estimado_min: 35, tipo_servicio: "empresarial", motivo_servicio: "recuperacion", instrucciones_especiales: "Recoger llaves en recepcion con folio R-004." }
  },
  {
    claveIdempotencia: "seed-traslado-005",
    vehiculo: { marca: "Honda", modelo: "CR-V", anio: 2019, color: "Negro", placas: "HND502E", vin: "2HKRW2H58KH123005", tipo: "suv", transmision: "automatica", condicion: "seminueva", tiene_tarjeta_circulacion: true, tiene_verificacion: true, tiene_placas: true, puede_circular_rodando: true },
    traslado: { origen_direccion: "Av. Lazaro Cardenas 2400, Valle Oriente", origen_ciudad: "San Pedro Garza Garcia, Nuevo Leon", origen_lat: 25.6471, origen_lng: -100.3272, origen_referencias: "Centro comercial, acceso norte", destino_direccion: "Blvd. Independencia 1300, Estrella", destino_ciudad: "Torreon, Coahuila", destino_lat: 25.5379, destino_lng: -103.4333, destino_referencias: "Bodega 3", contacto_entrega_nombre: "Sofia Villarreal", contacto_entrega_telefono: "+528181234567", contacto_recepcion_nombre: "Manuel Garza", contacto_recepcion_telefono: "+528711234567", fecha_hora_programada: "2026-07-18T08:30:00-06:00", modalidad_programacion: "programado", tipo_ruta: "foraneo", distancia_estimada_km: 335, tiempo_estimado_min: 270, tipo_servicio: "flotilla", motivo_servicio: "traslado_especial", instrucciones_especiales: "Entregar con inventario firmado." }
  },
  {
    claveIdempotencia: "seed-traslado-006",
    vehiculo: { marca: "Ford", modelo: "Ranger", anio: 2024, color: "Plata", placas: "FRD612F", vin: "1FTER4FH3RLE23006", tipo: "pick_up", transmision: "automatica", condicion: "nueva", tiene_tarjeta_circulacion: true, tiene_verificacion: true, tiene_placas: true, puede_circular_rodando: true },
    traslado: { origen_direccion: "Periferico Sur 4110, Jardines del Pedregal", origen_ciudad: "Ciudad de Mexico, CDMX", origen_lat: 19.3074, origen_lng: -99.2114, origen_referencias: "Agencia Ford, area de entregas", destino_direccion: "Av. Juarez 2920, La Paz", destino_ciudad: "Puebla, Puebla", destino_lat: 19.0538, destino_lng: -98.2325, destino_referencias: "Recepcion de taller", contacto_entrega_nombre: "Hector Molina", contacto_entrega_telefono: "+525512398765", contacto_recepcion_nombre: "Claudia Benitez", contacto_recepcion_telefono: "+522221234567", fecha_hora_programada: "2026-07-18T12:00:00-06:00", modalidad_programacion: "programado", tipo_ruta: "foraneo", distancia_estimada_km: 135, tiempo_estimado_min: 125, tipo_servicio: "agencia", motivo_servicio: "entrega_cliente", instrucciones_especiales: "No exceder 90 km/h por unidad nueva." }
  },
  {
    claveIdempotencia: "seed-traslado-007",
    vehiculo: { marca: "Kia", modelo: "Seltos", anio: 2022, color: "Verde", placas: "KIA733G", vin: "KNDEPCAA5N7123007", tipo: "suv", transmision: "automatica", condicion: "seminueva", tiene_tarjeta_circulacion: true, tiene_verificacion: true, tiene_placas: true, puede_circular_rodando: true },
    traslado: { origen_direccion: "Av. Americas 1254, Country Club", origen_ciudad: "Guadalajara, Jalisco", origen_lat: 20.7014, origen_lng: -103.3759, origen_referencias: "Valet parking", destino_direccion: "Av. Madero Poniente 3500, Camelinas", destino_ciudad: "Morelia, Michoacan", destino_lat: 19.7034, destino_lng: -101.2272, destino_referencias: "Entrada lateral de oficinas", contacto_entrega_nombre: "Daniela Castro", contacto_entrega_telefono: "+523312345678", contacto_recepcion_nombre: "Oscar Nunez", contacto_recepcion_telefono: "+524431234567", fecha_hora_programada: "2026-07-19T09:30:00-06:00", modalidad_programacion: "programado", tipo_ruta: "foraneo", distancia_estimada_km: 290, tiempo_estimado_min: 240, tipo_servicio: "personal", motivo_servicio: "entrega_cliente", instrucciones_especiales: "Llamar 20 minutos antes de llegada." }
  },
  {
    claveIdempotencia: "seed-traslado-008",
    vehiculo: { marca: "Chevrolet", modelo: "Aveo", anio: 2018, color: "Rojo vino", placas: "CHV814H", vin: "LSGHD52H8JD123008", tipo: "sedan", transmision: "manual", condicion: "rescate_mecanico", tiene_tarjeta_circulacion: true, tiene_verificacion: false, tiene_placas: true, puede_circular_rodando: true },
    traslado: { origen_direccion: "Calz. Ermita Iztapalapa 1800, San Miguel", origen_ciudad: "Ciudad de Mexico, CDMX", origen_lat: 19.3588, origen_lng: -99.0928, origen_referencias: "Taller mecanico El Piston", destino_direccion: "Av. Central 120, Industrial Alce Blanco", destino_ciudad: "Naucalpan, Estado de Mexico", destino_lat: 19.4722, destino_lng: -99.2208, destino_referencias: "Patio de resguardo", contacto_entrega_nombre: "Ruben Aguilar", contacto_entrega_telefono: "+525534567890", contacto_recepcion_nombre: "Laura Camacho", contacto_recepcion_telefono: "+525545678901", fecha_hora_programada: null, modalidad_programacion: "lo_antes_posible", tipo_ruta: "local", distancia_estimada_km: 32, tiempo_estimado_min: 80, tipo_servicio: "lote", motivo_servicio: "recuperacion", instrucciones_especiales: "Unidad con testigo encendido; revisar antes de circular." }
  },
  {
    claveIdempotencia: "seed-traslado-009",
    vehiculo: { marca: "Tesla", modelo: "Model 3", anio: 2023, color: "Blanco perla", placas: "ELC901I", vin: "5YJ3E1EA7PF123009", tipo: "luxury", transmision: "electrica", condicion: "seminueva", tiene_tarjeta_circulacion: true, tiene_verificacion: true, tiene_placas: true, puede_circular_rodando: true },
    traslado: { origen_direccion: "Av. Real Acueducto 360, Puerta de Hierro", origen_ciudad: "Zapopan, Jalisco", origen_lat: 20.7103, origen_lng: -103.4122, origen_referencias: "Torre corporativa, lobby", destino_direccion: "Av. Manuel J. Clouthier 245, Jardines del Campestre", destino_ciudad: "Leon, Guanajuato", destino_lat: 21.1506, destino_lng: -101.7114, destino_referencias: "Casa club", contacto_entrega_nombre: "Andres Valle", contacto_entrega_telefono: "+523398765432", contacto_recepcion_nombre: "Monica Paredes", contacto_recepcion_telefono: "+524771234567", fecha_hora_programada: "2026-07-20T11:00:00-06:00", modalidad_programacion: "programado", tipo_ruta: "foraneo", distancia_estimada_km: 230, tiempo_estimado_min: 210, tipo_servicio: "personal", motivo_servicio: "traslado_especial", instrucciones_especiales: "Verificar carga minima del 80% antes de salida." }
  },
  {
    claveIdempotencia: "seed-traslado-010",
    vehiculo: { marca: "Mercedes-Benz", modelo: "Sprinter", anio: 2021, color: "Negro", placas: "MBZ210J", vin: "WD3PF4CC1M5123010", tipo: "van", transmision: "automatica", condicion: "seminueva", tiene_tarjeta_circulacion: true, tiene_verificacion: true, tiene_placas: true, puede_circular_rodando: true },
    traslado: { origen_direccion: "Av. Constituyentes 1000, Lomas Altas", origen_ciudad: "Ciudad de Mexico, CDMX", origen_lat: 19.4043, origen_lng: -99.2288, origen_referencias: "Patio de flotilla empresarial", destino_direccion: "Carretera Nacional 5000, El Uro", destino_ciudad: "Monterrey, Nuevo Leon", destino_lat: 25.5578, destino_lng: -100.2347, destino_referencias: "Acceso por seguridad privada", contacto_entrega_nombre: "Fernanda Soto", contacto_entrega_telefono: "+525587654321", contacto_recepcion_nombre: "Alberto Medina", contacto_recepcion_telefono: "+528123456789", fecha_hora_programada: "2026-07-21T07:30:00-06:00", modalidad_programacion: "programado", tipo_ruta: "foraneo", distancia_estimada_km: 915, tiempo_estimado_min: 660, tipo_servicio: "flotilla", motivo_servicio: "traslado_especial", instrucciones_especiales: "Unidad grande; validar altura en estacionamientos." }
  }
];

console.log(`Iniciando sesion como ${USER_EMAIL}...`);

const { error: loginError } = await supabase.auth.signInWithPassword({
  email: USER_EMAIL,
  password: USER_PASSWORD
});

if (loginError) throw loginError;

console.log(`Sesion iniciada. Creando ${seeds.length} traslados...`);

let creados = 0;
let fallidos = 0;

for (const seed of seeds) {
  const { data, error } = await supabase.rpc("usuario_crea_traslado", {
    p_vehiculo_id: null,
    p_vehiculo: seed.vehiculo,
    p_traslado: seed.traslado,
    p_clave_idempotencia: randomUUID()
  });

  if (error) {
    fallidos += 1;
    console.error(`[ERROR] ${seed.claveIdempotencia}: ${error.message}`);
    continue;
  }

  const trasladoId = data?.id;
  if (trasladoId && data?.tipo_pago === "anticipado") {
    const monto = Number(data.precio_cotizado ?? 0);
    const { error: pagoError } = await supabase.from("pagos").insert({
      traslado_id: trasladoId,
      monto,
      momento: "anticipado",
      estado: "completado",
      metodo: "stripe_seed"
    });

    if (pagoError) {
      fallidos += 1;
      console.error(`[ERROR] ${seed.claveIdempotencia}: traslado creado pero no se pudo registrar pago seed: ${pagoError.message}`);
      continue;
    }
  }

  creados += 1;
  console.log(`[OK] ${seed.claveIdempotencia}: ${data?.id ?? JSON.stringify(data)}`);
}

console.log(`Listo. Creados: ${creados}. Fallidos: ${fallidos}.`);
