const fs = require('fs');
const content = fs.readFileSync('src/components/Dashboard.tsx', 'utf8');

let balance = 0;
let lastUnbalancedLine = 0;
const lines = content.split('\n');

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  for (let j = 0; j < line.length; j++) {
    if (line[j] === '{') balance++;
    if (line[j] === '}') {
      balance--;
      if (balance < 0) {
        console.log(`Unmatched } at line ${i + 1}`);
      }
    }
  }
}
console.log(`Final balance: ${balance}`);
