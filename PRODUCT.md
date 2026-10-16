# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- Equipes operacionais, gestores e setores financeiros de empresas clientes que precisam emitir, validar e liquidar requisições financeiras com governança estrita.
- Perfis de acesso e responsabilidades:
  - **Gestores (GESTOR):** Validação preliminar e triagem das solicitações originadas em seus setores antes de tramitarem para aprovação executiva/financeira.
  - **Financeiro (FINANCEIRO):** Conferência de dados de pagamento (Pix, Caju, Boletos, FOPAG), execução da liquidação, gestão de saldos e upload de comprovantes bancários.
  - **Administradores (MASTER):** Supervisão geral de esteiras, aprovações finais de alto valor, parametrização de setores/categorias e auditoria gerencial.

## Product Purpose

- O Conect Pay é uma plataforma SaaS para esteira de requisição, auditoria multinível e liquidação de contas a pagar corporativas.
- Seu propósito é eliminar a dispersão de pedidos financeiros em canais informais (chat, e-mails), garantindo SLA visível, redução drástica de erros de pagamento e histórico auditável de cada transação.

## Positioning

- Esteira operacional de pagamentos corporativos com visualização Kanban viva e adaptada à realidade de pagamentos do mercado brasileiro (Pix com conferência de titularidade, divisão entre múltiplos métodos como Caju e boleto, e conciliação instantânea).

## Operating Context

- Ambientes corporativos de alta demanda transacional onde a rapidez e a exatidão financeira são essenciais.
- Rotinas diárias em dashboards operacionais, esteira de cartões (Kanban) com atualização em tempo real, conferência de códigos de barras/chaves Pix e exportação de dados para contabilidade e auditoria externa.

## Capabilities and Constraints

- **Esteira de Estados:** `NOVA_SOLICITACAO`, `VALIDACAO_GESTOR`, `EM_APROVACAO`, `AGUARDANDO_PAGAMENTO`, `FINALIZADO`, `RECUSADO` e `CORRECAO_PENDENTE`.
- **Múltiplos Meios de Pagamento:** Suporte nativo a Pix (com validação de chaves e titular), Caju (gestão de benefícios/telefone), Boletos bancários (linha digitável, código de barras e data de vencimento), FOPAG e Retirada de Saldo.
- **Rastreabilidade e Anexos:** Registro de tempo de permanência em cada estágio (`StageHistoryItem`), histórico completo de comprovantes anexados (`ReceiptHistoryItem`) e logs de movimentação por usuário.
- **Stack Tecnológico:** Next.js 16 (App Router), React 19, TailwindCSS v4, TypeScript, Supabase (Auth, Postgres, Storage).

## Brand Commitments

- **Nome da Aplicação:** Conect Pay.
- **Identidade e Referência Estética:** Inspirada na linguagem técnica do n8n (documentada em `Cyber.md`) — dark theme profundo (#0e0918 base, #1a1624 superfícies elevadas), estética de central de comando/automação, tipografia de alta legibilidade e toques energéticos em gradiente laranja/ember e azul elétrico para direcionar foco e ação.

## Evidence on Hand

- Código-fonte ativo e funcional no diretório `web/`.
- Tipos de banco de dados e regras de negócio estruturadas em [database.ts](file:///c:/Users/Conectsol/Desktop/Conect%20Pay.app/web/src/types/database.ts).
- Especificação de design tokens e guia visual consolidado em [Cyber.md](file:///c:/Users/Conectsol/Desktop/Conect%20Pay.app/Cyber.md).

## Product Principles

1. **Rastreabilidade Absoluta:** Nenhuma movimentação de status ou anexo ocorre sem carimbo de data/hora, autor e motivo documentado.
2. **Ação Sem Ambiguidade:** A interface prioriza clareza operacional — cada perfil visualiza imediatamente o que requer sua decisão ou processamento urgente.
3. **Robustez Financeira:** Prevenção ativa de duplicações, inconsistências de chave Pix ou vencimentos expirados antes da liquidação.
4. **Agilidade com Densidade Informativa:** Layout pensado para operadores frequentes, com agrupamentos lógicos, filtros eficientes e ergonomia visual no tema escuro.

## Accessibility & Inclusion

- Contraste WCAG 2.1 AA preservado em toda a paleta escura contra fundos #0e0918 e #1a1624.
- Estados de foco e feedback de ações sempre evidentes para navegação via teclado.
- Uso de texto, ícones e cores combinados para identificação de status (não depender apenas de cor).
