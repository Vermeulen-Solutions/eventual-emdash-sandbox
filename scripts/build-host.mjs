/** Host-side tools must run as JavaScript even inside node_modules. */
import {readFileSync,writeFileSync} from "node:fs";
import ts from "typescript";
const source=readFileSync(new URL("../src/schema/blueprint.ts",import.meta.url),"utf8");
const options={target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,verbatimModuleSyntax:true};
const runtime=ts.transpileModule(source,{compilerOptions:options,reportDiagnostics:true});
const declaration=ts.transpileDeclaration(source,{compilerOptions:{...options,isolatedDeclarations:true},fileName:"blueprint.ts",reportDiagnostics:true});
const errors=[...(runtime.diagnostics??[]),...(declaration.diagnostics??[])].filter(item=>item.category===ts.DiagnosticCategory.Error);
if(errors.length) throw new Error(errors.map(item=>ts.flattenDiagnosticMessageText(item.messageText,"\n")).join("\n"));
for(const [extension,result] of [["mjs",runtime],["d.mts",declaration]]) writeFileSync(new URL(`../astro/blueprint.${extension}`,import.meta.url),"// Generated from src/schema/blueprint.ts by scripts/build-host.mjs.\n"+result.outputText);
