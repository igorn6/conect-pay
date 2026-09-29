const fs = require('fs');
const path = require('path');

const sidePath = path.join(process.cwd(), "src/components/Sidebar.tsx");
let code = fs.readFileSync(sidePath, "utf-8");

// Replace exact match with LF linebreaks
code = code.replace(
  '<div className="flex items-center h-full pt-1 overflow-hidden">\n            <img \n              src="/logo-dark.png"',
  '<Link href="/" aria-label="Ir para a p\u00e1gina inicial" className="flex items-center h-full pt-1 overflow-hidden">\n            <img \n              src="/logo-dark.png"'
);

// Find and replace the closing </div> that wraps the logo img
// The pattern is: />\n            </div>
code = code.replace(
  "/>\n            </div>\n",
  "/>\n            </Link>\n"
);

fs.writeFileSync(sidePath, code);

// Verify
if (code.includes('aria-label')) {
  console.log("SUCCESS: aria-label found.");
} else {
  console.log("FAILED: aria-label NOT found.");
}
