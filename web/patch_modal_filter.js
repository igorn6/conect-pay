const fs = require('fs');
const path = require('path');

const newReqPath = path.join(process.cwd(), "src/components/NewRequestModal.tsx");
let newReqCode = fs.readFileSync(newReqPath, "utf-8");

newReqCode = newReqCode.replace(
  'profilesList.filter(p => p.is_active).map((req) => (',
  'profilesList.filter(p => p.is_active !== false && p.id !== userId).map((req) => ('
);

fs.writeFileSync(newReqPath, newReqCode);
console.log("Updated NewRequestModal.tsx filter logic.");
