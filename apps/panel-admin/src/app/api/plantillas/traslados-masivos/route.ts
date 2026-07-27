import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { NextResponse } from "next/server";
import { CATALOGO_VEHICULOS, type VehiculoCatalogo } from "@ruum/shared/catalogos";

type Celda = string | number | null | undefined;

const FILAS_PLANTILLA = 500;

const COLUMNAS = [
  "referencia_externa",
  "vehiculo_placas",
  "vehiculo_vin",
  "vehiculo_marca",
  "vehiculo_modelo",
  "vehiculo_anio",
  "vehiculo_tipo",
  "vehiculo_color",
  "categoria_tarifa",
  "gama",
  "condicion",
  "contacto_entrega_nombre",
  "contacto_entrega_telefono",
  "contacto_recepcion_nombre",
  "contacto_recepcion_telefono",
  "origen_codigo_postal",
  "origen_estado",
  "origen_ciudad",
  "origen_colonia",
  "origen_direccion",
  "origen_lat",
  "origen_lng",
  "destino_codigo_postal",
  "destino_estado",
  "destino_ciudad",
  "destino_colonia",
  "destino_direccion",
  "destino_lat",
  "destino_lng",
  "modalidad_programacion",
  "fecha_hora_programada",
  "tipo_pago",
  "tipo_ruta",
  "tipo_servicio",
  "motivo_servicio",
  "distancia_km",
  "tiempo_estimado_horas",
  "instrucciones_especiales"
] as const;

const EJEMPLO = [
  "FLOT-001",
  "ABC123",
  "",
  "Nissan",
  "Versa",
  "2024",
  "sedan",
  "Blanco",
  "ligero_a",
  "entrada",
  "seminueva",
  "Operaciones",
  "+525500000000",
  "Recepcion",
  "+525500000001",
  "06700",
  null,
  null,
  null,
  "Av. Reforma 100",
  "19.4326",
  "-99.1332",
  "04360",
  null,
  null,
  null,
  "Av. Universidad 300",
  "19.3670",
  "-99.1660",
  "programado",
  "2026-07-20T12:00:00-06:00",
  "al_cierre",
  "local",
  "flotilla",
  "traslado_especial",
  "12.4",
  "0.7",
  "Unidad prioritaria"
] satisfies Celda[];

const VEHICULO_TIPOS = ["sedan", "suv", "pick_up", "van", "luxury", "blindado", "coleccion"];
const CATEGORIAS = ["ligero_a", "ligero_b", "mediano", "camion"];
const GAMAS = ["entrada", "media", "alta", "premium"];
const CONDICIONES = ["nueva", "seminueva", "rescate_mecanico"];
const ANIOS = Array.from({ length: 31 }, (_, indice) => String(new Date().getFullYear() + 1 - indice));
const MODALIDADES = ["lo_antes_posible", "programado"];
const TIPOS_PAGO = ["al_cierre", "anticipado", "credito_empresa"];
const TIPOS_RUTA = ["local", "foraneo"];
const TIPOS_SERVICIO = ["flotilla", "particular", "corporativo"];

