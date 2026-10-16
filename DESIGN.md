---
name: Conect Pay
description: Motor financeiro de alta precisão com esteira Kanban, liquidação multinível e estética Cyber / n8n Dark
colors:
  primary: "#ff492c"
  primary-hover: "#fd8925"
  void-base: "#0e0918"
  elevated-surface: "#1a1624"
  deep-panel: "#1b1728"
  border-smoke: "#3e3a46"
  ash-text: "#d1cece"
  fog-text: "#9d9797"
  cloud-white: "#ffffff"
  status-nova: "#6c5ce7"
  status-aprovacao: "#f0a500"
  status-notinha: "#00b4d8"
  status-finalizado: "#10b981"
  status-recusado: "#ef4444"
typography:
  display:
    fontFamily: "var(--font-geist-sans), 'Inter', system-ui, -apple-system, sans-serif"
    fontSize: "clamp(2rem, 4vw, 3.25rem)"
    fontWeight: 300
    lineHeight: 1.1
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "var(--font-geist-sans), 'Inter', system-ui, -apple-system, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 400
    lineHeight: 1.25
    letterSpacing: "-0.015em"
  title:
    fontFamily: "var(--font-geist-sans), 'Inter', system-ui, -apple-system, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 500
    lineHeight: 1.3
    letterSpacing: "-0.01em"
  body:
    fontFamily: "var(--font-geist-sans), 'Inter', system-ui, -apple-system, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
  label:
    fontFamily: "var(--font-geist-sans), 'Inter', system-ui, -apple-system, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: "0.02em"
rounded:
  sm: "6px"
  md: "10px"
  lg: "16px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.cloud-white}"
    rounded: "{rounded.sm}"
    padding: "8px 16px"
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
  button-secondary:
    backgroundColor: "{colors.elevated-surface}"
    textColor: "{colors.ash-text}"
    rounded: "{rounded.sm}"
    padding: "8px 16px"
  card:
    backgroundColor: "{colors.elevated-surface}"
    textColor: "{colors.ash-text}"
    rounded: "{rounded.md}"
    padding: "16px"
---

# Design System: Conect Pay

## Overview

**Creative North Star: "The Financial Engine"**

O Conect Pay é concebido como um motor financeiro de infraestrutura crítica: uma esteira de liquidação ágil, técnica e de alta confiabilidade operacional. Em vez de se comportar como uma planilha fria ou um SaaS burocrático genérico, a interface evoca a sensação de um console de automação e controle em tempo real, onde cada requisição, etapa de aprovação e fluxo monetário é monitorado com precisão cirúrgica.

A paleta ancora-se no vazio violeta escuro (`#0e0918`), estabelecendo uma base sem brilhos ofuscantes que reduz a fadiga de operadores contábeis e financeiros em jornadas prolongadas. A profundidade é articulada por estratificação tonal deliberada: cartões e painéis modulares (`#1a1624` e `#1b1728`) emergem do fundo através de finas linhas de delimitação fumê (`#3e3a46`), e acentos de alta energia como o gradiente Ember (`#fd8925` → `#ff0c00`) e correntes elétricas azuis são estritamente reservados para sinalizar dados em trânsito, focos de atenção e ações decisivas.

**Key Characteristics:**
- **Atmosfera de Console Técnico:** Superfícies escuras profundas com contraste tipográfico intencional, sem recorrer ao preto absoluto puro.
- **Hierarquia por Densidade Operacional:** Informações financeiras complexas (valores, códigos de barras, titularidades Pix e SLAs) organizadas com espaçamento ritmado e escaneabilidade instantânea.
- **Energia Cromática Funcional:** O calor do gradiente Ember é um gatilho de ação, não decoração passiva.

## Colors

A paleta cromática utiliza uma base escura rica de subtom violeta combinada com acentos funcionais de alto impacto visual e badges semânticos para cada estágio da esteira de pagamentos.

### Primary
- **Ember Scorch** (`#ff492c`): Acento primário do sistema. Usado em gatilhos de avanço de esteira, botões de ação prioritária e marcações ativas. Em ações de grande destaque, evolui para o gradiente cinético **Ember CTA** (`linear-gradient(30deg, #fd8925, #ff0c00)`).

### Secondary
- **Electric Current** (`linear-gradient(141deg, #077ac7, #6b21ef)`): Gradiente azul-índigo utilizado para conectores de fluxo, foco de seleção ativo e links de auditoria técnica.

