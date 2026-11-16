import React,{useEffect,useRef,useState} from 'react';
import {supabase} from './supabaseClient.js';
import {Ico} from './ico.jsx';
import {TERMS,POLICY,LEGAL_VERSION,LEGAL_UPDATED,LEGAL_NOTICE,LEGAL_PENDING,fillDoc} from './legal.js';

/* ---------------- Política de senha (a mesma validada no servidor) ---------------- */
export const MIN_PASSWORD=10;
const COMMON=['senha','password','123456','qwerty','abcdef','admin','elo2026','mudar123','trocar123'];
export const passwordRules=(pw,{email='',name=''}={})=>{
 const low=String(pw).toLowerCase();const local=(String(email).split('@')[0]||'').toLowerCase();const first=(String(name).trim().split(/\s+/)[0]||'').toLowerCase();
 return [
  {ok:pw.length>=MIN_PASSWORD,text:`Pelo menos ${MIN_PASSWORD} caracteres`},
  {ok:/[A-Za-z]/.test(pw)&&/\d/.test(pw),text:'Letras e números'},
  {ok:!COMMON.some(c=>low.includes(c)),text:'Não ser uma senha comum'},
  {ok:!/(.)\1{3,}/.test(pw),text:'Sem o mesmo caractere repetido várias vezes'},
  {ok:!(local.length>=4&&low.includes(local))&&!(first.length>=4&&low.includes(first)),text:'Sem o seu nome ou e-mail'}
 ];
};
export const passwordProblem=(pw,ctx)=>{
 if(new TextEncoder().encode(pw).length>72)return 'A senha deve ter no máximo 72 caracteres.';
 const bad=passwordRules(pw,ctx).find(r=>!r.ok);
 return bad?`Senha fraca: ${bad.text.charAt(0).toLowerCase()+bad.text.slice(1)}.`:'';
};
export function PasswordMeter({password,email,name}){
 if(!password)return null;
 const rules=passwordRules(password,{email,name});const okCount=rules.filter(r=>r.ok).length;
 const score=okCount+(password.length>=12&&okCount===rules.length?1:0);
 return <div className="pwMeter" aria-live="polite"><div className="pwBar"><i className={score>=6?'strong':score>=5?'good':'weak'} style={{width:Math.round(score/6*100)+'%'}}/></div><ul>{rules.map(r=><li key={r.text} className={r.ok?'ok':''}>{r.ok?'✓':'•'} {r.text}</li>)}</ul></div>;
}

/* ---------------- Proteção contra tentativas repetidas (no aparelho) ---------------- */
const GUARD_KEY='elo_login_guard';
const readGuard=()=>{try{return JSON.parse(localStorage.getItem(GUARD_KEY)||'{}')}catch{return {}}};
export const lockRemaining=()=>Math.max(0,Math.ceil(((readGuard().lockedUntil||0)-Date.now())/1000));
export const registerFailure=()=>{try{const g=readGuard();const fails=(g.fails||0)+1;const lockedUntil=fails>=5?Date.now()+Math.min(900,30*Math.pow(2,fails-5))*1000:0;localStorage.setItem(GUARD_KEY,JSON.stringify({fails,lockedUntil}))}catch{}return lockRemaining()};
export const clearGuard=()=>{try{localStorage.removeItem(GUARD_KEY)}catch{}};
export const takeNotice=()=>{try{const n=sessionStorage.getItem('elo_notice');if(n)sessionStorage.removeItem('elo_notice');return n||''}catch{return ''}};
export const setNotice=t=>{try{sessionStorage.setItem('elo_notice',t)}catch{}};

/* ---------------- Mensagem de erro real das Edge Functions ---------------- */
export const readFnError=async(res,fallback='Não foi possível concluir a operação.')=>{
 try{if(res?.data?.error)return res.data.error;const ctx=res?.error?.context;if(ctx&&typeof ctx.clone==='function'){const b=await ctx.clone().json();if(b?.error)return b.error}}catch{}
 return fallback;
};

