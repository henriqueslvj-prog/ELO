import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });

const extractJson = (text: string) => {
  const cleaned = text
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start >= 0 && end > start) {
      return JSON.parse(cleaned.slice(start, end + 1));
    }
  }

  throw new Error('A IA não retornou um JSON válido.');
};

const normalizeScore = (value: unknown) => {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.min(10, Math.round(n * 10) / 10));
};

const arrayBufferToBase64 = (buffer: ArrayBuffer) => {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = '';

  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }

  return btoa(binary);
};

const buildPrompt = (employee: any, criteria: any[]) => {
  const criteriaText = criteria
    .map((criterion) => `- ID: ${criterion.id}\n  Critério: ${criterion.name}\n  Regra: ${criterion.description || 'Avalie conforme evidências objetivas do atendimento.'}\n  Nota mínima configurada: ${criterion.min_score}/10\n  Obrigatório: ${criterion.required ? 'sim' : 'não'}`)
    .join('\n');

  return `Você é o avaliador de qualidade do ELO.

Analise EXCLUSIVAMENTE o PDF do atendimento anexado. O PDF contém uma conversa de atendimento ao cliente. Sua função é avaliar o comportamento do atendente humano identificado no documento, usando somente as evidências disponíveis.

COLABORADOR AVALIADO: ${employee?.full_name || 'não informado'}
SETOR: ${employee?.sector || 'não informado'}

CRITÉRIOS ATIVOS COM FONTE IA:
${criteriaText}

REGRAS OBRIGATÓRIAS:
1. Avalie somente ações e mensagens atribuíveis ao atendente humano. Não penalize bot, mensagens automáticas, transferências automáticas ou limitações técnicas do sistema como se fossem ações do atendente.
2. Não invente fatos, intenções, sentimentos, políticas ou informações que não estejam demonstrados no PDF.
3. Um critério só é avaliável quando houver evidência suficiente no documento. Quando não houver evidência suficiente, use available=false e não informe score.
4. Quando avaliável, score deve ser de 0 a 10 e pode ter uma casa decimal.
5. A justificativa deve explicar objetivamente por que a evidência sustenta a nota.
6. As evidências devem ser curtas, específicas e rastreáveis ao conteúdo do PDF. Quando houver horário relevante, mencione os horários e/ou o intervalo observado.
7. Pontos de atenção devem registrar fatos ou riscos de processo observáveis. Não transforme automaticamente um ponto de atenção em falha.
8. Se existir demora entre mensagens, informe o intervalo quando relevante, mas não conclua que houve negligência sem evidência contextual.
9. Se o atendimento terminar sem confirmação de uma ação esperada, registre isso como ponto de atenção ou resolução incompleta somente quando o PDF sustentar essa leitura.
10. Não compare o colaborador com outras pessoas.
11. Não escolha vencedor, destaque do mês ou ranking. O ELO fará os cálculos, pesos e regras de elegibilidade separadamente.
12. Responda em português do Brasil.
13. Retorne SOMENTE o JSON solicitado, sem markdown e sem comentários fora do JSON.

FORMATO:
{
  "resumo": "resumo objetivo do atendimento",
  "criterios": [
    {
      "criterion_id": "ID do critério",
      "criterion_name": "nome do critério",
      "available": true,
      "score": 8.5,
      "justification": "justificativa baseada no documento",
      "evidence": ["evidência 1", "evidência 2"],
      "attention_points": ["ponto de atenção 1"]
    }
  ]
}

Quando available=false, omita o campo score. Não use null no campo score.`;
};