### Neutral
- **Void Violet Base** (`#0e0918`): Plano de fundo mestre da aplicação, criando profundidade suave e imersiva.
- **Elevated Surface** (`#1a1624`): Superfície de cards Kanban, linhas de tabela e modais de detalhe.
- **Deep Panel** (`#1b1728`): Fundo de colunas do Kanban, gavetas laterais e áreas de agrupamento secundário.
- **Muted Shell** (`#2c2834`): Superfície de hover em itens interativos e botões fantasmas.
- **Border Smoke** (`#3e3a46`): Borda de definição de caixas e divisores, mantendo contorno sutil sem contraste agressivo.
- **Ash Text** (`#d1cece`): Cor base para textos de corpo e dados tabulares, evitando o ofuscamento do branco puro.
- **Fog Text** (`#9d9797`): Rótulos secundários, metadados de transação e legendas de apoio.
- **Cloud White** (`#ffffff`): Títulos principais, valores monetários em destaque e texto sobre botões escuros.

### Semantic Status
- **Status Nova Solicitação** (`#6c5ce7`): Violeta corporativo indicando abertura recente e triagem pendente.
- **Status Em Aprovação** (`#f0a500`): Âmbar alertando sobre pendência de decisão executiva ou de gestor.
- **Status Notinha / Aguardando** (`#00b4d8`): Ciano técnico para processos em fila de conferência e lote de pagamento.
- **Status Finalizado** (`#10b981`): Esmeralda nítido para pagamentos concluídos e comprovantes auditados.
- **Status Recusado** (`#ef4444`): Vermelho de segurança para requisições rejeitadas ou divergências graves.

### Named Rules
**The Ember Scarcity Rule.** O gradiente Ember é estritamente limitado à ação principal da tela ou etapa de avanço decisivo (máximo 1 instância proeminente visível por viewport). Sua autoridade visual depende da sua raridade.

**The No Pure Black Rule.** Nunca utilize `#000000` como plano de fundo. O sistema deve sempre respirar no tom tecnológico enriquecido de `#0e0918` para manter o calor dos painéis.

## Typography

**Display Font:** Geist Sans / Inter (`var(--font-geist-sans), 'Inter', system-ui, -apple-system, sans-serif`)
**Body Font:** Geist Sans / Inter (`var(--font-geist-sans), 'Inter', system-ui, -apple-system, sans-serif`)
**Label/Mono Font:** Geist Mono (`var(--font-geist-mono), 'Fira Code', monospace`)

**Character:** Tipografia geométrica moderna e sóbria. Títulos em pesos mais leves (300 a 400) com tracking comprimido sussurram em vez de gritar contra o fundo escuro, enquanto dados financeiros e tags de protocolo adotam clareza monoespaçada.

### Hierarchy
- **Display** (Weight 300, `clamp(2rem, 4vw, 3.25rem)`, Line-height 1.1, Letter-spacing -0.02em): Indicadores de saldo consolidados e títulos de visão geral do Hub.
- **Headline** (Weight 400, `1.5rem` [24px], Line-height 1.25, Letter-spacing -0.015em): Cabeçalhos de colunas do Kanban, títulos de modais e seções de relatórios.
- **Title** (Weight 500, `1.125rem` [18px], Line-height 1.3, Letter-spacing -0.01em): Títulos de cartões de pagamento, nomes de fornecedores e cabeçalhos de grupos.
- **Body** (Weight 400, `0.875rem` [14px], Line-height 1.5, Letter-spacing normal): Textos de descrição, observações de recusa e logs de auditoria. Linha máxima recomendada de 70ch.
- **Label** (Weight 500, `0.75rem` [12px], Line-height 1.4, Letter-spacing 0.02em, Maiúsculas opcionais): Badges de status, métodos de pagamento (Pix, Caju, Boleto) e carimbos de tempo.

### Named Rules
**The Financial Precision Rule.** Todo valor monetário (R$) e código identificador deve ser renderizado com alinhamento tabular (`tabular-nums`) e peso visual destacado para prevenir equívocos em leitura rápida.

## Layout

A arquitetura espacial do Conect Pay organiza-se em um grid de densidade operacional contínua:
- **Barra de Navegação Lateral (Sidebar):** Largura fixa compacta (260px expandida / 72px recolhida), estruturando acesso direto ao Hub, Kanban, Consultas, Relatórios e Configurações.
- **Container Principal:** Preenchimento fluido responsivo com espaçamento base de 24px (`--spacing-lg`) e padding interno seguro.
- **Esteira Kanban:** Layout horizontal com rolagem suave em eixo X, onde cada coluna mantém largura mínima de 310px e máxima de 360px para acomodar cartões com metadados sem truncamento precoce.
- **Ritmo Espacial:** Escala estrita em múltiplos de 4px (`4px`, `8px`, `16px`, `24px`, `32px`). Elementos irmãos mantêm 8px de respiro; agrupamentos modulares utilizam 16px.

## Elevation & Depth

O sistema rejeita sombras pesadas convencionais e adota a arquitetura de **Camadas Tonais (Tonal Layering)**. A sensação de profundidade e tridimensionalidade é obtida pelo contraste controlado de luminosidade entre superfícies escuras e contornos iluminados.

