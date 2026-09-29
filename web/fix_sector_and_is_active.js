const fs = require('fs');
const path = require('path');

// 1. Fix SettingsUsers.tsx
const usersFile = path.join(process.cwd(), "src/components/settings/SettingsUsers.tsx");
let usersCode = fs.readFileSync(usersFile, 'utf8');

const sectorDropdown = `
              <div>
                <label className="text-sm font-medium text-slate-300">Setor</label>
                <select
                  required
                  value={formSector}
                  onChange={(e) => setFormSector(e.target.value)}
                  className="w-full mt-1.5 bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-200 outline-none focus:border-emerald-500"
                >
                  <option value="">Selecione um setor...</option>
                  {sectors.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
`;

if (!usersCode.includes('Selecione um setor...')) {
  usersCode = usersCode.replace(
    '<div className="bg-slate-800/50 rounded-lg p-3 flex items-start gap-3 mt-4 border border-slate-700/50">',
    sectorDropdown + '\n              <div className="bg-slate-800/50 rounded-lg p-3 flex items-start gap-3 mt-4 border border-slate-700/50">'
  );
  fs.writeFileSync(usersFile, usersCode);
  console.log("Added Setor dropdown to UI.");
}

// 2. Fix route.ts
const routeFile = path.join(process.cwd(), "src/app/api/admin/users/route.ts");
let routeCode = fs.readFileSync(routeFile, 'utf8');
if (routeCode.includes('is_active: true,')) {
  routeCode = routeCode.replace('is_active: true,', '');
  fs.writeFileSync(routeFile, routeCode);
  console.log("Removed is_active from route.ts");
}
