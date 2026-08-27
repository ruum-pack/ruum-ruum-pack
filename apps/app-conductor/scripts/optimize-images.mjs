#!/usr/bin/env node

/**
 * Script para optimizar imágenes de la aplicación Ruum Conductor
 * Recomendación PERF-001: Comprimir imágenes de onboarding
 * 
 * Uso:
 *   pnpm run optimize:images
 * 
 * Requiere:
 *   - sharp (para procesamiento de imágenes)
 *   - image-size (para verificar tamaños)
 */

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const IMAGES_DIR = path.join(__dirname, "..", "public", "imagenes");
const ONBOARDING_IMAGES = [
  "onboarding-paso1.webp",
  "onboarding-paso2.webp",
  "onboarding-paso3.webp"
];

// Configuración de calidad
const QUALITY_WEBP = 75;
const QUALITY_JPEG = 80;
const MAX_SIZE_KB = 200; // Objetivo: <200KB

async function getFileSize(filePath) {
  const stats = await fs.stat(filePath);
  return stats.size / 1024; // KB
}

async function optimizeImage(inputPath, outputPath, options = {}) {
  const { width, height, quality = QUALITY_WEBP } = options;
  
  const image = sharp(inputPath);
  const metadata = await image.metadata();
  
  // Si ya es WebP, re-optimizar
  if (metadata.format === "webp") {
    await image
      .webp({ quality, effort: 6 })
      .toFile(outputPath);
  } else {
    // Convertir a WebP
    await image
      .resize(width, height, { fit: "inside", withoutEnlargement: true })
      .webp({ quality, effort: 6 })
      .toFile(outputPath);
  }
  
  return await getFileSize(outputPath);
}

async function processOnboardingImages() {
  console.log("📦 Optimizando imágenes de onboarding...\n");
  
  const results = [];
  
  for (const imageName of ONBOARDING_IMAGES) {
    const inputPath = path.join(IMAGES_DIR, imageName);
    const tempPath = path.join(IMAGES_DIR, `${imageName}.tmp`);
    const backupPath = path.join(IMAGES_DIR, `${imageName}.backup`);
    
    try {
      // Verificar si existe
      const originalSize = await getFileSize(inputPath);
      console.log(`📄 ${imageName}: ${originalSize.toFixed(1)} KB`);
      
      // Crear backup
      await fs.copyFile(inputPath, backupPath);
      
      // Configuración específica para cada imagen
      let options = { quality: QUALITY_WEBP };
      if (imageName.includes("paso1")) {
        options = { ...options, width: 860, height: 860 };
      } else if (imageName.includes("paso2")) {
        options = { ...options, width: 1200, height: 675 };
      } else if (imageName.includes("paso3")) {
        options = { ...options, width: 860, height: 860 };
      }
      
      // Optimizar
      const optimizedSize = await optimizeImage(inputPath, tempPath, options);
      console.log(`  → Optimizado: ${optimizedSize.toFixed(1)} KB`);
      
      // Verificar si la optimización fue efectiva
      if (optimizedSize < originalSize * 0.95) {
        // Reemplazar original
        await fs.rename(tempPath, inputPath);
        await fs.unlink(backupPath);
        console.log(`  ✅ Ahorro: ${(originalSize - optimizedSize).toFixed(1)} KB`);
      } else {
        // Restaurar backup
        await fs.rename(backupPath, inputPath);
        await fs.unlink(tempPath);
        console.log(`  ⚠️  Optimización no significativa`);
      }
      
      results.push({
        image: imageName,
        originalSize,
        optimizedSize,
        saved: optimizedSize < originalSize * 0.95
      });
      console.log();
    } catch (error) {
      console.error(`❌ Error procesando ${imageName}:`, error.message);
      // Intentar restaurar backup
      try {
        if (await fs.access(backupPath).then(() => true).catch(() => false)) {
          await fs.rename(backupPath, inputPath);
        }
      } catch { /* ignore */ }
    }
  }
  
  return results;
}

async function analyzeAllImages() {
  console.log("🔍 Analizando todas las imágenes en el directorio...\n");
  
  const files = await fs.readdir(IMAGES_DIR);
  const imageFiles = files.filter(f => [".jpg", ".jpeg", ".png", ".webp", ".avif"].some(ext => f.toLowerCase().endsWith(ext)));
  
  let totalSize = 0;
  const largeImages = [];
  
  for (const file of imageFiles) {
    const filePath = path.join(IMAGES_DIR, file);
    const sizeKB = await getFileSize(filePath);
    totalSize += sizeKB;
    
    console.log(`${file}: ${sizeKB.toFixed(1)} KB`);
    
    if (sizeKB > MAX_SIZE_KB) {
      largeImages.push({ file, sizeKB });
    }
  }
  
  console.log(`\n📊 Resumen:`);
  console.log(`Total: ${imageFiles.length} imágenes, ${totalSize.toFixed(1)} KB`);
  console.log(`Imágenes > ${MAX_SIZE_KB} KB: ${largeImages.length}`);
  
  if (largeImages.length > 0) {
    console.log(`\n⚠️  Imágenes por optimizar:`);
    largeImages.forEach(({ file, sizeKB }) => {
      console.log(`  - ${file}: ${sizeKB.toFixed(1)} KB`);
    });
  }
  
  return { totalImages: imageFiles.length, totalSize, largeImages };
}

async function main() {
  try {
    // Verificar que el directorio existe
    await fs.access(IMAGES_DIR);
  } catch {
    console.error(`❌ Directorios de imágenes no encontrado: ${IMAGES_DIR}`);
    console.log("Asegúrate de que el proyecto está en la raíz correcta.");
    process.exit(1);
  }
  
  const command = process.argv[2];
  
  if (command === "analyze") {
    await analyzeAllImages();
  } else {
    // Por defecto, optimizar imágenes de onboarding
    await processOnboardingImages();
    console.log("✅ Optimización completada!");
  }
}

main().catch(error => {
  console.error("Error:", error);
  process.exit(1);
});

export { optimizeImage, getFileSize, processOnboardingImages, analyzeAllImages };
