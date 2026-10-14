# Formulário da página → formulário do Stafy

O formulário da página continua sendo o da página: o mesmo visual, a mesma validação e o mesmo botão.
Quando a pessoa envia, os dados vão para um **formulário do Stafy**, junto com **toda a origem dela**:
UTMs, `fbclid`, `gclid`, os cookies `_fbp` e `_fbc` da Meta, a página, o referenciador e o clique do
porteiro. Depois ela segue para a página de obrigado (`obrigado.html`, configurável).

```
pessoa preenche ──► index.html valida ──► integracoes/stafy-formulario.js ──► POST no Stafy
                                         (junta a origem do porteiro.js)      /api/forms/<formulario>/submit?negocio=<negocio>
                                                                                   │
                         obrigado.html?<as mesmas UTMs>  ◄── resposta ok ──────────┘
```

A planilha do Google (`CONFIG.webhook`) continua recebendo uma cópia. Ela serve de reserva: se o
Stafy estiver fora do ar, o cadastro fica na planilha. Para desligar, deixe `webhook: ''`.

---

## 1. No Stafy: o que configurar (uma vez)

### 1.1 Criar o formulário

1. No seletor do cabeçalho, escolha o negócio do **IBPROF**.
2. Abra **Formulários** do negócio (`stafy.app/negocios/<negocio>/formularios`) e clique em **Novo formulário**.
3. Dê o nome **Black IBPROF — Grupo VIP**. O Stafy monta o endereço a partir do nome e põe 4 números no
   fim, por exemplo `black-ibprof-grupo-vip-4821`.

O editor tem cinco passos:

| Passo | O que fazer |
| --- | --- |
| **1 · O que a pessoa preenche** | Deixe os **3 campos padrão**. Não precisa criar campo nenhum (a tabela abaixo diz por quê). Recomendado: marque **WhatsApp** como obrigatório. |
| **2 · Para onde vai depois** | Deixe **em branco**: quem manda a pessoa para o obrigado é a página. Se um dia quiser que o Stafy decida o destino, ver o item 2.3. |
| **3 · O que acontece ao receber** | **Lista** (ex.: "Black IBPROF — Grupo VIP") e **Tags automáticas** (ex.: `black-ibprof, grupo-vip`). Opcionais: o funil do CRM, o WhatsApp ao receber (conexão + template) e o seu webhook. O formulário já nasce com o link do porteiro. |
| **4 · Onde publicar** | Em **"Já tenho um formulário na minha página"**, clique em **Copiar o endereço de integração**. Esse endereço vai para a página (item 2.1). ⚠️ **Não** use o "Código para colar no seu site": ele coloca o formulário do Stafy no lugar do formulário da página. |
| **5 · Conferir** | Confira se o formulário está **Ativo (aceita envios)**. Se estiver pausado, o Stafy responde "não achei" e a página segue sem gravar. |

**Os campos: a página manda, o Stafy recebe**

| Campo na página (`name` do HTML) | O que a página envia | Chave no Stafy | Tipo no Stafy | O que vira no Stafy |
| --- | --- | --- | --- | --- |
| `nome` | `name` | `name` | Texto | o nome do contato |
| `email` | `email` | `email` | E-mail | o e-mail do contato |
| `whatsapp` | `phone` (com 55 na frente: `5545999990000`) | `phone` | Telefone | o WhatsApp do contato, o card do CRM e quem recebe o disparo |

- **Não crie campo para UTM, `fbclid`, `gclid`, `_fbp` nem `_fbc`.** Esses dados não são campos: eles
  viajam por conta própria (item 2.2) e o Stafy os grava na origem do contato.
- O Stafy aceita o cadastro que tiver **e-mail OU WhatsApp**. Telefone repetido, como `(11) 11111-1111`,
  é recusado.
- Se um dia a página ganhar um campo novo (ex.: "Você já é professor?"), crie no passo 1 um campo com a
  **chave igual ao `name` do HTML** (ex.: `ja_e_professor`). A variável do contato nasce sozinha no
  primeiro envio. No `index.html`, acrescente o campo em `campos: {…}` na chamada do envio.

