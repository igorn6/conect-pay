const fs = require("fs");
const path = require("path");
const filePath = path.join(__dirname, "src/app/(main)/page.tsx");
let content = fs.readFileSync(filePath, "utf-8");

const oldBoard = `<KanbanBoard 
          cards={cards} 
          onCardClick={setSelectedCard} 
          onOpenTrash={() => setIsTrashModalOpen(true)}
        />`;

const newBoard = `<KanbanBoard 
          cards={cards} 
          onCardClick={setSelectedCard} 
          onOpenTrash={() => setIsTrashModalOpen(true)}
          selectable={userRole === "MASTER"}
          selectedIds={selectedIds}
          onToggleSelect={handleToggleSelect}
          onSelectAllInColumn={handleSelectAllInColumn}
        />
        {userRole === "MASTER" && (
          <MassActionBar
            selectedCount={selectedIds.size}
            onClear={() => setSelectedIds(new Set())}
            onAction={handleMassAction}
          />
        )}`;

if (content.includes(oldBoard)) {
  content = content.replace(oldBoard, newBoard);
  fs.writeFileSync(filePath, content, "utf-8");
  console.log("Patched page successfully");
} else {
  console.log("Could not find the target string. Existing block:");
  const boardMatch = content.match(/<KanbanBoard[\s\S]*?\/>/);
  console.log(boardMatch ? boardMatch[0] : "Not found");
}

