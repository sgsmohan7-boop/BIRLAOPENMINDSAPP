const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'components', 'Dashboard.tsx');
let content = fs.readFileSync(filePath, 'utf-8');

const lines = content.split('\n');

let startIdx = -1;
let endIdx = -1;

for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('const renderExecutivePrintContent = () => (')) {
    startIdx = i;
    break;
  }
}

if (startIdx !== -1) {
  for (let i = startIdx; i < lines.length; i++) {
    if (lines[i].trim() === ');' && lines[i-1].includes('</>')) {
      endIdx = i;
      break;
    }
  }
}

console.log(`startIdx: ${startIdx}, endIdx: ${endIdx}`);

if (startIdx !== -1 && endIdx !== -1) {
  const helperLines = lines.slice(startIdx, endIdx + 1);
  
  let mainReturnIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim() === 'return (' && i > endIdx) {
      mainReturnIdx = i;
      break;
    }
  }
  
  console.log(`mainReturnIdx: ${mainReturnIdx}`);
  
  if (mainReturnIdx !== -1) {
    const beforeHelper = lines.slice(0, startIdx);
    const afterHelperToMainReturn = lines.slice(endIdx + 1, mainReturnIdx);
    const afterMainReturn = lines.slice(mainReturnIdx);
    
    const replacementFilterLines = [
      '    return (',
      '      t.issue.toLowerCase().includes(searchLow) ||',
      '      t.staffName.toLowerCase().includes(searchLow) ||',
      '      t.mobile.toLowerCase().includes(searchLow) ||',
      '      t.linkedRoom.toLowerCase().includes(searchLow) ||',
      '      b.includes(searchLow) ||',
      '      t.id.toLowerCase().includes(searchLow)',
      '    );'
    ];
    
    const finalLines = [
      ...beforeHelper,
      ...replacementFilterLines,
      ...afterHelperToMainReturn,
      '',
      ...helperLines,
      '',
      ...afterMainReturn
    ];
    
    fs.writeFileSync(filePath, finalLines.join('\n'), 'utf-8');
    console.log('Successfully repaired Dashboard.tsx and correctly placed renderExecutivePrintContent!');
  }
} else {
  console.error("Landmarks mismatch for Dashboard.tsx");
}
