const fs = require('fs');
const path = require('path');

const sidePath = path.join(process.cwd(), "src/components/Sidebar.tsx");
let code = fs.readFileSync(sidePath, "utf-8");

// Add target="_self" to all <Link> tags
code = code.replace(/<Link /g, '<Link target="_self" ');

fs.writeFileSync(sidePath, code);
console.log("Added target='_self' to all Links in Sidebar.");
