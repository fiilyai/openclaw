/**
 * Fiily build patch: add OPENCLAW_TRUSTED_PLUGINS env-var allowlist
 * to the plugin install security scanner.
 *
 * When OPENCLAW_TRUSTED_PLUGINS=openclaw-weixin,openclaw-lark is set,
 * those plugins bypass the critical-code-pattern block (warning still shown).
 */
import { readFileSync, writeFileSync } from "node:fs";

const file = "src/plugins/install-security-scan.runtime.ts";
let src = readFileSync(file, "utf8");

// 1. Insert TRUSTED_PLUGINS constant before buildBlockedScanResult
const trustConst = `
const TRUSTED_PLUGINS = new Set(
  (process.env.OPENCLAW_TRUSTED_PLUGINS || "").split(",").map((s) => s.trim()).filter(Boolean),
);

`;
src = src.replace(
  "function buildBlockedScanResult(params: {",
  trustConst + "function buildBlockedScanResult(params: {"
);

// 2. Add pluginId to function signature
src = src.replace(
  "  targetLabel: string;\n}): InstallSecurityScanResult",
  "  targetLabel: string;\n  pluginId?: string;\n}): InstallSecurityScanResult"
);

// 3. Add trust check before first if
src = src.replace(
  "  if (params.builtinScan.status === \"error\") {",
  "  if (params.pluginId && TRUSTED_PLUGINS.has(params.pluginId)) { return undefined; }\n  if (params.builtinScan.status === \"error\") {"
);

// 4. Pass pluginId at each call site
for (const label of ["Bundle", "Plugin", "Plugin file"]) {
  const pattern = `targetLabel: \`${label} "\${params.pluginId}" installation\`,\n  });`;
  const replacement = `targetLabel: \`${label} "\${params.pluginId}" installation\`,\n    pluginId: params.pluginId,\n  });`;
  src = src.replace(pattern, replacement);
}

writeFileSync(file, src);
console.log("✅ Patched", file);
