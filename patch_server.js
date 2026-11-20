const fs = require('fs');
const path = require('path');
const root = 'C:\\Users\\luiza\\Documents\\Ingenieria de software\\-MotoConnect';
const serverPath = path.join(root, 'server.js');
const endpointPath = path.join(root, 'tmp_endpoint.txt');
let code = fs.readFileSync(serverPath, 'utf8');

// 1. Load .env natively
const envLoader = [
"// Load .env natively (no dotenv dependency)",
"function loadEnvFile() {",
"  try {",
"    const envPath = path.join(__dirname, '.env');",
"    if (!fs.existsSync(envPath)) return;",
"    const lines = fs.readFileSync(envPath, 'utf8').split(/\\r?\\n/);",
"    for (const rawLine of lines) {",
"      const line = rawLine.trim();",
"      if (!line || line.startsWith('#')) continue;",
"      const eq = line.indexOf('=');",
"      if (eq < 0) continue;",
"      const key = line.slice(0, eq).trim();",
"      let value = line.slice(eq + 1).trim();",
"      if ((value.startsWith('\"') && value.endsWith('\"')) || (value.startsWith(\"'\") && value.endsWith(\"'\"))) {",
"        value = value.slice(1, -1);",
"      }",
"      if (key && process.env[key] === undefined) process.env[key] = value;",
"    }",
"  } catch (err) {",
"    console.error('[ENV] No se pudo leer .env:', err.message);",
"  }",
"}",
"loadEnvFile();",
""].join('\n');

if (!code.includes('function loadEnvFile()')) {
  code = code.replace("const crypto = require('crypto');\n", "const crypto = require('crypto');\n" + envLoader + "\n");
}

// 2. Route-specific JSON limit
if (!code.includes("app.use('/api/ai/asesor', express.json({ limit: '20kb' }))")) {
  code = code.replace(
    "app.use(express.json({ limit: '10mb' }));",
    "app.use('/api/ai/asesor', express.json({ limit: '20kb' }));\napp.use(express.json({ limit: '10mb' }));"
  );
}

// 3. Insert endpoint before 404 handler
const endpoint = fs.readFileSync(endpointPath, 'utf8');
const marker = "// ─────────────────────────────────────────────\n// 404 handler for API routes";
if (!code.includes("app.post('/api/ai/asesor'")) {
  if (!code.includes(marker)) throw new Error('marker not found');
  code = code.replace(marker, endpoint + "\n" + marker);
}

fs.writeFileSync(serverPath, code, 'utf8');
console.log('patched server.js');