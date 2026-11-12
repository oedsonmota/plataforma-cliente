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
function until(s){const n=diff(today,parse(s));if(n===0)return"hoje";if(n===1)return"amanhã";if(n<0)return"nova data em breve";return"em "+n+" dias"}
const $=id=>document.getElementById(id);

/* ---------- etapas do projeto (6 etapas, 4 a 6 semanas) ---------- */
const METODO=[
 ["Contrato e briefing","Estratégia",0,2,"Contrato assinado e briefing respondido","Depois da nossa conversa e do contrato assinado, você responde a um briefing sobre a empresa, o público, a concorrência e as suas referências.","Assinar o contrato e responder o briefing."],
 ["Diagnóstico","Estratégia",3,4,"Resumo do diagnóstico","Uma sessão ao vivo para ir mais a fundo em tudo o que apareceu no briefing e reunir o que ainda falta saber sobre o negócio.","Participar do diagnóstico com quem decide sobre a marca."],
 ["Direção estratégica e visual","Estratégia",7,11,"Apresentação da direção estratégica e visual","O posicionamento da marca, a partir do diagnóstico e do mercado, e os caminhos de look and feel em moodboard, para definir para onde a marca vai.","Assistir à apresentação e aprovar a direção."],
 ["Desenvolvimento da identidade","Criação",14,25,"Keyvisual e identidade verbal para validação","A identidade visual e verbal da marca: o keyvisual e a forma como a marca fala.","Validar o keyvisual e a identidade verbal em até 3 dias úteis."],
 ["Apresentação final","Criação",28,32,"Apresentação final da marca","A identidade desdobrada nas aplicações e nos pontos de contato da sua empresa.","Assistir à apresentação final e apontar os ajustes."],
 ["Finalização e entrega","Criação",35,39,"Guia de marca e arquivos finais","Ajustes finais, guia de marca e todos os arquivos organizados e prontos para uso.","Baixar os arquivos e repassar o guia para quem vai aplicar a marca."]
];

/* ---------- conversão banco <-> tela ---------- */
const stepFromDb=s=>({id:s.id,nome:s.name,fase:s.phase,desc:s.description,entregavel:s.deliverable,acao:s.client_action,inicio:String(s.start_date).slice(0,10),fim:String(s.end_date).slice(0,10),status:s.status,link:s.file_url||"",position:s.position});
const finalFromDb=f=>({id:f.id,nome:f.name,desc:f.description,formato:f.format,link:f.file_url||"",position:f.position||0});
const projFromDb=p=>{const steps=(p.steps||[]).slice().sort((a,b)=>(a.position||0)-(b.position||0)).map(stepFromDb);
  return {id:p.id,contato:p.contact_name,marca:p.brand_name,titulo:p.title,descricao:p.description,whats:p.whatsapp||"",email:p.client_email||"",hasAccess:!!p.client_user_id,updated:p.updated_at,
  photo:p.photo_url||"",openFlag:!!p.testimonial_open,
  depOpen:p.testimonial_open===true||(steps.length>0&&steps.every(x=>x.status==="concluida")),
  steps,finals:(p.final_items||[]).slice().sort((a,b)=>(a.position||0)-(b.position||0)).map(finalFromDb),
  deps:(p.testimonials||[]).slice().sort((a,b)=>a.created_at<b.created_at?1:-1)}};
