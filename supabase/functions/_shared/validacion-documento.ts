export const TAMANO_MAXIMO = 10 * 1024 * 1024;
export const ANCHO_MINIMO = 800;
export const ALTO_MINIMO = 600;

export type FormatoDocumento = "jpeg" | "png" | "webp" | "pdf";

export type DocumentoValidado = {
  bytes: Uint8Array;
  mime: "image/jpeg" | "image/png" | "image/webp" | "application/pdf";
  extension: "jpg" | "png" | "webp" | "pdf";
  ancho: number | null;
  alto: number | null;
  nombreSeguro: string;
  exifEliminado: boolean;
};

function error(mensaje: string): never {
  throw new Error(mensaje);
}

function texto(bytes: Uint8Array) {
  return new TextDecoder("latin1").decode(bytes);
}

function u32be(bytes: Uint8Array, pos: number) {
  return (((bytes[pos] << 24) >>> 0) + (bytes[pos + 1] << 16) + (bytes[pos + 2] << 8) + bytes[pos + 3]) >>> 0;
}

function u32le(bytes: Uint8Array, pos: number) {
  return (bytes[pos] + (bytes[pos + 1] << 8) + (bytes[pos + 2] << 16) + ((bytes[pos + 3] << 24) >>> 0)) >>> 0;
}

function validarDimensiones(ancho: number, alto: number) {
  if (Math.min(ancho, alto) < ALTO_MINIMO || Math.max(ancho, alto) < ANCHO_MINIMO) {
    error(`La imagen debe medir al menos ${ANCHO_MINIMO} x ${ALTO_MINIMO} px (se acepta orientación vertical).`);
  }
}

export function sanitizarNombre(nombre: string) {
  const requierePrefijo = /^[.\s/\\]/.test(nombre);
  const base = nombre.normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9_.-]/g, "_").replace(/_+/g, "_")
    .replace(/^[^A-Za-z0-9]+/, "").slice(0, 150);
  const seguro = base || "archivo";
  return requierePrefijo ? `documento_${seguro}` : seguro;
}

function concatenar(partes: Uint8Array[]) {
  const total = partes.reduce((s, p) => s + p.length, 0);
  const salida = new Uint8Array(total);
  let pos = 0;
  for (const parte of partes) { salida.set(parte, pos); pos += parte.length; }
  return salida;
}

function validarJpeg(bytes: Uint8Array) {
  if (bytes.length < 16 || bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes.at(-2) !== 0xff || bytes.at(-1) !== 0xd9) {
    error("El archivo no contiene una imagen JPEG válida.");
  }
  const partes: Uint8Array[] = [bytes.slice(0, 2)];
  const marcadoresSof = new Set([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf]);
  let pos = 2, ancho = 0, alto = 0, tieneScan = false, exifEliminado = false;
  while (pos < bytes.length - 2) {
    const inicio = pos;
    if (bytes[pos++] !== 0xff) error("La estructura interna del JPEG está dañada.");
    while (bytes[pos] === 0xff) pos++;
    const marcador = bytes[pos++];
    if (marcador === 0xda) {
      if (pos + 2 > bytes.length) error("La imagen JPEG está truncada.");
      const longitud = (bytes[pos] << 8) | bytes[pos + 1];
      if (longitud < 2 || pos + longitud > bytes.length) error("La imagen JPEG está truncada.");
      partes.push(bytes.slice(inicio));
      tieneScan = true;
      break;
    }
    if (marcador === 0xd9) break;
    if (marcador >= 0xd0 && marcador <= 0xd7) { partes.push(bytes.slice(inicio,pos)); continue; }
    if (pos + 2 > bytes.length) error("La imagen JPEG está truncada.");
    const longitud = (bytes[pos] << 8) | bytes[pos + 1];
    const fin = pos + longitud;
    if (longitud < 2 || fin > bytes.length) error("La imagen JPEG está truncada.");
    if (marcadoresSof.has(marcador)) {
      if (longitud < 7) error("El encabezado JPEG no contiene dimensiones válidas.");
      alto = (bytes[pos + 3] << 8) | bytes[pos + 4];
      ancho = (bytes[pos + 5] << 8) | bytes[pos + 6];
    }
    const esExif = marcador === 0xe1 && texto(bytes.slice(pos + 2, Math.min(fin, pos + 8))) === "Exif\0\0";
    if (esExif) exifEliminado = true;
    else partes.push(bytes.slice(inicio, fin));
    pos = fin;
  }
  if (!tieneScan || !ancho || !alto) error("No fue posible leer la imagen JPEG.");
  validarDimensiones(ancho,alto);
  return { bytes: exifEliminado ? concatenar(partes) : bytes, ancho, alto, exifEliminado };
}

