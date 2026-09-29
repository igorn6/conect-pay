const fs = require('fs');
const path = require('path');

// 1. Update requesters.ts
const reqPath = path.join(process.cwd(), "src/constants/requesters.ts");
let reqCode = fs.readFileSync(reqPath, "utf-8");
// Keep only PAYMENT_TYPES
reqCode = `/** Tipos de pagamento disponveis */
export const PAYMENT_TYPES = ["Pix", "Caju"] as const;
`;
fs.writeFileSync(reqPath, reqCode);

// 2. Update NewRequestModal.tsx
const newReqPath = path.join(process.cwd(), "src/components/NewRequestModal.tsx");
let newReqCode = fs.readFileSync(newReqPath, "utf-8");

newReqCode = newReqCode.replace(
  'import {\n  REQUESTERS,\n  PAYMENT_TYPES,\n} from "@/constants/requesters";',
  'import { PAYMENT_TYPES } from "@/constants/requesters";\nimport { useProfilesMap } from "@/hooks/useProfilesMap";'
);
newReqCode = newReqCode.replace(
  'import {\n  REQUESTERS,\n  PAYMENT_TYPES\n} from "@/constants/requesters";',
  'import { PAYMENT_TYPES } from "@/constants/requesters";\nimport { useProfilesMap } from "@/hooks/useProfilesMap";'
);
newReqCode = newReqCode.replace(
  'import { REQUESTERS, PAYMENT_TYPES } from "@/constants/requesters";',
  'import { PAYMENT_TYPES } from "@/constants/requesters";\nimport { useProfilesMap } from "@/hooks/useProfilesMap";'
);

// If it's single line imports:
if (newReqCode.includes('import { REQUESTERS')) {
  newReqCode = newReqCode.replace(/import\s*\{[^}]*REQUESTERS[^}]*\}\s*from\s*['"]@\/constants\/requesters['"];/g, 
    'import { PAYMENT_TYPES } from "@/constants/requesters";\nimport { useProfilesMap } from "@/hooks/useProfilesMap";');
} else {
  // If we don't find it exactly, fallback regex
  newReqCode = newReqCode.replace(/import\s*\{\s*REQUESTERS,\s*PAYMENT_TYPES,?\s*\}\s*from\s*['"]@\/constants\/requesters['"];/g,
    'import { PAYMENT_TYPES } from "@/constants/requesters";\nimport { useProfilesMap } from "@/hooks/useProfilesMap";');
}


// Add useProfilesMap hook inside component
newReqCode = newReqCode.replace(
  'const { categories, isLoading: isLoadingCategories } = useCategories();',
  'const { categories, isLoading: isLoadingCategories } = useCategories();\n  const { profilesList } = useProfilesMap();'
);

// Replace mapping of REQUESTERS
newReqCode = newReqCode.replace(
  'REQUESTERS.map((r)',
  'profilesList.filter(p => p.is_active).map((r)'
);

fs.writeFileSync(newReqPath, newReqCode);
console.log("Updated requesters.ts and NewRequestModal.tsx.");
