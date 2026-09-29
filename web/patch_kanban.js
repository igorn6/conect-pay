const fs = require('fs');
const path = require('path');

const p = path.join(process.cwd(), "src/app/(main)/kanban/page.tsx");
let code = fs.readFileSync(p, "utf-8");

code = code.replace(
  '<CardDetailModal\n            card={selectedCard}\n            userRole={userRole}\n            simulatedUserName={simulatedUserName}\n            onClose={() => setSelectedCard(null)}\n            onUpdate={fetchCards}',
  '<CardDetailModal\n            card={selectedCard}\n            userRole={userRole}\n            simulatedUserName={simulatedUserName}\n            onClose={() => setSelectedCard(null)}\n            onUpdate={fetchCards}\n            profilesMap={profilesMap}'
);

fs.writeFileSync(p, code);
console.log("kanban/page.tsx updated to pass profilesMap.");
