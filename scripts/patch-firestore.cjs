const fs = require("fs");
const path = require("path");

function walk(dir, callback) {
  if (!fs.existsSync(dir)) return;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath, callback);
    } else if (entry.isFile() && fullPath.endsWith(".js")) {
      callback(fullPath);
    }
  }
}

const firestoreDir = path.resolve(__dirname, "../node_modules/@firebase/firestore");
const viteCacheDir = path.resolve(__dirname, "../node_modules/.vite");

[firestoreDir, viteCacheDir].forEach(dir => {
  walk(dir, (filePath) => {
    try {
      let content = fs.readFileSync(filePath, "utf8");
      if (content.includes("this.ve -= 1, __PRIVATE_hardAssert(this.ve >= 0")) {
        content = content.replace(/this\.ve\s*-=\s*1,\s*__PRIVATE_hardAssert\(this\.ve\s*>=\s*0[^;]*\);/g, "this.ve = Math.max(0, this.ve - 1);");
        fs.writeFileSync(filePath, content, "utf8");
        console.log("[patch-firestore] Patched assertion in:", path.relative(process.cwd(), filePath));
      }
    } catch (_) {}
  });
});
