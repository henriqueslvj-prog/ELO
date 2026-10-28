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

const callGemini = async (model: string, key: string, prompt: string) => {
  const body = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.3,
      maxOutputTokens: 8192,
      responseMimeType: 'application/json',
      responseSchema: {
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
        },
        required: ['resumo_executivo', 'destaques', 'pontos_de_atencao', 'por_categoria', 'proximos_passos'],
      },
    },
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

  const { data: canCreate, error: permError } = await userClient.rpc('has_permission', {
    requested_module: 'relatorios',
    requested_action: 'create',
  });
  if (permError || !canCreate) return json({ error: 'Você não tem permissão para gerar relatórios.' }, 403);

  let payload: any;
  try { payload = await req.json(); } catch { return json({ error: 'JSON inválido.' }, 400); }
  const { kind, period_start, period_end } = payload || {};
  if (!['semanal', 'mensal', 'personalizado'].includes(kind)) return json({ error: 'Tipo de relatório inválido.' }, 400);
  if (!isIso(period_start) || !isIso(period_end) || period_end < period_start) {
    return json({ error: 'Período inválido. Verifique as datas inicial e final.' }, 400);
  }
  const days = (Date.parse(period_end) - Date.parse(period_start)) / 86400000 + 1;
  if (days > 366) return json({ error: 'O período máximo de um relatório é 366 dias.' }, 400);

  const admin = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: obs, error: obsError } = await admin
    .from('relatorio_observacoes')
    .select('id,obs_date,category,title,content')
    .gte('obs_date', period_start)
    .lte('obs_date', period_end)
    .order('obs_date', { ascending: true })
    .limit(500);
  if (obsError) return json({ error: `Não foi possível carregar as observações: ${obsError.message}` }, 500);
  if (!obs?.length) return json({ error: 'Não há observações registradas neste período.' }, 404);

  const label = kind === 'semanal' ? 'semanal' : kind === 'mensal' ? 'mensal' : 'do período';
  const listing = obs
    .map((o: Obs, i: number) => `${i + 1}. [${br(o.obs_date)}] (${o.category}) ${o.title}${o.content ? ' — ' + o.content : ''}`)
    .join('\n');
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

OBSERVAÇÕES (${obs.length})
${listing}`;

  let content: any = null;
  let usedModel: string | null = null;
  const errors: string[] = [];
  if (geminiKey) {
    const models = [...new Set([Deno.env.get('GEMINI_MODEL'), 'gemini-3.6-flash', 'gemini-3.5-flash', 'gemini-3.5-flash-lite'].filter(Boolean) as string[])];
    for (const model of models) {
      try {
        content = await callGemini(model, geminiKey, prompt);
        usedModel = model;
        break;
      } catch (e) {
        const status = Number((e as any)?.status || 0);
        errors.push(e instanceof Error ? e.message : String(e));
        if (!(status === 0 || status === 404 || status === 429 || status >= 500)) break;
      }
    }
  } else {
    errors.push('GEMINI_API_KEY não configurada.');
  }

  const generatedByAi = !!content;
  if (!content) content = buildFallback(obs as Obs[]);

  const counts: Record<string, number> = {};
  (obs as Obs[]).forEach((o) => { counts[o.category] = (counts[o.category] || 0) + 1; });
  content.contagem_por_categoria = counts;
  if (!generatedByAi) content.aviso = `Relatório gerado sem IA (${errors.join(' | ').slice(0, 300)})`;

  const title = `Relatório ${kind} — ${br(period_start)} a ${br(period_end)}`;
  const { data: saved, error: saveError } = await admin
    .from('relatorios')
    .insert({
      kind, title, period_start, period_end,
      observation_count: obs.length, content,
      generated_by_ai: generatedByAi, model: usedModel,
      created_by: userData.user.id,
    })
    .select('id')
    .single();
  if (saveError) return json({ error: `Não foi possível salvar o relatório: ${saveError.message}` }, 500);

  return json({ success: true, id: saved.id, generated_by_ai: generatedByAi, warning: generatedByAi ? null : content.aviso });
});
