const fs = require('fs');
const path = require('path');
const file = path.join(process.cwd(), "src/components/Sidebar.tsx");
let code = fs.readFileSync(file, 'utf8');

if (!code.includes('avatarUrl')) {
  code = code.replace(
    'const { userRole, userName } = useAuth();',
    'const { userRole, userName, avatarUrl } = useAuth();'
  );

  code = code.replace(
    'src={`https://ui-avatars.com/api/?name=${encodeURIComponent(userName || \'G\')}&background=10b981&color=fff&size=32`}',
    'src={avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(userName || \'G\')}&background=10b981&color=fff&size=32`}'
  );

  fs.writeFileSync(file, code);
  console.log("Updated Sidebar.tsx");
} else {
  console.log("Sidebar already has avatarUrl");
}
