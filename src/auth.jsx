import React,{useEffect,useState} from 'react';
import {Ico} from './ico.jsx';
import {LegalModal} from './legalui.jsx';
import markAlpha from './assets/elo-mark-alpha.png';

/* ---------- Arte da identidade ELO: elos de vidro (conexão entre pessoas, processos e resultados) ---------- */
export function LoginArt(){
 return <svg className="lgArtSvg" viewBox="0 0 1000 1200" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
  <defs>
   <linearGradient id="lgBg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#020f0b"/><stop offset=".5" stopColor="#05311f"/><stop offset="1" stopColor="#0b7a52"/></linearGradient>
   <radialGradient id="lgG1" cx=".82" cy=".10" r=".75"><stop offset="0" stopColor="#34f0a8" stopOpacity=".55"/><stop offset="1" stopColor="#34f0a8" stopOpacity="0"/></radialGradient>
   <radialGradient id="lgG2" cx=".05" cy="1" r=".65"><stop offset="0" stopColor="#bff542" stopOpacity=".22"/><stop offset="1" stopColor="#bff542" stopOpacity="0"/></radialGradient>
   <linearGradient id="lgGlassA" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#f2fff9" stopOpacity=".78"/><stop offset=".42" stopColor="#6ff0bd" stopOpacity=".26"/><stop offset="1" stopColor="#d4f542" stopOpacity=".55"/></linearGradient>
   <linearGradient id="lgGlassB" x1="1" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ffffff" stopOpacity=".70"/><stop offset=".5" stopColor="#3fe3a6" stopOpacity=".24"/><stop offset="1" stopColor="#c5ffe6" stopOpacity=".55"/></linearGradient>
   <linearGradient id="lgRim" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#ffffff" stopOpacity=".95"/><stop offset="1" stopColor="#9dffd3" stopOpacity=".25"/></linearGradient>
   <filter id="lgSoft" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="26"/></filter>
   <filter id="lgGlow" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="9"/></filter>
   <filter id="lgGrain" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".85" numOctaves="2" seed="7"/><feColorMatrix values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 .55 0"/></filter>
   <path id="lgLink" d="M-270 -120 h380 a120 120 0 0 1 0 240 h-380 a120 120 0 0 1 0 -240 z"/>
  </defs>
  <rect width="1000" height="1200" fill="url(#lgBg)"/><rect width="1000" height="1200" fill="url(#lgG1)"/><rect width="1000" height="1200" fill="url(#lgG2)"/>
  <g fill="#eafff6"><circle cx="140" cy="240" r="3" opacity=".7"/><circle cx="880" cy="640" r="2.4" opacity=".6"/><circle cx="220" cy="980" r="3.2" opacity=".5"/><circle cx="760" cy="150" r="2" opacity=".7"/><circle cx="90" cy="610" r="2" opacity=".5"/><circle cx="930" cy="1010" r="3" opacity=".5"/></g>
  <g className="lgFloat3"><g transform="translate(880 280) rotate(-38) scale(1.25)" opacity=".55"><use href="#lgLink" fill="none" stroke="url(#lgGlassB)" strokeWidth="120"/><use href="#lgLink" fill="none" stroke="#021a13" strokeOpacity=".35" strokeWidth="80"/></g></g>
  <g className="lgFloat1"><g transform="translate(610 560) rotate(-38) scale(1.12)">
   <use href="#lgLink" fill="none" stroke="#00110c" strokeOpacity=".55" strokeWidth="130" filter="url(#lgSoft)" transform="translate(30 46)"/>
   <use href="#lgLink" fill="none" stroke="url(#lgGlassA)" strokeWidth="128" strokeLinejoin="round"/>
   <use href="#lgLink" fill="none" stroke="#021a13" strokeOpacity=".45" strokeWidth="88"/>
   <use href="#lgLink" fill="none" stroke="url(#lgRim)" strokeWidth="3.5" transform="translate(-33 -33)"/>
   <use href="#lgLink" fill="none" stroke="#d4f542" strokeOpacity=".75" strokeWidth="2.5" transform="translate(32 32)" filter="url(#lgGlow)"/>
   <use href="#lgLink" fill="none" stroke="#e6ff7a" strokeOpacity=".7" strokeWidth="2" transform="translate(32 32)"/></g></g>
  <g className="lgFloat2"><g transform="translate(330 880) rotate(-38) scale(1.12)">
   <use href="#lgLink" fill="none" stroke="#00110c" strokeOpacity=".55" strokeWidth="130" filter="url(#lgSoft)" transform="translate(30 46)"/>
   <use href="#lgLink" fill="none" stroke="url(#lgGlassB)" strokeWidth="128" strokeLinejoin="round"/>
   <use href="#lgLink" fill="none" stroke="#021a13" strokeOpacity=".45" strokeWidth="88"/>
   <use href="#lgLink" fill="none" stroke="url(#lgRim)" strokeWidth="3.5" transform="translate(-33 -33)"/>
   <use href="#lgLink" fill="none" stroke="#7dffc8" strokeOpacity=".6" strokeWidth="2" transform="translate(32 32)"/></g></g>
  <rect width="1000" height="1200" filter="url(#lgGrain)" opacity=".09"/>
 </svg>;
}

