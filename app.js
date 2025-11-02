// Tabs
const tabs = document.querySelectorAll('.tabs button');
const views = document.querySelectorAll('.tab');
tabs.forEach(btn => btn.addEventListener('click', () => {
  tabs.forEach(b => b.classList.remove('active'));
  views.forEach(v => v.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById(btn.dataset.tab).classList.add('active');
}));

// Clock
function refreshClock(){
  const d = new Date();
  document.getElementById('date').textContent = d.toLocaleDateString('cs-CZ', {weekday:'long', year:'numeric', month:'long', day:'numeric'});
  document.getElementById('time').textContent = d.toLocaleTimeString('cs-CZ');
}
setInterval(refreshClock, 1000); refreshClock();

// Storage helpers
const store = {
  get(key, fallback){ try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } },
  set(key, value){ localStorage.setItem(key, JSON.stringify(value)); }
};

// ---------- Chat (mock + commands) ----------
const chatLog = document.getElementById('chatLog');
const chatDraft = document.getElementById('chatDraft');
const sendBtn = document.getElementById('sendBtn');
const messages = store.get('messages', [{role:'assistant', content:'Ahoj, jsem Lussy. /note, /task, /reminder fungují. Teď také export/import a projekty.'}]);

function renderChat(){
  chatLog.innerHTML = '';
  messages.forEach(m => {
    const div = document.createElement('div');
    div.className = 'msg ' + (m.role==='assistant'?'assistant':'user');
    div.textContent = m.content;
    chatLog.appendChild(div);
  });
  chatLog.scrollTop = chatLog.scrollHeight;
}
renderChat();

sendBtn?.addEventListener('click', () => handleSend());
chatDraft?.addEventListener('keydown', e => {
  if(e.key === 'Enter' && !e.shiftKey){ e.preventDefault(); handleSend(); }
});
function handleSend(){
  const text = chatDraft.value.trim();
  if(!text) return;
  chatDraft.value = '';
  messages.push({role:'user', content:text}); store.set('messages', messages); renderChat();
  if(handleCommands(text)) return;
  setTimeout(() => {
    const reply = 'Lussy (mock): Rozumím – ' + text;
    messages.push({role:'assistant', content: reply}); store.set('messages', messages); renderChat();
  }, 250);
}
function handleCommands(t){
  const text = t.trim();
  if(text.toLowerCase().startsWith('/note')){
    const payload = text.slice(5).trim();
    const [title, body] = payload.split('|').map(s => (s||'').trim());
    addNote({folder:'', title:title||'Poznámka', body:body||''});
    pushAssistant('✅ Uložila jsem poznámku: ' + (title||'Poznámka'));
    return true;
  }
  if(text.toLowerCase().startsWith('/task')){
    const payload = text.slice(5).trim();
    const [title, detail] = payload.split('|').map(s => (s||'').trim());
    addTask({folder:'', title:title||'Úkol', detail:detail||''});
    pushAssistant('✅ Přidala jsem úkol: ' + (title||'Úkol'));
    return true;
  }
  if(text.toLowerCase().startsWith('/reminder')){
    const payload = text.slice(9).trim();
    const [title, when] = payload.split('|').map(s => (s||'').trim());
    const dueAt = when ? parseCsDate(when) : null;
    addReminder({title:title||'Připomínka', dueAt});
    pushAssistant('✅ Nastavila jsem upomínku: ' + (title||'Připomínka'));
    return true;
  }
  return false;
}
function pushAssistant(text){
  messages.push({role:'assistant', content:text}); store.set('messages', messages); renderChat();
}