### Shadow Vocabulary
- **Card Rest** (`box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3)`): Elevação sutil aplicada aos cartões estáticos sobre o fundo da coluna.
- **Card Dragging / Lifted** (`box-shadow: 0 12px 28px rgba(0, 0, 0, 0.5), 0 0 0 1px var(--color-border-smoke)`): Elevação pronunciada quando um cartão é arrastado na esteira ou ganha foco ativo.
- **Ember Glow** (`box-shadow: 0 0 20px rgba(253, 137, 37, 0.25)`): Brilho térmico difuso sob botões primários ativados ou badges de alta urgência.

### Named Rules
**The Structural Line Rule.** A separação entre zonas funcionais ocorre prioritariamente por meio de bordas finas sutis (`1px solid #3e3a46`) em vez de afastamentos em branco excessivos, maximizando a densidade útil da tela.

## Shapes

O vocabulário geométrico é firme e contemporâneo:
- **Raio Pequeno** (`6px` / `--radius-sm`): Aplicado a botões, campos de entrada de texto (`inputs`), checkboxes e tags de status.
- **Raio Médio** (`10px` / `--radius-md`): Aplicado a cartões da esteira Kanban, painéis internos de métricas e menus suspensos.
- **Raio Grande** (`16px` / `--radius-lg`): Reservado para modais centrais de tela cheia (`CardDetailModal`, `NewRequestModal`) e gavetas contextuais.

## Components

### Buttons
- **Shape:** Raio compacto (`6px` / `--radius-sm`).
- **Primary:** Fundo gradiente Ember (`linear-gradient(30deg, #fd8925, #ff0c00)`), texto Cloud White (`#ffffff`), peso 500, padding `8px 16px`.
- **Hover / Focus:** Transição de 200ms com elevação suave (`transform: translateY(-1px)`) e halo difuso Ember Glow (`rgba(253, 137, 37, 0.3)`).
- **Secondary / Ghost:** Fundo Elevated Surface (`#1a1624`) com borda fina Smoke (`#3e3a46`), texto Ash Text (`#d1cece`). No hover, fundo evolui para Muted Shell (`#2c2834`).

### Kanban Cards
- **Corner Style:** Raio médio (`10px` / `--radius-md`).
- **Background:** `#1a1624` (Elevated Surface) com borda perimetral de 1px `#3e3a46`.
- **States:** No hover, leve clareamento de borda e micro-deslocamento. No estado arrastando, rotação sutil (1.5deg) e sombra profunda de elevação.
- **Internal Padding:** `14px 16px`.
- **Anatomia Interna:** Cabeçalho com indicador de urgência e tag de método de pagamento (Pix/Caju/Boleto); corpo com valor monetário e nome do favorecido; rodapé com solicitante, setor e carimbo de tempo.

### Inputs / Fields
- **Style:** Fundo Void escurecido (`#0e0918`), borda 1px `#3e3a46`, raio `6px`, texto Ash Text (`#d1cece`).
- **Focus:** Contorno de foco iluminado com borda em `#6c5ce7` e suave anel translúcido (`box-shadow: 0 0 0 3px rgba(108, 92, 231, 0.2)`).
- **Error:** Borda vermelha nítida (`#ef4444`) com mensagem auxiliar em tipografia label.

### Status Chips / Badges
- **Style:** Fundo com 15% de opacidade da cor do status, texto na cor integral de destaque, borda suave de 1px na mesma matriz de cor. Raio `6px`.
- **Tipografia:** Label (`12px`, peso 500), mantendo legibilidade imediata em visualização rápida.

### Modals & Dialogs
- **Backdrop:** Escurecimento quase total (`rgba(5, 4, 10, 0.8)`) com filtro de desfoque sutil (`backdrop-filter: blur(4px)`).
- **Surface:** `#1a1624` com contorno Smoke (`#3e3a46`) e raio de `16px`.

## Do's and Don'ts

### Do:
- **Do** manter a base profunda em `#0e0918` e os cards modulares em `#1a1624` para preservar a consistência do tema escuro.
- **Do** restringir o gradiente Ember (`#fd8925` → `#ff0c00`) à ação prioritária para que continue funcionando como um ímã visual instantâneo.
- **Do** formatar valores financeiros sempre com duas casas decimais e fonte com números tabulares (`font-feature-settings: "tnum"`).
- **Do** usar badges com contraste legível que combinem texto e cor (e ícone quando aplicável) para sinalizar estados de pagamento.

### Don't:
- **Don't** aplicar fundos cinza-claros genéricos ou botões azuis pastéis típicos de templates genéricos.
- **Don't** poluir a interface com animações ociosas, sombras excessivas ou decorações de vidro falsas que atrasem o tempo de resposta ou cansem a visão do operador.
- **Don't** utilizar texto puramente branco (#ffffff) para parágrafos longos ou descrições extensas — utilize `#d1cece` (Ash Text) para evitar fadiga ocular.
- **Don't** deixar botões de ação destrutiva (como recusar ou excluir solicitação) com o mesmo peso visual de ações de aprovação.
