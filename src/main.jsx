import React, {useState} from 'react';
import {createRoot} from 'react-dom/client';
import './styles.css';
import logo from './assets/nexo-logo.png';

const nav=[['dashboard','Dashboard','⌂'],['demandas','Demandas','✓'],['solicitacoes','Solicitações','↗'],['ideias','Ideias','✦'],['projetos','Projetos','▣'],['arquivos','Arquivos','▤'],['destaques','Destaques','★'],['agenda','Agenda','◷'],['reunioes','Reuniões','◉'],['indicadores','Indicadores','▥']];
const data={
 demandas:[['Atualizar procedimento de atendimento','Alta','Mayara','Hoje','Em andamento'],['Relatório mensal de indicadores','Média','Rafael','30/09','Em análise'],['Treinamento da equipe','Média','Yasmin','03/10','Pendente'],['Melhoria do roteiro de atendimento','Baixa','Henrique','07/10','Em andamento']],
 solicitacoes:[['Verificar computador da recepção','Larissa','TI','Hoje','Em andamento'],['Troca de lâmpada da sala 2','Rafael','Manutenção','30/09','Pendente'],['Solicitar material de escritório','Yasmin','Administrativo','01/10','Em andamento'],['Acesso ao sistema de relatórios','Mayara','TI','02/10','Concluída']],
 ideias:[['Criar novo processo para reduzir tempo de espera','Henrique','Em análise','Alto'],['Implantar feedback digital do cliente','Mayara','Aprovada','Alto'],['Automatizar lembretes de reuniões','Rafael','Em desenvolvimento','Médio'],['Criar material de treinamento em vídeo','Yasmin','Em análise','Alto']],
 projetos:[['Novo processo de atendimento','Henrique','30/09','Em andamento'],['Implantação do sistema de relatórios','Rafael','15/10','Em andamento'],['Campanha interna de endomarketing','Mayara','25/10','Planejamento'],['Treinamento da equipe','Yasmin','05/11','Em andamento']]
};
function Icon({children}){return <span className="icon">{children}</span>}
function App(){
 const [page,setPage]=useState('dashboard'); const [menu,setMenu]=useState(false); const [light,setLight]=useState(false);
 const title=nav.find(n=>n[0]===page)?.[1]||'Dashboard';
 return <div className={light?'app light':'app'}>
   <header className="topbar">
    <button className="menuBtn" onClick={()=>setMenu(true)} aria-label="Abrir menu"><span></span><span></span><span></span></button>
    <div className="brand"><img src={logo}/><div><strong>NEXO</strong><small>GESTÃO • ORGANIZAÇÃO • PERFORMANCE</small></div></div>
    <div className="topActions"><button className="ghost" onClick={()=>setLight(!light)}>{light?'☾':'☼'}</button><button className="bell">♧<i></i></button><div className="user"><div className="avatar">H</div><div><b>Henrique Silva</b><small>Supervisor</small></div></div></div>
   </header>
   <main className="main">
    <div className="heading"><div><p className="eyebrow">VISÃO GERAL</p><h1>{title}</h1><p className="muted">Acompanhe pessoas, ideias, demandas e resultados em um só lugar.</p></div><button className="primary" onClick={()=>alert('A ação de criação será conectada ao módulo.')}>＋ Nova ação</button></div>
    {page==='dashboard'&&<Dashboard/>}
    {page==='demandas'&&<TablePage title="Demandas" desc="Gerencie atividades, responsáveis e prazos." rows={data.demandas} headers={['Título','Prioridade','Responsável','Prazo','Status']}/>} 
    {page==='solicitacoes'&&<TablePage title="Solicitações" desc="Centralize tudo que foi solicitado pela equipe." rows={data.solicitacoes} headers={['Solicitação','Solicitante','Área','Prazo','Status']}/>} 
    {page==='ideias'&&<TablePage title="Banco de Ideias" desc="Transforme boas ideias em melhorias reais." rows={data.ideias} headers={['Ideia','Autor','Status','Impacto']}/>} 
    {page==='projetos'&&<TablePage title="Projetos" desc="Acompanhe projetos, etapas e evolução." rows={data.projetos} headers={['Projeto','Responsável','Prazo','Status']}/>} 
    {['arquivos','destaques','agenda','reunioes','indicadores'].includes(page)&&<Placeholder page={title}/>} 
   </main>
   {menu&&<><div className="overlay" onClick={()=>setMenu(false)}></div><aside className="drawer"><div className="drawerHead"><div className="brand"><img src={logo}/><div><strong>NEXO</strong><small>GESTÃO • ORGANIZAÇÃO • PERFORMANCE</small></div></div><button onClick={()=>setMenu(false)}>×</button></div><nav>{nav.map(([id,label,ic])=><button key={id} className={page===id?'active':''} onClick={()=>{setPage(id);setMenu(false)}}><Icon>{ic}</Icon>{label}</button>)}</nav><div className="drawerBottom"><button><Icon>⚙</Icon> Configurações</button><div className="profile"><div className="avatar">H</div><div><b>Henrique Silva</b><small>Supervisor</small></div></div></div></aside></>}
 </div>
}
function Dashboard(){return <section>
 <div className="cards"><Stat n="12" t="Demandas pendentes" s="3 para hoje"/><Stat n="07" t="Projetos ativos" s="2 próximos do prazo"/><Stat n="03" t="Ideias em análise" s="1 nova hoje"/><Stat n="05" t="Solicitações novas" s="2 urgentes"/></div>
 <div className="grid2"><div className="panel"><div className="panelTitle"><div><h3>Prioridades de hoje</h3><span>O que precisa de atenção agora</span></div><button className="link">Ver todas</button></div>{[['Atualizar procedimento de atendimento','Alta','Hoje'],['Relatório mensal de indicadores','Média','30/09'],['Reunião com equipe de supervisão','Média','Hoje'],['Finalizar projeto de melhoria','Baixa','02/10']].map((x,i)=><div className="priority" key={i}><span className={'dot d'+i}></span><div><b>{x[0]}</b><small>Prazo: {x[2]}</small></div><em>{x[1]}</em></div>)}</div>
 <div className="panel highlight"><div className="panelTitle"><div><h3>🏆 Destaque do mês</h3><span>Reconhecimento da equipe</span></div></div><div className="highlightBody"><div className="personPic">T</div><div><h2>Thainara Oliveira</h2><p>Excelência no Atendimento</p><small>Reconhecida pelo desempenho e contribuição para a equipe.</small></div></div><button className="secondary">Ver detalhes</button></div></div>
 <div className="panel activity"><div className="panelTitle"><div><h3>Atividade recente</h3><span>Últimas movimentações</span></div></div>{['Mayara adicionou uma nova demanda','Rafael atualizou o projeto de relatórios','Yasmin criou uma ideia em Treinamento','João adicionou um arquivo'].map((x,i)=><div className="activityRow" key={i}><span className="miniAvatar">{['M','R','Y','J'][i]}</span><div><b>{x}</b><small>{i+1}h atrás</small></div></div>)}</div>
 </section>}
function Stat({n,t,s}){return <div className="stat"><div className="statIcon">◈</div><div><strong>{n}</strong><b>{t}</b><small>{s}</small></div></div>}
function TablePage({title,desc,rows,headers}){return <section className="panel tablePanel"><div className="toolbar"><div className="search">⌕ <input placeholder="Buscar por título, responsável ou solicitante..."/></div><button className="filter">☷ Filtros</button></div><div className="table"><div className="tr th">{headers.map(h=><span key={h}>{h}</span>)}<span></span></div>{rows.map((r,i)=><div className="tr" key={i}>{r.map((c,j)=><span key={j} className={j===r.length-1?'status':''}>{c}</span>)}<span className="more">•••</span></div>)}</div></section>}
function Placeholder({page}){return <section className="panel placeholder"><div className="bigIcon">◈</div><h2>{page}</h2><p>O módulo está preparado na estrutura inicial do NEXO. Aqui entraremos com o fluxo completo, seguindo o mesmo padrão visual do dashboard.</p><button className="primary">＋ Criar primeiro registro</button></section>}
createRoot(document.getElementById('root')).render(<App/>);
