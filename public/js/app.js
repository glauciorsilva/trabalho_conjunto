import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword,
  sendEmailVerification, sendPasswordResetEmail, updateProfile, signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore, collection, doc, addDoc, setDoc, deleteDoc, onSnapshot, query, orderBy,
  limit, serverTimestamp, writeBatch
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fmt = (ts) => (ts?.toDate ? ts.toDate().toLocaleString("pt-BR") : "agora");
const who = (u) => u.displayName || u.email;
const show = (id) => ["#auth", "#gate", "#app"].forEach((s) => $(s).classList.toggle("hidden", s !== id));

const MODES = { python: "python", javascript: "javascript", html: "htmlmixed", css: "css", sql: "text/x-sql" };
const langOf = (name) => {
  const ext = name.split(".").pop().toLowerCase();
  return { py: "python", js: "javascript", mjs: "javascript", html: "html", htm: "html", css: "css", sql: "sql" }[ext] || "text";
};
const cm = (el, mode) => CodeMirror.fromTextArea(el, { mode: MODES[mode], theme: "material-darker", lineNumbers: true, indentUnit: 4, tabSize: 4 });

let me = null;
const unsubs = [];

/* ================= AUTENTICAÇÃO ================= */
let signupMode = false;
$("#toggleMode").onclick = () => {
  signupMode = !signupMode;
  $("#displayName").classList.toggle("hidden", !signupMode);
  $("#authSubmit").textContent = signupMode ? "Cadastrar" : "Entrar";
  $("#toggleMode").textContent = signupMode ? "Já tenho conta — entrar" : "Não tem conta? Cadastrar";
};
const authErr = (e) => ({
  "auth/invalid-credential": "E-mail ou senha inválidos.",
  "auth/email-already-in-use": "E-mail já cadastrado.",
  "auth/weak-password": "Senha fraca (mín. 6 caracteres).",
  "auth/too-many-requests": "Muitas tentativas. Aguarde um pouco."
}[e.code] || e.message);

$("#authForm").onsubmit = async (ev) => {
  ev.preventDefault();
  const email = $("#email").value.trim(), pwd = $("#password").value;
  $("#authMsg").textContent = "";
  try {
    if (signupMode) {
      const { user } = await createUserWithEmailAndPassword(auth, email, pwd);
      const name = $("#displayName").value.trim();
      if (name) await updateProfile(user, { displayName: name });
      await sendEmailVerification(user);
    } else {
      await signInWithEmailAndPassword(auth, email, pwd);
    }
  } catch (e) { $("#authMsg").textContent = authErr(e); }
};
$("#resetPwd").onclick = async () => {
  const email = $("#email").value.trim();
  if (!email) return ($("#authMsg").textContent = "Digite seu e-mail acima.");
  try { await sendPasswordResetEmail(auth, email); $("#authMsg").textContent = "E-mail de redefinição enviado."; }
  catch (e) { $("#authMsg").textContent = authErr(e); }
};
$$(".logout").forEach((b) => (b.onclick = () => signOut(auth)));
$("#gateResend").onclick = async () => { await sendEmailVerification(auth.currentUser); alert("Enviado!"); };
$("#gateReload").onclick = async () => { await auth.currentUser.reload(); location.reload(); };

function gate(title, text, resend) {
  $("#gateTitle").textContent = title;
  $("#gateText").textContent = text;
  $("#gateResend").classList.toggle("hidden", !resend);
  $("#gateReload").classList.toggle("hidden", !resend);
  show("#gate");
}

onAuthStateChanged(auth, (user) => {
  unsubs.splice(0).forEach((u) => u());
  me = user;
  if (!user) return show("#auth");
  if (!user.emailVerified) return gate("Verifique seu e-mail", `Enviamos um link para ${user.email}. Confirme e clique em recarregar.`, true);
  $("#me").textContent = who(user);
  show("#app");
  startChat();
  startFiles();
});

function denied(e) {
  if (e.code === "permission-denied") gate("Acesso não autorizado", "Sua conta não está na lista de membros. Peça ao administrador para incluir seu e-mail em firestore.rules.", false);
  else console.error(e);
}

/* ================= ABAS ================= */
$$("header nav button").forEach((b) => (b.onclick = () => {
  $$("header nav button").forEach((x) => x.classList.toggle("active", x === b));
  $$(".tab").forEach((t) => t.classList.toggle("hidden", t.id !== "tab-" + b.dataset.tab));
  setTimeout(() => [editor, ...Object.values(sb)].forEach((e) => e.refresh()), 0);
}));
const goTab = (t) => $(`header nav button[data-tab="${t}"]`).click();

