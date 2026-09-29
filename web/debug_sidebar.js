const fs = require('fs');
const path = require('path');

const sidePath = path.join(process.cwd(), "src/components/Sidebar.tsx");
let code = fs.readFileSync(sidePath, "utf-8");

// Show the area around logo-dark
const idx = code.indexOf('logo-dark.png');
if (idx > -1) {
  const start = Math.max(0, idx - 200);
  const end = Math.min(code.length, idx + 200);
  console.log("CONTEXT:");
  console.log(JSON.stringify(code.substring(start, end)));
}
