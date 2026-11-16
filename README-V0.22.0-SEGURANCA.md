# ELO V0.22.0 — Segurança reforçada, Termos de Uso e Política de Segurança

## O que foi reforçado
**Acesso**
- Verificação em duas etapas (2FA/TOTP): ativação em *Segurança da conta*, tela de código no login e exigência real no banco quando a pessoa tem 2FA. Aviso permanente para administradores e gestores sem 2FA.
- Senha de 10+ caracteres (letras e números, sem sequências, nome ou e-mail), com indicador de força — no app e no servidor.
- Bloqueio de tentativas repetidas no login (a partir da 5ª, espera crescente) e mensagem genérica de erro.
- Sessão expira por inatividade (20 min para administradores/gestores, 30 min para os demais) com aviso de 2 min; "Encerrar sessão em todos os dispositivos".
- Usuário desativado perde o acesso **na hora**, mesmo com sessão aberta.

**Banco de dados** (`supabase/seguranca-v0220.sql`)
- Política restritiva em todas as tabelas e no storage: só passa usuário ativo e, se tiver 2FA, com 2FA concluído.
- Visitante (anon) sem nenhum acesso ao schema `public`; funções sem `PUBLIC`/`anon`; `search_path` fixo nas funções `SECURITY DEFINER`.
- Trilha de auditoria (`audit_log`): criação de usuários, perfis, permissões, critérios, notas lançadas e exclusões. Visível só para administradores.
- Proteção do último administrador ativo; novas contas nascem **inativas** (caso o cadastro público esteja aberto).
- Limite de requisições por usuário (`check_rate_limit`), aceite de termos (`termos_aceites`), bucket de atendimentos privado (15 MB; PDF e TXT).

**Edge Functions** (5 funções atualizadas)
- Valida sessão ativa/2FA e limita uso (IA: 60 análises/h; relatórios: 30/h; PDF: 60/h; criar usuário: 20/h).
- CORS restrito (`ALLOWED_ORIGINS`), erros internos sem detalhes (`DEBUG_ERRORS=true` só para depurar), `admin-create-user` revisada (dependência fixada, validações, sem usuário "órfão", auditoria).
- IA: texto de atendimento é tratado como **dado** (defesa contra instruções maliciosas dentro do arquivo) e **TXT tem CPF, CNPJ, e-mail, telefone e cartão mascarados** antes de ir à IA. PDFs vão integralmente: anonimize antes.

**Navegador / hospedagem**
- `vercel.json`: CSP, HSTS, anti-clickjacking, anti-sniffing, Referrer/Permissions-Policy, COOP/CORP, sem indexação.
- `.gitignore` (antes não existia: `.env` poderia subir ao GitHub), `robots.txt`, `security.txt`, Dependabot e workflow de segurança (npm audit + CodeQL).

## Termos de Uso e Segurança
- No app: **aceite obrigatório** no primeiro acesso (e a cada nova versão), links no login, menu *Termos e política* e impressão/PDF.
- Documentos: `docs/legal/` (Markdown e PDF), `SECURITY.md` e `docs/CHECKLIST-SEGURANCA.md`.
- **Preencha os dados da empresa** nas variáveis da Vercel: `VITE_COMPANY_NAME`, `VITE_COMPANY_CNPJ`, `VITE_DPO_EMAIL`, `VITE_SECURITY_EMAIL`, `VITE_LEGAL_FORUM`, `VITE_RETENTION_MONTHS`. Os textos são um modelo e **devem ser revisados por um advogado**.

## Ordem de publicação (importante)
1. **Backup**: confirme backup/PITR no Supabase.
2. **Edge Functions**: publique as 5 funções (`admin-create-user`, `analyze-attendance`, `delete-attendance-evaluation`, `generate-report`, `report-pdf`) e cadastre os segredos `ALLOWED_ORIGINS` (e mantenha `GEMINI_API_KEY`).
3. **SQL**: execute `supabase/seguranca-v0220.sql` e confira que as 3 consultas finais retornam 0 linhas.
4. **Frontend**: envie ao GitHub (Vercel) e preencha as variáveis `VITE_COMPANY_*`.
5. **Painéis**: percorra `docs/CHECKLIST-SEGURANCA.md` (desativar cadastro público, MFA, redirects, 2FA no GitHub/Vercel/Supabase etc.).
6. **Pessoas**: administradores e gestores ativam o 2FA em *Segurança da conta*.

## Atenção
- O SQL não pôde ser executado no ambiente de desenvolvimento: rode primeiro em um projeto de teste, se possível.
- `has_permission` não está no repositório (existe só no seu Supabase); não foi alterada.
- Segurança não é um estado final: mantenha as rotinas do checklist (revisão de acessos, atualizações, backups).
