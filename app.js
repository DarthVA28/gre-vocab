const CONFIG = window.GRE_CONFIG || {};
const $ = (id) => document.getElementById(id);
const views = ['authView','dashboardView','practiceView','browseView','setupView'];
let supabaseClient = null;
let words = [];
let progress = {};
let currentUser = null;
let authMode = 'login';
let currentSessionType = 'new';
let sessionWords = [];
let sessionIndex = 0;

function showView(id) { views.forEach(v => $(v).classList.toggle('hidden', v !== id)); }
function setUserMenu(on) { $('userMenu').classList.toggle('hidden', !on); }
function showToast(msg) { const t=$('toast'); t.textContent=msg; t.classList.add('show'); clearTimeout(showToast._t); showToast._t=setTimeout(()=>t.classList.remove('show'),2400); }
function prettyStatus(s) { return s[0].toUpperCase()+s.slice(1); }
function currentStatus(wordId) { return progress[String(wordId)] || 'new'; }
function counts() {
  const confident = Object.values(progress).filter(x=>x==='confident').length;
  const review = Object.values(progress).filter(x=>x==='review').length;
  return { confident, review, new: words.length-confident-review };
}
function updateDashboard() {
  const c = counts();
  if ($('newCount')) $('newCount').textContent = c.new;
  if ($('reviewCount')) $('reviewCount').textContent = c.review;
  if ($('confidentCount')) $('confidentCount').textContent = c.confident;
  if ($('wordBankCount')) $('wordBankCount').textContent = words.length;
}

async function loadWords() {
  const res = await fetch('./words.json', {cache:'no-store'});
  if (!res.ok) throw new Error('Could not load words.json');
  words = await res.json();
}
async function loadProgress() {
  if (!currentUser) return;
  const {data,error}=await supabaseClient.from('word_progress').select('word_id,status').eq('user_id',currentUser.id);
  if (error) throw error;
  progress={};
  for (const row of (data||[])) progress[String(row.word_id)] = row.status;
  updateDashboard();
}
async function saveStatus(wordId,status) {
  const row={user_id:currentUser.id,word_id:wordId,status,updated_at:new Date().toISOString()};
  const {error}=await supabaseClient.from('word_progress').upsert(row,{onConflict:'user_id,word_id'});
  if (error) throw error;
  progress[String(wordId)]=status;
}

function setAuthMode(mode) {
  authMode=mode;
  document.querySelectorAll('.tab').forEach(b=>b.classList.toggle('active',b.dataset.auth===mode));
  $('authSubmit').textContent=mode==='login'?'Log in':'Create account';
  $('passwordInput').autocomplete=mode==='login'?'current-password':'new-password';
  $('usernameInput').required=mode==='signup';
  $('usernameField').classList.toggle('hidden', mode==='login');
  $('emailInput').autocomplete=mode==='login'?'username':'email';
  $('authMessage').textContent='';
}

async function handleAuth(e) {
  e.preventDefault();
  if (!supabaseClient) return;
  const username=$('usernameInput').value.trim();
  const email=$('emailInput').value.trim().toLowerCase();
  const password=$('passwordInput').value;
  $('authMessage').textContent='';
  $('authSubmit').disabled=true;
  try {
    if(authMode==='signup') {
      if(!username) throw new Error('Please choose a username.');
      const {data,error}=await supabaseClient.auth.signUp({email,password,options:{data:{username}}});
      if(error) throw error;
      if(!data.session) {
        $('authMessage').textContent='Account created. Check your email to confirm it, then log in.';
        return;
      }
      showToast('Account created');
    } else {
      const {error}=await supabaseClient.auth.signInWithPassword({email,password});
      if(error) throw error;
      showToast('Welcome back');
    }
  } catch(err) { $('authMessage').textContent=err.message || 'Something went wrong.'; }
  finally { $('authSubmit').disabled=false; }
}

async function logout() { await supabaseClient.auth.signOut(); }