const callGemini = async (
  model: string,
  geminiKey: string,
  prompt: string,
  base64Pdf: string,
) => {
  const body = {
    contents: [
      {
        role: 'user',
        parts: [
          { text: prompt },
          {
            inline_data: {
              mime_type: 'application/pdf',
              data: base64Pdf,
            },
          },
        ],
      },
    ],
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
              required: [
                'criterion_id',
                'criterion_name',
                'available',
                'justification',
                'evidence',
                'attention_points',
              ],
            },
          },
        },
        required: ['resumo', 'criterios'],
      },
    },
  };

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': geminiKey,
      },
      body: JSON.stringify(body),
    },
  );

  const text = await response.text();

  if (!response.ok) {
    const compact = text.replace(/\s+/g, ' ').slice(0, 900);
    const error = new Error(`Gemini ${response.status} (${model}): ${compact}`);
    (error as any).status = response.status;
    throw error;
  }

  let data: any;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`Gemini retornou uma resposta inválida (${model}).`);
  }

  const finishReason = data?.candidates?.[0]?.finishReason;
  const output = data?.candidates?.[0]?.content?.parts
    ?.map((part: any) => part?.text || '')
    .join('')
    .trim();

  if (!output) {
    throw new Error(
      `Gemini não retornou conteúdo (${model}).${finishReason ? ` Motivo: ${finishReason}.` : ''}`,
    );
  }

  return extractJson(output);
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Método não permitido.' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const geminiKey = Deno.env.get('GEMINI_API_KEY');

  if (!supabaseUrl || !anonKey || !geminiKey) {
    return json({ error: 'Secrets obrigatórios não configurados.' }, 500);
  }

  const authorization = req.headers.get('Authorization');
  if (!authorization) return json({ error: 'Sessão não encontrada.' }, 401);

  const supabase = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
  });

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

  if (attendanceError || !attendance) {
    return json({ error: attendanceError?.message || 'Atendimento não encontrado.' }, 404);
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

  if (employeeError || !employee) {
    return json({ error: 'Colaborador vinculado ao atendimento não foi encontrado.' }, 400);
  }

  await supabase
    .from('destaque_atendimentos')
    .update({ status: 'analisando', error_message: null })
    .eq('id', attendance.id);

  try {
    const { data: pdf, error: downloadError } = await supabase.storage
      .from('destaque-atendimentos')
      .download(attendance.storage_path);

    if (downloadError || !pdf) {
      throw new Error(downloadError?.message || 'Não foi possível baixar o PDF do Storage.');
    }

    const pdfBytes = await pdf.arrayBuffer();

    // Inline PDF é adequado para documentos menores/processamento temporário.
    // Para arquivos muito grandes, o Files API deve ser usado.
    const maxInlineBytes = 20 * 1024 * 1024;
    if (pdfBytes.byteLength > maxInlineBytes) {
      throw new Error('PDF muito grande para análise inline. Envie um arquivo de até 20 MB.');
    }

    const base64Pdf = arrayBufferToBase64(pdfBytes);
    const prompt = buildPrompt(employee, criteria);

    let parsed: any;
    let usedModel = 'gemini-3.6-flash';
    const errors: string[] = [];

    try {
      parsed = await callGemini('gemini-3.6-flash', geminiKey, prompt, base64Pdf);
    } catch (error) {
      const status = Number((error as any)?.status || 0);
      const message = error instanceof Error ? error.message : String(error);
      errors.push(message);

      // Fallback somente para indisponibilidade temporária/limitação de capacidade.
      if (status === 429 || status === 500 || status === 502 || status === 503 || status === 504) {
        usedModel = 'gemini-3.5-flash-lite';
        try {
          parsed = await callGemini('gemini-3.5-flash-lite', geminiKey, prompt, base64Pdf);
        } catch (fallbackError) {
          errors.push(fallbackError instanceof Error ? fallbackError.message : String(fallbackError));
        }
      }

      if (!parsed) {
        throw new Error(`Não foi possível realizar a análise com os modelos Gemini configurados. ${errors.join(' | ')}`);
      }
    }

    const returned = Array.isArray(parsed?.criterios) ? parsed.criterios : [];

    const normalized = criteria.map((criterion) => {
      const item = returned.find(
        (candidate: any) =>
          candidate?.criterion_id === criterion.id || candidate?.criterion_name === criterion.name,
      );

      const normalizedScore = normalizeScore(item?.score);
      const available = item?.available === true && normalizedScore !== null;

      return {
        criterion_id: criterion.id,
        criterion_name: criterion.name,
        available,
        score: available ? normalizedScore : null,
        justification:
          typeof item?.justification === 'string' && item.justification.trim()
            ? item.justification.trim()
            : 'Não houve evidência suficiente no PDF para avaliar este critério.',
        evidence: Array.isArray(item?.evidence) ? item.evidence.slice(0, 8) : [],
        attention_points: Array.isArray(item?.attention_points)
          ? item.attention_points.slice(0, 8)
          : [],
      };
    });

    const analyzedAt = new Date().toISOString();
    const analysis = {
      resumo:
        typeof parsed?.resumo === 'string' && parsed.resumo.trim()
          ? parsed.resumo.trim()
          : 'Análise concluída.',
      criterios: normalized,
      analyzed_by: usedModel,
      analyzed_at: analyzedAt,
    };

    const { error: saveError } = await supabase
      .from('destaque_atendimentos')
      .update({
        status: 'analisado',
        analysis,
        analyzed_at: analyzedAt,
        error_message: null,
      })
      .eq('id', attendance.id);

    if (saveError) throw new Error(`Falha ao salvar análise: ${saveError.message}`);

    return json({
      success: true,
      attendance_id: attendance.id,
      model: usedModel,
      analysis,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    await supabase
      .from('destaque_atendimentos')
      .update({ status: 'erro', error_message: message })
      .eq('id', attendance.id);

    return json({ success: false, error: message, attendance_id: attendance.id }, 500);
  }
});
