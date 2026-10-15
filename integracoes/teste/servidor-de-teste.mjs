#!/usr/bin/env node
/* =====================================================================
   Servidor de teste da integração com o Stafy — nada sai da sua máquina.
   =====================================================================

   Uso (na pasta do repositório):
     node integracoes/teste/servidor-de-teste.mjs

   Depois abra no navegador, por exemplo:
     http://localhost:5500/?utm_source=facebook&utm_medium=cpc&utm_campaign=black&fbclid=IwAR_teste&gclid=teste123

   O que ele faz:
     · porta 5500 — serve a página. No index.html, troca na hora (sem mexer no arquivo):
         https://www.stafy.app  → http://localhost:5501   (o "Stafy de mentira")
         o Pixel da Meta        → um arquivo vazio (nenhum evento sai para a Meta; as chamadas
                                  ficam na fila do fbq, em window.fbq.queue, para o teste conferir)
     · porta 5501 — o "Stafy de mentira": responde como a rota de verdade
       (POST /api/forms/<formulario>/submit, com CORS) e MOSTRA no terminal o
       corpo que a página mandou, já conferido com as regras do Stafy.

   Para testar os caminhos de erro:
     · WhatsApp com 11111111 no número  → responde 422 phone_invalid (o Stafy recusa telefone repetido)
     · MODO=fora   → responde 500 (a página deve seguir para o obrigado mesmo assim)
     · MODO=lento  → demora 15 s (a página segue depois do prazo, CONFIG.stafy.prazoMs)
     · MODO=limite → responde 429 (a página pede para esperar um minuto)
     · PORTEIRO_JS=<arquivo> → serve esse arquivo como /p/porteiro.js
       (sem ele, /p/porteiro.js dá 404 e a página usa o pacote mínimo de origem)

   GET http://localhost:5501/ultimo devolve o último corpo recebido (para teste automático).
   ===================================================================== */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const PORTA_PAGINA = Number(process.env.PORTA_PAGINA || 5500);
const PORTA_STAFY = Number(process.env.PORTA_STAFY || 5501);
const MODO = process.env.MODO || 'ok';
const STAFY_LOCAL = `http://localhost:${PORTA_STAFY}`;

const TIPOS = {
  '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.css': 'text/css',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml', '.json': 'application/json',
};

/* O mesmo CORS da rota de verdade (src/app/api/forms/[slug]/submit/route.ts). */
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'content-type, accept',
  'Access-Control-Max-Age': '86400',
};

let ultimo = null;
const preflights = { total: 0 };

/* ---------- porta 5500: a página ---------- */
http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORTA_PAGINA}`);
  let caminho = decodeURIComponent(url.pathname);
  if (caminho.endsWith('/')) caminho += 'index.html';
  const arquivo = path.join(RAIZ, caminho);
  if (!arquivo.startsWith(RAIZ) || !fs.existsSync(arquivo) || fs.statSync(arquivo).isDirectory()) {
    res.writeHead(404); return res.end('não achei');
  }
  const ext = path.extname(arquivo).toLowerCase();
  if (ext === '.html') {
    let html = fs.readFileSync(arquivo, 'utf8');
    html = html
      .split('https://www.stafy.app').join(STAFY_LOCAL)
      .split('https://connect.facebook.net/en_US/fbevents.js').join(`${STAFY_LOCAL}/fbevents-de-mentira.js`);
    res.writeHead(200, { 'Content-Type': TIPOS['.html'], 'Cache-Control': 'no-store' });
    return res.end(html);
  }
  res.writeHead(200, { 'Content-Type': TIPOS[ext] || 'application/octet-stream', 'Cache-Control': 'no-store' });
  fs.createReadStream(arquivo).pipe(res);
}).listen(PORTA_PAGINA, () => console.log(`📄 página:            http://localhost:${PORTA_PAGINA}/?utm_source=teste&fbclid=IwAR_teste`));

/* ---------- porta 5501: o Stafy de mentira ---------- */
function lerCorpo(req) {
  return new Promise((ok) => {
    const partes = [];
    req.on('data', (p) => partes.push(p));
    req.on('end', () => ok(Buffer.concat(partes).toString('utf8')));
  });
}

/* Os três formatos que a rota de verdade aceita: JSON, formulário, e "sem tipo → tenta JSON". */
function interpretar(tipo, bruto) {
  const t = (tipo || '').toLowerCase();
  const comoFormulario = () => Object.fromEntries(new URLSearchParams(bruto));
  if (t.includes('application/json')) return JSON.parse(bruto);
  if (t.includes('x-www-form-urlencoded')) return comoFormulario();
  try { return JSON.parse(bruto); } catch { return comoFormulario(); }
}

/* Confere o corpo com as regras do Stafy (lib/forms/receber-o-envio.ts e lib/porteiro/origem-da-pagina.ts). */
function conferir(corpo) {
  const avisos = [];
  const temEmail = typeof corpo.email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(corpo.email);
  const digitos = String(corpo.phone || '').replace(/\D/g, '');
  if (!temEmail && digitos.length < 10) avisos.push('sem e-mail e sem telefone: o Stafy responderia 422');
  if (corpo.stafy_origem !== undefined) {
    if (typeof corpo.stafy_origem !== 'string') avisos.push('stafy_origem precisa ser TEXTO (JSON em string) — o Stafy ignoraria');
    else if (corpo.stafy_origem.length > 8192) avisos.push('stafy_origem maior que 8 KB — o Stafy ignoraria');
    else {
      try {
        const p = JSON.parse(corpo.stafy_origem);
        if (!p || typeof p !== 'object' || !p.ultima) avisos.push('stafy_origem sem "ultima"');
      } catch { avisos.push('stafy_origem não é JSON — o Stafy ignoraria'); }
    }
  } else avisos.push('sem stafy_origem: a origem da página (fbp/fbc, primeira origem) não chegaria');
  if (corpo.stafy_params && (typeof corpo.stafy_params !== 'object' || Array.isArray(corpo.stafy_params))) {
    avisos.push('stafy_params precisa ser um objeto');
  }
  /* O id do Lead (o mesmo do fbq): a rota do Stafy só aceita letras, números, - e _, de 8 a 64 —
     fora disso ela usa o dela, e o Pixel e o servidor contariam dois Leads. */
  if (corpo.stafy_evento_id !== undefined && !/^[A-Za-z0-9_-]{8,64}$/.test(String(corpo.stafy_evento_id))) {
    avisos.push('stafy_evento_id fora do formato (8 a 64: letras, números, - e _) — o Lead contaria duas vezes');
  }
  return avisos;
}

