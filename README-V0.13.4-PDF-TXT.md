# ELO V0.13.4 — Análise por IA de PDF e TXT

## O que mudou
- **PDF** agora é enviado direto ao Gemini (leitura nativa). Funciona com PDFs de texto e também com PDFs escaneados / prints de conversa. Removida a dependência `pdfjs-dist`, que falhava no ambiente das Edge Functions.
- **TXT** (UTF-8 ou ANSI/Windows-1252) é lido como texto.
- A **data do atendimento** é identificada pela IA (campo `attendance_date`) e, no TXT, também por regex como reserva.
- **Fallback de modelos**: `GEMINI_MODEL` (secret opcional) → `gemini-3.6-flash` → `gemini-3.5-flash` → `gemini-3.5-flash-lite`. Agora também cai para o próximo modelo em erro 404 (modelo indisponível), 429 e 5xx.
- **Mensagem de erro real** na tela: antes aparecia só "non-2xx status code"; agora aparece o motivo retornado pela função.
- Limites: PDF até 14 MB, TXT até 2 MB.

## Publicação
1. Supabase → Edge Functions → `analyze-attendance`: cole o novo `supabase/functions/analyze-attendance/index.ts` e faça Deploy.
2. Secrets: `GEMINI_API_KEY` (obrigatório). Opcional: `GEMINI_MODEL` para fixar o modelo.
3. Faça push do frontend no GitHub (deploy automático na Vercel).
4. Teste com um PDF e um TXT.

Nenhuma migração SQL nova. Se ainda não rodou, execute `supabase/destaques-v0132-pontuacao-oficial.sql`.
