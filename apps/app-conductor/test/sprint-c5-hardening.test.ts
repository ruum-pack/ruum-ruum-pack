import { describe, expect, it } from "vitest";
import fs from "node:fs"; import path from "node:path";
const root=path.resolve(__dirname,"..");
const read=(p:string)=>fs.readFileSync(path.join(root,p),"utf8");
describe("Sprint C5",()=>{
 it("no usa confirmación nativa",()=>{const files=["src/app/cuenta/perfil/page.tsx","src/app/cuenta/datos-bancarios/page.tsx"]; for(const f of files) expect(read(f)).not.toContain("window.confirm");});
 it("el diálogo administra foco",()=>{const s=read("src/components/ConfirmDialog.tsx"); expect(s).toContain('role="alertdialog"'); expect(s).toContain("cancelRef.current?.focus");});
 it("no mantiene selectores responsive globales por clases Tailwind",()=>{const s=read("src/app/globals.css"); expect(s).not.toContain('[class*="sm:');});
 it("telemetría filtra datos sensibles",()=>{const s=read("src/lib/observability.ts"); expect(s).toMatch(/curp\|clabe/); expect(s).toMatch(/token/);});
});
