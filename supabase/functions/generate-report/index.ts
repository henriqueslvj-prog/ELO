import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

const isIso = (v: unknown) =>
  typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && new Date(`${v}T00:00:00Z`).toISOString().slice(0, 10) === v;
const br = (iso: string) => iso.split('-').reverse().join('/');

type Obs = { id: string; obs_date: string; category: string; title: string; content: string | null };

// Relatório local (sem IA): agrupa por categoria. Usado como reserva se o Gemini falhar.
const buildFallback = (obs: Obs[]) => {
  const byCat = new Map<string, Obs[]>();
  obs.forEach((o) => byCat.set(o.category, [...(byCat.get(o.category) || []), o]));
  return {
    resumo_executivo: `No período foram registradas ${obs.length} observações em ${byCat.size} categoria(s). Este resumo foi montado automaticamente, sem análise de IA.`,
    destaques: [],
    pontos_de_atencao: [],
    por_categoria: [...byCat.entries()].map(([categoria, items]) => ({
      categoria,
      resumo: items.map((i) => `${br(i.obs_date)} — ${i.title}${i.content ? ': ' + i.content : ''}`).join('\n'),
    })),
    proximos_passos: [],
  };
};

const SOLUTIONS_PROPERTY = {
  type: 'ARRAY',
  items: {
    type: 'OBJECT',
    properties: {
      problema: { type: 'STRING' },
      solucoes: { type: 'ARRAY', items: { type: 'STRING' } },
      prioridade: { type: 'STRING', enum: ['alta', 'media', 'baixa'] },
    },
    required: ['problema', 'solucoes', 'prioridade'],
  },
};

const reportSchema = (includeSolutions: boolean) => ({
  type: 'OBJECT',
  properties: {
    resumo_executivo: { type: 'STRING' },
    destaques: { type: 'ARRAY', items: { type: 'STRING' } },
    pontos_de_atencao: { type: 'ARRAY', items: { type: 'STRING' } },
    por_categoria: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: { categoria: { type: 'STRING' }, resumo: { type: 'STRING' } },
        required: ['categoria', 'resumo'],
      },
    },
    proximos_passos: { type: 'ARRAY', items: { type: 'STRING' } },
    ...(includeSolutions ? { solucoes: SOLUTIONS_PROPERTY } : {}),
  },
  required: ['resumo_executivo', 'destaques', 'pontos_de_atencao', 'por_categoria', 'proximos_passos', ...(includeSolutions ? ['solucoes'] : [])],
});

const solutionsOnlySchema = { type: 'OBJECT', properties: { solucoes: SOLUTIONS_PROPERTY }, required: ['solucoes'] };

const callGemini = async (model: string, key: string, prompt: string, schema: unknown, maxOutputTokens: number) => {
  const body = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.3, maxOutputTokens, responseMimeType: 'application/json', responseSchema: schema },
  };
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify(body),
  });
  const raw = await res.text();
  if (!res.ok) {
    const err: any = new Error(`Gemini ${res.status}: ${raw.slice(0, 300)}`);
    err.status = res.status;
    throw err;
  }
  const text = JSON.parse(raw)?.candidates?.[0]?.content?.parts?.map((p: any) => p.text || '').join('') || '';
  return JSON.parse(text.replace(/```json|```/g, '').trim());
};

// Tenta a cadeia de modelos; devolve conteúdo, modelo usado e erros.
const runGemini = async (geminiKey: string | undefined, prompt: string, schema: unknown, maxOutputTokens: number) => {
  const errors: string[] = [];
  if (!geminiKey) return { content: null as any, model: null as string | null, errors: ['GEMINI_API_KEY não configurada.'] };
  const models = [...new Set([Deno.env.get('GEMINI_MODEL'), 'gemini-3.6-flash', 'gemini-3.5-flash', 'gemini-3.5-flash-lite'].filter(Boolean) as string[])];
  for (const model of models) {
    try {
      return { content: await callGemini(model, geminiKey, prompt, schema, maxOutputTokens), model, errors };
    } catch (e) {
      const status = Number((e as any)?.status || 0);
      errors.push(e instanceof Error ? e.message : String(e));
      if (!(status === 0 || status === 404 || status === 429 || status >= 500)) break;
    }
  }
  return { content: null as any, model: null as string | null, errors };
};

const normalizeSolutions = (list: any): { problema: string; solucoes: string[]; prioridade: string }[] =>
  (Array.isArray(list) ? list : [])
    .map((i: any) => ({
      problema: String(i?.problema || '').trim(),
      solucoes: (Array.isArray(i?.solucoes) ? i.solucoes : []).map((x: any) => String(x || '').trim()).filter(Boolean),
      prioridade: ['alta', 'media', 'baixa'].includes(i?.prioridade) ? i.prioridade : 'media',
    }))
    .filter((i) => i.problema && i.solucoes.length)
    .slice(0, 8);