### 1.2 O porteiro: de onde a pessoa veio

- O script do porteiro **já está no `<head>` do `index.html`**:
  `<script src="https://www.stafy.app/p/porteiro.js" async></script>`.
  Ele é o mesmo para todos os negócios, então **não há nada a configurar**.
- Ele guarda no navegador da pessoa a **primeira** e a **última** origem (UTMs, `fbclid`, `gclid`…), lê
  os cookies `_fbp`/`_fbc` e entrega tudo no envio. Não envia nada sozinho.
- No Stafy, a explicação fica em **Porteiro** (`stafy.app/negocios/<negocio>/porteiro`), no botão
  **Ligar a origem da página**. Na gaveta estão o trecho e os três passos.
- Para conferir na página publicada: abra o console do navegador e digite `StafyOrigem.pacote()`.
- ℹ️ O cartão **"O script na página"** da tela do porteiro só fica verde com **cliques em links do
  porteiro**. Um envio direto do formulário não o acende, mas a origem chega no contato do mesmo jeito.

**Opcional: o anúncio passando pelo porteiro (para ter cidade, aparelho e protocolo do clique)**

No Redirecionador (Porteiro), crie um link que aponta para a página e ligue
**"a página de destino tem um formulário do Stafy"**. A página passa a receber `?pc=<id do clique>`, e a
integração repassa esse id ao Stafy, que costura o cadastro ao clique. Sem isso, a origem vem do
script e da URL, o que já cobre UTMs, `fbclid`, `gclid` e `_fbp`/`_fbc`.

**O link do anúncio com as UTMs**: no passo 4, em **"Link para o anúncio (com UTMs)"**, escolha
**"A minha página (com o formulário embutido)"** e cole o endereço da página.

---

## 2. Na página (este repositório)

### 2.1 Onde trocar: o `CONFIG` do `index.html`

```js
stafy: {
  endereco: 'https://www.stafy.app/api/forms/black-ibprof-grupo-vip-0000/submit?negocio=ibprof',
  usarDestinoDoStafy: false,
  prazoMs: 8000
},
webhook: 'https://script.google.com/…/exec',   // cópia na planilha; '' desliga
paginaObrigado: 'obrigado.html'
```

| Chave | O que é |
| --- | --- |
| `stafy.endereco` | **TROQUE** pelo endereço copiado no passo 4 do Stafy. O valor de agora é um **exemplo**: `black-ibprof-grupo-vip-0000` e `ibprof` não existem. O modelo é `https://www.stafy.app/api/forms/<formulario>/submit?negocio=<negocio>`. Com `''`, o envio ao Stafy fica desligado. |
| `stafy.usarDestinoDoStafy` | `false` (padrão): depois do envio, a pessoa vai para `paginaObrigado`. `true`: vai para o destino do passo 2 do Stafy, se houver, já com as UTMs, o `src`, o `fbclid` e o `gclid` (o Stafy monta). |
| `stafy.prazoMs` | Quanto a página espera o Stafy responder. Passou disso, a pessoa segue para o obrigado e o pedido termina sozinho em segundo plano (`keepalive`). |
| `paginaObrigado` | Para onde a pessoa vai depois. A página leva junto a busca da URL (`?utm_source=…`). |

### 2.2 O que é enviado ao Stafy

É o mesmo formato do formulário nativo do Stafy (`src/components/forms/public-form.tsx`):

| No corpo | De onde vem | Para que serve no Stafy |
| --- | --- | --- |
| `name`, `email`, `phone` | o que a pessoa digitou | o contato (sem duplicar: acha a pessoa pelo telefone ou e-mail, inclusive quem já conversou no WhatsApp) |
| `utm_source` … `utm_term` | a URL da página | a origem do contato |
| `pc` (e `?pc=` no endereço) | a URL, quando a pessoa veio por um link do porteiro | costura o cadastro ao clique (cidade, aparelho, protocolo) |
| `stafy_params` | **todos** os parâmetros da URL (`fbclid`, `gclid`, `src`, `ad_id`…) | rastreio; parâmetro desconhecido (ex.: `?turma=a`) **vira coluna no contato** |
| `stafy_pagina` | o endereço desta página | a página de entrada |
| `stafy_referrer` | `document.referrer` | de onde a pessoa veio (ex.: `l.facebook.com`) |
| `stafy_origem` | o **pacote da origem**, em **texto JSON**: o do `porteiro.js` (primeira + última origem) ou, se ele não carregou, um pacote mínimo com a origem da URL | UTMs da página, `fbclid`/`gclid`, e os cookies **`_fbp` e `_fbc`**, gravados no contato |