function mostrar(slug, consulta, tipo, corpo, avisos) {
  let origem = null;
  try { origem = JSON.parse(corpo.stafy_origem); } catch { /* conferido acima */ }
  console.log('\n──────── 📥 o Stafy de mentira recebeu um cadastro ────────');
  console.log('formulário:', slug, '| negócio:', consulta.get('negocio') || '(nenhum)', '| pc:', consulta.get('pc') || '(nenhum)');
  console.log('content-type:', tipo, '| pergunta prévia de CORS (OPTIONS) até agora:', preflights.total);
  console.log('campos:', JSON.stringify({ name: corpo.name, email: corpo.email, phone: corpo.phone }));
  console.log('utm no corpo:', JSON.stringify(Object.fromEntries(Object.entries(corpo).filter(([k]) => k.startsWith('utm_')))));
  console.log('stafy_params:', JSON.stringify(corpo.stafy_params));
  console.log('stafy_pagina:', corpo.stafy_pagina);
  console.log('stafy_referrer:', corpo.stafy_referrer);
  if (origem) {
    console.log('stafy_origem.ultima:', JSON.stringify(origem.ultima));
    console.log('stafy_origem.primeira:', JSON.stringify(origem.primeira));
    console.log('stafy_origem.fbp / fbc:', origem.fbp, '/', origem.fbc);
  }
  console.log('stafy_evento_id (o mesmo do fbq):', corpo.stafy_evento_id || '(nenhum)');
  console.log(avisos.length ? `⚠️  ${avisos.join(' · ')}` : '✅ o corpo passa nas regras do Stafy');
}

http.createServer(async (req, res) => {
  const url = new URL(req.url, STAFY_LOCAL);

  if (req.method === 'OPTIONS') {
    preflights.total += 1;
    res.writeHead(204, CORS); return res.end();
  }
  if (req.method === 'GET' && url.pathname === '/ultimo') {
    res.writeHead(200, { 'Content-Type': 'application/json', ...CORS });
    return res.end(JSON.stringify({ ...(ultimo || {}), preflights: preflights.total }));
  }
  if (req.method === 'GET' && url.pathname === '/fbevents-de-mentira.js') {
    res.writeHead(200, { 'Content-Type': TIPOS['.js'] }); return res.end('/* Pixel desligado no teste */');
  }
  if (req.method === 'GET' && url.pathname === '/p/porteiro.js') {
    const arq = process.env.PORTEIRO_JS;
    if (!arq || !fs.existsSync(arq)) { res.writeHead(404, CORS); return res.end(); }
    res.writeHead(200, { 'Content-Type': TIPOS['.js'], ...CORS }); return res.end(fs.readFileSync(arq));
  }
  const rota = url.pathname.match(/^\/api\/forms\/([^/]+)\/submit$/);
  if (req.method === 'POST' && rota) {
    const slug = decodeURIComponent(rota[1]);
    const tipo = req.headers['content-type'] || '';
    const bruto = await lerCorpo(req);
    let corpo;
    try { corpo = interpretar(tipo, bruto); } catch {
      res.writeHead(400, { 'Content-Type': 'application/json', ...CORS }); return res.end(JSON.stringify({ error: 'invalid_body' }));
    }
    const avisos = conferir(corpo);
    ultimo = { slug, consulta: Object.fromEntries(url.searchParams), tipo, corpo, avisos };
    mostrar(slug, url.searchParams, tipo, corpo, avisos);

    const responder = (status, dados) => {
      res.writeHead(status, { 'Content-Type': 'application/json', ...CORS });
      res.end(JSON.stringify(dados));
    };
    if (MODO === 'lento') await new Promise((r) => setTimeout(r, 15000));
    if (MODO === 'fora') return responder(500, { error: 'erro_de_teste' });
    if (MODO === 'limite') return responder(429, { error: 'rate_limited' });
    if (slug === 'nao-existe') return responder(404, { error: 'form_not_found' });
    if (String(corpo.phone || '').includes('11111111')) return responder(422, { error: 'phone_invalid' });
    /* Como a rota de verdade: o id do Lead volta na resposta (o que a página mandou, ou o do envio). */
    const eventoId = /^[A-Za-z0-9_-]{8,64}$/.test(String(corpo.stafy_evento_id || '')) ? corpo.stafy_evento_id : 'lead-envio-de-teste';
    return responder(200, { ok: true, redirect_url: null, message: 'Recebido! Obrigado.', contactId: 'contato-de-teste', evento_id: eventoId });
  }

  res.writeHead(404, CORS); res.end();
}).listen(PORTA_STAFY, () => console.log(`🧪 Stafy de mentira:  ${STAFY_LOCAL}  (modo: ${MODO})`));
