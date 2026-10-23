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
    
    // Now look for export default function InventoryMaster
    const componentStart = newLines.findIndex(l => l.includes('export default function InventoryMaster'));
    
    // We'll put the helper just after the component is declared
    // Component usually has `export default function InventoryMaster({ inventory, ... }: Props) {`
    const insertPoint = newLines.findIndex((l, i) => i > componentStart && l.trim() === '}: InventoryMasterProps) {') + 1;
    
    newLines.splice(insertPoint, 0, '\n', ...helperLines, '\n');
    
    fs.writeFileSync(file, newLines.join('\n'));
    console.log('Fixed InventoryMaster Print Content position.');
} else {
    console.log('Could not find helper lines');
}
