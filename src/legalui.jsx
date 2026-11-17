import React,{useEffect,useState} from 'react';
import {Ico} from './ico.jsx';
import {TERMS,POLICY,LEGAL_VERSION,LEGAL_UPDATED,LEGAL_NOTICE,LEGAL_PENDING,fillDoc} from './legal.js';

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
