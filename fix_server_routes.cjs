const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

// Replace "async function startServer() {" with nothing, and unindent or just leave it.
code = code.replace(/const app = express\(\);\nasync function startServer\(\) \{/, 'const app = express();');

// Replace the end part
code = code.replace(/if \(process\.env\.NODE_ENV !== "production"\) \{([\s\S]*?)app\.listen\(PORT, "0\.0\.0\.0", \(\) => \{/m, 
`(async () => {
  if (process.env.NODE_ENV !== "production" && !process.env.VERCEL) {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  if (process.env.NODE_ENV !== "production" || (!process.env.VERCEL && !process.env.ELECTRON_RUN_AS_NODE)) {
    app.listen(PORT, "0.0.0.0", () => {`);

code = code.replace(/if \(process\.env\.NODE_ENV !== "production" \|\| !process\.env\.VERCEL\) \{ startServer\(\); \}/, '');
code = code.replace(/export default app;\nexport default app;/, 'export default app;');

fs.writeFileSync('server.ts', code);
