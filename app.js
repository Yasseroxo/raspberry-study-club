(function(){
'use strict';

/* =====================================================================
   CONFIG  -  rename the app, greeting, colours and notes here.
   Sample subjects, tasks and assignments live in seed() further down.
   Colours of the whole interface live in the :root block of the CSS.
   ===================================================================== */
var CONFIG = {
  appName: 'Raspberry Study Club',
  subtitle: 'Your little corner for big ambitions.',
  defaultGreeting: 'Hey, Raspberry!',
  storageKey: 'raspberry-study-club:v1',
  focusMinutes: 25,
  breakMinutes: 5,
  subjectColors: ['#C72C55','#7A4FA3','#2F8077','#B9801F','#D2603A','#3F6FA3','#8A5A44','#5E8C61'],
  notes: [
    'Every small effort brings you closer to your goal.',
    'You do not need to be perfect. A little progress today is already a win.',
    'Twenty-five focused minutes beat an evening of feeling guilty.',
    'Resting is part of the work. Your brain will thank you.',
    'One chapter at a time. The rest can wait kindly.',
    'Mistakes are clues: they show you where to look next.',
    'You are allowed to go at your own pace.',
    'Believing in yourself is already a good revision method.',
    'Take a breath, drink some water, and start again gently.',
    'Observation: the biggest cases are solved in small, steady sessions.',
    'Lead of the day: start with the task you have been avoiding. Ten minutes is enough to crack it open.',
    'Note to self: a tidy summary after each lecture is the best evidence you can collect.',
    'Case update: consistency beats intensity. Twenty-five focused minutes count.',
    'Clue found: explaining an idea out loud shows exactly where the gaps are.',
    'Reminder: rest is part of the investigation. Breaks keep the mind sharp.',
    'Observation: deadlines feel smaller once they are broken into steps.',
    'Filed under progress: every ticked box is one loose end fewer.'
  ]
};

/* =====================================================================
   TYPES (JSDoc)
   @typedef {{id:string,name:string,description:string,lecturer:string,exam:string,progress:number,notes:string,materials:{label:string,url:string}[],chapters:{id:string,title:string,note:string,done:boolean}[],color:string,sample?:boolean}} Subject
   @typedef {{id:string,title:string,description:string,priority:''|'High'|'Medium'|'Low',subjectId:string,date:string,done:boolean,doneAt:string,sample?:boolean}} Task  (empty date = no due date)
   @typedef {{id:string,title:string,subjectId:string,due:string,priority:'High'|'Medium'|'Low',status:'Not Started'|'In Progress'|'Completed',notes:string,completedAt:string}} Assignment
   @typedef {{id:string,subjectId:string,date:string,start:string,duration:number,notes:string}} StudySession
   @typedef {{id:string,date:string,endedAt:number,minutes:number,subjectId:string}} FocusLog
   ===================================================================== */

/*CALC-START*/
var Calc = {
  /* Parses user text. A lone comma is a decimal comma; "1,250.5" drops thousands commas. */
  num: function(raw){
    var s = String(raw == null ? '' : raw).trim().replace(/\s+/g,'');
    if(s === '') return {ok:false, empty:true};
    var norm = s.indexOf('.') >= 0 ? s.replace(/,/g,'') : s.replace(',','.');
    if(!/^[-+]?(\d+\.?\d*|\.\d+)$/.test(norm)) return {ok:false, error:'Enter a number, for example 12.5'};
    var v = Number(norm);
    if(!isFinite(v)) return {ok:false, error:'That number is too large'};
    return {ok:true, value:v};
  },
  fmt: function(n, max){
    if(n == null || !isFinite(n)) return '-';
    if(Math.abs(n) < 1e-9) n = 0;
    return new Intl.NumberFormat('en-GB',{maximumFractionDigits: max == null ? 2 : max}).format(n);
  },
  percent: function(mode, a, b){
    if(mode === 'of') return {ok:true, result:a / 100 * b};
    if(mode === 'is'){
      if(b === 0) return {ok:false, error:'The whole (Y) cannot be zero.'};
      return {ok:true, result:a / b * 100};
    }
    if(mode === 'change'){
      if(a === 0) return {ok:false, error:'The starting value cannot be zero.'};
      return {ok:true, result:(b - a) / Math.abs(a) * 100};
    }
    return {ok:false, error:'Unknown mode.'};
  },
  margin: function(rev, cost){
    if(rev < 0 || cost < 0) return {ok:false, error:'Revenue and cost must be zero or more.'};
    var profit = rev - cost;
    return {ok:true, profit:profit,
      marginPct: rev === 0 ? null : profit / rev * 100,
      markupPct: cost === 0 ? null : profit / cost * 100};
  },
  rcp: function(units, price, vc, fixed){
    if(units < 0 || price < 0 || vc < 0 || fixed < 0) return {ok:false, error:'All values must be zero or more.'};
    var revenue = units * price, variable = units * vc, total = variable + fixed, profit = revenue - total;
    return {ok:true, revenue:revenue, variable:variable, total:total, profit:profit,
      marginPct: revenue === 0 ? null : profit / revenue * 100};
  },
  breakEven: function(fixed, price, vc){
    if(fixed < 0 || vc < 0) return {ok:false, error:'Fixed and variable costs must be zero or more.'};
    if(price <= 0) return {ok:false, error:'Selling price per unit must be above zero.'};
    var cm = price - vc;
    if(cm <= 0) return {ok:false, error:'Selling price must be higher than variable cost per unit, otherwise each sale adds to the loss and there is no break-even point.'};
    var units = fixed / cm, ceil = Math.ceil(units - 1e-9);
    return {ok:true, cm:cm, cmRatio:cm / price * 100, units:units, unitsCeil:ceil, revenue:units * price, revenueCeil:ceil * price};
  },
  /* VAT / TVA: mode 'excl' starts from the price without tax, 'incl' from the price with tax. Rate in %. */
  vat: function(mode, amount, rate){
    if(amount < 0) return {ok:false, error:'The amount must be zero or more.'};
    if(rate < 0 || rate > 100) return {ok:false, error:'The VAT rate must be between 0 and 100%.'};
    var f = 1 + rate / 100, excl = mode === 'excl' ? amount : amount / f, incl = mode === 'excl' ? amount * f : amount;
    return {ok:true, excl:excl, incl:incl, vat:incl - excl};
  },
  average: function(text){
    var tokens = String(text == null ? '' : text).split(/[\n;]+|\s+/).map(function(t){return t.replace(/,+$/,'');}).filter(Boolean);
    if(!tokens.length) return {ok:false, empty:true};
    var vals = [], bad = [];
    tokens.forEach(function(t){ var r = Calc.num(t); if(r.ok) vals.push(r.value); else bad.push(t); });
    if(bad.length) return {ok:false, error:'Could not read: ' + bad.slice(0,4).join(', ') + (bad.length > 4 ? ' and more' : '') + '. Separate values with spaces, new lines, or a comma followed by a space.'};
    var sum = vals.reduce(function(a,b){return a + b;}, 0), sorted = vals.slice().sort(function(a,b){return a - b;}), n = vals.length;
    var median = n % 2 ? sorted[(n - 1) / 2] : (sorted[n / 2 - 1] + sorted[n / 2]) / 2;
    return {ok:true, count:n, sum:sum, mean:sum / n, median:median, min:sorted[0], max:sorted[n - 1]};
  }
};
/*CALC-END*/

/* ---------------------------- utilities ---------------------------- */
function $(s, r){ return (r || document).querySelector(s); }
function $$(s, r){ return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
function esc(s){ return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
function uid(){ return Math.random().toString(36).slice(2,9) + Date.now().toString(36).slice(-4); }
function pad(n){ return String(n).padStart(2,'0'); }
function iso(d){ return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
function parseISO(s){
  var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || ''); if(!m) return null;
  var d = new Date(+m[1], +m[2] - 1, +m[3]);
  return (d.getFullYear() === +m[1] && d.getMonth() === +m[2] - 1 && d.getDate() === +m[3]) ? d : null;
}
function todayISO(){ return iso(new Date()); }
function addDays(d, n){ var x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); x.setDate(x.getDate() + n); return x; }
function diffDays(a, b){ return Math.round((parseISO(a) - parseISO(b)) / 864e5); }
function weekStart(d){ var x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; }
function fmtDate(s, opts){ var d = parseISO(s); return d ? new Intl.DateTimeFormat('en-GB', opts).format(d) : ''; }
var SHORT = {weekday:'short', day:'numeric', month:'short'};
function relDay(s){
  var n = diffDays(s, todayISO());
  if(n === 0) return 'today'; if(n === 1) return 'tomorrow'; if(n === -1) return 'yesterday';
  return n > 0 ? 'in ' + n + ' days' : Math.abs(n) + ' days ago';
}
function validTime(t){ return /^([01]\d|2[0-3]):[0-5]\d$/.test(t || ''); }
function sessionStart(s){ var d = parseISO(s.date), p = s.start.split(':'); return new Date(d.getFullYear(), d.getMonth(), d.getDate(), +p[0], +p[1]); }
function endTime(s){ var p = s.start.split(':'), t = +p[0] * 60 + +p[1] + s.duration; return pad(Math.floor(t / 60) % 24) + ':' + pad(t % 60); }
function fmtDur(m){ return m < 60 ? m + ' min' : Math.floor(m / 60) + ' h' + (m % 60 ? ' ' + (m % 60) + ' min' : ''); }
function whenLabel(s){
  var n = diffDays(s.date, todayISO());
  var day = n === 0 ? 'Today' : n === 1 ? 'Tomorrow' : fmtDate(s.date, SHORT);
  return day + ', ' + s.start;
}

/* ---------------------------- icons ---------------------------- */
var ICONS = {
  home:'<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
  calendar:'<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M8 2v4M16 2v4M3 10h18"/>',
  clip:'<rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="m9 14 2 2 4-4"/>',
  book:'<path d="M2 4h6a4 4 0 0 1 4 4v13a3 3 0 0 0-3-3H2z"/><path d="M22 4h-6a4 4 0 0 0-4 4v13a3 3 0 0 1 3-3h7z"/>',
  timer:'<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2M9 2h6"/>',
  calc:'<rect x="5" y="2" width="14" height="20" rx="2"/><path d="M8 6h8M8 11h.01M12 11h.01M16 11h.01M8 15h.01M12 15h.01M16 15h.01M8 18.5h.01M12 18.5h.01M16 18.5h.01"/>',
  plus:'<path d="M12 5v14M5 12h14"/>',
  pencil:'<path d="M17 3a2.8 2.8 0 0 1 4 4L8 20l-5 1 1-5z"/>',
  trash:'<path d="M3 6h18M8 6V4h8v2M6 6l1 15h10l1-15M10 11v6M14 11v6"/>',
  check:'<path d="m5 12 5 5L20 7"/>',
  x:'<path d="M6 6l12 12M18 6 6 18"/>',
  search:'<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  sliders:'<path d="M4 6h8M18 6h2M4 12h2M12 12h8M4 18h10M20 18h0"/><circle cx="15" cy="6" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="17" cy="18" r="2"/>',
  flame:'<path d="M12 22c4 0 7-2.8 7-7 0-3-2-5-3-7-1 1.5-2 2-3 2 0-3-1-6-4-8 0 4-4 6-4 12 0 4.2 3 8 7 8z"/>',
  clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  left:'<path d="m15 6-6 6 6 6"/>', right:'<path d="m9 6 6 6-6 6"/>',
  ext:'<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
  focus:'<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
  play:'<path d="M7 4v16l13-8z"/>', pause:'<path d="M8 5v14M16 5v14"/>',
  reset:'<path d="M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5"/>',
  done:'<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>',
  more:'<circle cx="5" cy="12" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="19" cy="12" r="1.2"/>',
  mag:'<circle cx="10.5" cy="10.5" r="6.5"/><path d="m20 20-4.9-4.9M8 10.5a2.5 2.5 0 0 1 2.5-2.5"/>',
  list:'<path d="M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01"/>',
  info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>'
};
function ico(name, cls){ return '<svg class="i ' + (cls || '') + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' + (ICONS[name] || '') + '</svg>'; }
function berry(){ return '<svg class="berry" aria-hidden="true"><use href="#berry"/></svg>'; }

/* ---------------------------- state ---------------------------- */
var storageOK = true;
var S;
var ui = {
  route:'dashboard', taskTab:'today',
  weekStart: iso(weekStart(new Date())), selectedDay: todayISO(),
  filters:{q:'', subject:'all', priority:'all', status:'all', sort:'due'},
  justClosed:null, lastFinish:null, focusMode:false,
  todoFilter:'all', todoSubject:'all'
};
var ROUTES = ['dashboard','planner','todo','assignments','subjects','study','toolkit'];
var NAV = [
  {id:'dashboard', label:'Dashboard', icon:'home'},
  {id:'planner', label:'My Planner', icon:'calendar'},
  {id:'todo', label:'To-do List', icon:'list', short:'To-do'},
  {id:'assignments', label:'Assignments & Deadlines', icon:'clip', short:'Deadlines'},
  {id:'subjects', label:'My Subjects', icon:'book'},
  {id:'study', label:'Study Room', icon:'timer', short:'Study'},
  {id:'toolkit', label:'Business Toolkit', icon:'calc'}
];

function defaultSettings(){ return {greeting:CONFIG.defaultGreeting, accent:100, texture:true, sound:true, noteIndex:-1, theme:'system'}; }
function defaultTimer(){ return {mode:'focus', running:false, endsAt:null, remainingMs:CONFIG.focusMinutes * 60000, subjectId:''}; }

function seed(){
  var now = new Date(), T = iso(now);
  function d(n){ return iso(addDays(now, n)); }
  var ws = weekStart(now);
  function w(k){ return iso(addDays(ws, k)); }
  var defs = [
    ['Introduction to Management','Dr. A. Example', d(34), 35, 'Four functions of management: planning, organizing, leading, controlling. Revisit Fayol versus Taylor.', [{label:'Example course page', url:'https://example.com'}]],
    ['Financial Accounting','', d(41), 20, 'Practise the accounting equation until journal entries feel automatic.', []],
    ['Microeconomics','Prof. B. Sample', d(38), 45, 'Elasticity and consumer surplus still feel shaky. Redo the tutorial graphs.', []],
    ['Business Mathematics','', d(45), 10, 'Percentages, ratios and linear equations. Keep one formula sheet.', []],
    ['Marketing Fundamentals','Dr. C. Placeholder', '', 25, 'Review the 4 Ps with one real brand example for each.', []],
    ['Business Communication','', d(48), 60, 'Collect good and weak email examples. Check tone and structure.', []]
  ];
  var subjects = defs.map(function(x, i){
    return {id:'sub' + (i + 1), name:x[0], lecturer:x[1], exam:x[2], progress:x[3], notes:x[4], materials:x[5], color:CONFIG.subjectColors[i]};
  });
  var tasks = [
    {id:uid(), title:'Read Chapter 3: Planning and Decision-Making', subjectId:'sub1', date:T, done:false, doneAt:''},
    {id:uid(), title:'Finish accounting problem set 2, questions 1 to 6', subjectId:'sub2', date:T, done:true, doneAt:T},
    {id:uid(), title:'Review supply and demand notes', subjectId:'sub3', date:T, done:false, doneAt:''},
    {id:uid(), title:'Practise 10 percentage-change problems', subjectId:'sub4', date:T, done:false, doneAt:''},
    {id:uid(), title:'Draft the opening paragraph of the email portfolio', subjectId:'sub6', date:T, done:false, doneAt:''},
    {id:uid(), title:'Prepare two questions for the management tutorial', subjectId:'sub1', date:d(1), done:false, doneAt:''},
    {id:uid(), title:'Outline the brand analysis presentation', subjectId:'sub5', date:d(2), done:false, doneAt:''}
  ];
  var assignments = [
    {id:uid(), title:'Management case study report', subjectId:'sub1', due:d(6), priority:'High', status:'In Progress', notes:'Choose the company by Thursday. Aim for 1,500 words.', completedAt:''},
    {id:uid(), title:'Accounting problem set 3', subjectId:'sub2', due:d(3), priority:'Medium', status:'Not Started', notes:'', completedAt:''},
    {id:uid(), title:'Elasticity worksheet', subjectId:'sub3', due:d(2), priority:'Medium', status:'In Progress', notes:'Questions 4 to 9 are left.', completedAt:''},
    {id:uid(), title:'Business maths problem set 1', subjectId:'sub4', due:d(-1), priority:'High', status:'Not Started', notes:'Ask for an extension if needed.', completedAt:''},
    {id:uid(), title:'Brand analysis presentation', subjectId:'sub5', due:d(12), priority:'High', status:'Not Started', notes:'', completedAt:''},
    {id:uid(), title:'Professional email portfolio', subjectId:'sub6', due:d(9), priority:'Low', status:'In Progress', notes:'Three emails: request, update, follow-up.', completedAt:''},
    {id:uid(), title:'Accounting problem set 2', subjectId:'sub2', due:d(-4), priority:'Medium', status:'Completed', notes:'', completedAt:d(-5)},
    {id:uid(), title:'Management reading reflection', subjectId:'sub1', due:d(-2), priority:'Low', status:'Completed', notes:'', completedAt:d(-2)}
  ];
  var sessions = [
    {id:uid(), subjectId:'sub2', date:w(0), start:'18:00', duration:60, notes:'Problem set 3, first half'},
    {id:uid(), subjectId:'sub1', date:w(1), start:'10:00', duration:90, notes:'Case study research'},
    {id:uid(), subjectId:'sub3', date:w(2), start:'16:00', duration:60, notes:'Elasticity worksheet'},
    {id:uid(), subjectId:'sub4', date:w(3), start:'09:30', duration:75, notes:''},
    {id:uid(), subjectId:'sub5', date:w(4), start:'14:00', duration:60, notes:'Pick a brand for the analysis'},
    {id:uid(), subjectId:'sub6', date:w(5), start:'11:00', duration:45, notes:''},
    {id:uid(), subjectId:'sub1', date:w(6), start:'17:00', duration:60, notes:'Weekly review'}
  ];
  function log(n, subjectId){ var day = addDays(now, -n); day.setHours(17, 0, 0, 0); return {id:uid(), date:iso(day), endedAt:day.getTime(), minutes:25, subjectId:subjectId}; }
  var history = [log(1,'sub1'), log(1,'sub3'), log(2,'sub2'), log(3,'sub4'), log(3,'sub4')];
  var checklist = ['Phone on silent','Notes and textbook open','Water within reach','One clear goal for this session'].map(function(t){ return {id:uid(), text:t, done:false}; });
  var chap = {sub1:[['Chapter 1: What is management?',1],['Chapter 2: History of theories',1],['Chapter 3: Planning and decision-making',0],['Chapter 4: Organizing',0]], sub2:[['The balance sheet',1],['The income statement',0],['Simple journal entries',0]], sub3:[['Supply and demand',1],['Elasticity',0],['Consumer surplus',0]]};
  var desc = {sub1:'Planning, organizing, leading, controlling.', sub2:'Core principles, balance sheet and income statement.', sub3:'Supply, demand, elasticity and consumer behaviour.', sub4:'Percentages, ratios and linear equations.', sub5:'The marketing mix and brand analysis.', sub6:'Emails, tone and structure.'};
  subjects.forEach(function(s){ s.sample = true; s.description = desc[s.id] || ''; s.chapters = (chap[s.id] || []).map(function(c){ return {id:uid(), title:c[0], note:'', done:!!c[1]}; }); });
  tasks.forEach(function(t){ t.sample = true; t.description = ''; t.priority = ''; });
  tasks[0].priority = 'High'; tasks[3].priority = 'Medium'; tasks[3].description = 'Use the Business Toolkit to check the answers.';
  tasks.push({id:uid(), title:'Buy a new highlighter', description:'A task with no due date.', priority:'', subjectId:'', date:'', done:false, doneAt:'', sample:true});
  [assignments, sessions, history].forEach(function(l){ l.forEach(function(x){ x.sample = true; }); });
  return {v:2, settings:defaultSettings(),
    subjects:subjects, tasks:tasks, assignments:assignments, sessions:sessions, history:history, checklist:checklist, messages:[], timer:defaultTimer()};
}

function sanitize(p){
  var out = {v:2};
  out.settings = Object.assign(defaultSettings(), p.settings || {});
  out.settings.accent = Math.min(100, Math.max(30, +out.settings.accent || 100));
  if(['light','dark','system'].indexOf(out.settings.theme) < 0) out.settings.theme = 'system';
  ['subjects','tasks','assignments','sessions','history','checklist','messages'].forEach(function(k){ out[k] = Array.isArray(p[k]) ? p[k].filter(function(x){ return x && typeof x === 'object'; }) : []; });
  out.messages = out.messages.filter(function(m){ return m.text; }).map(function(m){ return {id:m.id || uid(), text:String(m.text).slice(0, 200)}; });
  out.subjects.forEach(function(s){
    if(!/^#[0-9a-f]{6}$/i.test(s.color || '')) s.color = CONFIG.subjectColors[0];
    s.materials = Array.isArray(s.materials) ? s.materials : [];
    s.progress = Math.min(100, Math.max(0, +s.progress || 0));
    s.notes = s.notes || ''; s.lecturer = s.lecturer || ''; s.exam = s.exam || ''; s.description = s.description || '';
    s.chapters = (Array.isArray(s.chapters) ? s.chapters : []).filter(function(c){ return c && c.title; }).map(function(c){ return {id:c.id || uid(), title:String(c.title), note:c.note || '', done:!!c.done}; });
  });
  out.sessions = out.sessions.filter(function(s){ return parseISO(s.date) && validTime(s.start) && s.duration > 0; });
  out.tasks = out.tasks.filter(function(t){ return t.title; });
  out.tasks.forEach(function(t){ t.id = t.id || uid(); t.description = t.description || ''; t.subjectId = t.subjectId || ''; t.date = parseISO(t.date) ? t.date : ''; t.priority = PRIO[t.priority] ? t.priority : ''; t.done = !!t.done; t.doneAt = t.doneAt || ''; });
  out.assignments = out.assignments.filter(function(a){ return a && a.title && parseISO(a.due); });
  var t = Object.assign(defaultTimer(), p.timer || {});
  if(t.mode !== 'focus' && t.mode !== 'break') t.mode = 'focus';
  out.timer = t;
  return out;
}
function load(){
  try{
    var raw = localStorage.getItem(CONFIG.storageKey);
    if(raw){ var p = JSON.parse(raw); if(p && (p.v === 1 || p.v === 2)) return sanitize(p); }
  }catch(e){ storageOK = false; }
  var s = seed();
  try{ localStorage.setItem(CONFIG.storageKey, JSON.stringify(s)); }catch(e){ storageOK = false; }
  return s;
}
function save(){
  try{ localStorage.setItem(CONFIG.storageKey, JSON.stringify(S)); storageOK = true; }catch(e){ storageOK = false; }
  paintSave();
}
function paintSave(){
  $$('[data-save]').forEach(function(el){
    el.classList.toggle('bad', !storageOK);
    el.innerHTML = storageOK ? ico('check') + '<span>Saved on this device</span>' : ico('info') + '<span>Not saved: storage is blocked</span>';
  });
}

/* ---------------------------- domain helpers ---------------------------- */
function subj(id){ return S.subjects.find(function(s){ return s.id === id; }); }
function subjName(id){ var s = subj(id); return s ? s.name : 'General'; }
var SAMPLE_BADGE = '<span class="sample-badge" title="Sample content: edit it or remove it any time">Sample</span>';
function hasSamples(){ return ['subjects','tasks','assignments','sessions','history'].some(function(k){ return S[k].some(function(x){ return x.sample; }); }); }
function subjColor(id){ var s = subj(id); return s ? s.color : '#8D7B83'; }
function chip(id){ return '<span class="chip" style="--sc:' + esc(subjColor(id)) + '"><span>' + esc(subjName(id)) + '</span></span>'; }
function subjectOptions(sel, withGeneral){
  return (withGeneral ? '<option value="">General (no subject)</option>' : '') +
    S.subjects.map(function(s){ return '<option value="' + esc(s.id) + '"' + (s.id === sel ? ' selected' : '') + '>' + esc(s.name) + '</option>'; }).join('');
}
function dashTasks(){ var T = todayISO(); return S.tasks.filter(function(t){ return t.date === T || (t.date && t.date < T && !t.done); }); }
function byDate(a, b){ return (a.date || '9999').localeCompare(b.date || '9999'); }
function deadlines(){
  var items = [], T = todayISO();
  S.assignments.forEach(function(a){ if(a.status !== 'Completed') items.push({kind:'Assignment', title:a.title, date:a.due, subjectId:a.subjectId}); });
  S.subjects.forEach(function(s){ if(s.exam && s.exam >= T) items.push({kind:'Exam', title:s.name + ' exam', date:s.exam, subjectId:s.id}); });
  return items.sort(function(a, b){ return a.date.localeCompare(b.date); });
}
function nextSession(){
  var now = Date.now();
  var list = S.sessions.map(function(s){ var at = sessionStart(s).getTime(); return {s:s, at:at, end:at + s.duration * 60000}; })
    .filter(function(x){ return x.end > now; }).sort(function(a, b){ return a.at - b.at; });
  return list[0] || null;
}
function sessionsOn(date){ return S.sessions.filter(function(s){ return s.date === date; }).sort(function(a, b){ return a.start.localeCompare(b.start); }); }
function activeDays(){
  var set = {};
  S.history.forEach(function(h){ set[h.date] = 1; });
  S.tasks.forEach(function(t){ if(t.done && t.doneAt) set[t.doneAt] = 1; });
  S.assignments.forEach(function(a){ if(a.status === 'Completed' && a.completedAt) set[a.completedAt] = 1; });
  return set;
}
function streak(){
  var set = activeDays(), d = new Date(), n = 0;
  if(!set[iso(d)]) d = addDays(d, -1);
  while(set[iso(d)]){ n++; d = addDays(d, -1); }
  return n;
}
var PRIO = {High:3, Medium:2, Low:1};
function allNotes(){ return CONFIG.notes.concat(S.messages.map(function(m){ return m.text; })); }
function noteOfTheDay(){
  var list = allNotes(), n = list.length, i = S.settings.noteIndex;
  if(i < 0){ var start = new Date(new Date().getFullYear(), 0, 0); i = Math.floor((new Date() - start) / 864e5) % n; }
  return list[((i % n) + n) % n];
}

/* ---------------------------- toasts & modal ---------------------------- */
function toast(msg, kind){
  var box = $('#toasts'), el = document.createElement('div');
  el.className = 'toast ' + (kind || '');
  el.innerHTML = ico(kind === 'ok' ? 'check' : 'info', 'sm') + '<span>' + esc(msg) + '</span>';
  box.appendChild(el);
  while(box.children.length > 3) box.removeChild(box.firstChild);
  setTimeout(function(){ el.classList.add('out'); setTimeout(function(){ if(el.parentNode) el.parentNode.removeChild(el); }, 300); }, 3400);
}
var lastFocus = null, pendingConfirm = null;
function openModal(html, small){
  var root = $('#modal-root');
  if(!root.firstChild) lastFocus = document.activeElement;
  root.innerHTML = '<div class="overlay" data-act="overlay"><div class="modal' + (small ? ' small' : '') + '" role="dialog" aria-modal="true" aria-labelledby="modal-title">' + html + '</div></div>';
  document.body.classList.add('modal-open');
  var first = $('[autofocus]', root) || $('input:not([type=radio]):not([type=checkbox]),select,textarea,button', $('.modal', root));
  if(first) setTimeout(function(){ first.focus(); }, 30);
}
function closeModal(){
  $('#modal-root').innerHTML = '';
  document.body.classList.remove('modal-open');
  if(lastFocus && document.body.contains(lastFocus)) try{ lastFocus.focus(); }catch(e){}
  lastFocus = null;
}
function confirmBox(title, message, label, onYes){
  pendingConfirm = onYes;
  openModal('<h2 id="modal-title">' + esc(title) + '</h2><p class="lede">' + esc(message) + '</p>' +
    '<div class="actions"><button class="btn ghost" type="button" data-act="close-modal">Cancel</button><button class="btn danger" type="button" data-act="confirm-yes">' + esc(label || 'Delete') + '</button></div>', true);
}
function field(label, id, control, hint){
  return '<div class="field"><label for="' + id + '">' + label + '</label>' + control + (hint ? '<p class="hint">' + hint + '</p>' : '') + '<p class="err" id="err-' + id + '" role="alert" hidden></p></div>';
}
function showErrors(form, errs){
  var firstBad = null;
  $$('.err', form).forEach(function(p){ p.hidden = true; p.textContent = ''; });
  $$('[aria-invalid]', form).forEach(function(i){ i.removeAttribute('aria-invalid'); });
  Object.keys(errs).forEach(function(id){
    var p = $('#err-' + id, form), inp = $('#' + id, form);
    if(p){ p.textContent = errs[id]; p.hidden = false; }
    if(inp){ inp.setAttribute('aria-invalid', 'true'); if(!firstBad) firstBad = inp; }
  });
  if(firstBad) firstBad.focus();
  return Object.keys(errs).length > 0;
}
function modalHead(title, lede){ return '<div class="modal-head"><div><h2 id="modal-title">' + esc(title) + '</h2>' + (lede ? '<p class="lede">' + esc(lede) + '</p>' : '') + '</div><button class="icon-btn" type="button" data-act="close-modal" aria-label="Close">' + ico('x') + '</button></div>'; }

/* ---------------------------- forms ---------------------------- */
function prioOptions(sel){ return '<option value="">None</option>' + ['High','Medium','Low'].map(function(p){ return '<option' + (p === sel ? ' selected' : '') + '>' + p + '</option>'; }).join(''); }
function taskForm(t){
  var e = !!t; t = t || {title:'', description:'', priority:'', subjectId:'', date:ui.route === 'todo' ? '' : (ui.taskTab === 'upcoming' ? iso(addDays(new Date(), 1)) : todayISO())};
  openModal(modalHead(e ? 'Edit task' : 'New task', 'A small step you can tick off today.') +
    '<form data-form="task" data-id="' + esc(t.id || '') + '" novalidate><div class="form-grid">' +
    '<div class="full">' + field('Task', 'f-title', '<input type="text" id="f-title" maxlength="140" value="' + esc(t.title) + '" placeholder="For example: Read Chapter 4" autocomplete="off">') + '</div>' +
    '<div class="full">' + field('Description (optional)', 'f-desc', '<textarea id="f-desc" maxlength="300" rows="2" placeholder="Pages to read, what to hand in...">' + esc(t.description || '') + '</textarea>') + '</div>' +
    field('Subject (optional)', 'f-subject', '<select id="f-subject">' + subjectOptions(t.subjectId, true) + '</select>') +
    field('Priority (optional)', 'f-priority', '<select id="f-priority">' + prioOptions(t.priority) + '</select>') +
    '<div class="full">' + field('Due date (optional)', 'f-date', '<input type="date" id="f-date" value="' + esc(t.date) + '">', 'Leave empty for a task without a date.') + '</div>' +
    '</div><div class="actions">' + (e ? '<button class="btn danger left" type="button" data-act="task-del" data-id="' + esc(t.id) + '">Delete</button>' : '') +
    '<button class="btn ghost" type="button" data-act="close-modal">Cancel</button><button class="btn" type="submit">' + (e ? 'Save changes' : 'Add task') + '</button></div></form>');
}
function assignmentForm(a){
  var e = !!a; a = a || {title:'', subjectId:S.subjects[0] ? S.subjects[0].id : '', due:iso(addDays(new Date(), 7)), priority:'Medium', status:'Not Started', notes:''};
  var opts = function(list, v){ return list.map(function(x){ return '<option' + (x === v ? ' selected' : '') + '>' + x + '</option>'; }).join(''); };
  openModal(modalHead(e ? 'Edit assignment' : 'New assignment') +
    '<form data-form="assignment" data-id="' + esc(a.id || '') + '" novalidate><div class="form-grid">' +
    '<div class="full">' + field('Title', 'f-title', '<input type="text" id="f-title" maxlength="140" value="' + esc(a.title) + '" placeholder="For example: Marketing report" autocomplete="off">') + '</div>' +
    field('Subject', 'f-subject', '<select id="f-subject">' + subjectOptions(a.subjectId, true) + '</select>') +
    field('Due date', 'f-due', '<input type="date" id="f-due" value="' + esc(a.due) + '">') +
    field('Priority', 'f-priority', '<select id="f-priority">' + opts(['High','Medium','Low'], a.priority) + '</select>') +
    field('Status', 'f-status', '<select id="f-status">' + opts(['Not Started','In Progress','Completed'], a.status) + '</select>') +
    '<div class="full">' + field('Notes (optional)', 'f-notes', '<textarea id="f-notes" maxlength="400" rows="3">' + esc(a.notes) + '</textarea>') + '</div>' +
    '</div><div class="actions">' + (e ? '<button class="btn danger left" type="button" data-act="as-del" data-id="' + esc(a.id) + '">Delete</button>' : '') +
    '<button class="btn ghost" type="button" data-act="close-modal">Cancel</button><button class="btn" type="submit">' + (e ? 'Save changes' : 'Add assignment') + '</button></div></form>');
}
function sessionForm(s, presetDate){
  var e = !!s; s = s || {subjectId:S.subjects[0] ? S.subjects[0].id : '', date:presetDate || todayISO(), start:'16:00', duration:60, notes:''};
  openModal(modalHead(e ? 'Edit study session' : 'New study session') +
    '<form data-form="session" data-id="' + esc(s.id || '') + '" novalidate><div class="form-grid">' +
    '<div class="full">' + field('Subject', 'f-subject', '<select id="f-subject">' + subjectOptions(s.subjectId, false) + '</select>') + '</div>' +
    field('Date', 'f-date', '<input type="date" id="f-date" value="' + esc(s.date) + '">') +
    field('Start time', 'f-start', '<input type="time" id="f-start" value="' + esc(s.start) + '">') +
    field('Duration (minutes)', 'f-duration', '<input type="number" id="f-duration" min="5" max="600" step="5" inputmode="numeric" value="' + esc(s.duration) + '">', '5 to 600 minutes') +
    '<div class="full">' + field('Notes (optional)', 'f-notes', '<textarea id="f-notes" maxlength="300" rows="3">' + esc(s.notes) + '</textarea>') + '</div>' +
    '</div><div class="actions">' + (e ? '<button class="btn danger left" type="button" data-act="ss-del" data-id="' + esc(s.id) + '">Delete</button>' : '') +
    '<button class="btn ghost" type="button" data-act="close-modal">Cancel</button><button class="btn" type="submit">' + (e ? 'Save changes' : 'Add session') + '</button></div></form>');
}
function subjectForm(s){
  var e = !!s; var used = S.subjects.length; s = s || {name:'', description:'', lecturer:'', exam:'', color:CONFIG.subjectColors[used % CONFIG.subjectColors.length], materials:[], notes:'', progress:0};
  var isPreset = CONFIG.subjectColors.some(function(c){ return c.toLowerCase() === s.color.toLowerCase(); });
  var sw = CONFIG.subjectColors.map(function(c){ return '<label class="swatch"><input type="radio" name="f-color" value="' + c + '"' + (c.toLowerCase() === s.color.toLowerCase() ? ' checked' : '') + ' aria-label="Colour ' + c + '"><span style="background:' + c + '"></span></label>'; }).join('') +
    '<label class="swatch custom" title="Custom colour"><input type="radio" name="f-color" value="custom"' + (isPreset ? '' : ' checked') + ' aria-label="Custom colour"><span style="background:conic-gradient(#C72C55,#B9801F,#5E8C61,#3F6FA3,#7A4FA3,#C72C55)"></span></label><input type="color" id="f-color-custom" value="' + esc(s.color) + '" aria-label="Pick a custom colour" class="color-pick">';
  var mats = s.materials.map(function(m){ return m.label + ' | ' + m.url; }).join('\n');
  openModal(modalHead(e ? 'Edit subject' : 'New subject') +
    '<form data-form="subject" data-id="' + esc(s.id || '') + '" novalidate><div class="form-grid">' +
    '<div class="full">' + field('Subject name', 'f-name', '<input type="text" id="f-name" maxlength="70" value="' + esc(s.name) + '" autocomplete="off">') + '</div>' +
    '<div class="full">' + field('Description (optional)', 'f-desc', '<input type="text" id="f-desc" maxlength="140" value="' + esc(s.description || '') + '" placeholder="What is this subject about?" autocomplete="off">') + '</div>' +
    field('Lecturer', 'f-lecturer', '<input type="text" id="f-lecturer" maxlength="70" value="' + esc(s.lecturer) + '" placeholder="Add a name later">') +
    field('Exam date', 'f-exam', '<input type="date" id="f-exam" value="' + esc(s.exam) + '">', 'Leave empty until it is announced') +
    '<div class="full"><span class="lbl">Colour</span><div class="swatches" role="radiogroup" aria-label="Subject colour" style="margin-top:8px">' + sw + '</div></div>' +
    '<div class="full">' + field('Study materials', 'f-mats', '<textarea id="f-mats" rows="3" placeholder="Lecture slides | https://example.com/slides">' + esc(mats) + '</textarea>', 'One per line as Label | https://link. A link alone also works.') + '</div>' +
    '<div class="full">' + field('Personal notes', 'f-notes', '<textarea id="f-notes" rows="3" maxlength="600">' + esc(s.notes) + '</textarea>') + '</div>' +
    '</div><div class="actions">' + (e ? '<button class="btn danger left" type="button" data-act="subj-del" data-id="' + esc(s.id) + '">Delete</button>' : '') +
    '<button class="btn ghost" type="button" data-act="close-modal">Cancel</button><button class="btn" type="submit">' + (e ? 'Save changes' : 'Add subject') + '</button></div></form>');
}
function quickAdd(){
  openModal(modalHead('Quick add', 'What would you like to file?') +
    '<button class="choice" type="button" data-act="add" data-kind="task">' + ico('check') + '<div><b>Task</b><span>A small to-do for today or later</span></div></button>' +
    '<button class="choice" type="button" data-act="add" data-kind="assignment">' + ico('clip') + '<div><b>Assignment</b><span>With a subject, due date and priority</span></div></button>' +
    '<button class="choice" type="button" data-act="add" data-kind="session">' + ico('calendar') + '<div><b>Study session</b><span>Block time in your weekly planner</span></div></button>', true);
}
function moreSheet(){
  openModal(modalHead('More') +
    '<button class="choice" type="button" data-act="nav" data-to="todo">' + ico('list') + '<div><b>To-do List</b><span>All your tasks, with filters</span></div></button>' +
    '<button class="choice" type="button" data-act="nav" data-to="subjects">' + ico('book') + '<div><b>My Subjects</b><span>Notes, exam dates and revision progress</span></div></button>' +
    '<button class="choice" type="button" data-act="nav" data-to="toolkit">' + ico('calc') + '<div><b>Business Toolkit</b><span>Percentages, margins and break-even</span></div></button>' +
    '<button class="choice" type="button" data-act="theme-toggle">' + ico(effectiveTheme() === 'dark' ? 'sun' : 'moon') + '<div><b>Switch theme</b><span>Light Raspberry Pink or Dark Raspberry</span></div></button>' +
    '<button class="choice" type="button" data-act="open-settings">' + ico('sliders') + '<div><b>Settings</b><span>Greeting, accent and sound</span></div></button>', true);
}
function messagesForm(){
  var list = S.messages.length ? '<ul class="tasks">' + S.messages.map(function(m){ return '<li class="task"><div class="task-main"><span class="task-title">' + esc(m.text) + '</span></div><button class="icon-btn del" type="button" data-act="msg-del" data-id="' + esc(m.id) + '" aria-label="Remove message: ' + esc(m.text) + '">' + ico('trash', 'sm') + '</button></li>'; }).join('') + '</ul>' : '<p class="muted" style="font-size:14px">You have not added any personal messages yet.</p>';
  openModal(modalHead('My own messages', 'They join the rotation on your dashboard card.') + list +
    '<form class="inline-form" data-form="msg-add" novalidate style="margin-top:14px"><label class="sr" for="msg-input">New personal message</label><input type="text" id="msg-input" maxlength="200" placeholder="Write something kind to future you" autocomplete="off"><button class="btn" type="submit" aria-label="Add message">' + ico('plus', 'sm') + '</button></form>' +
    '<div class="actions"><button class="btn" type="button" data-act="close-modal">Done</button></div>', true);
}
function settingsForm(){
  var st = S.settings;
  openModal(modalHead('Settings', 'Everything stays on this device.') +
    '<div class="form-grid">' +
    '<div class="full">' + field('Greeting', 'set-greeting', '<input type="text" id="set-greeting" maxlength="40" value="' + esc(st.greeting) + '" placeholder="' + esc(CONFIG.defaultGreeting) + '" autocomplete="off">', 'Shown at the top of the dashboard.') + '</div>' +
    '<div class="full">' + field('Accent intensity <output id="set-accent-out" class="mono muted">' + st.accent + '%</output>', 'set-accent', '<input type="range" id="set-accent" min="30" max="100" step="5" value="' + st.accent + '">', 'Lower values soften the raspberry toward a muted berry pink.') + '</div>' +
    '<div class="full">' + field('Theme', 'set-theme', '<select id="set-theme"><option value="system"' + (st.theme === 'system' ? ' selected' : '') + '>Automatic (follow my device)</option><option value="light"' + (st.theme === 'light' ? ' selected' : '') + '>Light: Raspberry Pink</option><option value="dark"' + (st.theme === 'dark' ? ' selected' : '') + '>Dark: Dark Raspberry</option></select>') + '</div>' +
    '<div class="full"><button class="btn ghost sm" type="button" data-act="msg-manage">' + ico('heart', 'sm') + 'Manage my motivation messages</button></div>' +
    '<div class="full check-row"><input type="checkbox" id="set-texture"' + (st.texture ? ' checked' : '') + '><label for="set-texture">Subtle paper texture</label></div>' +
    '<div class="full check-row"><input type="checkbox" id="set-sound"' + (st.sound ? ' checked' : '') + '><label for="set-sound">Soft chime when a timer ends</label></div>' +
    '</div><div class="actions">' + (hasSamples() ? '<button class="btn ghost left" type="button" data-act="remove-samples">Remove sample content</button>' : '') + '<button class="btn danger" type="button" data-act="reset-data">Reset to sample data</button><button class="btn" type="button" data-act="close-modal">Done</button></div>');
}

/* ---------------------------- form handlers ---------------------------- */
function val(form, id){ var el = $('#' + id, form); return el ? el.value.trim() : ''; }
function submitForm(form){
  var kind = form.dataset.form, id = form.dataset.id, errs = {};
  if(kind === 'chapter'){
    var cs = subj(form.dataset.sid), cc = cs && cs.chapters.find(function(x){ return x.id === id; }), ct = val(form, 'f-title');
    if(!ct) errs['f-title'] = 'Give the chapter a title.';
    if(showErrors(form, errs)) return;
    if(cc){ cc.title = ct; cc.note = val(form, 'f-notes'); } save(); closeModal(); render(); toast('Chapter updated.', 'ok'); return;
  }
  if(kind === 'task'){
    var title = val(form, 'f-title'), date = val(form, 'f-date');
    if(!title) errs['f-title'] = 'Give the task a short title.';
    if(date && !parseISO(date)) errs['f-date'] = 'Choose a valid date or leave it empty.';
    if(showErrors(form, errs)) return;
    var sid = val(form, 'f-subject'), tdesc = val(form, 'f-desc'), tpr = val(form, 'f-priority');
    if(id){ var t = S.tasks.find(function(x){ return x.id === id; }); if(t){ t.title = title; t.subjectId = sid; t.date = date; t.description = tdesc; t.priority = tpr; } toast('Task updated.', 'ok'); }
    else { S.tasks.push({id:uid(), title:title, description:tdesc, priority:tpr, subjectId:sid, date:date, done:false, doneAt:''}); toast('Task added.', 'ok'); }
  }
  else if(kind === 'assignment'){
    var at = val(form, 'f-title'), due = val(form, 'f-due');
    if(!at) errs['f-title'] = 'Give the assignment a title.';
    if(!parseISO(due)) errs['f-due'] = 'Choose a valid due date.';
    if(showErrors(form, errs)) return;
    var status = val(form, 'f-status'), rec = id ? S.assignments.find(function(x){ return x.id === id; }) : null;
    var wasDone = rec && rec.status === 'Completed';
    if(!rec){ rec = {id:uid(), completedAt:''}; S.assignments.push(rec); }
    rec.title = at; rec.subjectId = val(form, 'f-subject'); rec.due = due; rec.priority = val(form, 'f-priority'); rec.status = status; rec.notes = val(form, 'f-notes');
    if(status === 'Completed'){ if(!wasDone){ rec.completedAt = todayISO(); ui.justClosed = rec.id; setTimeout(function(){ ui.justClosed = null; }, 2200); } }
    else rec.completedAt = '';
    toast(id ? 'Assignment updated.' : 'Assignment added.', 'ok');
    if(status === 'Completed' && !wasDone) toast('Case closed!', 'ok');
  }
  else if(kind === 'session'){
    var sd = val(form, 'f-date'), st = val(form, 'f-start'), du = Number(val(form, 'f-duration')), ss = val(form, 'f-subject');
    if(!ss) errs['f-subject'] = 'Choose a subject. Add one in My Subjects first if the list is empty.';
    if(!parseISO(sd)) errs['f-date'] = 'Choose a valid date.';
    if(!validTime(st)) errs['f-start'] = 'Enter a start time.';
    if(!(Number.isInteger(du) && du >= 5 && du <= 600)) errs['f-duration'] = 'Use a whole number from 5 to 600.';
    if(showErrors(form, errs)) return;
    if(id){ var x = S.sessions.find(function(q){ return q.id === id; }); if(x){ x.subjectId = ss; x.date = sd; x.start = st; x.duration = du; x.notes = val(form, 'f-notes'); } toast('Session updated.', 'ok'); }
    else { S.sessions.push({id:uid(), subjectId:ss, date:sd, start:st, duration:du, notes:val(form, 'f-notes')}); toast('Session added to your planner.', 'ok'); }
    ui.weekStart = iso(weekStart(parseISO(sd))); ui.selectedDay = sd;
  }
  else if(kind === 'subject'){
    var nm = val(form, 'f-name'), ex = val(form, 'f-exam');
    if(!nm) errs['f-name'] = 'Give the subject a name.';
    if(ex && !parseISO(ex)) errs['f-exam'] = 'Choose a valid date or leave it empty.';
    var mats = [], badLines = [];
    val(form, 'f-mats').split('\n').forEach(function(line){
      line = line.trim(); if(!line) return;
      var parts = line.split('|'), url = (parts.length > 1 ? parts.slice(1).join('|') : parts[0]).trim(), label = parts.length > 1 ? parts[0].trim() : '';
      if(!/^https?:\/\/[^\s]+\.[^\s]+$/i.test(url)){ badLines.push(line); return; }
      if(!label){ try{ label = new URL(url).hostname.replace(/^www\./, ''); }catch(e){ label = 'Link'; } }
      mats.push({label:label, url:url});
    });
    if(badLines.length) errs['f-mats'] = 'Links must start with http:// or https://. Check: ' + badLines[0].slice(0, 40);
    if(showErrors(form, errs)) return;
    var colorEl = $('input[name=f-color]:checked', form), color = colorEl ? colorEl.value : CONFIG.subjectColors[0];
    if(color === 'custom') color = $('#f-color-custom', form).value;
    var sub = id ? subj(id) : null;
    if(!sub){ sub = {id:uid(), progress:0, chapters:[]}; S.subjects.push(sub); }
    sub.description = val(form, 'f-desc'); sub.name = nm; sub.lecturer = val(form, 'f-lecturer'); sub.exam = ex; sub.color = color; sub.materials = mats; sub.notes = val(form, 'f-notes');
    toast(id ? 'Subject updated.' : 'Subject added.', 'ok');
  }
  save(); closeModal(); render();
}

/* ---------------------------- views ---------------------------- */
function head(eyebrow, title, sub, actions){
  return '<header class="page-head"><div><div class="eyebrow">' + berry() + eyebrow + '</div><h1>' + title + '</h1>' + (sub ? '<p class="sub">' + sub + '</p>' : '') + '</div>' + (actions ? '<div class="head-actions">' + actions + '</div>' : '') + '</header>';
}
function taskRow(t){
  var n = t.date ? diffDays(t.date, todayISO()) : 0;
  var when = !t.date ? 'No due date' : t.date < todayISO() && !t.done ? 'Carried over' : n === 0 ? 'Today' : n === 1 ? 'Tomorrow' : fmtDate(t.date, SHORT);
  var pc = t.priority === 'High' ? 'high' : t.priority === 'Medium' ? 'med' : '';
  return '<li class="task' + (t.done ? ' done' : '') + '"><button class="check" type="button" role="checkbox" aria-checked="' + t.done + '" data-act="task-toggle" data-id="' + esc(t.id) + '" aria-label="' + (t.done ? 'Mark not done: ' : 'Mark done: ') + esc(t.title) + '">' + ico('check') + '</button>' +
    '<div class="task-main"><span class="task-title">' + esc(t.title) + (t.sample ? ' ' + SAMPLE_BADGE : '') + '</span>' + (t.description ? '<span class="task-desc">' + esc(t.description) + '</span>' : '') + '<span class="task-meta">' + (t.subjectId ? chip(t.subjectId) : '') + '<span>' + when + '</span>' + (t.priority ? '<span class="pill ' + pc + '">' + t.priority + ' priority</span>' : '') + '</span></div>' +
    '<div class="row-actions"><button class="icon-btn" type="button" data-act="task-edit" data-id="' + esc(t.id) + '" aria-label="Edit task: ' + esc(t.title) + '">' + ico('pencil', 'sm') + '</button>' +
    '<button class="icon-btn del" type="button" data-act="task-del" data-id="' + esc(t.id) + '" aria-label="Delete task: ' + esc(t.title) + '">' + ico('trash', 'sm') + '</button></div></li>';
}
function taskListHTML(){
  var T = todayISO(), tab = ui.taskTab, list;
  if(tab === 'today') list = dashTasks();
  else if(tab === 'upcoming') list = S.tasks.filter(function(t){ return !t.done && (!t.date || t.date > T); });
  else list = S.tasks.slice();
  list.sort(function(a, b){ return (a.done - b.done) || byDate(a, b); });
  if(!list.length){
    var msg = tab === 'today' ? ['No tasks filed for today', 'Add one small step to open today\'s case.'] : tab === 'upcoming' ? ['Nothing coming up', 'Tasks dated after today, or without a date, appear here.'] : ['No tasks yet', 'Add your first task to start the casebook.'];
    return '<div class="empty">' + berry() + '<h3>' + msg[0] + '</h3><p>' + msg[1] + '</p></div>';
  }
  return '<ul class="tasks">' + list.map(taskRow).join('') + '</ul>';
}
function viewDashboard(){
  var T = todayISO(), now = new Date();
  var list = dashTasks(), done = list.filter(function(t){ return t.done; }).length, total = list.length, pct = total ? Math.round(done / total * 100) : 0;
  var greeting = (S.settings.greeting || '').trim() || CONFIG.defaultGreeting;
  var dl = deadlines(), nextDl = dl.find(function(x){ return x.date >= T; }) || dl[0];
  var ns = nextSession();
  var open = S.assignments.filter(function(a){ return a.status !== 'Completed'; }).sort(function(a, b){ return a.due.localeCompare(b.due) || PRIO[b.priority] - PRIO[a.priority]; });
  var lead = open[0];
  var leadText = lead ? (lead.due < T ? '“' + esc(lead.title) + '” is past due. A short session today would settle it.' : '“' + esc(lead.title) + '” is the closest deadline, due ' + relDay(lead.due) + '.') : 'Nothing is waiting on a deadline. A good day to get ahead.';
  var C = 2 * Math.PI * 42, off = C * (1 - pct / 100);
  var segs = ''; for(var i = 0; i < Math.min(total, 14); i++){ segs += '<i class="seg' + (i < Math.round(done / total * Math.min(total, 14)) ? ' on' : '') + '"></i>'; }
  var solved = total > 0 && done === total;
  var stk = streak(), set = activeDays(), days7 = '';
  for(var k = 6; k >= 0; k--){
    var dd = addDays(now, -k), on = !!set[iso(dd)];
    days7 += '<div class="d7' + (on ? ' on' : '') + (k === 0 ? ' today' : '') + '"><i>' + (on ? berry() : '') + '</i>' + 'MTWTFSS'.charAt((dd.getDay() + 6) % 7) + '</div>';
  }
  var ws = weekStart(now), weekRows = '';
  for(var j = 0; j < 7; j++){
    var day = addDays(ws, j), dIso = iso(day), ss = sessionsOn(dIso);
    weekRows += '<li class="wk' + (dIso === T ? ' today' : '') + '"><div class="dn">' + new Intl.DateTimeFormat('en-GB', {weekday:'short'}).format(day) + '<b>' + day.getDate() + '</b></div><div class="wk-items">' +
      (ss.length ? ss.map(function(s){ return '<span class="chip" style="--sc:' + esc(subjColor(s.subjectId)) + '"><span>' + s.start + ' ' + esc(subjName(s.subjectId)) + '</span></span>'; }).join('') : '<span class="none">Free day</span>') + '</div></li>';
  }
  var dlHTML = dl.length ? '<ul class="dl-list">' + dl.slice(0, 6).map(function(x){
    var late = x.date < T, d = parseISO(x.date);
    return '<li class="dl"><div class="datebox' + (late ? ' late' : '') + '"><span class="mo">' + new Intl.DateTimeFormat('en-GB', {month:'short'}).format(d) + '</span><span class="dy">' + d.getDate() + '</span></div><div class="dl-main"><b>' + esc(x.title) + '</b><span class="task-meta">' + chip(x.subjectId) + '<span>' + x.kind + ' · ' + (late ? 'overdue, was due ' + relDay(x.date) : relDay(x.date)) + '</span></span></div></li>';
  }).join('') + '</ul>' : '<div class="empty">' + berry() + '<h3>No deadlines on file</h3><p>Assignments and exam dates will appear here.</p></div>';

  var nextCard = ns ?
    '<div class="eyebrow">' + ico('clock', 'sm') + (ns.at <= Date.now() ? 'Happening now' : 'Next up') + '</div><h3>' + esc(subjName(ns.s.subjectId)) + '</h3>' +
    '<div class="when">' + ico('calendar', 'sm') + '<span>' + whenLabel(ns.s) + ' to ' + endTime(ns.s) + ' · ' + fmtDur(ns.s.duration) + '</span></div>' + (ns.s.notes ? '<p style="margin-top:8px;opacity:.85;font-size:14px">' + esc(ns.s.notes) + '</p>' : '') +
    '<button class="btn" type="button" data-act="next-start" data-id="' + esc(ns.s.subjectId) + '">' + ico('play', 'sm') + 'Start a focus session</button>' :
    '<div class="eyebrow">' + ico('clock', 'sm') + 'Next up</div><h3>Nothing scheduled</h3><div class="when"><span>Block some time in your planner.</span></div><button class="btn" type="button" data-act="add" data-kind="session">' + ico('plus', 'sm') + 'Add a session</button>';

  var banner = hasSamples() ? '<div class="tool-note sample-note">' + ico('info') + '<span>This app starts with <b>sample content</b> (marked “Sample”) so you can see how it works. Make it yours, or</span> <button class="btn ghost sm" type="button" data-act="remove-samples">remove all samples</button></div>' : '';
  return banner + head(fmtDate(T, {weekday:'long', day:'numeric', month:'long', year:'numeric'}), esc(greeting), esc(CONFIG.subtitle),
      '<button class="btn desk-only" type="button" data-act="quick-add">' + ico('plus', 'sm') + 'Quick add</button>') +
  '<div class="dash"><div class="col">' +
    '<section class="card casefile c-case" aria-labelledby="h-case"><div class="card-head"><h2 id="h-case">Today\'s Case File</h2><span class="classified">Classified: Academic Affairs</span></div>' +
      '<p class="lead">' + (total ? (done === total ? 'Every task on today\'s list is done. ' : (total - done) + ' of ' + total + ' tasks still open. ') : 'No tasks filed for today yet. ') + leadText + '</p>' +
      '<div class="evidence"><div class="ev"><span class="k">' + ico('check') + 'Tasks</span><span class="v">' + (total ? done + ' of ' + total + ' done' : 'None filed') + '</span></div>' +
      '<div class="ev"><span class="k">' + ico('clip') + 'Deadline</span><span class="v">' + (nextDl ? esc(nextDl.title) : 'None on file') + '</span>' + (nextDl ? '<span class="s">' + (nextDl.date < T ? 'Overdue' : relDay(nextDl.date)) + '</span>' : '') + '</div>' +
      '<div class="ev"><span class="k">' + ico('calendar') + 'Session</span><span class="v">' + (ns ? esc(subjName(ns.s.subjectId)) : 'None scheduled') + '</span>' + (ns ? '<span class="s">' + whenLabel(ns.s) + '</span>' : '') + '</div></div></section>' +
    '<section class="card c-tasks" aria-labelledby="h-tasks"><div class="card-head"><h2 id="h-tasks">Daily checklist</h2><div class="tabs" role="group" aria-label="Task range">' +
      ['today','upcoming','all'].map(function(x){ return '<button class="tab" type="button" data-act="tasks-tab" data-tab="' + x + '" aria-pressed="' + (ui.taskTab === x) + '">' + x.charAt(0).toUpperCase() + x.slice(1) + '</button>'; }).join('') + '</div></div>' +
      '<div id="task-list">' + taskListHTML() + '</div><button class="btn ghost add-inline" type="button" data-act="add" data-kind="task">' + ico('plus', 'sm') + 'Add a task</button><button class="btn ghost add-inline" type="button" data-act="nav" data-to="todo">View the full to-do list</button></section>' +
    '<section class="card c-week" aria-labelledby="h-week"><div class="card-head"><h2 id="h-week">This week</h2><button class="btn ghost sm" type="button" data-act="nav" data-to="planner">Open planner</button></div><ul class="week-list">' + weekRows + '</ul></section>' +
  '</div><div class="col">' +
    '<section class="card nextup c-next" aria-label="Next up">' + nextCard + '</section>' +
    '<section class="card c-progress" aria-labelledby="h-prog">' + (solved ? '<svg class="solved" viewBox="0 0 120 120" aria-hidden="true"><use href="#stamp"/></svg>' : '') +
      '<div class="card-head"><h2 id="h-prog">Case progress</h2></div><div class="ring-wrap"><div class="ring"><svg viewBox="0 0 100 100" aria-hidden="true"><circle class="bg" cx="50" cy="50" r="42"/><circle class="fg" cx="50" cy="50" r="42" stroke-dasharray="' + C.toFixed(2) + '" stroke-dashoffset="' + off.toFixed(2) + '"/></svg><div class="num"><div>' + pct + '%</div></div></div>' +
      '<div><p class="prog-text">' + done + ' of ' + total + ' tasks done</p><p class="muted" style="font-size:13.5px">' + (!total ? 'No case open yet.' : solved ? 'Case solved. Well investigated.' : 'Case in progress.') + '</p></div></div>' + (total ? '<div class="segs" aria-hidden="true">' + segs + '</div>' : '') + '</section>' +
    '<section class="card c-deadlines" aria-labelledby="h-dl"><div class="card-head"><h2 id="h-dl">Upcoming deadlines</h2><span class="classified">Classified: Academic Affairs</span></div>' + dlHTML +
      '<button class="btn ghost sm" type="button" data-act="nav" data-to="assignments" style="margin-top:10px">View all deadlines</button></section>' +
    '<section class="card c-streak" aria-labelledby="h-streak"><div class="card-head"><h2 id="h-streak">Study streak</h2></div><div class="streak"><div class="big">' + ico('flame') + stk + '</div><div><b>' + (stk === 1 ? 'day' : 'days') + ' in a row</b><p class="muted" style="font-size:13.5px">' + (stk ? 'A focus session or a finished task keeps it going.' : 'Start today with one focus session or one finished task.') + '</p></div></div><div class="days7" aria-label="Last seven days">' + days7 + '</div></section>' +
    '<section class="card note c-note" aria-label="A little dose of motivation"><blockquote>' + esc(noteOfTheDay()) + '</blockquote><div class="by"><span class="eyebrow">' + berry() + 'A little dose of motivation</span><span class="by-btns"><button class="btn ghost sm" type="button" data-act="note-next">Another one</button><button class="btn ghost sm" type="button" data-act="msg-manage">Add my own</button></span></div></section>' +
  '</div></div>';
}

/* ----- to-do list (same S.tasks as the dashboard checklist) ----- */
function todoList(){
  var f = ui.todoFilter, sj = ui.todoSubject;
  var list = S.tasks.filter(function(t){
    if(f === 'pending' && t.done) return false;
    if(f === 'done' && !t.done) return false;
    if(sj !== 'all' && (sj === 'none' ? t.subjectId : t.subjectId !== sj)) return false;
    return true;
  });
  list.sort(function(a, b){ return (a.done - b.done) || byDate(a, b) || (PRIO[b.priority] || 0) - (PRIO[a.priority] || 0); });
  if(!list.length){
    var empty = !S.tasks.length ? ['Create your first task', 'Type it in the box above and press Enter. It takes five seconds.'] : f === 'done' ? ['Nothing completed yet', 'Tick a task and it will show up here.'] : f === 'pending' ? ['All caught up', 'No pending tasks. Enjoy the calm.'] : ['No tasks match', 'Try another subject or filter.'];
    return '<div class="empty">' + berry() + '<h3>' + empty[0] + '</h3><p>' + empty[1] + '</p></div>';
  }
  return '<ul class="tasks">' + list.map(taskRow).join('') + '</ul>';
}
function viewTodo(){
  var f = ui.todoFilter, pending = S.tasks.filter(function(t){ return !t.done; }).length, done = S.tasks.length - pending;
  var tabs = [['all','All (' + S.tasks.length + ')'], ['pending','Pending (' + pending + ')'], ['done','Completed (' + done + ')']].map(function(x){ return '<button class="tab" type="button" data-act="todo-filter" data-f="' + x[0] + '" aria-pressed="' + (f === x[0]) + '">' + x[1] + '</button>'; }).join('');
  var subjOpts = '<option value="all">All subjects</option><option value="none"' + (ui.todoSubject === 'none' ? ' selected' : '') + '>No subject</option>' + S.subjects.map(function(s){ return '<option value="' + esc(s.id) + '"' + (ui.todoSubject === s.id ? ' selected' : '') + '>' + esc(s.name) + '</option>'; }).join('');
  return head('Tasks', 'To-do <em>List</em>', 'Quick to add, easy to tick off. The same tasks appear on your dashboard.', '<button class="btn" type="button" data-act="add" data-kind="task">' + ico('plus', 'sm') + 'Detailed task</button>') +
  '<section class="card"><form class="inline-form" data-form="todo-quick" novalidate><label class="sr" for="todo-input">Quick add a task</label><input type="text" id="todo-input" maxlength="140" placeholder="Quick add: type a task and press Enter" autocomplete="off"><button class="btn" type="submit">' + ico('plus', 'sm') + 'Add</button></form>' +
  '<div class="todo-bar"><div class="tabs" role="group" aria-label="Filter tasks">' + tabs + '</div><div class="field todo-subj"><label class="sr" for="todo-subj">Filter by subject</label><select id="todo-subj" data-act="todo-subject">' + subjOpts + '</select></div>' + (done ? '<button class="btn ghost sm" type="button" data-act="todo-clear-done">Clear completed</button>' : '') + '</div>' +
  '<div id="todo-list">' + todoList() + '</div></section>';
}

/* ----- planner ----- */
function viewPlanner(){
  var ws = parseISO(ui.weekStart) || weekStart(new Date()), T = todayISO(), we = addDays(ws, 6);
  var inWeek = false; for(var q = 0; q < 7; q++){ if(iso(addDays(ws, q)) === ui.selectedDay) inWeek = true; }
  if(!inWeek) ui.selectedDay = iso(ws);
  var range = new Intl.DateTimeFormat('en-GB', {day:'numeric', month:'short'}).format(ws) + ' to ' + new Intl.DateTimeFormat('en-GB', {day:'numeric', month:'short', year:'numeric'}).format(we);
  var strip = '', cols = '', total = 0;
  for(var i = 0; i < 7; i++){
    var day = addDays(ws, i), dIso = iso(day), ss = sessionsOn(dIso), sel = dIso === ui.selectedDay;
    total += ss.length;
    strip += '<button class="dchip' + (dIso === T ? ' today' : '') + '" type="button" data-act="day-pick" data-date="' + dIso + '" aria-pressed="' + sel + '" aria-label="' + fmtDate(dIso, {weekday:'long', day:'numeric', month:'long'}) + (ss.length ? ', ' + ss.length + ' sessions' : '') + '"><span class="wd">' + new Intl.DateTimeFormat('en-GB', {weekday:'short'}).format(day).slice(0, 3) + '</span><span class="nm">' + day.getDate() + '</span>' + (ss.length ? '<span class="dotm"></span>' : '<span style="height:7px"></span>') + '</button>';
    cols += '<section class="day' + (dIso === T ? ' is-today' : '') + (sel ? ' is-selected' : '') + '" aria-label="' + fmtDate(dIso, {weekday:'long', day:'numeric', month:'long'}) + '"><div class="day-h"><span class="wd">' + new Intl.DateTimeFormat('en-GB', {weekday:'short'}).format(day) + '</span><span class="nm">' + day.getDate() + '</span></div>' +
      (ss.length ? ss.map(function(s){
        return '<button class="sess" type="button" style="--sc:' + esc(subjColor(s.subjectId)) + '" data-act="ss-edit" data-id="' + esc(s.id) + '" aria-label="Edit session: ' + esc(subjName(s.subjectId)) + ' at ' + s.start + '"><span class="t">' + s.start + ' to ' + endTime(s) + ' · ' + fmtDur(s.duration) + '</span><span class="n">' + esc(subjName(s.subjectId)) + '</span>' + (s.notes ? '<span class="nt">' + esc(s.notes) + '</span>' : '') + '</button>';
      }).join('') : '<div class="day-empty"><div>Free day<br><button class="btn ghost sm" type="button" data-act="add" data-kind="session" data-date="' + dIso + '" style="margin-top:8px">' + ico('plus', 'sm') + 'Add</button></div></div>') + '</section>';
  }
  var body;
  if(!S.sessions.length){
    body = '<div class="card"><div class="empty">' + berry() + '<h3>Your planner is empty</h3><p>Block out your first study session and it will appear in the week view and on the dashboard.</p><button class="btn" type="button" data-act="add" data-kind="session">' + ico('plus', 'sm') + 'Add a study session</button></div></div>';
  } else {
    body = '<div class="daystrip" role="group" aria-label="Choose a day">' + strip + '</div><div class="dayhead-mobile">' + fmtDate(ui.selectedDay, {weekday:'long', day:'numeric', month:'long'}) + '</div><div class="week">' + cols + '</div>' +
      (total === 0 ? '<p class="muted" style="margin-top:14px;font-size:13.5px">No sessions planned this week yet. Tap Add on a day to start.</p>' : '');
  }
  return head('Schedule', 'My Planner', 'Plan the week, one focused block at a time.', '<button class="btn" type="button" data-act="add" data-kind="session">' + ico('plus', 'sm') + 'Add session</button>') +
    '<div class="week-bar"><h2>' + range + '</h2><button class="icon-btn" type="button" data-act="week-prev" aria-label="Previous week">' + ico('left') + '</button><button class="btn ghost sm" type="button" data-act="week-today">This week</button><button class="icon-btn" type="button" data-act="week-next" aria-label="Next week">' + ico('right') + '</button></div>' + body;
}

/* ----- assignments ----- */
function filteredAssignments(){
  var f = ui.filters, q = f.q.trim().toLowerCase();
  var list = S.assignments.filter(function(a){
    if(f.subject !== 'all' && a.subjectId !== f.subject) return false;
    if(f.priority !== 'all' && a.priority !== f.priority) return false;
    if(f.status !== 'all' && a.status !== f.status) return false;
    if(q && (a.title + ' ' + a.notes + ' ' + subjName(a.subjectId)).toLowerCase().indexOf(q) < 0) return false;
    return true;
  });
  var SO = {'Not Started':0, 'In Progress':1, 'Completed':2};
  list.sort(function(a, b){
    if(f.sort === 'priority') return PRIO[b.priority] - PRIO[a.priority] || a.due.localeCompare(b.due);
    if(f.sort === 'subject') return subjName(a.subjectId).localeCompare(subjName(b.subjectId)) || a.due.localeCompare(b.due);
    if(f.sort === 'status') return SO[a.status] - SO[b.status] || a.due.localeCompare(b.due);
    return ((a.status === 'Completed') - (b.status === 'Completed')) || a.due.localeCompare(b.due);
  });
  return list;
}
function assignmentRow(a){
  var T = todayISO(), n = diffDays(a.due, T), isDone = a.status === 'Completed', late = !isDone && n < 0;
  var dueTxt = isDone ? 'Completed' : late ? 'Overdue · ' + Math.abs(n) + (Math.abs(n) === 1 ? ' day' : ' days') : n === 0 ? 'Due today' : n === 1 ? 'Due tomorrow' : 'Due in ' + n + ' days';
  var stat = ['Not Started','In Progress','Completed'].map(function(s){ return '<option' + (s === a.status ? ' selected' : '') + '>' + s + '</option>'; }).join('');
  var pc = a.priority === 'High' ? 'high' : a.priority === 'Medium' ? 'med' : '';
  return '<li class="as' + (isDone ? ' done' : '') + (late ? ' late' : '') + '">' +
    '<button class="check" type="button" role="checkbox" aria-checked="' + isDone + '" data-act="as-toggle" data-id="' + esc(a.id) + '" aria-label="' + (isDone ? 'Reopen: ' : 'Mark completed: ') + esc(a.title) + '">' + ico('check') + '</button>' +
    '<div class="as-main"><span class="as-title">' + esc(a.title) + '</span><span class="as-meta">' + chip(a.subjectId) + '<span class="pill ' + (late ? 'late' : isDone ? 'ok' : '') + '">' + (late ? ico('clock', 'sm') : '') + dueTxt + '</span><span>' + fmtDate(a.due, SHORT) + '</span><span class="pill ' + pc + '">' + a.priority + ' priority</span></span>' + (a.notes ? '<span class="as-notes">' + esc(a.notes) + '</span>' : '') + '</div>' +
    '<div class="as-side"><select class="status-select" data-act="as-status" data-id="' + esc(a.id) + '" aria-label="Status for ' + esc(a.title) + '">' + stat + '</select>' +
    '<button class="icon-btn" type="button" data-act="as-edit" data-id="' + esc(a.id) + '" aria-label="Edit assignment: ' + esc(a.title) + '">' + ico('pencil', 'sm') + '</button>' +
    '<button class="icon-btn del" type="button" data-act="as-del" data-id="' + esc(a.id) + '" aria-label="Delete assignment: ' + esc(a.title) + '">' + ico('trash', 'sm') + '</button></div>' +
    (ui.justClosed === a.id ? '<svg class="closed-stamp" viewBox="0 0 120 120" aria-hidden="true"><use href="#stamp"/></svg><span class="closed-label" aria-hidden="true">Case closed!</span>' : '') + '</li>';
}
function assignmentResults(){
  var list = filteredAssignments(), f = ui.filters;
  var late = S.assignments.filter(function(a){ return a.status !== 'Completed' && a.due < todayISO(); }).length;
  var filtered = f.q || f.subject !== 'all' || f.priority !== 'all' || f.status !== 'all';
  var html = '<div class="summary-line"><span>Showing ' + list.length + ' of ' + S.assignments.length + ' assignments' + (late ? ' · ' + late + ' past due' : '') + '</span>' + (filtered ? '<button class="btn ghost sm" type="button" data-act="clear-filters">Clear filters</button>' : '') + '</div>';
  if(!list.length){
    html += '<div class="card"><div class="empty">' + berry() + '<h3>' + (S.assignments.length ? 'No assignments match' : 'No assignments yet') + '</h3><p>' + (S.assignments.length ? 'Try a different search or clear the filters.' : 'Add your first assignment to start tracking deadlines.') + '</p>' +
      (S.assignments.length ? '<button class="btn ghost" type="button" data-act="clear-filters">Clear filters</button>' : '<button class="btn" type="button" data-act="add" data-kind="assignment">' + ico('plus', 'sm') + 'Add assignment</button>') + '</div></div>';
  } else html += '<ul class="as-list">' + list.map(assignmentRow).join('') + '</ul>';
  return html;
}
function nextDeadlineCard(){
  var T = todayISO();
  var open = S.assignments.filter(function(a){ return a.status !== 'Completed'; }).sort(function(a, b){ return a.due.localeCompare(b.due); });
  var next = open.find(function(a){ return a.due >= T; }) || open[0];
  if(!next) return '<section class="card nextdl" aria-label="Next deadline"><div class="datebox">' + ico('done') + '</div><div><div class="eyebrow">Next deadline</div><h2>All clear</h2><p class="muted">Nothing open. Enjoy the quiet.</p></div></section>';
  var d = parseISO(next.due), late = next.due < T;
  return '<section class="card nextdl" aria-label="Next deadline"><div class="datebox' + (late ? ' late' : '') + '"><span class="mo">' + new Intl.DateTimeFormat('en-GB', {month:'short'}).format(d) + '</span><span class="dy">' + d.getDate() + '</span></div><div style="flex:1;min-width:200px"><div class="eyebrow">' + (late ? 'Oldest open item' : 'Next deadline') + '</div><h2>' + esc(next.title) + '</h2><span class="task-meta">' + chip(next.subjectId) + '<span>' + (late ? 'Overdue, was due ' + relDay(next.due) : 'Due ' + relDay(next.due)) + ' · ' + next.priority + ' priority</span></span></div><span class="classified">Classified: Academic Affairs</span></section>';
}
function viewAssignments(){
  var f = ui.filters;
  var sel = function(id, label, opts, v){ return '<div class="field"><label for="' + id + '">' + label + '</label><select id="' + id + '" data-filter="' + id.replace('flt-', '') + '">' + opts.map(function(o){ return '<option value="' + esc(o[0]) + '"' + (o[0] === v ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join('') + '</select></div>'; };
  return head('Evidence log', 'Assignments & Deadlines', 'Every open case, sorted the way you need it.', '<button class="btn" type="button" data-act="add" data-kind="assignment">' + ico('plus', 'sm') + 'New assignment</button>') +
    nextDeadlineCard() +
    '<div class="toolbar"><div class="field"><label for="flt-q">Search</label><div class="search">' + ico('search', 'sm') + '<input type="text" id="flt-q" data-filter="q" value="' + esc(f.q) + '" placeholder="Title, notes or subject" autocomplete="off"></div></div>' +
    sel('flt-subject', 'Subject', [['all', 'All subjects']].concat(S.subjects.map(function(s){ return [s.id, s.name]; })), f.subject) +
    sel('flt-priority', 'Priority', [['all','All priorities'],['High','High'],['Medium','Medium'],['Low','Low']], f.priority) +
    sel('flt-status', 'Status', [['all','All statuses'],['Not Started','Not Started'],['In Progress','In Progress'],['Completed','Completed']], f.status) +
    sel('flt-sort', 'Sort by', [['due','Due date'],['priority','Priority'],['subject','Subject'],['status','Status']], f.sort) + '</div>' +
    '<div id="as-results">' + assignmentResults() + '</div>';
}

/* ----- subjects ----- */
function subjectCard(s){
  var T = todayISO();
  var exam = s.exam ? '<div class="exam-row">' + ico('calendar', 'sm') + '<span>Exam ' + fmtDate(s.exam, SHORT) + '</span><span class="pill ' + (s.exam < T ? '' : 'high') + '">' + (s.exam < T ? 'Past' : relDay(s.exam)) + '</span></div>' : '<div class="exam-row muted">' + ico('calendar', 'sm') + '<span>Exam date not announced yet</span></div>';
  var mats = s.materials.length ? s.materials.map(function(m){ return '<a class="btn soft sm" href="' + esc(m.url) + '" target="_blank" rel="noopener noreferrer">' + ico('ext', 'sm') + esc(m.label) + '</a>'; }).join('') :
    '<button class="btn ghost sm" type="button" data-act="subj-edit" data-id="' + esc(s.id) + '">' + ico('plus', 'sm') + 'Add study materials</button>';
  var chs = s.chapters.map(function(c){
    return '<li class="task' + (c.done ? ' done' : '') + '"><button class="check" type="button" role="checkbox" aria-checked="' + c.done + '" data-act="ch-toggle" data-sid="' + esc(s.id) + '" data-id="' + esc(c.id) + '" aria-label="' + (c.done ? 'Mark not studied: ' : 'Mark studied: ') + esc(c.title) + '">' + ico('check') + '</button><div class="task-main"><span class="task-title">' + esc(c.title) + '</span>' + (c.note ? '<span class="task-desc">' + esc(c.note) + '</span>' : '') + '</div>' +
      '<div class="row-actions"><button class="icon-btn" type="button" data-act="ch-edit" data-sid="' + esc(s.id) + '" data-id="' + esc(c.id) + '" aria-label="Rename chapter: ' + esc(c.title) + '">' + ico('pencil', 'sm') + '</button><button class="icon-btn del" type="button" data-act="ch-del" data-sid="' + esc(s.id) + '" data-id="' + esc(c.id) + '" aria-label="Delete chapter: ' + esc(c.title) + '">' + ico('trash', 'sm') + '</button></div></li>';
  }).join('');
  var chDone = s.chapters.filter(function(c){ return c.done; }).length;
  var chapters = '<div class="chapters"><div class="rev-head"><span class="lbl">Chapters and topics</span>' + (s.chapters.length ? '<span class="muted" style="font-size:12.5px">' + chDone + ' of ' + s.chapters.length + ' studied</span>' : '') + '</div>' +
    (s.chapters.length ? '<ul class="tasks">' + chs + '</ul>' : '<p class="muted" style="font-size:13.5px">No chapters yet. Add the topics you need to cover.</p>') +
    '<form class="inline-form" data-form="chapter-add" data-sid="' + esc(s.id) + '" novalidate><label class="sr" for="chin-' + esc(s.id) + '">New chapter or topic for ' + esc(s.name) + '</label><input type="text" id="chin-' + esc(s.id) + '" maxlength="100" placeholder="Add a chapter or topic" autocomplete="off"><button class="btn" type="submit" aria-label="Add chapter">' + ico('plus', 'sm') + '</button></form></div>';
  return '<article class="card subj" style="--sc:' + esc(s.color) + '"><div class="subj-top"><div class="subj-title"><span class="dotc"></span><div><h3>' + esc(s.name) + (s.sample ? ' ' + SAMPLE_BADGE : '') + '</h3>' + (s.description ? '<p class="lect">' + esc(s.description) + '</p>' : '') +
    '<p class="lect' + (s.lecturer ? '' : ' ph') + '">' + (s.lecturer ? esc(s.lecturer) : 'Lecturer name to be added') + '</p></div></div>' +
    '<div style="display:flex;flex:none"><button class="icon-btn" type="button" data-act="subj-edit" data-id="' + esc(s.id) + '" aria-label="Edit ' + esc(s.name) + '">' + ico('pencil', 'sm') + '</button></div></div>' + exam +
    '<div><div class="rev-head"><label class="lbl" for="prog-' + esc(s.id) + '">Revision progress</label><output id="progout-' + esc(s.id) + '" for="prog-' + esc(s.id) + '">' + s.progress + '%</output></div>' +
    '<input type="range" id="prog-' + esc(s.id) + '" min="0" max="100" step="5" value="' + s.progress + '" data-act="subj-progress" data-id="' + esc(s.id) + '"></div>' +
    chapters + '<div class="field"><label for="notes-' + esc(s.id) + '">Personal notes</label><textarea id="notes-' + esc(s.id) + '" data-act="subj-notes" data-id="' + esc(s.id) + '" maxlength="600" placeholder="Write a reminder for yourself">' + esc(s.notes) + '</textarea></div>' +
    '<div class="mats">' + mats + '</div></article>';
}
function syncProgress(s){ if(s.chapters.length) s.progress = Math.round(s.chapters.filter(function(c){ return c.done; }).length / s.chapters.length * 100); }
function chapterForm(s, c){
  openModal(modalHead('Edit chapter', s.name) +
    '<form data-form="chapter" data-sid="' + esc(s.id) + '" data-id="' + esc(c.id) + '" novalidate><div class="form-grid">' +
    '<div class="full">' + field('Chapter or topic', 'f-title', '<input type="text" id="f-title" maxlength="100" value="' + esc(c.title) + '" autocomplete="off">') + '</div>' +
    '<div class="full">' + field('Note (optional)', 'f-notes', '<textarea id="f-notes" maxlength="200" rows="2">' + esc(c.note || '') + '</textarea>') + '</div>' +
    '</div><div class="actions"><button class="btn ghost" type="button" data-act="close-modal">Cancel</button><button class="btn" type="submit">Save changes</button></div></form>', true);
}
function viewSubjects(){
  return head('Course files', 'My Subjects', 'Notes, exam dates and revision progress for every course.', '<button class="btn" type="button" data-act="add" data-kind="subject">' + ico('plus', 'sm') + 'Add subject</button>') +
    (S.subjects.length ? '<div class="subj-grid">' + S.subjects.map(subjectCard).join('') + '</div>' :
    '<div class="card"><div class="empty">' + berry() + '<h3>No subjects yet</h3><p>Add your first course to track notes, exams and revision.</p><button class="btn" type="button" data-act="add" data-kind="subject">' + ico('plus', 'sm') + 'Add subject</button></div></div>');
}

/* ----- study room ----- */
var CIRC = 2 * Math.PI * 88;
function durMs(mode){ return (mode === 'focus' ? CONFIG.focusMinutes : CONFIG.breakMinutes) * 60000; }
function remaining(){ var t = S.timer; return t.running ? Math.max(0, t.endsAt - Date.now()) : t.remainingMs; }
function fmtClock(ms){ var s = Math.ceil(ms / 1000); return pad(Math.floor(s / 60)) + ':' + pad(s % 60); }
function ringOffset(){ var tot = durMs(S.timer.mode); return CIRC * (1 - Math.max(0, Math.min(1, remaining() / tot))); }
function stateLabel(){ var t = S.timer, full = t.remainingMs >= durMs(t.mode) && !t.running; return t.running ? (t.mode === 'focus' ? 'Focusing' : 'On a break') : full ? 'Ready' : 'Paused'; }
function todayLogs(){ var T = todayISO(); return S.history.filter(function(h){ return h.date === T; }); }
function viewStudy(){
  var t = S.timer, running = t.running, logs = todayLogs(), mins = logs.reduce(function(a, b){ return a + b.minutes; }, 0);
  var total = S.history.length, totalMin = S.history.reduce(function(a, b){ return a + b.minutes; }, 0);
  var recent = S.history.slice().sort(function(a, b){ return b.endedAt - a.endedAt; }).slice(0, 6);
  var hist = recent.length ? '<ul class="hist">' + recent.map(function(h){
    var dt = new Date(h.endedAt), n = diffDays(h.date, todayISO());
    return '<li><span><b style="font-weight:600">' + esc(h.subjectId ? subjName(h.subjectId) : 'General focus') + '</b><br><span class="muted">' + (n === 0 ? 'Today' : n === 1 ? 'Yesterday' : fmtDate(h.date, SHORT)) + ', ' + pad(dt.getHours()) + ':' + pad(dt.getMinutes()) + '</span></span><span class="m">' + h.minutes + ' min</span></li>';
  }).join('') + '</ul>' : '<div class="empty">' + berry() + '<h3>No sessions logged yet</h3><p>Finish a focus session and it will be filed here.</p></div>';
  var checklist = S.checklist.length ? '<ul class="tasks">' + S.checklist.map(function(c){
    return '<li class="task' + (c.done ? ' done' : '') + '"><button class="check" type="button" role="checkbox" aria-checked="' + c.done + '" data-act="ck-toggle" data-id="' + esc(c.id) + '" aria-label="' + esc(c.text) + '">' + ico('check') + '</button><div class="task-main"><span class="task-title">' + esc(c.text) + '</span></div><button class="icon-btn del" type="button" data-act="ck-del" data-id="' + esc(c.id) + '" aria-label="Remove ' + esc(c.text) + '">' + ico('x', 'sm') + '</button></li>';
  }).join('') + '</ul>' : '<p class="muted" style="font-size:14px">Your checklist is empty. Add the things you need before you begin.</p>';
  var fin = ui.lastFinish ? '<div class="finish-note">' + ico('done', 'sm') + (ui.lastFinish.mode === 'focus' ? (ui.lastFinish.early ? 'Logged ' + ui.lastFinish.mins + ' min of focus. Nicely done.' : 'Focus session logged. Time for a short break.') : 'Break finished. Ready for another round?') + '</div>' : '';
  return head('Study room', 'Focus <em>time</em>', 'One goal, one timer, no noise.', '<button class="btn ghost" type="button" data-act="focus-mode">' + ico('focus', 'sm') + 'Distraction-free mode</button>') +
  '<div class="study"><section class="card timer-card" aria-label="Pomodoro timer">' +
    '<div class="seg-ctl" role="group" aria-label="Timer mode"><button type="button" data-act="t-mode" data-mode="focus" aria-pressed="' + (t.mode === 'focus') + '">Focus ' + CONFIG.focusMinutes + '</button><button type="button" data-act="t-mode" data-mode="break" aria-pressed="' + (t.mode === 'break') + '">Break ' + CONFIG.breakMinutes + '</button></div>' +
    '<div class="dial"><svg viewBox="0 0 200 200" aria-hidden="true"><circle class="bg" cx="100" cy="100" r="88"/><circle class="fg" id="timer-ring" cx="100" cy="100" r="88" stroke-dasharray="' + CIRC.toFixed(2) + '" stroke-dashoffset="' + ringOffset().toFixed(2) + '"/></svg>' +
      '<div class="mid"><div class="time" id="timer-time" role="timer" aria-live="off">' + fmtClock(remaining()) + '</div><div class="state" id="timer-state">' + stateLabel() + '</div></div></div>' + fin +
    '<div class="controls"><button class="btn lg" type="button" id="timer-toggle" data-act="t-toggle">' + ico(running ? 'pause' : 'play') + '<span>' + (running ? 'Pause' : (stateLabel() === 'Paused' ? 'Resume' : 'Start')) + '</span></button>' +
      '<button class="btn ghost lg" type="button" data-act="t-reset">' + ico('reset') + 'Reset</button>' +
      '<button class="btn soft lg" type="button" data-act="t-finish">' + ico('done') + 'Finish session</button></div>' +
    '<div class="timer-subject"><label for="timer-subject">Studying</label><select id="timer-subject" data-act="timer-subject">' + subjectOptions(t.subjectId, true) + '</select></div>' +
    '<div class="tally"><div><b>' + logs.length + '</b>session' + (logs.length === 1 ? '' : 's') + ' today</div><div><b>' + mins + '</b>focus minutes today</div><div><b>' + total + '</b>total sessions</div></div></section>' +
  '<div class="side-col"><section class="card" aria-labelledby="h-ck"><div class="card-head"><h2 id="h-ck">Focus checklist</h2>' + (S.checklist.some(function(c){ return c.done; }) ? '<button class="btn ghost sm" type="button" data-act="ck-clear">Untick all</button>' : '') + '</div>' + checklist +
    '<form class="inline-form" data-form="ck" novalidate><label class="sr" for="ck-input">New checklist item</label><input type="text" id="ck-input" maxlength="80" placeholder="Add an item" autocomplete="off"><button class="btn" type="submit" aria-label="Add checklist item">' + ico('plus', 'sm') + '</button></form></section>' +
  '<section class="card hist-card" aria-labelledby="h-hist"><div class="card-head"><h2 id="h-hist">Session history</h2>' + (S.history.length ? '<button class="btn ghost sm" type="button" data-act="hist-clear">Clear</button>' : '') + '</div>' + hist +
    (S.history.length ? '<p class="muted" style="font-size:12.5px;margin-top:10px">' + total + ' sessions, ' + Calc.fmt(totalMin / 60, 1) + ' focus hours in total.</p>' : '') + '</section></div></div>';
}

/* ----- timer logic (timestamp based, so pauses and background tabs stay accurate) ----- */
var actx = null;
function unlockAudio(){ try{ actx = actx || new (window.AudioContext || window.webkitAudioContext)(); if(actx.state === 'suspended') actx.resume(); }catch(e){} }
function beep(){
  if(!S.settings.sound) return;
  try{
    unlockAudio(); if(!actx) return; var now = actx.currentTime;
    [659, 880].forEach(function(f, i){
      var o = actx.createOscillator(), g = actx.createGain(), at = now + i * .24;
      o.type = 'sine'; o.frequency.value = f; g.gain.setValueAtTime(0, at); g.gain.linearRampToValueAtTime(.12, at + .03); g.gain.exponentialRampToValueAtTime(.0001, at + .4);
      o.connect(g); g.connect(actx.destination); o.start(at); o.stop(at + .45);
    });
  }catch(e){}
}
function logFocus(minutes){ S.history.push({id:uid(), date:todayISO(), endedAt:Date.now(), minutes:minutes, subjectId:S.timer.subjectId || ''}); }
function timerStart(){
  var t = S.timer; if(t.running) return; unlockAudio(); ui.lastFinish = null;
  if(t.remainingMs <= 0) t.remainingMs = durMs(t.mode);
  t.endsAt = Date.now() + t.remainingMs; t.running = true; save(); render();
}
function timerPause(){ var t = S.timer; if(!t.running) return; t.remainingMs = remaining(); t.running = false; t.endsAt = null; save(); render(); }
function timerReset(){ var t = S.timer; t.running = false; t.endsAt = null; t.remainingMs = durMs(t.mode); ui.lastFinish = null; save(); render(); }
function timerMode(mode){ var t = S.timer; if(t.mode === mode) return; t.mode = mode; t.running = false; t.endsAt = null; t.remainingMs = durMs(mode); ui.lastFinish = null; save(); render(); }
function timerFinishEarly(){
  var t = S.timer, elapsed = durMs(t.mode) - remaining();
  if(t.mode === 'focus'){
    if(elapsed < 60000){ toast('Less than a minute so far, so nothing was logged. Keep going or reset.'); return; }
    var mins = Math.max(1, Math.round(elapsed / 60000));
    t.running = false; t.endsAt = null; logFocus(mins); t.remainingMs = durMs('focus'); ui.lastFinish = {mode:'focus', early:true, mins:mins};
    toast('Case closed! ' + mins + ' min of focus logged.', 'ok');
  } else {
    t.running = false; t.endsAt = null; t.mode = 'focus'; t.remainingMs = durMs('focus'); ui.lastFinish = {mode:'break'}; toast('Break ended. Back to focus.');
  }
  save(); render();
}
function timerComplete(){
  var t = S.timer, mode = t.mode; t.running = false; t.endsAt = null;
  if(mode === 'focus'){ logFocus(CONFIG.focusMinutes); t.mode = 'break'; ui.lastFinish = {mode:'focus'}; toast('Case closed! Focus session logged.', 'ok'); }
  else { t.mode = 'focus'; ui.lastFinish = {mode:'break'}; toast('Break is over. Ready for another round?'); }
  t.remainingMs = durMs(t.mode); save(); beep(); render();
}
function tick(){
  var t = S.timer;
  if(t.running && t.endsAt - Date.now() <= 0){ timerComplete(); return; }
  var time = $('#timer-time'); if(!time) return;
  var txt = fmtClock(remaining()); if(time.textContent !== txt) time.textContent = txt;
  var ring = $('#timer-ring'); if(ring) ring.setAttribute('stroke-dashoffset', ringOffset().toFixed(2));
}

/* ----- toolkit ----- */
function numField(id, label, value, hint, full){
  return '<div class="field' + (full ? ' full' : '') + '"><label for="' + id + '" id="lbl-' + id + '">' + label + '</label><input type="text" inputmode="decimal" id="' + id + '" data-calc="' + id.split('-')[0] + '" data-label="' + esc(label) + '" value="' + esc(value) + '" autocomplete="off">' + (hint ? '<p class="hint">' + hint + '</p>' : '') + '</div>';
}
function viewToolkit(){
  return head('Toolkit', 'Business Toolkit', 'Quick calculations for coursework. Everything is worked out on this device.') +
  '<div class="tool-note">' + ico('info') + '<span>These are learning aids. Check the formulas against the ones your course uses. Example values are filled in so you can see how each tool works; replace them with your own. Use a dot or a comma for decimals.</span></div>' +
  '<div class="calc-grid">' +
  '<section class="card calc" aria-labelledby="c1"><h2 id="c1">' + ico('calc') + 'Percentage calculator</h2><div class="field"><label for="pct-mode">What do you want to find?</label><select id="pct-mode" data-calc="pct"><option value="of">X% of Y</option><option value="is">X is what % of Y</option><option value="change">Percentage change from A to B</option></select></div>' +
    '<div class="formula" id="pct-formula"></div><div class="fields">' + numField('pct-a', '', '15') + numField('pct-b', '', '240') + '</div><div class="out" id="out-pct" aria-live="polite"></div></section>' +
  '<section class="card calc" aria-labelledby="c2"><h2 id="c2">' + ico('calc') + 'Profit margin</h2><div class="formula">gross profit = revenue − cost<br>margin % = profit ÷ revenue × 100<br>markup % = profit ÷ cost × 100</div><div class="fields">' + numField('mar-rev', 'Revenue (selling price)', '1200') + numField('mar-cost', 'Cost', '780') + '</div><div class="out" id="out-mar" aria-live="polite"></div></section>' +
  '<section class="card calc" aria-labelledby="c3"><h2 id="c3">' + ico('calc') + 'Revenue, cost and profit</h2><div class="formula">revenue = units × price<br>total cost = fixed + units × variable cost<br>profit = revenue − total cost</div><div class="fields">' + numField('rcp-units', 'Units sold', '400') + numField('rcp-price', 'Price per unit', '25') + numField('rcp-vc', 'Variable cost per unit', '15') + numField('rcp-fixed', 'Fixed costs', '3000') + '</div><div class="out" id="out-rcp" aria-live="polite"></div></section>' +
  '<section class="card calc" aria-labelledby="c4"><h2 id="c4">' + ico('calc') + 'Break-even point</h2><div class="formula">contribution per unit = price − variable cost<br>break-even units = fixed costs ÷ contribution<br>break-even revenue = units × price</div><div class="fields">' + numField('be-fixed', 'Fixed costs', '5000', '', true) + numField('be-price', 'Selling price per unit', '25') + numField('be-vc', 'Variable cost per unit', '15') + '</div><div class="out" id="out-be" aria-live="polite"></div></section>' +
  '<section class="card calc" aria-labelledby="c5"><h2 id="c5">' + ico('calc') + 'Average</h2><div class="formula">mean = sum of values ÷ number of values</div><div class="field"><label for="avg-list" id="lbl-avg-list">Values</label><textarea id="avg-list" data-calc="avg" data-label="Values" rows="3" placeholder="12 15 18 or one per line">12, 15, 18, 14</textarea><p class="hint">Separate with spaces, new lines, or a comma followed by a space.</p></div><div class="out" id="out-avg" aria-live="polite"></div></section>' +
  '<section class="card calc" aria-labelledby="c6"><h2 id="c6">' + ico('calc') + 'VAT (TVA)</h2><div class="field"><label for="vat-mode">What do you start from?</label><select id="vat-mode" data-calc="vat"><option value="excl">Price excluding VAT (HT)</option><option value="incl">Price including VAT (TTC)</option></select></div>' +
    '<div class="formula">price incl. VAT = price excl. VAT × (1 + rate ÷ 100)<br>VAT amount = price incl. VAT − price excl. VAT</div><div class="fields">' + numField('vat-amt', 'Amount', '100') + numField('vat-rate', 'VAT rate (%)', '20', 'Check the rate that applies in your country.') + '</div><div class="out" id="out-vat" aria-live="polite"></div></section>' +
  '</div>';
}
function outRows(rows){ return '<dl>' + rows.map(function(r){ return '<dt>' + r[0] + '</dt><dd' + (r[2] ? ' class="big"' : '') + '>' + r[1] + '</dd>'; }).join('') + '</dl>'; }
function setOut(name, kind, html){ var el = $('#out-' + name); if(!el) return; el.className = 'out' + (kind ? ' ' + kind : ''); el.innerHTML = html; }
function readInputs(ids){
  var vals = {}, bad = null, empty = false;
  ids.forEach(function(id){
    var el = $('#' + id); if(!el) return; var r = Calc.num(el.value);
    el.removeAttribute('aria-invalid');
    if(r.ok) vals[id] = r.value;
    else if(r.empty) empty = true;
    else { el.setAttribute('aria-invalid', 'true'); if(!bad) bad = (el.dataset.label || el.previousElementSibling && el.previousElementSibling.textContent || id) + ': ' + r.error; }
  });
  return {vals:vals, bad:bad, empty:empty};
}
function runCalc(name){
  var pc = function(n){ return n == null ? 'not defined' : Calc.fmt(n, 2) + '%'; };
  if(name === 'pct'){
    var mode = $('#pct-mode').value;
    var L = {of:['Percentage X (%)','Whole Y','result = X ÷ 100 × Y'], is:['Part X','Whole Y','result % = X ÷ Y × 100'], change:['Starting value A','New value B','change % = (B − A) ÷ |A| × 100']}[mode];
    $('#lbl-pct-a').textContent = L[0]; $('#lbl-pct-b').textContent = L[1]; $('#pct-formula').textContent = L[2];
    $('#pct-a').dataset.label = L[0]; $('#pct-b').dataset.label = L[1];
    var r = readInputs(['pct-a','pct-b']);
    if(r.bad) return setOut('pct', 'bad', '<p class="msg">' + esc(r.bad) + '</p>');
    if(r.empty) return setOut('pct', 'idle', '<p class="msg">Fill in both values to see the result.</p>');
    var res = Calc.percent(mode, r.vals['pct-a'], r.vals['pct-b']);
    if(!res.ok) return setOut('pct', 'bad', '<p class="msg">' + esc(res.error) + '</p>');
    var label = mode === 'of' ? Calc.fmt(r.vals['pct-a'], 4) + '% of ' + Calc.fmt(r.vals['pct-b'], 4) : mode === 'is' ? Calc.fmt(res.result, 2) + '%' : 'Change';
    return setOut('pct', '', outRows([[mode === 'of' ? label : mode === 'is' ? 'X as a share of Y' : 'Percentage change', mode === 'of' ? Calc.fmt(res.result, 4) : Calc.fmt(res.result, 2) + '%', true]]));
  }
  if(name === 'mar'){
    var m = readInputs(['mar-rev','mar-cost']);
    if(m.bad) return setOut('mar', 'bad', '<p class="msg">' + esc(m.bad) + '</p>');
    if(m.empty) return setOut('mar', 'idle', '<p class="msg">Fill in revenue and cost to see the result.</p>');
    var mr = Calc.margin(m.vals['mar-rev'], m.vals['mar-cost']);
    if(!mr.ok) return setOut('mar', 'bad', '<p class="msg">' + esc(mr.error) + '</p>');
    return setOut('mar', '', outRows([['Profit margin', pc(mr.marginPct), true], ['Gross profit', Calc.fmt(mr.profit)], ['Markup on cost', pc(mr.markupPct)]]) + (mr.marginPct == null ? '<p class="tip">Margin is not defined when revenue is zero.</p>' : ''));
  }
  if(name === 'rcp'){
    var q = readInputs(['rcp-units','rcp-price','rcp-vc','rcp-fixed']);
    if(q.bad) return setOut('rcp', 'bad', '<p class="msg">' + esc(q.bad) + '</p>');
    if(q.empty) return setOut('rcp', 'idle', '<p class="msg">Fill in all four values to see the result.</p>');
    var rc = Calc.rcp(q.vals['rcp-units'], q.vals['rcp-price'], q.vals['rcp-vc'], q.vals['rcp-fixed']);
    if(!rc.ok) return setOut('rcp', 'bad', '<p class="msg">' + esc(rc.error) + '</p>');
    return setOut('rcp', '', outRows([[rc.profit >= 0 ? 'Profit' : 'Loss', Calc.fmt(rc.profit), true], ['Revenue', Calc.fmt(rc.revenue)], ['Variable costs', Calc.fmt(rc.variable)], ['Total costs', Calc.fmt(rc.total)], ['Profit margin', pc(rc.marginPct)]]));
  }
  if(name === 'be'){
    var b = readInputs(['be-fixed','be-price','be-vc']);
    if(b.bad) return setOut('be', 'bad', '<p class="msg">' + esc(b.bad) + '</p>');
    if(b.empty) return setOut('be', 'idle', '<p class="msg">Fill in all three values to see the result.</p>');
    var be = Calc.breakEven(b.vals['be-fixed'], b.vals['be-price'], b.vals['be-vc']);
    if(!be.ok) return setOut('be', 'bad', '<p class="msg">' + esc(be.error) + '</p>');
    return setOut('be', '', outRows([['Break-even units', Calc.fmt(be.units, 2), true], ['Round up to whole units', Calc.fmt(be.unitsCeil, 0)], ['Break-even revenue', Calc.fmt(be.revenue)], ['Contribution per unit', Calc.fmt(be.cm)], ['Contribution ratio', pc(be.cmRatio)]]) + '<p class="tip">Sell at least ' + Calc.fmt(be.unitsCeil, 0) + ' units to cover all costs.</p>');
  }
  if(name === 'vat'){
    var vm = $('#vat-mode').value;
    $('#lbl-vat-amt').textContent = vm === 'excl' ? 'Price excluding VAT (HT)' : 'Price including VAT (TTC)'; $('#vat-amt').dataset.label = $('#lbl-vat-amt').textContent;
    var vr = readInputs(['vat-amt','vat-rate']);
    if(vr.bad) return setOut('vat', 'bad', '<p class="msg">' + esc(vr.bad) + '</p>');
    if(vr.empty) return setOut('vat', 'idle', '<p class="msg">Fill in the amount and the rate to see the result.</p>');
    var vt = Calc.vat(vm, vr.vals['vat-amt'], vr.vals['vat-rate']);
    if(!vt.ok) return setOut('vat', 'bad', '<p class="msg">' + esc(vt.error) + '</p>');
    return setOut('vat', '', outRows([[vm === 'excl' ? 'Price including VAT (TTC)' : 'Price excluding VAT (HT)', Calc.fmt(vm === 'excl' ? vt.incl : vt.excl), true], ['VAT amount', Calc.fmt(vt.vat)], ['Excluding VAT (HT)', Calc.fmt(vt.excl)], ['Including VAT (TTC)', Calc.fmt(vt.incl)]]));
  }
  if(name === 'avg'){
    var el = $('#avg-list'); el.removeAttribute('aria-invalid');
    var av = Calc.average(el.value);
    if(av.empty) return setOut('avg', 'idle', '<p class="msg">Enter at least one number to see the average.</p>');
    if(!av.ok){ el.setAttribute('aria-invalid', 'true'); return setOut('avg', 'bad', '<p class="msg">' + esc(av.error) + '</p>'); }
    return setOut('avg', '', outRows([['Mean', Calc.fmt(av.mean, 4), true], ['Median', Calc.fmt(av.median, 4)], ['Count', Calc.fmt(av.count, 0)], ['Sum', Calc.fmt(av.sum, 4)], ['Lowest', Calc.fmt(av.min, 4)], ['Highest', Calc.fmt(av.max, 4)]]));
  }
}

/* ---------------------------- render & navigation ---------------------------- */
var VIEWS = {dashboard:viewDashboard, planner:viewPlanner, todo:viewTodo, assignments:viewAssignments, subjects:viewSubjects, study:viewStudy, toolkit:viewToolkit};
function buildNav(){
  $('#side-nav').innerHTML = NAV.map(function(n){ return '<a class="nav-item" href="#' + n.id + '" data-act="nav" data-to="' + n.id + '"' + (ui.route === n.id ? ' aria-current="page"' : '') + '>' + ico(n.icon) + '<span>' + n.label + '</span></a>'; }).join('');
  var mobile = ['dashboard','planner','assignments','study'];
  var moreActive = ui.route === 'subjects' || ui.route === 'toolkit' || ui.route === 'todo';
  $('#bottom-nav').innerHTML = mobile.map(function(id){ var n = NAV.find(function(x){ return x.id === id; }); return '<a class="bn" href="#' + id + '" data-act="nav" data-to="' + id + '"' + (ui.route === id ? ' aria-current="page"' : '') + '>' + ico(n.icon) + '<span>' + (n.short || n.label.replace('My ', '')) + '</span></a>'; }).join('') +
    '<button class="bn" type="button" data-act="more"' + (moreActive ? ' aria-current="page"' : '') + '>' + ico('more') + '<span>More</span></button>';
}
function effectiveTheme(){
  var t = S.settings.theme;
  if(t === 'light' || t === 'dark') return t;
  try{ return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'; }catch(e){ return 'light'; }
}
function paintThemeBtn(){
  var dark = effectiveTheme() === 'dark';
  $$('[data-theme-btn]').forEach(function(b){
    var label = dark ? 'Switch to light theme (Raspberry Pink)' : 'Switch to dark theme (Dark Raspberry)';
    b.setAttribute('aria-label', label); b.setAttribute('title', label);
    b.innerHTML = ico(dark ? 'sun' : 'moon', 'sm') + (b.hasAttribute('data-icon-only') ? '' : (dark ? 'Light theme' : 'Dark theme'));
  });
}
function applySettings(){
  var root = document.documentElement, th = S.settings.theme;
  if(th === 'light' || th === 'dark') root.setAttribute('data-theme', th); else root.removeAttribute('data-theme');
  paintThemeBtn();
  root.style.setProperty('--i', S.settings.accent);
  document.body.classList.toggle('no-texture', !S.settings.texture);
}
function render(){
  if(!VIEWS[ui.route]) ui.route = 'dashboard';
  $('#view').innerHTML = VIEWS[ui.route]();
  buildNav();
  $('#fab').style.display = '';
  $('#fab').hidden = !(ui.route === 'dashboard' || ui.route === 'planner' || ui.route === 'assignments' || ui.route === 'todo');
  if(ui.route === 'toolkit'){ ['pct','mar','rcp','be','vat','avg'].forEach(runCalc); }
  if(ui.focusMode && ui.route !== 'study'){ ui.focusMode = false; document.body.classList.remove('focus-mode'); }
}
function go(route, keepScroll){
  if(ROUTES.indexOf(route) < 0) return;
  ui.route = route;
  try{ history.replaceState(null, '', '#' + route); }catch(e){}
  render();
  if(!keepScroll){ window.scrollTo(0, 0); $('#view').focus({preventScroll:true}); }
}
function refocus(sel){ setTimeout(function(){ var el = $(sel); if(el) el.focus(); }, 0); }

/* ---------------------------- events ---------------------------- */
document.addEventListener('click', function(e){
  var el = e.target.closest('[data-act]'); if(!el) return;
  var act = el.dataset.act, id = el.dataset.id;
  if(act === 'overlay'){ if(e.target === el) closeModal(); return; }
  if(el.tagName === 'A') e.preventDefault();
  switch(act){
    case 'nav': closeModal(); go(el.dataset.to); break;
    case 'todo-filter': ui.todoFilter = el.dataset.f; render(); break;
    case 'todo-clear-done': {
      var nd = S.tasks.filter(function(x){ return x.done; }).length; if(!nd) break;
      confirmBox('Clear completed tasks?', nd + ' completed task' + (nd === 1 ? '' : 's') + ' will be removed for good.', 'Clear completed', function(){ S.tasks = S.tasks.filter(function(x){ return !x.done; }); save(); render(); toast('Completed tasks cleared.'); }); break; }
    case 'msg-manage': closeModal(); messagesForm(); break;
    case 'msg-del': S.messages = S.messages.filter(function(m){ return m.id !== id; }); S.settings.noteIndex = -1; save(); messagesForm(); render(); toast('Message removed.'); break;
    case 'remove-samples':
      confirmBox('Remove all sample content?', 'Sample subjects, tasks, assignments, planner sessions and focus history will be deleted. Anything you created yourself stays.', 'Remove samples', function(){
        var gone = {}; S.subjects.forEach(function(x){ if(x.sample) gone[x.id] = 1; });
        ['subjects','tasks','assignments','sessions','history'].forEach(function(k){ S[k] = S[k].filter(function(x){ return !x.sample; }); });
        ['tasks','assignments','sessions','history'].forEach(function(k){ S[k].forEach(function(x){ if(gone[x.subjectId]) x.subjectId = ''; }); });
        if(gone[S.timer.subjectId]) S.timer.subjectId = '';
        S.sessions = S.sessions.filter(function(x){ return x.subjectId; });
        save(); render(); toast('Sample content removed.', 'ok'); }); break;
    case 'theme-toggle': S.settings.theme = effectiveTheme() === 'dark' ? 'light' : 'dark'; save(); applySettings(); break;
    case 'more': moreSheet(); break;
    case 'open-settings': closeModal(); settingsForm(); break;
    case 'close-modal': closeModal(); break;
    case 'quick-add': quickAdd(); break;
    case 'add': {
      var kind = el.dataset.kind; closeModal();
      if(kind === 'task') taskForm(); else if(kind === 'assignment') assignmentForm(); else if(kind === 'session') sessionForm(null, el.dataset.date); else if(kind === 'subject') subjectForm();
      break; }
    case 'confirm-yes': { var fn = pendingConfirm; pendingConfirm = null; closeModal(); if(fn) fn(); break; }
    case 'reset-data':
      confirmBox('Reset to sample data?', 'This replaces all your tasks, assignments, subjects, sessions, history and personal messages with the sample set. Your theme and settings stay. It cannot be undone.', 'Reset everything', function(){ var keep = S.settings; S = seed(); S.settings = keep; save(); applySettings(); ui.justClosed = null; ui.lastFinish = null; render(); toast('Sample data restored.', 'ok'); });
      break;
    case 'tasks-tab': ui.taskTab = el.dataset.tab; $('#task-list').innerHTML = taskListHTML(); $$('[data-act=tasks-tab]').forEach(function(b){ b.setAttribute('aria-pressed', String(b.dataset.tab === ui.taskTab)); }); break;
    case 'task-toggle': {
      var t = S.tasks.find(function(x){ return x.id === id; }); if(!t) break;
      t.done = !t.done; t.doneAt = t.done ? todayISO() : ''; save(); render();
      if(t.done) toast('Task done. One loose end fewer.', 'ok'); break; }
    case 'task-edit': { var te = S.tasks.find(function(x){ return x.id === id; }); if(te) taskForm(te); break; }
    case 'task-del': {
      var td = S.tasks.find(function(x){ return x.id === id; }); if(!td) break; closeModal();
      confirmBox('Delete this task?', '“' + td.title + '” will be removed for good.', 'Delete task', function(){ S.tasks = S.tasks.filter(function(x){ return x.id !== id; }); save(); render(); toast('Task deleted.'); }); break; }
    case 'note-next': S.settings.noteIndex = ((S.settings.noteIndex < 0 ? allNotes().indexOf(noteOfTheDay()) : S.settings.noteIndex) + 1) % allNotes().length; save(); render(); break;
    case 'next-start': S.timer.subjectId = id; if(!S.timer.running){ S.timer.mode = 'focus'; S.timer.remainingMs = durMs('focus'); } save(); go('study'); toast('Study Room ready. Press Start when you are.'); break;
    /* planner */
    case 'week-prev': ui.weekStart = iso(addDays(parseISO(ui.weekStart), -7)); ui.selectedDay = iso(addDays(parseISO(ui.selectedDay), -7)); render(); break;
    case 'week-next': ui.weekStart = iso(addDays(parseISO(ui.weekStart), 7)); ui.selectedDay = iso(addDays(parseISO(ui.selectedDay), 7)); render(); break;
    case 'week-today': ui.weekStart = iso(weekStart(new Date())); ui.selectedDay = todayISO(); render(); break;
    case 'day-pick': ui.selectedDay = el.dataset.date; render(); break;
    case 'ss-edit': { var se = S.sessions.find(function(x){ return x.id === id; }); if(se) sessionForm(se); break; }
    case 'ss-del': {
      var sd = S.sessions.find(function(x){ return x.id === id; }); if(!sd) break; closeModal();
      confirmBox('Delete this session?', subjName(sd.subjectId) + ' on ' + fmtDate(sd.date, SHORT) + ' at ' + sd.start + ' will be removed.', 'Delete session', function(){ S.sessions = S.sessions.filter(function(x){ return x.id !== id; }); save(); render(); toast('Session deleted.'); }); break; }
    /* assignments */
    case 'as-edit': { var ae = S.assignments.find(function(x){ return x.id === id; }); if(ae) assignmentForm(ae); break; }
    case 'as-toggle': { var at = S.assignments.find(function(x){ return x.id === id; }); if(at) setStatus(at, at.status === 'Completed' ? 'In Progress' : 'Completed'); break; }
    case 'as-del': {
      var ad = S.assignments.find(function(x){ return x.id === id; }); if(!ad) break; closeModal();
      confirmBox('Delete this assignment?', '“' + ad.title + '” will be removed for good.', 'Delete assignment', function(){ S.assignments = S.assignments.filter(function(x){ return x.id !== id; }); save(); refreshAssignments(); toast('Assignment deleted.'); }); break; }
    case 'clear-filters': ui.filters = {q:'', subject:'all', priority:'all', status:'all', sort:ui.filters.sort}; render(); break;
    /* subjects */
    case 'ch-toggle': { var cs = subj(el.dataset.sid), cc = cs && cs.chapters.find(function(x){ return x.id === id; }); if(cc){ cc.done = !cc.done; syncProgress(cs); save(); render(); } break; }
    case 'ch-edit': { var cs2 = subj(el.dataset.sid), cc2 = cs2 && cs2.chapters.find(function(x){ return x.id === id; }); if(cc2) chapterForm(cs2, cc2); break; }
    case 'ch-del': {
      var cs3 = subj(el.dataset.sid), cc3 = cs3 && cs3.chapters.find(function(x){ return x.id === id; }); if(!cc3) break;
      confirmBox('Delete this chapter?', '“' + cc3.title + '” will be removed from ' + cs3.name + '.', 'Delete chapter', function(){ cs3.chapters = cs3.chapters.filter(function(x){ return x.id !== id; }); syncProgress(cs3); save(); render(); toast('Chapter deleted.'); }); break; }
    case 'subj-edit': { var sb = subj(id); if(sb) subjectForm(sb); break; }
    case 'subj-del': {
      var sj = subj(id); if(!sj) break; closeModal();
      var nA = S.assignments.filter(function(x){ return x.subjectId === id; }).length, nS = S.sessions.filter(function(x){ return x.subjectId === id; }).length;
      confirmBox('Delete ' + sj.name + '?', 'The subject, its notes and its exam date will be removed. ' + (nA + nS ? nA + ' assignment(s) and ' + nS + ' planner session(s) stay in place under "General".' : ''), 'Delete subject', function(){
        S.subjects = S.subjects.filter(function(x){ return x.id !== id; });
        S.assignments.forEach(function(x){ if(x.subjectId === id) x.subjectId = ''; }); S.tasks.forEach(function(x){ if(x.subjectId === id) x.subjectId = ''; });
        S.sessions.forEach(function(x){ if(x.subjectId === id) x.subjectId = ''; }); S.history.forEach(function(x){ if(x.subjectId === id) x.subjectId = ''; });
        if(S.timer.subjectId === id) S.timer.subjectId = ''; save(); render(); toast('Subject deleted.'); }); break; }
    /* study */
    case 't-toggle': if(S.timer.running) timerPause(); else timerStart(); break;
    case 't-reset': timerReset(); break;
    case 't-mode': timerMode(el.dataset.mode); break;
    case 't-finish': timerFinishEarly(); break;
    case 'focus-mode': ui.focusMode = !ui.focusMode; document.body.classList.toggle('focus-mode', ui.focusMode); window.scrollTo(0, 0); break;
    case 'ck-toggle': { var c = S.checklist.find(function(x){ return x.id === id; }); if(c){ c.done = !c.done; save(); render(); } break; }
    case 'ck-del': S.checklist = S.checklist.filter(function(x){ return x.id !== id; }); save(); render(); break;
    case 'ck-clear': S.checklist.forEach(function(x){ x.done = false; }); save(); render(); break;
    case 'hist-clear':
      confirmBox('Clear session history?', 'This removes every logged focus session and may shorten your study streak.', 'Clear history', function(){ S.history = []; save(); render(); toast('History cleared.'); }); break;
  }
});
function setStatus(a, status){
  var was = a.status === 'Completed'; a.status = status;
  if(status === 'Completed' && !was){ a.completedAt = todayISO(); ui.justClosed = a.id; setTimeout(function(){ ui.justClosed = null; }, 2200); toast('Case closed!', 'ok'); }
  else if(status !== 'Completed'){ a.completedAt = ''; }
  save(); refreshAssignments();
}
function refreshAssignments(){
  if(ui.route !== 'assignments'){ render(); return; }
  var r = $('#as-results'); if(r) r.innerHTML = assignmentResults();
  var old = $('.nextdl'); if(old){ var tmp = document.createElement('div'); tmp.innerHTML = nextDeadlineCard(); old.replaceWith(tmp.firstChild); }
}
document.addEventListener('submit', function(e){
  var form = e.target.closest('form[data-form]'); if(!form) return;
  e.preventDefault();
  if(form.dataset.form === 'chapter-add'){
    var sj0 = subj(form.dataset.sid), inp0 = $('input', form), v0 = inp0.value.trim();
    if(!v0){ inp0.focus(); return; }
    sj0.chapters.push({id:uid(), title:v0, note:'', done:false}); syncProgress(sj0); save(); render(); refocus('#chin-' + sj0.id); return;
  }
  if(form.dataset.form === 'todo-quick'){
    var qi = $('#todo-input'), qv = qi.value.trim(); if(!qv){ qi.focus(); return; }
    S.tasks.push({id:uid(), title:qv, description:'', priority:'', subjectId:ui.todoSubject !== 'all' && ui.todoSubject !== 'none' ? ui.todoSubject : '', date:'', done:false, doneAt:''}); save(); render(); refocus('#todo-input'); toast('Task added.', 'ok'); return;
  }
  if(form.dataset.form === 'msg-add'){
    var mi = $('#msg-input'), mv = mi.value.trim(); if(!mv){ mi.focus(); return; }
    S.messages.push({id:uid(), text:mv.slice(0, 200)}); S.settings.noteIndex = allNotes().length - 1; save(); messagesForm(); render(); refocus('#msg-input'); toast('Message added to your rotation.', 'ok'); return;
  }
  if(form.dataset.form === 'ck'){
    var inp = $('#ck-input'), v = inp.value.trim(); if(!v){ inp.focus(); return; }
    S.checklist.push({id:uid(), text:v, done:false}); save(); render(); refocus('#ck-input'); return;
  }
  submitForm(form);
});
document.addEventListener('input', function(e){
  var el = e.target;
  if(el.dataset.filter){ ui.filters[el.dataset.filter] = el.value; $('#as-results').innerHTML = assignmentResults(); return; }
  if(el.dataset.calc){ runCalc(el.dataset.calc); return; }
  if(el.dataset.act === 'subj-progress'){ var s = subj(el.dataset.id); if(s){ s.progress = +el.value; $('#progout-' + s.id).textContent = s.progress + '%'; save(); } return; }
  if(el.id === 'f-color-custom'){ var cr = $('input[name=f-color][value=custom]'); if(cr) cr.checked = true; return; }
  if(el.id === 'set-greeting'){ S.settings.greeting = el.value; save(); return; }
  if(el.id === 'set-accent'){ S.settings.accent = +el.value; $('#set-accent-out').textContent = el.value + '%'; applySettings(); save(); return; }
});
document.addEventListener('change', function(e){
  var el = e.target, act = el.dataset.act;
  if(el.dataset.filter){ ui.filters[el.dataset.filter] = el.value; $('#as-results').innerHTML = assignmentResults(); return; }
  if(el.dataset.calc){ runCalc(el.dataset.calc); return; }
  if(act === 'as-status'){ var a = S.assignments.find(function(x){ return x.id === el.dataset.id; }); if(a) setStatus(a, el.value); return; }
  if(act === 'subj-notes'){ var s = subj(el.dataset.id); if(s){ s.notes = el.value; save(); toast('Notes saved.', 'ok'); } return; }
  if(act === 'todo-subject'){ ui.todoSubject = el.value; $('#todo-list').innerHTML = todoList(); return; }
  if(el.id === 'set-theme'){ S.settings.theme = el.value; save(); applySettings(); return; }
  if(act === 'timer-subject'){ S.timer.subjectId = el.value; save(); return; }
  if(el.id === 'set-texture'){ S.settings.texture = el.checked; applySettings(); save(); return; }
  if(el.id === 'set-sound'){ S.settings.sound = el.checked; save(); if(el.checked){ unlockAudio(); beep(); } return; }
});
document.addEventListener('keydown', function(e){
  if(e.key === 'Escape'){
    if($('#modal-root').firstChild){ closeModal(); return; }
    if(ui.focusMode){ ui.focusMode = false; document.body.classList.remove('focus-mode'); }
    return;
  }
  if(e.key === 'Tab' && $('#modal-root').firstChild){
    var items = $$('button:not([disabled]),input:not([type=hidden]),select,textarea,a[href]', $('.modal')).filter(function(x){ return x.offsetParent !== null || x.type === 'radio'; });
    if(!items.length) return;
    var first = items[0], last = items[items.length - 1];
    if(e.shiftKey && document.activeElement === first){ e.preventDefault(); last.focus(); }
    else if(!e.shiftKey && document.activeElement === last){ e.preventDefault(); first.focus(); }
  }
});
document.addEventListener('visibilitychange', function(){ if(!document.hidden) tick(); });
window.addEventListener('focus', tick);

/* ---------------------------- init ---------------------------- */
(function init(){
  S = load();
  $('#brand-name').textContent = CONFIG.appName; $('#brand-name-m').textContent = CONFIG.appName; $('#brand-sub').textContent = CONFIG.subtitle;
  $('[data-act=open-settings]').innerHTML = ico('sliders', 'sm') + 'Settings';
  $('#tb-settings').innerHTML = ico('sliders');
  $('#fab').innerHTML = ico('plus');
  var h = (location.hash || '').replace('#', ''); if(ROUTES.indexOf(h) >= 0) ui.route = h;
  applySettings(); paintSave(); render();
  try{ window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function(){ if(S.settings.theme === 'system') paintThemeBtn(); }); }catch(e){}
  setInterval(tick, 500);
  if(S.timer.running) tick();
})();
})();
