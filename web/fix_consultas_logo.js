const fs = require('fs');
const path = require('path');

// 1. Fix Consultas UI and UUID Mapping
const conPath = path.join(process.cwd(), "src/app/(main)/consultas/page.tsx");
let conCode = fs.readFileSync(conPath, "utf-8");

conCode = conCode.replace(
  'className="flex flex-col h-full bg-gray-950"',
  'className="flex flex-col h-full bg-slate-900 text-slate-100"'
);

conCode = conCode.replace(
  'bg-[#111216] p-5 rounded-xl border border-gray-800/60 shadow-sm',
  'bg-slate-800 p-5 rounded-xl border border-slate-700/60 shadow-sm'
);

// Fix inputs
conCode = conCode.replace(
  /bg-gray-950\/50 border border-gray-800/g,
  'bg-slate-900 border border-slate-700'
);
conCode = conCode.replace(
  /text-gray-300/g,
  'text-slate-300'
);

// Fix table container
conCode = conCode.replace(
  'bg-[#111216] rounded-xl border border-gray-800/60 overflow-hidden shadow-sm',
  'bg-slate-800 rounded-xl border border-slate-700/60 overflow-hidden shadow-sm'
);

// Fix table header
conCode = conCode.replace(
  'bg-[#0c0d10] border-b border-gray-800/60 text-xs tracking-wider uppercase font-semibold text-gray-500',
  'bg-slate-900/50 border-b border-slate-700/60 text-xs tracking-wider uppercase font-semibold text-slate-400'
);

// Fix table body
conCode = conCode.replace(
  'divide-y divide-gray-800/60',
  'divide-y divide-slate-700/60'
);
conCode = conCode.replace(
  'hover:bg-gray-800/40 cursor-pointer transition-colors group',
  'hover:bg-slate-700/40 cursor-pointer transition-colors group'
);

// Fix text colors in cells
conCode = conCode.replace(/text-gray-200/g, 'text-slate-200');
conCode = conCode.replace(/text-gray-400/g, 'text-slate-400');
conCode = conCode.replace(/text-gray-500/g, 'text-slate-500');

// Fix UUID Mapping
conCode = conCode.replace(
  '<td className="px-6 py-4.5">{req.real_requester_id}</td>',
  '<td className="px-6 py-4.5">{profilesMap[req.real_requester_id || ""] || profilesMap[req.created_by] || "Desconhecido"}</td>'
);

fs.writeFileSync(conPath, conCode);
console.log("Consultas page style and UUID mapping fixed.");

// 2. Fix Sidebar logo filter
const sidebarPath = path.join(process.cwd(), "src/components/Sidebar.tsx");
let sidebarCode = fs.readFileSync(sidebarPath, "utf-8");

sidebarCode = sidebarCode.replace(
  'className={`h-[42px] object-cover object-left transition-all duration-300 mix-blend-multiply ${isCollapsed ? \'w-[42px]\' : \'w-[180px]\'}`}',
  'className={`h-[42px] object-cover object-left transition-all duration-300 mix-blend-multiply ${isCollapsed ? \'w-[42px]\' : \'w-[180px]\'}`}\n                style={{ filter: \'brightness(1.05) contrast(1.1)\' }}'
);

fs.writeFileSync(sidebarPath, sidebarCode);
console.log("Sidebar.tsx logo filter added.");
