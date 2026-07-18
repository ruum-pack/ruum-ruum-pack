import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const appRoot = resolve(__dirname, "..");

function readProjectFile(path: string) {
  return readFileSync(resolve(appRoot, path), "utf8");
}

describe("Android backup security", () => {
  it("desactiva backups y declara reglas defensivas de extraccion", () => {
    const manifest = readProjectFile("android/app/src/main/AndroidManifest.xml");

    expect(manifest).toContain('android:allowBackup="false"');
    expect(manifest).toContain('android:fullBackupContent="@xml/backup_rules"');
    expect(manifest).toContain('android:dataExtractionRules="@xml/data_extraction_rules"');
  });

  it("excluye dominios locales sensibles de backup y device transfer", () => {
    const backupRules = readProjectFile("android/app/src/main/res/xml/backup_rules.xml");
    const extractionRules = readProjectFile("android/app/src/main/res/xml/data_extraction_rules.xml");

    for (const domain of ["sharedpref", "database", "file", "external", "root"]) {
      expect(backupRules).toContain(`<exclude domain="${domain}" path="."`);
      expect(extractionRules).toContain(`<exclude domain="${domain}" path="."`);
    }

    expect(extractionRules).toContain("<cloud-backup");
    expect(extractionRules).toContain("<device-transfer>");
  });
});