let tablaCrc: Uint32Array | null = null;
function crc32(bytes: Uint8Array) {
  if (!tablaCrc) {
    tablaCrc = new Uint32Array(256);
    for (let n=0;n<256;n++) { let c=n; for(let k=0;k<8;k++) c=(c&1)?0xedb88320^(c>>>1):c>>>1; tablaCrc[n]=c>>>0; }
  }
  let c=0xffffffff;
  for (const b of bytes) c=tablaCrc[(c^b)&0xff]^(c>>>8);
  return (c^0xffffffff)>>>0;
}

function validarPng(bytes: Uint8Array) {
  const firma=[137,80,78,71,13,10,26,10];
  if (bytes.length<45 || !firma.every((v,i)=>bytes[i]===v)) error("El archivo no contiene una imagen PNG válida.");
  const partes:Uint8Array[]=[bytes.slice(0,8)];
  let pos=8, ancho=0, alto=0, ihdr=false, idat=false, iend=false, exifEliminado=false;
  while(pos+12<=bytes.length) {
    const longitud=u32be(bytes,pos), finDatos=pos+12+longitud;
    if (longitud>bytes.length || finDatos>bytes.length) error("La imagen PNG está truncada.");
    const tipo=texto(bytes.slice(pos+4,pos+8));
    const crcEsperado=u32be(bytes,pos+8+longitud);
    if (crc32(bytes.slice(pos+4,pos+8+longitud))!==crcEsperado) error("La imagen PNG está dañada.");
    if (tipo==="IHDR") {
      if (ihdr || pos!==8 || longitud!==13) error("El encabezado PNG no es válido.");
      ancho=u32be(bytes,pos+8); alto=u32be(bytes,pos+12); ihdr=true;
    } else if (tipo==="IDAT") idat=true;
    else if (tipo==="IEND") { if(longitud!==0) error("El cierre PNG no es válido."); iend=true; pos=finDatos; break; }
    if(tipo==="eXIf") exifEliminado=true;
    else partes.push(bytes.slice(pos,finDatos));
    pos=finDatos;
  }
  if (!ihdr || !idat || !iend || pos!==bytes.length || !ancho || !alto) error("No fue posible leer la imagen PNG.");
  partes.push(bytes.slice(pos-12,pos));
  validarDimensiones(ancho,alto);
  return { bytes:exifEliminado?concatenar(partes):bytes,ancho,alto,exifEliminado };
}

function validarWebp(bytes: Uint8Array) {
  if (bytes.length<30 || texto(bytes.slice(0,4))!=="RIFF" || texto(bytes.slice(8,12))!=="WEBP") {
    error("El archivo no contiene una imagen WEBP válida.");
  }
  const limite=u32le(bytes,4)+8;
  if (limite!==bytes.length || limite<20) error("La imagen WEBP está truncada.");
  const partes:Uint8Array[]=[bytes.slice(0,12)];
  let pos=12, ancho=0, alto=0, exifEliminado=false;
  while(pos+8<=limite) {
    const tipo=texto(bytes.slice(pos,pos+4)), longitud=u32le(bytes,pos+4), datos=pos+8;
    if (datos+longitud>limite) error("La imagen WEBP está truncada.");
    if (tipo==="VP8X" && longitud>=10) {
      ancho=1+bytes[datos+4]+(bytes[datos+5]<<8)+(bytes[datos+6]<<16);
      alto=1+bytes[datos+7]+(bytes[datos+8]<<8)+(bytes[datos+9]<<16);
    } else if (tipo==="VP8 " && longitud>=10 && bytes[datos+3]===0x9d && bytes[datos+4]===0x01 && bytes[datos+5]===0x2a) {
      ancho=(bytes[datos+6]|(bytes[datos+7]<<8))&0x3fff; alto=(bytes[datos+8]|(bytes[datos+9]<<8))&0x3fff;
    } else if (tipo==="VP8L" && longitud>=5 && bytes[datos]===0x2f) {
      ancho=1+bytes[datos+1]+((bytes[datos+2]&0x3f)<<8);
      alto=1+(bytes[datos+2]>>6)+(bytes[datos+3]<<2)+((bytes[datos+4]&0x0f)<<10);
    }
    const siguiente=datos+longitud+(longitud%2);
    if(tipo==="EXIF") exifEliminado=true;
    else partes.push(bytes.slice(pos,siguiente));
    pos=siguiente;
  }
  if (!ancho || !alto) error("No fue posible leer la imagen WEBP.");
  validarDimensiones(ancho,alto);
  if(!exifEliminado) return {bytes,ancho,alto,exifEliminado};
  const salida=concatenar(partes);
  const tamano=salida.length-8;
  salida[4]=tamano&0xff; salida[5]=(tamano>>>8)&0xff; salida[6]=(tamano>>>16)&0xff; salida[7]=(tamano>>>24)&0xff;
  return {bytes:salida,ancho,alto,exifEliminado};
}

