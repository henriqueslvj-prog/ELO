import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

const extractJson = (text: string) => {
  const cleaned = text.replace(/```json/gi, '').replace(/```/g, '').trim();
  try { return JSON.parse(cleaned); } catch {}
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start >= 0 && end > start) return JSON.parse(cleaned.slice(start, end + 1));
  throw new Error('A IA não retornou um JSON válido.');
};

const score = (v: unknown) => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.min(10, Math.round(n * 10) / 10));
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Método não permitido.' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const geminiKey = Deno.env.get('GEMINI_API_KEY');
  if (!supabaseUrl || !anonKey || !geminiKey) return json({ error: 'Secrets obrigatórios não configurados.' }, 500);

  const auth = req.headers.get('Authorization');
  if (!auth) return json({ error: 'Sessão não encontrada.' }, 401);

  const supabase = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: auth } } });
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) return json({ error: 'Usuário não autenticado.' }, 401);

  let attendanceId: string;
  try { attendanceId = (await req.json()).attendance_id; } catch { return json({ error: 'JSON inválido.' }, 400); }
  if (!attendanceId) return json({ error: 'attendance_id é obrigatório.' }, 400);

  const { data: attendance, error: attendanceError } = await supabase
    .from('destaque_atendimentos')
    .select('id,cycle_id,employee_id,storage_path,file_name,status')
    .eq('id', attendanceId).single();
  if (attendanceError || !attendance) return json({ error: attendanceError?.message || 'Atendimento não encontrado.' }, 404);

  const { data: criteria, error: criteriaError } = await supabase
    .from('destaque_criterios').select('id,name,description,weight,min_score,required')
    .eq('active', true).eq('source', 'ia').order('created_at', { ascending: true });
  if (criteriaError) return json({ error: criteriaError.message }, 500);
  if (!criteria?.length) return json({ error: 'Não há critérios ativos com fonte IA.' }, 400);

  const { data: employee } = await supabase
    .from('destaque_colaboradores').select('full_name,sector').eq('id', attendance.employee_id).maybeSingle();

  await supabase.from('destaque_atendimentos').update({ status: 'analisando', error_message: null }).eq('id', attendance.id);

  try {
    const { data: pdf, error: downloadError } = await supabase.storage
      .from('destaque-atendimentos').download(attendance.storage_path);
    if (downloadError || !pdf) throw new Error(downloadError?.message || 'Não foi possível baixar o PDF do Storage.');

    const pdfBytes = new Uint8Array(await pdf.arrayBuffer());
    let binary = '';
    const chunk = 0x8000;
    for (let i = 0; i < pdfBytes.length; i += chunk) binary += String.fromCharCode(...pdfBytes.subarray(i, i + chunk));
    const base64 = btoa(binary);

    const criteriaText = criteria.map((c) => `- ID: ${c.id}\n  Critério: ${c.name}\n  Regra: ${c.description || 'Avalie conforme evidências objetivas do atendimento.'}\n  Nota mínima configurada: ${c.min_score}/10\n  Obrigatório: ${c.required ? 'sim' : 'não'}`).join('\n');

    const prompt = `Você é o avaliador de qualidade do ELO. Analise EXCLUSIVAMENTE o PDF do atendimento fornecido.\n\nColaborador avaliado: ${employee?.full_name || 'não informado'}\nSetor: ${employee?.sector || 'não informado'}\n\nCRITÉRIOS:\n${criteriaText}\n\nREGRAS:\n1. Avalie somente o comportamento do atendente humano identificado no PDF. Não penalize mensagens automáticas/bot ou limitações do sistema como se fossem ações do atendente.\n2. Não invente fatos.\n3. Para cada critério, informe available=true somente quando houver evidência suficiente. Caso contrário, available=false e score=null.\n4. A nota deve ser de 0 a 10, podendo usar casas decimais.\n5. Inclua evidências curtas e rastreáveis ao conteúdo do PDF.\n6. Diferencie fatos observados de pontos de atenção.\n7. Se houver intervalo de tempo entre mensagens, informe o intervalo quando relevante, mas não conclua automaticamente que houve falha sem contexto.\n8. Não compare o colaborador com outras pessoas e não escolha vencedor. O ELO fará os cálculos de peso e elegibilidade.\n9. Responda em português do Brasil.\n\nRetorne JSON com: { resumo: string, criterios: [{ criterion_id, criterion_name, available, score, justification, evidence: string[], attention_points: string[] }] }`;

    const body = {
      contents: [{ role: 'user', parts: [
        { text: prompt },
        { inline_data: { mime_type: 'application/pdf', data: base64 } },
      ]}],
      generationConfig: {
        temperature: 0.1,
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'OBJECT',
          properties: {
            resumo: { type: 'STRING' },
            criterios: { type: 'ARRAY', items: { type: 'OBJECT', properties: {
              criterion_id: { type: 'STRING' }, criterion_name: { type: 'STRING' }, available: { type: 'BOOLEAN' },
              score: { type: 'NUMBER' }, justification: { type: 'STRING' },
              evidence: { type: 'ARRAY', items: { type: 'STRING' } },
              attention_points: { type: 'ARRAY', items: { type: 'STRING' } },
            }, required: ['criterion_id','criterion_name','available','justification','evidence','attention_points'] } },
          }, required: ['resumo','criterios'],
        },
      },
    };

    const gemini = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(geminiKey)}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    const geminiText = await gemini.text();
    if (!gemini.ok) throw new Error(`Gemini ${gemini.status}: ${geminiText.slice(0, 700)}`);
    const geminiJson = JSON.parse(geminiText);
    const output = geminiJson?.candidates?.[0]?.content?.parts?.map((p: any) => p.text || '').join('') || '';
    if (!output) throw new Error('Gemini não retornou conteúdo.');
    const parsed = extractJson(output);

    const returned = Array.isArray(parsed.criterios) ? parsed.criterios : [];
    const normalized = criteria.map((c) => {
      const item = returned.find((x: any) => x.criterion_id === c.id || x.criterion_name === c.name);
      return {
        criterion_id: c.id, criterion_name: c.name,
        available: item?.available === true && score(item?.score) !== null,
        score: item?.available === true ? score(item?.score) : null,
        justification: item?.justification || 'Não houve evidência suficiente no PDF para avaliar este critério.',
        evidence: Array.isArray(item?.evidence) ? item.evidence.slice(0, 8) : [],
        attention_points: Array.isArray(item?.attention_points) ? item.attention_points.slice(0, 8) : [],
      };
    });

    const analysis = { resumo: parsed.resumo || 'Análise concluída.', criterios: normalized, analyzed_by: 'Gemini 2.5 Flash', analyzed_at: new Date().toISOString() };
    const { error: saveError } = await supabase.from('destaque_atendimentos').update({ status: 'analisado', analysis, analyzed_at: new Date().toISOString(), error_message: null }).eq('id', attendance.id);
    if (saveError) throw new Error(`Falha ao salvar análise: ${saveError.message}`);

    return json({ success: true, attendance_id: attendance.id, analysis });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await supabase.from('destaque_atendimentos').update({ status: 'erro', error_message: message }).eq('id', attendance.id);
    return json({ success: false, error: message, attendance_id: attendance.id }, 500);
  }
});
