const fs = require('fs');
const path = require('path');

const p = path.join(process.cwd(), "src/app/(main)/kanban/page.tsx");
let code = fs.readFileSync(p, "utf-8");

const aprovarLogic = `        let hasError = false;
        for (const card of toUpdate) {
          if (!card) continue;
          const next = NEXT_STATUS[card.status as keyof typeof NEXT_STATUS];
          if (!next) continue;
          
          const { error } = await supabase.from("payment_requests").update({ status: next }).eq("id", card.id);`;

const newAprovarLogic = `        let hasError = false;
        let blockedCount = 0;
        let advancedCount = 0;
        for (const card of toUpdate) {
          if (!card) continue;
          const next = NEXT_STATUS[card.status as keyof typeof NEXT_STATUS];
          if (!next) continue;
          
          // Bloqueia avanço de EM_APROVACAO sem comprovante
          if (card.status === "EM_APROVACAO" && !card.payment_proof_url) {
            blockedCount++;
            continue;
          }
          
          const { error } = await supabase.from("payment_requests").update({ status: next }).eq("id", card.id);
          if (error) { hasError = true; } else { advancedCount++; }`;

code = code.replace(aprovarLogic, newAprovarLogic);

const toastLogic = `        if (hasError) setToast({ message: "Alguns erros ao avan\u00e7ar", type: "error" });
        else setToast({ message: toUpdate.length + " solicita\u00e7\u00f5es avan\u00e7adas", type: "success" });`;

const newToastLogic = `        if (hasError) setToast({ message: "Alguns erros ao avan\u00e7ar", type: "error" });
        else if (blockedCount > 0) setToast({ message: \`\${advancedCount} avan\u00e7adas, \${blockedCount} bloqueadas (sem comprovante)\`, type: "error" });
        else setToast({ message: advancedCount + " solicita\u00e7\u00f5es avan\u00e7adas", type: "success" });`;

code = code.replace(toastLogic, newToastLogic);

fs.writeFileSync(p, code);
console.log("Fixed mass action logic in kanban/page.tsx.");