const FCOL={nome:"name",desc:"description",formato:"format",link:"file_url"};
const FINAIS=[["Guia de marca","O manual com todas as regras de uso da identidade visual e verbal.","PDF"],["Logotipos","Todas as versões do logo, para fundo claro e escuro.","PNG, SVG e PDF"],["Cores e tipografia","Os códigos das cores e as fontes da marca, prontos para usar.","PDF e arquivos de fonte"],["Grafismos e elementos visuais","Padrões, ícones e elementos de apoio da identidade.","PNG e SVG"],["Plataforma de marca","Posicionamento, promessa, personalidade e tom de voz num só documento.","PDF"],["Aplicações da marca","A marca aplicada em peças reais, para servir de referência.","PNG e PDF"]];
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
function ago(d){const m=Math.round((Date.now()-d.getTime())/60000);if(m<1)return"agora há pouco";if(m<60)return"há "+m+" min";const h=Math.round(m/60);if(h<24)return"há "+h+(h===1?" hora":" horas");const dd=Math.round(h/24);if(dd===1)return"ontem";if(dd<7)return"há "+dd+" dias";return"em "+d.getDate()+" "+MES[d.getMonth()]}
function icsFor(c,s){
  const d=s.fim.replace(/-/g,""),n=iso(add(parse(s.fim),1)).replace(/-/g,""),stamp=new Date().toISOString().replace(/[-:]/g,"").slice(0,15)+"Z";
  const esc2=t=>String(t).replace(/[,;\\]/g,m=>"\\"+m).replace(/\n/g,"\\n");
  const ics=["BEGIN:VCALENDAR","VERSION:2.0","PRODID:-//Edson Mota//Plataforma//PT","BEGIN:VEVENT","UID:"+(s.id||d)+"@plataforma.edsonmota.com","DTSTAMP:"+stamp,
    "DTSTART;VALUE=DATE:"+d,"DTEND;VALUE=DATE:"+n,"SUMMARY:"+esc2("Entrega: "+s.entregavel+" ("+c.marca+")"),
    "DESCRIPTION:"+esc2((s.acao?"Sua parte: "+s.acao+"\n":"")+"Acompanhe em "+CFG.siteUrl),"URL:"+CFG.siteUrl,"END:VEVENT","END:VCALENDAR"].join("\r\n");
  const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([ics],{type:"text/calendar"}));a.download="entrega-"+s.nome.toLowerCase().normalize("NFD").replace(/[^a-z0-9]+/g,"-")+".ics";
  document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},500);toast("Abra o arquivo para salvar no seu calendário");
}
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
  const {data,error}=await sb.from("projects").select("*, steps(*), final_items(*), testimonials(*)").order("created_at",{ascending:false});
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
        <div class="field"><label for="lp">Senha</label><div class="pw"><input id="lp" type="password" autocomplete="current-password"><button type="button" id="lpt" aria-label="Mostrar senha">Mostrar</button></div><span class="caps" id="caps" aria-live="polite"></span></div>
        <div class="err" id="lerr" role="alert"></div>
        <button class="btn ink" type="submit" id="lbtn" style="padding:14px">Entrar</button>
        <p class="sub" style="margin-top:4px">Esqueceu a senha? Fale com o Edson que ele gera uma nova para você.</p>
      </form>
    </div>
  </div>`;
  $("lpt").onclick=()=>{const i=$("lp"),show=i.type==="password";i.type=show?"text":"password";$("lpt").textContent=show?"Ocultar":"Mostrar";$("lpt").setAttribute("aria-label",show?"Ocultar senha":"Mostrar senha");i.focus()};
  $("lp").addEventListener("keyup",e=>{if(e.getModifierState)$("caps").textContent=e.getModifierState("CapsLock")?"Caps Lock ligado":""});
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
      <div style="display:flex;gap:8px">${asAdmin?`<button class="btn light sm" id="back" type="button">Voltar ao painel</button>`:`<div class="acct">
        <button class="acct-btn" id="acct" type="button" aria-haspopup="menu" aria-expanded="false"><span class="av">${c.photo?`<img src="${esc(c.photo)}" alt="">`:esc((c.contato||"?").trim().charAt(0).toUpperCase())}</span><span class="acct-name">${esc(c.contato)}</span><svg class="chev" width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M2.5 4.5L6 8l3.5-3.5"/></svg></button>
        <div class="acct-menu" id="acctm" role="menu" hidden>
          <div class="acct-who"><b>${esc(c.contato)}</b><span>${esc(c.marca)}</span></div>
          <button type="button" role="menuitem" id="pw"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="4" y="10" width="16" height="11" rx="3"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>Trocar senha</button>
          <button type="button" role="menuitem" id="out"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l5-5-5-5M15 12H4"/></svg>Sair</button>
        </div></div>`}</div>
    </div>
    <div class="hero">
      <div>
        <div class="hero-id">${c.photo?`<img class="cphoto" src="${esc(c.photo)}" alt="Foto de ${esc(c.contato)}">`:""}<div class="hello">Boas-vindas, ${esc(c.contato)}.</div></div>
        <h1>${esc(c.titulo)}</h1>
        <p class="desc">${esc(c.descricao)}</p>
      </div>
      <div class="pbox" role="group" aria-label="Progresso do projeto">
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
    <div class="tabs-wrap" id="tw"><nav class="tabs" aria-label="Seções do portal">
      <button type="button" data-go="etapas" aria-current="true">Etapas</button>
      <button type="button" data-go="cronograma">Cronograma</button>
      <button type="button" data-go="entrega">Entrega<span class="hide-m"> final</span></button>
      <button type="button" data-go="arquivos">Arquivos</button>
    </nav>
    <div class="mini" aria-hidden="true"><b>${esc(c.titulo)}</b><span class="mbar"><i style="width:${pct}%"></i></span><span class="mp">${pct}%</span></div></div>

    <section class="block" id="etapas" aria-labelledby="h1e" style="padding-top:20px">
      <div class="sec-head"><div><h2 id="h1e">Etapas do projeto</h2><p>O caminho completo do que a gente fechou. Cada entrega libera aqui assim que a etapa termina.</p></div>
        <div class="legend"><span class="tag concluida">Concluída</span><span class="tag andamento">Em andamento</span><span class="tag afazer">A fazer</span><span class="tag entrega">Entrega</span></div></div>
      <div class="rail">${railHTML(c,fases)}</div>
    </section>

    <section class="block" id="cronograma" aria-labelledby="h2c">
      <div class="sec-head"><div><h2 id="h2c">Cronograma</h2><p>As datas de cada etapa. O losango marca o dia da entrega e a linha laranja marca hoje.</p></div>
        <div class="toggle" role="group" aria-label="Formato do cronograma"><button type="button" data-mode="linha" aria-pressed="${calMode==="linha"}">Linha do tempo</button><button type="button" data-mode="mes" aria-pressed="${calMode==="mes"}">Calendário</button></div></div>
      <div class="panel" id="cal-panel">${calHTML(c)}</div>
    </section>

    ${finalHTML(c)}

    <section class="block" id="arquivos" aria-labelledby="h3a">
      <div class="sec-head"><div><h2 id="h3a">Arquivos</h2><p>Tudo o que já foi entregue, num lugar só.</p></div></div>
      <div class="files">${c.steps.map(fileHTML).join("")}</div>
    </section>

    ${depHTML(c)}

    <div class="contact"><div><h3>Ficou alguma dúvida sobre o projeto?</h3><p>Me chama direto. Respondo em até um dia útil.</p></div>${c.whats?`<a class="btn orange" href="https://wa.me/${esc(c.whats.replace(/\D/g,""))}" target="_blank" rel="noopener">Falar com o Edson</a>`:""}</div>
    <footer><span>© Edson Mota, estratégia de marca e direção criativa</span><span class="num">Atualizado ${ago(upd)}</span></footer>
  </div>`;

  const pn=$("pctn");
  if(pn&&!reduce){const t0=performance.now();const stepf=t=>{const k=Math.min(1,(t-t0)/1200);pn.textContent=Math.round(pct*(1-Math.pow(1-k,3)));if(k<1)requestAnimationFrame(stepf)};requestAnimationFrame(stepf)}
  requestAnimationFrame(()=>requestAnimationFrame(()=>app.querySelectorAll("[data-w]").forEach(el=>el.style.width=el.dataset.w+"%")));

  if($("out"))$("out").onclick=logout;
  if($("pw"))$("pw").onclick=()=>{closeAcct();changePassword()};
  const ab=$("acct"),am=$("acctm");
  function closeAcct(){if(am){am.hidden=true;ab.setAttribute("aria-expanded","false")}}
  if(ab){ab.onclick=e=>{e.stopPropagation();const open=am.hidden;am.hidden=!open;ab.setAttribute("aria-expanded",String(open));if(open)am.querySelector("button").focus()};
    document.addEventListener("click",e=>{if(!e.target.closest(".acct"))closeAcct()});
    document.addEventListener("keydown",e=>{if(e.key==="Escape")closeAcct()})}
  if($("back"))$("back").onclick=()=>{asAdmin=false;view="admin";render();window.scrollTo(0,0)};
  app.querySelectorAll("[data-go]").forEach(b=>b.onclick=()=>$(b.dataset.go).scrollIntoView({behavior:reduce?"auto":"smooth"}));
  bindCal(c);
  if(window.__mq)window.__mq.onchange=null;
  window.__mq=window.matchMedia("(max-width:640px)");window.__mq.onchange=()=>{const cp=$("cal-panel");if(cp){cp.innerHTML=calHTML(c);bindCal(c)}};
  bindDep(c);
  app.querySelectorAll("[data-ics]").forEach(b=>b.onclick=()=>icsFor(c,c.steps[+b.dataset.ics]));
  const ids=["etapas","cronograma","entrega","arquivos"];
  const tw=$("tw"),heroEnd=()=>app.querySelector(".top-dark").getBoundingClientRect().bottom;
  window.onscroll=()=>{tw.classList.toggle("stuck",heroEnd()<0);let act="etapas";ids.forEach(id=>{const el=$(id);if(el&&el.getBoundingClientRect().top<140)act=id});
    app.querySelectorAll("[data-go]").forEach(b=>b.setAttribute("aria-current",b.dataset.go===act))};
}
function finalHTML(c){
  if(!c.finals||!c.finals.length)return"";
  const ready=c.finals.filter(f=>/^https?:\/\//i.test(f.link)).length,sp=span(c),fim=sp?fmt(iso(sp.b)):"";
  return `<section class="block" id="entrega" aria-labelledby="h4f"><div class="final">
    <div class="final-head"><div><h2 id="h4f">Sua entrega final</h2><p>No fim do projeto, é isto que fica com você. Cada item libera aqui assim que estiver pronto.</p></div>
      <div class="final-count num"><b>${ready}</b><span>de ${c.finals.length} itens prontos</span></div></div>
    <div class="final-grid">${c.finals.map((f,i)=>{const ok=/^https?:\/\//i.test(f.link);
      return `<article class="fi${ok?" ok":""}"><div class="fi-top"><span class="fi-n num">${String(i+1).padStart(2,"0")}</span>${f.formato?`<span class="fi-f">${esc(f.formato)}</span>`:""}</div>
        <h3>${esc(f.nome)}</h3><p>${esc(f.desc)}</p>
        <div class="fi-act">${ok?`<a class="btn orange sm" href="${esc(f.link)}" target="_blank" rel="noopener"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 4v11M7 10l5 5 5-5M5 20h14"/></svg>Baixar</a>`:`<span class="fi-lock"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="11" width="14" height="10" rx="2.5"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>Na entrega final${fim?", "+fim:""}</span>`}</div></article>`}).join("")}</div>
  </div></section>`;
}
function depHTML(c){
  if(!c.depOpen)return `<section class="block" id="depoimento"><div class="dep dep-locked"><div class="dep-ic"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 15a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3zM19 11a7 7 0 0 1-14 0M12 18v3"/></svg></div><div><h3>Seu depoimento</h3><p>Quando o projeto terminar, este espaço abre para você contar como foi, em vídeo, áudio ou texto.</p></div></div></section>`;
  if(c.deps&&c.deps.length)return `<section class="block" id="depoimento"><div class="dep dep-done"><div class="dep-ic ok"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></div><div><h3>Obrigado pelo depoimento, ${esc(c.contato)}.</h3><p>Recebi aqui. Ele ajuda outras marcas a entenderem como é trabalhar comigo.</p></div></div></section>`;
  return `<section class="block" id="depoimento" aria-labelledby="h5d"><div class="dep dep-open">
    <div class="dep-intro"><span class="dep-badge">Projeto concluído</span><h2 id="h5d">Conta como foi?</h2>
      <p>Seu depoimento ajuda outras marcas a entenderem como é esse processo. Pode ser curtinho, do seu jeito.</p>
      <ul class="dep-q"><li>Como estava a sua marca antes do projeto?</li><li>O que mudou depois?</li><li>Para quem você indicaria esse trabalho?</li></ul></div>
    <div class="dep-box">
      <div class="dep-opts" role="tablist" aria-label="Formato do depoimento">
        <button type="button" role="tab" data-dep="video" aria-selected="true"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="6" width="13" height="12" rx="3"/><path d="M16 10l5-3v10l-5-3"/></svg>Vídeo</button>
        <button type="button" role="tab" data-dep="audio" aria-selected="false"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 15a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3zM19 11a7 7 0 0 1-14 0M12 18v3"/></svg>Áudio</button>
        <button type="button" role="tab" data-dep="texto" aria-selected="false"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 6h16M4 12h16M4 18h10"/></svg>Texto</button>
      </div>
      <div class="dep-panel" id="depPanel"></div>
    </div></div></section>`;
}
let depRec=null;
function bindDep(c){
  const panel=$("depPanel");if(!panel)return;
  const preview=asAdmin;
  const sendBtn=(id,label)=>`<button class="btn orange" type="button" id="${id}"${preview?" disabled":""}>${label}</button>${preview?`<p class="dep-note">Visualização do admin: o envio fica só com o cliente.</p>`:""}`;
  const show=kind=>{
    app.querySelectorAll("[data-dep]").forEach(b=>b.setAttribute("aria-selected",String(b.dataset.dep===kind)));
    if(depRec){try{depRec.stop()}catch(e){}depRec=null}
    if(kind==="video"){
      panel.innerHTML=`<p class="dep-tip">Grave com o celular <b>na vertical</b>, em até 1 minuto. Fale seu nome, sua marca e como foi o processo.</p>
        <label class="dep-pick"><input type="file" id="vf" accept="video/*" capture="user" hidden><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="6" width="13" height="12" rx="3"/><path d="M16 10l5-3v10l-5-3"/></svg><span>Gravar ou escolher vídeo</span></label>
        <div id="vprev"></div>`;
      $("vf").onchange=()=>{const f=$("vf").files[0];if(!f)return;
        if(f.size>50*1024*1024){toast("O vídeo passou de 50 MB. Tente gravar um pouco mais curto.",true);return}
        $("vprev").innerHTML=`<video class="dep-video" src="${URL.createObjectURL(f)}" controls playsinline></video>${sendBtn("vsend","Enviar vídeo")}`;
        if($("vsend"))$("vsend").onclick=()=>sendDep(c,"video",f,"",$("vsend"))};
    }else if(kind==="audio"){
      const can=!!(navigator.mediaDevices&&window.MediaRecorder);
      panel.innerHTML=`<p class="dep-tip">Aperte para gravar e fale com calma. Quando terminar, aperte de novo.</p>
        ${can?`<div class="rec"><button type="button" class="rec-btn" id="recb" aria-label="Começar a gravar"><span></span></button><div><b id="rect" class="num">0:00</b><small id="recs">Pronto para gravar</small></div></div>`:""}
        <label class="dep-pick small"><input type="file" id="af" accept="audio/*" hidden><span>${can?"Ou envie um áudio que você já gravou":"Enviar um áudio do celular"}</span></label>
        <div id="aprev"></div>`;
      const showAudio=(blob,name)=>{$("aprev").innerHTML=`<audio class="dep-audio" src="${URL.createObjectURL(blob)}" controls></audio>${sendBtn("asend","Enviar áudio")}`;
        if($("asend"))$("asend").onclick=()=>sendDep(c,"audio",blob,"",$("asend"),name)};
      $("af").onchange=()=>{const f=$("af").files[0];if(f){if(f.size>50*1024*1024)return toast("O áudio passou de 50 MB.",true);showAudio(f,f.name)}};
      if(can)$("recb").onclick=async()=>{
        if(depRec&&depRec.state==="recording"){depRec.stop();return}
        try{const st=await navigator.mediaDevices.getUserMedia({audio:true});
          const mime=["audio/mp4","audio/webm;codecs=opus","audio/webm"].find(t=>MediaRecorder.isTypeSupported&&MediaRecorder.isTypeSupported(t))||"";
          const chunks=[];depRec=new MediaRecorder(st,mime?{mimeType:mime}:undefined);
          const t0=Date.now();const tick=setInterval(()=>{const s2=Math.floor((Date.now()-t0)/1000);$("rect").textContent=Math.floor(s2/60)+":"+String(s2%60).padStart(2,"0");if(s2>=180&&depRec)depRec.stop()},250);
          depRec.ondataavailable=e=>{if(e.data.size)chunks.push(e.data)};
          depRec.onstop=()=>{clearInterval(tick);st.getTracks().forEach(t=>t.stop());$("recb").classList.remove("on");$("recs").textContent="Gravado. Ouça antes de enviar.";
            const type=(depRec&&depRec.mimeType)||mime||"audio/webm";const blob=new Blob(chunks,{type:type.split(";")[0]});depRec=null;showAudio(blob,"")};
          depRec.start();$("recb").classList.add("on");$("recs").textContent="Gravando. Aperte para parar.";
        }catch(e){toast("Não consegui acessar o microfone. Libere o acesso no navegador ou envie um arquivo de áudio.",true)}
      };
    }else{
      panel.innerHTML=`<p class="dep-tip">Escreva do seu jeito. Pode ser curtinho.</p>
        <div class="field"><label for="dt">Seu depoimento</label><textarea id="dt" rows="6" placeholder="Antes do projeto, a minha marca..."></textarea></div>${sendBtn("tsend","Enviar depoimento")}`;
      if($("tsend"))$("tsend").onclick=()=>{const t=$("dt").value.trim();if(t.length<10)return toast("Escreva um pouco mais antes de enviar.",true);sendDep(c,"texto",null,t,$("tsend"))};
    }
  };
  app.querySelectorAll("[data-dep]").forEach(b=>b.onclick=()=>show(b.dataset.dep));
  show("video");
}
async function sendDep(c,kind,file,body,btn,name){
  if(asAdmin||!session)return;
  btn.disabled=true;const old=btn.textContent;btn.textContent="Enviando...";
  try{
    let path="";
    if(file){const type=(file.type||"").split(";")[0]||(kind==="video"?"video/mp4":"audio/webm");
      const ext=((name||"").split(".").pop()||"").toLowerCase()||({"video/quicktime":"mov","video/mp4":"mp4","video/webm":"webm","audio/mp4":"m4a","audio/webm":"webm","audio/mpeg":"mp3","audio/ogg":"ogg","audio/wav":"wav"}[type]||"bin");
      path=session.user.id+"/"+Date.now()+"-"+kind+"."+ext;
      const {error:upErr}=await sb.storage.from("depoimentos").upload(path,file,{contentType:type,upsert:false});
      if(upErr)throw upErr}
    const {error}=await sb.from("testimonials").insert({project_id:c.id,client_user_id:session.user.id,kind,body:body||"",file_path:path});
    if(error)throw error;
    c.deps=[{kind,created_at:new Date().toISOString()}];
    const sec=$("depoimento");if(sec)sec.outerHTML=depHTML(c);
    toast("Depoimento enviado. Obrigado!");
  }catch(e){btn.disabled=false;btn.textContent=old;toast("Não deu para enviar: "+(e.message||e),true)}
}
function bindCal(c){
  app.querySelectorAll("[data-mode]").forEach(b=>b.onclick=()=>{calMode=b.dataset.mode;
    app.querySelectorAll("[data-mode]").forEach(x=>x.setAttribute("aria-pressed",x===b));
    $("cal-panel").innerHTML=calHTML(c);bindCal(c)});
  app.querySelectorAll("[data-cal]").forEach(b=>b.onclick=()=>{calMonth=new Date(calMonth.getFullYear(),calMonth.getMonth()+ +b.dataset.cal,1);
    $("cal-panel").innerHTML=calHTML(c);bindCal(c)});
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
      if(s.status==="andamento"){const p=spct(s),dleft=diff(today,parse(s.fim));
        out+=`<div class="rs andamento${pos}"><div class="node"><i></i></div><div class="rs-body">
          <article class="current">
            <div>
              <div class="top"><span class="n num">Etapa ${n}</span><span class="tag andamento">Em andamento</span><span class="of num">${i+1} de ${N}</span></div>
              <h3>${esc(s.nome)}</h3>
              <p class="d">${esc(s.desc)}</p>
              <div class="prog"><div class="prog-head num"><span>${fmt(s.inicio)}</span><b>${p}% desta etapa</b><span>${fmt(s.fim)}</span></div><div class="track"><i data-w="${p}"></i></div></div>
            </div>
            <div class="side">
              <div class="box"><small>Entrega desta etapa</small><b>${esc(s.entregavel)}</b>
                <div class="count num">${dleft>1?`<strong>${dleft}</strong><span>dias para ${fmt(s.fim)}</span>`:dleft===1?`<strong>1</strong><span>dia para ${fmt(s.fim)}</span>`:dleft===0?`<strong class="t">Hoje</strong><span>${fmt(s.fim)}</span>`:`<strong class="t">Nova data em breve</strong>`}</div>
                <button class="cal-add" type="button" data-ics="${i}"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>Adicionar ao calendário</button></div>
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
    :`<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#6B6B69" stroke-width="1.8"><rect x="5" y="11" width="14" height="10" rx="2.5"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>`;
  return `<div class="file${ok?"":" locked"}"><div class="ic">${ic}</div>
    <div><h4>${esc(s.entregavel)}</h4><p class="num">${esc(s.nome)}, ${ok?"entregue em "+fmt(s.fim):(s.status==="concluida"?"concluída em "+fmt(s.fim):"previsto para "+fmt(s.fim))}</p></div>
    ${ok?fileLink(s,"sm","Abrir<span class=\"hide-m\"> arquivo</span>"):`<span class="lock num">${s.status==="concluida"?"A caminho":"Libera "+fmt(s.fim)}</span>`}</div>`;
}
const isMob=()=>window.matchMedia("(max-width:640px)").matches;
const calHTML=c=>calMode==="linha"?(isMob()?ganttM(c):gantt(c)):(isMob()?monthM(c):month(c));
function ganttM(c){
  const sp=span(c);if(!sp)return"<p>Nenhuma etapa cadastrada ainda.</p>";
  const T=diff(sp.a,sp.b)+1,pos=d=>Math.max(0,Math.min(100,diff(sp.a,d)/T*100)),tp=(diff(sp.a,today)+.5)/T*100,show=tp>=0&&tp<=100;
  return `<div class="gm">
    <div class="gm-axis num"><span>${fmt(iso(sp.a))}</span>${show?`<span class="gm-hoje" style="left:${tp}%">Hoje</span>`:""}<span>${fmt(iso(sp.b))}</span></div>
    ${c.steps.map(s=>{const l=pos(parse(s.inicio)),w=Math.max(2.5,(diff(parse(s.inicio),parse(s.fim))+1)/T*100);
      return `<div class="gm-row ${s.status}">
        <div class="gm-head"><b>${esc(s.nome)}</b><span class="num">${fmt(s.inicio)} a ${fmt(s.fim)}</span></div>
        <div class="gm-track">${show?`<i class="gm-today" style="left:${tp}%"></i>`:""}<i class="gm-bar ${s.status}" style="left:${l}%;width:${w}%">${s.status==="andamento"?`<i style="width:${spct(s)}%"></i>`:""}</i><i class="gm-dia" style="left:${Math.min(100,l+w)}%"></i></div>
      </div>`}).join("")}
  </div>`;
}
function monthM(c){
  const y=calMonth.getFullYear(),m=calMonth.getMonth(),gs=monday(new Date(y,m,1)),first=iso(new Date(y,m,1)),last=iso(new Date(y,m+1,0));let cells="";
  for(let i=0;i<42;i++){const d=add(gs,i);if(i>=35&&d.getMonth()!==m)break;const ds=iso(d);
    const act=c.steps.filter(s=>s.inicio<=ds&&ds<=s.fim),ent=c.steps.some(s=>s.fim===ds);
    cells+=`<div class="dm${d.getMonth()!==m?" out":""}${ds===iso(today)?" today":""}${ent?" ent":""}"><span class="num">${d.getDate()}</span><span class="dots">${act.slice(0,3).map(s=>`<i class="${s.status}"></i>`).join("")}</span></div>`}
  const items=[];
  c.steps.forEach(s=>{if(s.inicio<=last&&s.fim>=first)items.push({d:s.inicio<first?first:s.inicio,html:`<span class="ag-d num">${fmt(s.inicio)} a ${fmt(s.fim)}</span><b>${esc(s.nome)}</b><span class="tag ${s.status}">${TAG[s.status]}</span>`});
    if(s.fim>=first&&s.fim<=last)items.push({d:s.fim+"z",html:`<span class="ag-d num">${fmt(s.fim)}</span><b>${esc(s.entregavel)}</b><span class="tag entrega">Entrega</span>`})});
  items.sort((a,b)=>a.d<b.d?-1:1);
  return `<div class="cal-head"><h3>${MESF[m]} de ${y}</h3><div class="cal-nav"><button type="button" data-cal="-1" aria-label="Mês anterior">‹</button><button type="button" data-cal="1" aria-label="Próximo mês">›</button></div></div>
    <div class="calm">${["S","T","Q","Q","S","S","D"].map(w=>`<div class="wd">${w}</div>`).join("")}${cells}</div>
    <div class="agenda">${items.length?items.map(x=>`<div class="ag">${x.html}</div>`).join(""):`<p class="ag-empty">Nada marcado neste mês.</p>`}</div>`;
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
function ring(p){const r=16,L=2*Math.PI*r;return `<svg width="40" height="40" viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="${r}" fill="none" stroke="#E9E9E7" stroke-width="4"/><circle cx="20" cy="20" r="${r}" fill="none" stroke="#F43217" stroke-width="4" stroke-linecap="round" stroke-dasharray="${(L*p/100).toFixed(1)} ${L.toFixed(1)}" transform="rotate(-90 20 20)"/><text x="20" y="24" text-anchor="middle" font-size="10" font-weight="700" fill="#0A0A0A" font-family="Helvetica Neue,Helvetica,Arial,sans-serif">${p}</text></svg>`}
function renderAdmin(){
  window.onscroll=null;
  const c=projects.find(x=>x.id===sel);
  app.innerHTML=`<div class="admin-top"><div class="wrap bar-top"><div class="mark"><b>Edson Mota</b><span>Painel de projetos</span></div><button class="btn light sm" id="out" type="button">Sair</button></div></div>
  <div class="wrap admin">
    <aside class="clients"><h3>Clientes</h3>
      ${projects.map(x=>{const cu=current(x);return`<button class="ci" type="button" data-sel="${esc(x.id)}" aria-current="${x.id===sel}">${ring(progress(x))}<span><b>${esc(x.marca||"Sem nome")}</b><small>${!x.hasAccess?"Sem acesso criado":(cu?esc(cu.nome)+" em andamento":"Concluído")}</small></span></button>`}).join("")}
      <button class="btn ink sm" type="button" id="newc" style="margin-top:8px">Novo cliente</button>
    </aside>
    <main class="editor">${c?editor(c):`<div class="card"><h3>Nenhum cliente ainda</h3><p class="hint">Clique em "Novo cliente" para cadastrar o primeiro projeto. As 6 etapas do projeto entram automaticamente.</p></div>`}</main>
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
  <div class="card"><h3>Entrega final</h3><p class="hint">O kit que fica com o cliente no fim do projeto. Ele vê a lista desde o início, e cada item libera quando você colar o link.</p>
    <div class="fl">${c.finals.map((f,i)=>`<div class="fl-row">
      <span class="n num">${String(i+1).padStart(2,"0")}</span>
      <div class="field"><label for="fn${i}">Item</label><input id="fn${i}" data-fi="${i}" data-fs="nome" value="${esc(f.nome)}"></div>
      <div class="field"><label for="ff${i}">Formato</label><input id="ff${i}" data-fi="${i}" data-fs="formato" value="${esc(f.formato)}"></div>
      <div class="field"><label for="fl${i}">Link para baixar${/^https?:/i.test(f.link)?` <em class="ok-dot">liberado</em>`:""}</label><input id="fl${i}" data-fi="${i}" data-fs="link" placeholder="https://" value="${esc(f.link)}"></div>
      <div class="field fl-wide"><label for="fd${i}">Descrição que o cliente vê</label><input id="fd${i}" data-fi="${i}" data-fs="desc" value="${esc(f.desc)}"></div>
      <button class="danger fl-del" type="button" data-fdel="${i}">Remover</button></div>`).join("")}</div>
    <button class="btn sm" type="button" id="addf" style="margin-top:14px">Adicionar item</button>
  </div>
  <div class="card"><h3>Foto do cliente</h3><p class="hint">Aparece em destaque no topo do portal dele.</p>
    <div class="ph-row"><div class="ph-prev">${c.photo?`<img src="${esc(c.photo)}" alt="">`:`<span>${esc((c.contato||"?").charAt(0).toUpperCase())}</span>`}</div>
      <div class="ph-act"><label class="btn ink sm"><input type="file" id="phf" accept="image/*" hidden>${c.photo?"Trocar foto":"Enviar foto"}</label>${c.photo?`<button class="danger" type="button" id="phdel">Remover foto</button>`:""}<small>JPG ou PNG. A foto é ajustada automaticamente.</small></div></div>
  </div>
  <div class="card"><h3>Depoimento</h3><p class="hint">O espaço de depoimento abre sozinho quando todas as etapas estão concluídas. Você também pode liberar antes.</p>
    <label class="sw"><input type="checkbox" id="depopen"${c.openFlag?" checked":""}><span></span>Liberar depoimento agora</label>
    <div class="dl" id="deplist">${c.deps.length?c.deps.map((d,i)=>`<div class="dl-row"><div><b>${{video:"Vídeo",audio:"Áudio",texto:"Texto"}[d.kind]||d.kind}</b><small>${new Date(d.created_at).toLocaleDateString("pt-BR")}</small></div>
      ${d.kind==="texto"?`<p class="dl-text">${esc(d.body)}</p>`:`<div class="dl-media" data-dmedia="${i}"><button class="btn sm" type="button" data-dplay="${i}">Ver ${d.kind==="video"?"vídeo":"áudio"}</button></div>`}
      <button class="danger" type="button" data-ddel="${i}">Apagar</button></div>`).join(""):`<p class="dl-empty">Nenhum depoimento recebido ainda.</p>`}</div>
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
function flash(state){const s=$("saved");if(!s)return;s.className="saved"+(state==="saving"?" saving":state==="err"?" err":"");s.textContent=state==="saving"?"Salvando...":(state==="err"?"Erro ao salvar":"Alterações salvas")}
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
      if(el.type==="date"){if(!el.value)return;const idx=+el.dataset.i,col=el.dataset.s;
        const before=el.defaultValue;saveNow("steps",s.id,{[SCOL[col]]:el.value}).then(ok=>{if(!ok)return;renderAdmin();
          const delta=before?diff(parse(before),parse(el.value)):0,rest=c.steps.slice(idx+1);
          if(col==="fim"&&delta&&rest.length)askShift(c,idx,delta)});return}
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
  bindExtras(c);
  $("preview").onclick=()=>{asAdmin=true;calMonth=null;view="portal";render();window.scrollTo(0,0)};
  [$("mkacc"),$("mkacc2")].forEach(b=>{if(b)b.onclick=()=>createAccess(c)});
  if($("resetpw"))$("resetpw").onclick=async()=>{const pass=genPass();
    const r=await callAdmin({action:"reset",project_id:c.id,password:pass});if(r)shareAccess(c,pass)};
  $("delc").onclick=async()=>{const b=$("delc");
    if(!b.classList.contains("armed")){b.classList.add("armed");b.textContent="Clique de novo para excluir de vez (o login do cliente também é apagado)";return}
    const r=await callAdmin({action:"remove",project_id:c.id});if(!r)return;
    projects=projects.filter(p=>p.id!==c.id);sel=projects[0]?projects[0].id:null;renderAdmin();toast("Cliente excluído")};
}
function bindExtras(c){
  app.querySelectorAll("[data-fi]").forEach(el=>el.oninput=()=>{const f=c.finals[+el.dataset.fi];f[el.dataset.fs]=el.value;queueSave("final_items",f.id,FCOL[el.dataset.fs],el.value)});
  app.querySelectorAll("[data-fdel]").forEach(b=>b.onclick=async()=>{
    if(!b.classList.contains("armed")){b.classList.add("armed");b.textContent="Clique de novo";return}
    const f=c.finals[+b.dataset.fdel];const {error}=await sb.from("final_items").delete().eq("id",f.id);
    if(error)return toast("Não removeu: "+error.message,true);c.finals.splice(+b.dataset.fdel,1);renderAdmin()});
  $("addf").onclick=async()=>{const {data,error}=await sb.from("final_items").insert({project_id:c.id,position:c.finals.length,name:"Novo item",description:"",format:""}).select().single();
    if(error)return toast("Não adicionou: "+error.message,true);c.finals.push(finalFromDb(data));renderAdmin()};
  $("phf").onchange=async()=>{const f=$("phf").files[0];if(!f)return;
    try{toast("Enviando foto...");const blob=await squareJpeg(f,900);const path=c.id+"/"+Date.now()+".jpg";
      const {error}=await sb.storage.from("fotos").upload(path,blob,{contentType:"image/jpeg",upsert:false});if(error)throw error;
      const url=sb.storage.from("fotos").getPublicUrl(path).data.publicUrl;
      if(await saveNow("projects",c.id,{photo_url:url})){c.photo=url;renderAdmin();toast("Foto atualizada")}
    }catch(e){toast("Não deu para enviar a foto: "+(e.message||e),true)}};
  if($("phdel"))$("phdel").onclick=async()=>{if(await saveNow("projects",c.id,{photo_url:""})){c.photo="";renderAdmin()}};
  $("depopen").onchange=async e=>{const v=e.target.checked;if(await saveNow("projects",c.id,{testimonial_open:v})){c.openFlag=v;c.depOpen=v||c.steps.every(x=>x.status==="concluida")}else e.target.checked=!v};
  app.querySelectorAll("[data-dplay]").forEach(b=>b.onclick=async()=>{const d=c.deps[+b.dataset.dplay];
    const {data,error}=await sb.storage.from("depoimentos").createSignedUrl(d.file_path,3600);if(error)return toast("Não abriu: "+error.message,true);
    const box=app.querySelector(`[data-dmedia="${b.dataset.dplay}"]`);
    box.innerHTML=d.kind==="video"?`<video class="dl-video" src="${data.signedUrl}" controls playsinline></video><a class="btn sm" href="${data.signedUrl}" target="_blank" rel="noopener">Baixar</a>`:`<audio src="${data.signedUrl}" controls></audio><a class="btn sm" href="${data.signedUrl}" target="_blank" rel="noopener">Baixar</a>`});
  app.querySelectorAll("[data-ddel]").forEach(b=>b.onclick=async()=>{
    if(!b.classList.contains("armed")){b.classList.add("armed");b.textContent="Clique de novo para apagar";return}
    const d=c.deps[+b.dataset.ddel];if(d.file_path)await sb.storage.from("depoimentos").remove([d.file_path]);
    const {error}=await sb.from("testimonials").delete().eq("id",d.id);if(error)return toast("Não apagou: "+error.message,true);
    c.deps.splice(+b.dataset.ddel,1);renderAdmin()});
}
function squareJpeg(file,size){return new Promise((res,rej)=>{const img=new Image();img.onload=()=>{const s2=Math.min(img.width,img.height),cv=document.createElement("canvas");
  const out=Math.min(size,s2);cv.width=cv.height=out;cv.getContext("2d").drawImage(img,(img.width-s2)/2,(img.height-s2)/2,s2,s2,0,0,out,out);
  cv.toBlob(b=>b?res(b):rej(new Error("imagem inválida")),"image/jpeg",.86);URL.revokeObjectURL(img.src)};img.onerror=()=>rej(new Error("não consegui ler a imagem"));img.src=URL.createObjectURL(file)})}
function askShift(c,idx,delta){
  const n=c.steps.length-idx-1,abs=Math.abs(delta),dias=abs===1?"1 dia":abs+" dias";
  modal(delta>0?"A entrega atrasou "+dias:"A entrega adiantou "+dias,`<p>Quer mover as ${n} etapas seguintes junto, para o cronograma continuar fazendo sentido para o cliente?</p>
    <div class="row"><button class="btn" type="button" data-close>Só esta etapa</button><button class="btn ink" type="button" id="shy">Mover as ${n} seguintes</button></div>`,
  ()=>{$("shy").onclick=async()=>{$("shy").disabled=true;$("shy").textContent="Movendo...";
    for(const s of c.steps.slice(idx+1)){const ni=iso(add(parse(s.inicio),delta)),nf=iso(add(parse(s.fim),delta));
      if(await saveNow("steps",s.id,{start_date:ni,end_date:nf})){s.inicio=ni;s.fim=nf}}
    closeModal();renderAdmin();toast("Cronograma atualizado")}});
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
    await sb.from("final_items").insert(FINAIS.map((f,i)=>({project_id:p.id,position:i,name:f[0],description:f[1],format:f[2]})));
    await loadProjects();sel=p.id;openRow=-1;closeModal();renderAdmin();
    const c=projects.find(x=>x.id===p.id);if(c)createAccess(c)}});
}

boot().catch(e=>{console.error(e);app.innerHTML=`<div class="loading">Não deu para carregar a plataforma. Recarregue a página.</div>`});
})();
