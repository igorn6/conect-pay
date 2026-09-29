const fs = require('fs');
const path = require('path');
const file = path.join(process.cwd(), "src/components/settings/SettingsUsers.tsx");
let code = fs.readFileSync(file, 'utf8');

// 1. Add sectors state and formSector
code = code.replace(
  'const [formRole, setFormRole] = useState<"MASTER" | "FINANCEIRO" | "GESTOR">("GESTOR");',
  'const [formRole, setFormRole] = useState<"MASTER" | "FINANCEIRO" | "GESTOR">("GESTOR");\n  const [formSector, setFormSector] = useState<string>("");\n  const [sectors, setSectors] = useState<any[]>([]);'
);

// 2. Fetch sectors
const fetchSectorsLogic = `
  const fetchSectors = async () => {
    const { data } = await supabase.from("sectors").select("*").eq("is_deleted", false).order("name");
    if (data) {
      setSectors(data);
      if (data.length > 0) setFormSector(data[0].id);
    }
  };

  useEffect(() => {
    if (userRole === "MASTER") {
      fetchUsers();
      fetchSectors();
    }
  }, [userRole]);
`;
code = code.replace(
  /useEffect\(\(\) => \{\s*if \(userRole === "MASTER"\) \{\s*fetchUsers\(\);\s*\}\s*\}, \[userRole\]\);/,
  fetchSectorsLogic
);

// 3. Include formSector in the POST request
code = code.replace(
  'body: JSON.stringify({ name: formName, email: formEmail, role: formRole })',
  'body: JSON.stringify({ name: formName, email: formEmail, role: formRole, sector: formSector || null })'
);

// 4. Reset formSector on success
code = code.replace(
  'setFormRole("GESTOR");',
  'setFormRole("GESTOR");\n      if (sectors.length > 0) setFormSector(sectors[0].id);'
);

// 5. Add the Sector dropdown to the modal UI
const sectorDropdown = `
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-2">Setor</label>
                  <select
                    required
                    value={formSector}
                    onChange={(e) => setFormSector(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 appearance-none"
                  >
                    <option value="">Selecione um setor...</option>
                    {sectors.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
`;
code = code.replace(
  '<div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 flex gap-3">',
  sectorDropdown + '\n\n                <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 flex gap-3">'
);

fs.writeFileSync(file, code);
console.log("SettingsUsers updated with sector.");
