const fs = require("fs");
const path = require("path");
const filePath = path.join(__dirname, "src/app/(auth)/login/page.tsx");
let content = fs.readFileSync(filePath, "utf-8");

content = content.replace(
  '<img \n              src="/logo-dark.png" \n              alt="Conect Pay"\n              className="h-24 w-auto object-contain scale-[3] sm:scale-[3.5] origin-center mb-10 mix-blend-screen"\n            />',
  `<div className="relative w-full h-24 flex items-center justify-center mb-6 overflow-hidden rounded-xl" style={{ backgroundColor: "transparent" }}>
              <img 
                src="/logo-dark.png" 
                alt="Conect Pay"
                className="absolute w-auto max-w-none h-[250%] object-cover mix-blend-lighten" 
              />
            </div>`
);

fs.writeFileSync(filePath, content, "utf-8");
console.log("Patched logo crop");
