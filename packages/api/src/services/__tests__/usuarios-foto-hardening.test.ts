import { describe, it, expect, vi, beforeEach } from "vitest";
import { crearClienteFake } from "./supabase-fake";
import {
  TAMANO_MAX_FOTO_USUARIO_BYTES,
  EXTENSIONES_FOTO_USUARIO_PERMITIDAS,
  MIME_FOTO_USUARIO_PERMITIDOS,
  extensionFotoUsuario,
  validarMagicBytesFoto,
  validarFotoPerfilUsuario,
  subirFotoPerfil,
} from "../usuarios";

// Helpers para crear File con magic bytes
function fileConHeader(nombre: string, mime: string, header: number[], size = header.length): File {
  const buf = new Uint8Array(size);
  buf.set(header.slice(0, Math.min(header.length, size)));
  // Rellenar con ceros si size > header
  const blob = new Blob([buf], { type: mime });
  // Mock File con arrayBuffer y slice
  const file = {
    name: nombre,
    type: mime,
    size,
    slice: (start: number, end: number) => ({
      arrayBuffer: async () => buf.slice(start, end).buffer,
    }),
    arrayBuffer: async () => buf.buffer,
  } as unknown as File;
  return file;
}

function jpgFile(nombre = "foto.jpg", size = 1024) {
  return fileConHeader(nombre, "image/jpeg", [0xff, 0xd8, 0xff, 0xe0], size);
}
function pngFile(nombre = "foto.png", size = 1024) {
  return fileConHeader(nombre, "image/png", [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], size);
}
function webpFile(nombre = "foto.webp", size = 1024) {
  // RIFF....WEBP
  const header = [0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50];
  return fileConHeader(nombre, "image/webp", header, size);
}

