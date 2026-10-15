# Página da Black IBPROF + Stafy: guia para quem vai desenvolver

Este guia explica como a página da Black (`https://spectusmkt.github.io/black-ibprof/`) se liga ao
**Stafy**, o que já está pronto e o que falta fazer. São três tarefas:

1. ligar o **Lead na Meta** (API de Conversões);
2. criar o **pipeline do CRM** para estes leads;
3. conferir tudo com um cadastro de verdade.

O detalhe técnico completo (cada campo, cada resposta, os campos ocultos) está em
[`COMO-INTEGRAR-COM-O-STAFY.md`](COMO-INTEGRAR-COM-O-STAFY.md), nesta mesma pasta. Este aqui é o
caminho curto.

---

## 1. Como funciona hoje (já está no ar)

```
A pessoa abre a página (com ?utm_source=…&fbclid=…)
   │  o porteiro.js do Stafy, no <head>, guarda a origem dela (UTMs, fbclid, cookies _fbp/_fbc)
   ▼
Preenche nome, e-mail e WhatsApp e clica em enviar
   │  a página valida e gera um ID DO LEAD (StafyFormulario.novoIdDoLead())
   ├──► Pixel da página:  fbq('track', 'Lead', {}, { eventID: <ID DO LEAD> })
   └──► Stafy:  POST https://www.stafy.app/api/forms/black-ibprof-grupo-vip/submit?negocio=ibprof
                corpo: name, email, phone, UTMs, stafy_params, stafy_origem, stafy_evento_id = <ID DO LEAD>
                   │
                   ▼  o Stafy:
                   · cria ou acha o contato (sem duplicar: telefone → e-mail)
                   · grava as UTMs, o clique do anúncio, a página, a cidade (Cloudflare) e o aparelho
                   · (se ligado) cria o card no pipeline do CRM
                   · (se ligado) manda o Lead pela API de Conversões com o MESMO <ID DO LEAD>
                   · responde { ok: true, evento_id }
   ▼
A pessoa vai para obrigado.html (com as mesmas UTMs)
```

**Por que o mesmo ID nos dois lados?** O Pixel (navegador) e o Stafy (servidor) mandam o mesmo Lead. Com
o mesmo `eventID`, a Meta junta os dois e conta **um** Lead. O servidor garante que o Lead chegue mesmo
quando o navegador bloqueia o Pixel (bloqueador de anúncio, Safari, iPhone).

**O que já foi conferido (15/10/2026):**
- a página publicada manda nome, e-mail, WhatsApp, as UTMs, o `fbclid` e o ID do Lead;
- o Pixel dispara o Lead com o mesmo ID;
- a pessoa vai para o obrigado com as UTMs, no computador e no celular, sem erro;
- o Stafy de produção acha o formulário e aceita pedidos vindos da página.

O teste interceptou o envio no navegador, então nenhum cadastro de verdade foi feito.

**Arquivos da página:**

| Arquivo | O que faz |
| --- | --- |
| `index.html` | o `porteiro.js` no `<head>`, o Pixel, o `CONFIG.stafy` e o envio dos dois formulários (o do topo e o do fim) |
| `integracoes/stafy-formulario.js` | o envio para o Stafy e o `novoIdDoLead()`; serve para qualquer outra página |
| `integracoes/teste/servidor-de-teste.mjs` | um Stafy de mentira para testar na sua máquina |
| `obrigado.html` | a página de obrigado |

O `CONFIG` no `index.html`:

```js
stafy: {
  endereco: 'https://www.stafy.app/api/forms/black-ibprof-grupo-vip/submit?negocio=ibprof',
  usarDestinoDoStafy: false, // true = depois do envio vai para o destino configurado no Stafy (ex.: checkout da Hotmart)
  prazoMs: 8000              // quanto esperar o Stafy; passou disso, segue para o obrigado e o envio termina em segundo plano
},
paginaObrigado: 'obrigado.html'
```

> ⚠️ O formulário do Stafy tem hoje um **destino para o checkout da Hotmart** configurado (passo "Para
> onde vai depois"). A página **não usa** esse destino (`usarDestinoDoStafy: false`) e manda a pessoa para
> o `obrigado.html`. Se a ideia for ir direto ao checkout, troque para `true`.

---

## 2. Tarefa 1: ligar o Lead na Meta

**Onde:** Stafy, negócio **IBPROF** (escolha no seletor do topo) → **Contatos › Formulários** →
**Black IBPROF — Grupo VIP** → passo **"O que acontece ao receber"** → seção **"Lead na Meta (API de
Conversões)"**.

O que precisa:

