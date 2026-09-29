const fs = require('fs');
const path = require('path');

const p = path.join(process.cwd(), "src/app/(main)/consultas/page.tsx");
let code = fs.readFileSync(p, "utf-8");

if (!code.includes("useProfilesMap")) {
  code = code.replace(
    'import { useState, useEffect } from "react";',
    'import { useState, useEffect } from "react";\nimport { useProfilesMap } from "@/hooks/useProfilesMap";'
  );

  code = code.replace(
    'const [isNewModalOpen, setIsNewModalOpen] = useState(false);',
    'const [isNewModalOpen, setIsNewModalOpen] = useState(false);\n  const { profilesMap } = useProfilesMap();'
  );

  code = code.replace(
    `<CardDetailModal
          card={selectedCard}
          userRole={userRole}
          simulatedUserName={simulatedUserName}`,
    `<CardDetailModal
          card={selectedCard}
          userRole={userRole}
          simulatedUserName={simulatedUserName}
          profilesMap={profilesMap}`
  );

  fs.writeFileSync(p, code);
  console.log("consultas/page.tsx updated with profilesMap.");
}
