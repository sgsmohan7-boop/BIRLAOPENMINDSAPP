const fs = require('fs');

const file = 'src/components/Dashboard.tsx';
const lines = fs.readFileSync(file, 'utf8').split('\n');

const importLineIdx = lines.findIndex((l, idx) => idx > 0 && l.startsWith('import React'));

if (importLineIdx !== -1) {
  const newLines = lines.slice(importLineIdx);
  fs.writeFileSync(file, newLines.join('\n'));
  console.log('Removed duplicate top lines.');
} else {
  console.log('No duplicate import found.');
}
