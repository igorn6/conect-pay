const fs = require("fs");
const path = require("path");
const filePath = path.join(__dirname, "src/app/(auth)/login/page.tsx");
let content = fs.readFileSync(filePath, "utf-8");

const newCrop = `<div className="relative w-full h-24 flex items-center justify-center mb-6 overflow-hidden rounded-xl" style={{ backgroundColor: "transparent" }}>
            <img 
              src="/logo-dark.png" 
              alt="Conect Pay"
              className="absolute w-auto max-w-none h-[250%] object-cover mix-blend-lighten" 
            />
          </div>`;

content = content.replace(/<img[\s\S]*?logo-dark\.png[\s\S]*?\/>/, newCrop);

fs.writeFileSync(filePath, content, "utf-8");
console.log("Patched logo crop properly");
