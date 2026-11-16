# Política de Segurança do ELO

## Como relatar uma vulnerabilidade
Se você encontrou uma falha de segurança no ELO, **não abra uma issue pública**. Envie os detalhes para o e-mail de segurança da empresa (veja `public/.well-known/security.txt`) com:

- o que foi encontrado e onde (tela, endpoint ou função);
- passos para reproduzir;
- o impacto que você imagina.

Compromissos: confirmar o recebimento em até 2 dias úteis, informar o andamento e corrigir de acordo com a gravidade. Relatos de boa-fé, sem acesso a dados de terceiros e sem divulgação antes da correção, não sofrerão retaliação.

## O que está protegido (resumo)
- Acesso: login com senha forte (10+ caracteres), verificação em duas etapas (TOTP), bloqueio por tentativas repetidas e expiração de sessão por inatividade.
- Dados: regras de segurança em nível de linha (RLS) em todas as tabelas, exigência de usuário ativo e de 2FA concluído no próprio banco, armazenamento privado de arquivos com limite de tamanho e tipo.
- Servidor: Edge Functions com validação de sessão, limite de uso por usuário, CORS restrito, erros sem detalhes internos e proteção contra instruções maliciosas em documentos enviados à IA.
- Rastreabilidade: trilha de auditoria de eventos sensíveis (somente administradores).
- Navegador: HTTPS/HSTS, Content-Security-Policy, proteção contra clickjacking, sem indexação por buscadores.
- Código: Dependabot e análise automática (CodeQL e `npm audit`) no GitHub.

Detalhes: `docs/legal/POLITICA-DE-SEGURANCA-E-PRIVACIDADE.md`. Configurações que dependem dos painéis (Supabase, Vercel, GitHub): `docs/CHECKLIST-SEGURANCA.md`.

## Regras para quem desenvolve
1. Nunca coloque chaves secretas (`service_role`, `secret`, `GEMINI_API_KEY`) em variáveis `VITE_*` nem no código. Variáveis `VITE_*` são públicas.
2. Nunca envie `.env` ao repositório (o `.gitignore` já bloqueia).
3. Toda tabela nova precisa de RLS habilitado e de políticas por permissão (`has_permission`).
4. Toda Edge Function nova deve validar a sessão, verificar permissão, limitar o uso e não devolver erros internos ao cliente.
5. Mudanças em permissões e perfis devem passar pelo painel de usuários (gera auditoria).
