const fs = require('fs');
const path = require('path');

// 1. Fix Sidebar.tsx logo
const sidebarPath = path.join(process.cwd(), "src/components/Sidebar.tsx");
let sidebarCode = fs.readFileSync(sidebarPath, "utf-8");
sidebarCode = sidebarCode.replace(
  'className={`h-[42px] object-cover object-left transition-all duration-300',
  'className={`h-[42px] object-cover object-left transition-all duration-300 mix-blend-multiply'
);
fs.writeFileSync(sidebarPath, sidebarCode);
console.log("Sidebar.tsx patched (mix-blend-multiply added to logo).");

// 2. Fix api/dashboard/route.ts
const routePath = path.join(process.cwd(), "src/app/api/dashboard/route.ts");
let routeCode = fs.readFileSync(routePath, "utf-8");

// Remove the problematic select
routeCode = routeCode.replace(
  '.select("*, profiles(*)")',
  '.select("*")'
);

// Add logic to fetch profiles and map them
if (!routeCode.includes("const { data: profiles } = await supabaseAdmin.from('profiles').select('*');")) {
  routeCode = routeCode.replace(
    'const { data: requests, error } = await query;',
    `const { data: requests, error } = await query;
    if (error) throw error;
    
    // Fetch profiles to map names and sectors manually
    const { data: profiles } = await supabaseAdmin.from('profiles').select('*');
    const profilesMap = (profiles || []).reduce((acc, p) => {
      acc[p.id] = p;
      return acc;
    }, {});
    
    requests.forEach(req => {
      req.profiles = profilesMap[req.real_requester_id || req.created_by] || { name: 'Desconhecido', sector: 'Sem Setor' };
    });`
  );
}

fs.writeFileSync(routePath, routeCode);
console.log("api/dashboard/route.ts patched (removed ambiguous join).");
