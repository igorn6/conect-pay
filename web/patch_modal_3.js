const fs = require("fs");
const path = require("path");
const modalPath = path.join(__dirname, "src/components/CardDetailModal.tsx");
let modalContent = fs.readFileSync(modalPath, "utf-8");

modalContent = modalContent.replace(
  '  onUpdate,\n}: CardDetailModalProps) {',
  '  onUpdate,\n  profilesMap = {},\n}: CardDetailModalProps) {'
);

fs.writeFileSync(modalPath, modalContent, "utf-8");
console.log("Patched CardDetailModal destructured props");
