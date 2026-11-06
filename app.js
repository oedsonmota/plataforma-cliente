(function(){
"use strict";
const CFG=window.PLATAFORMA;
const sb=window.supabase.createClient(CFG.supabaseUrl,CFG.supabaseAnonKey,{auth:{persistSession:true,autoRefreshToken:true}});
const reduce=window.matchMedia&&matchMedia("(prefers-reduced-motion: reduce)").matches;
const app=document.getElementById("app");

/* ---------- datas ---------- */
const DAY=864e5;
const today=new Date();today.setHours(0,0,0,0);
const iso=d=>d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
const parse=s=>{const[a,b,c]=String(s).slice(0,10).split("-").map(Number);return new Date(a,b-1,c)};
const add=(d,n)=>new Date(d.getFullYear(),d.getMonth(),d.getDate()+n);
const monday=d=>add(d,-((d.getDay()+6)%7));
const diff=(a,b)=>Math.round((b-a)/DAY);
const MES=["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"];
const MESF=["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
const fmt=s=>{const d=parse(s);return d.getDate()+" "+MES[d.getMonth()]};
const esc=s=>String(s==null?"":s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
function until(s){const n=diff(today,parse(s));if(n===0)return"hoje";if(n===1)return"amanhã";if(n<0)return"há "+(-n)+" dias";return"em "+n+" dias"}
const $=id=>document.getElementById(id);

/* ---------- método (base Marcando) ---------- */
const METODO=[
 ["Entrevistas","Estratégia",0,4,"Gravações e resumo das entrevistas","Conversas individuais com você e com quem faz a marca acontecer, para entender o negócio por dentro.","Reservar 1 hora para a sua entrevista e indicar quem mais da equipe deve ser ouvido."],
 ["Workshop","Estratégia",8,9,"Mural do workshop","Encontro guiado para alinhar visão, público e a ambição da marca para os próximos anos.","Participar do workshop com quem decide sobre a marca. São cerca de 3 horas."],
 ["Pesquisa","Estratégia",9,18,"Relatório de pesquisa","Estudo de mercado, concorrentes e público, com dados e referências que sustentam as decisões.","Enviar o que você já tem: apresentações, números de venda e referências de que gosta."],
 ["Diagnóstico","Estratégia",21,25,"Apresentação do diagnóstico","Leitura de onde a marca está hoje, o que ela tem de forte e o que está travando o crescimento.","Assistir à apresentação do diagnóstico e trazer as suas dúvidas."],
 ["Estratégia","Estratégia",28,39,"Plataforma de marca","Plataforma de marca com posicionamento, promessa, personalidade e direção criativa.","Reservar 1 hora no último dia da etapa para a apresentação da plataforma de marca."],
 ["Keyword","Criação",42,46,"Conceito criativo","A palavra-conceito que resume a marca e vai guiar toda a criação visual e verbal.","Aprovar a palavra-conceito antes de seguirmos para a criação visual."],
 ["Keyvisual","Criação",49,60,"Apresentação do keyvisual","Primeira expressão visual da marca: logo, cores, tipografia e grafismos aplicados.","Mandar o seu retorno sobre o keyvisual em até 3 dias úteis depois da apresentação."],
 ["Guia de Marca","Criação",63,74,"Guia de marca e arquivos finais","Manual com as regras da identidade visual e verbal, pronto para a sua equipe usar.","Receber os arquivos finais e repassar o guia para quem vai aplicar a marca."]
];

/* ---------- conversão banco <-> tela ---------- */
const stepFromDb=s=>({id:s.id,nome:s.name,fase:s.phase,desc:s.description,entregavel:s.deliverable,acao:s.client_action,inicio:String(s.start_date).slice(0,10),fim:String(s.end_date).slice(0,10),status:s.status,link:s.file_url||"",position:s.position});
const projFromDb=p=>({id:p.id,contato:p.contact_name,marca:p.brand_name,titulo:p.title,descricao:p.description,whats:p.whatsapp||"",email:p.client_email||"",hasAccess:!!p.client_user_id,updated:p.updated_at,
  steps:(p.steps||[]).slice().sort((a,b)=>(a.position||0)-(b.position||0)).map(stepFromDb)});
const PCOL={contato:"contact_name",marca:"brand_name",titulo:"title",descricao:"description",whats:"whatsapp"};
const SCOL={nome:"name",fase:"phase",desc:"description",entregavel:"deliverable",acao:"client_action",inicio:"start_date",fim:"end_date",status:"status",link:"file_url"};

/* ---------- cálculos ---------- */
function spct(s){if(s.status==="concluida")return 100;if(s.status==="afazer")return 0;
  const t=diff(parse(s.inicio),parse(s.fim))+1,n=diff(parse(s.inicio),today)+1;return Math.max(5,Math.min(95,Math.round(n/t*100)))}
function progress(c){let t=0,d=0;c.steps.forEach(s=>{const w=Math.max(1,diff(parse(s.inicio),parse(s.fim))+1);t+=w;d+=w*spct(s)/100});return t?Math.round(d/t*100):0}
const current=c=>c.steps.find(s=>s.status==="andamento")||c.steps.find(s=>s.status==="afazer")||null;
const after=(c,cur)=>cur?c.steps.slice(c.steps.indexOf(cur)+1).find(s=>s.status!=="concluida")||null:null;
const span=c=>{if(!c.steps.length)return null;let a=c.steps[0].inicio,b=c.steps[0].fim;c.steps.forEach(s=>{if(s.inicio<a)a=s.inicio;if(s.fim>b)b=s.fim});return{a:parse(a),b:parse(b)}};
const TAG={concluida:"Concluída",andamento:"Em andamento",afazer:"A fazer"};
const genPass=()=>{const c="abcdefghjkmnpqrstuvwxyz23456789";let s="";const r=crypto.getRandomValues(new Uint32Array(10));r.forEach(n=>s+=c[n%c.length]);return s};

/* ---------- avisos e modal ---------- */
let toastT;
function toast(msg,err){let t=document.querySelector(".toast");if(!t){t=document.createElement("div");document.body.appendChild(t)}
  t.className="toast"+(err?" err":"");t.textContent=msg;clearTimeout(toastT);toastT=setTimeout(()=>t.remove(),err?5000:2200)}
const md=$("modal");
function modal(title,html,onReady){$("modal-t").textContent=title;$("modal-body").innerHTML=html;md.classList.remove("hidden");
  const first=md.querySelector("input,button");if(first)first.focus();if(onReady)onReady()}
function closeModal(){md.classList.add("hidden")}
md.addEventListener("click",e=>{if(e.target===md||e.target.closest("[data-close]"))closeModal()});
document.addEventListener("keydown",e=>{if(e.key==="Escape")closeModal()});
function info(title,text){modal(title,`<p>${esc(text)}</p><div class="row"><button class="btn ink" type="button" data-close>Fechar</button></div>`)}
function shareAccess(c,pass){
  const msg=`Oi, ${c.contato}! O portal do projeto da ${c.marca} já está no ar.\n\nAcesse: ${CFG.siteUrl}\nE-mail: ${c.email}\nSenha: ${pass}\n\nLá você acompanha as etapas, as datas e cada entrega. Se quiser, troque a senha no primeiro acesso.`;
  modal("Acesso pronto",`<p>Mande esta mensagem para o cliente. A senha não fica salva em lugar nenhum, então copie agora.</p><div class="copybox" id="cpy">${esc(msg)}</div>
    <div class="row"><button class="btn" type="button" data-close>Fechar</button><button class="btn ink" type="button" id="cpb">Copiar mensagem</button></div>`,
    ()=>{$("cpb").onclick=()=>{navigator.clipboard.writeText(msg).then(()=>toast("Mensagem copiada"),()=>toast("Selecione o texto e copie",true))}});
}

/* ---------- estado ---------- */
let view="loading",session=null,role=null,myProject=null,projects=[],sel=null,calMode="linha",calMonth=null,asAdmin=false,openRow=-1;

async function boot(){
  const {data}=await sb.auth.getSession();session=data.session;
  if(!session){view="login";return render()}
  await afterLogin();
}
let entering=false;
async function afterLogin(){
  if(entering)return;entering=true;
  try{await afterLoginInner()}
  catch(e){console.error(e);toast("Não deu para carregar seus dados. Recarregue a página.",true)}
  finally{entering=false}
}
async function afterLoginInner(){
  const {data:prof,error}=await sb.from("profiles").select("role").eq("id",session.user.id).single();
  role=prof?prof.role:"client";
  if(error&&error.code!=="PGRST116")console.warn(error);
  if(role==="admin"){await loadProjects();view="admin"}
  else{const {data:p,error:e}=await sb.rpc("get_my_project");if(e)console.warn(e);myProject=p?projFromDb(p):null;view="portal";asAdmin=false}
  calMonth=null;render();window.scrollTo(0,0);
}
async function loadProjects(){
  const {data,error}=await sb.from("projects").select("*, steps(*)").order("created_at",{ascending:false});
  if(error){toast("Não consegui carregar os clientes: "+error.message,true);projects=[];return}
  projects=data.map(projFromDb);
  if(!projects.find(p=>p.id===sel))sel=projects[0]?projects[0].id:null;
}
sb.auth.onAuthStateChange((ev,s)=>{session=s;
  if(ev==="SIGNED_OUT"&&view!=="login"){view="login";render()}
  /* roda fora do callback do Supabase para não travar a sessão */
  if(ev==="SIGNED_IN"&&s&&view==="login")setTimeout(afterLogin,0);
});
async function logout(){await sb.auth.signOut();session=null;role=null;myProject=null;projects=[];view="login";render();window.scrollTo(0,0)}
function render(){
  if(view==="login")return renderLogin();
  if(view==="portal")return renderPortal(asAdmin?projects.find(p=>p.id===sel):myProject);
  if(view==="admin")return renderAdmin();
}

/* ======== LOGIN ======== */
function renderLogin(){
  window.onscroll=null;
  const est=METODO.filter(m=>m[1]==="Estratégia"),cri=METODO.filter(m=>m[1]==="Criação");
  const li=(arr,off)=>arr.map((m,i)=>`<li><span>${String(i+1+off).padStart(2,"0")}</span>${esc(m[0])}</li>`).join("");
  app.innerHTML=`<div class="login">
    <div class="login-side">
      <div class="mark"><b>Edson Mota</b><span>Estratégia de marca e direção criativa</span></div>
      <div>
        <h1>Tudo o que a gente combinou, num lugar só.</h1>
        <p class="lead">Aqui você acompanha o projeto da sua marca: em que etapa estamos, o que vem a seguir e cada entrega assim que ela fica pronta.</p>
      </div>
      <div class="method">
        <div><h4>Estratégia</h4><ol>${li(est,0)}</ol></div>
        <div><h4>Criação</h4><ol>${li(cri,est.length)}</ol></div>
      </div>
    </div>
    <div class="login-main">
      <form class="login-card" id="lf" novalidate>
        <h2>Entrar no portal</h2>
        <p class="sub">Use o e-mail e a senha que você recebeu.</p>
        <div class="field"><label for="le">E-mail</label><input id="le" type="text" inputmode="email" autocomplete="username" autocapitalize="none" spellcheck="false" placeholder="voce@suamarca.com"></div>
        <div class="field"><label for="lp">Senha</label><input id="lp" type="password" autocomplete="current-password"></div>
        <div class="err" id="lerr" role="alert"></div>
        <button class="btn ink" type="submit" id="lbtn" style="padding:14px">Entrar</button>
        <p class="sub" style="margin-top:4px">Esqueceu a senha? Fale com o Edson que ele gera uma nova para você.</p>
      </form>
    </div>
  </div>`;
  $("lf").addEventListener("submit",async ev=>{ev.preventDefault();
    const email=$("le").value.trim().toLowerCase(),password=$("lp").value;
    if(!email||!password){$("lerr").textContent="Preencha o e-mail e a senha.";return}
    $("lbtn").disabled=true;$("lbtn").textContent="Entrando...";$("lerr").textContent="";
    const {data,error}=await sb.auth.signInWithPassword({email,password});
    if(error){$("lbtn").disabled=false;$("lbtn").textContent="Entrar";
      $("lerr").textContent=/invalid/i.test(error.message)?"E-mail ou senha não conferem. Use o acesso que veio na mensagem do Edson.":"Não deu para entrar agora: "+error.message;return}
    session=data.session;setTimeout(afterLogin,0);
  });
}

/* ======== PORTAL ======== */
function changePassword(){
  modal("Trocar senha",`<form id="pf"><div class="field"><label for="np">Nova senha</label><input id="np" type="password" autocomplete="new-password" minlength="8"></div>
    <div class="field"><label for="np2">Repita a nova senha</label><input id="np2" type="password" autocomplete="new-password"></div><div class="err" id="perr"></div>
    <div class="row"><button class="btn" type="button" data-close>Cancelar</button><button class="btn ink" type="submit">Salvar senha</button></div></form>`,
  ()=>{$("pf").onsubmit=async e=>{e.preventDefault();const a=$("np").value,b=$("np2").value;
    if(a.length<8){$("perr").textContent="Use pelo menos 8 caracteres.";return}
    if(a!==b){$("perr").textContent="As duas senhas não estão iguais.";return}
    const {error}=await sb.auth.updateUser({password:a});
    if(error){$("perr").textContent=error.message;return}closeModal();toast("Senha trocada")}});
}
function renderPortal(c){
  if(!c){
    app.innerHTML=`<div class="top-dark"><div class="wrap"><div class="bar-top"><div class="mark"><b>Edson Mota</b><span>Portal do cliente</span></div><button class="btn light sm" id="out" type="button">Sair</button></div>
      <div class="hero" style="grid-template-columns:1fr"><div><h1>Seu cronograma está sendo montado.</h1><p class="desc">Assim que o Edson cadastrar as etapas do seu projeto, elas aparecem aqui.</p></div></div></div></div>`;
    $("out").onclick=logout;return;
  }
  const pct=progress(c),cur=current(c),nxt=after(c,cur),sp=span(c);
  const done=c.steps.filter(s=>s.status==="concluida").length;
  if(!calMonth){const b=cur?parse(cur.inicio):today;calMonth=new Date(b.getFullYear(),b.getMonth(),1)}
  const fases=[...new Set(c.steps.map(s=>s.fase))];
  const flex=x=>Math.max(1,diff(parse(x.inicio),parse(x.fim))+1);
  const upd=c.updated?new Date(c.updated):today;

  app.innerHTML=`
  <div class="top-dark"><div class="wrap">
    <div class="bar-top">
      <div class="mark"><b>Edson Mota</b><span>Portal do cliente</span></div>
      <div style="display:flex;gap:8px">${asAdmin?`<button class="btn light sm" id="back" type="button">Voltar ao painel</button>`:`<button class="btn light sm" id="pw" type="button">Trocar senha</button><button class="btn light sm" id="out" type="button">Sair</button>`}</div>
    </div>
    <div class="hero">
      <div>
        <div class="hello">Boas-vindas, ${esc(c.contato)}.</div>
        <h1>${esc(c.titulo)}</h1>
        <p class="desc">${esc(c.descricao)}</p>
      </div>
      <div class="pbox">
        <div class="lbl">Progresso do projeto</div>
        <div class="pct num"><span id="pctn">${reduce?pct:0}</span><small>%</small></div>
        <div class="segs" role="progressbar" aria-label="Progresso do projeto" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100">
          ${c.steps.map(x=>`<div class="seg-i ${x.status}" style="flex:${flex(x)}" title="${esc(x.nome)}: ${fmt(x.inicio)} a ${fmt(x.fim)}">${x.status==="andamento"?`<i data-w="${spct(x)}"></i>`:""}</div>`).join("")}
        </div>
        <div class="seg-n">${c.steps.map((x,i)=>`<span class="${x.status}" style="flex:${flex(x)}">${i+1}</span>`).join("")}</div>
        <div class="pmeta num"><span>Início ${sp?fmt(iso(sp.a)):"-"}</span><span>${done} de ${c.steps.length} etapas</span><span>Entrega final ${sp?fmt(iso(sp.b)):"-"}</span></div>
      </div>
    </div>
    <dl class="now">
      <div><dt>Onde estamos</dt><dd>${cur?esc(cur.nome):"Projeto concluído"}</dd><span class="when num">${cur?fmt(cur.inicio)+" a "+fmt(cur.fim):"Todas as etapas foram entregues."}</span></div>
      <div class="hl"><dt>Próxima entrega</dt><dd>${cur?esc(cur.entregavel):"Tudo entregue"}</dd><span class="when num">${cur?fmt(cur.fim)+", "+until(cur.fim):""}</span></div>
      <div><dt>Depois</dt><dd>${nxt?esc(nxt.nome):(cur?"Entrega final":"Implantação da marca")}</dd><span class="when num">${nxt?"Começa em "+fmt(nxt.inicio):""}</span></div>
    </dl>
  </div></div>

  <div class="wrap">
    <div class="tabs-wrap"><nav class="tabs" aria-label="Seções do portal">
      <button type="button" data-go="etapas" aria-current="true">Etapas</button>
      <button type="button" data-go="cronograma">Cronograma</button>
      <button type="button" data-go="arquivos">Arquivos</button>
    </nav></div>

    <section class="block" id="etapas" aria-labelledby="h1e" style="padding-top:20px">
      <div class="sec-head"><div><h2 id="h1e">Etapas do projeto</h2><p>O caminho completo do que a gente fechou. Cada entrega libera aqui assim que a etapa termina.</p></div>
        <div class="legend"><span class="tag concluida">Concluída</span><span class="tag andamento">Em andamento</span><span class="tag afazer">A fazer</span><span class="tag entrega">Entrega</span></div></div>
      <div class="rail">${railHTML(c,fases)}</div>
    </section>

    <section class="block" id="cronograma" aria-labelledby="h2c">
      <div class="sec-head"><div><h2 id="h2c">Cronograma</h2><p>As datas de cada etapa. O losango marca o dia da entrega e a linha laranja marca hoje.</p></div>
        <div class="toggle" role="group" aria-label="Formato do cronograma"><button type="button" data-mode="linha" aria-pressed="${calMode==="linha"}">Linha do tempo</button><button type="button" data-mode="mes" aria-pressed="${calMode==="mes"}">Calendário</button></div></div>
      <div class="panel" id="cal-panel">${calMode==="linha"?gantt(c):month(c)}</div>
    </section>

    <section class="block" id="arquivos" aria-labelledby="h3a">
      <div class="sec-head"><div><h2 id="h3a">Arquivos</h2><p>Tudo o que já foi entregue, num lugar só.</p></div></div>
      <div class="files">${c.steps.map(fileHTML).join("")}</div>
    </section>

    <div class="contact"><div><h3>Ficou alguma dúvida sobre o projeto?</h3><p>Me chama direto. Respondo em até um dia útil.</p></div>${c.whats?`<a class="btn orange" href="https://wa.me/${esc(c.whats.replace(/\D/g,""))}" target="_blank" rel="noopener">Falar com o Edson</a>`:""}</div>
    <footer><span>© Edson Mota, estratégia de marca e direção criativa</span><span class="num">Atualizado em ${upd.getDate()} ${MES[upd.getMonth()]}</span></footer>
  </div>`;

  const pn=$("pctn");
  if(pn&&!reduce){const t0=performance.now();const stepf=t=>{const k=Math.min(1,(t-t0)/1200);pn.textContent=Math.round(pct*(1-Math.pow(1-k,3)));if(k<1)requestAnimationFrame(stepf)};requestAnimationFrame(stepf)}
  requestAnimationFrame(()=>requestAnimationFrame(()=>app.querySelectorAll("[data-w]").forEach(el=>el.style.width=el.dataset.w+"%")));

  if($("out"))$("out").onclick=logout;
  if($("pw"))$("pw").onclick=changePassword;
  if($("back"))$("back").onclick=()=>{asAdmin=false;view="admin";render();window.scrollTo(0,0)};
  app.querySelectorAll("[data-go]").forEach(b=>b.onclick=()=>$(b.dataset.go).scrollIntoView({behavior:reduce?"auto":"smooth"}));
  bindCal(c);
  const ids=["etapas","cronograma","arquivos"];
  window.onscroll=()=>{let act="etapas";ids.forEach(id=>{const el=$(id);if(el&&el.getBoundingClientRect().top<140)act=id});
    app.querySelectorAll("[data-go]").forEach(b=>b.setAttribute("aria-current",b.dataset.go===act))};
}
function bindCal(c){
  app.querySelectorAll("[data-mode]").forEach(b=>b.onclick=()=>{calMode=b.dataset.mode;
    app.querySelectorAll("[data-mode]").forEach(x=>x.setAttribute("aria-pressed",x===b));
    $("cal-panel").innerHTML=calMode==="linha"?gantt(c):month(c);bindCal(c)});
  app.querySelectorAll("[data-cal]").forEach(b=>b.onclick=()=>{calMonth=new Date(calMonth.getFullYear(),calMonth.getMonth()+ +b.dataset.cal,1);
    $("cal-panel").innerHTML=month(c);bindCal(c)});
}
const fileLink=(s,cls,label)=>`<a class="btn ${cls}" href="${esc(s.link)}" target="_blank" rel="noopener">${label}</a>`;
const okLink=s=>s.status==="concluida"&&/^https?:\/\//i.test(s.link||"");
function railHTML(c,fases){
  const N=c.steps.length;let out="";
  fases.forEach(f=>{
    out+=`<div class="phase-label"><span>${esc(f)}</span></div>`;
    c.steps.forEach((s,i)=>{if(s.fase!==f)return;
      const pos=(i===0?" first":"")+(i===N-1?" last":"");
      const n=String(i+1).padStart(2,"0");
      const check=s.status==="concluida"?`<svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="#FEF7EA" stroke-width="2.2"><path d="M2.5 6.2l2.3 2.3 4.7-4.9"/></svg>`:"";
      if(s.status==="andamento"){const p=spct(s),left=Math.max(0,diff(today,parse(s.fim)));
        out+=`<div class="rs andamento${pos}"><div class="node"><i></i></div><div class="rs-body">
          <article class="current">
            <div>
              <div class="top"><span class="n num">Etapa ${n}</span><span class="tag andamento">Em andamento</span></div>
              <h3>${esc(s.nome)}</h3>
              <p class="d">${esc(s.desc)}</p>
              <div class="prog"><div class="prog-head num"><span>${fmt(s.inicio)}</span><b>${p}% desta etapa</b><span>${fmt(s.fim)}</span></div><div class="track"><i data-w="${p}"></i></div></div>
            </div>
            <div class="side">
              <div class="box"><small>Entrega desta etapa</small><b>${esc(s.entregavel)}</b>
                <div class="count num"><strong>${left}</strong><span>${left===1?"dia":"dias"} para ${fmt(s.fim)}</span></div></div>
              ${s.acao?`<div class="box you"><small>Sua parte nesta etapa</small><b>${esc(s.acao)}</b></div>`:""}
            </div>
          </article></div></div>`;
      }else{
        out+=`<div class="rs ${s.status}${pos}"><div class="node"><i>${check}</i></div><div class="rs-body">
          <div class="rs-line"><span class="n num">${n}</span><h3>${esc(s.nome)}</h3>${s.status==="afazer"?"":`<span class="tag concluida">Concluída</span>`}
            <span class="dates num">${fmt(s.inicio)} a ${fmt(s.fim)}</span>
            ${okLink(s)?fileLink(s,"ink sm open","Abrir entrega"):(s.status==="afazer"?`<span class="tag entrega open">${esc(s.entregavel)}</span>`:"")}
          </div>
          <p class="rs-sub">${s.status==="afazer"?esc(s.desc):"Entregue: "+esc(s.entregavel)}</p>
        </div></div>`;
      }
    });
  });
  return out;
}
function fileHTML(s){
  const ok=okLink(s);
  const ic=ok?`<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FEF7EA" stroke-width="1.8"><path d="M14 3H6.5A1.5 1.5 0 0 0 5 4.5v15A1.5 1.5 0 0 0 6.5 21h11a1.5 1.5 0 0 0 1.5-1.5V8z"/><path d="M14 3v5h5M8.5 13h7M8.5 16.5h5"/></svg>`
    :`<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#7A7166" stroke-width="1.8"><rect x="5" y="11" width="14" height="10" rx="2.5"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>`;
  return `<div class="file${ok?"":" locked"}"><div class="ic">${ic}</div>
    <div><h4>${esc(s.entregavel)}</h4><p class="num">${esc(s.nome)}, ${ok?"entregue em "+fmt(s.fim):(s.status==="concluida"?"concluída em "+fmt(s.fim):"previsto para "+fmt(s.fim))}</p></div>
    ${ok?fileLink(s,"sm","Abrir arquivo"):`<span class="lock num">${s.status==="concluida"?"Arquivo a caminho":"Libera em "+fmt(s.fim)}</span>`}</div>`;
}
function gantt(c){
  const sp=span(c);if(!sp)return"<p>Nenhuma etapa cadastrada ainda.</p>";
  const st=monday(sp.a),weeks=Math.max(1,Math.ceil((diff(st,sp.b)+1)/7)),T=weeks*7;
  const pos=d=>diff(st,d)/T*100,cols=`grid-template-columns:repeat(${weeks},1fr)`;
  let wk="";for(let i=0;i<weeks;i++){const d=add(st,i*7);wk+=`<div><b>Semana ${i+1}</b>${d.getDate()} ${MES[d.getMonth()]}</div>`}
  const tp=pos(today)+50/T,show=tp>=0&&tp<=100,grid=`<div class="g-grid" style="${cols}">${"<div></div>".repeat(weeks)}</div>`;
  return `<div class="scroll-x" style="padding-top:22px"><div class="gantt"><div></div><div class="g-weeks" style="${cols}">${wk}</div>
  ${c.steps.map((s,i)=>{const l=pos(parse(s.inicio)),w=(diff(parse(s.inicio),parse(s.fim))+1)/T*100,p=spct(s);
    return `<div class="g-label">${esc(s.nome)}</div><div class="g-track">${grid}
      <div class="g-bar ${s.status}" style="left:${l}%;width:${w}%" title="${esc(s.nome)}: ${fmt(s.inicio)} a ${fmt(s.fim)}">${s.status==="andamento"?`<i style="width:${p}%"></i><span>${p}%</span>`:""}</div>
      <div class="g-dia" style="left:${l+w}%" title="Entrega: ${esc(s.entregavel)}, ${fmt(s.fim)}"></div>
      ${show?`<div class="g-today${i===0?" lbl":""}" style="left:${tp}%"></div>`:""}</div>`}).join("")}
  </div></div>`;
}
function month(c){
  const y=calMonth.getFullYear(),m=calMonth.getMonth(),gs=monday(new Date(y,m,1));let cells="";
  for(let i=0;i<42;i++){const d=add(gs,i);if(i>=35&&d.getMonth()!==m)break;const ds=iso(d);
    const act=c.steps.filter(s=>s.inicio<=ds&&ds<=s.fim),ent=c.steps.filter(s=>s.fim===ds);
    cells+=`<div class="day${d.getMonth()!==m?" out":""}${ds===iso(today)?" today":""}"><span class="dn num">${d.getDate()}</span>
      ${act.map(s=>`<span class="chip ${s.status}" title="${esc(s.nome)}">${esc(s.nome)}</span>`).join("")}
      ${ent.map(s=>`<span class="chip entrega" title="Entrega: ${esc(s.entregavel)}">Entrega</span>`).join("")}</div>`}
  return `<div class="cal-head"><h3>${MESF[m]} de ${y}</h3><div class="legend"><span class="tag concluida">Concluída</span><span class="tag andamento">Em andamento</span><span class="tag afazer">A fazer</span><span class="tag entrega">Entrega</span></div>
    <div class="cal-nav"><button type="button" data-cal="-1" aria-label="Mês anterior">‹</button><button type="button" data-cal="1" aria-label="Próximo mês">›</button></div></div>
    <div class="scroll-x"><div class="cal">${["Seg","Ter","Qua","Qui","Sex","Sáb","Dom"].map(w=>`<div class="wd">${w}</div>`).join("")}${cells}</div></div>`;
}

/* ======== PAINEL ======== */
function ring(p){const r=16,L=2*Math.PI*r;return `<svg width="40" height="40" viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="${r}" fill="none" stroke="#EFE4CF" stroke-width="4"/><circle cx="20" cy="20" r="${r}" fill="none" stroke="#F43217" stroke-width="4" stroke-linecap="round" stroke-dasharray="${(L*p/100).toFixed(1)} ${L.toFixed(1)}" transform="rotate(-90 20 20)"/><text x="20" y="24" text-anchor="middle" font-size="10" font-weight="700" fill="#0A0A0A" font-family="Helvetica Neue,Helvetica,Arial,sans-serif">${p}</text></svg>`}
function renderAdmin(){
  window.onscroll=null;
  const c=projects.find(x=>x.id===sel);
  app.innerHTML=`<div class="admin-top"><div class="wrap bar-top"><div class="mark"><b>Edson Mota</b><span>Painel de projetos</span></div><button class="btn light sm" id="out" type="button">Sair</button></div></div>
  <div class="wrap admin">
    <aside class="clients"><h3>Clientes</h3>
      ${projects.map(x=>{const cu=current(x);return`<button class="ci" type="button" data-sel="${esc(x.id)}" aria-current="${x.id===sel}">${ring(progress(x))}<span><b>${esc(x.marca||"Sem nome")}</b><small>${!x.hasAccess?"Sem acesso criado":(cu?esc(cu.nome)+" em andamento":"Concluído")}</small></span></button>`}).join("")}
      <button class="btn ink sm" type="button" id="newc" style="margin-top:8px">Novo cliente</button>
    </aside>
    <main class="editor">${c?editor(c):`<div class="card"><h3>Nenhum cliente ainda</h3><p class="hint">Clique em "Novo cliente" para cadastrar o primeiro projeto. As 8 etapas do método entram automaticamente.</p></div>`}</main>
  </div>`;
  $("out").onclick=logout;
  app.querySelectorAll("[data-sel]").forEach(b=>b.onclick=()=>{sel=b.dataset.sel;openRow=-1;renderAdmin()});
  $("newc").onclick=newClient;
  if(c)bindEditor(c);
}
function editor(c){
  const cur=c.steps.findIndex(s=>s.status==="andamento");
  return `<div class="ed-head"><h2>${esc(c.marca)}</h2><div class="r"><span class="saved" id="saved">Alterações salvas</span><button class="btn orange" type="button" id="preview">Ver como o cliente vê</button></div></div>
  ${!c.hasAccess?`<div class="adv" style="background:var(--orange)"><p>Este cliente ainda não tem login. Crie o acesso para ele entrar no portal.</p><button class="btn sm" style="background:#fff;border-color:#fff" type="button" id="mkacc">Criar acesso</button></div>`:""}
  <div class="card"><h3>Etapas e entregas</h3><p class="hint">Mude o status com um clique. Abra a etapa para editar datas, entregável, o link do arquivo e o que o cliente precisa fazer.</p>
    ${cur>=0?`<div class="adv"><p>Em andamento: <b>${esc(c.steps[cur].nome)}</b>. Entrega ${fmt(c.steps[cur].fim)}.</p><button class="btn orange sm" type="button" id="advance">Concluir e iniciar a próxima</button></div>`:""}
    ${c.steps.map((s,i)=>`<div class="se ${s.status}${openRow===i?" open":""}">
      <div class="se-row">
        <span class="n num">${String(i+1).padStart(2,"0")}</span>
        <input class="nm" aria-label="Nome da etapa ${i+1}" data-i="${i}" data-s="nome" value="${esc(s.nome)}">
        <span class="dt num">${fmt(s.inicio)} a ${fmt(s.fim)}${/^https?:/i.test(s.link)?`<span class="linkdot" title="Arquivo vinculado"></span>`:""}</span>
        <div class="seg" role="group" aria-label="Status de ${esc(s.nome)}">${["afazer","andamento","concluida"].map(o=>`<button type="button" class="${o}" data-st="${i}|${o}" aria-pressed="${s.status===o}">${TAG[o]}</button>`).join("")}</div>
        <button class="more" type="button" data-more="${i}" aria-expanded="${openRow===i}" aria-label="Detalhes de ${esc(s.nome)}"><svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M2.5 4.5L6 8l3.5-3.5"/></svg></button>
      </div>
      <div class="se-detail">
        <div class="field"><label for="a${i}">Início</label><input id="a${i}" type="date" data-i="${i}" data-s="inicio" value="${s.inicio}"></div>
        <div class="field"><label for="b${i}">Fim</label><input id="b${i}" type="date" data-i="${i}" data-s="fim" value="${s.fim}"></div>
        <div class="field"><label for="f${i}">Fase</label><select id="f${i}" data-i="${i}" data-s="fase">${["Estratégia","Criação"].map(o=>`<option${s.fase===o?" selected":""}>${o}</option>`).join("")}</select></div>
        <div class="field"><label for="e${i}">Entregável</label><input id="e${i}" data-i="${i}" data-s="entregavel" value="${esc(s.entregavel)}"></div>
        <div class="field two"><label for="l${i}">Link do arquivo (Drive, Figma ou PDF)</label><input id="l${i}" data-i="${i}" data-s="link" placeholder="https://" value="${esc(s.link)}"></div>
        <div class="field full"><label for="d${i}">Descrição para o cliente</label><textarea id="d${i}" data-i="${i}" data-s="desc">${esc(s.desc)}</textarea></div>
        <div class="field full"><label for="y${i}">Sua parte nesta etapa (o que o cliente precisa fazer)</label><input id="y${i}" data-i="${i}" data-s="acao" value="${esc(s.acao||"")}"></div>
        <div class="actions"><span></span><button class="danger" type="button" data-del="${i}">Remover etapa</button></div>
      </div></div>`).join("")}
    <button class="btn sm" type="button" id="adds" style="margin-top:14px">Adicionar etapa</button>
  </div>
  <div class="card"><h3>Dados do projeto</h3><p class="hint">O que aparece no topo do portal do cliente.</p>
    <div class="grid2">
      <div class="field"><label for="k1">Nome do contato</label><input id="k1" data-k="contato" value="${esc(c.contato)}"></div>
      <div class="field"><label for="k2">Marca</label><input id="k2" data-k="marca" value="${esc(c.marca)}"></div>
      <div class="field full"><label for="k3">Título do projeto</label><input id="k3" data-k="titulo" value="${esc(c.titulo)}"></div>
      <div class="field full"><label for="k4">Descrição</label><textarea id="k4" data-k="descricao">${esc(c.descricao)}</textarea></div>
      <div class="field"><label for="k5">WhatsApp do botão de contato (com DDI e DDD)</label><input id="k5" data-k="whats" placeholder="5511999999999" value="${esc(c.whats)}"></div>
    </div></div>
  <div class="card"><h3>Acesso do cliente</h3><p class="hint">${c.hasAccess?"O cliente entra com este e-mail. Se ele esquecer a senha, gere uma nova aqui.":"Ainda sem acesso. Crie o login para mandar ao cliente."}</p>
    <div class="access"><span>${c.hasAccess?esc(c.email):"Sem acesso criado"}</span>
      ${c.hasAccess?`<button class="btn sm" type="button" id="resetpw">Gerar nova senha</button>`:`<button class="btn ink sm" type="button" id="mkacc2">Criar acesso</button>`}</div>
    <div style="margin-top:18px"><button class="danger" type="button" id="delc">Excluir este cliente e o projeto</button></div>
  </div>`;
}
/* salvar com espera curta para não gravar a cada tecla */
const pending=new Map();let sT;
function flash(state){const s=$("saved");if(!s)return;s.textContent=state==="saving"?"Salvando...":(state==="err"?"Erro ao salvar":"Alterações salvas")}
function queueSave(table,id,col,val){
  const k=table+id+col;clearTimeout(pending.get(k));flash("saving");
  pending.set(k,setTimeout(async()=>{pending.delete(k);
    const {error}=await sb.from(table).update({[col]:val}).eq("id",id);
    if(error){flash("err");toast("Não salvou: "+error.message,true)}else if(!pending.size)flash("ok")},500));
}
async function saveNow(table,id,patch){
  flash("saving");const {error}=await sb.from(table).update(patch).eq("id",id);
  if(error){flash("err");toast("Não salvou: "+error.message,true);return false}flash("ok");return true;
}
function bindEditor(c){
  app.querySelectorAll("[data-k]").forEach(el=>el.oninput=()=>{c[el.dataset.k]=el.value;queueSave("projects",c.id,PCOL[el.dataset.k],el.value);
    if(el.dataset.k==="marca"){const h=app.querySelector(".ed-head h2");if(h)h.textContent=el.value}});
  app.querySelectorAll("[data-s]").forEach(el=>{
    const h=()=>{const s=c.steps[+el.dataset.i];s[el.dataset.s]=el.value;
      if(el.type==="date"){if(!el.value)return;saveNow("steps",s.id,{[SCOL[el.dataset.s]]:el.value}).then(()=>renderAdmin());return}
      queueSave("steps",s.id,SCOL[el.dataset.s],el.value)};
    if(el.type==="date"||el.tagName==="SELECT")el.onchange=h;else el.oninput=h;});
  app.querySelectorAll("[data-st]").forEach(b=>b.onclick=async()=>{const[i,o]=b.dataset.st.split("|");const s=c.steps[+i];const old=s.status;s.status=o;renderAdmin();
    if(!await saveNow("steps",s.id,{status:o})){s.status=old;renderAdmin()}});
  app.querySelectorAll("[data-more]").forEach(b=>b.onclick=()=>{const i=+b.dataset.more;openRow=openRow===i?-1:i;renderAdmin()});
  app.querySelectorAll("[data-del]").forEach(b=>b.onclick=async()=>{
    if(!b.classList.contains("armed")){b.classList.add("armed");b.textContent="Clique de novo para remover";return}
    const s=c.steps[+b.dataset.del];const {error}=await sb.from("steps").delete().eq("id",s.id);
    if(error)return toast("Não removeu: "+error.message,true);c.steps.splice(+b.dataset.del,1);openRow=-1;renderAdmin()});
  const adv=$("advance");
  if(adv)adv.onclick=async()=>{adv.disabled=true;const i=c.steps.findIndex(s=>s.status==="andamento");const s=c.steps[i];
    const nIdx=c.steps.findIndex((x,j)=>j>i&&x.status==="afazer");
    const ok=await saveNow("steps",s.id,{status:"concluida"});if(!ok){adv.disabled=false;return}
    s.status="concluida";
    if(nIdx>=0&&await saveNow("steps",c.steps[nIdx].id,{status:"andamento"}))c.steps[nIdx].status="andamento";
    openRow=/^https?:/i.test(s.link)?-1:i;renderAdmin();
    if(openRow===i){toast("Cole o link da entrega para liberar o arquivo ao cliente");setTimeout(()=>{const l=$("l"+i);if(l)l.focus()},60)}};
  $("adds").onclick=async()=>{const last=c.steps[c.steps.length-1],a=last?add(parse(last.fim),3):today;
    const row={project_id:c.id,position:c.steps.length,name:"Nova etapa",phase:"Criação",start_date:iso(a),end_date:iso(add(a,4)),deliverable:"Entregável",description:"",client_action:"",status:"afazer",file_url:""};
    const {data,error}=await sb.from("steps").insert(row).select().single();
    if(error)return toast("Não adicionou: "+error.message,true);c.steps.push(stepFromDb(data));openRow=c.steps.length-1;renderAdmin()};
  $("preview").onclick=()=>{asAdmin=true;calMonth=null;view="portal";render();window.scrollTo(0,0)};
  [$("mkacc"),$("mkacc2")].forEach(b=>{if(b)b.onclick=()=>createAccess(c)});
  if($("resetpw"))$("resetpw").onclick=async()=>{const pass=genPass();
    const r=await callAdmin({action:"reset",project_id:c.id,password:pass});if(r)shareAccess(c,pass)};
  $("delc").onclick=async()=>{const b=$("delc");
    if(!b.classList.contains("armed")){b.classList.add("armed");b.textContent="Clique de novo para excluir de vez (o login do cliente também é apagado)";return}
    const r=await callAdmin({action:"remove",project_id:c.id});if(!r)return;
    projects=projects.filter(p=>p.id!==c.id);sel=projects[0]?projects[0].id:null;renderAdmin();toast("Cliente excluído")};
}
async function callAdmin(body){
  const {data,error}=await sb.functions.invoke("admin-users",{body});
  if(error){let msg=error.message;try{const j=await error.context.json();if(j&&j.error)msg=j.error}catch(e){}toast(msg,true);return null}
  if(data&&data.error){toast(data.error,true);return null}
  return data||{ok:true};
}
function createAccess(c){
  const pass=genPass();
  modal("Criar acesso do cliente",`<form id="af"><div class="field"><label for="ae">E-mail do cliente</label><input id="ae" type="text" inputmode="email" autocapitalize="none" spellcheck="false" value="${esc(c.email)}"></div>
    <div class="field"><label for="ap">Senha inicial (pode trocar)</label><input id="ap" value="${pass}"></div><div class="err" id="aerr"></div>
    <div class="row"><button class="btn" type="button" data-close>Cancelar</button><button class="btn ink" type="submit" id="asub">Criar acesso</button></div></form>`,
  ()=>{$("af").onsubmit=async e=>{e.preventDefault();const email=$("ae").value.trim().toLowerCase(),pw=$("ap").value.trim();
    if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)){$("aerr").textContent="Confira o e-mail.";return}
    if(pw.length<8){$("aerr").textContent="A senha precisa de pelo menos 8 caracteres.";return}
    $("asub").disabled=true;$("asub").textContent="Criando...";
    const r=await callAdmin({action:"create",project_id:c.id,email,password:pw});
    if(!r){$("asub").disabled=false;$("asub").textContent="Criar acesso";return}
    c.email=email;c.hasAccess=true;closeModal();renderAdmin();shareAccess(c,pw)}});
}
function newClient(){
  const nextMon=iso(monday(add(today,7)));
  modal("Novo cliente",`<form id="nf">
    <div class="field"><label for="n1">Nome do contato</label><input id="n1" placeholder="Marina"></div>
    <div class="field"><label for="n2">Marca</label><input id="n2" placeholder="Olmo Cozinha Autoral"></div>
    <div class="field"><label for="n3">Início do projeto</label><input id="n3" type="date" value="${nextMon}"></div>
    <div class="field"><label for="n4">WhatsApp do botão de contato</label><input id="n4" placeholder="5511999999999"></div>
    <div class="err" id="nerr"></div>
    <div class="row"><button class="btn" type="button" data-close>Cancelar</button><button class="btn ink" type="submit" id="nsub">Criar projeto</button></div></form>`,
  ()=>{$("nf").onsubmit=async e=>{e.preventDefault();
    const contato=$("n1").value.trim(),marca=$("n2").value.trim(),ini=$("n3").value,whats=$("n4").value.replace(/\D/g,"");
    if(!contato||!marca||!ini){$("nerr").textContent="Preencha contato, marca e a data de início.";return}
    $("nsub").disabled=true;$("nsub").textContent="Criando...";
    const {data:p,error}=await sb.from("projects").insert({contact_name:contato,brand_name:marca,title:"Projeto de marca "+marca,whatsapp:whats,
      description:`Aqui você acompanha de perto o projeto de estratégia e identidade visual da ${marca}, com acesso às etapas, datas e entregas.`}).select().single();
    if(error){$("nerr").textContent=error.message;$("nsub").disabled=false;$("nsub").textContent="Criar projeto";return}
    const start=parse(ini);
    const rows=METODO.map((m,i)=>({project_id:p.id,position:i,name:m[0],phase:m[1],start_date:iso(add(start,m[2])),end_date:iso(add(start,m[3])),deliverable:m[4],description:m[5],client_action:m[6],status:i===0?"andamento":"afazer",file_url:""}));
    const {error:e2}=await sb.from("steps").insert(rows);
    if(e2)toast("Projeto criado, mas as etapas falharam: "+e2.message,true);
    await loadProjects();sel=p.id;openRow=-1;closeModal();renderAdmin();
    const c=projects.find(x=>x.id===p.id);if(c)createAccess(c)}});
}

boot().catch(e=>{console.error(e);app.innerHTML=`<div class="loading">Não deu para carregar a plataforma. Recarregue a página.</div>`});
})();
