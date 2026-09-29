const fs = require('fs');
const path = require('path');

// 3. Update DashboardMetrics.tsx
const dashPath = path.join(process.cwd(), "src/components/dashboard/DashboardMetrics.tsx");
let dashCode = fs.readFileSync(dashPath, "utf-8");
dashCode = dashCode.replace(
  'import { getRequesterName } from "@/constants/requesters";',
  'import { useProfilesMap } from "@/hooks/useProfilesMap";'
);
dashCode = dashCode.replace(
  'export default function DashboardMetrics({ data }: DashboardMetricsProps) {',
  'export default function DashboardMetrics({ data }: DashboardMetricsProps) {\n  const { profilesMap } = useProfilesMap();'
);
dashCode = dashCode.replace(
  'name: getRequesterName(id)',
  'name: profilesMap[id] || "Desconhecido"'
);
fs.writeFileSync(dashPath, dashCode);

// 4. Update exportacao/page.tsx
const expPath = path.join(process.cwd(), "src/app/(main)/exportacao/page.tsx");
let expCode = fs.readFileSync(expPath, "utf-8");
expCode = expCode.replace(
  'import { getRequesterName } from "@/constants/requesters";',
  'import { useProfilesMap } from "@/hooks/useProfilesMap";'
);
expCode = expCode.replace(
  'const [loading, setLoading] = useState(false);',
  'const [loading, setLoading] = useState(false);\n  const { profilesMap } = useProfilesMap();'
);
expCode = expCode.replace(
  'getRequesterName(req.real_requester_id)',
  '(profilesMap[req.real_requester_id] || "Desconhecido")'
);
fs.writeFileSync(expPath, expCode);

console.log("Updated DashboardMetrics and exportacao/page.tsx.");
