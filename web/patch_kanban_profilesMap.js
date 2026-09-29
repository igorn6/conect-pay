const fs = require('fs');
const path = require('path');

const p = path.join(process.cwd(), "src/app/(main)/kanban/page.tsx");
let code = fs.readFileSync(p, "utf-8");

code = code.replace(
  `        <CardDetailModal
          card={selectedCard}
          userRole={userRole}
          simulatedUserName={simulatedUserName}`,
  `        <CardDetailModal
          card={selectedCard}
          userRole={userRole}
          simulatedUserName={simulatedUserName}
          profilesMap={profilesMap}`
);

fs.writeFileSync(p, code);
console.log("kanban/page.tsx updated with profilesMap.");
