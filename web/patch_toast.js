const fs = require("fs");
const path = require("path");
const filePath = path.join(__dirname, "src/app/(main)/page.tsx");
let content = fs.readFileSync(filePath, "utf-8");

content = content.replace(/showToast\("([^"]+)", "([^"]+)"\)/g, 'setToast({ message: "$1", type: "$2" })');
content = content.replace(/showToast\(([^,]+), "([^"]+)"\)/g, 'setToast({ message: $1, type: "$2" })');

fs.writeFileSync(filePath, content, "utf-8");
console.log("Patched showToast");
