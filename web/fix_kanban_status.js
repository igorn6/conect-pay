const fs = require('fs');
const file = "C:\\Users\\Conectsol\\Desktop\\Conect Pay.app\\web\\src\\app\\(main)\\kanban\\page.tsx";
let code = fs.readFileSync(file, 'utf8');

// Update the NEXT_STATUS in mass action
code = code.replace(
  `NOVA_SOLICITACAO: "EM_APROVACAO",
        EM_APROVACAO: "AGUARDANDO_NOTINHA",
        AGUARDANDO_NOTINHA: "PAGAMENTO_FINALIZADO",`,
  `NOVA_SOLICITACAO: "EM_APROVACAO",
        EM_APROVACAO: "AGUARDANDO_PAGAMENTO",
        AGUARDANDO_PAGAMENTO: "VALIDACAO_GESTOR",`
);

fs.writeFileSync(file, code);
console.log("Updated NEXT_STATUS in kanban/page.tsx");