/* ---------------- Expiração de sessão por inatividade ---------------- */
export function useIdleLogout({minutes,warnSeconds=120,enabled,onTimeout}){
 const last=useRef(Date.now());const warnRef=useRef(false);const cb=useRef(onTimeout);cb.current=onTimeout;
 const [left,setLeft]=useState(null);
 useEffect(()=>{
  if(!enabled)return;last.current=Date.now();
  const bump=()=>{if(!warnRef.current)last.current=Date.now()};
  const evs=['mousemove','mousedown','keydown','touchstart','scroll','click'];
  evs.forEach(e=>window.addEventListener(e,bump,{passive:true}));
  const tick=()=>{
   const remain=Math.ceil(minutes*60-(Date.now()-last.current)/1000);
   if(remain<=0){warnRef.current=false;setLeft(null);cb.current&&cb.current();return}
   if(remain<=warnSeconds){warnRef.current=true;setLeft(remain)}else if(warnRef.current){warnRef.current=false;setLeft(null)}
  };
  const id=setInterval(tick,1000);const vis=()=>{if(document.visibilityState==='visible')tick()};
  document.addEventListener('visibilitychange',vis);
  return()=>{evs.forEach(e=>window.removeEventListener(e,bump));clearInterval(id);document.removeEventListener('visibilitychange',vis)};
 },[enabled,minutes,warnSeconds]);
 const stay=()=>{last.current=Date.now();warnRef.current=false;setLeft(null)};
 return {left,stay};
}
export function IdleWarning({left,onStay,onLeave}){
 if(left===null)return null;
 const m=Math.floor(left/60),s=String(left%60).padStart(2,'0');
 return <div className="modalWrap" role="alertdialog" aria-modal="true" aria-labelledby="idleTitle"><div className="modal idleBox"><p className="eyebrow">SEGURANÇA</p><h2 id="idleTitle">Sua sessão vai expirar</h2><p className="secText">Por inatividade, você será desconectado em <b>{m}:{s}</b>.</p><div className="formActions"><button className="filter" onClick={onLeave}>Sair agora</button><button className="primary" onClick={onStay} autoFocus>Continuar conectado</button></div></div></div>;
}

/* ---------------- Verificação em duas etapas ---------------- */
export function MfaChallenge({onVerified,onCancel}){
 const [factorId,setFactorId]=useState('');const [code,setCode]=useState('');const [err,setErr]=useState('');const [busy,setBusy]=useState(false);const [wait,setWait]=useState(0);const fails=useRef(0);
 useEffect(()=>{(async()=>{try{const {data}=await supabase.auth.mfa.listFactors();const f=(data?.totp||[])[0];if(f)setFactorId(f.id);else setErr('Nenhum método de verificação encontrado. Saia e entre novamente.')}catch{setErr('Não foi possível iniciar a verificação.')}})()},[]);
 useEffect(()=>{if(wait<=0)return;const t=setTimeout(()=>setWait(w=>w-1),1000);return()=>clearTimeout(t)},[wait]);
 const verify=async e=>{
  e.preventDefault();if(wait>0||!factorId)return;setBusy(true);setErr('');
  const {error}=await supabase.auth.mfa.challengeAndVerify({factorId,code:code.replace(/\s/g,'')});
  setBusy(false);
  if(error){fails.current+=1;setCode('');setErr('Código inválido ou expirado. Confira o aplicativo autenticador.');if(fails.current>=5){setWait(30);fails.current=0}return}
  onVerified();
 };
 return <div className="loginPage"><div className="loginGlow"></div><div className="loginCard"><div className="mfaIcon"><Ico name="shield" size={30}/></div><div className="loginIntro"><h1>Verificação em duas etapas</h1><p>Digite o código de 6 dígitos do seu aplicativo autenticador.</p></div>
  <form onSubmit={verify}><label>Código<input value={code} onChange={e=>setCode(e.target.value.replace(/[^\d ]/g,'').slice(0,7))} inputMode="numeric" autoComplete="one-time-code" maxLength={7} placeholder="000000" autoFocus required className="mfaCode"/></label>
   {err&&<div className="errorBox">{err}</div>}{wait>0&&<div className="errorBox">Muitas tentativas. Aguarde {wait}s.</div>}
   <button className="primary loginButton" disabled={busy||wait>0||code.replace(/\s/g,'').length<6||!factorId}>{busy?'Verificando…':'Verificar e entrar'}</button>
   <button type="button" className="textLink" onClick={onCancel}>Cancelar e sair</button></form>
  <p className="loginFooter">Perdeu o acesso ao autenticador? Procure o administrador do ELO.</p></div></div>;
}
export function useMfaStatus(enabled){
 const [st,setSt]=useState({loaded:false,hasFactor:false});
 const reload=async()=>{try{const {data}=await supabase.auth.mfa.listFactors();setSt({loaded:true,hasFactor:!!(data?.totp||[]).length})}catch{setSt({loaded:true,hasFactor:false})}};
 useEffect(()=>{if(enabled)reload()},[enabled]);
 return {...st,reload};
}

