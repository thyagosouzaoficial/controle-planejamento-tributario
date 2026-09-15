/**
 * Testa a TELA de verdade: abre a prévia no Chrome headless, clica nos botões,
 * digita nos campos e confere o que aconteceu na página.
 *
 * Precisa do Google Chrome instalado. Uso:
 *   node teste/teste-interface.js /tmp/controle.csv
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const RAIZ = path.join(__dirname, '..');
const CSV = process.argv[2];
const CHROME = process.env.CHROME ||
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

if (!fs.existsSync(CHROME)) {
  console.log('Chrome não encontrado em ' + CHROME + ' — defina a variável CHROME.');
  process.exit(2);
}

/* Gera uma prévia só para o teste — a do usuário, em previa.html, fica intacta
   (ela pode estar semeada com clientes, e regerar aqui apagaria isso). */
const PREVIA_DO_TESTE = path.join(require('os').tmpdir(), 'previa-para-teste.html');
execFileSync('node', [path.join(__dirname, 'previa.js'), CSV, PREVIA_DO_TESTE], { stdio: 'pipe' });

/** O roteiro roda dentro da página e deixa o resultado num elemento do DOM. */
const roteiro = `<script>
var resultado = [];
window.onerror = function (mensagem, arquivo, linha) {
  resultado.push('FALHA | erro na página: ' + mensagem + ' (linha ' + linha + ')');
  terminar();
};
function ok(nome, cond, detalhe) {
  resultado.push((cond ? 'OK   ' : 'FALHA') + ' | ' + nome + (detalhe ? ' → ' + detalhe : ''));
}
function terminar() {
  if (document.getElementById('resultado-teste')) return;
  var d = document.createElement('div');
  d.id = 'resultado-teste';
  d.textContent = resultado.join('\\n');
  document.body.appendChild(d);
}

/* Rede de segurança: se uma fase deixar de chamar a seguinte, o teste diz onde
   parou em vez de morrer calado. */
var faseCorrente = '(início)';
function entrando(nome) { faseCorrente = nome; }
setTimeout(function () {
  if (document.getElementById('resultado-teste')) return;
  resultado.push('FALHA | o roteiro parou em ' + faseCorrente +
    ', com ' + resultado.length + ' checagens feitas');
  terminar();
}, 40000);

setTimeout(function () {
  var totalAntes = dados.empresas.length;
  ok('painel carregou', totalAntes === 42, totalAntes + ' empresas');
  faseGraficos(totalAntes);
}, 900);

/* ---------- visão geral: os quatro gráficos ---------- */
function faseGraficos(totalAntes) {
  entrando('faseGraficos');
  ok('abre na visão geral',
    document.getElementById('secao-visao').classList.contains('ativa'));
  ok('a lista de empresas começa escondida',
    !document.getElementById('secao-empresas').classList.contains('ativa'));
  ok('a lateral marca a seção atual',
    document.getElementById('nav-visao').classList.contains('ativo'));
  ok('a lateral mostra o total de empresas',
    document.getElementById('contaLateral').textContent === String(totalAntes),
    document.getElementById('contaLateral').textContent);
  ok('há um cartão para cada serviço no topo',
    document.querySelectorAll('#resumoServicos .cartao').length >= (dados.servicos || []).length,
    document.querySelectorAll('#resumoServicos .cartao').length + ' cartões para ' +
    (dados.servicos || []).length + ' serviços');
  ok('os cartões somam a carteira inteira', (function () {
    var total = 0;
    document.querySelectorAll('#resumoServicos .cartao b').forEach(function (b) { total += +b.textContent; });
    return total === totalAntes;
  })(), document.getElementById('resumoServicos').textContent.slice(0, 60));

  ['graficoServicos', 'graficoFunil', 'graficoAndamento-0', 'graficoPrazo',
   'graficoParada', 'graficoCarga'].forEach(function (id) {
    var svg = document.querySelector('#' + id + ' svg');
    ok(id + ': desenhou o gráfico', !!svg);
    ok(id + ': cada barra tem rótulo e número',
      svg.querySelectorAll('.barra-rotulo').length === svg.querySelectorAll('.barra-valor').length &&
      svg.querySelectorAll('.barra-rotulo').length > 0,
      svg.querySelectorAll('.barra-rotulo').length + ' rótulos');
    ok(id + ': tem a versão em tabela',
      document.querySelectorAll('#' + id + ' .tabela-viz tbody tr').length ===
      svg.querySelectorAll('.barra-rotulo').length);
  });

  var abertas = dados.empresas.filter(function (e) {
    return e.status !== 'entregue' && e.status !== 'entregue_atraso';
  });

  function somar(id) {
    var total = 0;
    document.querySelectorAll('#' + id + ' .barra-valor').forEach(function (t) { total += +t.textContent; });
    return total;
  }
  ok('funil soma as empresas em andamento', somar('graficoFunil') === abertas.length,
    somar('graficoFunil') + ' vs ' + abertas.length);
  ok('situação do prazo soma as em andamento', somar('graficoPrazo') === abertas.length,
    somar('graficoPrazo') + ' vs ' + abertas.length);
  ok('tempo parado soma as em andamento', somar('graficoParada') === abertas.length,
    somar('graficoParada') + ' vs ' + abertas.length);
  ok('carga por responsável soma as em andamento', somar('graficoCarga') === abertas.length,
    somar('graficoCarga') + ' vs ' + abertas.length);

  /* empresas por serviço: conta a carteira inteira, não só as em andamento */
  ok('o gráfico de serviços soma a carteira inteira', somar('graficoServicos') === totalAntes,
    somar('graficoServicos') + ' vs ' + totalAntes);
  ok('e mostra as que ainda não têm serviço',
    document.querySelector('#graficoServicos .tabela-viz').textContent.indexOf('sem serviço') > 0,
    document.querySelector('#graficoServicos .tabela-viz').textContent.slice(0, 60));

  /* andamento por etapa: X de Y, com Y = quantas empresas precisam da etapa */
  var textos = [];
  document.querySelectorAll('#graficoAndamento-0 .barra-valor').forEach(function (t) {
    textos.push(t.textContent);
  });
  ok('o andamento traz concluídas e total em cada etapa',
    textos.length > 0 && textos.every(function (t) {
      return t.indexOf('/') > 0;
    }), textos.slice(0, 3).join(' '));
  ok('nunca mais concluídas do que aplicáveis',
    textos.every(function (t) {
      var p = t.split('/');
      return +p[0] <= +p[1];
    }), textos.join(' '));

  var somaAplicaveis = textos.reduce(function (total, t) { return total + (+t.split('/')[1]); }, 0);
  var esperadoAplicaveis = abertas.reduce(function (total, e) { return total + e.etapasAplicaveis; }, 0);
  ok('o total de cada etapa bate com as etapas que as empresas precisam',
    somaAplicaveis === esperadoAplicaveis, somaAplicaveis + ' vs ' + esperadoAplicaveis);

  var somaConcluidas = textos.reduce(function (total, t) { return total + (+t.split('/')[0]); }, 0);
  var esperadoConcluidas = abertas.reduce(function (total, e) {
    return total + e.etapas.filter(function (x) {
      return x.concluido && !x.foraDoServico && !x.naoSeAplica;
    }).length;
  }, 0);
  ok('e as concluídas batem com o que está marcado',
    somaConcluidas === esperadoConcluidas, somaConcluidas + ' vs ' + esperadoConcluidas);

  var barras = document.querySelectorAll('#graficoFunil .barra-marca');
  ok('só as etapas com empresas têm barra desenhada',
    barras.length === new Set(abertas.map(function (e) { return e.etapaAtualId; })).size,
    barras.length + ' barras');

  /* a dica de hover */
  var alvo = document.querySelector('#graficoFunil .barra-alvo');
  alvo.dispatchEvent(new MouseEvent('mousemove', { clientX: 300, clientY: 300, bubbles: true }));
  var dica = document.getElementById('dica');
  ok('passar o mouse mostra a dica', dica.classList.contains('visivel'), dica.textContent);
  alvo.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }));
  ok('tirar o mouse esconde a dica', !dica.classList.contains('visivel'));

  /* clicar numa barra leva para a lista já filtrada */
  var maiorValor = +document.querySelector('#graficoFunil .barra-valor').textContent;
  document.querySelector('#graficoFunil .barra-alvo').dispatchEvent(
    new MouseEvent('click', { bubbles: true }));

  ok('clicar no gráfico vai para a lista',
    document.getElementById('secao-empresas').classList.contains('ativa'));
  ok('e já filtrada por aquela etapa',
    document.querySelectorAll('#corpo tr').length === maiorValor,
    document.querySelectorAll('#corpo tr').length + ' vs ' + maiorValor);
  ok('mostrando o filtro que está valendo',
    document.querySelectorAll('#filtrosAtivos .chip').length >= 1,
    document.getElementById('filtrosAtivos').textContent);

  /* exportação: o botão precisa produzir um download de verdade */
  ok('o botão de exportar está no topo', !!document.getElementById('btnExportar'));
  var cliquesNoLink = [];
  var criarOriginal = document.createElement.bind(document);
  document.createElement = function (tag) {
    var el = criarOriginal(tag);
    if (tag === 'a') {
      el.click = function () { cliquesNoLink.push({ nome: el.download, href: el.href }); };
    }
    return el;
  };
  document.getElementById('btnExportar').click();

  document.querySelector('#filtrosAtivos .chip button').click();
  ok('dá para tirar o filtro pelo X',
    document.querySelectorAll('#corpo tr').length === totalAntes,
    document.querySelectorAll('#corpo tr').length + '');

  /* clicar numa etapa do andamento também filtra */
  irPara('visao');
  document.querySelectorAll('#graficoAndamento-0 .barra-alvo')[0].dispatchEvent(
    new MouseEvent('click', { bubbles: true }));
  ok('clicar no andamento leva para a lista daquela etapa',
    document.getElementById('secao-empresas').classList.contains('ativa') &&
    document.getElementById('filtrosAtivos').textContent.indexOf('Etapa') >= 0,
    document.getElementById('filtrosAtivos').textContent);
  limparFiltro('tudo');

  /* a exportação é assíncrona: confere depois de ela ter tempo de responder */
  setTimeout(function () {
    ok('exportar dispara o download de um .xlsx', cliquesNoLink.length === 1 &&
      /\.xlsx$/.test(cliquesNoLink[0].nome) && cliquesNoLink[0].href.indexOf('blob:') === 0,
      JSON.stringify(cliquesNoLink));
    ok('e o botão volta ao normal',
      document.getElementById('btnExportar').disabled === false &&
      document.getElementById('btnExportar').textContent === 'Exportar Excel',
      document.getElementById('btnExportar').textContent);
    document.createElement = criarOriginal;
    faseVisaoGeral(totalAntes);
  }, 600);
}

/* ---------- visão geral sem abrir nada ---------- */
function faseVisaoGeral(totalAntes) {
  entrando('faseVisaoGeral');
  irPara('empresas');
  var siglas = document.querySelectorAll('#thChecklist .trilha-topo span');
  var TOTAL_ETAPAS = (dados.etapas || []).length;
  ok('cabeçalho tem uma sigla por etapa', siglas.length === TOTAL_ETAPAS,
    siglas.length + ' de ' + TOTAL_ETAPAS);
  ok('a sigla do cabeçalho tem a mesma largura do marco',
    siglas[0].getBoundingClientRect().width ===
    document.querySelector('#corpo .marco').getBoundingClientRect().width,
    siglas[0].getBoundingClientRect().width + ' vs ' +
    document.querySelector('#corpo .marco').getBoundingClientRect().width);
  ok('primeira sigla alinhada com o primeiro marco',
    Math.abs(siglas[0].getBoundingClientRect().left -
             document.querySelector('#corpo .marco').getBoundingClientRect().left) < 1,
    'diferença de ' + Math.abs(siglas[0].getBoundingClientRect().left -
             document.querySelector('#corpo .marco').getBoundingClientRect().left) + 'px');
  ok('a legenda explica cada sigla do checklist',
    document.querySelectorAll('#guiaEtapas .item').length === TOTAL_ETAPAS,
    document.querySelectorAll('#guiaEtapas .item').length + ' itens');
  ok('a legenda casa com as siglas do cabeçalho', (function () {
    var naLegenda = [], noCabecalho = [];
    document.querySelectorAll('#guiaEtapas .item b').forEach(function (b) {
      naLegenda.push(b.textContent.split(' ')[1]);
    });
    document.querySelectorAll('#thChecklist .trilha-topo b').forEach(function (b) {
      noCabecalho.push(b.textContent);
    });
    return JSON.stringify(naLegenda) === JSON.stringify(noCabecalho);
  })());
  ok('cabeçalho traz o nome completo no título',
    siglas[0].getAttribute('title').indexOf('Solicitar documentação') > 0,
    siglas[0].getAttribute('title'));

  /* a posição N/12 de cada linha tem de bater com o dado */
  var errados = 0, comParada = 0;
  document.querySelectorAll('#corpo tr').forEach(function (tr) {
    var linha = +tr.getAttribute('onclick').match(/[0-9]+/)[0];
    var e = dados.empresas.filter(function (x) { return x.linha === linha; })[0];
    var posicao = tr.querySelector('.etapa-atual .posicao').textContent;
    if (posicao !== e.etapaAtualPosicao + '/' + TOTAL_ETAPAS) errados++;
    if (tr.querySelector('.parada')) comParada++;
  });
  ok('posição N/total correta em todas as linhas', errados === 0, errados + ' erradas');
  ok('empresas em andamento mostram há quanto tempo pararam', comParada > 0, comParada + ' linhas');

  /* filtro das paradas */
  var cartaoParadas = null;
  document.querySelectorAll('#resumo .cartao').forEach(function (c) {
    if (c.textContent.indexOf('Paradas') > 0) cartaoParadas = c;
  });
  ok('cartão de paradas existe', !!cartaoParadas, cartaoParadas ? cartaoParadas.textContent : '');
  var esperado = dados.empresas.filter(function (e) {
    return e.status !== 'entregue' && e.status !== 'entregue_atraso' &&
      (e.diasParada === null || e.diasParada > 30);
  }).length;
  cartaoParadas.click();
  ok('filtro de paradas mostra só as paradas',
    document.querySelectorAll('#corpo tr').length === esperado,
    document.querySelectorAll('#corpo tr').length + ' vs ' + esperado);
  cartaoParadas.click();
  ok('clicar de novo volta a lista inteira',
    document.querySelectorAll('#corpo tr').length === totalAntes);

  /* ordenação por tempo parado */
  document.getElementById('ordem').value = 'parada';
  desenhar();
  var anterior = Infinity, foraDeOrdem = 0;
  document.querySelectorAll('#corpo tr').forEach(function (tr) {
    var linha = +tr.getAttribute('onclick').match(/[0-9]+/)[0];
    var e = dados.empresas.filter(function (x) { return x.linha === linha; })[0];
    var dias = e.diasParada === null ? 1e6 : e.diasParada;
    if (dias > anterior) foraDeOrdem++;
    anterior = dias;
  });
  ok('ordena da mais parada para a menos', foraDeOrdem === 0, foraDeOrdem + ' fora de ordem');

  /* classificar clicando no cabeçalho */
  document.getElementById('th-nome').click();
  var nomes = [];
  document.querySelectorAll('#corpo .nome-empresa').forEach(function (el) { nomes.push(el.textContent); });
  var ordenados = nomes.slice().sort(function (a, b) { return a.localeCompare(b, 'pt-BR'); });
  ok('clicar em Empresa classifica de A a Z', JSON.stringify(nomes) === JSON.stringify(ordenados),
    nomes.slice(0, 2).join(' | '));
  ok('a seta aparece no cabeçalho clicado',
    document.getElementById('th-nome').querySelector('.seta').textContent === '▲');

  document.getElementById('th-nome').click();
  var invertidos = [];
  document.querySelectorAll('#corpo .nome-empresa').forEach(function (el) { invertidos.push(el.textContent); });
  ok('clicar de novo inverte', JSON.stringify(invertidos) === JSON.stringify(ordenados.reverse()),
    invertidos[0]);
  ok('a seta vira para baixo',
    document.getElementById('th-nome').querySelector('.seta').textContent === '▼');

  document.getElementById('th-numero').click();
  var numeros = [];
  document.querySelectorAll('#corpo .col-num').forEach(function (el) { numeros.push(+el.textContent || 0); });
  var crescente = true;
  for (var n = 1; n < numeros.length; n++) if (numeros[n] < numeros[n - 1]) crescente = false;
  ok('clicar em Nº classifica pelo número', crescente, numeros.slice(0, 5).join(','));
  ok('a seta saiu da coluna Empresa', !document.getElementById('th-nome').querySelector('.seta'));

  document.getElementById('ordem').value = 'prazo';
  ordemDesc = false;
  desenhar();

  faseChecklist(totalAntes);
}

/* ---------- o checklist das 12 etapas na tela principal ---------- */
function faseChecklist(totalAntes) {
  entrando('faseChecklist');
  var trilhas = document.querySelectorAll('#corpo .trilha');
  ok('toda empresa tem a trilha na lista', trilhas.length === totalAntes, trilhas.length + ' trilhas');
  ok('a trilha tem um marco por etapa',
    trilhas[0].querySelectorAll('.marco').length === (dados.etapas || []).length,
    trilhas[0].querySelectorAll('.marco').length + ' marcos');

  /* os marcos verdes de cada linha têm de bater com as etapas concluídas no dado */
  var ordemNaTela = [];
  document.querySelectorAll('#corpo tr').forEach(function (tr) {
    var linha = +tr.getAttribute('onclick').match(/[0-9]+/)[0];
    ordemNaTela.push(dados.empresas.filter(function (x) { return x.linha === linha; })[0]);
  });
  var divergentes = 0;
  document.querySelectorAll('#corpo .trilha').forEach(function (t, i) {
    var feitos = t.querySelectorAll('.marco.feito').length;
    var concluidas = ordemNaTela[i].etapas.filter(function (et) { return et.concluido; }).length;
    if (feitos !== concluidas) divergentes++;
  });
  ok('marcos verdes batem com as etapas concluídas', divergentes === 0, divergentes + ' linhas divergentes');

  /* escolhe uma empresa cuja etapa pendente não seja a de documentos */
  var alvo = null, indice = -1;
  ordemNaTela.forEach(function (e, i) {
    if (alvo) return;
    var pendente = e.etapas.filter(function (et) { return !et.concluido; })[0];
    if (pendente && pendente.id !== 'documentacao') { alvo = e; indice = i; }
  });
  ok('achou empresa para marcar da lista', !!alvo, alvo ? alvo.nome : 'nenhuma');

  var trilha = document.querySelectorAll('#corpo .trilha')[indice];
  var pendente = alvo.etapas.filter(function (et) { return !et.concluido; })[0];
  var posicao = alvo.etapas.map(function (et) { return et.id; }).indexOf(pendente.id);
  var marco = trilha.querySelectorAll('.marco')[posicao];
  ok('a etapa pendente está destacada', marco.classList.contains('atual'), marco.className);
  ok('o marco pendente não está verde', !marco.classList.contains('feito'));

  var feitosAntes = trilha.querySelectorAll('.marco.feito').length;
  marco.click();

  setTimeout(function () {
    ok('clicar no marco não abriu a ficha',
      !document.getElementById('gaveta').classList.contains('aberta'));
    var atualizada = dados.empresas.filter(function (x) { return x.linha === alvo.linha; })[0];
    ok('etapa ficou concluída no dado',
      atualizada.etapas.filter(function (et) { return et.id === pendente.id; })[0].concluido === true);
    var trilhaNova = document.querySelectorAll('#corpo .trilha')[indice];
    ok('mais um marco verde na tela',
      trilhaNova.querySelectorAll('.marco.feito').length === feitosAntes + 1,
      trilhaNova.querySelectorAll('.marco.feito').length + ' vs ' + (feitosAntes + 1));
    ok('percentual da linha subiu',
      trilhaNova.querySelector('.pct').textContent === Math.round(atualizada.progresso * 100) + '%',
      trilhaNova.querySelector('.pct').textContent);
    ok('avisou que salvou', document.getElementById('aviso').textContent.indexOf('Salvo') === 0,
      document.getElementById('aviso').textContent);

    /* clicar de novo desmarca */
    trilhaNova.querySelectorAll('.marco')[posicao].click();
    setTimeout(function () {
      var revertida = dados.empresas.filter(function (x) { return x.linha === alvo.linha; })[0];
      ok('clicar de novo desmarca',
        revertida.etapas.filter(function (et) { return et.id === pendente.id; })[0].concluido === false);

      /* o marco 1 abre a ficha nos documentos, não marca os 10 de uma vez */
      var docsAntes = JSON.stringify(revertida.etapas[0].documentos);
      document.querySelectorAll('#corpo .trilha')[indice].querySelectorAll('.marco')[0].click();
      setTimeout(function () {
        ok('marco dos documentos abre a ficha',
          document.getElementById('gaveta').classList.contains('aberta'));
        ok('e já com a lista de documentos aberta',
          document.getElementById('etapa-documentacao').classList.contains('expandida'));
        var agora = dados.empresas.filter(function (x) { return x.linha === alvo.linha; })[0];
        ok('não marcou os 10 documentos sozinho',
          JSON.stringify(agora.etapas[0].documentos) === docsAntes);
        fecharGaveta();
        faseNaoAplica(totalAntes, alvo.linha);
      }, 300);
    }, 400);
  }, 400);
}

/* ---------- etapas que não se aplicam ---------- */
function faseNaoAplica(totalAntes, linha) {
  entrando('faseNaoAplica');
  abrirEmpresa(linha);
  var antes = dados.empresas.filter(function (x) { return x.linha === linha; })[0];
  var pctAntes = Math.round(antes.progresso * 100);

  ok('a ficha diz sobre quantas etapas é a conta',
    document.querySelector('#gavetaConteudo .sub').textContent.indexOf('que se aplicam') > 0,
    document.querySelector('#gavetaConteudo .sub').textContent);

  /* escolhe uma etapa pendente que não seja a de documentos */
  var alvo = antes.etapas.filter(function (et) {
    return !et.concluido && !et.documentos && !et.naoSeAplica;
  })[0];
  ok('achou etapa para marcar como não se aplica', !!alvo, alvo ? alvo.nome : 'nenhuma');

  var botao = document.querySelector('#etapa-' + alvo.id + ' .btn-na');
  ok('a etapa tem o botão n/a', !!botao);
  botao.click();

  setTimeout(function () {
    var agora = dados.empresas.filter(function (x) { return x.linha === linha; })[0];
    var etapa = agora.etapas.filter(function (x) { return x.id === alvo.id; })[0];
    ok('etapa ficou marcada como não se aplica', etapa.naoSeAplica === true);
    ok('uma etapa a menos na conta', agora.etapasAplicaveis === antes.etapasAplicaveis - 1,
      agora.etapasAplicaveis + ' vs ' + (antes.etapasAplicaveis - 1));
    ok('o percentual é recalculado sobre menos etapas',
      Math.abs(agora.progresso - antes.progresso) > 0.0001 || antes.progresso === 0,
      antes.progresso.toFixed(4) + ' → ' + agora.progresso.toFixed(4));
    ok('a ficha marca a etapa visualmente',
      document.getElementById('etapa-' + alvo.id).classList.contains('na'));
    ok('com a etiqueta explicando',
      !!document.querySelector('#etapa-' + alvo.id + ' .etiqueta-na'));
    ok('a ficha diz quantas ficaram fora',
      document.querySelector('#gavetaConteudo .sub').textContent.indexOf('fora da conta') > 0,
      document.querySelector('#gavetaConteudo .sub').textContent);

    fecharGaveta();
    var linhaNaTela = null;
    document.querySelectorAll('#corpo tr').forEach(function (tr) {
      if (+tr.getAttribute('onclick').match(/[0-9]+/)[0] === linha) linhaNaTela = tr;
    });
    var marco = linhaNaTela.querySelectorAll('.marco')[alvo.posicao - 1];
    ok('o marco na lista mostra que não se aplica', marco.classList.contains('na'),
      marco.className);
    ok('e deixa de ser a etapa da vez', !marco.classList.contains('atual'), marco.className);
    ok('o destaque passou para a próxima que se aplica', (function () {
      var proxima = agora.etapas.filter(function (x) {
        return !x.concluido && !x.naoSeAplica;
      })[0];
      var marcado = linhaNaTela.querySelectorAll('.marco.atual');
      return marcado.length === 1 &&
        marcado[0] === linhaNaTela.querySelectorAll('.marco')[proxima.posicao - 1];
    })());
    ok('e a dica explica', marco.getAttribute('title').indexOf('NÃO SE APLICA') > 0,
      marco.getAttribute('title'));

    /* devolver para a conta */
    abrirEmpresa(linha);
    document.querySelector('#etapa-' + alvo.id + ' .btn-na').click();
    setTimeout(function () {
      var devolvida = dados.empresas.filter(function (x) { return x.linha === linha; })[0];
      ok('devolver traz a etapa de volta à conta',
        devolvida.etapasAplicaveis === antes.etapasAplicaveis,
        devolvida.etapasAplicaveis + '');
      ok('e o percentual volta ao que era',
        Math.abs(devolvida.progresso - antes.progresso) < 0.0001,
        devolvida.progresso.toFixed(4) + ' vs ' + antes.progresso.toFixed(4));
      fecharGaveta();
      faseCNPJ(totalAntes);
    }, 400);
  }, 400);
}

/* ---------- CNPJ no painel ---------- */
function faseCNPJ(totalAntes) {
  entrando('faseCNPJ');
  ok('toda linha mostra o campo de CNPJ',
    document.querySelectorAll('#corpo .cnpj').length === totalAntes,
    document.querySelectorAll('#corpo .cnpj').length + ' linhas');

  var alvo = dados.empresas.filter(function (e) {
    return e.cnpjSugerido && e.cnpjSugerido.length === 1;
  })[0];
  ok('achou empresa com CNPJ garimpado da observação', !!alvo, alvo ? alvo.nome : 'nenhuma');
  var esperado = alvo.cnpjSugerido[0].formatado;

  abrirEmpresa(alvo.linha);
  ok('ficha tem o campo de CNPJ', !!document.getElementById('campoCNPJ'));
  var botaoSugestao = document.querySelector('.sugestao button');
  ok('ficha oferece o CNPJ achado na observação', !!botaoSugestao,
    botaoSugestao ? botaoSugestao.textContent : 'sem sugestão');
  botaoSugestao.click();

  setTimeout(function () {
    var atualizada = dados.empresas.filter(function (x) { return x.linha === alvo.linha; })[0];
    ok('CNPJ gravado', atualizada.cnpjs.length === 1 &&
      atualizada.cnpjs[0].formatado === esperado, JSON.stringify(atualizada.cnpjs));
    fecharGaveta();

    var linhaNaTela = null;
    document.querySelectorAll('#corpo tr').forEach(function (tr) {
      if (+tr.getAttribute('onclick').match(/[0-9]+/)[0] === alvo.linha) linhaNaTela = tr;
    });
    ok('CNPJ aparece na lista', linhaNaTela.querySelector('.cnpj').textContent === esperado,
      linhaNaTela.querySelector('.cnpj').textContent);

    var busca = document.getElementById('busca');
    busca.value = esperado.replace(/[^0-9]/g, '');
    desenhar();
    ok('busca acha pelo CNPJ sem pontuação',
      document.querySelectorAll('#corpo tr').length === 1,
      document.querySelectorAll('#corpo tr').length + ' linhas');
    busca.value = esperado;
    desenhar();
    ok('busca acha pelo CNPJ com pontuação',
      document.querySelectorAll('#corpo tr').length === 1);
    busca.value = '';
    desenhar();
    ok('limpar a busca traz todos', document.querySelectorAll('#corpo tr').length === totalAntes);

    faseServico(totalAntes);
  }, 400);
}

/* ---------- serviço contratado ---------- */
function faseServico(totalAntes) {
  entrando('faseServico');
  ok('a tabela tem a coluna de serviço', !!document.getElementById('th-servico'));
  ok('toda linha mostra o serviço ou a falta dele',
    document.querySelectorAll('#corpo .etiqueta, #corpo .servico-vazio').length === totalAntes,
    document.querySelectorAll('#corpo .etiqueta, #corpo .servico-vazio').length + ' linhas');
  ok('o filtro de serviços foi preenchido',
    document.getElementById('filtroServico').options.length === (dados.servicos || []).length + 1,
    document.getElementById('filtroServico').options.length + ' opções');
  ok('avisa que há empresas sem serviço',
    !!document.querySelector('#avisoServico .aviso-faixa'),
    document.getElementById('avisoServico').textContent.trim().slice(0, 50));

  /* definir o serviço de uma empresa pela ficha — uma que esteja em andamento,
     para o quadro de andamento daquele serviço ter o que mostrar */
  var alvo = dados.empresas.filter(function (e) {
    return e.status !== 'entregue' && e.status !== 'entregue_atraso';
  })[0];
  ok('achou empresa em andamento para mudar de serviço', !!alvo, alvo && alvo.nome);
  abrirEmpresa(alvo.linha);
  var seletor = null;
  document.querySelectorAll('#gavetaConteudo .campo').forEach(function (c) {
    if (c.textContent.indexOf('Serviço contratado') === 0) seletor = c.querySelector('select');
  });
  ok('a ficha tem o campo de serviço', !!seletor);
  ok('com a opção de criar um novo',
    !!seletor && seletor.querySelector('option[value="__novo"]'));
  seletor.value = 'Auditoria';
  seletor.dispatchEvent(new Event('change'));

  setTimeout(function () {
    var atual = dados.empresas.filter(function (x) { return x.linha === alvo.linha; })[0];
    ok('serviço gravado na empresa', atual.servico === 'Auditoria', atual.servico);
    fecharGaveta();

    /* preencher o resto em massa */
    window.confirm = function () { return true; };
    var faltavam = dados.empresas.filter(function (e) { return !e.servico; }).length;
    document.getElementById('servicoEmMassa').value = 'Planejamento Tributário';
    document.querySelector('#avisoServico .btn').click();

    setTimeout(function () {
      ok('ninguém ficou sem serviço',
        dados.empresas.every(function (e) { return !!e.servico; }),
        dados.empresas.filter(function (e) { return !e.servico; }).length + ' sem');
      ok('o preenchimento em massa não mexeu em quem já tinha',
        dados.empresas.filter(function (x) { return x.linha === alvo.linha; })[0].servico === 'Auditoria');
      ok('o aviso some quando não falta ninguém',
        !document.querySelector('#avisoServico .aviso-faixa'));
      console.log('    (' + faltavam + ' empresas marcadas de uma vez)');

      /* filtrar por serviço afeta lista e gráficos */
      var seletorFiltro = document.getElementById('filtroServico');
      seletorFiltro.value = 'Auditoria';
      seletorFiltro.dispatchEvent(new Event('change'));
      ok('filtrar por serviço reduz a lista',
        document.querySelectorAll('#corpo tr').length === 1,
        document.querySelectorAll('#corpo tr').length + ' linhas');
      ok('o chip do filtro de serviço aparece',
        document.getElementById('filtrosAtivos').textContent.indexOf('Auditoria') > 0,
        document.getElementById('filtrosAtivos').textContent);

      irPara('visao');
      var cartaoAuditoria = null;
      document.querySelectorAll('#resumoServicos .cartao').forEach(function (c) {
        if (c.textContent.indexOf('Auditoria') > 0) cartaoAuditoria = c;
      });
      ok('o cartão do serviço mostra a contagem certa',
        !!cartaoAuditoria && cartaoAuditoria.querySelector('b').textContent === '1',
        cartaoAuditoria ? cartaoAuditoria.textContent : 'sem cartão');
      ok('e marca que está filtrado', cartaoAuditoria.classList.contains('ativo'));
      ok('com o filtro por serviço, só aquele serviço tem quadro de andamento',
        document.querySelectorAll('#andamentoPorServico .cartao-viz').length === 1,
        document.querySelectorAll('#andamentoPorServico .cartao-viz').length + ' quadros');
      ok('e o quadro diz de que serviço é',
        document.querySelector('#andamentoPorServico h2').textContent.indexOf('Auditoria') > 0,
        document.querySelector('#andamentoPorServico h2').textContent);

      var somaFunil = 0;
      document.querySelectorAll('#graficoFunil .barra-valor').forEach(function (t) { somaFunil += +t.textContent; });
      var esperado = dados.empresas.filter(function (e) {
        return e.servico === 'Auditoria' && e.status !== 'entregue' && e.status !== 'entregue_atraso';
      }).length;
      ok('os gráficos também respeitam o serviço', somaFunil === esperado,
        somaFunil + ' vs ' + esperado);
      ok('quem não tem etapa a cumprir aparece no funil, não some',
        document.querySelector('#graficoFunil .tabela-viz').textContent
          .indexOf('sem etapa a cumprir') > 0,
        document.querySelector('#graficoFunil .tabela-viz').textContent.slice(-60));
      ok('os indicadores também',
        +document.querySelector('#resumo .cartao b').textContent === 1,
        document.querySelector('#resumo .cartao b').textContent);

      limparFiltro('servico');
      irPara('visao');
      var comEmpresas = (dados.servicos || []).filter(function (nome) {
        return dados.empresas.some(function (e) {
          return e.servico === nome && e.status !== 'entregue' && e.status !== 'entregue_atraso';
        });
      }).length;
      ok('sem filtro, há um quadro de andamento por serviço com empresas',
        document.querySelectorAll('#andamentoPorServico .cartao-viz').length === comEmpresas,
        document.querySelectorAll('#andamentoPorServico .cartao-viz').length + ' quadros para ' +
        comEmpresas + ' serviços em andamento');
      ok('cada quadro mostra as etapas do serviço, ou avisa que não há nenhuma',
        Array.prototype.slice.call(document.querySelectorAll('#andamentoPorServico .cartao-viz'))
          .every(function (c) {
            return c.querySelectorAll('.barra-rotulo').length > 0 ||
              c.textContent.indexOf('Nenhuma etapa foi marcada') > 0;
          }),
        document.querySelectorAll('#andamentoPorServico .cartao-viz').length + ' quadros');

      irPara('empresas');
      ok('tirar o filtro traz todas de volta',
        document.querySelectorAll('#corpo tr').length === totalAntes,
        document.querySelectorAll('#corpo tr').length + '');

      faseDivisaoPorServico(totalAntes);
    }, 600);
  }, 500);
}

/* ---------- um checklist só, dividido por serviço ---------- */
function faseDivisaoPorServico(totalAntes) {
  entrando('faseDivisaoPorServico');
  var deAuditoria = dados.empresas.filter(function (e) { return e.servico === 'Auditoria'; })[0];
  var dePlanejamento = dados.empresas.filter(function (e) {
    return e.servico === 'Planejamento Tributário';
  })[0];
  ok('há empresa de cada serviço para comparar', !!deAuditoria && !!dePlanejamento);

  var total = (dados.etapas || []).length;
  var doPlanejamento = (dados.etapas || []).filter(function (e) {
    return e.servicos.indexOf('Planejamento Tributário') >= 0;
  }).length;
  var comuns = (dados.etapas || []).filter(function (e) { return !e.servicos.length; }).length;

  ok('o checklist já nasce dividido pelos fluxos de cada serviço',
    doPlanejamento > 0 && doPlanejamento < total,
    doPlanejamento + ' de ' + total + ' são do planejamento');
  ok('empresa de planejamento conta só as etapas dela',
    dePlanejamento.etapasAplicaveis === doPlanejamento + comuns,
    dePlanejamento.etapasAplicaveis + ' vs ' + (doPlanejamento + comuns));
  ok('as etapas de outro serviço aparecem marcadas como tal',
    dePlanejamento.etapas.filter(function (e) { return e.foraDoServico; }).length ===
      total - doPlanejamento - comuns,
    dePlanejamento.etapas.filter(function (e) { return e.foraDoServico; }).length + '');

  var aplicaveisAntes = deAuditoria.etapasAplicaveis;

  abrirEtapas();
  var colunas = document.querySelectorAll('.matriz thead th');
  ok('a matriz tem uma coluna por serviço, mais "Todos"',
    colunas.length === (dados.servicos || []).length + 3,
    colunas.length + ' colunas para ' + (dados.servicos || []).length + ' serviços');
  var linhasSemMarca = 0;
  document.querySelectorAll('.matriz tbody tr').forEach(function (tr) {
    if (!tr.querySelectorAll('td.marca input:checked').length) linhasSemMarca++;
  });
  ok('toda etapa da matriz está marcada em algum lugar', linhasSemMarca === 0,
    linhasSemMarca + ' etapas sem marca nenhuma');
  ok('o cabeçalho conta as etapas de cada serviço',
    colunas[2].querySelector('small').textContent.slice(-7) === ' etapas' &&
    parseInt(colunas[2].querySelector('small').textContent, 10) > 0,
    colunas[2].querySelector('small').textContent);

  /* a mesma etapa passando a servir dois serviços — o caso que motivou a matriz */
  var indiceAuditoria = (dados.servicos || []).indexOf('Auditoria');
  var caixas = document.querySelectorAll('#config-dre td.marca input');
  ok('a linha da etapa tem uma caixa por serviço',
    caixas.length === (dados.servicos || []).length + 1, caixas.length + ' caixas');
  ok('a etapa começa só no planejamento',
    caixas[(dados.servicos || []).indexOf('Planejamento Tributário') + 1].checked === true &&
    caixas[indiceAuditoria + 1].checked === false);

  caixas[indiceAuditoria + 1].checked = true;
  caixas[indiceAuditoria + 1].dispatchEvent(new Event('change'));

  setTimeout(function () {
    var etapa = (dados.etapas || []).filter(function (e) { return e.id === 'dre'; })[0];
    ok('a mesma etapa passou a servir dois serviços',
      etapa.servicos.length === 2 &&
      etapa.servicos.indexOf('Planejamento Tributário') >= 0 &&
      etapa.servicos.indexOf('Auditoria') >= 0,
      etapa.servicos.join(' + '));
    ok('as duas caixas ficam marcadas',
      document.querySelectorAll('#config-dre td.marca input')[indiceAuditoria + 1].checked);
    ok('"Todos" continua desmarcado',
      document.querySelectorAll('#config-dre td.marca input')[0].checked === false);

    fecharGaveta();
    irPara('empresas');

    var auditoria = dados.empresas.filter(function (x) { return x.linha === deAuditoria.linha; })[0];
    ok('a empresa de Auditoria passou a contar a etapa',
      auditoria.etapasAplicaveis === aplicaveisAntes + 1,
      auditoria.etapasAplicaveis + ' vs ' + (aplicaveisAntes + 1));
    ok('sem tirar de quem já tinha',
      dados.empresas.filter(function (x) { return x.linha === dePlanejamento.linha; })[0]
        .etapas.filter(function (y) { return y.id === 'dre'; })[0].doServico === true);

    /* com um serviço escolhido, a tabela mostra só o checklist dele */
    var seletor = document.getElementById('filtroServico');
    seletor.value = 'Auditoria';
    seletor.dispatchEvent(new Event('change'));

    var daAuditoria = (dados.etapas || []).filter(function (e) {
      return !e.servicos.length || e.servicos.indexOf('Auditoria') >= 0;
    }).length;
    ok('o cabeçalho encolhe para as etapas do serviço',
      document.querySelectorAll('#thChecklist .trilha-topo span').length === daAuditoria,
      document.querySelectorAll('#thChecklist .trilha-topo span').length + ' de ' + total);
    ok('a legenda acompanha',
      document.querySelectorAll('#guiaEtapas .item').length === daAuditoria);
    ok('a legenda diz de que serviço é',
      document.querySelector('#guiaEtapas .rotulo').textContent.indexOf('Auditoria') > 0,
      document.querySelector('#guiaEtapas .rotulo').textContent);
    ok('e as trilhas encolhem junto — cabeçalho e marcos sempre iguais',
      document.querySelector('#corpo .trilha').querySelectorAll('.marco').length === daAuditoria,
      document.querySelector('#corpo .trilha').querySelectorAll('.marco').length + '');

    var outroServico = (dados.servicos || []).filter(function (n) {
      return n.indexOf('Fomento') >= 0;
    })[0];
    seletor.value = outroServico;
    seletor.dispatchEvent(new Event('change'));
    var doFomento = (dados.etapas || []).filter(function (e) {
      return !e.servicos.length || e.servicos.indexOf(outroServico) >= 0;
    }).length;
    ok('outro serviço, outro checklist',
      document.querySelectorAll('#thChecklist .trilha-topo span').length === doFomento,
      doFomento + ' etapas em ' + outroServico);
    ok('e o fluxo dele começa pela etapa daquele caminho',
      document.querySelectorAll('#guiaEtapas .item')[0].textContent.indexOf('Contato com o cliente') > 0,
      document.querySelectorAll('#guiaEtapas .item')[0].textContent);

    limparFiltro('servico');
    ok('sem filtro, o checklist inteiro volta',
      document.querySelectorAll('#thChecklist .trilha-topo span').length === total);

    /* marcar uma coluna inteira */
    abrirEtapas();
    document.querySelectorAll('.matriz thead th button')[indiceAuditoria].click();

    setTimeout(function () {
      ok('clicar no cabeçalho põe o serviço em todas as etapas',
        (dados.etapas || []).every(function (e) { return e.servicos.indexOf('Auditoria') >= 0; }),
        (dados.etapas || []).filter(function (e) { return e.servicos.indexOf('Auditoria') < 0; }).length + ' fora');

      document.querySelectorAll('.matriz thead th button')[indiceAuditoria].click();
      setTimeout(function () {
        ok('clicar de novo tira o serviço de todas',
          (dados.etapas || []).every(function (e) { return e.servicos.indexOf('Auditoria') < 0; }));
        ok('e as etapas que ficaram sem serviço nenhum voltam a valer para todos',
          (dados.etapas || []).filter(function (e) { return e.id === 'dre'; })[0]
            .servicos.indexOf('Planejamento Tributário') >= 0);
        fecharGaveta();
        faseCamposDeServico(totalAntes);
      }, 700);
    }, 800);
  }, 600);
}

/* ---------- campos próprios de cada serviço ---------- */
function faseCamposDeServico(totalAntes) {
  entrando('faseCamposDeServico');
  abrirCampos();
  var cadastrados = (dados.camposDeServico || []).length;
  ok('a tela de campos lista os cadastrados',
    document.querySelectorAll('.matriz tbody tr').length === cadastrados,
    document.querySelectorAll('.matriz tbody tr').length + ' de ' + cadastrados);
  ok('os campos do fomento vieram prontos',
    (dados.camposDeServico || []).some(function (c) {
      return c.rotulo === 'Data da ligação de oferta' && (c.servicos || []).length === 3;
    }),
    (dados.camposDeServico || []).map(function (c) { return c.rotulo; }).join(', '));
  ok('a lista de opções aparece no cadastro',
    document.querySelector('.matriz tbody').textContent.indexOf('Interessado') > 0);

  document.getElementById('novoCampoRotulo').value = 'Número do protocolo';
  document.getElementById('novoCampoServico').value = 'Goiás Fomento';
  document.querySelector('#gavetaConteudo .btn-primario').click();

  setTimeout(function () {
    ok('campo novo entrou na lista',
      (dados.camposDeServico || []).length === cadastrados + 1,
      (dados.camposDeServico || []).length + '');
    fecharGaveta();

    /* uma empresa de Goiás Fomento para preencher */
    var alvo = dados.empresas[3];
    irPara('empresas');
    abrirEmpresa(alvo.linha);
    var seletor = null;
    document.querySelectorAll('#gavetaConteudo .campo').forEach(function (c) {
      if (c.textContent.indexOf('Serviço contratado') === 0) seletor = c.querySelector('select');
    });
    seletor.value = (dados.servicos || []).filter(function (n) {
      return n.indexOf('Fomento') >= 0;
    })[0];
    seletor.dispatchEvent(new Event('change'));

    setTimeout(function () {
      var blocos = [];
      document.querySelectorAll('#gavetaConteudo .bloco h3').forEach(function (h) {
        blocos.push(h.textContent);
      });
      ok('a ficha ganhou o bloco do serviço',
        blocos.some(function (b) { return b.indexOf('Fomento') > 0; }), blocos.join(' | '));

      var servicoDaFicha = (dados.servicos || []).filter(function (n) {
        return n.indexOf('Fomento') >= 0;
      })[0];
      var doServico = (dados.camposDeServico || []).filter(function (c) {
        var lista = c.servicos || [];
        return !lista.length || lista.indexOf(servicoDaFicha) >= 0;
      }).length;
      var bloco = null;
      document.querySelectorAll('#gavetaConteudo .bloco').forEach(function (b) {
        if (b.querySelector('h3').textContent.indexOf('Goiás Fomento') > 0) bloco = b;
      });
      ok('com um controle por campo do serviço',
        bloco.querySelectorAll('.campo').length === doServico,
        bloco.querySelectorAll('.campo').length + ' de ' + doServico);
      ok('a data da ligação é um campo de data',
        !!bloco.querySelector('input[type=date]'));
      ok('o resultado do contato é uma lista',
        bloco.querySelectorAll('select').length >= 1);
      ok('a observação do contato é um campo grande',
        !!bloco.querySelector('textarea'));

      /* preencher a ligação */
      var data = bloco.querySelector('input[type=date]');
      data.value = '2026-09-01';
      data.dispatchEvent(new Event('change'));

      setTimeout(function () {
        var empresa = dados.empresas.filter(function (x) { return x.linha === alvo.linha; })[0];
        var campoData = empresa.campos.filter(function (c) {
          return c.rotulo === 'Data da ligação de oferta';
        })[0];
        ok('a data da ligação foi gravada', campoData.valor === '2026-09-01', campoData.valor);

        var lista = null;
        bloco = null;
        document.querySelectorAll('#gavetaConteudo .bloco').forEach(function (b) {
          if (b.querySelector('h3').textContent.indexOf('Goiás Fomento') > 0) bloco = b;
        });
        bloco.querySelectorAll('.campo').forEach(function (c) {
          if (c.textContent.indexOf('Resultado do contato') === 0) lista = c.querySelector('select');
        });
        lista.value = 'Interessado';
        lista.dispatchEvent(new Event('change'));

        setTimeout(function () {
          var atual = dados.empresas.filter(function (x) { return x.linha === alvo.linha; })[0];
          ok('o resultado do contato foi gravado',
            atual.campos.filter(function (c) { return c.rotulo === 'Resultado do contato'; })[0]
              .valor === 'Interessado');
          ok('e as etapas do checklist continuam ali',
            document.querySelectorAll('#gavetaConteudo .etapa').length === (dados.etapas || []).length,
            document.querySelectorAll('#gavetaConteudo .etapa').length + ' etapas');
          fecharGaveta();

          /* empresa de outro serviço não vê esses campos */
          var outra = dados.empresas.filter(function (e) {
            return e.servico === 'Planejamento Tributário';
          })[0];
          abrirEmpresa(outra.linha);
          var titulos = [];
          document.querySelectorAll('#gavetaConteudo .bloco h3').forEach(function (h) {
            titulos.push(h.textContent);
          });
          ok('empresa de outro serviço não vê os campos do Goiás Fomento',
            titulos.indexOf('Informações de Goiás Fomento') < 0, titulos.join(' | '));
          fecharGaveta();
          faseImportacao(totalAntes);
        }, 450);
      }, 450);
    }, 450);
  }, 600);
}

/* ---------- importar a lista de clientes ---------- */
function faseImportacao(totalAntes) {
  entrando('faseImportacao');
  var antesDeImportar = dados.empresas.length;
  /* uma empresa já foi posta em Goiás Fomento na fase anterior: guardo quem
     era, para contar só o que a importação trouxe */
  var servicoAlvo = (dados.servicos || []).filter(function (n) {
    return n.indexOf('Fomento') >= 0;
  })[0];
  var fomentoAntes = dados.empresas
    .filter(function (e) { return e.servico === servicoAlvo; })
    .map(function (e) { return e.nome; });
  abrirImportacao();
  ok('a tela de importação abriu', !!document.getElementById('textoImportacao'));
  var servicoDoFomento = (dados.servicos || []).filter(function (n) {
    return n.indexOf('Fomento') >= 0;
  })[0];
  document.getElementById('servicoImportacao').value = servicoDoFomento;
  ok('há um serviço de fomento para importar', !!servicoDoFomento, servicoDoFomento);
  ok('o botão de cadastrar começa travado',
    document.getElementById('btnImportar').disabled === true);

  document.getElementById('textoImportacao').value = LISTA_DE_EXEMPLO;
  var botaoConferir = null;
  document.querySelectorAll('#gavetaConteudo button').forEach(function (b) {
    if (b.textContent === 'Conferir') botaoConferir = b;
  });
  ok('o botão de conferir existe', !!botaoConferir);
  botaoConferir.click();

  setTimeout(function () {
    var naLista = document.querySelectorAll('#previaImportacao .matriz tbody tr').length;
    ok('a conferência lista os clientes do texto colado', naLista >= 3, naLista + ' linhas');
    var cnpjNaTela = document.querySelector('#previaImportacao .cnpj').textContent;
    ok('mostra o CNPJ formatado',
      cnpjNaTela.length === 18 && cnpjNaTela.charAt(2) === '.' &&
      cnpjNaTela.charAt(10) === '/' && cnpjNaTela.charAt(15) === '-',
      cnpjNaTela);
    ok('mostra o que veio junto',
      document.querySelector('#previaImportacao tbody').textContent.indexOf('Município') > 0,
      document.querySelector('#previaImportacao tbody').textContent.slice(0, 90));
    ok('conferir não cadastrou nada ainda',
      dados.empresas.length === antesDeImportar, dados.empresas.length + '');
    ok('e destravou o botão de cadastrar',
      document.getElementById('btnImportar').disabled === false);

    document.getElementById('btnImportar').click();

    setTimeout(function () {
      ok('todas as empresas da lista entraram',
        dados.empresas.length === antesDeImportar + naLista,
        dados.empresas.length + ' vs ' + (antesDeImportar + naLista));
      ok('a tela confirma o que foi feito',
        document.getElementById('previaImportacao').textContent.indexOf('Pronto') >= 0);

      var importadas = dados.empresas.filter(function (e) {
        return e.servico === servicoAlvo && fomentoAntes.indexOf(e.nome) < 0;
      });
      var viggma = importadas[0];
      ok('entraram no serviço de fomento escolhido', importadas.length === naLista,
        importadas.length + ' de ' + naLista);
      ok('com o CNPJ', !!viggma && viggma.cnpjs.length === 1 &&
        viggma.cnpjs[0].formatado.length === 18,
        viggma && JSON.stringify(viggma.cnpjs));
      ok('e ainda sem nenhuma etapa concluída',
        viggma.etapas.every(function (e) { return !e.concluido; }));

      ok('a tela oferece desfazer a importação',
        !!Array.prototype.slice.call(document.querySelectorAll('#previaImportacao button'))
          .filter(function (b) { return b.textContent.indexOf('Desfazer') === 0; })[0]);

      fecharGaveta();
      irPara('empresas');
      var busca = document.getElementById('busca');
      busca.value = viggma.cnpjs[0].numero;
      desenhar();
      ok('dá para achar a importada pelo CNPJ',
        document.querySelectorAll('#corpo tr').length === 1,
        document.querySelectorAll('#corpo tr').length + ' linhas');

      abrirEmpresa(viggma.linha);
      var blocoGF = null;
      document.querySelectorAll('#gavetaConteudo .bloco').forEach(function (b) {
        if (b.querySelector('h3').textContent.indexOf('Goiás Fomento') > 0) blocoGF = b;
      });
      ok('a ficha traz o bloco do Goiás Fomento preenchido', !!blocoGF);
      ok('com o município', blocoGF.textContent.indexOf('Município') >= 0 &&
        !!Array.prototype.slice.call(blocoGF.querySelectorAll('input'))
          .filter(function (i) { return i.value === 'GOIANIA'; })[0]);
      ok('com os celulares',
        !!Array.prototype.slice.call(blocoGF.querySelectorAll('input'))
          .filter(function (i) { return i.value.indexOf('(') === 0 && i.value.length > 12; })[0]);
      fecharGaveta();
      busca.value = '';
      desenhar();

      faseEtapas(dados.empresas.length);
    }, 900);
  }, 500);
}

/* ---------- incluir, renomear e excluir etapa ---------- */
function faseEtapas(totalAntes) {
  entrando('faseEtapas');
  abrirEtapas();
  ok('a tela de etapas lista todas',
    document.querySelectorAll('.matriz tbody tr').length === (dados.etapas || []).length,
    document.querySelectorAll('.matriz tbody tr').length + ' etapas');
  ok('a etapa de documentos não tem botão de excluir',
    !document.getElementById('config-documentacao').querySelector('.btn-perigo'));

  var antesDeIncluir = (dados.etapas || []).length;
  document.getElementById('novaEtapaNome').value = 'Conferir cálculo com o cliente';
  document.querySelector('.form-etapa .btn-primario').click();

  setTimeout(function () {
    var agora = antesDeIncluir + 1;
    ok('o checklist ganhou a etapa', (dados.etapas || []).length === agora,
      (dados.etapas || []).length + '');
    ok('o cabeçalho ganhou a sigla nova',
      document.querySelectorAll('#thChecklist .trilha-topo span').length === agora);
    ok('a legenda acompanhou a etapa nova',
      document.querySelectorAll('#guiaEtapas .item').length === agora,
      document.querySelectorAll('#guiaEtapas .item').length + ' itens');
    ok('cada linha ganhou o marco novo',
      document.querySelector('#corpo .trilha').querySelectorAll('.marco').length === agora);
    ok('a posição passou a contar sobre o novo total',
      document.querySelector('#corpo .etapa-atual .posicao').textContent.indexOf('/' + agora) > 0,
      document.querySelector('#corpo .etapa-atual .posicao').textContent);

    var nova = dados.etapas[dados.etapas.length - 1];
    editarEtapa(nova.id);
    document.getElementById('editaNome').value = 'Conferência final com o cliente';
    document.getElementById('editaSigla').value = 'CONF';
    document.querySelector('#config-' + nova.id + ' .btn-primario').click();

    setTimeout(function () {
      var ultima = dados.etapas[dados.etapas.length - 1];
      ok('nome trocado', ultima.nome === 'Conferência final com o cliente', ultima.nome);
      ok('sigla trocada no cabeçalho da tabela',
        document.querySelectorAll('#thChecklist .trilha-topo b')[dados.etapas.length - 1]
          .textContent === 'CONF',
        document.querySelectorAll('#thChecklist .trilha-topo b')[dados.etapas.length - 1].textContent);

      pedirExclusaoEtapa(nova.id);
      var campo = document.getElementById('nomeExclusaoEtapa');
      var botao = document.getElementById('btnExcluirEtapa');
      ok('exclusão de etapa pede confirmação', !!campo && botao.disabled === true);
      campo.value = 'outro nome';
      campo.dispatchEvent(new Event('input'));
      ok('nome errado não libera', botao.disabled === true);
      campo.value = 'conferência final com o cliente';
      campo.dispatchEvent(new Event('input'));
      ok('nome certo libera', botao.disabled === false);
      botao.click();

      setTimeout(function () {
        ok('o checklist voltou ao tamanho anterior',
          (dados.etapas || []).length === antesDeIncluir, (dados.etapas || []).length + '');
        ok('o cabeçalho voltou junto',
          document.querySelectorAll('#thChecklist .trilha-topo span').length === antesDeIncluir);
        ok('e as linhas também',
          document.querySelector('#corpo .trilha').querySelectorAll('.marco').length === antesDeIncluir);
        ok('nenhuma empresa se perdeu', dados.empresas.length === totalAntes,
          dados.empresas.length + '');
        fecharGaveta();
        faseExclusao(totalAntes);
      }, 500);
    }, 500);
  }, 600);
}

/* ---------- exclusão de empresa ---------- */
function faseExclusao(totalAntes) {
  entrando('faseExclusao');
  var alvo = dados.empresas[dados.empresas.length - 1];

  abrirEmpresa(alvo.linha);
  ok('ficha da empresa abriu', document.getElementById('gaveta').classList.contains('aberta'));
  ok('botão de excluir está na ficha', !!document.querySelector('#areaExclusao .btn-perigo'));

  document.querySelector('#areaExclusao .btn-perigo').click();
  var campo = document.getElementById('nomeExclusao');
  var botao = document.getElementById('btnExcluir');
  ok('pede confirmação por digitação', !!campo);
  ok('botão começa desabilitado', botao.disabled === true);

  campo.value = 'NOME QUALQUER';
  campo.dispatchEvent(new Event('input'));
  ok('nome errado não libera', botao.disabled === true);

  campo.value = alvo.nome.slice(0, alvo.nome.length - 2);
  campo.dispatchEvent(new Event('input'));
  ok('nome incompleto não libera', botao.disabled === true);

  campo.value = '  ' + alvo.nome.toLowerCase() + '  ';
  campo.dispatchEvent(new Event('input'));
  ok('nome certo em minúsculas libera', botao.disabled === false);

  botao.click();
  setTimeout(function () {
    ok('ficha fechou depois de excluir',
      !document.getElementById('gaveta').classList.contains('aberta'));
    ok('painel perdeu uma empresa', dados.empresas.length === totalAntes - 1, dados.empresas.length + '');
    ok('empresa sumiu da lista',
      !dados.empresas.some(function (x) { return x.nome === alvo.nome; }), alvo.nome);
    ok('tabela redesenhada',
      document.querySelectorAll('#corpo tr').length === totalAntes - 1,
      document.querySelectorAll('#corpo tr').length + ' linhas');
    ok('contador do topo atualizado',
      document.getElementById('carimbo').textContent.indexOf((totalAntes - 1) + ' empresas') === 0,
      document.getElementById('carimbo').textContent);
    ok('avisa onde a empresa foi parar',
      document.getElementById('aviso').textContent.indexOf('arquivada') > 0,
      document.getElementById('aviso').textContent);

    abrirLog();
    setTimeout(function () {
      var ex = document.getElementById('excluidasConteudo');
      ok('histórico lista a empresa excluída',
        !!ex && ex.style.display !== 'none' && ex.textContent.indexOf(alvo.nome) > 0,
        ex ? ex.textContent.slice(0, 60) : 'bloco não apareceu');
      terminar();
    }, 400);
  }, 400);
}
</script>`;