/* ================= CHAT ================= */
function startChat() {
  const q = query(collection(db, "messages"), orderBy("createdAt", "desc"), limit(300));
  unsubs.push(onSnapshot(q, (snap) => {
    const box = $("#messages");
    const atBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 60;
    box.innerHTML = snap.docs.reverse().map((d) => {
      const m = d.data(), mine = m.authorUid === me.uid;
      const body = m.lang
        ? `<pre>${esc(m.text)}</pre><div class="actions"><button class="link" data-run="${d.id}">Testar no Sandbox</button></div>`
        : esc(m.text);
      return `<div class="bubble ${mine ? "mine" : ""}"><div class="who">${esc(m.authorName)} · ${fmt(m.createdAt)}${m.lang ? " · " + m.lang : ""}</div>${body}</div>`;
    }).join("");
    const byId = Object.fromEntries(snap.docs.map((d) => [d.id, d.data()]));
    box.querySelectorAll("[data-run]").forEach((b) => (b.onclick = () => openInSandbox(byId[b.dataset.run].lang, byId[b.dataset.run].text)));
    if (atBottom) box.scrollTop = box.scrollHeight;
  }, denied));
}
$("#msgText").addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); $("#chatForm").requestSubmit(); } });
$("#chatForm").onsubmit = async (ev) => {
  ev.preventDefault();
  const text = $("#msgText").value;
  if (!text.trim()) return;
  $("#msgText").value = "";
  await addDoc(collection(db, "messages"), {
    text, lang: $("#msgLang").value, authorUid: me.uid, authorEmail: me.email, authorName: who(me), createdAt: serverTimestamp()
  }).catch(denied);
};

/* ================= ARQUIVOS COMPARTILHADOS ================= */
const editor = cm($("#codeEditor"), "python");
let files = {}, current = null, loadedRev = null, unsubRevs = null;

function startFiles() {
  unsubs.push(onSnapshot(query(collection(db, "files"), orderBy("name")), (snap) => {
    files = Object.fromEntries(snap.docs.map((d) => [d.id, { id: d.id, ...d.data() }]));
    $("#fileList").innerHTML = Object.values(files).map((f) =>
      `<li data-id="${f.id}" class="${f.id === current ? "active" : ""}">${esc(f.name)}<span class="small muted">✎ ${esc(f.lastEditorName)} · ${fmt(f.updatedAt)}</span></li>`
    ).join("");
    $("#fileList").querySelectorAll("li").forEach((li) => (li.onclick = () => openFile(li.dataset.id)));
    if (current && !files[current]) closeFile();
    else if (current) onRemote(files[current]);
  }, denied));
  unsubs.push(() => unsubRevs?.());
}

function onRemote(f) {
  $("#fileMeta").textContent = `última alteração: ${f.lastEditorName} · ${fmt(f.updatedAt)}`;
  if (f.revision !== loadedRev && f.lastEditorUid !== me.uid) {
    $("#remoteWarn span").textContent = f.lastEditorName;
    $("#remoteWarn").classList.remove("hidden");
  } else if (f.lastEditorUid === me.uid) loadedRev = f.revision;
}
$("#loadRemote").onclick = () => openFile(current);

function openFile(id) {
  const f = files[id];
  current = id; loadedRev = f.revision;
  $("#remoteWarn").classList.add("hidden");
  $("#fileTitle").textContent = f.name;
  editor.setOption("mode", MODES[f.lang] || null);
  editor.setValue(f.content || "");
  ["#saveFile", "#toSandbox", "#deleteFile"].forEach((s) => ($(s).disabled = false));
  $$("#fileList li").forEach((li) => li.classList.toggle("active", li.dataset.id === id));
  unsubRevs?.();
  unsubRevs = onSnapshot(query(collection(db, "files", id, "revisions"), orderBy("createdAt", "desc"), limit(100)), (snap) => {
    const revs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    $("#revList").innerHTML = revs.map((r, i) =>
      `<li data-i="${i}"><b>${esc(r.authorName)}</b><span class="small muted">${fmt(r.createdAt)}</span>${r.message ? `<span class="small">${esc(r.message)}</span>` : ""}<span class="small muted">${diffStat(revs[i + 1]?.content ?? "", r.content)}</span></li>`
    ).join("");
    $("#revList").querySelectorAll("li").forEach((li) => (li.onclick = () => {
      const r = revs[li.dataset.i];
      if (confirm(`Carregar versão de ${r.authorName} (${fmt(r.createdAt)}) no editor?\nSalve depois para restaurá-la.`)) {
        editor.setValue(r.content); $("#commitMsg").value = `Restaura versão de ${r.authorName}`;
      }
    }));
  }, denied);
}