describe("PR-09 Hardening Storage Usuario — Validación server-side", () => {
  beforeEach(() => vi.clearAllMocks());

  describe("constantes y helpers", () => {
    it("tamaño máximo 5MB", () => {
      expect(TAMANO_MAX_FOTO_USUARIO_BYTES).toBe(5 * 1024 * 1024);
    });
    it("extensiones permitidas jpg/jpeg/png/webp", () => {
      expect(EXTENSIONES_FOTO_USUARIO_PERMITIDAS.has("jpg")).toBe(true);
      expect(EXTENSIONES_FOTO_USUARIO_PERMITIDAS.has("jpeg")).toBe(true);
      expect(EXTENSIONES_FOTO_USUARIO_PERMITIDAS.has("png")).toBe(true);
      expect(EXTENSIONES_FOTO_USUARIO_PERMITIDAS.has("webp")).toBe(true);
      expect(EXTENSIONES_FOTO_USUARIO_PERMITIDAS.has("gif")).toBe(false);
      expect(EXTENSIONES_FOTO_USUARIO_PERMITIDAS.has("pdf")).toBe(false);
    });
    it("MIME permitidos", () => {
      expect(MIME_FOTO_USUARIO_PERMITIDOS.has("image/jpeg")).toBe(true);
      expect(MIME_FOTO_USUARIO_PERMITIDOS.has("image/png")).toBe(true);
      expect(MIME_FOTO_USUARIO_PERMITIDOS.has("image/webp")).toBe(true);
      expect(MIME_FOTO_USUARIO_PERMITIDOS.has("application/octet-stream")).toBe(false);
      expect(MIME_FOTO_USUARIO_PERMITIDOS.has("image/gif")).toBe(false);
    });
    it("extensionFotoUsuario normaliza", () => {
      expect(extensionFotoUsuario("MiFoto.JPG")).toBe("jpg");
      expect(extensionFotoUsuario("archivo.tar.png")).toBe("png");
      expect(extensionFotoUsuario("sinExt")).toBe("sinext");
    });
  });

  describe("validarMagicBytesFoto — no confiar solo en file.type", () => {
    it("JPEG válido pasa", async () => {
      await expect(validarMagicBytesFoto(jpgFile(), "jpg")).resolves.toBeUndefined();
      await expect(validarMagicBytesFoto(jpgFile("x.jpeg"), "jpeg")).resolves.toBeUndefined();
    });
    it("PNG válido pasa", async () => {
      await expect(validarMagicBytesFoto(pngFile(), "png")).resolves.toBeUndefined();
    });
    it("WEBP válido pasa", async () => {
      await expect(validarMagicBytesFoto(webpFile(), "webp")).resolves.toBeUndefined();
    });
    it("JPEG con firma PNG falla", async () => {
      await expect(validarMagicBytesFoto(pngFile("fake.jpg"), "jpg")).rejects.toThrow("no es un JPEG");
    });
    it("PNG con firma JPEG falla", async () => {
      await expect(validarMagicBytesFoto(jpgFile("fake.png"), "png")).rejects.toThrow("no es un PNG");
    });
    it("WEBP con firma incorrecta falla", async () => {
      const bad = fileConHeader("bad.webp", "image/webp", [0x00, 0x00, 0x00, 0x00], 12);
      await expect(validarMagicBytesFoto(bad, "webp")).rejects.toThrow("no es un WEBP");
    });
  });

  describe("validarFotoPerfilUsuario — server-side", () => {
    it("rechaza si supera 5MB", async () => {
      const big = jpgFile("big.jpg", TAMANO_MAX_FOTO_USUARIO_BYTES + 1);
      await expect(validarFotoPerfilUsuario(big)).rejects.toThrow("5 MB");
    });
    it("rechaza si archivo vacío", async () => {
      const empty = jpgFile("empty.jpg", 0);
      await expect(validarFotoPerfilUsuario(empty)).rejects.toThrow("vacío");
    });
    it("rechaza extensión no permitida", async () => {
      const gif = fileConHeader("foto.gif", "image/gif", [0x47, 0x49, 0x46], 1024);
      await expect(validarFotoPerfilUsuario(gif)).rejects.toThrow("JPG, PNG o WEBP");
    });
    it("rechaza MIME no permitido aunque extensión válida", async () => {
      const badMime = fileConHeader("foto.jpg", "image/gif", [0xff, 0xd8, 0xff], 1024);
      await expect(validarFotoPerfilUsuario(badMime)).rejects.toThrow("MIME no permitido");
    });
    it("rechaza si extensión y MIME no coinciden", async () => {
      const mismatch = fileConHeader("foto.jpg", "image/png", [0xff, 0xd8, 0xff], 1024);
      // jpg con mime png debe fallar por mismatch
      await expect(validarFotoPerfilUsuario(mismatch)).rejects.toThrow("no coincide");
    });
    it("permite octet-stream si magic bytes coinciden (no confiar solo en type)", async () => {
      const octet = fileConHeader("foto.jpg", "application/octet-stream", [0xff, 0xd8, 0xff], 1024);
      // Debe pasar porque validamos por magic bytes, no solo por type
      const res = await validarFotoPerfilUsuario(octet);
      expect(res.extension).toBe("jpg");
      expect(res.mime).toBe("image/jpeg");
    });
    it("rechaza si magic bytes no coinciden aunque type sea correcto", async () => {
      // png file con nombre jpg pero contenido png -> debe fallar por magic
      const fakeJpg = pngFile("foto.jpg", 1024); // contenido png pero nombre jpg y mime jpeg
      // Creamos con mime jpeg pero contenido png
      const file = {
        name: "foto.jpg",
        type: "image/jpeg",
        size: 1024,
        slice: (s: number, e: number) => ({
          arrayBuffer: async () => new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).buffer,
        }),
        arrayBuffer: async () => new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).buffer,
      } as unknown as File;
      await expect(validarFotoPerfilUsuario(file)).rejects.toThrow("no es un JPEG");
    });
    it("normaliza jpeg -> jpg para nombre interno", async () => {
      const jpeg = fileConHeader("foto.jpeg", "image/jpeg", [0xff, 0xd8, 0xff], 1024);
      const res = await validarFotoPerfilUsuario(jpeg);
      expect(res.extension).toBe("jpg");
    });
    it("valida tamaño, mime, extensión y magic bytes en conjunto (caso válido)", async () => {
      const valid = jpgFile("perfil.jpg", 1024);
      const res = await validarFotoPerfilUsuario(valid);
      expect(res.extension).toBe("jpg");
      expect(res.mime).toBe("image/jpeg");
    });
  });

  describe("subirFotoPerfil — hardening: nombre interno, path identidad, sin fallback", () => {
    it("genera path basado en identidad y nombre interno perfil.<ext>", async () => {
      const cliente = crearClienteFake({
        userId: "user-uuid-123",
        tablas: { usuarios: { data: { id: "usuario-1" } } },
        storageResult: { publicUrl: "https://cdn.test/fotos/user-uuid-123/perfil.jpg" },
      }) as any;
      // Mock validarFotoPerfilUsuario para retornar jpg
      const file = jpgFile("MiFotoOriginal_HEIC.jpg", 1024);
      // Necesitamos que validar pase, usaremos un jpg válido con nombre que contiene HEIC pero ext es jpg
      const url = await subirFotoPerfil(cliente, file);
      expect(url).toContain("https://cdn.test");
      const uploadCall = (cliente as { llamadas: { table: string; action: string; args: unknown[] }[] }).llamadas.find((l) => l.table === "storage:fotos-perfil" && l.action === "upload");
      expect(uploadCall).toBeDefined();
      expect(uploadCall!.args[0]).toBe("user-uuid-123/perfil.jpg"); // path basado en identidad, nombre interno
      expect((uploadCall!.args[1] as Record<string, unknown>)).toMatchObject({ contentType: "image/jpeg" });
    });

    it("fall-closed si bucket fotos-perfil no existe (no fallback a evidencia)", async () => {
      const cliente = crearClienteFake({
        userId: "user-123",
        storageResult: { error: new Error("Bucket not found") },
      }) as any;
      const file = jpgFile("foto.jpg", 1024);
      await expect(subirFotoPerfil(cliente, file)).rejects.toThrow("Bucket fotos-perfil no disponible");
      // Verificar que NO se intentó subir a evidencia
      const evidenciaCall = (cliente as { llamadas: { action: string; table: string }[] }).llamadas.find((l) => l.table === "storage:evidencia");
      expect(evidenciaCall).toBeUndefined();
    });

    it("no confía solo en file.type: archivo con type image/jpeg pero contenido png falla", async () => {
      const cliente = crearClienteFake({ userId: "u1" }) as any;
      const fake = {
        name: "foto.jpg",
        type: "image/jpeg",
        size: 1024,
        slice: (s: number, e: number) => ({
          arrayBuffer: async () => new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).buffer,
        }),
        arrayBuffer: async () => new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).buffer,
      } as unknown as File;
      await expect(subirFotoPerfil(cliente, fake)).rejects.toThrow("no es un JPEG");
    });

    it("valida permisos RLS: path debe ser auth.uid()/perfil.<ext> (foldername check)", async () => {
      // El RLS en storage.objects verifica (storage.foldername(name))[1] = auth.uid()::text
      // Nuestro código genera `${userId}/perfil.jpg` donde userId = auth.uid(), por lo que pasa RLS
      const cliente = crearClienteFake({
        userId: "auth-uid-999",
        storageResult: { publicUrl: "https://cdn.test/..." },
      }) as any;
      const file = jpgFile("foto.jpg", 1024);
      await subirFotoPerfil(cliente, file);
      const uploadCall = (cliente as { llamadas: { table: string; action: string; args: unknown[] }[] }).llamadas.find((l) => l.action === "upload");
      expect(uploadCall!.args[0]).toBe("auth-uid-999/perfil.jpg");
      // Si intentara subir a otro path, RLS fallaría server-side, pero nuestro código no lo permite
    });

    it("rechaza archivo con extensión no permitida aunque MIME sea válido", async () => {
      const cliente = crearClienteFake({ userId: "u1" }) as any;
      const file = fileConHeader("foto.gif", "image/jpeg", [0xff, 0xd8, 0xff], 1024);
      await expect(subirFotoPerfil(cliente, file)).rejects.toThrow("JPG, PNG o WEBP");
    });
  });
});
