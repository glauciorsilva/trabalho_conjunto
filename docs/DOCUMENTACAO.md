# Trabalho Conjunto — Documentação

**Endereço:** https://trabconjunto.vercel.app
**Repositório:** github.com/glauciorsilva/trabalho_conjunto (branch `ccr-5faed569-k61rut`)

## 1. Motivo do projeto

Programar junto com um amigo que está distante exige alternar entre várias ferramentas: um app de mensagens para conversar, outro lugar para trocar código e um ambiente local para testar. Isso espalha o histórico, gera dúvidas sobre "qual é a versão certa" e sobre "quem mudou o quê".

O Trabalho Conjunto reúne tudo em um só lugar, acessível do computador e do celular, com acesso restrito às duas pessoas do projeto.

## 2. Finalidade

- **Conversar** em tempo real (chat), inclusive enviando trechos de código.
- **Compartilhar código** em arquivos comuns, onde **toda alteração fica registrada com autor, data, descrição e linhas alteradas**.
- **Testar código** num Sandbox no próprio navegador: HTML/CSS/JavaScript, Python e SQL.
- **Segurança:** login com e-mail e senha; somente as 2 primeiras contas cadastradas (e com e-mail confirmado) viram membros. Depois disso o acesso fecha.
- **Uso no celular:** interface responsiva e instalável na tela inicial (ícone 🤝).

## 3. Como funciona

| Parte | Tecnologia |
|---|---|
| Site (hospedagem) | Vercel — pasta `public/` |
| Login | Firebase Authentication (e-mail/senha) |
| Banco de dados | Firebase Firestore |
| Editor de código | CodeMirror 5 |
| Python no navegador | Pyodide |
| SQL no navegador | sql.js (SQLite) |

**Abas do app**
- **💬 Chat** — mensagens de texto ou código (com botão "Testar no Sandbox").
- **📁 Códigos** — lista de arquivos, editor, "Salvar versão" (Ctrl+S) e histórico com restauração. Aviso quando o outro membro salvou uma versão nova.
- **🧪 Sandbox** — modos Web, Python, SQL e JavaScript. Ctrl+Enter executa.

**Dados no Firestore**
- `members/{uid}` — membros do ambiente
- `config/members` — contador de vagas (limite em `maxMembers()` no `firestore.rules`)
- `messages/{id}` — mensagens do chat (não podem ser editadas/apagadas)
- `files/{id}` — arquivo atual + último editor
- `files/{id}/revisions/{rev}` — cada versão salva, com autor (imutável)

**Arquivos principais**
- `public/index.html`, `public/styles.css`, `public/js/app.js`
- `public/js/firebase-config.js` — configuração do projeto Firebase `trabconjunto`
- `firestore.rules` — regras de segurança do banco
- `public/manifest.webmanifest` e `public/icons/` — instalação no celular

## 4. Configuração inicial (uma vez)

1. Console Firebase → Authentication → Método de login → ativar **E-mail/senha**.
2. Authentication → Configurações → **Domínios autorizados** → adicionar `trabconjunto.vercel.app`.
3. **Firestore Database** → criar banco (modo produção).
4. Firestore → **Regras** → colar o conteúdo de `firestore.rules` → **Publicar**.
5. Os dois membros acessam o site, digitam e-mail + senha (a conta é criada no primeiro acesso), confirmam o e-mail e clicam em "Já verifiquei — recarregar".
6. (Opcional) Desativar a criação de novas contas no Firebase Auth depois que os dois entrarem.

## 5. Possíveis erros e correções

| Sintoma | Causa provável | Correção |
|---|---|---|
| Ao entrar aparece `auth/unauthorized-domain` ou o login não acontece | Domínio da Vercel não autorizado no Firebase | Authentication → Configurações → Domínios autorizados → adicionar `trabconjunto.vercel.app` |
| `auth/operation-not-allowed` | Login por e-mail/senha desativado | Authentication → Método de login → ativar E-mail/senha |
| "Senha incorreta" mesmo sendo a primeira vez | O e-mail já foi cadastrado antes | Use "Esqueci a senha" para redefinir |
| Fica parado na tela "Verifique seu e-mail" | E-mail de confirmação não foi clicado (ou caiu no spam) | Verificar spam, clicar em "Reenviar verificação", confirmar e "recarregar" |
| "Acesso fechado" | As 2 vagas já foram ocupadas | Normal para terceiros. Para liberar mais vagas, aumentar `maxMembers()` em `firestore.rules` e publicar as regras |
| "Acesso não autorizado" / `permission-denied` | Regras não publicadas, ou banco não criado | Criar o Firestore e publicar `firestore.rules` no Console |
| Membro errado ocupou uma vaga | Alguém se cadastrou antes | Console → Firestore: apagar `members/{uid}` da pessoa e diminuir `count` em `config/members`; apagar a conta em Authentication |
| Chat/arquivos não aparecem e o console mostra erro de índice | Consulta precisa de índice | Clicar no link do erro no console do navegador para criar o índice |
| Tela em branco após deploy | Erro de JavaScript ou `firebase-config.js` inválido | Abrir o console do navegador (F12) e ver o erro; conferir a configuração |
| Python demora na primeira execução | Pyodide (~10 MB) é baixado na 1ª vez | Normal; as próximas execuções são rápidas |
| `ModuleNotFoundError` no Python | Pacote não disponível no Pyodide | Usar pacotes suportados pelo Pyodide (numpy, pandas etc.) |
| Tabela SQL "sumiu" | O banco SQLite do Sandbox é recriado a cada execução | Incluir o `CREATE TABLE`/`INSERT` no mesmo script |
| Código Web não roda / `alert` não aparece | Erro no JS (veja o painel de console do Sandbox) | Corrigir conforme a mensagem mostrada |
| Aviso "X salvou uma nova versão" | O outro membro salvou enquanto você editava | Clicar em "Carregar" ou salvar por cima (a versão dele fica no histórico) |
| Link da Vercel pede login | Proteção de deploy ativa | Vercel → projeto → Settings → Deployment Protection → desativar |
| Site não atualizou após mudança | Deploy não executado ou cache | Ver o deploy no painel da Vercel; recarregar a página (no app instalado, fechar e abrir) |
| Ícone não aparece ao instalar | Cache do navegador | Remover o atalho, limpar cache e instalar de novo |

## 6. Próximos passos sugeridos

- Criar o branch principal (`main`) e ligar o deploy automático da Vercel a ele.
- Notificações de nova mensagem.
- Comparação visual (diff) entre versões.
