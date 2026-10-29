import { createClient } from 'npm:@supabase/supabase-js@2.57.4';
import { PDFDocument, StandardFonts, rgb } from 'npm:pdf-lib@1.17.1';
import { LOGO_BASE64 } from './logo.ts';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MONTHS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const ROLES: Record<string, string> = { administrador: 'Administrador', gestor: 'Gestor', supervisor: 'Supervisor', colaborador: 'Colaborador' };
const PRIO: Record<string, string> = { alta: 'Alta', media: 'Média', baixa: 'Baixa' };
const KIND: Record<string, string> = { semanal: 'SEMANAL', mensal: 'MENSAL', personalizado: 'PERSONALIZADO' };

const br = (iso: string) => (iso ? iso.split('-').reverse().join('/') : '');
const extraWinAnsi = '€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ';
// Fontes padrão do PDF só aceitam WinAnsi (Latin-1 + alguns símbolos). Remove o que não for suportado.
const clean = (value: unknown) =>
  String(value ?? '')
    .replace(/\u2192/g, '->').replace(/[\u2713\u2714]/g, 'v').replace(/\t/g, ' ').replace(/\r/g, '')
    .split('')
    .filter((ch) => ch === '\n' || (ch.charCodeAt(0) >= 0x20 && ch.charCodeAt(0) <= 0x7e) || (ch.charCodeAt(0) >= 0xa0 && ch.charCodeAt(0) <= 0xff) || extraWinAnsi.includes(ch))
    .join('');

const base64ToBytes = (b64: string) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
const bytesToBase64 = (bytes: Uint8Array) => {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
};

const INK = rgb(0.114, 0.129, 0.157);
const TEXT = rgb(0.2, 0.23, 0.25);
const MUTED = rgb(0.45, 0.5, 0.52);
const GREEN = rgb(0.12, 0.62, 0.4);
const GOLD = rgb(0.93, 0.8, 0.31);
const LINE = rgb(0.82, 0.85, 0.84);
const SOFT = rgb(0.955, 0.965, 0.96);

