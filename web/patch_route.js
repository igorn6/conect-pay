const fs = require('fs');
const path = require('path');

const routePath = path.join(process.cwd(), "src/app/api/admin/users/route.ts");
let routeCode = fs.readFileSync(routePath, "utf-8");

if (!routeCode.includes('force-dynamic')) {
  routeCode = 'export const dynamic = "force-dynamic";\n' + routeCode;
  fs.writeFileSync(routePath, routeCode);
  console.log("Added force-dynamic to admin/users route.");
} else {
  console.log("Already has force-dynamic.");
}
