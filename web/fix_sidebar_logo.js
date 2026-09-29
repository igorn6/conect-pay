const fs = require('fs');
const path = require('path');

const p = path.join(process.cwd(), "src/components/Sidebar.tsx");
let code = fs.readFileSync(p, "utf-8");

code = code.replace(
  'src="/logo-dark.png"',
  'src="/logo-light.png"'
);

fs.writeFileSync(p, code);
console.log("Sidebar.tsx patched to use logo-light.png.");
