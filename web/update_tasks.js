const fs = require('fs');
const path = require('path');
const file = path.join(process.cwd(), "..", "..", ".gemini/antigravity-ide/brain/a750b375-340a-4455-bbe0-ed38542fc439/task.md");
let code = fs.readFileSync(file, 'utf8');

code = code.replace('- `[ ]` Atualizar `types/database.ts`', '- `[x]` Atualizar `types/database.ts`');
code = code.replace('- `[ ]` Atualizar `SettingsProfile.tsx`', '- `[x]` Atualizar `SettingsProfile.tsx`');
code = code.replace('- `[ ]` Atualizar `AuthContext.tsx`', '- `[x]` Atualizar `AuthContext.tsx`');
code = code.replace('- `[ ]` Atualizar `Sidebar.tsx`', '- `[x]` Atualizar `Sidebar.tsx`');

code += "\n\n## 3. Redesign do Login\n- `[x]` Gerar imagem de Parque Fotovoltaico\n- `[x]` Refatorar `login/page.tsx` e injetar animação CSS no background.";

fs.writeFileSync(file, code);
