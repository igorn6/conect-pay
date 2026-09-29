const fs = require("fs");
const path = require("path");
const filePath = path.join(__dirname, "src/app/(main)/page.tsx");
let content = fs.readFileSync(filePath, "utf-8");

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

content = content.replace(/<KanbanBoard[\s\S]*?\/>/, newBoard);
fs.writeFileSync(filePath, content, "utf-8");
console.log("Patched page accurately!");