function xml(valor: Celda) {
  return String(valor ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;");
}

function col(indice: number) {
  let n = indice + 1;
  let salida = "";
  while (n > 0) {
    const resto = (n - 1) % 26;
    salida = String.fromCharCode(65 + resto) + salida;
    n = Math.floor((n - resto - 1) / 26);
  }
  return salida;
}

function celdaTexto(ref: string, valor: Celda) {
  return `<c r="${ref}" t="inlineStr"><is><t>${xml(valor)}</t></is></c>`;
}

function celdaFormula(ref: string, formula: string) {
  return `<c r="${ref}"><f>${xml(formula)}</f></c>`;
}

function fila(numero: number, celdas: string[]) {
  return `<row r="${numero}">${celdas.join("")}</row>`;
}

function rangoLista(nombre: string, columna: string, total: number) {
  return `<definedName name="${nombre}">Catalogos!$${columna}$2:$${columna}$${Math.max(total + 1, 2)}</definedName>`;
}

function dataValidation(columna: string, formula: string) {
  return `<dataValidation type="list" allowBlank="1" showErrorMessage="1" sqref="${columna}2:${columna}${FILAS_PLANTILLA + 1}"><formula1>${formula}</formula1></dataValidation>`;
}

function cargarCodigosPostales() {
  const dir = join(process.cwd(), "..", "app-usuario", "public", "data", "codigos-postales");
  const filas: Array<[string, string, string, string, string]> = [];
  for (const archivo of readdirSync(dir).filter((nombre) => nombre.endsWith(".json"))) {
    const shard = JSON.parse(readFileSync(join(dir, archivo), "utf8")) as Record<string, { estado: string; ciudades: string[]; colonias: string[] }>;
    for (const [cp, datos] of Object.entries(shard)) {
      filas.push([
        cp,
        datos.estado,
        datos.ciudades[0] ?? "",
        datos.colonias[0] ?? "",
        datos.colonias.join(" | ")
      ]);
    }
  }
  return filas.sort(([a], [b]) => a.localeCompare(b, "es-MX"));
}

function valoresUnicos(valores: Iterable<string>) {
  return [...new Set([...valores].filter(Boolean))].sort((a, b) => a.localeCompare(b, "es-MX"));
}

function sheetPrincipal() {
  const headers = fila(1, COLUMNAS.map((encabezado, indice) => celdaTexto(`${col(indice)}1`, encabezado)));
  const filasCaptura = Array.from({ length: FILAS_PLANTILLA }, (_, filaIndice) => {
    const numero = filaIndice + 2;
    return fila(numero, COLUMNAS.map((columna, indice) => {
      const letra = col(indice);
      if (columna === "origen_estado") return celdaFormula(`${letra}${numero}`, `IFERROR(VLOOKUP($P${numero},Catalogos!$H:$L,2,FALSE),"")`);
      if (columna === "origen_ciudad") return celdaFormula(`${letra}${numero}`, `IFERROR(VLOOKUP($P${numero},Catalogos!$H:$L,3,FALSE),"")`);
      if (columna === "origen_colonia") return celdaFormula(`${letra}${numero}`, `IFERROR(VLOOKUP($P${numero},Catalogos!$H:$L,4,FALSE),"")`);
      if (columna === "destino_estado") return celdaFormula(`${letra}${numero}`, `IFERROR(VLOOKUP($W${numero},Catalogos!$H:$L,2,FALSE),"")`);
      if (columna === "destino_ciudad") return celdaFormula(`${letra}${numero}`, `IFERROR(VLOOKUP($W${numero},Catalogos!$H:$L,3,FALSE),"")`);
      if (columna === "destino_colonia") return celdaFormula(`${letra}${numero}`, `IFERROR(VLOOKUP($W${numero},Catalogos!$H:$L,4,FALSE),"")`);
      return celdaTexto(`${letra}${numero}`, filaIndice === 0 ? EJEMPLO[indice] : "");
    }));
  }).join("");

  const validaciones = [
    dataValidation("D", "Marcas"),
    dataValidation("E", "Modelos"),
    dataValidation("F", "Anios"),
    dataValidation("G", "TiposVehiculo"),
    dataValidation("I", "CategoriasTarifa"),
    dataValidation("J", "Gamas"),
    dataValidation("K", "Condiciones"),
    dataValidation("P", "CodigosPostales"),
    dataValidation("S", "Colonias"),
    dataValidation("W", "CodigosPostales"),
    dataValidation("Z", "Colonias"),
    dataValidation("AD", "Modalidades"),
    dataValidation("AF", "TiposPago"),
    dataValidation("AG", "TiposRuta"),
    dataValidation("AH", "TiposServicio")
  ].join("");

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
  <cols>${COLUMNAS.map((_, indice) => `<col min="${indice + 1}" max="${indice + 1}" width="${indice === 37 ? 28 : 18}" customWidth="1"/>`).join("")}</cols>
  <sheetData>${headers}${filasCaptura}</sheetData>
  <dataValidations count="15">${validaciones}</dataValidations>
</worksheet>`;
}

function sheetCatalogos() {
  const catalogoVehiculos = CATALOGO_VEHICULOS as readonly VehiculoCatalogo[];
  const marcas = valoresUnicos(catalogoVehiculos.map((vehiculo) => vehiculo.marca));
  const modelos = valoresUnicos(catalogoVehiculos.map((vehiculo) => vehiculo.modelo));
  const cps = cargarCodigosPostales();
  const colonias = valoresUnicos(cps.map((filaCp) => filaCp[3]));
  const maxFilas = Math.max(marcas.length, modelos.length, ANIOS.length, VEHICULO_TIPOS.length, CATEGORIAS.length, GAMAS.length, CONDICIONES.length, cps.length, colonias.length);
  const header = ["marcas", "modelos", "anios", "vehiculo_tipos", "categorias_tarifa", "gamas", "condiciones", "codigo_postal", "estado", "ciudad_municipio", "colonia_principal", "colonias", "colonias_busqueda", "modalidades", "tipos_pago", "tipos_ruta", "tipos_servicio"];
  const filas = [fila(1, header.map((valor, indice) => celdaTexto(`${col(indice)}1`, valor)))];
  for (let i = 0; i < maxFilas; i += 1) {
    const cp = cps[i];
    filas.push(fila(i + 2, [
      celdaTexto(`A${i + 2}`, marcas[i]),
      celdaTexto(`B${i + 2}`, modelos[i]),
      celdaTexto(`C${i + 2}`, ANIOS[i]),
      celdaTexto(`D${i + 2}`, VEHICULO_TIPOS[i]),
      celdaTexto(`E${i + 2}`, CATEGORIAS[i]),
      celdaTexto(`F${i + 2}`, GAMAS[i]),
      celdaTexto(`G${i + 2}`, CONDICIONES[i]),
      celdaTexto(`H${i + 2}`, cp?.[0]),
      celdaTexto(`I${i + 2}`, cp?.[1]),
      celdaTexto(`J${i + 2}`, cp?.[2]),
      celdaTexto(`K${i + 2}`, cp?.[3]),
      celdaTexto(`L${i + 2}`, cp?.[4]),
      celdaTexto(`M${i + 2}`, colonias[i]),
      celdaTexto(`N${i + 2}`, MODALIDADES[i]),
      celdaTexto(`O${i + 2}`, TIPOS_PAGO[i]),
      celdaTexto(`P${i + 2}`, TIPOS_RUTA[i]),
      celdaTexto(`Q${i + 2}`, TIPOS_SERVICIO[i])
    ]));
  }
  return {
    xml: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetViews><sheetView workbookViewId="0"/></sheetViews>
  <sheetData>${filas.join("")}</sheetData>
</worksheet>`,
    counts: { marcas: marcas.length, modelos: modelos.length, cps: cps.length, colonias: colonias.length }
  };
}

