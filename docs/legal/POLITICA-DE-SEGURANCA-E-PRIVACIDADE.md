# Política de Segurança e Privacidade do ELO

**Proteção de dados, controles de segurança e resposta a incidentes**  
Versão 2026-11 · novembro de 2026

> Modelo elaborado para uso interno. Antes de adotá-lo oficialmente, o texto deve ser revisado por assessoria jurídica e os campos entre colchetes [ ] (empresa, CNPJ, e-mails e foro) devem ser preenchidos.

Esta Política descreve como [RAZÃO SOCIAL DA EMPRESA] (CNPJ [CNPJ]) protege o ELO e os dados tratados nele, em conformidade com a Lei Geral de Proteção de Dados (LGPD, Lei nº 13.709/2018) e boas práticas de segurança da informação.

## 1. Papéis

- Controlador: [RAZÃO SOCIAL DA EMPRESA].
- Encarregado pelo tratamento de dados (DPO): [E-MAIL DO ENCARREGADO (DPO)].
- Operadores (fornecedores que tratam dados em nome da Empresa): Supabase (autenticação, banco de dados e armazenamento de arquivos), Vercel (hospedagem da aplicação), Google (API Gemini, para análise por IA) e GitHub (hospedagem do código-fonte, sem dados de usuários).

## 2. Dados tratados e finalidades

| Categoria | Exemplos | Finalidade |
|---|---|---|
| Cadastro de usuários | Nome, e-mail, perfil, status e permissões | Autenticar, controlar acessos e identificar autoria |
| Registros de segurança | Criação de usuários, alterações de permissão, exclusões e lançamento de notas | Segurança, auditoria e prevenção a fraudes |
| Conteúdo operacional | Demandas, solicitações, reuniões, observações e relatórios | Gestão e acompanhamento do trabalho |
| Avaliação de desempenho | Pontuações, pareceres e rankings de colaboradores | Reconhecimento e gestão de desempenho |
| Atendimentos analisados | Transcrições ou PDFs de atendimentos (podem conter dados de clientes) | Avaliar a qualidade do atendimento por critérios definidos |

## 3. Bases legais

O tratamento ocorre, conforme o caso, para execução de contrato ou procedimentos preliminares (relação de trabalho), cumprimento de obrigação legal ou regulatória, exercício regular de direitos e legítimo interesse da Empresa (segurança e gestão), observados os princípios da finalidade, adequação, necessidade, transparência e segurança (LGPD, art. 6º). Quando necessário, será colhido consentimento específico.

## 4. Atendimentos e dados de terceiros (clientes e pacientes)

- Atendimentos podem conter dados pessoais de terceiros, inclusive dados sensíveis, como informações de saúde (LGPD, art. 5º, II).
- Princípio da minimização: envie para análise apenas o necessário e, sempre que possível, remova identificadores (CPF, telefone, e-mail, endereço, dados bancários e informações clínicas).
- Arquivos TXT têm identificadores comuns (CPF, CNPJ, e-mail, telefone e números de cartão) mascarados automaticamente antes de irem à IA. Arquivos PDF são enviados integralmente; portanto, devem ser anonimizados antes do envio.
- Os arquivos ficam em armazenamento privado, acessível apenas a usuários autorizados, com limite de tamanho e tipos permitidos.

## 5. Uso de inteligência artificial

- A IA gera notas e pareceres como apoio. A decisão final é sempre humana (LGPD, art. 20).
- O conteúdo enviado ao provedor de IA é tratado apenas para gerar a análise solicitada. O provedor deve ser contratado em condições que vedem o uso do conteúdo para treinar modelos, conforme termos de dados da API aplicável (verificar e manter documentado).
- O texto dos atendimentos é tratado como dado, e não como instrução: comandos escritos dentro de um atendimento não alteram o comportamento da análise.

## 6. Compartilhamento e transferência internacional

Os dados não são vendidos. São compartilhados apenas com os operadores listados e quando exigido por lei ou autoridade. Os operadores podem armazenar ou processar dados fora do Brasil; a Empresa adota cláusulas contratuais e salvaguardas compatíveis com o art. 33 da LGPD.

## 7. Medidas técnicas de segurança