/* ---------------- Documentos legais ---------------- */
export function LegalDoc({doc}){
 const d=fillDoc(doc);
 return <article className="legalBody"><h2>{d.title}</h2><p className="legalSub">{d.subtitle} · versão {LEGAL_VERSION} · {LEGAL_UPDATED}</p>
  {d.intro.map((p,i)=><p key={i}>{p}</p>)}
  {d.sections.map(s=><section key={s.h}><h3>{s.h}</h3>{s.p.map((p,i)=><p key={i}>{p}</p>)}{s.ul.length>0&&<ul>{s.ul.map((u,i)=><li key={i}>{u}</li>)}</ul>}
   {s.table&&<div className="legalTableWrap"><table className="legalTable"><thead><tr>{s.table.head.map(h=><th key={h}>{h}</th>)}</tr></thead><tbody>{s.table.rows.map((r,i)=><tr key={i}>{r.map((c,j)=><td key={j}>{c}</td>)}</tr>)}</tbody></table></div>}</section>)}</article>;
}
export function LegalModal({initial='terms',onClose}){
 const [tab,setTab]=useState(initial);
 useEffect(()=>{const k=e=>{if(e.key==='Escape')onClose()};window.addEventListener('keydown',k);document.body.classList.add('printing-legal');return()=>{window.removeEventListener('keydown',k);document.body.classList.remove('printing-legal')}},[]);
 return <div className="modalWrap legalWrap" role="dialog" aria-modal="true"><div className="modal legalModal"><div className="modalHead"><div><p className="eyebrow">TRANSPARÊNCIA</p><h2>Termos e segurança</h2></div><button onClick={onClose} aria-label="Fechar"><Ico name="close" size={18}/></button></div>
  <div className="legalTabs"><button className={tab==='terms'?'active':''} onClick={()=>setTab('terms')}>Termos de Uso</button><button className={tab==='policy'?'active':''} onClick={()=>setTab('policy')}>Segurança e Privacidade</button><button className="legalPrintBtn" onClick={()=>window.print()}>⎙ Imprimir / PDF</button></div>
  <div className="legalScroll legalPrint">{LEGAL_PENDING&&<p className="legalNotice">{LEGAL_NOTICE}</p>}<LegalDoc doc={tab==='terms'?TERMS:POLICY}/></div></div></div>;
}
export function TermsGate({userId,onSignOut}){
 const [state,setState]=useState('loading');const [tab,setTab]=useState('terms');const [agree,setAgree]=useState(false);const [busy,setBusy]=useState(false);const [msg,setMsg]=useState('');
 useEffect(()=>{(async()=>{
  try{const {data,error}=await supabase.from('termos_aceites').select('id').eq('user_id',userId).eq('version',LEGAL_VERSION).maybeSingle();
   if(error){setState('ok');return}   // tabela ainda não criada: não bloqueia o uso
   setState(data?'ok':'needed')}catch{setState('ok')}
 })()},[userId]);
 if(state!=='needed')return null;
 const accept=async()=>{setBusy(true);setMsg('');
  const {error}=await supabase.from('termos_aceites').insert({user_id:userId,version:LEGAL_VERSION,user_agent:String(navigator.userAgent||'').slice(0,250)});
  setBusy(false);
  if(error&&error.code!=='23505'){setMsg('Não foi possível registrar o aceite. Tente novamente.');return}
  setState('ok');
 };
 return <div className="modalWrap legalWrap" role="dialog" aria-modal="true" aria-labelledby="termsTitle"><div className="modal legalModal"><div className="modalHead"><div><p className="eyebrow">ACEITE NECESSÁRIO</p><h2 id="termsTitle">Termos de Uso e Política de Segurança</h2><span>Leia e aceite para continuar usando o ELO.</span></div></div>
  <div className="legalTabs"><button className={tab==='terms'?'active':''} onClick={()=>setTab('terms')}>Termos de Uso</button><button className={tab==='policy'?'active':''} onClick={()=>setTab('policy')}>Segurança e Privacidade</button></div>
  <div className="legalScroll"><LegalDoc doc={tab==='terms'?TERMS:POLICY}/></div>
  <div className="legalAccept"><label className="legalCheck"><input type="checkbox" checked={agree} onChange={e=>setAgree(e.target.checked)}/><span>Li e aceito os Termos de Uso e a Política de Segurança e Privacidade (versão {LEGAL_VERSION}).</span></label>{msg&&<div className="notice">{msg}</div>}
   <div className="formActions"><button className="filter" onClick={onSignOut}>Sair</button><button className="primary" disabled={!agree||busy} onClick={accept}>{busy?'Registrando…':'Aceitar e continuar'}</button></div></div></div></div>;
}

