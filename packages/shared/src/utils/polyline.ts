/**
 * Codificación de polyline de Google/Mapbox (precisión 5), usada para dibujar
 * una ruta como overlay `path-...` en la Mapbox Static Images API. Evita
 * depender de mapbox-gl (WebGL) en apps móviles como app-conductor, donde un
 * <img> con la Static API es más liviano y más confiable dentro del WebView
 * de Capacitor.
 *
 * Referencia del algoritmo: https://developers.google.com/maps/documentation/utilities/polylinealgorithm
 */
function codificarNumero(numero: number): string {
  let valor = numero < 0 ? ~(numero << 1) : numero << 1;
  let salida = "";
  while (valor >= 0x20) {
    salida += String.fromCharCode((0x20 | (valor & 0x1f)) + 63);
    valor >>= 5;
  }
  salida += String.fromCharCode(valor + 63);
  return salida;
}

/** coordenadas: lista de [lng, lat] (formato GeoJSON). */
export function codificarPolyline(coordenadas: number[][], precision = 5): string {
  const factor = Math.pow(10, precision);
  let latPrevia = 0;
  let lngPrevia = 0;
  let salida = "";

  for (const [lng, lat] of coordenadas) {
    const latRedondeada = Math.round(lat * factor);
    const lngRedondeada = Math.round(lng * factor);
    salida += codificarNumero(latRedondeada - latPrevia);
    salida += codificarNumero(lngRedondeada - lngPrevia);
    latPrevia = latRedondeada;
    lngPrevia = lngRedondeada;
  }

  return salida;
}
