import fs from "node:fs"; import path from "node:path"; import assert from "node:assert/strict";
const root=path.resolve(import.meta.dirname,"../.."); const read=(p)=>fs.readFileSync(path.join(root,p),"utf8");
assert(!read("src/app/cuenta/perfil/page.tsx").includes("window.confirm"));
assert(!read("src/app/cuenta/datos-bancarios/page.tsx").includes("window.confirm"));
assert(read("src/components/ConfirmDialog.tsx").includes('role="alertdialog"'));
assert(!read("src/app/globals.css").includes('[class*="sm:'));
assert(!/#[0-9a-f]{3,8}/i.test([...walk(path.join(root,"src"))].filter(p=>/\.(tsx?|css)$/.test(p)).map(p=>fs.readFileSync(p,"utf8")).join("\n")));
assert(read("src/lib/observability.ts").includes("FORBIDDEN"));
console.log("Sprint C5 static checks: PASS");
function* walk(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,e.name); if(e.isDirectory()) yield* walk(p); else yield p;}}
