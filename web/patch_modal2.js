const fs = require('fs');
const path = require('path');

const newReqPath = path.join(process.cwd(), "src/components/NewRequestModal.tsx");
let newReqCode = fs.readFileSync(newReqPath, "utf-8");

newReqCode = newReqCode.replace(
  'REQUESTERS.map((req) => (',
  'profilesList.filter(p => p.is_active).map((req) => ('
);

fs.writeFileSync(newReqPath, newReqCode);
console.log("Fixed REQUESTERS to profilesList.");