Sobre o **`_fbc`**: quando o cookie não existe (Pixel bloqueado) mas o `fbclid` veio na URL, a
integração monta o `_fbc` no formato da Meta, `fb.1.<hora em ms>.<fbclid>`. É o jeito que a própria
Meta documenta.

O pedido vai como **`text/plain`** com JSON dentro. Assim o navegador não faz a pergunta prévia de
CORS (`OPTIONS`), e o envio fica com uma ida a menos ao servidor. A rota do Stafy lê como JSON todo
corpo que não é de formulário.

Exemplo real do teste (dados de mentira):

```
formulário: black-ibprof-grupo-vip-0000 | negócio: ibprof | pc: 3f2b8c1e-9d4a-4f6b-8a2c-1e5d7f9b0a11
content-type: text/plain;charset=UTF-8 | pergunta prévia de CORS (OPTIONS): 0
campos: {"name":"Ana Teste","email":"ana@exemplo.com","phone":"5545999990000"}
utm no corpo: {"utm_source":"facebook","utm_medium":"cpc","utm_campaign":"black-ibprof","utm_content":"video-1","utm_term":"professores"}
stafy_params: {…, "fbclid":"IwAR_teste_123","gclid":"gclid_teste","xpto":"1"}
stafy_referrer: https://l.facebook.com/
stafy_origem.ultima: {"utm_source":"facebook",…,"fbclid":"IwAR_teste_123","gclid":"gclid_teste","referrer":"https://l.facebook.com/","em":"…"}
stafy_origem.fbp / fbc: fb.1.1760400000000.987654321 / fb.1.1760400000000.IwAR_cookie_fbc
✅ o corpo passa nas regras do Stafy
```

### 2.3 O que a página faz com cada resposta

| Resposta do Stafy | O que a pessoa vê |
| --- | --- |
| **200** `{ ok: true }` | vai para o obrigado (ou para o destino do Stafy, com `usarDestinoDoStafy: true`) |
| **422** `phone_invalid` | "Confira o seu WhatsApp com DDD — esse número não parece válido." O botão volta e ela corrige. |
| **422** `email_required` | "Digite um e-mail válido." |
| **429** (muitas tentativas do mesmo IP) | "Muitas tentativas seguidas. Espere um minuto e tente de novo." |
| **404** (endereço errado ou formulário pausado), **500**, sem rede, ou passou de `prazoMs` | **segue para o obrigado mesmo assim**. A planilha guardou a cópia, e travar a pessoa perderia o lead de vez. No console do navegador aparece `[Stafy] o cadastro não chegou ao Stafy: <motivo>`. |

Antes de chegar ao Stafy, a página ainda confere tudo sozinha: nome com 2 letras ou mais, e-mail
válido e WhatsApp com DDD (10 ou 11 dígitos). Durante o envio, o botão fica desabilitado e mostra
"Enviando...". O `fbq('track','Lead')` do Pixel continua saindo do navegador, como antes.

### 2.4 Os arquivos

| Arquivo | O que tem |
| --- | --- |
| `index.html` | o `<script>` do porteiro no `<head>`, o `CONFIG.stafy` e o envio dos dois formulários (o do topo e o do fim) |
| `integracoes/stafy-formulario.js` | o envio para o Stafy. Não depende de nada e serve para **qualquer outra página**: basta incluir o arquivo e chamar `StafyFormulario.enviar({ endereco, campos })` |
| `integracoes/teste/servidor-de-teste.mjs` | um Stafy de mentira para testar na máquina, sem enviar nada para lugar nenhum |
| `integracoes/prints/` | os prints da página (topo deste documento, item 5) |

