const fs = require('fs');
const path = require('path');

const p = path.join(process.cwd(), "src/app/(main)/kanban/page.tsx");
let code = fs.readFileSync(p, "utf-8");

code = code.replace(
  `            }
              }
            }
          }

          if (payload.eventType === "DELETE") {`,
  `            }

          if (payload.eventType === "DELETE") {`
);

fs.writeFileSync(p, code);
console.log("Fixed kanban/page.tsx dangling braces.");
