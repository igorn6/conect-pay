const fs = require("fs");
const path = require("path");
const modalPath = path.join(__dirname, "src/components/CardDetailModal.tsx");
let modalContent = fs.readFileSync(modalPath, "utf-8");

modalContent = modalContent.replace(
  'const requesterName = getRequesterName(card.real_requester_id);',
  'const requesterName = profilesMap[card.created_by] || profilesMap[card.real_requester_id || ""] || "Desconhecido";'
);

fs.writeFileSync(modalPath, modalContent, "utf-8");
console.log("Patched CardDetailModal completely");
