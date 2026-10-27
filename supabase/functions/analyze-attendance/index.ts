import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...cors, 'Content-Type': 'application/json' },
});

const extractJson = (text: string) => {
  const cleaned = text.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim();
  try { return JSON.parse(cleaned); } catch {
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start >= 0 && end > start) return JSON.parse(cleaned.slice(start, end + 1));
  }
  throw new Error('A IA não retornou um JSON válido.');
};

const normalizeScore = (value: unknown) => {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.min(3, Math.round(n * 10) / 10));
};

const MAX_PDF_BYTES = 14 * 1024 * 1024; // inline do Gemini: ~20 MB no total, e o base64 aumenta ~33%
const MAX_TXT_BYTES = 2 * 1024 * 1024;

const bytesToBase64 = (bytes: Uint8Array) => {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
};

const decodeText = (bytes: Uint8Array) => {
  try { return new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
  catch { return new TextDecoder('windows-1252').decode(bytes); } // TXT exportado em ANSI
};

// Detecta o tipo pelo nome do arquivo e/ou pelos primeiros bytes (%PDF-).
const detectKind = (fileName: string, bytes: Uint8Array): 'pdf' | 'txt' => {
  const isPdfMagic = bytes.length > 4 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46;
  if (isPdfMagic || /\.pdf$/i.test(fileName)) return 'pdf';
  if (/\.txt$/i.test(fileName)) return 'txt';
  return 'txt';
};

const buildPrompt = (
  employee: any,
  criteria: any[],
  referencesByCriterion: Map<string, any[]>,
  attendance: { kind: 'pdf' | 'txt'; text?: string },
) => {
  const criteriaText = criteria.map((criterion) => {
    const references = referencesByCriterion.get(criterion.id) || [];
    const referenceText = references.length
      ? references.map((reference: any) => `\nBASE DE REFERÊNCIA — ${reference.name} (versão ${reference.version})\n${reference.content}`).join('\n')
      : '\nBASE DE REFERÊNCIA: nenhuma referência adicional vinculada a este critério.';

    return `- ID: ${criterion.id}\n  Critério: ${criterion.name}\n  Regra: ${criterion.description || 'Avalie conforme evidências objetivas do atendimento.'}\n  Peso: ${criterion.weight}%\n  Nota mínima configurada: ${criterion.min_score}/3\n  Obrigatório: ${criterion.required ? 'sim' : 'não'}\n${referenceText}`;
  }).join('\n\n');

  return `Você é um ESPECIALISTA SÊNIOR EM QUALIDADE DE ATENDIMENTO, auditor de atendimento humano e avaliador técnico do ELO.

Sua responsabilidade é analisar o atendimento de forma rigorosa, justa e baseada em evidências. Você não é um gerador de elogios e não deve presumir que o atendimento foi bom. Também não deve penalizar o atendente por fatores que não estejam sob seu controle.

ATENDIMENTO AVALIADO
Colaborador: ${employee?.full_name || 'não informado'}
Setor: ${employee?.sector || 'não informado'}

CRITÉRIOS ATIVOS
${criteriaText}

O QUE VOCÊ DEVE ANALISAR
1. Se o cliente foi efetivamente acolhido e tratado com cordialidade e respeito.
2. Se o cliente recebeu resposta em tempo razoável, considerando os horários registrados e o contexto do atendimento.
3. Se as respostas foram claras, objetivas, completas e compreensíveis.
4. Se a solicitação do cliente foi resolvida, parcialmente resolvida, ficou pendente ou não foi possível concluir.
5. Se o atendente conduziu o atendimento com profissionalismo, domínio do processo, organização e fechamento adequado.

ESCALA OBRIGATÓRIA POR CRITÉRIO — 0 A 3 PONTOS
- 3.0 = excelência: comportamento claramente demonstrado e consistente, sem falha relevante.
- 2.0 = adequado: atende ao esperado, com pequena oportunidade de melhoria.
- 1.0 = insuficiente: falha relevante ou execução apenas parcial.
- 0.0 = inadequado: falha grave, ausência injustificada ou condução incompatível com o padrão.
Você pode usar décimos entre esses níveis (ex.: 2.4, 2.7), mas nunca ultrapasse 3.0.

REGRAS DE AUDITORIA
- Analise somente ações e mensagens atribuíveis ao atendente humano.
- Não penalize bot, mensagens automáticas, filas, transferências automáticas ou limitações técnicas como se fossem ações do atendente.
- Reconstrua a linha do tempo quando houver horários. Diferencie tempo de espera do cliente, tempo de resposta do atendente e períodos fora do horário de atendimento.
- Uma demora deve ser registrada como fato com intervalo observado. Não chame de negligência sem evidência contextual.
- Ser objetivo ou breve não significa ser grosseiro. Só classifique como seco, ríspido, frio ou inadequadamente cordial quando o texto sustentar essa interpretação.
- Não confunda cordialidade com excesso de emojis ou frases prontas.
- Verifique se o atendente entendeu a necessidade do cliente e respondeu exatamente ao que foi solicitado.
- Verifique se a resposta realmente resolve a solicitação ou apenas fornece informação parcial.
- Se o cliente indicar uma intenção clara (por exemplo, escolher data, modalidade ou pagamento) e não houver confirmação/conclusão no documento, registre a pendência como ponto de atenção.
- Não invente agendamento, confirmação, intenção, sentimento, regra, política ou informação ausente.
- Diferencie: resolvida, parcialmente_resolvida, não_resolvida e não_foi_possivel_concluir.
- Não penalize uma etapa que não era aplicável ao caso.
- Use o Roteiro de Atendimento — System Saúde como referência de processo quando estiver vinculado ao critério. Avalie o significado e a etapa, não a correspondência literal das palavras.
- Não compare este colaborador com outras pessoas.
- Não escolha vencedor, destaque do mês ou ranking. O ELO fará a consolidação.
- Se não houver evidência suficiente para um critério, use available=false e não invente uma nota.
- Responda em português do Brasil.
- Retorne somente JSON válido.

REGRA OFICIAL DE PONTUAÇÃO DA SYSTEM SAÚDE
A) QUALIDADE DO ATENDIMENTO: atribua uma nota geral inteira de 0 a 100 para ESTE atendimento, considerando acolhimento, tempo de resposta, clareza, resolução e profissionalismo. A nota mensal desta categoria será calculada pelo ELO como a média de até 10 atendimentos aleatórios e convertida para 15 pontos: média × 0,15, arredondada para inteiro. Não converta a nota individual em 15 pontos.
B) UTILIZAÇÃO DO SCRIPT E PROCESSOS: atribua nota de 0 a 10 para ESTE atendimento, avaliando os sete itens: uso correto do script; identificação correta do cliente; conferência de informações; registro no sistema; encaminhamento correto; encerramento correto; cumprimento dos procedimentos. Para cada item retorne status "cumprido", "parcial", "não_cumprido" ou "não_evidenciado", justificativa e evidência. Não invente registros internos que o PDF não mostra. Se não houver evidência de um item, marque "não_evidenciado" e explique; não o trate automaticamente como descumprido.
A nota de qualidade e a nota de script são independentes. O script não deve ser incorporado à nota de qualidade duas vezes.

FORMATO OBRIGATÓRIO
{
  "attendance_date": "2026-10-15",
  "quality_score_100": 95,
  "quality_score_justification": "justificativa da nota de qualidade de 0 a 100",
  "script_score_10": 8,
  "script_score_justification": "justificativa da nota de script de 0 a 10",
  "script_checks": [
    {"criterion": "Utilização correta do script", "status": "cumprido", "justification": "...", "evidence": ["..."]},
    {"criterion": "Identificação correta do cliente", "status": "cumprido", "justification": "...", "evidence": ["..."]},
    {"criterion": "Conferência de informações", "status": "parcial", "justification": "...", "evidence": ["..."]},
    {"criterion": "Registro no sistema", "status": "não_evidenciado", "justification": "O PDF não comprova o registro interno.", "evidence": []},
    {"criterion": "Encaminhamento correto", "status": "cumprido", "justification": "...", "evidence": ["..."]},
    {"criterion": "Encerramento correto", "status": "cumprido", "justification": "...", "evidence": ["..."]},
    {"criterion": "Cumprimento dos procedimentos", "status": "parcial", "justification": "...", "evidence": ["..."]}
  ],
  "resumo": "parecer técnico curto e objetivo",
  "solicitacao_cliente": "o que o cliente buscava resolver",
  "status_resolucao": "resolvida | parcialmente_resolvida | não_resolvida | não_foi_possivel_concluir",
  "tempo_resposta": {
    "primeira_resposta_minutos": null,
    "maior_intervalo_relevante_minutos": null,
    "observacao": "fato objetivo sobre tempo e contexto"
  },
  "parecer_especialista": "conclusão técnica sobre a qualidade do atendimento, sem escolher vencedor",
  "criterios": [
    {
      "criterion_id": "ID do critério",
      "criterion_name": "nome do critério",
      "available": true,
      "score": 2.5,
      "justification": "justificativa técnica baseada em fatos",
      "evidence": ["evidência curta e rastreável"],
      "attention_points": ["ponto de atenção objetivo"]
    }
  ]
}

DATA DO ATENDIMENTO
Identifique a data em que o atendimento ocorreu (normalmente a data da primeira mensagem ou do protocolo) e retorne em "attendance_date" no formato AAAA-MM-DD. Considere datas no padrão brasileiro DD/MM/AAAA. Se o documento não trouxer data, retorne null. Não invente a data.

${attendance.kind === 'pdf'
  ? 'O ATENDIMENTO ESTÁ NO DOCUMENTO PDF ANEXADO A ESTA MENSAGEM. Leia todas as páginas (inclusive se o conteúdo for imagem/print de conversa).'
  : `TEXTO DO ATENDIMENTO (ARQUIVO TXT)\n======================\n${attendance.text}\n======================`}`;
};

const detectAttendanceDate = (text: string) => {
  const candidates = text.match(/\b(0?[1-9]|[12]\d|3[01])[\/-](0?[1-9]|1[0-2])[\/-](20\d{2})\b/g) || [];

  for (const raw of candidates) {
    const normalized = raw.replace(/\//g, '-');
    const [dayRaw, monthRaw, yearRaw] = normalized.split('-');
    const day = Number(dayRaw);
    const month = Number(monthRaw);
    const year = Number(yearRaw);
    const date = new Date(Date.UTC(year, month - 1, day));

    if (
      date.getUTCFullYear() === year &&
      date.getUTCMonth() === month - 1 &&
      date.getUTCDate() === day
    ) {
      return `${year.toString().padStart(4, '0')}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
    }
  }

  return null;
};

const ensureCycleForPeriod = async (supabase: any, periodKey: string, userId: string) => {
  const [yearRaw, monthRaw] = periodKey.split('-');
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 0));
  const periodStart = start.toISOString().slice(0, 10);
  const periodEnd = end.toISOString().slice(0, 10);

  const { data: existing, error: existingError } = await supabase
    .from('destaque_ciclos')
    .select('*')
    .eq('period_key', periodKey)
    .maybeSingle();

  if (existingError) {
    throw new Error(`Não foi possível localizar o ciclo de ${periodKey}: ${existingError.message}`);
  }

  if (existing) return existing;

  const { data: created, error: createError } = await supabase
    .from('destaque_ciclos')
    .insert({
      period_key: periodKey,
      period_start: periodStart,
      period_end: periodEnd,
      team_name: 'Equipe',
      status: 'em_avaliacao',
      created_by: userId,
    })
    .select()
    .single();

  if (createError) {
    // Outro processo pode ter criado o mesmo ciclo simultaneamente.
    if (createError.code === '23505') {
      const { data: retry, error: retryError } = await supabase
        .from('destaque_ciclos')
        .select('*')
        .eq('period_key', periodKey)
        .single();
      if (!retryError && retry) return retry;
    }
    throw new Error(`Não foi possível criar o ciclo ${periodKey}: ${createError.message}`);
  }

  return created;
};

const syncMonthlyAiScores = async (supabase: any, attendance: any, criteria: any[]) => {
  const { data: evaluation, error: evaluationError } = await supabase
    .from('destaque_avaliacoes')
    .upsert({
      cycle_id: attendance.cycle_id,
      employee_id: attendance.employee_id,
      status: 'em_avaliacao',
      eligible: true,
    }, { onConflict: 'cycle_id,employee_id' })
    .select()
    .single();

  if (evaluationError || !evaluation) {
    throw new Error(`Não foi possível criar/atualizar a avaliação mensal: ${evaluationError?.message || 'registro não retornado.'}`);
  }

  const { data: analyzedAttendances, error: attendanceError } = await supabase
    .from('destaque_atendimentos')
    .select('id,analysis,status,attendance_date,period_key')
    .eq('cycle_id', attendance.cycle_id)
    .eq('employee_id', attendance.employee_id)
    .eq('status', 'analisado')
    .eq('period_key', attendance.period_key);

  if (attendanceError) throw new Error(`Não foi possível consolidar os atendimentos do mês: ${attendanceError.message}`);

  const validAnalyses = (analyzedAttendances || [])
    .map((row: any) => row.analysis || {})
    .filter((a: any) =>
      a.quality_score_100 !== null && a.quality_score_100 !== undefined && a.quality_score_100 !== '' &&
      a.script_score_10 !== null && a.script_score_10 !== undefined && a.script_score_10 !== '' &&
      Number.isFinite(Number(a.quality_score_100)) && Number.isFinite(Number(a.script_score_10)) &&
      Number(a.quality_score_100) >= 0 && Number(a.quality_score_100) <= 100 &&
      Number(a.script_score_10) >= 0 && Number(a.script_score_10) <= 10
    );
  const qualityAverage = validAnalyses.length
    ? Math.round(validAnalyses.reduce((sum: number, a: any) => sum + Number(a.quality_score_100), 0) / validAnalyses.length * 10) / 10
    : null;
  const scriptAverage = validAnalyses.length
    ? Math.round(validAnalyses.reduce((sum: number, a: any) => sum + Number(a.script_score_10), 0) / validAnalyses.length * 10) / 10
    : null;
  const { error: monthlyScoreError } = await supabase.from('destaque_avaliacoes').update({
    quality_avg_100: qualityAverage,
    quality_points_15: qualityAverage === null ? null : Math.round(qualityAverage * 0.15),
    script_avg_10: scriptAverage,
    ai_attendance_count: validAnalyses.length,
    updated_at: new Date().toISOString(),
  }).eq('id', evaluation.id);
  if (monthlyScoreError) throw new Error(`Não foi possível salvar as médias mensais de qualidade/script: ${monthlyScoreError.message}`);

  for (const criterion of criteria) {
    const values: number[] = [];
    for (const item of analyzedAttendances || []) {
      const criterionResult = item?.analysis?.criterios?.find((x: any) =>
        x?.criterion_id === criterion.id || x?.criterion_name === criterion.name
      );
      const score = normalizeScore(criterionResult?.score);
      if (criterionResult?.available === true && score !== null) values.push(score);
    }

    if (!values.length) {
      await supabase
        .from('destaque_avaliacao_itens')
        .delete()
        .eq('evaluation_id', evaluation.id)
        .eq('criterion_id', criterion.id);
      continue;
    }

    const average = Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10;
    const { error: itemError } = await supabase
      .from('destaque_avaliacao_itens')
      .upsert({
        evaluation_id: evaluation.id,
        criterion_id: criterion.id,
        criterion_name_snapshot: criterion.name,
        weight_snapshot: Number(criterion.weight || 0),
        source_snapshot: criterion.source,
        score: average,
        justification: `Média consolidada automaticamente a partir de ${values.length} atendimento(s) analisado(s) no período.`,
        evidence: { samples: values.length, scores: values },
        ai_samples: values.length,
        ai_updated_at: new Date().toISOString(),
      }, { onConflict: 'evaluation_id,criterion_id' });

    if (itemError) throw new Error(`Não foi possível salvar a pontuação mensal de ${criterion.name}: ${itemError.message}`);
  }

  return { evaluation_id: evaluation.id, analyzed_attendances: validAnalyses.length, quality_avg_100: qualityAverage, quality_points_15: qualityAverage === null ? null : Math.round(qualityAverage * 0.15), script_avg_10: scriptAverage };
};

const callGemini = async (model: string, geminiKey: string, parts: any[]) => {
  const body = {
    contents: [{ role: 'user', parts }],
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: 16384,
      responseMimeType: 'application/json',
      responseSchema: {
        type: 'OBJECT',
        properties: {
          attendance_date: { type: 'STRING', nullable: true },
          quality_score_100: { type: 'NUMBER' },
          quality_score_justification: { type: 'STRING' },
          script_score_10: { type: 'NUMBER' },
          script_score_justification: { type: 'STRING' },
          script_checks: { type: 'ARRAY', items: { type: 'OBJECT', properties: {
            criterion: { type: 'STRING' }, status: { type: 'STRING' }, justification: { type: 'STRING' }, evidence: { type: 'ARRAY', items: { type: 'STRING' } }
          }, required: ['criterion','status','justification','evidence'] } },
          resumo: { type: 'STRING' },
          solicitacao_cliente: { type: 'STRING' },
          status_resolucao: { type: 'STRING' },
          tempo_resposta: {
            type: 'OBJECT',
            properties: {
              primeira_resposta_minutos: { type: 'NUMBER' },
              maior_intervalo_relevante_minutos: { type: 'NUMBER' },
              observacao: { type: 'STRING' },
            },
            required: ['observacao'],
          },
          parecer_especialista: { type: 'STRING' },
          criterios: {
            type: 'ARRAY',
            items: {
              type: 'OBJECT',
              properties: {
                criterion_id: { type: 'STRING' },
                criterion_name: { type: 'STRING' },
                available: { type: 'BOOLEAN' },
                score: { type: 'NUMBER' },
                justification: { type: 'STRING' },
                evidence: { type: 'ARRAY', items: { type: 'STRING' } },
                attention_points: { type: 'ARRAY', items: { type: 'STRING' } },
              },
              required: ['criterion_id', 'criterion_name', 'available', 'justification', 'evidence', 'attention_points'],
            },
          },
        },
        required: ['quality_score_100','quality_score_justification','script_score_10','script_score_justification','script_checks','resumo', 'solicitacao_cliente', 'status_resolucao', 'tempo_resposta', 'parecer_especialista', 'criterios'],
      },
    },
  };

  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': geminiKey },
    body: JSON.stringify(body),
  });

  const text = await response.text();
  if (!response.ok) {
    const compact = text.replace(/\s+/g, ' ').slice(0, 900);
    const error = new Error(`Gemini ${response.status} (${model}): ${compact}`);
    (error as any).status = response.status;
    throw error;
  }

  let data: any;
  try { data = JSON.parse(text); } catch { throw new Error(`Gemini retornou uma resposta inválida (${model}).`); }

  const output = data?.candidates?.[0]?.content?.parts?.map((part: any) => part?.text || '').join('').trim();
  if (!output) {
    const reason = data?.candidates?.[0]?.finishReason;
    throw new Error(`Gemini não retornou conteúdo (${model}).${reason ? ` Motivo: ${reason}.` : ''}`);
  }
  return extractJson(output);
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Método não permitido.' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const geminiKey = Deno.env.get('GEMINI_API_KEY');
  if (!supabaseUrl || !anonKey || !serviceKey || !geminiKey) return json({ error: 'Secrets obrigatórios não configurados. Configure SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY e GEMINI_API_KEY.' }, 500);

  const authorization = req.headers.get('Authorization');
  if (!authorization) return json({ error: 'Sessão não encontrada.' }, 401);

  const authClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authorization } } });
  const { data: userData, error: userError } = await authClient.auth.getUser();
  if (userError || !userData.user) return json({ error: 'Usuário não autenticado.' }, 401);

  const { data: permission, error: permissionError } = await authClient
    .from('user_permissions').select('can_create,can_edit,can_view')
    .eq('user_id', userData.user.id).eq('module', 'destaques').maybeSingle();
  const { data: profile } = await authClient.from('profiles').select('role,status').eq('id', userData.user.id).maybeSingle();
  const isAdmin = profile?.role === 'administrador' && profile?.status === 'ativo';
  if (permissionError || (!isAdmin && !(permission?.can_create || permission?.can_edit))) {
    return json({ error: 'Você não tem permissão para analisar atendimentos no módulo Destaques.' }, 403);
  }
  // A sessão é validada acima. As operações privilegiadas ficam exclusivamente no servidor.
  const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

  let attendanceId: string;
  try {
    const payload = await req.json();
    attendanceId = payload?.attendance_id;
  } catch {
    return json({ error: 'JSON inválido.' }, 400);
  }
  if (!attendanceId) return json({ error: 'attendance_id é obrigatório.' }, 400);

  const { data: attendance, error: attendanceError } = await supabase
    .from('destaque_atendimentos')
    .select('id,cycle_id,employee_id,storage_path,file_name,status,evaluation_deleted_at')
    .eq('id', attendanceId)
    .is('evaluation_deleted_at', null)
    .single();
  if (attendanceError || !attendance) {
    console.error('Falha ao carregar atendimento', attendanceId, attendanceError);
    const detail = attendanceError
      ? `Não foi possível carregar o atendimento (${attendanceError.code || 'sem código'}): ${attendanceError.message}${attendanceError.hint ? ' — ' + attendanceError.hint : ''}`
      : 'Atendimento não encontrado ou já excluído.';
    return json({ error: detail }, 404);
  }

  const { data: criteria, error: criteriaError } = await supabase
    .from('destaque_criterios')
    .select('id,name,description,weight,min_score,required')
    .eq('active', true)
    .eq('source', 'ia')
    .order('created_at', { ascending: true });
  if (criteriaError) return json({ error: criteriaError.message }, 500);
  if (!criteria?.length) return json({ error: 'Não há critérios ativos com fonte IA.' }, 400);

  const { data: employee, error: employeeError } = await supabase
    .from('destaque_colaboradores')
    .select('id,full_name,sector')
    .eq('id', attendance.employee_id)
    .maybeSingle();
  if (employeeError || !employee) return json({ error: 'Colaborador vinculado ao atendimento não foi encontrado.' }, 400);

  // Carrega a base oficial de conhecimento vinculada a cada critério.
  const criterionIds = criteria.map((c: any) => c.id);
  const { data: links, error: linksError } = await supabase
    .from('destaque_criterio_referencias')
    .select('criterion_id,reference_id,priority')
    .in('criterion_id', criterionIds)
    .order('priority', { ascending: true });
  if (linksError) return json({ error: `Falha ao carregar referências da IA: ${linksError.message}` }, 500);

  const referenceIds = [...new Set((links || []).map((x: any) => x.reference_id))];
  let references: any[] = [];
  if (referenceIds.length) {
    const { data, error } = await supabase
      .from('destaque_referencias_ia')
      .select('id,slug,name,reference_type,version,content,active')
      .in('id', referenceIds)
      .eq('active', true);
    if (error) return json({ error: `Falha ao carregar base da IA: ${error.message}` }, 500);
    references = data || [];
  }

  const referencesMap = new Map(references.map((r: any) => [r.id, r]));
  const referencesByCriterion = new Map<string, any[]>();
  for (const link of (links || [])) {
    const ref = referencesMap.get(link.reference_id);
    if (!ref) continue;
    const list = referencesByCriterion.get(link.criterion_id) || [];
    list.push(ref);
    referencesByCriterion.set(link.criterion_id, list);
  }

  const { error: startingError } = await supabase
    .from('destaque_atendimentos')
    .update({ status: 'analisando', error_message: null })
    .eq('id', attendance.id);
  if (startingError) {
    return json({ error: `Não foi possível iniciar a análise: ${startingError.message}` }, 500);
  }

  try {
    const { data: pdf, error: downloadError } = await supabase.storage.from('destaque-atendimentos').download(attendance.storage_path);
    if (downloadError || !pdf) throw new Error(downloadError?.message || 'Não foi possível baixar o PDF do Storage.');

    const fileBytes = new Uint8Array(await pdf.arrayBuffer());
    const kind = detectKind(attendance.file_name || attendance.storage_path, fileBytes);
    if (kind === 'pdf' && fileBytes.byteLength > MAX_PDF_BYTES) throw new Error('PDF muito grande. Envie um arquivo de até 14 MB.');
    if (kind === 'txt' && fileBytes.byteLength > MAX_TXT_BYTES) throw new Error('TXT muito grande. Envie um arquivo de até 2 MB.');
    if (fileBytes.byteLength === 0) throw new Error('O arquivo enviado está vazio.');

    // PDF: enviado diretamente ao Gemini (lê texto e também PDFs escaneados/imagem). TXT: lido como texto.
    let attendanceText = '';
    const parts: any[] = [];
    if (kind === 'txt') {
      attendanceText = decodeText(fileBytes).replace(/\u0000/g, '').trim();
      if (attendanceText.length < 40) throw new Error('O TXT não possui conteúdo suficiente para análise.');
    }
    const prompt = buildPrompt(employee, criteria, referencesByCriterion, { kind, text: attendanceText });
    parts.push({ text: prompt });
    if (kind === 'pdf') parts.push({ inline_data: { mime_type: 'application/pdf', data: bytesToBase64(fileBytes) } });

    // Cadeia de modelos: GEMINI_MODEL (opcional, secret) e depois fallbacks.
    const models = [...new Set([Deno.env.get('GEMINI_MODEL'), 'gemini-3.6-flash', 'gemini-3.5-flash', 'gemini-3.5-flash-lite'].filter(Boolean) as string[])];
    let parsed: any;
    let usedModel = models[0];
    const errors: string[] = [];
    for (const model of models) {
      try {
        parsed = await callGemini(model, geminiKey, parts);
        usedModel = model;
        break;
      } catch (error) {
        const status = Number((error as any)?.status || 0);
        errors.push(error instanceof Error ? error.message : String(error));
        // Tenta o próximo modelo em: modelo inexistente/indisponível (404), limite (429), erro de servidor (5xx) ou resposta inválida (sem status).
        const retryable = status === 0 || status === 404 || status === 429 || status >= 500;
        if (!retryable) break;
      }
    }
    if (!parsed) throw new Error(`Não foi possível realizar a análise com a IA. ${errors.join(' | ')}`);

    // Data do atendimento: informada pela IA (PDF/TXT) ou detectada no texto (TXT).
    const isValidIso = (v: unknown) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`)) && new Date(`${v}T00:00:00Z`).toISOString().slice(0, 10) === v;
    const attendanceDate = (isValidIso(parsed?.attendance_date) ? parsed.attendance_date : null) || (kind === 'txt' ? detectAttendanceDate(attendanceText) : null);
    if (!attendanceDate) {
      throw new Error('Não foi possível identificar a data do atendimento no documento. Verifique se ele contém a data no formato DD/MM/AAAA.');
    }

    const periodKey = attendanceDate.slice(0, 7);
    const targetCycle = await ensureCycleForPeriod(supabase, periodKey, userData.user.id);

    const { error: attendancePeriodError } = await supabase
      .from('destaque_atendimentos')
      .update({ cycle_id: targetCycle.id, attendance_date: attendanceDate, period_key: periodKey })
      .eq('id', attendance.id);
    if (attendancePeriodError) {
      throw new Error(`Não foi possível vincular o atendimento ao período ${periodKey}: ${attendancePeriodError.message}`);
    }

    attendance.cycle_id = targetCycle.id;
    attendance.attendance_date = attendanceDate;
    attendance.period_key = periodKey;

    const returned = Array.isArray(parsed?.criterios) ? parsed.criterios : [];
    const normalized = criteria.map((criterion: any) => {
      const item = returned.find((candidate: any) => candidate?.criterion_id === criterion.id || candidate?.criterion_name === criterion.name);
      const score = normalizeScore(item?.score);
      const available = item?.available === true && score !== null;
      const refs = referencesByCriterion.get(criterion.id) || [];
      return {
        criterion_id: criterion.id,
        criterion_name: criterion.name,
        available,
        score: available ? score : null,
        justification: typeof item?.justification === 'string' && item.justification.trim() ? item.justification.trim() : 'Não houve evidência suficiente no atendimento para avaliar este critério.',
        evidence: Array.isArray(item?.evidence) ? item.evidence.slice(0, 8) : [],
        attention_points: Array.isArray(item?.attention_points) ? item.attention_points.slice(0, 8) : [],
        references_used: refs.map((r: any) => ({ id: r.id, name: r.name, version: r.version })),
      };
    });

    const analyzedAt = new Date().toISOString();
    const qualityScore = parsed?.quality_score_100 !== null && parsed?.quality_score_100 !== undefined && Number.isFinite(Number(parsed.quality_score_100)) ? Math.max(0, Math.min(100, Math.round(Number(parsed.quality_score_100)))) : null;
    const scriptScore = parsed?.script_score_10 !== null && parsed?.script_score_10 !== undefined && Number.isFinite(Number(parsed.script_score_10)) ? Math.max(0, Math.min(10, Math.round(Number(parsed.script_score_10) * 10) / 10)) : null;
    const expectedScriptCriteria = [
      'Utilização correta do script',
      'Identificação correta do cliente',
      'Conferência de informações',
      'Registro no sistema',
      'Encaminhamento correto',
      'Encerramento correto',
      'Cumprimento dos procedimentos',
    ];
    const rawScriptChecks = Array.isArray(parsed?.script_checks) ? parsed.script_checks : [];
    const normalizeLabel = (value: unknown) => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    const unusedScriptChecks = [...rawScriptChecks];
    const scriptChecks = expectedScriptCriteria.map((expected) => {
      const expectedLabel = normalizeLabel(expected);
      const matchIndex = unusedScriptChecks.findIndex((candidate: any) => {
        const label = normalizeLabel(candidate?.criterion);
        return Boolean(label) && (label === expectedLabel || label.includes(expectedLabel) || expectedLabel.includes(label));
      });
      const item = matchIndex >= 0 ? unusedScriptChecks.splice(matchIndex, 1)[0] : null;
      return {
        criterion: expected,
        status: ['cumprido','parcial','não_cumprido','não_evidenciado'].includes(item?.status) ? item.status : 'não_evidenciado',
        justification: String(item?.justification || 'A IA não apresentou justificativa suficiente para este item.'),
        evidence: Array.isArray(item?.evidence) ? item.evidence.slice(0, 5).map((x: any) => String(x)) : [],
      };
    });
    if (qualityScore === null || scriptScore === null || rawScriptChecks.length < 7) {
      throw new Error('A IA não retornou as notas e os sete itens obrigatórios de pontuação. A análise não foi registrada como concluída; tente novamente.');
    }
    const analysis = {
      quality_score_100: qualityScore,
      quality_score_justification: typeof parsed?.quality_score_justification === 'string' ? parsed.quality_score_justification.trim() : '',
      script_score_10: scriptScore,
      script_score_justification: typeof parsed?.script_score_justification === 'string' ? parsed.script_score_justification.trim() : '',
      script_checks: scriptChecks,
      resumo: typeof parsed?.resumo === 'string' && parsed.resumo.trim() ? parsed.resumo.trim() : 'Análise concluída.',
      solicitacao_cliente: typeof parsed?.solicitacao_cliente === 'string' ? parsed.solicitacao_cliente.trim() : '',
      status_resolucao: typeof parsed?.status_resolucao === 'string' ? parsed.status_resolucao : 'não_foi_possivel_concluir',
      tempo_resposta: parsed?.tempo_resposta || null,
      parecer_especialista: typeof parsed?.parecer_especialista === 'string' ? parsed.parecer_especialista.trim() : '',
      nota_total: qualityScore,
      criterios: normalized,
      analyzed_by: usedModel,
      analyzed_at: analyzedAt,
      extraction: {
        method: kind === 'pdf' ? 'pdf-native' : 'txt',
        file_name: attendance.file_name,
        bytes: fileBytes.byteLength,
        characters: kind === 'txt' ? attendanceText.length : null,
      },
      references: references.map((r: any) => ({ id: r.id, name: r.name, type: r.reference_type, version: r.version })),
    };

    const { error: saveError } = await supabase.from('destaque_atendimentos').update({ status: 'analisado', analysis, analyzed_at: analyzedAt, error_message: null }).eq('id', attendance.id);
    if (saveError) throw new Error(`Falha ao salvar análise: ${saveError.message}`);

    // A análise individual já foi persistida. Falha na consolidação mensal não deve apagar
    // nem transformar em erro o histórico individual que foi salvo com sucesso.
    let monthly: any = null;
    let monthlyWarning: string | null = null;
    let consolidatedEvaluation: any = null;
    try {
      monthly = await syncMonthlyAiScores(supabase, attendance, criteria);
      const { data, error: consolidationError } = await supabase
        .rpc('recalculate_destaque_evaluation', { p_evaluation_id: monthly.evaluation_id });
      if (consolidationError) throw new Error(consolidationError.message);
      consolidatedEvaluation = data;
    } catch (error) {
      monthlyWarning = error instanceof Error ? error.message : String(error);
      console.error('Análise individual salva; falha na consolidação mensal:', monthlyWarning);
    }

    return json({
      success: true,
      attendance_id: attendance.id,
      model: usedModel,
      attendance_date: attendanceDate,
      period_key: periodKey,
      analysis,
      monthly,
      monthly_warning: monthlyWarning,
      evaluation: consolidatedEvaluation,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await supabase.from('destaque_atendimentos').update({ status: 'erro', error_message: message }).eq('id', attendance.id);
    return json({ success: false, error: message, attendance_id: attendance.id }, 500);
  }
});