/* ---------- Tema da tela de acesso (compartilha a preferência do app) ---------- */
const readTheme=()=>{try{const t=localStorage.getItem('elo_theme');if(t==='light'||t==='dark')return t}catch{}try{return window.matchMedia&&window.matchMedia('(prefers-color-scheme: light)').matches?'light':'dark'}catch{return 'dark'}};
export function useAuthTheme(){
 const [theme,setTheme]=useState(readTheme);
 useEffect(()=>{const m=document.querySelector('meta[name="theme-color"]');if(m)m.setAttribute('content',theme==='light'?'#f1f4f2':'#0b0e12');document.documentElement.style.background=theme==='light'?'#f1f4f2':'#0b0e12'},[theme]);
 const toggle=()=>setTheme(t=>{const n=t==='light'?'dark':'light';try{localStorage.setItem('elo_theme',n)}catch{}return n});
 return [theme,toggle];
}

/* ---------- Estrutura única das telas de acesso (login, recuperação, 2FA) ---------- */
export function AuthShell({children,icon='login',title,subtitle,showAccess}){
 const [theme,toggle]=useAuthTheme();const [legal,setLegal]=useState(null);
 return <div className={'lg'+(theme==='light'?' light':'')}>
  <aside className="lgArt" aria-hidden="true"><LoginArt/>
   <div className="lgArtTop"><img src={markAlpha} alt="" width="46" height="30"/><b>ELO</b></div>
   <div className="lgArtCopy"><p className="lgKicker">Gestão • Organização • Resultados</p><h2>Pessoas, processos e resultados — <em>conectados.</em></h2><p className="lgLead">Demandas, avaliações com IA e relatórios executivos em um só lugar, com a segurança que o seu time precisa.</p><ul className="lgChips"><li>Demandas e solicitações</li><li>Destaques com IA</li><li>Relatórios em PDF</li></ul></div>
  </aside>
  <main className="lgPanel">
   <button type="button" className="lgTheme" onClick={toggle} aria-label={theme==='light'?'Ativar tema escuro':'Ativar tema claro'} title={theme==='light'?'Tema escuro':'Tema claro'}><Ico name={theme==='light'?'moon':'sun'} size={17}/></button>
   <div className="lgMobileBrand"><img src={markAlpha} alt="" width="38" height="25"/><b>ELO</b></div>
   <div className="lgForm"><div className="lgIcon"><Ico name={icon} size={22}/></div><h1 className="lgTitle">{title}</h1>{subtitle&&<p className="lgSub">{subtitle}</p>}{children}</div>
   <footer className="lgFoot"><div className="lgFootBrand"><img src={markAlpha} alt="" width="26" height="17"/><b>ELO</b><span>© {new Date().getFullYear()} · Acesso restrito a usuários autorizados</span></div>
    <div className="lgFootLinks"><span className="lgSecure"><Ico name="lock" size={13}/> Conexão protegida</span><button type="button" onClick={()=>setLegal('terms')}>Termos de Uso</button><button type="button" onClick={()=>setLegal('policy')}>Segurança e Privacidade</button></div></footer>
  </main>
  {legal&&<LegalModal initial={legal} onClose={()=>setLegal(null)}/>}
 </div>;
}

/* ---------- Campos com rótulo sobre a borda ---------- */
export function Field({label,id,className='',right,...props}){
 return <div className={'lgField '+className}><input id={id} {...props}/><label htmlFor={id}>{label}</label>{right}</div>;
}
export function PasswordField({label,id,className='',...props}){
 const [show,setShow]=useState(false);
 return <Field label={label} id={id} className={'hasEye '+className} type={show?'text':'password'} right={<button type="button" className="lgEye" onClick={()=>setShow(s=>!s)} aria-label={show?'Ocultar senha':'Mostrar senha'} aria-pressed={show}><Ico name={show?'eyeoff':'eye'} size={18}/></button>} {...props}/>;
}

/* ---------- Carregamento com a marca ---------- */
export function BrandLoader({text='Carregando…'}){
 const [theme]=useAuthTheme();
 return <div className={'lgLoader'+(theme==='light'?' light':'')} role="status" aria-live="polite"><div className="lgLoaderMark"><i/><img src={markAlpha} alt="" width="84" height="55"/></div><p>{text}</p></div>;
}