/* O roteiro vive dentro de uma template literal: uma barra invertida esquecida
   vira erro de sintaxe e a página morre calada. Compilo antes de abrir o
   navegador, para o erro aparecer com nome e linha. */
try {
  new Function(roteiro.replace(/^<script>/, '').replace(/<\/script>$/, ''));
} catch (erro) {
  console.log('❌ o roteiro do teste não compila: ' + erro.message);
  console.log('   (dentro da template literal, "\\d" vira "d" — escreva "\\\\d" ou evite regex)');
  process.exit(1);
}

const pagina = fs.readFileSync(PREVIA_DO_TESTE, 'utf8')
  .replace('</body>', roteiro + '</body>');
const arquivo = path.join(require('os').tmpdir(), 'previa-teste-interface.html');
fs.writeFileSync(arquivo, pagina);

const dom = execFileSync(CHROME, [
  '--headless', '--disable-gpu', '--no-sandbox', '--virtual-time-budget=90000',
  '--dump-dom', 'file://' + arquivo
], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] });

const achado = dom.match(/id="resultado-teste">([\s\S]*?)<\/div>/);
if (!achado) {
  console.log('❌ o roteiro não chegou ao fim — a página quebrou antes.');
  process.exit(1);
}

const linhas = achado[1]
  .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
  .split('\n');
linhas.forEach((l) => console.log('  ' + l));

const falhas = linhas.filter((l) => l.indexOf('FALHA') === 0).length;
console.log('\n' + '='.repeat(60));
console.log(falhas === 0 ? '✅ ' + linhas.length + ' checagens de tela, 0 falhas'
                         : '❌ ' + falhas + ' falhas em ' + linhas.length + ' checagens de tela');
process.exit(falhas === 0 ? 0 : 1);
