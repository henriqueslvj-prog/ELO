# Checklist de segurança — configurações nos painéis

Estas configurações **não podem ser feitas pelo código**; precisam ser conferidas por quem administra a conta. Marque cada item.

## 1. Supabase — Authentication
- [ ] **Desativar cadastro público** (Authentication → Sign In / Providers → Email → *Allow new users to sign up* = desligado). Contas só pelo administrador.
- [ ] **Senha**: tamanho mínimo 10 e exigir letras/números (Authentication → Sign In / Providers → Email → Password).
- [ ] **Proteção contra senhas vazadas** (Leaked password protection), se o plano permitir.
- [ ] **Confirmação de e-mail** ligada e *Secure password change* (exigir reautenticação) ligado.
- [ ] **MFA TOTP habilitado** (Authentication → Sign In / Providers → Multi-Factor).
- [ ] **URL Configuration**: *Site URL* = endereço de produção; *Redirect URLs* = somente os endereços reais (sem curingas amplos).
- [ ] **Sessões**: tempo máximo de sessão e *inactivity timeout* (planos pagos) alinhados com 20–30 min de inatividade.
- [ ] **Rate limits** de e-mail e login revisados; SMTP próprio configurado (evita limites e spoofing).

## 2. Supabase — Banco, API e Storage
- [ ] Executar `supabase/seguranca-v0220.sql` e conferir que as três consultas finais retornam **0 linhas**.
- [ ] **Data API → Exposed schemas**: somente `public` (remova `graphql_public` se não usa).
- [ ] **Backups / PITR** habilitados e **teste de restauração** feito ao menos uma vez.
- [ ] **Network restrictions / SSL enforcement** (Project Settings → Database), se disponível.
- [ ] Bucket `destaque-atendimentos` **privado**, 15 MB, apenas `application/pdf` e `text/plain`.
- [ ] Revisar **Logs** (Auth, API, Edge Functions) semanalmente; ativar alertas se possível.
- [ ] Se alguma chave `service_role`/`secret` já foi compartilhada, enviada por chat/e-mail ou commitada: **gerar nova e trocar** nos segredos das funções.

## 3. Supabase — Edge Functions (Secrets)
- [ ] `ALLOWED_ORIGINS` = endereço(s) do app (ex.: `https://seu-app.vercel.app`).
- [ ] `DEBUG_ERRORS` ausente ou `false` em produção.
- [ ] `GEMINI_API_KEY` presente; no Google Cloud: **restringir a chave** (API Gemini apenas), definir **orçamento/alertas de gasto** e cota diária.
- [ ] Publicar as funções atualizadas: `admin-create-user`, `analyze-attendance`, `delete-attendance-evaluation`, `generate-report`, `report-pdf`.

## 4. Vercel
- [ ] **2FA** na conta e em todos os membros do time.
- [ ] **Deployment Protection** (Vercel Authentication) nas *previews*, para não expor versões de teste.
- [ ] Variáveis de ambiente: apenas `VITE_*` públicas (URL e chave **anon**, dados da empresa). Nenhum segredo.
- [ ] Domínio com HTTPS e, se houver, DNS com DNSSEC.
- [ ] Conferir os cabeçalhos em https://securityheaders.com (meta: nota A ou A+). Se usar domínio próprio do Supabase, ajuste o `connect-src` em `vercel.json`.

## 5. GitHub
- [ ] Repositório **privado**; **2FA obrigatório** na organização.
- [ ] **Proteção da branch `main`**: exigir Pull Request e revisão; bloquear push direto.
- [ ] **Secret scanning** e **push protection** ligados.
- [ ] **Dependabot alerts/updates** ligados (já há `dependabot.yml`).
- [ ] Workflow **Segurança** (npm audit + CodeQL) passando. CodeQL em repositório privado exige GitHub Advanced Security.
- [ ] Histórico limpo: nenhum `.env` ou chave já commitada (se houve, trocar a chave — apagar o arquivo não basta).

## 6. Rotina operacional
- [ ] **Revisão trimestral de acessos**: quem tem acesso, a quais módulos, quem saiu da empresa.
- [ ] Desativar o usuário **no mesmo dia** do desligamento (o bloqueio vale imediatamente, mesmo com sessão aberta).
- [ ] Administradores e gestores com **2FA ativo** (o app avisa quem ainda não ativou).
- [ ] Consultar o **registro de auditoria** (Segurança da conta → Registro de auditoria) após mudanças de permissões.
- [ ] Treinar a equipe: phishing, senha única, bloqueio de tela, não enviar dados pessoais desnecessários.
- [ ] Revisar os Termos e a Política **uma vez por ano** (e alterar `LEGAL_VERSION` para exigir novo aceite).

## 7. Se suspeitar de invasão
1. Supabase → Authentication → Users: encerrar sessões / desativar a conta suspeita (no ELO: usuário → inativo).
2. Trocar as senhas envolvidas e **gerar novas chaves** (`service_role`/`secret`, Gemini) e atualizar os segredos.
3. Revisar `audit_log` e os logs de Auth/API para entender o que foi acessado e alterado.
4. Restaurar dados de backup, se necessário.
5. Registrar o incidente e, havendo risco aos titulares, avaliar com o jurídico a comunicação à ANPD e aos afetados.
