const fs = require("fs");
const path = require("path");
const filePath = path.join(__dirname, "src/app/(auth)/login/page.tsx");
let content = fs.readFileSync(filePath, "utf-8");

content = content.replace(
  'className="h-24 w-auto object-contain scale-[2] sm:scale-[2.5] origin-center mb-10 mix-blend-lighten drop-shadow-[0_0_15px_rgba(139,92,246,0.4)]"',
  'className="h-24 w-auto object-contain scale-[3] sm:scale-[3.5] origin-center mb-10 mix-blend-screen"'
);

fs.writeFileSync(filePath, content, "utf-8");
console.log("Patched logo huge 2");