- Conexão criptografada (HTTPS) com política HSTS e cabeçalhos de segurança (CSP, proteção contra clickjacking e sniffing de conteúdo).
- Controle de acesso por perfil e permissão (visualizar, criar, editar, excluir), aplicado no banco de dados por regras de segurança em nível de linha (RLS), e não apenas na tela.
- Verificação em duas etapas (2FA/TOTP) disponível a todos e recomendada a administradores e gestores; quando ativada, é exigida pelo banco de dados.
- Acesso imediatamente bloqueado para usuários desativados, mesmo com sessão aberta.
- Expiração de sessão por inatividade e encerramento de sessões em todos os dispositivos.
- Política de senhas (mínimo de 10 caracteres, com letras e números) e proteção contra tentativas repetidas de login.
- Trilha de auditoria de eventos sensíveis (criação de usuários, alterações de perfis e permissões, exclusões e notas) com acesso restrito a administradores.
- Limite de requisições por usuário nas funções de IA e de criação de contas, reduzindo abuso e custos.
- Validação de arquivos enviados (tipo, tamanho e assinatura) e armazenamento privado.
- Proteção contra remoção do último administrador ativo.
- Segredos (chaves de API) mantidos apenas no servidor; a chave pública do frontend não concede acesso por si só.

## 8. Medidas organizacionais

- Princípio do menor privilégio e revisão periódica de acessos (recomendado: trimestral).
- Desativação do acesso no mesmo dia do desligamento ou mudança de função.
- Orientação e treinamento dos usuários sobre phishing, senhas e dispositivos.
- Autenticação em dois fatores obrigatória nas contas de código-fonte e de provedores (GitHub, Supabase, Vercel).
- Backups e restauração testados periodicamente.

## 9. Retenção e descarte

Os dados são mantidos pelo tempo necessário às finalidades descritas e a obrigações legais. Prazos sugeridos, a serem confirmados pela Empresa: contas e permissões, enquanto houver vínculo; registros de segurança, 12 meses; atendimentos analisados, até [PRAZO] meses; relatórios, conforme política interna. Encerrado o prazo, os dados são eliminados ou anonimizados.

## 10. Direitos dos titulares

O titular pode solicitar confirmação de tratamento, acesso, correção, anonimização, bloqueio ou eliminação de dados, portabilidade, informação sobre compartilhamento e revisão de decisões automatizadas (LGPD, art. 18 e 20). As solicitações devem ser enviadas para [E-MAIL DO ENCARREGADO (DPO)] e serão respondidas no prazo legal.

## 11. Incidentes de segurança

- Qualquer suspeita deve ser comunicada imediatamente a [E-MAIL DE SEGURANÇA].
- A Empresa avalia o incidente, contém o dano (bloqueio de contas, troca de chaves e senhas, revogação de sessões), investiga a causa e preserva evidências.
- Quando houver risco ou dano relevante aos titulares, a Empresa comunicará a ANPD e os titulares afetados no prazo regulamentar vigente (confirmar com o jurídico a regra atual da ANPD).
- Após o incidente, são aplicadas ações corretivas e atualizada esta Política.

## 12. Boas práticas para usuários

- Use uma senha exclusiva e longa; prefira um gerenciador de senhas.
- Ative a verificação em duas etapas.
- Desconfie de e-mails e mensagens pedindo senha ou códigos. A equipe do ELO nunca pede sua senha.
- Bloqueie a tela e encerre a sessão em computadores compartilhados.
- Mantenha o sistema operacional e o navegador atualizados; evite redes Wi-Fi desconhecidas sem proteção.
- Não envie dados pessoais desnecessários; anonimize atendimentos antes da análise.
- Reporte imediatamente qualquer comportamento suspeito.

## 13. Relato de vulnerabilidades

Quem identificar uma falha de segurança deve reportá-la de forma responsável para [E-MAIL DE SEGURANÇA], sem explorar a falha, sem acessar dados de terceiros e sem divulgar publicamente antes da correção. Relatos de boa-fé serão tratados com prioridade e sem retaliação.

## 14. Revisão desta Política

Esta Política é revisada ao menos uma vez por ano e sempre que houver mudança relevante no sistema, nos operadores ou na legislação. Cada versão é identificada e, se necessário, exige novo aceite.
