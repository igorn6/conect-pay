const fs = require('fs');
const path = require('path');

const p = path.join(process.cwd(), "src/app/(main)/layout.tsx");
let code = fs.readFileSync(p, "utf-8");

if (!code.includes("GlobalNotification")) {
  code = code.replace(
    'import Sidebar from "@/components/Sidebar";',
    'import Sidebar from "@/components/Sidebar";\nimport GlobalNotification from "@/components/GlobalNotification";'
  );
  
  code = code.replace(
    '<Sidebar />',
    '<Sidebar />\n      <GlobalNotification />'
  );
  
  fs.writeFileSync(p, code);
  console.log("layout.tsx updated with GlobalNotification.");
} else {
  console.log("layout.tsx already has GlobalNotification.");
}
