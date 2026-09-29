const fs = require('fs');
const path = require('path');

const sidePath = path.join(process.cwd(), "src/components/Sidebar.tsx");
let code = fs.readFileSync(sidePath, "utf-8");

// Replace the logo wrapper div with Link
code = code.replace(
  '<div className="flex items-center h-full pt-1 overflow-hidden">\n              <img \n               src="/logo-dark.png"',
  '<Link href="/" aria-label="Ir para a p\u00e1gina inicial" className="flex items-center h-full pt-1 overflow-hidden">\n              <img \n               src="/logo-dark.png"'
);

// Also handle CRLF line endings
code = code.replace(
  '<div className="flex items-center h-full pt-1 overflow-hidden">\r\n              <img \r\n               src="/logo-dark.png"',
  '<Link href="/" aria-label="Ir para a p\u00e1gina inicial" className="flex items-center h-full pt-1 overflow-hidden">\r\n              <img \r\n               src="/logo-dark.png"'
);

// Replace the closing </div> that wraps the logo
code = code.replace(
  `              />\r\n            </div>`,
  `              />\r\n            </Link>`
);

fs.writeFileSync(sidePath, code);
console.log("Sidebar logo wrapped in Link with aria-label.");