---

## 3. O que o Stafy faz com o cadastro

Este é o mesmo caminho do formulário nativo (`src/lib/forms/receber-o-envio.ts`):

- **contato**: acha a pessoa sem duplicar (telefone → e-mail), inclusive quem já conversou pelo
  WhatsApp. Grava nome, e-mail e WhatsApp (com o DDI);
- **origem**: a linha "formulário" no histórico de origem, com as UTMs, o `fbclid`, o `gclid`, a
  página de entrada, a cidade, o IP e o aparelho. A cidade, o IP e o aparelho vêm do próprio pedido,
  porque quem posta é o navegador da pessoa. Grava também o `fbp`/`fbc` no contato e a **primeira**
  origem (`primeira_*`);
- **automação**: a lista e as tags do passo 3; o evento **`form_submitted`**, que começa os fluxos de
  "Formulário — Submetido"; o `tag_added`, que liga as automações por tag; e, se ligados, o card no
  CRM, o WhatsApp ao receber e o seu webhook de saída.

---

## 4. Como testar

### 4.1 Na máquina, sem tocar no Stafy

```bash
node integracoes/teste/servidor-de-teste.mjs
```

Abra `http://localhost:5500/?utm_source=facebook&utm_campaign=teste&fbclid=IwAR_teste` e envie o
formulário. O terminal mostra **o corpo exato** que o Stafy receberia, já conferido com as regras dele.
O servidor troca na hora o Stafy, a planilha e o Pixel por versões locais, então nada sai da máquina.

- WhatsApp `(11) 11111-1111` → o Stafy de mentira responde 422 (testa a mensagem de erro);
- `MODO=fora` (500), `MODO=lento` (15 s) e `MODO=limite` (429) testam os outros caminhos;
- `PORTEIRO_JS=<arquivo>` serve um `porteiro.js` local. Sem ele, a página usa o pacote mínimo de origem.

### 4.2 De verdade, depois de configurar

1. Troque o `CONFIG.stafy.endereco` e publique a página.
2. Abra a página publicada com `?utm_source=teste&utm_campaign=teste-integracao&fbclid=teste123` e envie
   com os seus dados.
3. No Stafy, abra o contato (Contatos): a origem **"formulário"** deve aparecer com as UTMs, e o envio
   deve estar na lista do formulário. No console do navegador, não deve haver aviso `[Stafy]`.

Teste direto, sem a página (⚠️ cria um contato de verdade no Stafy):

```bash
curl -X POST 'https://www.stafy.app/api/forms/<formulario>/submit?negocio=<negocio>' \
  -H 'Content-Type: text/plain;charset=UTF-8' \
  -d '{"name":"Teste Integração","email":"teste@exemplo.com","phone":"5545999990000","utm_source":"teste"}'
# → {"ok":true,"redirect_url":null,"message":"Recebido! Obrigado.","contactId":"…"}
```

### 4.3 O que já foi provado (14/10/2026)

O Chromium (Playwright) rodou contra o servidor de teste usando o **`porteiro.js` real**, gerado do
código do Stafy. **32 de 32 conferências passaram**:

- o corpo completo (campos, 5 UTMs, `pc`, `stafy_params`, página, referenciador, pacote com
  primeira/última origem, `_fbp`/`_fbc`), sem pergunta prévia de CORS;
- os dois formulários (o do topo e o do fim da página);
- sem o `porteiro.js`, o pacote mínimo, com o `_fbc` montado do `fbclid`;
- "Enviando...", o 422 com a mensagem e o botão de volta, o 429, o 500 e o Stafy lento (segue em
  ~8 s);
- a validação local e a página no celular.

Os corpos capturados também passaram pelas **mesmas funções que a rota do Stafy usa** (rodadas
direto do código do Stafy, sem banco): `lerOrigemDaPagina`, `origemParaHistorico`,
`canonizarCamposDoFormulario`, `rastreioDoEnvio`, `utmsEfetivas` e a normalização de telefone. Todas
aceitaram.

