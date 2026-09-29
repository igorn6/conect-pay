const fs = require('fs');
const path = require('path');

const sidePath = path.join(process.cwd(), "src/components/Sidebar.tsx");
let code = fs.readFileSync(sidePath, "utf-8");

// The current state: we have <Link> opening but </div> closing.
// Replace the exact closing tag after the img
code = code.replace(
  `/>\n          </div>\n          \n          <button onClick={() => setIsOpen(false)}`,
  `/>\n          </Link>\n          \n          <button onClick={() => setIsOpen(false)}`
);

fs.writeFileSync(sidePath, code);

if (code.includes('</Link>')) {
  console.log("SUCCESS: </Link> found.");
} else {
  console.log("FAILED: </Link> NOT found. Trying other approach...");
}