// ---------- Notes (with tree) ----------
const notesTree = document.getElementById('notesTree');
const noteForm = document.getElementById('noteForm');
let notes = store.get('notes', []);
function addNote({folder, title, body}){
  notes.push({id:crypto.randomUUID(), folder:folder||'Obecné', title, body, createdAt:Date.now(), updatedAt:Date.now()});
  store.set('notes', notes); renderNotes();
}
noteForm?.addEventListener('submit', e => {
  e.preventDefault();
  addNote({folder:document.getElementById('noteFolder').value.trim()||'Obecné',
           title:document.getElementById('noteTitle').value.trim(),
           body:document.getElementById('noteBody').value.trim()});
  noteForm.reset();
});
function renderNotes(){
  notesTree.innerHTML = '';
  const groups = groupBy(notes, 'folder');
  Object.keys(groups).sort().forEach(folder => {
    const box = document.createElement('div'); box.className = 'folder';
    const title = document.createElement('div'); title.className = 'title'; title.textContent = '📁 ' + folder;
    const children = document.createElement('div'); children.className = 'children';
    groups[folder].forEach(n => {
      const row = document.createElement('div');
      row.innerHTML = `<strong>${escapeHtml(n.title||'Bez názvu')}</strong> — <small>${escapeHtml(n.body||'')}</small> <button data-id="${n.id}">✕</button>`;
      row.querySelector('button').addEventListener('click', ()=>{
        notes = notes.filter(x => x.id !== n.id); store.set('notes', notes); renderNotes();
      });
      children.appendChild(row);
    });
    title.addEventListener('click', ()=>children.classList.toggle('hidden'));
    box.appendChild(title); box.appendChild(children); notesTree.appendChild(box);
  });
}
renderNotes();

// ---------- Tasks (with tree) ----------
const tasksTree = document.getElementById('tasksTree');
const taskForm = document.getElementById('taskForm');
let tasks = store.get('tasks', []);
function addTask({folder, title, detail}){
  tasks.push({id:crypto.randomUUID(), folder:folder||'Obecné', title, detail, status:'backlog'});
  store.set('tasks', tasks); renderTasks();
}
taskForm?.addEventListener('submit', e => {
  e.preventDefault();
  addTask({folder:document.getElementById('taskFolder').value.trim()||'Obecné',
           title:document.getElementById('taskTitle').value.trim(),
           detail:document.getElementById('taskDetail').value.trim()});
  taskForm.reset();
});
function renderTasks(){
  tasksTree.innerHTML = '';
  const groups = groupBy(tasks, 'folder');
  Object.keys(groups).sort().forEach(folder => {
    const box = document.createElement('div'); box.className = 'folder';
    const title = document.createElement('div'); title.className = 'title'; title.textContent = '🗂️ ' + folder;
    const children = document.createElement('div'); children.className = 'children';
    groups[folder].forEach(t => {
      const row = document.createElement('div');
      row.innerHTML = `<strong>${escapeHtml(t.title||'Bez názvu')}</strong>${t.detail?(' — <small>'+escapeHtml(t.detail)+'</small>'):''} <button data-id="${t.id}">✕</button>`;
      row.querySelector('button').addEventListener('click', ()=>{
        tasks = tasks.filter(x => x.id !== t.id); store.set('tasks', tasks); renderTasks();
      });
      children.appendChild(row);
    });
    title.addEventListener('click', ()=>children.classList.toggle('hidden'));
    box.appendChild(title); box.appendChild(children); tasksTree.appendChild(box);
  });
}
renderTasks();

// ---------- Projects ----------
const projForm = document.getElementById('projForm');
const projList = document.getElementById('projList');
let projects = store.get('projects', []);
projForm?.addEventListener('submit', e => {
  e.preventDefault();
  const name = document.getElementById('projName').value.trim();
  if(!name) return;
  projects.push({id:crypto.randomUUID(), name});
  store.set('projects', projects); renderProjects();
  projForm.reset();
});
function renderProjects(){
  projList.innerHTML = '';
  projects.forEach((p,i)=>{
    const li = document.createElement('li');
    li.innerHTML = `<div><strong>${escapeHtml(p.name)}</strong></div><button data-i="${i}">✕</button>`;
    li.querySelector('button').addEventListener('click', ()=>{
      projects.splice(i,1); store.set('projects', projects); renderProjects();
    });
    projList.appendChild(li);
  });
}
renderProjects();

