/**
 * Gera uma prévia navegável do painel, num arquivo HTML único.
 *
 * Roda o Codigo.gs DE VERDADE no navegador, sobre a mesma planilha simulada usada
 * nos testes, carregada com os dados reais. Dá para clicar, marcar etapa, editar
 * campo e ver o histórico — sem tocar na planilha do Drive.
 */
const fs = require('fs');
const path = require('path');
const { carregarGrade } = require('./comum.js');

const RAIZ = path.join(__dirname, '..');
const CSV = process.argv[2];
/* --com-clientes deixa a prévia já cadastrada com os clientes do Goiás Fomento */
const semear = process.argv.indexOf('--com-clientes') > 0;
const solto = process.argv.slice(3).filter(function (a) { return a.indexOf('--') !== 0; });
const SAIDA = solto[0] || path.join(RAIZ, 'previa.html');

/* As listas com dado real de cliente ficam fora do repositório. Quando não
   estiverem na máquina, a prévia usa o exemplo fictício versionado. */
function listaDe(nome) {
  const real = path.join(__dirname, 'dados', nome);
  const exemplo = path.join(__dirname, 'dados', 'exemplo-importacao.txt');
  return fs.readFileSync(fs.existsSync(real) ? real : exemplo, 'utf8');
}

const grade = carregarGrade(fs.readFileSync(CSV, 'utf8'));
const agora = new Date();
const doisDigitos = (n) => String(n).padStart(2, '0');
const carimboDaGeracao = doisDigitos(agora.getDate()) + '/' + doisDigitos(agora.getMonth() + 1) +
  ' às ' + doisDigitos(agora.getHours()) + ':' + doisDigitos(agora.getMinutes());

