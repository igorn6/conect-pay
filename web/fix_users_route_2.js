const fs = require('fs');
const path = require('path');
const file = path.join(process.cwd(), "src/app/api/admin/users/route.ts");
let code = fs.readFileSync(file, 'utf8');

// Update GET
code = code.replace(
  'email: authUser?.email || "Sem email"',
  'email: authUser?.email || "Sem email",\n        is_active: !authUser?.banned_until'
);

// Update PATCH
code = code.replace(
  'const { error: dbError } = await supabaseAdmin\n      .from("profiles")\n      .update({ is_active: false })\n      .eq("id", id);\n      \n    if (dbError) throw dbError;',
  '// Soft delete relies solely on Auth ban_duration now.'
);

fs.writeFileSync(file, code);
console.log("Updated GET and PATCH in route.ts");