| Item | Valor | Situação hoje |
| --- | --- | --- |
| Interruptor "Lead na Meta" | ligado | ❌ **desligado** (foi desligado numa edição em 15/10, 10:05) |
| Pixel | `1456216939376794` (o mesmo do `fbq('init', …)` da página) | ✅ escolhido |
| Evento | `Lead` | ✅ |
| Token | um token **com acesso a esse pixel** | ⚠️ está escolhido o token da conexão "BM IBPROF"; ninguém confirmou se ele tem acesso a este pixel |

### O token: o único ponto de atenção

A Meta só aceita o Lead pelo servidor se o token tiver permissão no pixel. O pixel desta página não
aparece nas contas de anúncio que o Stafy enxerga pela conexão "BM IBPROF", então pode ser de outra BM.

**O caminho seguro** é gerar um token próprio do pixel:

1. No **Gerenciador de Eventos** da Meta, abra o pixel **1456216939376794** → **Configurações**.
2. Em **API de Conversões**, clique em **Gerar token de acesso** e copie o token.
3. No Stafy, na seção "Lead na Meta" do formulário, escolha **colar um token** e cole. O Stafy guarda o
   token cifrado; ninguém vê o token depois.
4. Ligue o interruptor. A tela deve dizer: *"Pronto: a cada envio, o evento **Lead** sai também pelo
   servidor."*

Se preferir manter o token da "BM IBPROF", basta ligar o interruptor. Se o token não tiver acesso, o
Pixel continua funcionando, mas o Lead pelo servidor é recusado. O Stafy registra isso no log do servidor
(`[lead-do-formulario] … a Meta não aceitou`), e quem administra o Stafy consegue ver.

### Na página, nada muda

A página já manda o `stafy_evento_id` e já dispara o `fbq` com o mesmo `eventID`. Se você criar **outra**
página ou outro formulário, siga o mesmo padrão:

```js
const id = StafyFormulario.novoIdDoLead();
fbq('track', 'Lead', {}, { eventID: id });
await StafyFormulario.enviar({
  endereco: 'https://www.stafy.app/api/forms/<formulario>/submit?negocio=<negocio>',
  campos: { name, email, phone },
  idDoEvento: id,
});
```

### Como conferir que o Lead chegou

No **Gerenciador de Eventos** → pixel `1456216939376794` → **Visão geral** → evento **Lead**: ele deve
aparecer com as duas fontes, **Navegador** e **Servidor**, e com a desduplicação funcionando (um Lead por
cadastro). Pode levar alguns minutos.

---

## 3. Tarefa 2: criar o pipeline do CRM

Hoje o cadastro vira **contato** no Stafy, mas **não vira card** no CRM, porque nenhum funil está
vinculado ao formulário. Há dois jeitos de resolver.

### Jeito A: criar pelo próprio formulário (o mais rápido)

No formulário → passo **"O que acontece ao receber"** → seção **"Funil do CRM"**:

1. Ligue **"Criar card no CRM"**.
2. Clique em **"Criar um funil para este formulário"**, dê um nome (ex.: `Black IBPROF — Grupo VIP`) e
   clique em **"Criar e vincular"**.
3. Em **"Etapa de entrada"**, escolha onde o card nasce (o padrão é a primeira etapa).

### Jeito B: criar o pipeline no CRM e vincular depois

1. No Stafy: **Comercial › CRM** → **"Novo pipeline"**. Ele nasce com 6 etapas: *Novo lead → Qualificado
   → Proposta → Negociação → Ganho/Perdido*. Renomeie e crie etapas como fizer sentido. Para um grupo
   VIP, por exemplo: *Cadastrou → Entrou no grupo → Comprou → Perdido*.
2. Volte ao formulário → **"Funil do CRM"** → ligue **"Criar card no CRM"**, escolha o **Funil** e a
   **Etapa de entrada**.

**Bom saber:**
- Ligar o card também liga a **"entrada por formulário"** naquele funil. O Stafy avisa isso na tela.
- A mudança vale **em até 1 minuto**. Se testar na hora, o primeiro lead pode entrar sem card.
- Para separar estes leads dos outros, ponha uma **tag automática** no mesmo passo (ex.:
  `black-ibprof-grupo-vip`). A tag também liga as automações por tag.

**Também no passo "O que acontece ao receber"** (opcionais):

| Seção | Para que serve |
| --- | --- |
| **WhatsApp ao receber** | manda uma mensagem (modelo aprovado) para o WhatsApp do lead assim que ele se cadastra, por uma conexão do negócio |
| **Mandar para o meu endereço** | um webhook: o Stafy faz um `POST` (https) com o cadastro e os campos ocultos para outro sistema |

---

## 4. Tarefa 3: conferir com um cadastro de verdade

