const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

// Replace the end
code = code.replace(/if \(process\.env\.NODE_ENV !== "production" \|\| \(!process\.env\.VERCEL && !process\.env\.ELECTRON_RUN_AS_NODE\)\) \{[\s\S]*$/, 
`  if (process.env.NODE_ENV !== "production" || (!process.env.VERCEL && !process.env.ELECTRON_RUN_AS_NODE)) {
    app.listen(PORT, "0.0.0.0", () => {
      console.log(\`🚀 Birla IT Helpdesk full-stack server running on http://localhost:\${PORT}\`);
    });
  }
})();

export default app;
`);
fs.writeFileSync('server.ts', code);