/* os serviços que o código de hoje cria — serve para perceber estado antigo */
const codigoCru = fs.readFileSync(path.join(RAIZ, 'apps-script', 'Codigo.gs'), 'utf8');
/* os nomes vêm do SERVICOS_PADRAO e das constantes que ele referencia */
const trechos = [(codigoCru.match(/const SERVICOS_PADRAO[\s\S]*?;/) || [''])[0]]
  .concat(codigoCru.match(/const FOMENTO_[A-Z]+ = '[^']+';/g) || []);
const assinaturaDaEstrutura = trechos.join(' ').match(/'[^']+'/g)
  .map(function (t) { return t.replace(/'/g, ''); })
  .filter(function (t) { return t.length > 3; });
const usuarios = ['Adriel Moreira', 'Warley', 'Alessandra', 'Thyago Souza', 'Thierry'];

/** Datas viram texto no JSON: marco as posições para reconstruí-las no navegador. */
const gradeSerial = grade.map((linha) => linha.map((v) =>
  v instanceof Date ? { __data: [v.getFullYear(), v.getMonth() + 1, v.getDate()] } : v));

const comum = fs.readFileSync(path.join(__dirname, 'comum.js'), 'utf8')
  .replace(/if \(typeof module[\s\S]*$/, ''); // a parte de export não serve no navegador
const codigo = fs.readFileSync(path.join(RAIZ, 'apps-script', 'Codigo.gs'), 'utf8');

/**
 * Quais funções o backend expõe. Lista manual fica desatualizada e faz o teste
 * passar por engano, então derivo do próprio código: toda função de topo cujo nome
 * não termina em `_` (a convenção de função interna do arquivo).
 */
const publicas = (codigo.match(/^function ([A-Za-z][A-Za-z0-9]*)\s*\(/gm) || [])
  .map((linha) => linha.replace(/^function /, '').replace(/\s*\($/, ''))
  .filter((nome) => !nome.endsWith('_'));
const tela = fs.readFileSync(path.join(RAIZ, 'apps-script', 'Index.html'), 'utf8');

const simulador = `
<script>
${comum}

var GRADE = ${JSON.stringify(gradeSerial)}.map(function (linha) {
  return linha.map(function (v) {
    return (v && v.__data) ? new Date(v.__data[0], v.__data[1] - 1, v.__data[2], 12, 0, 0) : v;
  });
});

/* ----------------------------------------------------------------- *
 * A prévia guarda o que você faz                                      *
 *                                                                     *
 * Sem isso, recarregar a página jogava fora todo o trabalho — foi o    *
 * que aconteceu com a importação do Goiás Fomento. Agora o estado      *
 * fica no navegador e volta ao abrir de novo.                          *
 * ----------------------------------------------------------------- */
var CHAVE_ESTADO = 'previa-planejamento-v1';
var GERADA_EM = ${JSON.stringify(carimboDaGeracao)};

/* Assinatura da estrutura que este código espera criar. Se o estado guardado
   foi feito com outra, a prévia mostra o que já existe — e avisa, em vez de
   deixar a pessoa achando que a mudança não chegou. */
var ESTRUTURA_ESPERADA = ${JSON.stringify(assinaturaDaEstrutura)};

function serializar(valor) {
  if (valor instanceof Date) {
    return { __data: [valor.getFullYear(), valor.getMonth() + 1, valor.getDate()] };
  }
  return valor;
}

function reidratar(valor) {
  if (valor && valor.__data) {
    return new Date(valor.__data[0], valor.__data[1] - 1, valor.__data[2], 12, 0, 0);
  }
  return valor;
}

function guardarEstado() {
  try {
    var pacote = {};
    Object.keys(AMBIENTE.abas).forEach(function (nome) {
      pacote[nome] = AMBIENTE.abas[nome].grade.map(function (linha) {
        return linha.map(serializar);
      });
    });
    localStorage.setItem(CHAVE_ESTADO, JSON.stringify(pacote));
  } catch (e) {
    console.warn('não consegui guardar o estado da prévia: ' + e.message);
  }
}

function lerEstadoGuardado() {
  try {
    var cru = localStorage.getItem(CHAVE_ESTADO);
    if (!cru) return null;
    var pacote = JSON.parse(cru);
    Object.keys(pacote).forEach(function (nome) {
      pacote[nome] = pacote[nome].map(function (linha) { return linha.map(reidratar); });
    });
    return pacote;
  } catch (e) {
    return null;
  }
}

function recomecarPrevia() {
  if (!confirm('Jogar fora o que foi feito nesta prévia e recomeçar da planilha?')) return;
  try { localStorage.removeItem(CHAVE_ESTADO); } catch (e) {}
  location.reload();
}

var ESTADO_GUARDADO = lerEstadoGuardado();
var AMBIENTE = criarPlanilhaSimulada(
  ESTADO_GUARDADO && ESTADO_GUARDADO.Controle ? ESTADO_GUARDADO.Controle : GRADE,
  ${JSON.stringify(usuarios)});

/* devolve as abas que o app criou em sessões anteriores */
if (ESTADO_GUARDADO) {
  Object.keys(ESTADO_GUARDADO).forEach(function (nome) {
    if (nome === 'Controle') return;
    if (!AMBIENTE.abas[nome]) {
      AMBIENTE.SpreadsheetApp.openById().insertSheet(nome);
    }
    AMBIENTE.abas[nome].grade.length = 0;
    ESTADO_GUARDADO[nome].forEach(function (linha) { AMBIENTE.abas[nome].grade.push(linha); });
  });
}
var LISTA_DE_EXEMPLO = ${JSON.stringify(listaDe('clientes-exemplo.txt'))};
var LISTA_DE_PROSPECCAO = ${JSON.stringify(listaDe('prospeccao.txt'))};

/* Os clientes do Goiás Fomento que ainda temos entram já cadastrados na
   primeira abertura — quem retoma um estado salvo não é incomodado. */
var SEMEAR_CLIENTES = ${semear};
var SpreadsheetApp = AMBIENTE.SpreadsheetApp;
var Utilities = AMBIENTE.Utilities;
var Session = AMBIENTE.Session;
var HtmlService = AMBIENTE.HtmlService;
var ScriptApp = AMBIENTE.ScriptApp;
var DriveApp = AMBIENTE.DriveApp;
var UrlFetchApp = AMBIENTE.UrlFetchApp;

/* O Codigo.gs vai isolado: ele e a tela têm funções de mesmo nome. */
var BACKEND = (function () {
${codigo}
  return { ${publicas.map((n) => n + ': ' + n).join(', ')} };
})();

/* google.script.run simulado, com o mesmo encadeamento de handlers. */
function semearClientesDoFomento() {
  if (!SEMEAR_CLIENTES || ESTADO_GUARDADO) return;

  /* nem sobre classificação que já exista na planilha de origem: semear só faz
     sentido numa prévia realmente vazia */
  var jaClassificadas = (BACKEND.carregarPainel().empresas || [])
    .filter(function (e) { return e.servico; }).length;
  if (jaClassificadas) {
    console.warn('não semeei: já há ' + jaClassificadas + ' empresas classificadas');
    return;
  }

  /* o nome do serviço vem do próprio painel: as constantes do Codigo.gs vivem
     dentro do BACKEND e não alcançam este escopo */
  var servicos = BACKEND.carregarPainel().servicos || [];
  var doFomento = servicos.filter(function (n) { return n.indexOf('Fomento') >= 0; })[0];
  var deProspeccao = servicos.filter(function (n) { return n.indexOf('Prospec') >= 0; })[0];

  try {
    if (doFomento) BACKEND.importarClientes(LISTA_DE_EXEMPLO, doFomento);
    if (deProspeccao) BACKEND.importarClientes(LISTA_DE_PROSPECCAO, deProspeccao);
    guardarEstado();
  } catch (erro) {
    console.warn('não consegui semear os clientes: ' + erro.message);
  }
}

var google = { script: { run: (function () {
  var ok = null, falha = null;
  var api = {
    withSuccessHandler: function (f) { ok = f; return api; },
    withFailureHandler: function (f) { falha = f; return api; }
  };
  var ESCRITAS = ['salvar', 'alternar', 'criar', 'excluir', 'definir', 'renomear',
                  'importar', 'desfazer', 'renumerar'];

  Object.keys(BACKEND).forEach(function (nome) {
    api[nome] = function () {
      var args = Array.prototype.slice.call(arguments);
      var aceitar = ok, recusar = falha;
      ok = null; falha = null;
      setTimeout(function () {
        try {
          var resposta = BACKEND[nome].apply(null, args);
          var alterou = ESCRITAS.some(function (p) { return nome.indexOf(p) === 0; });
          if (alterou) { guardarEstado(); contarAlteracao(); }
          aceitar(resposta);
        } catch (erro) { if (recusar) recusar(erro); else console.error(erro); }
      }, 40);
    };
  });
  return api;
})() } };

semearClientesDoFomento();
</script>
<div id="faixaPrevia" style="position:fixed;bottom:0;left:0;right:0;background:#16202b;color:#fff;
            padding:6px 14px;font:12px -apple-system,sans-serif;z-index:99;text-align:center">
  PRÉVIA — dados reais carregados em memória. Editar aqui <b>não altera</b> a planilha do Drive.
  <span style="opacity:.6;margin-left:10px">versão de ${carimboDaGeracao}</span>
</div>
<script>
  /* O trabalho feito aqui não é salvo: a faixa passa a dizer isso alto assim que
     a primeira alteração acontece, para ninguém cadastrar meia tarde à toa. */
  var alteracoesNaPrevia = 0;
  function contarAlteracao() {
    alteracoesNaPrevia++;
    var faixa = document.getElementById('faixaPrevia');
    if (!faixa) return;
    faixa.innerHTML = 'PRÉVIA — <b>' + alteracoesNaPrevia + ' alteração(ões)</b> guardadas neste ' +
      'navegador e mantidas ao recarregar. <b>Não vão para a planilha do Drive</b> — ' +
      'para valer, publique o app no Apps Script. ' +
      '<button onclick="recomecarPrevia()" style="margin-left:10px;background:none;' +
      'border:1px solid rgba(255,255,255,.4);color:#fff;border-radius:5px;padding:2px 9px;' +
      'font-size:11.5px;cursor:pointer">Recomeçar do zero</button>';
  }

  /* o estado guardado pode ser de uma versão anterior do sistema */
  function estruturaDefasada() {
    if (!ESTADO_GUARDADO || !ESTADO_GUARDADO.Servicos) return false;
    var guardados = ESTADO_GUARDADO.Servicos.slice(1)
      .map(function (l) { return String(l[0] || '').trim(); })
      .filter(function (n) { return n; });
    return ESTRUTURA_ESPERADA.some(function (n) { return guardados.indexOf(n) < 0; });
  }

  var botaoRecomecar = '<button onclick="recomecarPrevia()" style="margin-left:10px;' +
    'background:rgba(255,255,255,.15);border:1px solid rgba(255,255,255,.5);color:#fff;' +
    'border-radius:5px;padding:3px 12px;font-size:11.5px;font-weight:600;cursor:pointer">';

  if (ESTADO_GUARDADO) {
    setTimeout(function () {
      var faixa = document.getElementById('faixaPrevia');
      if (!faixa) return;

      if (estruturaDefasada()) {
        faixa.style.background = '#1d5c3a';
        faixa.innerHTML = 'PRÉVIA — o sistema foi atualizado e a estrutura nova ' +
          '<b>foi acrescentada ao que você já tinha</b>: nada do que estava classificado ' +
          'se perdeu. ' + botaoRecomecar + 'Recomeçar do zero</button>';
      } else {
        faixa.innerHTML = 'PRÉVIA — retomando o que você já tinha feito neste navegador. ' +
          '<b>Nada disso vai para a planilha do Drive.</b> ' +
          botaoRecomecar + 'Recomeçar do zero</button>';
      }
    }, 100);
  }
</script>
`;

const pagina = tela.replace(/<body[^>]*>/, function (tag) { return tag + simulador; });
if (pagina === tela) {
  throw new Error('não achei a tag <body> no Index.html: a prévia sairia sem o simulador.');
}
fs.writeFileSync(SAIDA, pagina);
console.log('Prévia gerada: ' + SAIDA);
console.log('Abra assim, para o navegador não servir uma versão antiga do cache:');
console.log('  open -a "Google Chrome" "file://' + SAIDA + '?v=' + Date.now() + '"');
console.log(grade.length - 3 + ' empresas da planilha' +
  (semear ? ' + os clientes do Goiás Fomento já cadastrados' : ''));
