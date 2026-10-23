const fs = require('fs');

const file = 'src/components/Dashboard.tsx';
const lines = fs.readFileSync(file, 'utf8').split('\n');

const renderStart = lines.findIndex(l => l.includes('const renderExecutivePrintContent = () => ('));
const helperEnd = lines.findIndex((l, i) => i > renderStart && l.includes('</>') && lines[i+1].trim() === ');');

if (renderStart !== -1 && helperEnd !== -1) {
  const helperLines = lines.slice(renderStart, helperEnd + 2);
  
  const filterStart = lines.findIndex(l => l.includes('const filteredTickets = displaySource.filter'));
  const filterEnd = lines.findIndex((l, i) => i > filterStart && l.trim() === '});' && lines[i-1].includes('searchLow'));
  
  if (filterStart !== -1) {
     const filterCode = `  const filteredTickets = displaySource.filter((t) => {
    // Basic status match
    if (activeFilter === "resolved-today") {
      const cleanFixed = t.fixedAt?.replace(/\\//g, "-") || "";
      if (!cleanFixed.startsWith(todayStr)) return false;
    } else if (activeFilter === "resolved-all") {
      if (historyDate) {
        const [year, month, day] = historyDate.split("-");
        const formattedDate = \`\${day}-\${month}-\${year}\`;
        const cleanFixed = t.fixedAt?.replace(/\\//g, "-") || "";
        if (!cleanFixed.startsWith(formattedDate)) return false;
      }
    } else {
      const statusMatch = activeFilter === "all" || t.status === activeFilter;
      if (!statusMatch) return false;
    }

    if (!searchTerm.trim()) return true;
    const searchLow = searchTerm.toLowerCase();
    const b = t.building ? t.building.toLowerCase() : "";
    return (
      t.issue.toLowerCase().includes(searchLow) ||
      t.staffName.toLowerCase().includes(searchLow) ||
      t.mobile.toLowerCase().includes(searchLow) ||
      t.linkedRoom.toLowerCase().includes(searchLow) ||
      b.includes(searchLow) ||
      t.id.toLowerCase().includes(searchLow)
    );
  });`;

     const newLines = [
       ...lines.slice(0, filterStart),
       ...filterCode.split('\n'),
       '',
       ...helperLines,
       '',
       ...lines.slice(filterEnd + 1)
     ];
     
     fs.writeFileSync(file, newLines.join('\n'));
     console.log('Fixed Dashboard filter and helper');
  } else {
     console.log('Could not find filter start');
  }
} else {
  console.log('Could not find render helper');
}