const listObservations = (obs: Obs[]) =>
  obs.map((o, i) => `${i + 1}. [${br(o.obs_date)}] (${o.category}) ${o.title}${o.content ? ' — ' + o.content : ''}`).join('\n');

const SOLUTIONS_RULES = `SOLUÇÕES (solicitadas pelo gestor)
- solucoes: identifique os problemas, falhas, riscos e ocorrências descritos nas observações e, para cada um, proponha de 1 a 4 soluções práticas, específicas e viáveis para uma equipe de atendimento e gestão.
- problema: descreva o problema em uma frase fiel às observações (cite data ou categoria quando ajudar).
- As soluções são SUGESTÕES: use verbos de ação (ex.: "Padronizar...", "Treinar..."), não afirme que já foram executadas e não invente fatos, nomes, números ou prazos.
- prioridade: alta, media ou baixa, conforme gravidade e recorrência nas observações.
- Se as observações não apresentarem problemas, retorne solucoes como lista vazia. Máximo de 8 problemas.`;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Método não permitido.' }, 405);

  const url = Deno.env.get('SUPABASE_URL');
  const anon = Deno.env.get('SUPABASE_ANON_KEY');
  const auth = req.headers.get('Authorization');
  let secret = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_SECRET_KEY');
  if (!secret) {
    try { secret = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') || '{}')?.default || null; } catch { secret = null; }
  }
  const geminiKey = Deno.env.get('GEMINI_API_KEY');
  if (!url || !anon || !secret) return json({ error: 'Configuração do Supabase incompleta na Edge Function.' }, 500);
  if (!auth) return json({ error: 'Sessão não encontrada.' }, 401);

  const userClient = createClient(url, anon, { global: { headers: { Authorization: auth } } });
  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user) return json({ error: 'Usuário não autenticado.' }, 401);

  let payload: any;
  try { payload = await req.json(); } catch { return json({ error: 'JSON inválido.' }, 400); }
  const admin = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });

  // ---------- Ação: incluir soluções em um relatório já gerado ----------
  if (payload?.action === 'add_solutions') {
    const { data: canEdit } = await userClient.rpc('has_permission', { requested_module: 'relatorios', requested_action: 'edit' });
    if (!canEdit) return json({ error: 'Você não tem permissão para editar relatórios.' }, 403);
    if (!UUID.test(String(payload.report_id || ''))) return json({ error: 'Relatório inválido.' }, 400);

    const { data: report, error: reportError } = await admin.from('relatorios').select('*').eq('id', payload.report_id).maybeSingle();
    if (reportError || !report) return json({ error: 'Relatório não encontrado.' }, 404);

    const ids: string[] = Array.isArray(report.content?.observation_ids) ? report.content.observation_ids.filter((i: string) => UUID.test(i)) : [];
    let q = admin.from('relatorio_observacoes').select('id,obs_date,category,title,content').order('obs_date', { ascending: true }).limit(500);
    // Relatórios antigos não guardam a seleção: usa as observações do período.
    q = ids.length ? q.in('id', ids) : q.gte('obs_date', report.period_start).lte('obs_date', report.period_end);
    const { data: reportObs, error: reportObsError } = await q;
    if (reportObsError) return json({ error: `Não foi possível carregar as observações: ${reportObsError.message}` }, 500);
    if (!reportObs?.length) return json({ error: 'As observações deste relatório não estão mais disponíveis.' }, 404);

    const prompt = `Você é analista de gestão da equipe de atendimento. Com base EXCLUSIVAMENTE nas observações abaixo, em português do Brasil, sugira soluções para os problemas apresentados.\n\n${SOLUTIONS_RULES}\n\nOBSERVAÇÕES (${reportObs.length})\n${listObservations(reportObs as Obs[])}`;
    const result = await runGemini(geminiKey, prompt, solutionsOnlySchema, 8192);
    if (!result.content) return json({ error: `Não foi possível gerar as soluções com a IA. ${result.errors.join(' | ').slice(0, 300)}` }, 502);

    const content = { ...(report.content || {}), solucoes: normalizeSolutions(result.content.solucoes), include_solutions: true };
    const { error: updateError } = await admin.from('relatorios').update({ content }).eq('id', report.id);
    if (updateError) return json({ error: `Não foi possível salvar as soluções: ${updateError.message}` }, 500);
    return json({ success: true, id: report.id, count: content.solucoes.length });
  }

  // ---------- Ação padrão: gerar relatório ----------
  const { data: canCreate, error: permError } = await userClient.rpc('has_permission', {
    requested_module: 'relatorios',
    requested_action: 'create',
  });
  if (permError || !canCreate) return json({ error: 'Você não tem permissão para gerar relatórios.' }, 403);

  const { kind, period_start, period_end } = payload || {};
  if (!['semanal', 'mensal', 'personalizado'].includes(kind)) return json({ error: 'Tipo de relatório inválido.' }, 400);
  if (!isIso(period_start) || !isIso(period_end) || period_end < period_start) {
    return json({ error: 'Período inválido. Verifique as datas inicial e final.' }, 400);
  }
  const days = (Date.parse(period_end) - Date.parse(period_start)) / 86400000 + 1;
  if (days > 366) return json({ error: 'O período máximo de um relatório é 366 dias.' }, 400);

  const includeSolutions = payload?.include_solutions === true;
  const customTitle = typeof payload?.title === 'string' ? payload.title.trim().slice(0, 150) : '';
  const hasSelection = Array.isArray(payload?.observation_ids);
  const selectedIds: string[] = hasSelection ? [...new Set<string>(payload.observation_ids.filter((i: unknown) => typeof i === 'string' && UUID.test(i)))] : [];
  if (hasSelection && !selectedIds.length) return json({ error: 'Selecione ao menos uma observação para o relatório.' }, 400);
  if (selectedIds.length > 500) return json({ error: 'Selecione no máximo 500 observações por relatório.' }, 400);

  let query = admin
    .from('relatorio_observacoes')
    .select('id,obs_date,category,title,content')
    .gte('obs_date', period_start)
    .lte('obs_date', period_end)
    .order('obs_date', { ascending: true })
    .limit(500);
  if (hasSelection) query = query.in('id', selectedIds);
  const { data: obs, error: obsError } = await query;
  if (obsError) return json({ error: `Não foi possível carregar as observações: ${obsError.message}` }, 500);
  if (!obs?.length) return json({ error: hasSelection ? 'As observações selecionadas não foram encontradas neste período.' : 'Não há observações registradas neste período.' }, 404);

  const label = kind === 'semanal' ? 'semanal' : kind === 'mensal' ? 'mensal' : 'do período';
  const prompt = `Você é analista de gestão da equipe de atendimento. Escreva em português do Brasil um relatório ${label} (${br(period_start)} a ${br(period_end)}) baseado EXCLUSIVAMENTE nas observações abaixo. Não invente fatos, números, nomes ou datas que não estejam nas observações.

Regras para seguir um padrão executivo de relatório do Grupo System Saúde:
- resumo_executivo: apresentação objetiva do período, finalidade do relatório e panorama geral em 3 a 5 frases.
- destaques: resultados positivos, entregas e ocorrências relevantes comprovadas pelos registros; lista vazia se não houver evidência.
- pontos_de_atencao: problemas, riscos, pendências e ocorrências recorrentes; não transformar hipóteses em fatos.
- por_categoria: um item por categoria presente, com título de categoria e resumo objetivo agrupado dos registros.
- proximos_passos: plano de ação em ordem de prioridade, com ações práticas coerentes com as observações.
- Escreva para leitura de liderança: seções claras, linguagem institucional, objetiva e profissional.
- Não copie dados, metas, percentuais, áreas, nomes ou exemplos do relatório-modelo. O PDF é apenas referência de identidade visual e organização.
- Não crie indicadores, gráficos, metas ou conclusões quantitativas que não possam ser calculados diretamente dos registros fornecidos.
${includeSolutions ? '\n' + SOLUTIONS_RULES + '\n' : ''}
OBSERVAÇÕES (${obs.length})
${listObservations(obs as Obs[])}`;

  const result = await runGemini(geminiKey, prompt, reportSchema(includeSolutions), includeSolutions ? 12288 : 8192);
  let content: any = result.content;
  const generatedByAi = !!content;
  if (!content) content = buildFallback(obs as Obs[]);

  const counts: Record<string, number> = {};
  (obs as Obs[]).forEach((o) => { counts[o.category] = (counts[o.category] || 0) + 1; });
  content.contagem_por_categoria = counts;
  content.observation_ids = (obs as Obs[]).map((o) => o.id);
  content.observacoes_incluidas = (obs as Obs[]).map((o) => ({ data: o.obs_date, categoria: o.category, titulo: o.title }));
  content.include_solutions = includeSolutions && generatedByAi;
  if (includeSolutions && generatedByAi) content.solucoes = normalizeSolutions(content.solucoes);
  else delete content.solucoes;
  if (!generatedByAi) {
    content.aviso = `Relatório gerado sem IA (${result.errors.join(' | ').slice(0, 300)})${includeSolutions ? '. As soluções não foram geradas; use "Incluir soluções" quando a IA estiver disponível.' : ''}`;
  }

  const title = customTitle || `Relatório ${kind} — ${br(period_start)} a ${br(period_end)}`;
  const { data: saved, error: saveError } = await admin
    .from('relatorios')
    .insert({
      kind, title, period_start, period_end,
      observation_count: obs.length, content,
      generated_by_ai: generatedByAi, model: result.model,
      created_by: userData.user.id,
    })
    .select('id')
    .single();
  if (saveError) return json({ error: `Não foi possível salvar o relatório: ${saveError.message}` }, 500);

  return json({ success: true, id: saved.id, generated_by_ai: generatedByAi, warning: generatedByAi ? null : content.aviso });
});