function closeFile() {
  current = null; unsubRevs?.(); unsubRevs = null;
  editor.setValue(""); $("#fileTitle").textContent = "Selecione ou crie um arquivo";
  $("#fileMeta").textContent = ""; $("#revList").innerHTML = "";
  ["#saveFile", "#toSandbox", "#deleteFile"].forEach((s) => ($(s).disabled = true));
}

function diffStat(a, b) {
  const A = new Set(a.split("\n")), B = new Set(b.split("\n"));
  const add = b.split("\n").filter((l) => !A.has(l)).length, del = a.split("\n").filter((l) => !B.has(l)).length;
  return `+${add} −${del} linhas`;
}

async function saveRevision(fileId, name, content, message) {
  const revRef = doc(collection(db, "files", fileId, "revisions"));
  const batch = writeBatch(db);
  batch.set(revRef, { content, message, authorUid: me.uid, authorEmail: me.email, authorName: who(me), createdAt: serverTimestamp() });
  batch.set(doc(db, "files", fileId), {
    name, lang: langOf(name), content, revision: revRef.id,
    lastEditorUid: me.uid, lastEditorName: who(me), updatedAt: serverTimestamp()
  }, { merge: true });
  await batch.commit();
  return revRef.id;
}

$("#newFileBtn").onclick = async () => {
  const name = $("#newFileName").value.trim();
  if (!name) return;
  if (Object.values(files).some((f) => f.name === name)) return alert("Já existe um arquivo com esse nome.");
  const ref = doc(collection(db, "files"));
  await saveRevision(ref.id, name, "", "Arquivo criado").catch(denied);
  $("#newFileName").value = "";
  setTimeout(() => files[ref.id] && openFile(ref.id), 300);
};
$("#saveFile").onclick = async () => {
  if (!current) return;
  const f = files[current];
  if (f.revision !== loadedRev && f.lastEditorUid !== me.uid &&
      !confirm(`${f.lastEditorName} salvou uma versão mais nova. Sobrescrever mesmo assim? (A versão dele continua no histórico.)`)) return;
  loadedRev = await saveRevision(current, f.name, editor.getValue(), $("#commitMsg").value.trim()).catch(denied);
  $("#commitMsg").value = "";
  $("#remoteWarn").classList.add("hidden");
};
$("#deleteFile").onclick = async () => {
  if (current && confirm(`Excluir "${files[current].name}"?`)) await deleteDoc(doc(db, "files", current)).catch(denied);
};
$("#toSandbox").onclick = () => current && openInSandbox(files[current].lang, editor.getValue());
document.addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === "s" && !$("#tab-code").classList.contains("hidden")) { e.preventDefault(); $("#saveFile").click(); }
});

/* ================= SANDBOX ================= */
const sb = {};
["html", "css", "javascript", "python", "sql"].forEach((l) => (sb[l] = cm($("#sb-" + l), l)));
sb.html.setValue("<h1>Olá!</h1>\n<button id=\"b\">Clique</button>");
sb.css.setValue("body { font-family: sans-serif; }\nh1 { color: #4f8cff; }");
sb.javascript.setValue("document.getElementById('b')?.addEventListener('click', () => alert('Funcionou!'));\nconsole.log('JS rodando');");
sb.python.setValue("def fib(n):\n    a, b = 0, 1\n    for _ in range(n):\n        a, b = b, a + b\n    return a\n\nprint([fib(i) for i in range(10)])");
sb.sql.setValue("CREATE TABLE usuarios (id INTEGER PRIMARY KEY, nome TEXT);\nINSERT INTO usuarios (nome) VALUES ('Ana'), ('Beto');\nSELECT * FROM usuarios;");

const out = $("#sbConsole"), status = (t) => ($("#sbStatus").textContent = t);
const log = (t, cls = "") => { out.insertAdjacentHTML("beforeend", `<div class="${cls}">${esc(t)}</div>`); out.scrollTop = out.scrollHeight; };

