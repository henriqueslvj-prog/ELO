# ELO V0.13.1 — Recuperação de senha

Esta versão adiciona recuperação de senha por e-mail e uma tela segura para definir uma nova senha, mantendo o login privado e sem cadastro público.

## Alterações
- Link **Esqueceu sua senha?** na tela de login.
- Envio de link com `supabase.auth.resetPasswordForEmail`.
- Redirecionamento para `/?reset-password=1`.
- Tela para definir e confirmar a nova senha (mínimo de 8 caracteres).
- Após salvar, a sessão é encerrada e o usuário volta ao login.
- Mensagem neutra após solicitar e-mail para não revelar se um endereço está cadastrado.

## Configuração obrigatória no Supabase
No painel Supabase do projeto ELO:

1. Acesse **Authentication → URL Configuration**.
2. Em **Site URL**, informe a URL oficial do ELO (por exemplo, `https://SEU-PROJETO.vercel.app`).
3. Em **Redirect URLs**, adicione a URL de produção `https://SEU-PROJETO.vercel.app/**` ou, preferencialmente, a URL exata `https://SEU-PROJETO.vercel.app/`.
4. Para testes locais, adicione também `http://localhost:5173/`.
5. Em **Authentication → Email Templates → Reset Password**, confirme que o template contém o link de recuperação padrão do Supabase (`{{ .ConfirmationURL }}`).

Substitua `SEU-PROJETO.vercel.app` pelo domínio real do ELO. Não adicione domínio que não controla.

## Publicação
1. Extraia o ZIP.
2. Atualize o projeto no GitHub ou substitua os arquivos no repositório conectado à Vercel.
3. Confirme que `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` estão configuradas nas variáveis de ambiente da Vercel.
4. Faça o deploy.
5. Teste **Esqueceu sua senha?** com um e-mail de usuário já autorizado no ELO.

A recuperação não cria usuários nem altera status ou permissões. O usuário precisa continuar existindo no Supabase Auth e ter perfil ativo no ELO.
