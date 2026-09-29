const fs = require("fs");
const path = require("path");
const dbPath = path.join(__dirname, "src/types/database.ts");
let dbContent = fs.readFileSync(dbPath, "utf-8");

dbContent = dbContent.replace(
  'name: string;\n    role: UserRole;',
  'name: string;\n    email?: string;\n    role: UserRole;'
);
fs.writeFileSync(dbPath, dbContent, "utf-8");

const pagePath = path.join(__dirname, "src/app/(main)/usuarios/page.tsx");
let pageContent = fs.readFileSync(pagePath, "utf-8");

const oldFetch = `  const fetchUsers = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("profiles").select("*").order("name");
    if (!error && data) {
      setUsers(data as Profile[]);
    }
    setLoading(false);
  };`;

const newFetch = `  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/users");
      if (res.ok) {
        const data = await res.json();
        setUsers(data as Profile[]);
      }
    } catch (e) {}
    setLoading(false);
  };`;

pageContent = pageContent.replace(oldFetch, newFetch);

pageContent = pageContent.replace(
  '<span className="truncate max-w-[200px]" title={user.id}>{user.id}</span>',
  '<span className="truncate max-w-[200px]" title={user.email}>{user.email}</span>'
);

pageContent = pageContent.replace(
  'Defina uma nova senha para <strong className="text-white">{selectedUser.name}</strong>.',
  'Defina uma nova senha para <strong className="text-white">{selectedUser.name}</strong>. (A senha atual é criptografada e invisível por segurança)'
);

fs.writeFileSync(pagePath, pageContent, "utf-8");
console.log("Patched users page");
