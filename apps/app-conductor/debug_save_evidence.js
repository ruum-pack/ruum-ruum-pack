import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config({ path: "./.env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const trasladoId = "e8cc2f55-7e92-4d4b-b522-10b408c87d97"; // The pending offer we created earlier

  console.log("--- Simulating upsert of evidence_inspecciones under Service Role ---");
  const { data: upsertData, error: upsertError } = await supabase
    .from("evidencia_inspecciones")
    .upsert({
      traslado_id: trasladoId,
      tipo: "inicial",
      combustible: "1/2",
      kilometraje: 48213,
      llaves_recibidas: "2",
      holograma_verificacion: false,
      talon_verificacion: "si",
      tarjeta_circulacion: "si",
      placa_delantera: "si",
      placa_trasera: "si",
      notas: "Prueba de guardado"
    }, { onConflict: "traslado_id,tipo" })
    .select();

  if (upsertError) {
    console.error("Upsert failed:", upsertError);
  } else {
    console.log("Upsert succeeded under service role:", upsertData);
  }
}

main().catch(console.error);