function workbook(counts: { marcas: number; modelos: number; cps: number; colonias: number }) {
  const names = [
    rangoLista("Marcas", "A", counts.marcas),
    rangoLista("Modelos", "B", counts.modelos),
    rangoLista("Anios", "C", ANIOS.length),
    rangoLista("TiposVehiculo", "D", VEHICULO_TIPOS.length),
    rangoLista("CategoriasTarifa", "E", CATEGORIAS.length),
    rangoLista("Gamas", "F", GAMAS.length),
    rangoLista("Condiciones", "G", CONDICIONES.length),
    rangoLista("CodigosPostales", "H", counts.cps),
    rangoLista("Colonias", "M", counts.colonias),
    rangoLista("Modalidades", "N", MODALIDADES.length),
    rangoLista("TiposPago", "O", TIPOS_PAGO.length),
    rangoLista("TiposRuta", "P", TIPOS_RUTA.length),
    rangoLista("TiposServicio", "Q", TIPOS_SERVICIO.length)
  ].join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="Traslados" sheetId="1" r:id="rId1"/>
    <sheet name="Catalogos" sheetId="2" r:id="rId2"/>
  </sheets>
  <definedNames>${names}</definedNames>
</workbook>`;
}

function crc32(buffer: Buffer) {
  let crc = ~0;
  for (const byte of buffer) {
    crc ^= byte;
    for (let k = 0; k < 8; k += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return ~crc >>> 0;
}

function zip(entries: Array<{ name: string; data: string }>) {
  const locales: Buffer[] = [];
  const centrales: Buffer[] = [];
  let offset = 0;
  for (const entry of entries) {
    const name = Buffer.from(entry.name);
    const data = Buffer.from(entry.data, "utf8");
    const crc = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 6);
    local.writeUInt16LE(0, 8);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(name.length, 26);
    locales.push(local, name, data);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE(offset, 42);
    centrales.push(central, name);
    offset += local.length + name.length + data.length;
  }
  const centralOffset = offset;
  const centralSize = centrales.reduce((total, item) => total + item.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralSize, 12);
  end.writeUInt32LE(centralOffset, 16);
  return Buffer.concat([...locales, ...centrales, end]);
}

export async function GET() {
  const catalogos = sheetCatalogos();
  const archivo = zip([
    { name: "[Content_Types].xml", data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>` },
    { name: "_rels/.rels", data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>` },
    { name: "xl/workbook.xml", data: workbook(catalogos.counts) },
    { name: "xl/_rels/workbook.xml.rels", data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>` },
    { name: "xl/styles.xml", data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="1"><font><sz val="11"/><name val="Calibri"/></font></fonts><fills count="1"><fill><patternFill patternType="none"/></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf/></cellStyleXfs><cellXfs count="1"><xf/></cellXfs></styleSheet>` },
    { name: "xl/worksheets/sheet1.xml", data: sheetPrincipal() },
    { name: "xl/worksheets/sheet2.xml", data: catalogos.xml }
  ]);
  return new NextResponse(archivo, {
    headers: {
      "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition": `attachment; filename="plantilla-traslados-masivos-ruum.xlsx"`,
      "cache-control": "no-store"
    }
  });
}
