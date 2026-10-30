# Diretrizes e Regras do Projeto Conect Pay

## Workflow de Desenvolvimento e Deploy

### Regra Obrigatória de Ambientes:
1. **Localhost Primeiro (Obrigatório):**
   - Todas as modificações, refatorações, novas telas e correções devem ser executadas e testadas primeiramente em ambiente local (`localhost:3000` via `npm run dev`).
   - Nunca realizar deploy ou publicar em produção automaticamente.

2. **Deploy em Produção Apenas com Autorização Explícita:**
   - O comando de deploy de produção (`npx vercel deploy --prod --yes` ou promoção para `https://conect-pay.vercel.app`) só pode ser executado se o usuário solicitar ou autorizar expressamente (ex.: *"pode subir para produção"*, *"autorizado subir"*, *"faz o deploy"*).
   - Ao concluir alterações locais, deve-se avisar o usuário que as mudanças estão disponíveis para validação em localhost e aguardar a confirmação para qualquer promoção para produção.