Houve também uma sabotagem: enviar o pacote como objeto em vez de texto JSON fez 9 conferências
reprovarem, e com o arquivo devolvido voltou a 32/32.

**O que NÃO foi provado:** o envio para o Stafy de produção. Nada foi enviado para lá: a gravação de
verdade (contato, lista, tags, fluxos) depende do formulário criado no item 1.

---

## 5. Prints

**Da página** (tirados no teste, com dados de mentira):

| | |
| --- | --- |
| ![Formulário preenchido](prints/pagina-1-formulario-preenchido.png) | ![Enviando](prints/pagina-2-enviando.png) |
| O formulário do topo, preenchido | "Enviando...": o botão travado enquanto o Stafy responde |
| ![Erro do Stafy](prints/pagina-3-erro-do-stafy.png) | |
| O Stafy recusou o telefone (422): mensagem em português e o botão de volta | |

**Do Stafy**: o Stafy local não estava no ar na hora do teste, então estes prints **ficaram por
tirar**. As telas são estas, na ordem do passo a passo:

1. **Formulários do negócio** (`/negocios/<negocio>/formularios`), com o botão **Novo formulário**.
2. **Editar formulário › passo 1 "O que a pessoa preenche"**, com os 3 campos: Nome (`name`), Email
   (`email`), WhatsApp (`phone`).
3. **Passo 2 "Para onde vai depois"**, em branco.
4. **Passo 3 "O que acontece ao receber"**, com a lista e as tags.
5. **Passo 4 "Onde publicar" › "Já tenho um formulário na minha página"**, com o endereço de
   integração e o botão **Copiar o endereço de integração**.
6. **Passo 4 › "Os nomes dos campos — para a sua página e para as mensagens"**: a tabela
   `name`/`email`/`phone` com as tags `%FULLNAME%`, `%EMAIL%` e `%PHONE%`.
7. **Porteiro › "Ligar a origem da página"**: a gaveta com o trecho do script.
8. Depois do primeiro teste real: **a ficha do contato**, com a origem "formulário" e as UTMs.

---

## 6. O que falta no Stafy, e os limites conhecidos

- **O evento Lead pela API de Conversões da Meta (pelo servidor) não sai para formulários.** Hoje o
  Stafy só manda evento pelo servidor nas **pesquisas** (`src/lib/pesquisas/conversoes/`). Nesta
  página, o Lead sai só pelo **Pixel do navegador** (`fbq`), que o bloqueador de anúncio pode barrar.
  O Stafy já **guarda** `fbp`, `fbc`, `fbclid`, IP e navegador no contato, que é tudo o que a API de
  Conversões precisa. Falta o envio. Quando existir, a página pode mandar um `event_id` para a Meta
  não contar duas vezes.
- **O endereço do formulário no `CONFIG` é um exemplo** até o formulário ser criado (item 1.1).
- **O negócio no endereço (`?negocio=`) é obrigatório na prática**: o nome do formulário só é único
  dentro do negócio. O endereço copiado do Stafy já vem com ele.
- **Limite de envios**: o Stafy limita por formulário e por IP. Num evento com muita gente na mesma
  rede (ex.: a mesma escola), algumas pessoas podem ver a mensagem de "muitas tentativas".

## 7. Outros jeitos de integrar depois

- **O formulário do Stafy dentro da página** (passo 4, "Código para colar no seu site"): o Stafy
  desenha o formulário, e o visual passa a ser o dele.
- **HTML puro, sem JavaScript** (passo 4, "HTML para colar na sua landing page"): um
  `<form action="…/submit?negocio=…" method="POST">`. O Stafy responde com um redirecionamento (303)
  para o destino do passo 2. Com o `porteiro.js` na página, o campo oculto `stafy_origem` entra
  sozinho.
- **Por MCP** (passo 4, "Ligar por MCP"): o Claude, o ChatGPT ou um agente cadastra pelo conector,
  pelo mesmo caminho e com as mesmas automações.
- **Outra página**: copie `integracoes/stafy-formulario.js`, ponha o `porteiro.js` no `<head>` e chame
  `StafyFormulario.enviar({ endereco, campos: { name, email, phone } })`.
