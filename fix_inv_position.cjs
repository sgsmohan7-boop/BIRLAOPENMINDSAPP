const fs = require('fs');

const file = 'src/components/InventoryMaster.tsx';
const lines = fs.readFileSync(file, 'utf8').split('\n');

const renderStart = lines.findIndex(l => l.includes('const renderInventoryPrintContent = () => ('));
const renderEnd = lines.findIndex((l, i) => i > renderStart && l.includes('</>') && lines[i+1].trim() === ');');

if (renderStart !== -1 && renderEnd !== -1) {
    const helperLines = lines.slice(renderStart, renderEnd + 2);
    
    // remove them from current location
    let newLines = [
        ...lines.slice(0, renderStart),
        ...lines.slice(renderEnd + 2)
    ];
    
    // Now look for `  return (` which is around line 960
    // Actually we can just find where `  return (` exists and is not indented heavily
    let mainReturnIdx = -1;
    for (let i = 0; i < newLines.length; i++) {
        if (newLines[i] === '  return (') {
            mainReturnIdx = i;
            break;
        }
    }
    
    if (mainReturnIdx !== -1) {
        newLines.splice(mainReturnIdx, 0, '\n', ...helperLines, '\n');
        fs.writeFileSync(file, newLines.join('\n'));
        console.log('Moved render component down properly.');
    } else {
        console.log('Could not find main return');
    }
} else {
    console.log('Could not find helper lines');
}
