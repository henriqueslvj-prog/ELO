import { createClient } from 'npm:@supabase/supabase-js@2.57.4';
import { getDocument } from 'npm:pdfjs-dist@4.10.38/legacy/build/pdf.mjs';

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
  return Math.max(0, Math.min(10, Math.round(n * 10) / 10));
};

const extractPdfText = async (buffer: ArrayBuffer) => {
  const data = new Uint8Array(buffer);
  const loadingTask = getDocument({ data, disableWorker: true, useSystemFonts: true, isEvalSupported: false });
  const pdf = await loadingTask.promise;
  const pages: string[] = [];

  try {
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      const pageText = content.items
        .map((item: any) => typeof item?.str === 'string' ? item.str : '')
        .join(' ')
        .replace(/[ \t]+/g, ' ')
        .trim();
      if (pageText) pages.push(`--- PÁGINA ${pageNumber} ---\n${pageText}`);
    }
  } finally {
    await pdf.destroy();
  }

  const text = pages.join('\n\n').trim();
  return { text, pageCount: pages.length, totalPages: pdf.numPages, characters: text.length };
};

const buildPrompt = (
  employee: any,
  criteria: any[],
  referencesByCriterion: Map<string, any[]>,
  attendanceText: string,
) => {
  const criteriaText = criteria.map((criterion) => {
    const references = referencesByCriterion.get(criterion.id) || [];
    const referenceText = references.length
      ? references.map((reference: any) => `\nBASE DE REFERÊNCIA — ${reference.name} (versão ${reference.version})\n${reference.content}`).join('\n')
      : '\nBASE DE REFERÊNCIA: nenhuma referência adicional vinculada a este critério.';

    return `- ID: ${criterion.id}\n  Critério: ${criterion.name}\n  Regra: ${criterion.description || 'Avalie conforme evidências objetivas do atendimento.'}\n  Nota mínima configurada: ${criterion.min_score}/10\n  Obrigatório: ${criterion.required ? 'sim' : 'não'}\n${referenceText}`;
  }).join('\n\n');

  return `Você é o avaliador de qualidade do ELO.

Sua tarefa é avaliar EXCLUSIVAMENTE o atendimento cujo texto foi extraído do PDF abaixo.

A avaliação é baseada nos critérios configurados pelo ELO. Quando um critério possuir uma BASE DE REFERÊNCIA, essa base é a referência oficial para interpretar o que deve ser observado naquele critério.

COLABORADOR AVALIADO:
${employee?.full_name || 'não informado'}

SETOR:
${employee?.sector || 'não informado'}

CRITÉRIOS ATIVOS COM FONTE IA:

${criteriaText}

REGRAS GERAIS:
1. Avalie somente ações e mensagens atribuíveis ao atendente humano.
2. Não penalize bot, mensagens automáticas, transferências automáticas ou limitações técnicas do sistema como se fossem ações do atendente.
3. Não invente fatos, intenções, sentimentos, políticas ou informações que não estejam demonstrados no atendimento.
4. Um critério só é avaliável quando houver evidência suficiente.
5. Quando não houver evidência suficiente, use available=false e não informe score.
6. Quando avaliável, score deve ser de 0 a 10 e pode ter uma casa decimal.
7. A justificativa deve explicar objetivamente por que as evidências sustentam a nota.
8. As evidências devem ser curtas, específicas e rastreáveis ao texto do atendimento.
9. Quando houver horário relevante, mencione os horários e/ou o intervalo observado.
10. Pontos de atenção devem registrar fatos ou riscos de processo observáveis.
11. Um ponto de atenção não deve ser transformado automaticamente em falha.
12. Se existir demora entre mensagens, informe o intervalo quando relevante, mas não conclua negligência sem evidência contextual.
13. Se o atendimento terminar sem confirmação de uma ação esperada, registre isso como ponto de atenção quando o texto sustentar essa leitura.
14. Não compare o colaborador com outras pessoas.
15. Não escolha vencedor, destaque do mês ou ranking.
16. O ELO fará pesos, elegibilidade e resultado final separadamente.
17. Responda em português do Brasil.
18. Retorne somente o JSON solicitado.
19. Não utilize markdown fora do JSON.

REGRAS ESPECÍFICAS PARA O ROTEIRO DE ATENDIMENTO:
- Quando o critério estiver vinculado ao "Roteiro de Atendimento — System Saúde", use o roteiro como padrão de referência.
- Avalie aderência ao processo e à intenção de cada etapa, e não apenas correspondência literal das palavras.
- O atendente pode adaptar a linguagem de forma natural sem ser penalizado por não repetir palavra por palavra.
- Considere se as etapas aplicáveis ao caso foram cumpridas, na ordem lógica adequada e com clareza.
- Nem todo atendimento exige todas as 10 etapas; uma etapa deve ser considerada não aplicável quando o contexto do atendimento demonstrar que ela não era necessária.
- Não penalize a ausência de uma etapa que não poderia ocorrer naquele atendimento.
- Diferencie falha de execução, etapa não aplicável, evidência insuficiente e simples variação de linguagem.
- Para a nota, considere também clareza, cordialidade, condução, compreensão da necessidade, resolução e fechamento quando esses aspectos fizerem parte do critério de qualidade.

FORMATO:
{
  "resumo": "resumo objetivo do atendimento",
  "criterios": [
    {
      "criterion_id": "ID do critério",
      "criterion_name": "nome do critério",
      "available": true,
      "score": 8.5,
      "justification": "justificativa baseada no documento e na referência vinculada",
      "evidence": ["evidência 1", "evidência 2"],
      "attention_points": ["ponto de atenção 1"]
    }
  ]
}

Quando available=false, omita o campo score.

TEXTO DO ATENDIMENTO:
======================
${attendanceText}
======================`;
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
    .select('id,analysis,status')
    .eq('cycle_id', attendance.cycle_id)
    .eq('employee_id', attendance.employee_id)
    .eq('status', 'analisado');

  if (attendanceError) {
    throw new Error(`Não foi possível consolidar os atendimentos do mês: ${attendanceError.message}`);
  }

  for (const criterion of criteria) {
    const values: number[] = [];
    for (const item of analyzedAttendances || []) {
      const criterionResult = item?.analysis?.criterios?.find((x: any) =>
        x?.criterion_id === criterion.id || x?.criterion_name === criterion.name
      );
      const score = normalizeScore(criterionResult?.score);
      if (criterionResult?.available === true && score !== null) values.push(score);
    }

    if (!values.length) continue;

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

  return { evaluation_id: evaluation.id, analyzed_attendances: analyzedAttendances?.length || 0 };
};

const callGemini = async (model: string, geminiKey: string, prompt: string) => {
  const body = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: 'OBJECT',
        properties: {
          resumo: { type: 'STRING' },
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
        required: ['resumo', 'criterios'],
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
  const geminiKey = Deno.env.get('GEMINI_API_KEY');
  if (!supabaseUrl || !anonKey || !geminiKey) return json({ error: 'Secrets obrigatórios não configurados.' }, 500);

  const authorization = req.headers.get('Authorization');
  if (!authorization) return json({ error: 'Sessão não encontrada.' }, 401);

  const supabase = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authorization } } });
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) return json({ error: 'Usuário não autenticado.' }, 401);

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
    .select('id,cycle_id,employee_id,storage_path,file_name,status')
    .eq('id', attendanceId)
    .single();
  if (attendanceError || !attendance) return json({ error: attendanceError?.message || 'Atendimento não encontrado.' }, 404);

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

  await supabase.from('destaque_atendimentos').update({ status: 'analisando', error_message: null }).eq('id', attendance.id);

  try {
    const { data: pdf, error: downloadError } = await supabase.storage.from('destaque-atendimentos').download(attendance.storage_path);
    if (downloadError || !pdf) throw new Error(downloadError?.message || 'Não foi possível baixar o PDF do Storage.');

    const pdfBytes = await pdf.arrayBuffer();
    const maxBytes = 20 * 1024 * 1024;
    if (pdfBytes.byteLength > maxBytes) throw new Error('PDF muito grande. Envie um arquivo de até 20 MB.');

    const extraction = await extractPdfText(pdfBytes);
    if (!extraction.text || extraction.characters < 80) {
      throw new Error('Este PDF não possui texto selecionável suficiente para análise automática. O próximo passo é habilitar OCR para PDFs escaneados ou baseados em imagem.');
    }

    const attendanceDate = detectAttendanceDate(extraction.text);
    if (!attendanceDate) {
      throw new Error('Não foi possível identificar a data do atendimento no PDF. Verifique se o documento contém a data no formato DD/MM/AAAA.');
    }

    const periodKey = attendanceDate.slice(0, 7);
    const targetCycle = await ensureCycleForPeriod(supabase, periodKey, userData.user.id);

    const { error: attendancePeriodError } = await supabase
      .from('destaque_atendimentos')
      .update({
        cycle_id: targetCycle.id,
        attendance_date: attendanceDate,
        period_key: periodKey,
      })
      .eq('id', attendance.id);

    if (attendancePeriodError) {
      throw new Error(`Não foi possível vincular o atendimento ao período ${periodKey}: ${attendancePeriodError.message}`);
    }

    attendance.cycle_id = targetCycle.id;
    attendance.attendance_date = attendanceDate;
    attendance.period_key = periodKey;

    const prompt = buildPrompt(employee, criteria, referencesByCriterion, extraction.text);
    let parsed: any;
    let usedModel = 'gemini-3.6-flash';
    const errors: string[] = [];

    try {
      parsed = await callGemini('gemini-3.6-flash', geminiKey, prompt);
    } catch (error) {
      const status = Number((error as any)?.status || 0);
      const message = error instanceof Error ? error.message : String(error);
      errors.push(message);
      if ([429, 500, 502, 503, 504].includes(status)) {
        usedModel = 'gemini-3.5-flash-lite';
        try { parsed = await callGemini(usedModel, geminiKey, prompt); }
        catch (fallbackError) { errors.push(fallbackError instanceof Error ? fallbackError.message : String(fallbackError)); }
      }
      if (!parsed) throw new Error(`Não foi possível realizar a análise com os modelos Gemini configurados. ${errors.join(' | ')}`);
    }

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
    const analysis = {
      resumo: typeof parsed?.resumo === 'string' && parsed.resumo.trim() ? parsed.resumo.trim() : 'Análise concluída.',
      criterios: normalized,
      analyzed_by: usedModel,
      analyzed_at: analyzedAt,
      extraction: {
        method: 'pdf-text',
        total_pages: extraction.totalPages,
        pages_with_text: extraction.pageCount,
        characters: extraction.characters,
      },
      references: references.map((r: any) => ({ id: r.id, name: r.name, type: r.reference_type, version: r.version })),
    };

    const { error: saveError } = await supabase.from('destaque_atendimentos').update({ status: 'analisado', analysis, analyzed_at: analyzedAt, error_message: null }).eq('id', attendance.id);
    if (saveError) throw new Error(`Falha ao salvar análise: ${saveError.message}`);

    const monthly = await syncMonthlyAiScores(supabase, attendance, criteria);

    const { data: consolidatedEvaluation, error: consolidationError } = await supabase
      .rpc('recalculate_destaque_evaluation', { p_evaluation_id: monthly.evaluation_id });

    if (consolidationError) {
      throw new Error(`A análise foi salva, mas não foi possível consolidar a pontuação mensal: ${consolidationError.message}`);
    }

    return json({
      success: true,
      attendance_id: attendance.id,
      model: usedModel,
      attendance_date: attendanceDate,
      period_key: periodKey,
      analysis,
      monthly,
      evaluation: consolidatedEvaluation,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await supabase.from('destaque_atendimentos').update({ status: 'erro', error_message: message }).eq('id', attendance.id);
    return json({ success: false, error: message, attendance_id: attendance.id }, 500);
  }
});