// ---------- Finance ----------
const finForm = document.getElementById('finForm');
const finList = document.getElementById('finList');
let finance = store.get('finance', []);
finForm?.addEventListener('submit', e => {
  e.preventDefault();
  const project = document.getElementById('finProject').value.trim();
  const category = document.getElementById('finCategory').value.trim();
  const amount = parseFloat(document.getElementById('finAmount').value.replace(',', '.'));
  if(!category || isNaN(amount)) return;
  finance.push({id:crypto.randomUUID(), date:Date.now(), project, category, amountCZK:amount});
  store.set('finance', finance); renderFinance();
  finForm.reset();
});
function renderFinance(){
  finList.innerHTML = '';
  finance.forEach((f,i)=>{
    const li = document.createElement('li');
    li.innerHTML = `<div><strong>${escapeHtml(f.category)}</strong><br><small>${new Date(f.date).toLocaleDateString('cs-CZ')} • ${escapeHtml(f.project||'')}</small></div><div><strong>${f.amountCZK.toFixed(2)} Kč</strong> <button data-i="${i}">✕</button></div>`;
    li.querySelector('button').addEventListener('click', ()=>{
      finance.splice(i,1); store.set('finance', finance); renderFinance();
    });
    finList.appendChild(li);
  });
}
renderFinance();

// ---------- Reminders (list + ICS + foreground alerts) ----------
const remList = document.getElementById('remList');
const remForm = document.getElementById('remForm');
let reminders = store.get('reminders', []);
const timers = {}; // foreground timers
remForm?.addEventListener('submit', e => {
  e.preventDefault();
  const title = document.getElementById('remTitle').value.trim();
  const when  = document.getElementById('remWhen').value.trim();
  const dueAt = when ? parseCsDate(when) : null;
  addReminder({title, dueAt});
  remForm.reset();
});
function addReminder({title, dueAt}){
  const r = {id:crypto.randomUUID(), title:title||'Připomínka', dueAt, isDone:false};
  reminders.push(r); store.set('reminders', reminders); renderReminders();
  scheduleForeground(r);
}
function renderReminders(){
  remList.innerHTML = '';
  reminders.forEach((r,i)=>{
    const when = r.dueAt ? new Date(r.dueAt).toLocaleString('cs-CZ') : '—';
    const li = document.createElement('li');
    li.innerHTML = `<div><strong>${escapeHtml(r.title)}</strong><br><small>${when}</small></div>
                    <div>
                      <button data-act="ics" data-i="${i}">.ics</button>
                      <button data-act="del" data-i="${i}">✕</button>
                    </div>`;
    li.querySelector('[data-act="del"]').addEventListener('click', ()=>{
      const idx = parseInt(li.querySelector('[data-act="del"]').dataset.i,10);
      clearTimer(reminders[idx]?.id);
      reminders.splice(idx,1); store.set('reminders', reminders); renderReminders();
    });
    li.querySelector('[data-act="ics"]').addEventListener('click', ()=>{
      const idx = parseInt(li.querySelector('[data-act="ics"]').dataset.i,10);
      downloadICS(reminders[idx]);
    });
    remList.appendChild(li);
  });
}
renderReminders();

function scheduleForeground(r){
  clearTimer(r.id);
  if(!r.dueAt) return;
  const delay = r.dueAt - Date.now();
  if(delay <= 0) return;
  timers[r.id] = setTimeout(()=>{
    // show a Notification if allowed; otherwise alert
    if(Notification.permission === 'granted'){
      new Notification('Lussy – upomínka', { body: r.title });
    } else {
      alert('🕒 Upomínka: ' + r.title);
    }
  }, Math.min(delay, 2147483647)); // max setTimeout
}
function clearTimer(id){
  if(timers[id]){ clearTimeout(timers[id]); delete timers[id]; }
}
// reschedule on load
reminders.forEach(scheduleForeground);

