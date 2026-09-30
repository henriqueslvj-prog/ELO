import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = { 'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type' };
const json = (body: unknown, status=200) => new Response(JSON.stringify(body), { status, headers:{...cors,'Content-Type':'application/json'} });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  let attendance_id = '';
  try {
    const body = await req.json();
    attendance_id = body?.attendance_id || '';
    if (!attendance_id) return json({error:'attendance_id é obrigatório'},400);
    const url=Deno.env.get('SUPABASE_URL')!;
    const service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const key=Deno.env.get('GEMINI_API_KEY');
    if(!key) return json({error:'GEMINI_API_KEY não configurada nos secrets da Edge Function.'},500);
    const db=createClient(url,service);
    const {data:att,error:ae}=await db.from('destaque_atendimentos').select('*, destaque_ciclos(*), profiles:employee_id(id,full_name)').eq('id',attendance_id).single();
    if(ae||!att) return json({error:ae?.message||'Atendimento não encontrado.'},404);
    await db.from('destaque_atendimentos').update({status:'analisando',error_message:null}).eq('id',attendance_id);
    const {data:criteria,error:ce}=await db.from('destaque_criterios').select('id,name,description,weight,min_score,required').eq('active',true).eq('source','ia').order('created_at',{ascending:true});
    if(ce) throw ce;
    if(!criteria?.length){throw new Error('Nenhum critério ativo com fonte IA foi configurado.');}
    const fileRes=await db.storage.from('destaque-atendimentos').download(att.storage_path);
    if(fileRes.error||!fileRes.data) throw new Error(fileRes.error?.message||'Não foi possível ler o PDF.');
    const bytes=new Uint8Array(await fileRes.data.arrayBuffer());
    const upload=await fetch(`https://generativelanguage.googleapis.com/upload/v1beta/files?key=${encodeURIComponent(key)}`,{method:'POST',headers:{'X-Goog-Upload-Protocol':'raw','X-Goog-Upload-Command':'upload','X-Goog-Upload-Header-Content-Length':String(bytes.byteLength),'X-Goog-Upload-Header-Content-Type':'application/pdf','Content-Type':'application/pdf'},body:bytes});
    if(!upload.ok) throw new Error(`Gemini upload: ${await upload.text()}`);
    const uploaded=await upload.json();
    const fileName=uploaded.file?.name || uploaded.name;
    const fileUri=uploaded.file?.uri || uploaded.uri;
    if(!fileUri) throw new Error('O Gemini não retornou a URI do arquivo.');
    if(fileName){
      for(let i=0;i<10;i++){
        const fr=await fetch(`https://generativelanguage.googleapis.com/v1beta/${fileName}?key=${encodeURIComponent(key)}`);
        if(fr.ok){ const fd=await fr.json(); const state=fd.state || fd.file?.state; if(state==='ACTIVE') break; if(state==='FAILED') throw new Error('O Gemini não conseguiu processar o PDF.'); }
        await new Promise(r=>setTimeout(r,1200));
      }
    }
    const prompt=`Você é o avaliador de qualidade do ELO. Analise exclusivamente o atendimento contido no PDF. Não invente fatos. Para cada critério, dê uma nota de 0 a 10 e justifique com evidências observáveis. Se o PDF não permitir avaliar algum critério, use null e explique. Retorne SOMENTE JSON válido no formato {"criterios":[{"criterion_id":"...","score":8.5,"justification":"...","evidence":["..."]}],"resumo":"..."}. Critérios: ${JSON.stringify(criteria)}`;
    const gen=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(key)}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({contents:[{parts:[{text:prompt},{file_data:{mime_type:'application/pdf',file_uri:fileUri}}]}],generationConfig:{responseMimeType:'application/json',temperature:0.1}})});
    if(!gen.ok) throw new Error(`Gemini análise: ${await gen.text()}`);
    const gd=await gen.json();
    const text=gd.candidates?.[0]?.content?.parts?.find((p:any)=>p.text)?.text;
    if(!text) throw new Error('A IA não retornou uma resposta válida.');
    const analysis=JSON.parse(text.replace(/^```json\s*/,'').replace(/\s*```$/,''));
    await db.from('destaque_atendimentos').update({status:'analisado',analysis,analyzed_at:new Date().toISOString()}).eq('id',attendance_id);
    return json({ok:true,analysis});
  } catch (e) {
    try { if(attendance_id){ const db=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!); await db.from('destaque_atendimentos').update({status:'erro',error_message:e instanceof Error?e.message:'Erro desconhecido'}).eq('id',attendance_id); } } catch {}
    return json({error:e instanceof Error?e.message:'Erro inesperado.'},500);
  }
});