/* ---------------- Auditoria (somente administradores) ---------------- */
function AuditSection(){
 const [rows,setRows]=useState(null);const [err,setErr]=useState('');
 useEffect(()=>{(async()=>{const {data,error}=await supabase.from('audit_log').select('id,at,actor_name,action,table_name,record_id').order('at',{ascending:false}).limit(100);if(error)setErr('Registro de auditoria indisponível. Execute o SQL de segurança no Supabase.');else setRows(data||[])})()},[]);
 const label={INSERT:'Criou',UPDATE:'Alterou',DELETE:'Excluiu',CREATE_USER:'Criou usuário'};
 return <div className="secBlock"><h4>Registro de auditoria</h4><p className="secText">Últimos 100 eventos sensíveis (criação de usuários, permissões, exclusões e notas).</p>
  {err&&<div className="notice">{err}</div>}{!err&&rows===null&&<div className="emptyState">Carregando…</div>}{rows&&!rows.length&&<div className="emptyState">Nenhum evento registrado ainda.</div>}
  {rows&&rows.length>0&&<div className="auditWrap"><table className="auditTable"><thead><tr><th>Quando</th><th>Quem</th><th>Ação</th><th>Onde</th></tr></thead><tbody>{rows.map(r=><tr key={r.id}><td>{new Date(r.at).toLocaleString('pt-BR')}</td><td>{r.actor_name||'Sistema'}</td><td>{label[r.action]||r.action}</td><td>{r.table_name}</td></tr>)}</tbody></table></div>}</div>;
}

