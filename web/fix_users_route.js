const fs = require('fs');
const path = require('path');
const file = path.join(process.cwd(), "src/app/api/admin/users/route.ts");
let code = fs.readFileSync(file, 'utf8');

const replacement = `
export async function POST(req: Request) {
  try {
    const { name, email, role, sector } = await req.json();

    if (!name || !email || !role) {
      return NextResponse.json({ error: "Faltam campos obrigatórios." }, { status: 400 });
    }

    let userId = null;
    let authUser = null;

    // 1. Tenta criar o usuário no Supabase Auth
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: "Conectsol123",
      email_confirm: true,
    });

    if (authError) {
      // Se o erro for que já existe, tentamos resgatar o usuário órfão
      if (authError.message.includes("already been registered")) {
        // Busca a lista de usuários para encontrar este email
        const { data: listData } = await supabaseAdmin.auth.admin.listUsers();
        const existing = listData?.users?.find(u => u.email === email);
        if (existing) {
          userId = existing.id;
          authUser = existing;
          
          // Verifica se já existe perfil ativo ou inativo
          const { data: existingProfile } = await supabaseAdmin.from("profiles").select("id").eq("id", userId).single();
          if (existingProfile) {
            return NextResponse.json({ error: "Este e-mail já possui um perfil. Se estiver inativo, peça suporte para reativá-lo." }, { status: 400 });
          }
        } else {
          return NextResponse.json({ error: authError.message }, { status: 400 });
        }
      } else {
        return NextResponse.json({ error: authError.message }, { status: 400 });
      }
    } else {
      userId = authData.user.id;
      authUser = authData.user;
    }

    // 2. Insere o perfil na tabela \`profiles\`
    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .insert([
        {
          id: userId,
          name,
          role,
          sector: sector || null,
          is_active: true,
          must_change_password: true
        }
      ]);

    if (profileError) {
      return NextResponse.json({ error: "Erro ao criar perfil: " + profileError.message }, { status: 400 });
    }

    // Se resgatamos um orfão que estava banido, desbanimos
    await supabaseAdmin.auth.admin.updateUserById(userId, { ban_duration: 'none' });

    return NextResponse.json({ success: true, user: authUser });
  } catch (err: any) {
    return NextResponse.json({ error: "Erro interno no servidor." }, { status: 500 });
  }
}
`;

code = code.replace(/export async function POST\(req: Request\) \{[\s\S]*?\}\n\nexport async function PATCH/g, replacement.trim() + '\n\nexport async function PATCH');

fs.writeFileSync(file, code);
console.log("Updated api/admin/users/route.ts");
