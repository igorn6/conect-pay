const fs = require('fs');
const path = require('path');

const layoutPath = path.join(process.cwd(), "src/app/layout.tsx");
let content = fs.readFileSync(layoutPath, "utf-8");

if (!content.includes("ThemeProvider")) {
  // Add import
  content = content.replace(
    'import "./globals.css";',
    'import "./globals.css";\nimport { ThemeProvider } from "@/contexts/ThemeContext";'
  );
  
  // Wrap children
  content = content.replace(
    '{children}',
    '<ThemeProvider>{children}</ThemeProvider>'
  );
  
  fs.writeFileSync(layoutPath, content);
  console.log("layout.tsx updated with ThemeProvider!");
} else {
  console.log("layout.tsx already has ThemeProvider.");
}