const buildPdf = async (report: any, author: { name: string; role: string } | null) => {
  const doc = await PDFDocument.create();
  doc.setTitle(clean(report.title));
  doc.setAuthor('Grupo System Saúde — ELO');
  doc.setCreator('ELO');
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const italic = await doc.embedFont(StandardFonts.HelveticaOblique);
  const logo = await doc.embedPng(base64ToBytes(LOGO_BASE64));

  const W = 595.28, H = 841.89, ML = 56, MR = 56, CW = W - ML - MR, TOP = H - 108, BOTTOM = 74;
  const c = report.content || {};
  const periodText = report.kind === 'mensal'
    ? `MÊS ${report.period_start.slice(5, 7)}/${report.period_start.slice(0, 4)}`
    : report.kind === 'semanal'
      ? `SEMANA ${br(report.period_start).slice(0, 5)} A ${br(report.period_end)}`
      : `PERÍODO ${br(report.period_start)} A ${br(report.period_end)}`;

  const pages: any[] = [];
  let page: any = null;
  let y = 0;

  const wrap = (text: string, f: any, size: number, maxW: number) => {
    const out: string[] = [];
    for (const para of clean(text).split('\n')) {
      const words = para.split(/\s+/).filter(Boolean);
      if (!words.length) { out.push(''); continue; }
      let line = '';
      for (let w of words) {
        while (f.widthOfTextAtSize(w, size) > maxW) {
          let i = w.length;
          while (i > 1 && f.widthOfTextAtSize(w.slice(0, i), size) > maxW) i--;
          if (line) { out.push(line); line = ''; }
          out.push(w.slice(0, i));
          w = w.slice(i);
        }
        const test = line ? `${line} ${w}` : w;
        if (f.widthOfTextAtSize(test, size) <= maxW) line = test;
        else { if (line) out.push(line); line = w; }
      }
      if (line) out.push(line);
    }
    return out;
  };

  const newPage = () => { page = doc.addPage([W, H]); pages.push(page); y = TOP; };
  const ensure = (h: number) => { if (y - h < BOTTOM) newPage(); };

  // ---------- CAPA ----------
  const cover = doc.addPage([W, H]);
  cover.drawRectangle({ x: 0, y: 0, width: W, height: H, color: rgb(0.74, 0.745, 0.745) });
  for (let k = 0; k < 34; k++) {
    const base = 40 + k * 13;
    let prev: { x: number; y: number } | null = null;
    for (let x = 0; x <= W; x += 8) {
      const t = x / W;
      const yy = base + 24 * Math.sin(t * Math.PI * 2.4 + k * 0.17) + 14 * Math.sin(t * Math.PI * 1.1 + k * 0.09);
      if (yy < H * 0.5) {
        if (prev) cover.drawLine({ start: prev, end: { x, y: yy }, thickness: 0.7, color: rgb(0.55, 0.6, 0.59), opacity: 0.55 });
        prev = { x, y: yy };
      } else prev = null;
    }
  }
  const lw = 236, lh = (lw * 263) / 635;
  cover.drawImage(logo, { x: (W - lw) / 2, y: H - 130 - lh, width: lw, height: lh });
  const bx = 80, bw = W - 160, by = H / 2 - 10, bh = 92;
  cover.drawRectangle({ x: bx, y: by, width: bw, height: bh, color: INK, borderColor: GOLD, borderWidth: 2 });
  const t1 = 'RELATÓRIO';
  cover.drawText(clean(t1), { x: (W - bold.widthOfTextAtSize(t1, 40)) / 2, y: by + 32, size: 40, font: bold, color: rgb(1, 1, 1) });
  cover.drawRectangle({ x: bx, y: by - 38, width: bw, height: 32, borderColor: GOLD, borderWidth: 1.5, color: rgb(0.78, 0.785, 0.785) });
  const spaced = clean(periodText).split('').join(' ');
  const sp = 2.2;
  const spacedW = spaced.split('').reduce((a, ch) => a + bold.widthOfTextAtSize(ch, 11) + sp, 0);
  let cx = (W - spacedW) / 2;
  for (const ch of spaced.split('')) { cover.drawText(ch, { x: cx, y: by - 27, size: 11, font: bold, color: INK }); cx += bold.widthOfTextAtSize(ch, 11) + sp; }
  const defaultTitle = `Relatório ${report.kind} — ${br(report.period_start)} a ${br(report.period_end)}`;
  if (report.title && report.title !== defaultTitle) {
    const tl = wrap(report.title, bold, 13, bw);
    tl.slice(0, 3).forEach((ln, i) => cover.drawText(ln, { x: (W - bold.widthOfTextAtSize(ln, 13)) / 2, y: by - 72 - i * 17, size: 13, font: bold, color: INK }));
  }
  const issued = new Date();
  const issuedText = `Emitido em ${issued.getUTCDate()} de ${MONTHS[issued.getUTCMonth()]} de ${issued.getUTCFullYear()}  •  ${report.observation_count} observações analisadas`;
  cover.drawText(clean(issuedText), { x: (W - font.widthOfTextAtSize(clean(issuedText), 9)) / 2, y: 54, size: 9, font, color: rgb(0.25, 0.28, 0.3) });

  // ---------- BLOCOS DE TEXTO ----------
  let sectionNo = 0;
  const section = (title: string) => {
    ensure(70);
    sectionNo += 1;
    y -= 14;
    page.drawText(clean(`${sectionNo}. ${title}`), { x: ML, y, size: 13, font: bold, color: INK });
    y -= 6;
    page.drawLine({ start: { x: ML, y }, end: { x: ML + 44, y }, thickness: 2, color: GREEN });
    y -= 16;
  };
  const para = (text: string, opts: { size?: number; f?: any; color?: any; indent?: number; gap?: number } = {}) => {
    const size = opts.size ?? 10.5, f = opts.f ?? font, lh = size * 1.5, indent = opts.indent ?? 0;
    for (const ln of wrap(text, f, size, CW - indent)) {
      ensure(lh);
      if (ln) page.drawText(ln, { x: ML + indent, y: y - size, size, font: f, color: opts.color ?? TEXT });
      y -= lh;
    }
    y -= opts.gap ?? 4;
  };
  const bullets = (items: string[], size = 10.5) => {
    for (const item of items) {
      const lines = wrap(item, font, size, CW - 16);
      ensure(size * 1.5 * Math.min(lines.length, 2));
      page.drawCircle({ x: ML + 4, y: y - size * 0.62, size: 1.7, color: GREEN });
      for (const ln of lines) { ensure(size * 1.5); page.drawText(ln, { x: ML + 16, y: y - size, size, font, color: TEXT }); y -= size * 1.5; }
      y -= 2;
    }
    y -= 4;
  };

  newPage();

  // 1. Apresentação
  section('APRESENTAÇÃO');
  para(c.resumo_executivo || 'Sem resumo.');
  if (c.aviso) para(`Aviso: ${c.aviso}`, { size: 9, f: italic, color: MUTED });

  // Tabela de categorias
  const counts: Record<string, number> = c.contagem_por_categoria || {};
  const entries = Object.entries(counts).sort((a, b) => Number(b[1]) - Number(a[1]));
  const total = entries.reduce((s, [, v]) => s + Number(v), 0);
  if (entries.length) {
    ensure(60 + entries.length * 24);
    para('TABELA 1 – OBSERVAÇÕES POR CATEGORIA', { size: 9, f: bold, color: INK, gap: 6 });
    const cols = [CW * 0.5, CW * 0.25, CW * 0.25];
    const row = (cells: string[], head: boolean, fill: any) => {
      ensure(24);
      let x = ML;
      cells.forEach((cell, i) => {
        page.drawRectangle({ x, y: y - 22, width: cols[i] - 3, height: 22, color: fill, borderColor: head ? INK : LINE, borderWidth: 0.6 });
        const f = head ? bold : font, sz = head ? 8.5 : 9.5;
        const txt = clean(cell);
        const tw = f.widthOfTextAtSize(txt, sz);
        page.drawText(txt, { x: i === 0 ? x + 8 : x + (cols[i] - 3 - tw) / 2, y: y - 15, size: sz, font: f, color: head ? rgb(1, 1, 1) : TEXT });
        x += cols[i];
      });
      y -= 24;
    };
    row(['CATEGORIA', 'OBSERVAÇÕES', 'PARTICIPAÇÃO'], true, INK);
    entries.forEach(([k, v]) => row([k, String(v), `${total ? Math.round((Number(v) / total) * 100) : 0}%`], false, SOFT));
    row(['TOTAL', String(total), '100%'], true, INK);
    y -= 8;

    // Gráfico de barras
    const rowH = 22;
    ensure(40 + entries.length * rowH);
    para('GRÁFICO 1 – DISTRIBUIÇÃO DAS OBSERVAÇÕES POR CATEGORIA', { size: 9, f: bold, color: INK, gap: 8 });
    const max = Math.max(...entries.map(([, v]) => Number(v)), 1);
    const labelW = 120, barMax = CW - labelW - 70;
    entries.forEach(([k, v]) => {
      ensure(rowH);
      const lab = wrap(k, font, 9, labelW - 8)[0] || '';
      page.drawText(lab, { x: ML, y: y - 13, size: 9, font, color: TEXT });
      const w = Math.max(3, (Number(v) / max) * barMax);
      page.drawRectangle({ x: ML + labelW, y: y - 17, width: w, height: 14, color: GREEN });
      page.drawText(clean(`${v} (${total ? Math.round((Number(v) / total) * 100) : 0}%)`), { x: ML + labelW + w + 6, y: y - 13, size: 9, font: bold, color: INK });
      y -= rowH;
    });
    y -= 6;
  }

  if (c.destaques?.length) { section('DESTAQUES DO PERÍODO'); bullets(c.destaques); }
  if (c.pontos_de_atencao?.length) { section('PONTOS DE ATENÇÃO'); bullets(c.pontos_de_atencao); }

  if (c.solucoes?.length) {
    section('POSSÍVEIS SOLUÇÕES');
    para('Sugestões elaboradas por IA a partir dos problemas registrados nas observações. Devem ser validadas pela gestão antes da aplicação.', { size: 9, f: italic, color: MUTED, gap: 8 });
    for (const s of c.solucoes) {
      const head = wrap(`${s.problema}`, bold, 10.5, CW - 110);
      ensure(30 + head.length * 15);
      page.drawRectangle({ x: ML, y: y - 3 - head.length * 15, width: 3, height: head.length * 15 + 3, color: GOLD });
      head.forEach((ln, i) => page.drawText(ln, { x: ML + 10, y: y - 11 - i * 15, size: 10.5, font: bold, color: INK }));
      if (s.prioridade) {
        const tag = clean(`Prioridade ${PRIO[s.prioridade] || s.prioridade}`);
        page.drawText(tag, { x: W - MR - font.widthOfTextAtSize(tag, 8.5), y: y - 10, size: 8.5, font: bold, color: s.prioridade === 'alta' ? rgb(0.75, 0.2, 0.2) : s.prioridade === 'baixa' ? GREEN : rgb(0.7, 0.5, 0.05) });
      }
      y -= head.length * 15 + 8;
      bullets(s.solucoes || [], 10);
    }
  }

  if (c.por_categoria?.length) {
    section('ANÁLISE POR CATEGORIA');
    for (const item of c.por_categoria) {
      ensure(44);
      page.drawText(clean(item.categoria), { x: ML, y: y - 11, size: 11, font: bold, color: GREEN });
      y -= 18;
      para(item.resumo || '', { size: 10, gap: 10 });
    }
  }

  if (c.proximos_passos?.length) {
    section('PLANO DE AÇÃO E PRÓXIMOS PASSOS');
    c.proximos_passos.forEach((step: string, i: number) => {
      const lines = wrap(step, font, 10.5, CW - 22);
      ensure(16 * Math.min(lines.length, 2));
      page.drawText(`${i + 1}.`, { x: ML, y: y - 10.5, size: 10.5, font: bold, color: GREEN });
      lines.forEach((ln) => { ensure(16); page.drawText(ln, { x: ML + 22, y: y - 10.5, size: 10.5, font, color: TEXT }); y -= 16; });
      y -= 3;
    });
    y -= 4;
  }

  if (c.observacoes_incluidas?.length) {
    section(`REGISTROS CONSIDERADOS (${c.observacoes_incluidas.length})`);
    const cw = [64, 92, CW - 156];
    for (const o of c.observacoes_incluidas) {
      const tl = wrap(o.titulo || '', font, 9, cw[2] - 6);
      const h = Math.max(1, tl.length) * 12 + 8;
      ensure(h);
      page.drawText(clean(br(o.data)), { x: ML, y: y - 11, size: 9, font, color: MUTED });
      page.drawText(clean(wrap(o.categoria || '', bold, 9, cw[1] - 6)[0] || ''), { x: ML + cw[0], y: y - 11, size: 9, font: bold, color: GREEN });
      tl.forEach((ln, i) => page.drawText(ln, { x: ML + cw[0] + cw[1], y: y - 11 - i * 12, size: 9, font, color: TEXT }));
      y -= h;
      page.drawLine({ start: { x: ML, y: y + 2 }, end: { x: W - MR, y: y + 2 }, thickness: 0.4, color: LINE });
    }
    y -= 8;
  }

  // Fechamento e assinatura
  ensure(150);
  y -= 16;
  para(`Relatório emitido em ${issued.getUTCDate()} de ${MONTHS[issued.getUTCMonth()]} de ${issued.getUTCFullYear()}.`, { gap: 2 });
  para('Relatório elaborado pelo sistema ELO — Grupo System Saúde.', { gap: 28 });
  const sigW = 230, sx = ML + (CW - sigW) / 2;
  page.drawLine({ start: { x: sx, y }, end: { x: sx + sigW, y }, thickness: 0.8, color: INK });
  y -= 14;
  const nm = clean(author?.name || 'Responsável pelo relatório');
  page.drawText(nm, { x: sx + (sigW - font.widthOfTextAtSize(nm, 10.5)) / 2, y, size: 10.5, font: bold, color: INK });
  y -= 14;
  const rl = clean(author?.role || '');
  if (rl) page.drawText(rl, { x: sx + (sigW - font.widthOfTextAtSize(rl, 9.5)) / 2, y, size: 9.5, font, color: MUTED });

  // ---------- CABEÇALHO E RODAPÉ (após saber o total de páginas) ----------
  const hl = 26, hw = (hl * 635) / 263;
  pages.forEach((p, i) => {
    p.drawImage(logo, { x: W - MR - hw, y: H - 30 - hl, width: hw, height: hl });
    p.drawText(clean(`RELATÓRIO ${KIND[report.kind] || ''}`), { x: ML, y: H - 46, size: 9.5, font: bold, color: INK });
    p.drawText(clean(`${br(report.period_start)} a ${br(report.period_end)}`), { x: ML, y: H - 59, size: 8.5, font, color: MUTED });
    p.drawLine({ start: { x: ML, y: H - 72 }, end: { x: W - MR, y: H - 72 }, thickness: 1.2, color: INK });
    p.drawLine({ start: { x: ML, y: 52 }, end: { x: W - MR, y: 52 }, thickness: 0.6, color: LINE });
    p.drawText('Grupo System Saúde  •  Documento gerado pelo sistema ELO', { x: ML, y: 36, size: 8, font, color: MUTED });
    const pn = `Página ${i + 1} de ${pages.length}`;
    p.drawText(pn, { x: W - MR - font.widthOfTextAtSize(pn, 8), y: 36, size: 8, font: bold, color: MUTED });
  });

  return await doc.save();
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
  if (!url || !anon) return json({ error: 'Configuração do Supabase incompleta na Edge Function.' }, 500);
  if (!auth) return json({ error: 'Sessão não encontrada.' }, 401);

  const userClient = createClient(url, anon, { global: { headers: { Authorization: auth } } });
  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user) return json({ error: 'Usuário não autenticado.' }, 401);

  const { data: canView } = await userClient.rpc('has_permission', { requested_module: 'relatorios', requested_action: 'view' });
  if (!canView) return json({ error: 'Você não tem permissão para visualizar relatórios.' }, 403);

  let payload: any;
  try { payload = await req.json(); } catch { return json({ error: 'JSON inválido.' }, 400); }
  if (!UUID.test(String(payload?.report_id || ''))) return json({ error: 'Relatório inválido.' }, 400);

  // Leitura com o token do usuário: as regras de acesso (RLS) continuam valendo.
  const { data: report, error: reportError } = await userClient.from('relatorios').select('*').eq('id', payload.report_id).maybeSingle();
  if (reportError) return json({ error: `Não foi possível carregar o relatório: ${reportError.message}` }, 500);
  if (!report) return json({ error: 'Relatório não encontrado.' }, 404);

  let author: { name: string; role: string } | null = null;
  if (secret) {
    try {
      const admin = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
      const { data: profile } = await admin.from('profiles').select('full_name,role').eq('id', report.created_by).maybeSingle();
      if (profile) author = { name: profile.full_name, role: ROLES[profile.role] || profile.role || '' };
    } catch { /* assinatura genérica */ }
  }

  try {
    const bytes = await buildPdf(report, author);
    const filename = `relatorio-${report.kind}-${report.period_start}-a-${report.period_end}.pdf`;
    return json({ success: true, filename, base64: bytesToBase64(bytes) });
  } catch (e) {
    console.error('Falha ao gerar PDF', e);
    return json({ error: `Falha ao gerar o PDF: ${e instanceof Error ? e.message : String(e)}` }, 500);
  }
});
