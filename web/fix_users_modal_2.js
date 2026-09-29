const fs = require('fs');
const path = require('path');
const file = path.join(process.cwd(), "src/components/settings/SettingsUsers.tsx");
let code = fs.readFileSync(file, 'utf8');

// 1. Import supabase
if (!code.includes('import { supabase }')) {
  code = code.replace(
    'import { useAuth } from "@/contexts/AuthContext";',
    'import { useAuth } from "@/contexts/AuthContext";\nimport { supabase } from "@/lib/supabase";'
  );
}

// 2. Add state
if (!code.includes('const [formSector')) {
  code = code.replace(
    'const [formRole, setFormRole] = useState("GESTOR");',
    'const [formRole, setFormRole] = useState("GESTOR");\n  const [formSector, setFormSector] = useState<string>("");\n  const [sectors, setSectors] = useState<any[]>([]);'
  );
}

fs.writeFileSync(file, code);
console.log("Fixed missing states and import.");