function buildSession(type) {
  currentSessionType=type;
  let pool=words.filter(w=>currentStatus(w.word_id)===type);
  if(type==='new') pool = pool.filter(w=>currentStatus(w.word_id)==='new');
  if(!pool.length) { showToast(`No ${type} words left.`); return false; }
  // Shuffle and cap the session so it feels like a session rather than one giant deck.
  if(type==='new') pool=pool.slice().sort(()=>Math.random()-0.5).slice(0,10);
  sessionWords=pool; sessionIndex=0; renderWord(); showView('practiceView'); return true;
}
function renderWord() {
  const w=sessionWords[sessionIndex];
  if(!w) return;
  $('practiceLabel').textContent=`${prettyStatus(currentSessionType)} words`;
  $('progressLabel').textContent=`${sessionIndex+1} / ${sessionWords.length}`;
  $('sessionProgress').style.width=`${((sessionIndex+1)/sessionWords.length)*100}%`;
  $('wordNumber').textContent=`WORD ${sessionIndex+1}`;
  $('wordStatusPill').textContent=currentStatus(w.word_id).toUpperCase();
  $('wordStatusPill').className=`status-pill ${currentStatus(w.word_id)}`;
  $('wordText').textContent=w.word;
  $('hintText').textContent=w.hint;
  $('meaningText').textContent=w.definition;
  $('hintText').classList.add('hidden');
  $('showHintBtn').classList.remove('hidden');
  $('showMeaningBtn').classList.remove('hidden');
  $('answerArea').classList.add('hidden');
  $('pileButtons').classList.add('hidden');
}
function showHint() { $('hintText').classList.remove('hidden'); $('showHintBtn').classList.add('hidden'); }
function showMeaning() { $('answerArea').classList.remove('hidden'); $('showMeaningBtn').classList.add('hidden'); $('pileButtons').classList.remove('hidden'); renderPileButtons(); }
function renderPileButtons() {
  const area=$('pileButtons'); area.innerHTML='';
  let buttons=[];
  if(currentSessionType==='new') buttons=[['review','Add to Review'],['confident','I’m Confident']];
  if(currentSessionType==='review') buttons=[['review','Keep in Review'],['confident','Move to Confident']];
  if(currentSessionType==='confident') buttons=[['confident','Still Confident'],['review','Needs Review']];
  buttons.forEach(([status,label])=>{ const b=document.createElement('button'); b.className=`pile-btn ${status}`; b.textContent=label; b.onclick=()=>advance(status); area.appendChild(b); });
}
async function advance(status) {
  const w=sessionWords[sessionIndex];
  try { await saveStatus(w.word_id,status); updateDashboard(); }
  catch(err){ showToast(err.message||'Could not save progress'); return; }
  sessionIndex++;
  if(sessionIndex>=sessionWords.length) { showToast('Session complete 🎉'); showView('dashboardView'); return; }
  renderWord();
}

function renderBrowse() {
  const q=$('searchInput').value.trim().toLowerCase(); const f=$('statusFilter').value;
  const filtered=words.filter(w=>(!q||w.word.toLowerCase().includes(q)) && (f==='all'||currentStatus(w.word_id)===f));
  const list=$('wordList'); list.innerHTML='';
  filtered.forEach(w=>{
    const row=document.createElement('div'); row.className='word-row';
    const st=currentStatus(w.word_id);
    row.innerHTML=`<div class="word-row-main"><strong>${escapeHtml(w.word)}</strong><small>${escapeHtml(w.definition)}</small></div><span class="row-pill ${st}">${st}</span>`;
    list.appendChild(row);
  });
  if(!filtered.length) list.innerHTML='<div class="tip-card"><div><strong>No words found.</strong><p>Try a different search or filter.</p></div></div>';
}
function escapeHtml(s){return s.replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));}

function wireUI() {
  document.querySelectorAll('.tab').forEach(b=>b.onclick=()=>setAuthMode(b.dataset.auth));
  $('authForm').onsubmit=handleAuth;
  $('logoutBtn').onclick=logout;
  $('brandBtn').onclick=()=>currentUser?showView('dashboardView'):showView('authView');
  document.querySelectorAll('[data-start]').forEach(b=>b.onclick=()=>buildSession(b.dataset.start));
  $('practiceBack').onclick=()=>showView('dashboardView');
  $('showHintBtn').onclick=showHint;
  $('showMeaningBtn').onclick=showMeaning;
  $('browseBtn').onclick=()=>{renderBrowse();showView('browseView');};
  $('browseBack').onclick=()=>showView('dashboardView');
  $('searchInput').oninput=renderBrowse; $('statusFilter').onchange=renderBrowse;
}

async function init() {
  wireUI();
  setAuthMode('login');
  try { await loadWords(); } catch(err) { showView('setupView'); return; }
  if(!CONFIG.supabaseUrl || !CONFIG.supabaseKey) { showView('setupView'); return; }
  if(!window.supabase) { showView('setupView'); return; }
  supabaseClient=window.supabase.createClient(CONFIG.supabaseUrl,CONFIG.supabaseKey);
  const {data}=await supabaseClient.auth.getSession();
  if(data.session) await onSignedIn(data.session.user); else showView('authView');
  supabaseClient.auth.onAuthStateChange(async (_event,session)=>{ if(session) await onSignedIn(session.user); else { currentUser=null; setUserMenu(false); showView('authView'); } });
}
async function onSignedIn(user) {
  currentUser=user;
  const username=user.user_metadata?.username || user.email?.split('@')[0] || 'friend';
  $('userNameLabel').textContent=username;
  setUserMenu(true);
  await loadProgress();
  showView('dashboardView');
}
init();
