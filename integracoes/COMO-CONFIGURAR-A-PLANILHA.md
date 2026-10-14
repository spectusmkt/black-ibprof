# Planilha de leads — Black Friday IBPROF

Cada pessoa que preencher o formulário da página vira uma linha nova numa planilha do Google Sheets, com:
data/hora, e-mail, WhatsApp, se já tinha se cadastrado antes, UTMs do anúncio e a página de origem.

Leva uns 5 minutos para configurar.

## 1. Criar a planilha
1. Acesse https://sheets.new (com a conta Google do IBPROF).
2. Dê um nome, por exemplo: **Leads Black Friday IBPROF**.

## 2. Colar o script
1. Na planilha, clique em **Extensões → Apps Script**.
2. Apague o que estiver no editor e cole todo o conteúdo do arquivo `planilha-leads.gs` (está nesta mesma pasta).
3. Clique no ícone de disquete (**Salvar**).

## 3. Publicar
1. Clique em **Implantar → Nova implantação**.
2. Na engrenagem ao lado de "Selecionar tipo", escolha **App da Web**.
3. Preencha:
   - **Executar como:** Eu (seu e-mail)
   - **Quem pode acessar:** Qualquer pessoa
4. Clique em **Implantar** e autorize o acesso com a sua conta.
   - Se aparecer "O Google não verificou este app", clique em **Avançado → Acessar (não seguro)**. O script é seu, roda só na sua planilha.
5. Copie a **URL do app da Web** (termina em `/exec`).

## 4. Ligar na página
Envie essa URL para o Claude (ou cole no `index.html`, em `CONFIG.webhook`).

## Teste
- Abrir a URL `/exec` no navegador deve mostrar: `Planilha de leads da Black Friday IBPROF funcionando.`
- Depois de ligada na página, preencha o formulário: em segundos aparece uma linha na aba **Leads**.

## Se mudar o script depois
Em **Implantar → Gerenciar implantações → ✏️ Editar → Versão: Nova versão → Implantar**.
Assim a URL continua a mesma.