1. Abra a página publicada com parâmetros de teste:
   `https://spectusmkt.github.io/black-ibprof/?utm_source=teste&utm_campaign=teste-integracao&fbclid=teste123`
2. Cadastre-se com **os seus dados**. Isso cria um contato de verdade no Stafy e, com o Lead ligado,
   manda um Lead de verdade para a Meta.
3. No Stafy (**Contatos**), abra o contato:
   - **Linha do tempo**: o cartão "Formulário enviado · Black IBPROF — Grupo VIP", com as respostas e os
     campos ocultos (UTMs, `fbclid`, página, cidade, aparelho);
   - **Dados do contato** → **"Formulários enviados"**: o mesmo envio;
   - se o pipeline estiver ligado, o card na etapa de entrada.
4. No Gerenciador de Eventos, o Lead com as duas fontes (item 2).
5. No console do navegador da página, **não** deve aparecer aviso `[Stafy]`.

**Para testar na sua máquina sem tocar no Stafy:** `node integracoes/teste/servidor-de-teste.mjs` e abra
`http://localhost:5500/?utm_source=facebook&fbclid=IwAR_teste`. O terminal mostra o corpo exato que o
Stafy receberia; nada sai da máquina. Veja o item 4.1 do guia técnico para os modos de erro.

---

## 5. Respostas do Stafy que a página trata

| Resposta | O que a pessoa vê |
| --- | --- |
| **200** `{ ok: true, evento_id }` | vai para o obrigado |
| **422** `phone_invalid` | "Confira o seu WhatsApp com DDD…" (o botão volta para ela corrigir) |
| **422** `email_required` | "Digite um e-mail válido." |
| **429** | "Muitas tentativas seguidas. Espere um minuto…" (limite por IP) |
| **404**, **500**, sem rede ou demora | segue para o obrigado mesmo assim; o envio continua em segundo plano (`keepalive`) e o console mostra `[Stafy] o cadastro não chegou…` |

⚠️ Não há mais planilha de reserva: se o Stafy estiver fora do ar na hora (raro), aquele cadastro não
fica guardado em outro lugar.

---

## 6. E o MCP?

**A página não usa MCP, e não precisa.** Página fala com o Stafy pelo endereço do formulário (o `POST`
acima), e isso já está funcionando.

O **MCP** é a porta do Stafy para **uma IA** (Claude, ChatGPT ou um agente) trabalhar no Stafy por
conversa: listar os formulários, ler os campos, montar o link com UTMs e cadastrar um lead
(`enviar_cadastro`, que dispara as mesmas automações). Serve, por exemplo, para uma IA cadastrar leads
que chegaram por outro canal, ou para quem desenvolve consultar o formulário pela IA.

Para ligar (no formulário → passo **"Onde publicar"** → **"Ligar por MCP"**):
1. o dono do negócio liga as **Conexões de IA** (Configurações do negócio);
2. no Claude: **Configurações › Conectores › Adicionar conector personalizado** → endereço
   `https://www.stafy.app/api/mcp`; ao entrar, marque o negócio IBPROF e deixe marcado **"Enviar cadastros
   aos formulários"**;
3. as ferramentas: `formularios`, `campos_do_formulario`, `link_do_formulario`, `enviar_cadastro`.

O Lead na Meta **não** sai por esse caminho, porque o servidor da IA não é o navegador de ninguém.

---

## 7. Lista de conferência

- [ ] Lead na Meta **ligado** no formulário, com um token que tenha acesso ao pixel `1456216939376794`
- [ ] Pipeline do CRM criado e vinculado (**"Criar card no CRM"** + funil + etapa de entrada)
- [ ] (opcional) tag automática `black-ibprof-grupo-vip`
- [ ] (opcional) WhatsApp ao receber, se for mandar o link do grupo pelo WhatsApp
- [ ] Decidido: depois do cadastro, `obrigado.html` (hoje) ou o checkout da Hotmart (`usarDestinoDoStafy: true`)
- [ ] Um cadastro de verdade feito e conferido no Stafy (contato, origem, card) e na Meta (Lead com Navegador + Servidor)

**Dados de referência:**

| | |
| --- | --- |
| Negócio no Stafy | IBPROF (`ibprof`) |
| Formulário | Black IBPROF — Grupo VIP (`black-ibprof-grupo-vip`) |
| Endereço do formulário | `https://www.stafy.app/api/forms/black-ibprof-grupo-vip/submit?negocio=ibprof` |
| Pixel | `1456216939376794` |
| Script do porteiro | `<script src="https://www.stafy.app/p/porteiro.js" async></script>` (já no `<head>`) |
| Página publicada | `https://spectusmkt.github.io/black-ibprof/` (GitHub Pages, branch `main`) |
