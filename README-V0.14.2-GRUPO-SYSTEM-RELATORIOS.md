# ELO V0.14.2 — Relatórios com padrão Grupo System Saúde

## O que foi ajustado
- O módulo de relatórios mantém a estrutura funcional existente e utiliza a logo oficial **Grupo System Saúde**, extraída do PDF de referência enviado.
- A capa foi organizada com identidade visual inspirada no modelo: fundo cinza-claro, título destacado, acento dourado discreto e identificação institucional.
- Mantidos período analisado, quantidade de observações, data de emissão, resumo executivo, destaques, pontos de atenção, análise por categoria e plano de ação.
- Rodapé institucional atualizado para Grupo System Saúde.
- O prompt da Edge Function `generate-report` orienta a IA a seguir um padrão executivo e usar o PDF apenas como referência visual/organizacional, sem copiar seus dados nem inventar métricas.
- Impressão A4/PDF e visualização responsiva mantidas.

## Aplicação
1. Extraia o ZIP.
2. Confira as variáveis de ambiente já usadas pelo projeto.
3. Publique o projeto na Vercel.
4. Como houve alteração em `supabase/functions/generate-report/index.ts`, publique também essa Edge Function no Supabase para aplicar as novas instruções de geração.
5. Gere um relatório de teste com observações existentes e confira capa, conteúdo e impressão em PDF.

## Banco de dados
Não foi adicionada alteração SQL nesta versão. Não execute scripts SQL novos para aplicar apenas estas mudanças.

## Observação de validação
O pacote contém o projeto completo. A compilação de produção não foi executada neste ambiente; valide o build e o fluxo de geração após instalar as dependências e publicar.
