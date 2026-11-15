# Trabalho Conjunto

Ambiente colaborativo para programar a dois, à distância: **chat**, **códigos compartilhados com histórico por autor** e **sandbox** (HTML/CSS/JS, Python, SQL). Hospedagem, banco e login: **Firebase**.

## Funcionalidades
- **Login com e-mail e senha** (Firebase Auth), com verificação de e-mail e recuperação de senha.
- **Lista de membros**: só os e-mails listados em `firestore.rules` acessam os dados — mesmo que alguém crie conta, não lê nada.
- **💬 Chat** em tempo real. Mensagens podem ser marcadas como código (Python/JS/HTML/CSS/SQL) e abertas direto no Sandbox.
- **📁 Códigos**: arquivos compartilhados. Cada "Salvar versão" (ou Ctrl+S) grava uma revisão imutável com **autor, data, descrição e +/− linhas**. Dá para ver e restaurar qualquer versão. Aviso quando o outro salvou algo enquanto você editava.
- **🧪 Sandbox** (roda no navegador, isolado em iframe):
  - Web: HTML + CSS + JS com console capturado
  - Python via Pyodide (suporta `print`, `input`, pacotes como numpy)
  - SQL via SQLite (sql.js) — banco novo a cada execução
  - JavaScript puro com console
  - Ctrl+Enter executa

## Configuração
1. Crie o projeto no [Console Firebase](https://console.firebase.google.com).
2. **Authentication** → Método de login → ative **E-mail/senha**.
3. **Firestore Database** → criar banco (modo produção).
4. Configurações do projeto → adicionar **app Web** → copie o objeto de config para `public/js/firebase-config.js`.
5. Troque `SEU-PROJECT-ID` em `.firebaserc`.
6. Em `firestore.rules`, coloque **os e-mails de vocês dois** na lista de `isMember()`.
7. Deploy:
   ```bash
   npm install -g firebase-tools
   firebase login
   firebase deploy        # hosting + regras do Firestore
   ```
8. Cada um acessa a URL, clica em **Cadastrar**, confirma o e-mail e entra.

Teste local: `firebase serve` (ou `firebase emulators:start`).

> Dica extra de segurança: depois que os dois criarem as contas, em Authentication → Configurações → *Ações do usuário*, desmarque "Permitir criação de contas" para bloquear novos cadastros.

## Estrutura
```
firebase.json / .firebaserc / firestore.rules / firestore.indexes.json
public/index.html   – interface (3 abas)
public/styles.css
public/js/app.js    – auth, chat, arquivos/revisões, sandbox
public/js/firebase-config.js – sua config
```

## Modelo de dados (Firestore)
- `messages/{id}`: `text, lang, authorUid, authorEmail, authorName, createdAt`
- `files/{id}`: `name, lang, content, revision, lastEditorUid, lastEditorName, updatedAt`
- `files/{id}/revisions/{rev}`: `content, message, authorUid, authorEmail, authorName, createdAt` (imutável)
