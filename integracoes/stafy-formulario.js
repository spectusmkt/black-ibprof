/* =====================================================================
   Stafy · envio do formulário da página para um formulário do Stafy
   =====================================================================

   O formulário continua sendo o da página (o visual, a validação, o botão).
   Este arquivo só faz uma coisa: pegar o que a pessoa digitou, juntar a
   ORIGEM dela (UTMs, fbclid, gclid, _fbp/_fbc, página, referenciador, o
   clique do porteiro) e entregar ao formulário do Stafy, no MESMO formato
   que o formulário nativo do Stafy usa.

   Como usar (o index.html já faz isso):

     StafyFormulario.enviar({
       endereco: 'https://www.stafy.app/api/forms/<formulario>/submit?negocio=<negocio>',
       campos:   { name: 'Ana Souza', email: 'ana@exemplo.com', phone: '5545999990000' },
       prazoMs:  8000
     }).then(function (r) { ... });

   O resultado (`r`) é sempre um destes — a promessa nunca falha:
     { ok: true,  tipo: 'ok',     destino, mensagem, contato }  → o Stafy recebeu
     { ok: false, tipo: 'dado',   erro }  → 422: o Stafy recusou o dado (ex.: 'phone_invalid')
     { ok: false, tipo: 'limite', erro }  → 429: muitas tentativas do mesmo IP
     { ok: false, tipo: 'fora',   erro }  → Stafy fora do ar, sem rede, demorou, ou o
                                             endereço está errado (404 'form_not_found')

   O que vai no corpo (o mesmo do formulário nativo — src/components/forms/public-form.tsx):
     · os campos (name, email, phone…)            → viram o contato
     · utm_source … utm_term (da URL)             → a origem do contato
     · pc (o clique do porteiro, quando há)       → costura o lead ao clique (cidade, aparelho, protocolo)
     · stafy_params  = todos os parâmetros da URL → fbclid, gclid, src, ad_id… (e o resto vira coluna)
     · stafy_pagina  = o endereço desta página
     · stafy_referrer = de onde a pessoa veio (document.referrer)
     · stafy_origem  = o PACOTE DA ORIGEM, em texto JSON: o do script do porteiro
                       (window.StafyOrigem.pacote(), com a PRIMEIRA e a ÚLTIMA origem)
                       ou, se o script não carregou, um pacote mínimo montado aqui —
                       sempre com os cookies _fbp e _fbc da Meta.

   Por que `text/plain` e não `application/json`: assim o navegador manda o
   pedido direto, sem a pergunta prévia de CORS (OPTIONS) — uma ida a menos ao
   servidor. O Stafy lê o corpo como JSON quando o tipo não é de formulário
   (rota /api/forms/[slug]/submit: "sem content-type ou desconhecido → tenta JSON").

   JavaScript de navegador velho de propósito (var, function, sem =>): roda em
   qualquer celular, sem passo de build.
   ===================================================================== */