function validarPdf(bytes: Uint8Array) {
  if (bytes.length<100 || !/^%PDF-(1\.[0-7]|2\.0)/.test(texto(bytes.slice(0,12)))) error("El archivo no contiene un PDF válido.");
  const contenido=texto(bytes);
  const eof=contenido.lastIndexOf("%%EOF");
  const inicioXref=contenido.lastIndexOf("startxref",eof);
  if (eof<bytes.length-2048 || inicioXref<0) error("El PDF está incompleto o truncado.");
  if (/\/Encrypt\b/.test(contenido)) error("No se aceptan PDF cifrados o protegidos con contraseña.");
  if (!/\/Type\s*\/Page\b/.test(contenido)) error("El PDF no contiene páginas legibles.");
  const coincidencia=/startxref\s+(\d+)/.exec(contenido.slice(inicioXref,eof));
  const offset=Number(coincidencia?.[1]);
  if (!Number.isSafeInteger(offset) || offset<=0 || offset>=inicioXref) error("La tabla de referencias del PDF no es válida.");
  const destino=contenido.slice(offset,Math.min(offset+300,contenido.length));
  if (!/^xref\b/.test(destino) && !/^\d+\s+\d+\s+obj\b[\s\S]*\/Type\s*\/XRef\b/.test(destino)) {
    error("La tabla de referencias del PDF no puede leerse.");
  }
}

export function validarDocumento(
  bytes: Uint8Array,
  nombreOriginal: string,
  formatosPermitidos: ReadonlySet<FormatoDocumento> = new Set(["jpeg", "png", "webp", "pdf"])
): DocumentoValidado {
  if (!bytes.length) error("El archivo está vacío.");
  if (bytes.length>TAMANO_MAXIMO) error("El archivo debe pesar máximo 10 MB.");
  const nombreSeguro=sanitizarNombre(nombreOriginal);
  if (bytes[0]===0xff && bytes[1]===0xd8) {
    if (!formatosPermitidos.has("jpeg")) error("El formato JPEG no está permitido en este flujo.");
    const jpg=validarJpeg(bytes);
    return {...jpg,mime:"image/jpeg",extension:"jpg",nombreSeguro:`${nombreSeguro.replace(/\.[^.]+$/,'')}.jpg`};
  }
  if (bytes[0]===137 && bytes[1]===80) {
    if (!formatosPermitidos.has("png")) error("El formato PNG no está permitido en este flujo.");
    const png=validarPng(bytes);
    return {mime:"image/png",extension:"png",...png,nombreSeguro:`${nombreSeguro.replace(/\.[^.]+$/,'')}.png`};
  }
  if (texto(bytes.slice(0,4))==="RIFF") {
    if (!formatosPermitidos.has("webp")) error("El formato WEBP no está permitido en este flujo.");
    const webp=validarWebp(bytes);
    return {mime:"image/webp",extension:"webp",...webp,nombreSeguro:`${nombreSeguro.replace(/\.[^.]+$/,'')}.webp`};
  }
  if (texto(bytes.slice(0,5))==="%PDF-") {
    if (!formatosPermitidos.has("pdf")) error("El formato PDF no está permitido en este flujo.");
    validarPdf(bytes);
    return {bytes,mime:"application/pdf",extension:"pdf",ancho:null,alto:null,nombreSeguro:`${nombreSeguro.replace(/\.[^.]+$/,'')}.pdf`,exifEliminado:false};
  }
  error("El contenido real no corresponde a un formato documental permitido.");
}
