const fs = require("fs");
const path = require("path");
const filePath = path.join(__dirname, "src/app/(auth)/login/page.tsx");
let content = fs.readFileSync(filePath, "utf-8");

content = content.replace(
  'className="h-16 w-auto object-contain mb-2 mix-blend-lighten"',
  'className="h-32 w-auto max-w-[80%] object-contain mb-2 mix-blend-lighten drop-shadow-[0_0_15px_rgba(139,92,246,0.2)]"'
);

fs.writeFileSync(filePath, content, "utf-8");
console.log("Patched logo size");
