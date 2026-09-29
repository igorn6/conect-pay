const fs = require("fs");
const path = require("path");
const colPath = path.join(__dirname, "src/components/KanbanColumn.tsx");
let colContent = fs.readFileSync(colPath, "utf-8");

// replace import
colContent = colContent.replace('import { getRequesterName } from "@/constants/requesters";\n', '');

// add to interface
colContent = colContent.replace(
  'onCardClick: (card: PaymentRequest) => void;',
  'onCardClick: (card: PaymentRequest) => void;\n  profilesMap?: Record<string, string>;'
);

// add to props
colContent = colContent.replace(
  'export default function KanbanColumn({ config, cards, onCardClick, selectable = false, selectedIds = new Set(), onToggleSelect, onSelectAll }: KanbanColumnProps) {',
  'export default function KanbanColumn({ config, cards, onCardClick, selectable = false, selectedIds = new Set(), onToggleSelect, onSelectAll, profilesMap = {} }: KanbanColumnProps) {'
);

// replace usage
colContent = colContent.replace(
  '{getRequesterName(card.real_requester_id)}',
  '{profilesMap[card.created_by] || profilesMap[card.real_requester_id || ""] || "Desconhecido"}'
);

fs.writeFileSync(colPath, colContent, "utf-8");

const boardPath = path.join(__dirname, "src/components/KanbanBoard.tsx");
let boardContent = fs.readFileSync(boardPath, "utf-8");

boardContent = boardContent.replace(
  'onOpenTrash: () => void;',
  'onOpenTrash: () => void;\n  profilesMap?: Record<string, string>;'
);

boardContent = boardContent.replace(
  'export default function KanbanBoard({ cards, onCardClick, onOpenTrash, selectable = false, selectedIds = new Set(), onToggleSelect, onSelectAllInColumn }: KanbanBoardProps) {',
  'export default function KanbanBoard({ cards, onCardClick, onOpenTrash, selectable = false, selectedIds = new Set(), onToggleSelect, onSelectAllInColumn, profilesMap = {} }: KanbanBoardProps) {'
);

boardContent = boardContent.replace(
  'onToggleSelect={onToggleSelect}',
  'onToggleSelect={onToggleSelect}\n              profilesMap={profilesMap}'
);

fs.writeFileSync(boardPath, boardContent, "utf-8");

const pagePath = path.join(__dirname, "src/app/(main)/page.tsx");
let pageContent = fs.readFileSync(pagePath, "utf-8");

pageContent = pageContent.replace(
  'const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());',
  'const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());\n  const [profilesMap, setProfilesMap] = useState<Record<string, string>>({});'
);

const fetchProfiles = `  useEffect(() => {
    supabase.from("profiles").select("id, name").then(({ data }) => {
      if (data) {
        const map: Record<string, string> = {};
        data.forEach(p => map[p.id] = p.name);
        setProfilesMap(map);
      }
    });
  }, []);

  const fetchCards`;

pageContent = pageContent.replace('  const fetchCards', fetchProfiles);

pageContent = pageContent.replace(
  'onToggleSelect={handleToggleSelect}',
  'onToggleSelect={handleToggleSelect}\n            profilesMap={profilesMap}'
);

fs.writeFileSync(pagePath, pageContent, "utf-8");
console.log("Patched profilesMap");