(function (janela, doc) {
  'use strict';
  if (janela.StafyFormulario) return;

  var VERSAO_DA_ORIGEM = 1;          // o formato do pacote que o Stafy lê (lib/porteiro/origem-da-pagina.ts)
  var LIMITE_PARAMETROS = 40;        // o mesmo teto do formulário nativo
  var LIMITE_CHAVE = 64;
  var LIMITE_VALOR_PARAMETRO = 500;
  var LIMITE_VALOR_ORIGEM = 512;
  var LIMITE_PACOTE = 8000;          // o Stafy recusa pacote acima de 8 KB
  var PRAZO_PADRAO_MS = 8000;

  var UTMS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'];

  /* Os parâmetros de rastreio que o Stafy aceita no pacote da origem
     (PARAMETROS_DA_PAGINA em lib/porteiro/script-da-pagina.ts), mais todo utm_* e hsa_*. */
  var RASTREIO = [
    'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'utm_placement', 'utm_id',
    'src', 'fbclid', 'gclid', 'fbp', 'ttclid', 'msclkid', 'twclid', 'li_fat_id', 'epik', 'irclickid',
    'wbraid', 'gbraid', 'ad_id', 'adset_id', 'campaign_id'
  ];

  /* Os do Stafy: viajam por conta própria, nunca como parâmetro do lead. */
  var NOSSOS = /^(pc|negocio|_h|stafy_.*)$/i;
  var UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  /* Texto limpo, com teto. Placeholder não substituído ({{utm_source}}, {campanha})
     não é valor — o Stafy também o descarta. */
  function texto(v, teto) {
    if (v === null || v === undefined) return null;
    var t = String(v).trim();
    if (!t) return null;
    if (/^\{\{?[^}]*\}?\}$/.test(t)) return null;
    return t.slice(0, teto || LIMITE_VALOR_ORIGEM);
  }

  function paresDaBusca(busca) {
    var saida = [];
    var pares = String(busca || '').replace(/^\?/, '').split('&');
    for (var i = 0; i < pares.length; i++) {
      if (!pares[i]) continue;
      var corte = pares[i].indexOf('=');
      var k = corte < 0 ? pares[i] : pares[i].slice(0, corte);
      var v = corte < 0 ? '' : pares[i].slice(corte + 1);
      try {
        k = decodeURIComponent(k.replace(/\+/g, ' '));
        v = decodeURIComponent(v.replace(/\+/g, ' '));
      } catch (e) { /* parâmetro mal codificado entra como veio */ }
      saida.push([k, v]);
    }
    return saida;
  }

  function daBusca(busca, nome) {
    var pares = paresDaBusca(busca);
    for (var i = 0; i < pares.length; i++) if (pares[i][0] === nome) return pares[i][1];
    return null;
  }

  function lerCookie(nome) {
    var partes = String(doc.cookie || '').split(';');
    for (var i = 0; i < partes.length; i++) {
      var p = partes[i].trim();
      var corte = p.indexOf('=');
      if (corte > 0 && p.slice(0, corte) === nome) {
        try { return texto(decodeURIComponent(p.slice(corte + 1))); } catch (e) { return texto(p.slice(corte + 1)); }
      }
    }
    return null;
  }

  /* Todos os parâmetros da URL, menos os do Stafy — o `stafy_params` do formulário nativo. */
  function parametrosDaUrl(busca) {
    var saida = {};
    var n = 0;
    var pares = paresDaBusca(busca);
    for (var i = 0; i < pares.length; i++) {
      var k = String(pares[i][0]).trim().slice(0, LIMITE_CHAVE);
      if (!k || NOSSOS.test(k) || Object.prototype.hasOwnProperty.call(saida, k)) continue;
      var v = texto(pares[i][1], LIMITE_VALOR_PARAMETRO);
      if (!v) continue;
      if (n >= LIMITE_PARAMETROS) break;
      saida[k] = v;
      n++;
    }
    return saida;
  }

  /* A origem que está NA URL agora (só rastreio), carimbada com a hora. */
  function origemDaUrl(busca, referrer, quando) {
    var saida = {};
    var n = 0;
    var pares = paresDaBusca(busca);
    for (var i = 0; i < pares.length; i++) {
      var k = pares[i][0];
      var conhecido = RASTREIO.indexOf(k) >= 0 || /^(utm|hsa)_[a-z0-9_]{1,40}$/i.test(k);
      if (!conhecido || Object.prototype.hasOwnProperty.call(saida, k)) continue;
      var v = texto(pares[i][1]);
      if (!v) continue;
      if (n >= LIMITE_PARAMETROS) break;
      saida[k] = v;
      n++;
    }
    var ref = texto(referrer);
    if (ref) saida.referrer = ref;
    saida.em = quando;
    return saida;
  }

  /* O _fbc no formato da Meta (fb.1.<hora em ms>.<fbclid>), para quando o cookie não
     existe (Pixel bloqueado) mas o fbclid veio na URL. É o jeito que a própria Meta
     documenta para montar o fbc a partir do fbclid. */
  function fbcDoFbclid(fbclid, quandoIso) {
    var f = texto(fbclid);
    if (!f) return null;
    var ms = quandoIso ? Date.parse(quandoIso) : NaN;
    if (!isFinite(ms)) ms = new Date().getTime();
    return ('fb.1.' + ms + '.' + f).slice(0, LIMITE_VALOR_ORIGEM);
  }

  function copia(o) {
    var c = {};
    if (!o || typeof o !== 'object') return c;
    for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) c[k] = o[k];
    return c;
  }

  /* O PACOTE DA ORIGEM — o que vai em `stafy_origem`.
     1) O do script do porteiro (`/p/porteiro.js`), quando ele carregou: ele lembra a
        PRIMEIRA origem da pessoa neste site (localStorage) e a última.
     2) Senão, um pacote mínimo com a origem desta visita — mesmo formato. */
  function pacoteDaOrigem() {
    var agora = new Date().toISOString();
    var p = null;
    try {
      if (janela.StafyOrigem && typeof janela.StafyOrigem.pacote === 'function') p = janela.StafyOrigem.pacote();
    } catch (e) { p = null; }

    if (!p || typeof p !== 'object') {
      var daUrl = origemDaUrl(janela.location.search, doc.referrer, agora);
      p = {
        v: VERSAO_DA_ORIGEM,
        primeira: daUrl,
        ultima: daUrl,
        pagina: {
          url: texto(janela.location.href),
          host: texto(janela.location.hostname),
          titulo: texto(doc.title),
          referrer: texto(doc.referrer)
        },
        fbp: lerCookie('_fbp'),
        fbc: lerCookie('_fbc'),
        em: agora
      };
    } else {
      p = copia(p);
      if (!p.fbp) p.fbp = lerCookie('_fbp');
      if (!p.fbc) p.fbc = lerCookie('_fbc');
    }

    if (!p.fbc) {
      var ultima = p.ultima || {};
      p.fbc = ultima.fbclid
        ? fbcDoFbclid(ultima.fbclid, ultima.em)
        : fbcDoFbclid(daBusca(janela.location.search, 'fbclid'), agora);
    }

    if (JSON.stringify(p).length > LIMITE_PACOTE) {
      /* Estourou: vai o essencial. Pacote recusado por tamanho = origem nenhuma. */
      p = { v: p.v || VERSAO_DA_ORIGEM, primeira: p.primeira || {}, ultima: p.ultima || {}, fbp: p.fbp || null, fbc: p.fbc || null, em: p.em || agora };
    }
    return p;
  }

  /* Monta o pedido: o endereço (com o `pc` do porteiro, se veio na URL) e o corpo. */
  function montarEnvio(opcoes) {
    var busca = janela.location.search;
    var pc = texto(daBusca(busca, 'pc'));
    if (pc && !UUID.test(pc)) pc = null;

    var url = String(opcoes.endereco || '');
    if (pc && !/[?&]pc=/.test(url)) url += (url.indexOf('?') >= 0 ? '&' : '?') + 'pc=' + encodeURIComponent(pc);

    var corpo = copia(opcoes.campos);
    for (var i = 0; i < UTMS.length; i++) {
      var v = texto(daBusca(busca, UTMS[i]), LIMITE_VALOR_PARAMETRO);
      if (v && !corpo[UTMS[i]]) corpo[UTMS[i]] = v;
    }
    if (pc) corpo.pc = pc;
    corpo.stafy_params = parametrosDaUrl(busca);
    corpo.stafy_pagina = janela.location.href;
    corpo.stafy_referrer = doc.referrer || null;
    corpo.stafy_origem = JSON.stringify(pacoteDaOrigem());
    return { url: url, corpo: corpo };
  }

  function classificar(status, dados) {
    var d = dados && typeof dados === 'object' ? dados : {};
    if (status >= 200 && status < 300 && d.ok) {
      return { ok: true, tipo: 'ok', destino: d.redirect_url || null, mensagem: d.message || null, contato: d.contactId || null };
    }
    if (status === 422) return { ok: false, tipo: 'dado', erro: d.error || 'invalido' };
    if (status === 429) return { ok: false, tipo: 'limite', erro: d.error || 'rate_limited' };
    return { ok: false, tipo: 'fora', erro: d.error || ('http_' + status) };
  }

  function enviar(opcoes) {
    return new Promise(function (resolver) {
      var feito = false;
      function fim(r) { if (!feito) { feito = true; resolver(r); } }

      var envio;
      try {
        envio = montarEnvio(opcoes || {});
      } catch (e) {
        return fim({ ok: false, tipo: 'fora', erro: 'montagem' });
      }
      if (!envio.url) return fim({ ok: false, tipo: 'fora', erro: 'sem_endereco' });
      if (typeof janela.fetch !== 'function') return fim({ ok: false, tipo: 'fora', erro: 'sem_fetch' });

      /* Passou do prazo: a página segue sem esperar — e o `keepalive` deixa o pedido
         terminar mesmo depois que a pessoa já foi para a página de obrigado. */
      var relogio = setTimeout(function () { fim({ ok: false, tipo: 'fora', erro: 'tempo' }); }, (opcoes && opcoes.prazoMs) || PRAZO_PADRAO_MS);

      janela.fetch(envio.url, {
        method: 'POST',
        mode: 'cors',
        credentials: 'omit',
        keepalive: true,
        headers: { 'Content-Type': 'text/plain;charset=UTF-8', 'Accept': 'application/json' },
        body: JSON.stringify(envio.corpo)
      })
        .then(function (res) {
          return res.json()
            .catch(function () { return {}; })
            .then(function (d) { return classificar(res.status, d); });
        })
        .catch(function () { return { ok: false, tipo: 'fora', erro: 'rede' }; })
        .then(function (r) { clearTimeout(relogio); fim(r); });
    });
  }

  janela.StafyFormulario = {
    versao: 1,
    enviar: enviar,
    montarEnvio: montarEnvio,
    pacoteDaOrigem: pacoteDaOrigem
  };
})(window, document);
