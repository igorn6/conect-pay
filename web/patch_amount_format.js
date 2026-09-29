const fs = require('fs');
const path = require('path');

// 1. consultas/page.tsx
const consultasPath = path.join(process.cwd(), "src/app/(main)/consultas/page.tsx");
let consultas = fs.readFileSync(consultasPath, "utf-8");
consultas = consultas.replace(
  'return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);',
  'return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value));'
);
fs.writeFileSync(consultasPath, consultas);

// 2. CardDetailModal.tsx
const cardDetailPath = path.join(process.cwd(), "src/components/CardDetailModal.tsx");
let cardDetail = fs.readFileSync(cardDetailPath, "utf-8");
cardDetail = cardDetail.replace(
  'const formattedAmount = card.amount.toLocaleString("pt-BR", { minimumFractionDigits: 2 });',
  'const formattedAmount = Number(card.amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 });'
);
cardDetail = cardDetail.replace(
  'R$ {card.amount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}',
  'R$ {Number(card.amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}'
);
fs.writeFileSync(cardDetailPath, cardDetail);

// 3. GlobalNotification.tsx
const globalNotifPath = path.join(process.cwd(), "src/components/GlobalNotification.tsx");
let globalNotif = fs.readFileSync(globalNotifPath, "utf-8");
globalNotif = globalNotif.replace(
  'body: `Novo pedido de R$ ${newRequest.amount} criado.`',
  'body: `Novo pedido de R$ ${Number(newRequest.amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })} criado.`'
);
fs.writeFileSync(globalNotifPath, globalNotif);

// 4. KanbanColumn.tsx
const kanbanColPath = path.join(process.cwd(), "src/components/KanbanColumn.tsx");
let kanbanCol = fs.readFileSync(kanbanColPath, "utf-8");
kanbanCol = kanbanCol.replace(
  '}).format(card.amount)}',
  '}).format(Number(card.amount))}'
);
fs.writeFileSync(kanbanColPath, kanbanCol);

// 5. TrashModal.tsx
const trashModalPath = path.join(process.cwd(), "src/components/TrashModal.tsx");
let trashModal = fs.readFileSync(trashModalPath, "utf-8");
trashModal = trashModal.replace(
  '}).format(card.amount)}',
  '}).format(Number(card.amount))}'
);
fs.writeFileSync(trashModalPath, trashModal);

console.log("Amount formatting fixed in all components.");
