# Arquitetura — ELO V0.16.0

## Camadas

1. **Apresentação:** componente `Dashboard` com seletor Supervisão/Diretoria e componentes de cartão, status, fontes e atualização.
2. **Consultas:** contagens exatas via `select(..., { count: 'exact', head: true })`; contagens por status para os estados conhecidos; contagem de demandas vencidas usando `due_date` e estados terminais.
3. **Persistência:** tabelas existentes do Supabase; nenhuma tabela nova ou migração nesta fase.
4. **Autorização:** autenticação e políticas de acesso já existentes. O seletor de visão é somente uma escolha de apresentação e não é mecanismo de segurança.
5. **Fontes futuras:** integrações externas continuam fora do escopo até que exista credencial, fonte, contrato de dados e política de atualização definidos.

## Decisões explícitas

- Não mostrar média de qualidade calculada no cliente a partir de uma amostra potencialmente limitada.
- Não exibir tendência mensal enquanto não houver consulta agregada confiável para todo o período.
- Não calcular realizado versus meta sem validar unidade, período, setor e regra de agregação.
- Exibir indisponibilidade quando a consulta falhar, em vez de assumir valor zero.
- Não alterar SQL, Edge Functions, regras oficiais de pontuação ou módulo de relatórios.

## Próxima etapa sugerida

Após validar a V0.16.0 em produção controlada, especificar agregações mensais no banco (view ou função SQL somente leitura), com testes contra consultas de referência. Só depois adicionar tendências e comparativos de metas.
