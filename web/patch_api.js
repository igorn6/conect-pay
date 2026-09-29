const fs = require("fs");
const path = require("path");
const filePath = path.join(__dirname, "src/app/api/users/route.ts");
let content = fs.readFileSync(filePath, "utf-8");

const getMethod = `export async function GET() {
  try {
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.listUsers();
    if (authError) throw authError;

    const { data: profiles, error: profilesError } = await supabaseAdmin.from("profiles").select("*").order("name");
    if (profilesError) throw profilesError;

    const merged = profiles.map((p: any) => {
      const authUser = authData.users.find((u: any) => u.id === p.id);
      return {
        ...p,
        email: authUser?.email || "Sem email"
      };
    });

    return NextResponse.json(merged);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {`;

content = content.replace('export async function POST(req: Request) {', getMethod);

fs.writeFileSync(filePath, content, "utf-8");
console.log("Added GET to /api/users");