function setMode(mode) {
  $("#sbMode").value = mode;
  const visible = mode === "web" ? ["html", "css", "javascript"] : [mode];
  $$("#sbEditors .pane").forEach((p) => p.classList.toggle("hidden", !visible.includes(p.dataset.lang)));
  $("#sbFrame").classList.toggle("hidden", mode !== "web");
  setTimeout(() => Object.values(sb).forEach((e) => e.refresh()), 0);
}
$("#sbMode").onchange = () => setMode($("#sbMode").value);
$("#sbClear").onclick = () => (out.innerHTML = "");

function openInSandbox(lang, code) {
  const mode = { html: "web", css: "web", javascript: "javascript", python: "python", sql: "sql" }[lang] || "javascript";
  if (sb[lang]) sb[lang].setValue(code);
  setMode(mode); goTab("sandbox");
}

// Console do iframe -> painel
window.addEventListener("message", (e) => {
  if (e.source !== $("#sbFrame").contentWindow || !e.data?.__sb) return;
  log(e.data.text, e.data.level === "error" ? "err" : "");
});
const bridge = `<script>(()=>{const s=(level,a)=>parent.postMessage({__sb:1,level,text:a.map(x=>{try{return typeof x==='object'?JSON.stringify(x):String(x)}catch{return String(x)}}).join(' ')},'*');
['log','info','warn','error'].forEach(k=>{const o=console[k];console[k]=(...a)=>{s(k,a);o.apply(console,a)}});
addEventListener('error',e=>s('error',[e.message+' (linha '+e.lineno+')']));
addEventListener('unhandledrejection',e=>s('error',[String(e.reason)]));})();<\/script>`;

function runWeb(jsOnly) {
  const html = jsOnly ? "" : sb.html.getValue(), css = jsOnly ? "" : sb.css.getValue();
  const js = sb.javascript.getValue().replace(/<\/script/gi, "<\\/script");
  $("#sbFrame").srcdoc = `<!doctype html><html><head><meta charset="utf-8">${bridge}<style>${css}</style></head><body>${html}<script>${js}<\/script></body></html>`;
}

let pyodide = null;
async function runPython() {
  if (!pyodide) {
    status("Carregando Python (primeira vez ~10s)…");
    const { loadPyodide } = await import("https://cdn.jsdelivr.net/pyodide/v0.26.2/full/pyodide.mjs");
    pyodide = await loadPyodide();
  }
  status("Executando…");
  pyodide.setStdout({ batched: (t) => log(t) });
  pyodide.setStderr({ batched: (t) => log(t, "err") });
  pyodide.globals.set("input", (p = "") => prompt(p) ?? "");
  try {
    const code = sb.python.getValue();
    await pyodide.loadPackagesFromImports(code);
    const r = await pyodide.runPythonAsync(code);
    if (r !== undefined) log(String(r));
  } catch (e) { log(String(e.message || e), "err"); }
  status("");
}

let SQL = null;
async function runSQL() {
  if (!SQL) {
    status("Carregando SQLite…");
    await new Promise((ok, err) => { const s = document.createElement("script"); s.src = "https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.3/sql-wasm.js"; s.onload = ok; s.onerror = err; document.head.appendChild(s); });
    SQL = await initSqlJs({ locateFile: (f) => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.3/${f}` });
  }
  const dbx = new SQL.Database(); // banco novo a cada execução
  try {
    const results = dbx.exec(sb.sql.getValue());
    if (!results.length) log("✔ Executado (sem resultados).");
    results.forEach(({ columns, values }) => out.insertAdjacentHTML("beforeend",
      `<table><tr>${columns.map((c) => `<th>${esc(c)}</th>`).join("")}</tr>${values.map((r) => `<tr>${r.map((v) => `<td>${esc(v)}</td>`).join("")}</tr>`).join("")}</table>`));
  } catch (e) { log(e.message, "err"); }
  dbx.close(); status("");
}

async function run() {
  const mode = $("#sbMode").value;
  log(`— ${new Date().toLocaleTimeString("pt-BR")} · ${mode} —`, "muted");
  try {
    if (mode === "web") runWeb(false);
    else if (mode === "javascript") runWeb(true);
    else if (mode === "python") await runPython();
    else if (mode === "sql") await runSQL();
  } catch (e) { log(String(e), "err"); status(""); }
}
$("#sbRun").onclick = run;
document.addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === "Enter" && !$("#tab-sandbox").classList.contains("hidden")) { e.preventDefault(); run(); }
});
setMode("web");
