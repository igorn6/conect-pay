const fs = require("fs");
const path = require("path");
const filePath = path.join(__dirname, "src/app/(main)/page.tsx");
let content = fs.readFileSync(filePath, "utf-8");

content = content.replace(
  'setCards((prev) => [newRequest, ...prev]);',
  `setCards((prev) => {
                if (prev.some(c => c.id === newRequest.id)) return prev;
                return [newRequest, ...prev];
              });`
);

fs.writeFileSync(filePath, content, "utf-8");
console.log("Patched deduplication");
