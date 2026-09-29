const fs = require("fs");
const path = require("path");
const filePath = path.join(__dirname, "src/app/(main)/configuracoes/page.tsx");
let content = fs.readFileSync(filePath, "utf-8");

content = content.replace(
  'const { error } = await supabase.from("categories").insert([{ name: newCatName.trim(), color: "bg-gray-500" }]);',
  'const { error } = await supabase.from("categories").insert([{ name: newCatName.trim() }]);'
);
// Also patch the original in case it hasn't been overwritten
content = content.replace(
  'await supabase.from("categories").insert([{ name: newCatName.trim(), color: "bg-gray-500" }]);',
  'await supabase.from("categories").insert([{ name: newCatName.trim() }]);'
);

fs.writeFileSync(filePath, content, "utf-8");
console.log("Patched insert");
