const fs = require("fs");
const path = require("path");
const modalPath = path.join(__dirname, "src/components/CardDetailModal.tsx");
let modalContent = fs.readFileSync(modalPath, "utf-8");

modalContent = modalContent.replace('import { getRequesterName } from "@/constants/requesters";\n', '');

modalContent = modalContent.replace(
  'onClose: () => void;',
  'onClose: () => void;\n  profilesMap?: Record<string, string>;'
);

modalContent = modalContent.replace(
  'export default function CardDetailModal({ card, onClose, onUpdate, onDelete }: CardDetailModalProps) {',
  'export default function CardDetailModal({ card, onClose, onUpdate, onDelete, profilesMap = {} }: CardDetailModalProps) {'
);

modalContent = modalContent.replace(
  '{getRequesterName(card.real_requester_id)}',
  '{profilesMap[card.created_by] || profilesMap[card.real_requester_id || ""] || "Desconhecido"}'
);

fs.writeFileSync(modalPath, modalContent, "utf-8");

const pagePath = path.join(__dirname, "src/app/(main)/page.tsx");
let pageContent = fs.readFileSync(pagePath, "utf-8");

pageContent = pageContent.replace(
  '<CardDetailModal\n            card={selectedCard}',
  '<CardDetailModal\n            profilesMap={profilesMap}\n            card={selectedCard}'
);

fs.writeFileSync(pagePath, pageContent, "utf-8");
console.log("Patched CardDetailModal");
