const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'components', 'Dashboard.tsx');
let content = fs.readFileSync(filePath, 'utf-8');

const lines = content.split('\n');

let helperStartIdx = -1;
let helperEndIdx = -1;

for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('const renderExecutivePrintContent = () => (')) {
    helperStartIdx = i;
    break;
  }
}

if (helperStartIdx !== -1) {
  for (let i = helperStartIdx; i < lines.length; i++) {
    if (lines[i].trim() === ');' && lines[i-1].includes('SYSTEM AUDITOR')) {
      helperEndIdx = i;
      break;
    }
  }
}

console.log(`helperStartIdx: ${helperStartIdx}, helperEndIdx: ${helperEndIdx}`);

if (helperStartIdx !== -1 && helperEndIdx !== -1) {
  // Extract renderExecutivePrintContent lines
  const helperLines = lines.slice(helperStartIdx, helperEndIdx + 1);
  
  // Find where priorityMap starts (which is right before line 685)
  let priorityMapIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('const priorityMap = {')) {
      priorityMapIdx = i;
      break;
    }
  }
  
  console.log(`priorityMapIdx: ${priorityMapIdx}`);
  
  if (priorityMapIdx !== -1) {
    // Before lines:
    const beforeHelper = lines.slice(0, helperStartIdx);
    // After lines:
    const afterHelperToPriorityMap = lines.slice(helperEndIdx + 1, priorityMapIdx);
    const fromPriorityMapToEnd = lines.slice(priorityMapIdx);
    
    // Construct the new array
    const finalSequence = [
      ...beforeHelper,
      ...afterHelperToPriorityMap,
      '',
      ...helperLines,
      '',
      ...fromPriorityMapToEnd
    ];
    
    fs.writeFileSync(filePath, finalSequence.join('\n'), 'utf-8');
    console.log('Successfully unscoped renderExecutivePrintContent to component top!');
  }
} else {
  console.error('landmarks mismatch!');
}
