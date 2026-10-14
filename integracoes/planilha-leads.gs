/**
 * Black Friday IBPROF — recebe os leads do formulário da página
 * e grava cada um como uma linha nova na planilha.
 *
 * Como instalar: veja integracoes/COMO-CONFIGURAR-A-PLANILHA.md
 */

var ABA = 'Leads';
var COLUNAS = ['Data/hora', 'E-mail', 'WhatsApp', 'Já cadastrado?', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'Página'];

function doPost(e) {
  var trava = LockService.getScriptLock();
  trava.waitLock(10000); // evita linhas trocadas quando chegam vários leads ao mesmo tempo
  try {
    var lead = JSON.parse(e.postData.contents || '{}');
    var aba = pegarAba_();

    var email = String(lead.email || '').trim().toLowerCase();
    var whatsapp = String(lead.whatsapp || '').replace(/\D/g, '');
    if (!email && !whatsapp) return resposta_({ ok: false, erro: 'lead vazio' });

    aba.appendRow([
      Utilities.formatDate(new Date(), 'America/Sao_Paulo', 'dd/MM/yyyy HH:mm:ss'),
      email,
      whatsapp,
      jaExiste_(aba, email, whatsapp) ? 'Sim' : '',
      lead.utm_source || '',
      lead.utm_medium || '',
      lead.utm_campaign || '',
      lead.utm_content || '',
      lead.utm_term || '',
      lead.pagina || ''
    ]);
    return resposta_({ ok: true });
  } catch (erro) {
    return resposta_({ ok: false, erro: String(erro) });
  } finally {
    trava.releaseLock();
  }
}

// Abrir a URL do app no navegador mostra se está funcionando.
function doGet() {
  return resposta_({ ok: true, mensagem: 'Planilha de leads da Black Friday IBPROF funcionando.' });
}

function pegarAba_() {
  var planilha = SpreadsheetApp.getActiveSpreadsheet();
  var aba = planilha.getSheetByName(ABA) || planilha.insertSheet(ABA);
  if (aba.getLastRow() === 0) {
    aba.appendRow(COLUNAS);
    aba.getRange(1, 1, 1, COLUNAS.length).setFontWeight('bold').setBackground('#0c1f4f').setFontColor('#ffffff');
    aba.setFrozenRows(1);
    aba.getRange('C:C').setNumberFormat('@'); // WhatsApp como texto (não vira número científico)
  }
  return aba;
}

function jaExiste_(aba, email, whatsapp) {
  var ultima = aba.getLastRow();
  if (ultima < 2) return false;
  var dados = aba.getRange(2, 2, ultima - 1, 2).getValues(); // colunas E-mail e WhatsApp
  for (var i = 0; i < dados.length; i++) {
    if ((email && String(dados[i][0]).toLowerCase() === email) ||
        (whatsapp && String(dados[i][1]).replace(/\D/g, '') === whatsapp)) return true;
  }
  return false;
}

function resposta_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
