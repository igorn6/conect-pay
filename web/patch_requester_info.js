const fs = require('fs');
const path = require('path');

// Fix KanbanColumn.tsx display name logic
const colPath = path.join(process.cwd(), "src/components/KanbanColumn.tsx");
let colCode = fs.readFileSync(colPath, "utf-8");
colCode = colCode.replace(
  'profilesMap[card.created_by] || profilesMap[card.real_requester_id || ""] || "Desconhecido"',
  'profilesMap[card.real_requester_id || ""] || profilesMap[card.created_by] || "Desconhecido"'
);
fs.writeFileSync(colPath, colCode);
console.log("KanbanColumn.tsx updated.");

// Add "Criado por" info to CardDetailModal.tsx
const modalPath = path.join(process.cwd(), "src/components/CardDetailModal.tsx");
let modalCode = fs.readFileSync(modalPath, "utf-8");

if (!modalCode.includes("const creatorName = ")) {
  modalCode = modalCode.replace(
    'const requesterName = profilesMap[card.real_requester_id || ""] || profilesMap[card.created_by] || "Desconhecido";',
    `const requesterName = profilesMap[card.real_requester_id || ""] || profilesMap[card.created_by] || "Desconhecido";
    const creatorName = profilesMap[card.created_by] || "Desconhecido";
    const isProxyRequest = card.real_requester_id && card.real_requester_id !== card.created_by;`
  );

  modalCode = modalCode.replace(
    `<div>
                <p className="text-sm text-slate-400">Solicitante</p>
                <div className="flex items-center gap-2 mt-1">
                  <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-sm font-bold text-slate-300">
                    {requesterName.charAt(0).toUpperCase()}
                  </div>
                  <span className="text-slate-200 font-medium">{requesterName}</span>
                </div>
              </div>`,
    `<div>
                <p className="text-sm text-slate-400">Solicitante</p>
                <div className="flex items-center gap-2 mt-1">
                  <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-sm font-bold text-slate-300">
                    {requesterName.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex flex-col">
                    <span className="text-slate-200 font-medium">{requesterName}</span>
                    {isProxyRequest && (
                      <span className="text-xs text-slate-500">Criado por: {creatorName}</span>
                    )}
                  </div>
                </div>
              </div>`
  );
  fs.writeFileSync(modalPath, modalCode);
  console.log("CardDetailModal.tsx updated with creator info.");
} else {
  console.log("CardDetailModal.tsx already has creator info.");
}