// ICS export
function downloadICS(r){
  const dt = r.dueAt ? new Date(r.dueAt) : new Date(Date.now()+3600000);
  const dtstart = dt.toISOString().replace(/[-:]/g,'').split('.')[0]+'Z';
  const dtend = new Date(dt.getTime()+30*60000).toISOString().replace(/[-:]/g,'').split('.')[0]+'Z';
  const ics = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Lussy PWA//CZ
BEGIN:VEVENT
UID:${r.id}
DTSTAMP:${dtstart}
DTSTART:${dtstart}
DTEND:${dtend}
SUMMARY:${escapeICS(r.title)}
END:VEVENT
END:VCALENDAR`;
  const blob = new Blob([ics], {type:'text/calendar'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'lussy-reminder.ics';
  a.click();
}

// ---------- Backup / Import ----------
document.getElementById('exportBtn')?.addEventListener('click', ()=>{
  const data = {messages, notes, tasks, reminders, projects, finance, exportedAt: Date.now()};
  const blob = new Blob([JSON.stringify(data,null,2)], {type:'application/json'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'lussy-backup.json';
  a.click();
});
document.getElementById('importBtn')?.addEventListener('click', ()=>{
  const file = document.getElementById('importFile').files[0];
  if(!file) return alert('Vyber soubor .json');
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      ['messages','notes','tasks','reminders','projects','finance'].forEach(k=>{
        if(Array.isArray(data[k])) localStorage.setItem(k, JSON.stringify(data[k]));
      });
      location.reload();
    } catch(e){
      alert('Import selhal: ' + e.message);
    }
  };
  reader.readAsText(file);
});

// ---------- Notifications & Push scaffold ----------
const notifBtn = document.getElementById('notifBtn');
notifBtn?.addEventListener('click', async ()=>{
  if(!('Notification' in window)) return alert('Prohlížeč nepodporuje Notification API.');
  const perm = await Notification.requestPermission();
  alert('Stav oprávnění: ' + perm + (perm==='granted'?' ✅':' ❌'));
});

const pushInfo = document.getElementById('pushInfo');
document.getElementById('pushSetupBtn')?.addEventListener('click', async ()=>{
  if(!('serviceWorker' in navigator)) return alert('Service worker není dostupný.');
  const reg = await navigator.serviceWorker.ready;
  // VAPID public key budeš doplnit (Base64URL) – zde jen placeholder:
  const vapidPublicKey = ''; // TODO: doplnit
  let sub;
  try {
    sub = await reg.pushManager.getSubscription();
    if(!sub){
      sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: vapidPublicKey?urlBase64ToUint8Array(vapidPublicKey):undefined });
    }
  } catch(e){
    pushInfo.textContent = 'Nelze vytvořit push subscription: ' + e;
    return;
  }
  pushInfo.textContent = 'Subscription JSON (ulož na server a použij pro web-push):\n' + JSON.stringify(sub, null, 2);
});

// PWA install prompt
let deferredPrompt;
const installBtn = document.getElementById('installBtn');
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  installBtn.hidden = false;
});
installBtn?.addEventListener('click', async () => {
  if(!deferredPrompt) return;
  deferredPrompt.prompt();
  await deferredPrompt.userChoice;
  installBtn.hidden = true;
});

// Helpers
function groupBy(arr, key){ return arr.reduce((acc,i)=>((acc[i[key]||'Obecné']=acc[i[key]||'Obecné']||[]).push(i),acc),{}); }
function parseCsDate(s){
  const parts = s.split(' ');
  const date = parts[0];
  const time = parts[1] || '09:00';
  return Date.parse(date + 'T' + time + ':00');
}
function escapeHtml(str){ return (str||'').replace(/[&<>"']/g, (m)=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[m])); }
function escapeICS(str){ return (str||'').replace(/([,;])/g, '\\$1'); }
function urlBase64ToUint8Array(base64String){
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i=0; i<rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

// Register SW
if('serviceWorker' in navigator){
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js');
  });
}
