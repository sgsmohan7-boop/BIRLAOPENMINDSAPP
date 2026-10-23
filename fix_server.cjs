const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');
code = code.replace(/async function startServer\(\) \{/, 'const app = express();\nasync function startServer() {');
code = code.replace(/if \(process\.env\.NODE_ENV !== "production" || !process\.env\.VERCEL\) \{ startServer\(\); \}/, 'if (process.env.NODE_ENV !== "production" || !process.env.VERCEL) { startServer(); }\nexport default app;');
fs.writeFileSync('server.ts', code);
