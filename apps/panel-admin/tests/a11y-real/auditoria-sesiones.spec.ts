import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
const storageState=process.env.ADMIN_STORAGE_STATE;
test.skip(!storageState,"ADMIN_STORAGE_STATE debe apuntar a una sesión administrativa real y no expirada");
for(const ruta of ["/","/viajes","/pagos","/aprobaciones","/auditoria"]){
 test(`sin violaciones críticas con sesión real: ${ruta}`,async({browser})=>{const context=await browser.newContext({storageState:storageState!});const page=await context.newPage();await page.goto(ruta);await expect(page).not.toHaveURL(/login/);const resultado=await new AxeBuilder({page}).withTags(["wcag2a","wcag2aa","wcag21aa"]).analyze();expect(resultado.violations.filter(v=>["critical","serious"].includes(v.impact??""))).toEqual([]);await context.close();});
}
