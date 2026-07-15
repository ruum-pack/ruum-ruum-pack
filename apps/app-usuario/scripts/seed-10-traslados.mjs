import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const USER_EMAIL = process.env.SEED_USER_EMAIL;
const USER_PASSWORD = process.env.SEED_USER_PASSWORD;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !USER_EMAIL || !USER_PASSWORD) {
  throw new Error("Faltan envs: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SEED_USER_EMAIL, SEED_USER_PASSWORD");
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const { error: loginError } = await supabase.auth.signInWithPassword({
  email: USER_EMAIL,
  password: USER_PASSWORD
});

if (loginError) throw loginError;

const seeds = [
  // pega aqui el arreglo que te pasé
];

for (const seed of seeds) {
  const { data, error } = await supabase.rpc("usuario_crea_traslado", {
    p_vehiculo_id: null,
    p_vehiculo: seed.vehiculo,
    p_traslado: seed.traslado,
    p_clave_idempotencia: randomUUID()
  });

  if (error) {
    console.error("Error creando traslado:", seed.claveIdempotencia, error.message);
    continue;
  }

  console.log("Traslado creado:", data?.id ?? data);
}