/* ---------------- Central de segurança da conta ---------------- */
export function SecurityCenter({session,profile,mfa,onClose,onOpenLegal}){
 const [pw,setPw]=useState('');const [pw2,setPw2]=useState('');const [msg,setMsg]=useState('');const [err,setErr]=useState('');const [busy,setBusy]=useState(false);
 const [factors,setFactors]=useState([]);const [enroll,setEnroll]=useState(null);const [code,setCode]=useState('');
 const email=session?.user?.email||'';const isAdmin=profile?.role==='administrador';
 const loadFactors=async()=>{try{const {data}=await supabase.auth.mfa.listFactors();setFactors(data?.totp||[])}catch{setFactors([])}mfa&&mfa.reload&&mfa.reload()};
 useEffect(()=>{loadFactors()},[]);
 useEffect(()=>{const k=e=>{if(e.key==='Escape'&&!enroll)onClose()};window.addEventListener('keydown',k);return()=>window.removeEventListener('keydown',k)},[enroll]);
 const flash=(m,e='')=>{setMsg(m);setErr(e)};
 const changePassword=async e=>{e.preventDefault();flash('');
  const p=passwordProblem(pw,{email,name:profile?.full_name});if(p){flash('',p);return}
  if(pw!==pw2){flash('','As senhas não correspondem.');return}
  setBusy(true);const {error}=await supabase.auth.updateUser({password:pw});setBusy(false);
  if(error){flash('','Não foi possível alterar a senha. Saia, entre novamente e tente de novo.');return}
  setPw('');setPw2('');flash('Senha alterada com sucesso.');
 };
 const startEnroll=async()=>{flash('');setBusy(true);
  const {data,error}=await supabase.auth.mfa.enroll({factorType:'totp',issuer:'ELO',friendlyName:`ELO ${new Date().toLocaleDateString('pt-BR')} ${Math.random().toString(36).slice(2,6)}`});
  setBusy(false);if(error||!data){flash('','Não foi possível iniciar a ativação. Tente novamente.');return}
  setEnroll({id:data.id,qr:data.totp.qr_code,secret:data.totp.secret});setCode('');
 };
 const confirmEnroll=async e=>{e.preventDefault();flash('');setBusy(true);
  const {error}=await supabase.auth.mfa.challengeAndVerify({factorId:enroll.id,code:code.replace(/\s/g,'')});setBusy(false);
  if(error){flash('','Código incorreto. Confira o aplicativo e tente novamente.');setCode('');return}
  setEnroll(null);await loadFactors();flash('Verificação em duas etapas ativada. Ela será exigida nos próximos acessos.');
 };
 const cancelEnroll=async()=>{try{await supabase.auth.mfa.unenroll({factorId:enroll.id})}catch{}setEnroll(null);setCode('')};
 const disable=async f=>{
  if(!confirm('Desativar a verificação em duas etapas? Sua conta ficará menos protegida.'))return;
  setBusy(true);const {error}=await supabase.auth.mfa.unenroll({factorId:f.id});setBusy(false);
  if(error){flash('','Não foi possível desativar. Entre novamente e tente de novo.');return}
  await loadFactors();flash('Verificação em duas etapas desativada.');
 };
 const signOutAll=async()=>{if(!confirm('Encerrar a sessão em TODOS os dispositivos, inclusive este?'))return;await supabase.auth.signOut({scope:'global'})};
 return <div className="modalWrap" role="dialog" aria-modal="true" aria-labelledby="secTitle"><div className="modal secModal"><div className="modalHead"><div><p className="eyebrow">CONTA</p><h2 id="secTitle">Segurança da conta</h2><span>{email} · {profile?.role||''}</span></div><button onClick={onClose} aria-label="Fechar"><Ico name="close" size={18}/></button></div>
  {msg&&<div className="notice">{msg}</div>}{err&&<div className="notice warn">{err}</div>}
  <div className="secBlock"><h4>Verificação em duas etapas (2FA)</h4>
   <p className="secText">Adiciona um código temporário do seu celular ao login. {factors.length?<b>Está ativada.</b>:<><b>Não está ativada.</b> Recomendado para todos e indispensável para administradores e gestores.</>}</p>
   {!enroll&&!factors.length&&<button className="primary" onClick={startEnroll} disabled={busy}>Ativar verificação em duas etapas</button>}
   {!enroll&&factors.map(f=><div className="factorRow" key={f.id}><span><Ico name="shield" size={16}/> {f.friendly_name||'Aplicativo autenticador'}</span><button className="filter" onClick={()=>disable(f)} disabled={busy}>Desativar</button></div>)}
   {enroll&&<form onSubmit={confirmEnroll} className="enrollBox"><ol className="secSteps"><li>Instale um aplicativo autenticador (Google Authenticator, Microsoft Authenticator, Authy…).</li><li>Escaneie o QR Code ou digite a chave manualmente.</li><li>Informe o código de 6 dígitos gerado.</li></ol>
    <div className="qrRow"><img className="qrBox" src={enroll.qr} alt="QR Code para o aplicativo autenticador" width="170" height="170"/><div><small>Chave manual</small><code className="secretKey">{enroll.secret}</code></div></div>
    <label>Código de 6 dígitos<input value={code} onChange={e=>setCode(e.target.value.replace(/[^\d ]/g,'').slice(0,7))} inputMode="numeric" autoComplete="one-time-code" placeholder="000000" required/></label>
    <div className="formActions"><button type="button" className="filter" onClick={cancelEnroll}>Cancelar</button><button className="primary" disabled={busy||code.replace(/\s/g,'').length<6}>{busy?'Verificando…':'Confirmar e ativar'}</button></div></form>}</div>
  <div className="secBlock"><h4>Alterar senha</h4><form onSubmit={changePassword}><label>Nova senha<input type="password" value={pw} onChange={e=>setPw(e.target.value)} autoComplete="new-password" required/></label><PasswordMeter password={pw} email={email} name={profile?.full_name}/><label>Confirmar nova senha<input type="password" value={pw2} onChange={e=>setPw2(e.target.value)} autoComplete="new-password" required/></label><div className="formActions"><button className="primary" disabled={busy||!pw}>Alterar senha</button></div></form></div>
  <div className="secBlock"><h4>Sessões</h4><p className="secText">Se perdeu um aparelho ou suspeita de acesso indevido, encerre todas as sessões e troque a senha.</p><button className="filter" onClick={signOutAll}>Encerrar sessão em todos os dispositivos</button></div>
  <div className="secBlock"><h4>Documentos</h4><div className="formActions left"><button className="filter" onClick={()=>onOpenLegal('terms')}>Termos de Uso</button><button className="filter" onClick={()=>onOpenLegal('policy')}>Política de Segurança e Privacidade</button></div></div>
  {isAdmin&&<AuditSection/>}</div></div>;
}
