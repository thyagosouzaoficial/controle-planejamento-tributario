/**
 * Controle de Planejamento Tributário — Azuos / Analyze
 *
 * A planilha "Controle Planejamento Tribuario" continua sendo o banco de dados.
 * Este código só lê e escreve nas mesmas células, para que quem preferir a
 * planilha possa continuar usando normalmente.
 */

/**
 * Deixe vazio: o script fica vinculado à planilha (Extensões › Apps Script),
 * então ele já sabe qual é. Só preencha com o ID se um dia precisar apontar
 * para outra planilha — e, nesse caso, não versione o ID.
 */
const PLANILHA_ID = '';

/** A planilha onde tudo acontece. */
function planilha_() {
  return PLANILHA_ID
    ? planilha_()
    : SpreadsheetApp.getActiveSpreadsheet();
}
const ABA_DADOS = 'Controle';
const ABA_USUARIOS = 'Diagnostico';
const ABA_LOG = 'Log';
const ABA_EXCLUIDAS = 'Excluidas';
const ABA_ETAPAS = 'Etapas';
const ABA_ETAPAS_EXCLUIDAS = 'Etapas excluidas';
const PRIMEIRA_LINHA = 4;
const COLUNA_CNPJ = 73;
const COLUNA_SERVICO = 74;
const COLUNA_NAO_APLICA = 75;
const ABA_SERVICOS = 'Servicos';
const ABA_CAMPOS = 'Campos';

/** Os serviços que a Analyze presta. A lista vive na aba `Servicos` e pode crescer. */
/**
 * O Goiás Fomento entra por três caminhos, e cada um começa de um jeito:
 *  · Indicação    — a Goiás Fomento indica o cliente, que já quer o crédito:
 *                   entramos em contato, pedimos a documentação e abrimos o processo.
 *  · Sondagem     — a Goiás Fomento indica, mas ainda não se sabe se há interesse:
 *                   primeiro é preciso falar com o cliente para descobrir.
 *  · Busca própria— o cliente não veio de indicação: nós o procuramos e oferecemos.
 * Do "solicitar documentação" em diante o caminho é o mesmo para os três.
 */
const FOMENTO_INDICACAO = 'Goiás Fomento — Indicação';
const FOMENTO_SONDAGEM = 'Goiás Fomento — Sondagem';
const FOMENTO_BUSCA = 'Goiás Fomento — Busca própria';
const FOMENTO_TODOS = [FOMENTO_INDICACAO, FOMENTO_SONDAGEM, FOMENTO_BUSCA];

const SERVICOS_PADRAO = ['Planejamento Tributário', 'Auditoria']
  .concat(FOMENTO_TODOS)
  .concat(['Diagnóstico Prospecção']);
const FUSO = 'America/Sao_Paulo';

/** Colunas do cabeçalho da empresa (1-based, como na planilha). */
const COL = {
  numero: 1,
  empresa: 2,
  contato: 3,
  dataContrato: 4,
  assinatura: 5,
  prazoCombinado: 6,
  previsaoEntrega: 7,
  entregaEfetiva: 8,
  regime: 9,
  observacao: 10,
  percentual: 11,
  cnpj: COLUNA_CNPJ,
  servico: COLUNA_SERVICO,
  naoAplica: COLUNA_NAO_APLICA
};

const REGIMES = ['Simples Nacional', 'Lucro Presumido', 'Lucro Real', 'MEI'];

/** Os 10 documentos da etapa de solicitação — colunas 14 a 23. */
const DOCUMENTOS = [
  'Relatório de despesas do período, em Excel',
  'Estoque registrado na Sefaz',
  'Estoque REAL da empresa',
  'Margem de lucro aplicada (%)',
  'Valor mensal de compra SEM nota fiscal (%)',
  'Valor mensal de venda SEM nota fiscal (%)',
  'Relação dos Ativos Imobilizados',
  'Procuração para o nosso certificado',
  'XML de entrada (COMPRA) do período',
  'XML de saída (VENDA) do período'
];

/**
 * O desenho inicial do checklist: as 12 etapas que já existiam na planilha.
 * A partir da primeira abertura isso vive na aba `Etapas`, onde pode ser
 * renomeado, ampliado ou reduzido — este bloco só serve para criá-la.
 * resp / data / concluido / dataFinal / obs são colunas 1-based.
 */
const ETAPAS_PADRAO = [
  {
    id: 'documentacao',
    sigla: 'DOC',
    nome: 'Solicitar documentação',
    resp: 12, data: 13, colunaPercentual: 24, dataFinal: 25, obs: 26,
    docInicio: 14, docFim: 23,
    rotuloData: 'Data da 1ª solicitação',
    rotuloDataFinal: 'Data da última solicitação'
  },
  { id: 'extrato', sigla: 'SPED', nome: 'Baixar extrato do Simples Nacional / SPED Fiscal e Contribuições', resp: 28, data: 29, concluido: 30 },
  { id: 'xml', sigla: 'XML', nome: 'Baixar/solicitar XML e classificar produtos', resp: 32, data: 33, concluido: 34 },
  { id: 'movimentacao', sigla: 'MOV', nome: 'Criar planilha com a movimentação', resp: 36, data: 37, concluido: 38 },
  { id: 'beneficio', sigla: 'BENEF', nome: 'Procurar benefício fiscal do produto e da atividade', resp: 40, data: 41, concluido: 42 },
  { id: 'dre', sigla: 'DRE', nome: 'Fazer DRE com as despesas', resp: 44, data: 45, concluido: 46 },
  {
    id: 'reuniao_cenarios',
    sigla: 'REUN',
    nome: 'Reunião para alinhar os cenários',
    resp: 48, data: 49, concluido: 50, dataFinal: 51, obs: 52,
    rotuloData: 'Data da 1ª reunião',
    rotuloDataFinal: 'Data da última reunião'
  },
  { id: 'cenarios', sigla: 'CEN', nome: 'Criar cenários na planilha', resp: 54, data: 55, concluido: 56 },
  { id: 'alinhamento_final', sigla: 'ALIN', nome: 'Reunião de alinhamento final', resp: 58, data: 59, concluido: 60 },
  { id: 'marcar_reuniao', sigla: 'AGEND', nome: 'Marcar reunião com o cliente', resp: 62, data: 63, concluido: 64 },
  { id: 'apresentacao', sigla: 'APRES', nome: 'Apresentação do planejamento', resp: 66, data: 67, concluido: 68 },
  { id: 'pdf', sigla: 'PDF', nome: 'Enviar resumo do planejamento em PDF', resp: 70, data: 71, concluido: 72 }
];

/* ------------------------------------------------------------------ *
 * O checklist, configurável pela aba `Etapas`                         *
 * ------------------------------------------------------------------ */

const CAMPOS_ETAPA = ['id', 'ordem', 'nome', 'sigla', 'tipo', 'resp', 'data', 'concluido',
                      'dataFinal', 'obs', 'docInicio', 'docFim', 'colunaPercentual', 'servicos'];

/** Campos da aba `Etapas` que são número de coluna; o resto é texto. */
const CAMPOS_ETAPA_NUMERICOS = ['ordem', 'resp', 'data', 'concluido', 'dataFinal', 'obs',
                                'docInicio', 'docFim', 'colunaPercentual'];

/**
 * O fluxo próprio de cada serviço, criado na primeira abertura. As 12 etapas
 * originais são o fluxo do planejamento tributário — quando um serviço com
 * fluxo próprio entra em cena, elas passam a ser marcadas como tal, senão as
 * empresas do serviço novo herdariam um checklist que não é o delas.
 */
const ETAPAS_INICIAIS = [
  {
    servico: FOMENTO_INDICACAO,
    fluxoOriginalPertenceA: 'Planejamento Tributário',
    etapas: [
      /* o começo é diferente em cada caminho */
      { nome: 'Contato com o cliente indicado', sigla: 'CONT', servicos: [FOMENTO_INDICACAO] },
      { nome: 'Sondar interesse no crédito', sigla: 'SOND', servicos: [FOMENTO_SONDAGEM] },
      { nome: 'Prospectar o cliente', sigla: 'PROSP', servicos: [FOMENTO_BUSCA] },
      { nome: 'Oferecer o crédito', sigla: 'OFERT', servicos: [FOMENTO_BUSCA] },

      /* daqui para frente é igual nos três */
      { nome: 'Solicitar documentação do crédito', sigla: 'DOCGF', servicos: FOMENTO_TODOS },
      { nome: 'Abertura do processo', sigla: 'ABERT', servicos: FOMENTO_TODOS },
      { nome: 'Validação inicial', sigla: 'VALID', servicos: FOMENTO_TODOS },
      { nome: 'Cadastro com restrição', sigla: 'CADAS', servicos: FOMENTO_TODOS },
      { nome: 'Análise de documentos', sigla: 'ANDOC', servicos: FOMENTO_TODOS },
      { nome: 'Cancelado', sigla: 'CANC', servicos: FOMENTO_TODOS },
      { nome: 'Análise de crédito', sigla: 'ANCRE', servicos: FOMENTO_TODOS },
      { nome: 'Aprovado', sigla: 'APROV', servicos: FOMENTO_TODOS }
    ]
  }
];

let _etapas = null;
function esquecerEtapas_() { _etapas = null; }

/** As etapas do checklist, lidas da aba `Etapas` (criada na primeira vez). */
function etapas_() {
  if (_etapas) return _etapas;

  const sheet = abaEtapas_();
  const total = sheet.getLastRow();
  const linhas = total < 2 ? [] : sheet.getRange(2, 1, total - 1, CAMPOS_ETAPA.length).getValues();

  _etapas = linhas
    .filter(function (l) { return texto_(l[0]) !== ''; })
    .map(function (l) {
      const etapa = {};
      CAMPOS_ETAPA.forEach(function (campo, i) {
        const valor = l[i];
        etapa[campo] = CAMPOS_ETAPA_NUMERICOS.indexOf(campo) >= 0
          ? (valor === '' || valor === null ? null : Number(valor))
          : texto_(valor);
      });
      etapa.servicos = lerListaDeServicos_(etapa.servicos);
      return etapa;
    })
    .sort(function (a, b) { return a.ordem - b.ordem; });

  return _etapas;
}

function abaEtapas_() {
  const planilha = planilha_();
  let sheet = planilha.getSheetByName(ABA_ETAPAS);
  if (sheet) return sheet;

  sheet = planilha.insertSheet(ABA_ETAPAS);
  sheet.appendRow(['ID', 'Ordem', 'Nome', 'Sigla', 'Tipo', 'Col responsável', 'Col data',
                   'Col concluído', 'Col data final', 'Col observações', 'Col doc início',
                   'Col doc fim', 'Col percentual', 'Serviços (vazio = todos)']);
  sheet.getRange(1, 1, 1, CAMPOS_ETAPA.length).setFontWeight('bold');
  sheet.setFrozenRows(1);

  ETAPAS_PADRAO.forEach(function (def, i) {
    sheet.appendRow([def.id, i + 1, def.nome, def.sigla,
      def.docInicio ? 'documentos' : 'simples',
      def.resp, def.data, def.concluido || '', def.dataFinal || '', def.obs || '',
      def.docInicio || '', def.docFim || '', def.colunaPercentual || '', '']);
  });

  return sheet;
}

/** Última coluna usada na aba Controle — cresce quando entra etapa nova. */
function totalColunas_() {
  let ultima = Math.max(COLUNA_CNPJ, COLUNA_SERVICO, COLUNA_NAO_APLICA);
  colunasDosCampos_().forEach(function (c) { if (c && c > ultima) ultima = c; });
  etapas_().forEach(function (e) {
    [e.resp, e.data, e.concluido, e.dataFinal, e.obs, e.docFim, e.colunaPercentual]
      .forEach(function (c) { if (c && c > ultima) ultima = c; });
  });
  return ultima;
}

/**
 * A quais serviços a etapa pertence. Lista vazia é o caso comum: a etapa vale
 * para todo mundo — é o que mantém o checklist unificado.
 */
function lerListaDeServicos_(valor) {
  const lista = String(valor === null || valor === undefined ? '' : valor)
    .split(/[;,\n]+/)
    .map(function (parte) { return parte.trim(); })
    .filter(function (parte) { return parte !== ''; });
  return semRepetir_(lista);
}

/** O mesmo serviço duas vezes na mesma etapa não significa nada. */
function semRepetir_(lista) {
  const vistos = [];
  lista.forEach(function (item) { if (vistos.indexOf(item) < 0) vistos.push(item); });
  return vistos;
}

function etapaValePara_(etapa, servico) {
  if (!etapa.servicos || !etapa.servicos.length) return true;
  if (!servico) return true;
  return etapa.servicos.indexOf(servico) >= 0;
}

/** Define a quais serviços uma etapa pertence. Lista vazia = todos. */
function definirServicosDaEtapa(id, servicos) {
  const etapa = acharEtapa_(id);
  const disponiveis = listarServicos_();
  const lista = semRepetir_((servicos || [])
    .map(function (s) { return String(s).trim(); })
    .filter(function (s) { return s !== ''; }));

  const desconhecido = lista.filter(function (s) { return disponiveis.indexOf(s) < 0; });
  if (desconhecido.length) {
    throw new Error('Serviço fora da lista: ' + desconhecido.join(', '));
  }

  const anterior = (etapa.servicos || []).join(', ');
  abaEtapas_().getRange(linhaDaEtapa_(id), CAMPOS_ETAPA.indexOf('servicos') + 1)
    .setValue(lista.join(', '));

  esquecerEtapas_();
  SpreadsheetApp.flush();
  escreverLog_('(checklist)', etapa.nome + ' — serviços',
    anterior || 'todos', lista.join(', ') || 'todos');
  return carregarPainel();
}

/**
 * Define o pertencimento de várias etapas de uma vez — é o que a matriz de
 * etapas × serviços usa ao marcar ou limpar uma coluna inteira.
 * Cada item é { id, servicos }.
 */
function definirServicosDeVarias(itens) {
  const lista = itens || [];
  if (!lista.length) return carregarPainel();

  const disponiveis = listarServicos_();
  const sheet = abaEtapas_();
  const coluna = CAMPOS_ETAPA.indexOf('servicos') + 1;

  // valida tudo antes de escrever qualquer coisa
  const preparados = lista.map(function (item) {
    const etapa = acharEtapa_(item.id);
    const servicos = semRepetir_((item.servicos || [])
      .map(function (s) { return String(s).trim(); })
      .filter(function (s) { return s !== ''; }));

    const desconhecido = servicos.filter(function (s) { return disponiveis.indexOf(s) < 0; });
    if (desconhecido.length) throw new Error('Serviço fora da lista: ' + desconhecido.join(', '));

    return { etapa: etapa, servicos: servicos, linha: linhaDaEtapa_(item.id) };
  });

  preparados.forEach(function (p) {
    const anterior = (p.etapa.servicos || []).join(', ');
    const novo = p.servicos.join(', ');
    if (anterior === novo) return;
    sheet.getRange(p.linha, coluna).setValue(novo);
    escreverLog_('(checklist)', p.etapa.nome + ' — serviços', anterior || 'todos', novo || 'todos');
  });

  esquecerEtapas_();
  SpreadsheetApp.flush();
  return carregarPainel();
}

/**
 * Cria o fluxo próprio de um serviço, uma vez só. Se nenhuma etapa tiver serviço
 * definido ainda, as que já existiam passam a pertencer ao fluxo original —
 * assim o serviço novo não herda o checklist do planejamento tributário.
 */
/**
 * Tudo o que já teve coluna na planilha, mesmo o que foi excluído depois — a
 * coluna fica marcada como removida e é essa marca que impede a semeadura de
 * ressuscitar uma etapa ou um campo que alguém tirou de propósito.
 */
function rotulosJaUsados_() {
  const sheet = aba_();
  const largura = Math.max(sheet.getLastColumn(), totalColunas_());
  const cabecalho = sheet.getRange(2, 1, 1, largura).getDisplayValues()[0];

  return cabecalho.map(function (valor) {
    return texto_(valor)
      .replace(/\s*\(etapa removida do checklist\)\s*$/i, '')
      .replace(/\s*\(campo removido\)\s*$/i, '')
      .toUpperCase();
  }).filter(function (r) { return r !== ''; });
}

let _semeando = false;

/**
 * Cria o que ainda falta na planilha: fluxo e campos próprios de cada serviço.
 * A trava existe porque `criarEtapa` e `criarCampo` recarregam o painel ao
 * terminar — sem ela, a semeadura chamaria a si mesma no meio do caminho.
 */
function garantirEstruturaInicial_() {
  if (_semeando) return;
  _semeando = true;
  try {
    garantirEtapasIniciais_();
    garantirCamposIniciais_();
  } finally {
    _semeando = false;
  }
}

function garantirEtapasIniciais_() {
  const servicos = listarServicos_();

  ETAPAS_INICIAIS.forEach(function (pacote) {
    if (servicos.indexOf(pacote.servico) < 0) return;

    // ancorado no que já teve coluna: tirar o serviço de uma etapa na matriz, ou
    // excluir uma etapa do fluxo, não pode fazer tudo ser criado de novo
    const usados = rotulosJaUsados_();
    const jaCriado = pacote.etapas.some(function (def) {
      return usados.indexOf(def.nome.toUpperCase()) >= 0;
    });
    if (jaCriado) return;

    const ninguemConfigurou = etapas_().every(function (e) { return !(e.servicos || []).length; });
    if (ninguemConfigurou && servicos.indexOf(pacote.fluxoOriginalPertenceA) >= 0) {
      definirServicosDeVarias(etapas_().map(function (e) {
        return { id: e.id, servicos: [pacote.fluxoOriginalPertenceA] };
      }));
    }

    pacote.etapas.forEach(function (def) {
      criarEtapa(def.nome, def.sigla, def.servicos || [pacote.servico]);
    });
  });
}

/** Rótulos de data de uma etapa — os específicos vêm do molde original. */
function rotulosDe_(id) {
  const padrao = ETAPAS_PADRAO.filter(function (e) { return e.id === id; })[0];
  return {
    data: (padrao && padrao.rotuloData) || 'Data',
    dataFinal: (padrao && padrao.rotuloDataFinal) || 'Data final'
  };
}

function etapaDeDocumentos_() {
  return etapas_().filter(function (e) { return e.tipo === 'documentos'; })[0] || null;
}

/** Exposto para os testes conferirem em que coluna a etapa grava. */
function acharEtapaParaTeste(id) { return acharEtapa_(id); }

function acharEtapa_(id) {
  const achada = etapas_().filter(function (e) { return e.id === id; })[0];
  if (!achada) throw new Error('Etapa desconhecida: ' + id);
  return achada;
}

function sugerirId_(nome) {
  const base = String(nome).toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 24) || 'etapa';
  const usados = etapas_().map(function (e) { return e.id; });
  if (usados.indexOf(base) < 0) return base;
  let n = 2;
  while (usados.indexOf(base + '_' + n) >= 0) n++;
  return base + '_' + n;
}

function sugerirSigla_(nome) {
  const palavras = String(nome).toUpperCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .split(/[^A-Z0-9]+/).filter(function (p) { return p.length > 2; });
  const base = (palavras.length >= 2
    ? palavras.slice(0, 2).map(function (p) { return p.slice(0, 3); }).join('')
    : (palavras[0] || 'ETAPA')).slice(0, 5);

  const usadas = etapas_().map(function (e) { return e.sigla; });
  if (usadas.indexOf(base) < 0) return base;
  let n = 2;
  while (usadas.indexOf(base.slice(0, 4) + n) >= 0) n++;
  return base.slice(0, 4) + n;
}

/**
 * Inclui uma etapa no fim do checklist, criando três colunas novas na aba
 * Controle — Responsável, Data e Concluído — com os mesmos cabeçalhos das outras.
 */
function criarEtapa(nome, sigla, servicos) {
  const limpo = String(nome || '').trim();
  if (!limpo) throw new Error('Informe o nome da etapa.');
  if (etapas_().some(function (e) { return e.nome.toUpperCase() === limpo.toUpperCase(); })) {
    throw new Error('Já existe uma etapa com esse nome.');
  }

  const sheet = aba_();
  const primeira = totalColunas_() + 1;

  sheet.getRange(2, primeira).setValue(limpo).setFontWeight('bold');
  sheet.getRange(3, primeira, 1, 3).setValues([['Responsável:', 'Data:', 'Concluído']]);
  sheet.getRange(PRIMEIRA_LINHA, primeira + 2, Math.max(sheet.getLastRow() - PRIMEIRA_LINHA + 1, 1), 1)
    .insertCheckboxes();

  const ordem = etapas_().length + 1;
  const id = sugerirId_(limpo);
  abaEtapas_().appendRow([id, ordem, limpo, String(sigla || '').trim().toUpperCase() || sugerirSigla_(limpo),
    'simples', primeira, primeira + 1, primeira + 2, '', '', '', '', '',
    (servicos || []).join(', ')]);

  esquecerEtapas_();
  SpreadsheetApp.flush();
  escreverLog_('(checklist)', 'Etapa incluída', '', limpo);
  return carregarPainel();
}

/** Troca o nome ou a sigla de uma etapa, na aba `Etapas` e no cabeçalho da Controle. */
function renomearEtapa(id, nome, sigla) {
  const etapa = acharEtapa_(id);
  const limpo = String(nome || '').trim();
  if (!limpo) throw new Error('Informe o novo nome da etapa.');

  const repetido = etapas_().some(function (e) {
    return e.id !== id && e.nome.toUpperCase() === limpo.toUpperCase();
  });
  if (repetido) throw new Error('Já existe outra etapa com esse nome.');

  const novaSigla = String(sigla || '').trim().toUpperCase() || etapa.sigla;
  const sheet = abaEtapas_();
  const linha = linhaDaEtapa_(id);
  sheet.getRange(linha, 3).setValue(limpo);
  sheet.getRange(linha, 4).setValue(novaSigla);

  // o cabeçalho da aba Controle é o que a equipe vê na planilha
  aba_().getRange(2, etapa.resp).setValue(limpo);

  esquecerEtapas_();
  SpreadsheetApp.flush();
  escreverLog_('(checklist)', 'Etapa renomeada', etapa.nome, limpo);
  return carregarPainel();
}

function linhaDaEtapa_(id) {
  const sheet = abaEtapas_();
  const total = sheet.getLastRow();
  const ids = total < 2 ? [] : sheet.getRange(2, 1, total - 1, 1).getValues();
  for (let i = 0; i < ids.length; i++) {
    if (texto_(ids[i][0]) === id) return i + 2;
  }
  throw new Error('Etapa não encontrada no registro: ' + id);
}

/**
 * Tira uma etapa do checklist.
 *
 * As colunas continuam na aba Controle — apagá-las deslocaria todas as outras e
 * quebraria o mapeamento. O que a etapa tinha preenchido vai para a aba
 * `Etapas excluidas`, empresa por empresa, e o cabeçalho fica marcado.
 */
function excluirEtapa(id, nomeConfirmado) {
  const etapa = acharEtapa_(id);

  if (etapa.tipo === 'documentos') {
    throw new Error('A etapa de documentos não pode ser excluída: ela sustenta a lista dos ' +
      DOCUMENTOS.length + ' documentos e a fórmula de percentual da planilha.');
  }
  if (etapas_().length <= 1) throw new Error('O checklist não pode ficar sem etapas.');

  const digitado = String(nomeConfirmado || '').trim().toUpperCase();
  if (digitado !== etapa.nome.trim().toUpperCase()) {
    throw new Error('O nome digitado não confere com "' + etapa.nome + '". Nada foi excluído.');
  }

  arquivarEtapa_(etapa);

  const sheet = aba_();
  sheet.getRange(2, etapa.resp).setValue(etapa.nome + ' (etapa removida do checklist)');

  abaEtapas_().deleteRow(linhaDaEtapa_(id));
  renumerarEtapas_();

  esquecerEtapas_();
  SpreadsheetApp.flush();
  escreverLog_('(checklist)', 'Etapa excluída', etapa.nome, 'arquivada na aba ' + ABA_ETAPAS_EXCLUIDAS);
  return carregarPainel();
}

function renumerarEtapas_() {
  const sheet = abaEtapas_();
  const total = sheet.getLastRow();
  if (total < 2) return;
  const valores = [];
  for (let i = 2; i <= total; i++) valores.push([i - 1]);
  sheet.getRange(2, 2, valores.length, 1).setValues(valores);
}

/** Guarda o que cada empresa tinha nessa etapa, para não se perder nada. */
function arquivarEtapa_(etapa) {
  const planilha = planilha_();
  let sheet = planilha.getSheetByName(ABA_ETAPAS_EXCLUIDAS);
  if (!sheet) {
    sheet = planilha.insertSheet(ABA_ETAPAS_EXCLUIDAS);
    sheet.appendRow(['Excluída em', 'Excluída por', 'Etapa', 'Empresa',
                     'Responsável', 'Data', 'Concluído', 'Observações']);
    sheet.getRange(1, 1, 1, 8).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }

  const controle = aba_();
  const ultimaLinha = controle.getLastRow();
  if (ultimaLinha < PRIMEIRA_LINHA) return;

  const quando = new Date();
  const quem = Session.getActiveUser().getEmail() || 'desconhecido';
  const largura = totalColunas_();
  const valores = controle
    .getRange(PRIMEIRA_LINHA, 1, ultimaLinha - PRIMEIRA_LINHA + 1, largura)
    .getDisplayValues();

  valores.forEach(function (linha) {
    const empresa = texto_(linha[COL.empresa - 1]);
    if (!empresa) return;
    sheet.appendRow([quando, quem, etapa.nome, empresa,
      texto_(linha[etapa.resp - 1]),
      etapa.data ? texto_(linha[etapa.data - 1]) : '',
      etapa.concluido ? texto_(linha[etapa.concluido - 1]) : '',
      etapa.obs ? texto_(linha[etapa.obs - 1]) : '']);
  });
}

/* ------------------------------------------------------------------ *
 * CNPJ                                                                *
 * ------------------------------------------------------------------ */

function normalizarCNPJ_(texto) {
  return String(texto === null || texto === undefined ? '' : texto)
    .toUpperCase().replace(/[^0-9A-Z]/g, '');
}

/**
 * Valida o dígito verificador. Aceita o CNPJ numérico de sempre e o alfanumérico
 * que a Receita passou a emitir — nos dois o cálculo é o mesmo, usando o valor
 * ASCII do caractere menos 48; só os dois dígitos finais são obrigatoriamente
 * numéricos.
 */
function cnpjValido_(texto) {
  const limpo = normalizarCNPJ_(texto);
  if (!/^[0-9A-Z]{12}[0-9]{2}$/.test(limpo)) return false;
  if (/^(.)\1{13}$/.test(limpo)) return false;

  const digito = function (tamanho) {
    let soma = 0;
    let peso = 2;
    for (let i = tamanho - 1; i >= 0; i--) {
      soma += (limpo.charCodeAt(i) - 48) * peso;
      peso = peso === 9 ? 2 : peso + 1;
    }
    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  };

  return digito(12) === Number(limpo[12]) && digito(13) === Number(limpo[13]);
}

function formatarCNPJ_(texto) {
  const limpo = normalizarCNPJ_(texto);
  if (limpo.length !== 14) return String(texto || '').trim();
  return limpo.slice(0, 2) + '.' + limpo.slice(2, 5) + '.' + limpo.slice(5, 8) +
    '/' + limpo.slice(8, 12) + '-' + limpo.slice(12);
}

/** A célula aceita mais de um CNPJ — vários desses clientes são grupos. */
function lerCNPJs_(valor) {
  return String(valor === null || valor === undefined ? '' : valor)
    .split(/[;,\n]+/)
    .map(function (parte) { return normalizarCNPJ_(parte); })
    .filter(function (parte) { return parte !== ''; });
}

/** Procura CNPJs escritos solto no texto das observações. */
function garimparCNPJs_(texto) {
  const achados = String(texto || '')
    .match(/\b[0-9]{2}[.\s]?[0-9]{3}[.\s]?[0-9]{3}[\/\s]?[0-9]{4}[-\s]?[0-9]{2}\b/g) || [];
  const unicos = [];
  achados.forEach(function (bruto) {
    const limpo = normalizarCNPJ_(bruto);
    if (cnpjValido_(limpo) && unicos.indexOf(limpo) < 0) unicos.push(limpo);
  });
  return unicos;
}

/* ------------------------------------------------------------------ *
 * Etapas que não se aplicam a uma empresa                             *
 * ------------------------------------------------------------------ */

/**
 * O checklist é o mesmo para todas as empresas, mas nem toda etapa cabe em
 * todo caso. As que não cabem ficam listadas numa única célula por empresa —
 * assim nenhuma coluna de etapa muda de significado e as fórmulas da planilha
 * seguem valendo. Elas saem da conta do percentual.
 */
function lerNaoAplica_(valor) {
  return String(valor === null || valor === undefined ? '' : valor)
    .split(/[;,\n]+/)
    .map(function (parte) { return parte.trim(); })
    .filter(function (parte) { return parte !== ''; });
}

function garantirColunaNaoAplica_() {
  const sheet = aba_();
  const titulo = sheet.getRange(2, COLUNA_NAO_APLICA);
  if (texto_(titulo.getValue()) === '') {
    titulo.setValue('Etapas que não se aplicam');
    titulo.setFontWeight('bold');
  }
}

/**
 * Marca ou desmarca uma etapa como "não se aplica" para esta empresa.
 * Os dois estados se excluem: o que não se aplica não pode estar concluído.
 */
function definirNaoAplica(linha, etapaId, naoSeAplica) {
  const etapa = acharEtapa_(etapaId);
  const sheet = aba_();
  const celula = sheet.getRange(linha, COL.naoAplica);

  const atual = lerNaoAplica_(celula.getValue());
  const conhecidas = etapas_().map(function (e) { return e.id; });
  let lista = atual.filter(function (id) { return conhecidas.indexOf(id) >= 0; });

  if (naoSeAplica === true) {
    if (lista.indexOf(etapaId) < 0) lista.push(etapaId);
    // não se aplica e concluída não convivem
    if (etapa.docInicio) {
      const zeros = [];
      for (let c = etapa.docInicio; c <= etapa.docFim; c++) zeros.push(false);
      sheet.getRange(linha, etapa.docInicio, 1, zeros.length).setValues([zeros]);
    } else if (etapa.concluido) {
      sheet.getRange(linha, etapa.concluido).setValue(false);
    }
  } else {
    lista = lista.filter(function (id) { return id !== etapaId; });
  }

  const anterior = celula.getDisplayValue();
  celula.setValue(lista.join(', '));
  SpreadsheetApp.flush();

  registrarLog_(linha, etapa.nome + ' — não se aplica',
    anterior === '' ? '(nenhuma)' : anterior, lista.join(', ') || '(nenhuma)');
  return carregarEmpresa(linha);
}

/* ------------------------------------------------------------------ *
 * Campos próprios de cada serviço                                     *
 * ------------------------------------------------------------------ */

const CAMPOS_DEF = ['id', 'ordem', 'rotulo', 'tipo', 'servico', 'coluna', 'opcoes'];
const TIPOS_DE_CAMPO = ['texto', 'texto longo', 'data', 'número', 'dinheiro', 'lista', 'sim/não'];

/**
 * Cada serviço pode pedir informações que os outros não usam — o Goiás Fomento,
 * por exemplo, precisa registrar a ligação que ofereceu o crédito. Em vez de
 * inventar colunas fixas, a aba `Campos` diz quais existem e a quem pertencem.
 */
const CAMPOS_INICIAIS = [
  { rotulo: 'Município', tipo: 'texto', servico: FOMENTO_TODOS },
  { rotulo: 'Nome fantasia', tipo: 'texto', servico: FOMENTO_TODOS },
  { rotulo: 'Protocolo anterior', tipo: 'texto', servico: FOMENTO_TODOS },
  { rotulo: 'Telefone', tipo: 'texto', servico: FOMENTO_TODOS },
  { rotulo: 'Celulares', tipo: 'texto', servico: FOMENTO_TODOS },
  { rotulo: 'E-mails', tipo: 'texto', servico: FOMENTO_TODOS },
  { rotulo: 'Proprietários', tipo: 'texto', servico: FOMENTO_TODOS },
  { rotulo: 'Data da ligação de oferta', tipo: 'data', servico: FOMENTO_TODOS },
  { rotulo: 'Quem ligou', tipo: 'texto', servico: FOMENTO_TODOS },
  { rotulo: 'Resultado do contato', tipo: 'lista', servico: FOMENTO_TODOS,
    opcoes: 'Interessado, Vai pensar, Sem interesse, Não atendeu, Retornar depois' },
  { rotulo: 'Linha de crédito', tipo: 'texto', servico: FOMENTO_TODOS },
  { rotulo: 'Valor pretendido', tipo: 'dinheiro', servico: FOMENTO_TODOS },
  { rotulo: 'Observações do contato', tipo: 'texto longo', servico: FOMENTO_TODOS },

  { rotulo: 'Município', tipo: 'texto', servico: 'Diagnóstico Prospecção' },
  { rotulo: 'Capital social', tipo: 'dinheiro', servico: 'Diagnóstico Prospecção' },
  { rotulo: 'Receita bruta anual', tipo: 'dinheiro', servico: 'Diagnóstico Prospecção' },
  { rotulo: 'Data da análise', tipo: 'data', servico: 'Diagnóstico Prospecção' },
  { rotulo: 'Responsável pela análise', tipo: 'texto', servico: 'Diagnóstico Prospecção' }
];

let _campos = null;
function esquecerCampos_() { _campos = null; }

function campos_() {
  if (_campos) return _campos;

  const sheet = abaCampos_();
  const total = sheet.getLastRow();
  const linhas = total < 2 ? [] : sheet.getRange(2, 1, total - 1, CAMPOS_DEF.length).getValues();

  _campos = linhas
    .filter(function (l) { return texto_(l[0]) !== ''; })
    .map(function (l) {
      const campo = {};
      CAMPOS_DEF.forEach(function (nome, i) {
        campo[nome] = (nome === 'ordem' || nome === 'coluna')
          ? Number(l[i] || 0)
          : texto_(l[i]);
      });
      campo.servicos = lerListaDeServicos_(campo.servico);
      campo.listaDeOpcoes = campo.opcoes
        ? campo.opcoes.split(/[;,]/).map(function (o) { return o.trim(); })
            .filter(function (o) { return o !== ''; })
        : [];
      return campo;
    })
    .sort(function (a, b) { return a.ordem - b.ordem; });

  return _campos;
}

function abaCampos_() {
  const planilha = planilha_();
  let sheet = planilha.getSheetByName(ABA_CAMPOS);
  if (sheet) return sheet;

  sheet = planilha.insertSheet(ABA_CAMPOS);
  sheet.appendRow(['ID', 'Ordem', 'Rótulo', 'Tipo', 'Serviço (vazio = todos)',
                   'Coluna na aba Controle', 'Opções da lista']);
  sheet.getRange(1, 1, 1, CAMPOS_DEF.length).setFontWeight('bold');
  sheet.setFrozenRows(1);
  return sheet;
}

/** Sem isso o primeiro campo criado cairia em cima de uma coluna de etapa. */
function colunasDosCampos_() {
  return campos_().map(function (c) { return c.coluna; });
}

function acharCampo_(id) {
  const achado = campos_().filter(function (c) { return c.id === id; })[0];
  if (!achado) throw new Error('Campo desconhecido: ' + id);
  return achado;
}

function sugerirIdDeCampo_(rotulo) {
  const base = String(rotulo).toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 28) || 'campo';
  const usados = campos_().map(function (c) { return c.id; });
  if (usados.indexOf(base) < 0) return base;
  let n = 2;
  while (usados.indexOf(base + '_' + n) >= 0) n++;
  return base + '_' + n;
}

/** Cria um campo e a coluna dele, no fim da aba Controle. */
function criarCampo(rotulo, tipo, servico, opcoes) {
  const limpo = String(rotulo || '').trim();
  if (!limpo) throw new Error('Informe o nome do campo.');

  const tipoLimpo = String(tipo || 'texto').trim();
  if (TIPOS_DE_CAMPO.indexOf(tipoLimpo) < 0) {
    throw new Error('Tipo desconhecido: ' + tipoLimpo);
  }

  /* um campo pode servir a mais de um serviço — o Goiás Fomento, por exemplo,
     é o mesmo cadastro entrando por três caminhos diferentes */
  const disponiveis = listarServicos_();
  const lista = semRepetir_((Array.isArray(servico) ? servico : [servico])
    .map(function (s) { return String(s || '').trim(); })
    .filter(function (s) { return s !== ''; }));

  const desconhecido = lista.filter(function (s) { return disponiveis.indexOf(s) < 0; });
  if (desconhecido.length) {
    throw new Error('"' + desconhecido.join(', ') + '" não está na lista de serviços.');
  }

  const doServico = lista.join(', ');
  const repetido = campos_().some(function (c) {
    return c.rotulo.toUpperCase() === limpo.toUpperCase() && c.servico === doServico;
  });
  if (repetido) throw new Error('Já existe um campo com esse nome nesse serviço.');

  const coluna = totalColunas_() + 1;
  const sheet = aba_();
  sheet.getRange(2, coluna).setValue(limpo).setFontWeight('bold');
  if (doServico) sheet.getRange(3, coluna).setValue(doServico);

  abaCampos_().appendRow([sugerirIdDeCampo_(limpo), campos_().length + 1, limpo, tipoLimpo,
                          doServico, coluna, String(opcoes || '').trim()]);

  esquecerCampos_();
  SpreadsheetApp.flush();
  escreverLog_('(campos)', 'Campo criado', '', limpo + (doServico ? ' — ' + doServico : ''));
  return carregarPainel();
}

/**
 * Tira o campo da ficha. A coluna fica na planilha, pelo mesmo motivo das
 * etapas: apagar coluna do meio deslocaria todo o resto.
 */
function excluirCampo(id, rotuloConfirmado) {
  const campo = acharCampo_(id);
  if (String(rotuloConfirmado || '').trim().toUpperCase() !== campo.rotulo.toUpperCase()) {
    throw new Error('O nome digitado não confere com "' + campo.rotulo + '". Nada foi excluído.');
  }

  const sheet = abaCampos_();
  const total = sheet.getLastRow();
  const ids = total < 2 ? [] : sheet.getRange(2, 1, total - 1, 1).getValues();
  for (let i = 0; i < ids.length; i++) {
    if (texto_(ids[i][0]) === id) { sheet.deleteRow(i + 2); break; }
  }

  aba_().getRange(2, campo.coluna).setValue(campo.rotulo + ' (campo removido)');

  esquecerCampos_();
  SpreadsheetApp.flush();
  escreverLog_('(campos)', 'Campo excluído', campo.rotulo, 'coluna mantida na planilha');
  return carregarPainel();
}

function salvarCampoDoServico(linha, campoId, valor) {
  const campo = acharCampo_(campoId);
  const tipo = campo.tipo === 'data' ? 'data' : (campo.tipo === 'sim/não' ? 'bool' : 'texto');

  if (campo.tipo === 'lista' && valor && campo.listaDeOpcoes.indexOf(String(valor)) < 0) {
    throw new Error('"' + valor + '" não é uma das opções de ' + campo.rotulo + '.');
  }

  return salvarCelula(linha, campo.coluna, valor, tipo, campo.rotulo);
}

/** Semeia os campos do Goiás Fomento, se o serviço existir e ainda não tiver campos. */
function garantirCamposIniciais_() {
  const servicos = listarServicos_();
  const usados = rotulosJaUsados_();

  CAMPOS_INICIAIS.forEach(function (def) {
    const doCampo = Array.isArray(def.servico) ? def.servico : [def.servico];
    const existem = doCampo.filter(function (s) { return servicos.indexOf(s) >= 0; });
    if (!existem.length) return;

    // um campo excluído deixa a coluna marcada: não se recria o que alguém tirou
    if (usados.indexOf(def.rotulo.toUpperCase()) >= 0) return;
    criarCampo(def.rotulo, def.tipo, existem, def.opcoes || '');
  });
}

/* ------------------------------------------------------------------ *
 * Importar lista de clientes                                          *
 * ------------------------------------------------------------------ */

/** Os rótulos como aparecem nas listas que chegam, e o campo de cada um. */
const ROTULOS_DA_LISTA = [
  { marca: 'MUNICIPIO', campo: 'Município' },
  { marca: 'NOME FANTASIA', campo: 'Nome fantasia' },
  { marca: 'PROTOCOLO ANTERIOR', campo: 'Protocolo anterior' },
  { marca: 'TEL', campo: 'Telefone' },
  { marca: 'CEL', campo: 'Celulares', junta: true },
  { marca: 'EMAIL', campo: 'E-mails', junta: true, variosPorLinha: true },
  { marca: 'E-MAIL', campo: 'E-mails', junta: true, variosPorLinha: true },
  { marca: 'PROPRIETARIO', campo: 'Proprietários' },
  { marca: 'PROPRIETARIA', campo: 'Proprietários' },
  { marca: 'CAPITALSOCIAL', campo: 'Capital social' },
  { marca: 'RECEITABRUTAANUAL', campo: 'Receita bruta anual' },
  { marca: 'DATADAANALISE', campo: 'Data da análise' },
  { marca: 'RESPONSAVELPELAANALISE', campo: 'Responsável pela análise' },
  /* vai para a coluna de regime da própria empresa, não para um campo de serviço */
  { marca: 'REGIMETRIBUTARIO', campo: 'Regime', doCabecalho: true },
  { marca: 'REGIME', campo: 'Regime', doCabecalho: true }
];

function semAcento_(texto) {
  return String(texto || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
}

/**
 * Lê a lista de clientes como ela chega do Goiás Fomento: blocos separados por
 * uma linha de pontos, com a razão social solta logo antes do CNPJ.
 */
function interpretarListaDeClientes_(texto, recusados) {
  const blocos = String(texto || '').split(/^[\s.]*\.{5,}[\s.]*$/m);
  const clientes = [];

  blocos.forEach(function (bloco) {
    const linhas = bloco.split(/\n/).map(function (l) { return l.trim(); })
      .filter(function (l) { return l !== ''; });

    let posicaoCNPJ = -1;
    let cnpj = '';
    linhas.forEach(function (linha, i) {
      if (posicaoCNPJ >= 0) return;
      const so = linha.replace(/[^0-9A-Za-z]/g, '');
      if (so.length === 14 && cnpjValido_(so)) { posicaoCNPJ = i; cnpj = normalizarCNPJ_(so); }
    });
    if (posicaoCNPJ < 0) {
      // uma linha solta é título da lista, não cliente perdido
      if (recusados && linhas.length > 1) {
        recusados.push({ trecho: linhas.slice(0, 2).join(' · ').slice(0, 80),
                         motivo: 'sem CNPJ válido' });
      }
      return;
    }

    const dados = {};
    let razaoSocial = '';

    linhas.forEach(function (linha, i) {
      const corte = linha.indexOf(':');
      // o rótulo chega com acento, ponto, espaço e "(A)": compara só as letras
      const possivelRotulo = corte > 0
        ? semAcento_(linha.slice(0, corte)).replace(/[^A-Z-]/g, '')
        : '';
      const rotulo = ROTULOS_DA_LISTA.filter(function (r) {
        const marca = r.marca.replace(/[^A-Z-]/g, '');
        return possivelRotulo === marca || possivelRotulo.indexOf(marca) === 0;
      })[0];

      if (rotulo) {
        let valor = linha.slice(corte + 1).trim().replace(/\s{2,}/g, ' ');
        if (!valor) return;

        // e-mail vem vários na mesma linha; telefone vem um por linha
        if (rotulo.variosPorLinha) valor = valor.split(/\s+/).join(' · ');

        dados[rotulo.campo] = (rotulo.junta && dados[rotulo.campo])
          ? dados[rotulo.campo] + ' · ' + valor
          : valor;
        return;
      }

      // sem rótulo e antes do CNPJ: a última dessas é a razão social
      if (i < posicaoCNPJ && corte < 0) razaoSocial = linha;
    });

    if (!razaoSocial) {
      if (recusados) {
        recusados.push({ trecho: formatarCNPJ_(cnpj), motivo: 'sem razão social antes do CNPJ' });
      }
      return;
    }
    clientes.push({ nome: razaoSocial, cnpj: cnpj, campos: dados });
  });

  return clientes;
}

/** Quantos clientes o texto tem, e o que já está cadastrado — sem gravar nada. */
function conferirListaDeClientes(texto, servico) {
  const recusados = [];
  const clientes = interpretarListaDeClientes_(texto, recusados);
  const indice = indiceDeEmpresas_(servico);

  return {
    total: clientes.length,
    recusados: recusados,
    clientes: clientes.map(function (c) {
      const linha = indice.porCNPJ[c.cnpj] !== undefined
        ? indice.porCNPJ[c.cnpj]
        : indice.porNome[c.nome.toUpperCase()];
      return {
        nome: c.nome,
        cnpj: formatarCNPJ_(c.cnpj),
        jaCadastrado: linha !== undefined,
        comoFoiAchado: linha === undefined ? ''
          : (indice.porCNPJ[c.cnpj] !== undefined ? 'pelo CNPJ' : 'pelo nome'),
        tambemEm: indice.emOutrosServicos[c.nome.toUpperCase()] || '',
        campos: c.campos
      };
    })
  };
}

/**
 * O que já está na planilha, indexado **por serviço**: a mesma empresa pode ser
 * cliente de mais de um serviço, e cada um é um trabalho à parte, com seu
 * próprio fluxo e seu próprio andamento — logo, sua própria linha.
 */
function indiceDeEmpresas_(doServico) {
  const servico = String(doServico || '').trim();
  const sheet = aba_();
  const ultimaLinha = sheet.getLastRow();
  const porCNPJ = {};
  const porNome = {};
  const emOutrosServicos = {};
  if (ultimaLinha < PRIMEIRA_LINHA) {
    return { porCNPJ: porCNPJ, porNome: porNome, emOutrosServicos: emOutrosServicos };
  }

  const quantidade = ultimaLinha - PRIMEIRA_LINHA + 1;
  const nomes = sheet.getRange(PRIMEIRA_LINHA, COL.empresa, quantidade, 1).getValues();
  const cnpjs = sheet.getRange(PRIMEIRA_LINHA, COL.cnpj, quantidade, 1).getValues();
  const servicos = sheet.getRange(PRIMEIRA_LINHA, COL.servico, quantidade, 1).getValues();

  nomes.forEach(function (l, i) {
    const nome = texto_(l[0]);
    if (!nome) return;
    const linha = PRIMEIRA_LINHA + i;
    const chave = nome.toUpperCase();
    const dela = texto_(servicos[i][0]);

    if (dela !== servico) {
      if (emOutrosServicos[chave] === undefined) emOutrosServicos[chave] = dela || '(sem serviço)';
      return;
    }

    if (porNome[chave] === undefined) porNome[chave] = linha;
    lerCNPJs_(cnpjs[i][0]).forEach(function (c) {
      if (porCNPJ[c] === undefined) porCNPJ[c] = linha;
    });
  });

  return { porCNPJ: porCNPJ, porNome: porNome, emOutrosServicos: emOutrosServicos };
}

function cnpjsJaCadastrados_() {
  const sheet = aba_();
  const ultimaLinha = sheet.getLastRow();
  if (ultimaLinha < PRIMEIRA_LINHA) return [];

  const valores = sheet
    .getRange(PRIMEIRA_LINHA, COL.cnpj, ultimaLinha - PRIMEIRA_LINHA + 1, 1)
    .getValues();

  const lista = [];
  valores.forEach(function (l) {
    lerCNPJs_(l[0]).forEach(function (c) { if (lista.indexOf(c) < 0) lista.push(c); });
  });
  return lista;
}

/**
 * Cadastra os clientes da lista no serviço indicado. Quem já estiver na planilha
 * pelo CNPJ é deixado de lado — a lista costuma vir repetida entre as remessas.
 */
/** Preenche uma célula só se ela estiver vazia — não se sobrescreve trabalho feito. */
function completarSeVazio_(linha, coluna, valor, rotulo) {
  if (!coluna || valor === '' || valor === null || valor === undefined) return false;
  const celula = aba_().getRange(linha, coluna);
  if (texto_(celula.getValue()) !== '') return false;
  salvarCelula(linha, coluna, valor, 'texto', rotulo);
  return true;
}

/**
 * Cadastra os clientes da lista. Quem já está na planilha — pelo CNPJ ou pelo
 * nome — não vira uma segunda linha: os campos que estiverem em branco nele
 * são completados com o que veio na lista, e o que já estava preenchido fica
 * como está.
 */
function importarClientes(texto, servico) {
  const doServico = String(servico || '').trim();
  if (!doServico) throw new Error('Escolha o serviço dos clientes.');
  if (listarServicos_().indexOf(doServico) < 0) {
    throw new Error('"' + doServico + '" não está na lista de serviços.');
  }

  const clientes = interpretarListaDeClientes_(texto);
  if (!clientes.length) {
    throw new Error('Não reconheci nenhum cliente nesse texto. ' +
      'Cada bloco precisa ter a razão social e o CNPJ.');
  }

  const indice = indiceDeEmpresas_(doServico);
  const criados = [];
  const atualizados = [];
  const tambemEmOutro = [];

  clientes.forEach(function (cliente) {
    const jaExistia = indice.porCNPJ[cliente.cnpj] !== undefined
      ? indice.porCNPJ[cliente.cnpj]
      : indice.porNome[cliente.nome.toUpperCase()];

    let linha = jaExistia;
    if (linha === undefined) {
      // a mesma empresa pode já ser cliente de outro serviço: isso não impede
      // a linha nova, porque cada serviço é um trabalho com fluxo próprio
      const outro = indice.emOutrosServicos[cliente.nome.toUpperCase()];
      if (outro) tambemEmOutro.push(cliente.nome + ' (já em ' + outro + ')');

      linha = criarEmpresa(cliente.nome).linha;
      salvarCelula(linha, COL.servico, doServico, 'texto', 'serviço');
      criados.push(cliente.nome);
    }

    let mexeu = false;
    if (completarSeVazio_(linha, COL.cnpj, formatarCNPJ_(cliente.cnpj), 'CNPJ')) mexeu = true;

    Object.keys(cliente.campos).forEach(function (rotulo) {
      if (rotulo === 'Regime') {
        if (completarSeVazio_(linha, COL.regime, cliente.campos[rotulo], 'regime tributário')) {
          mexeu = true;
        }
        return;
      }
      const campo = campos_().filter(function (c) {
        return c.rotulo === rotulo &&
          (!c.servicos.length || c.servicos.indexOf(doServico) >= 0);
      })[0];
      if (campo && completarSeVazio_(linha, campo.coluna, cliente.campos[rotulo], rotulo)) {
        mexeu = true;
      }
    });

    if (jaExistia !== undefined) {
      indice.porCNPJ[cliente.cnpj] = linha;
      if (mexeu) atualizados.push(cliente.nome);
    } else {
      indice.porCNPJ[cliente.cnpj] = linha;
      indice.porNome[cliente.nome.toUpperCase()] = linha;
    }
  });

  SpreadsheetApp.flush();
  escreverLog_('(importação)', 'Lista aplicada em ' + doServico, '',
    criados.length + ' cadastradas, ' + atualizados.length + ' completadas');

  const painel = carregarPainel();
  painel.importacao = { criados: criados, repetidos: atualizados, atualizados: atualizados,
                        tambemEmOutroServico: tambemEmOutro };
  return painel;
}

/**
 * Desfaz uma importação: exclui as empresas com exatamente estes nomes, do fim
 * para o começo, para as linhas não se deslocarem no meio do caminho. Cada uma
 * vai para a aba `Excluidas`, como qualquer exclusão.
 */
function desfazerImportacao(nomes) {
  const lista = (nomes || []).map(function (n) { return String(n).trim(); })
    .filter(function (n) { return n !== ''; });
  if (!lista.length) throw new Error('Nada para desfazer.');

  const sheet = aba_();
  const ultimaLinha = sheet.getLastRow();
  if (ultimaLinha < PRIMEIRA_LINHA) return carregarPainel();

  const valores = sheet
    .getRange(PRIMEIRA_LINHA, COL.empresa, ultimaLinha - PRIMEIRA_LINHA + 1, 1)
    .getValues();

  const alvos = [];
  valores.forEach(function (l, i) {
    if (lista.indexOf(texto_(l[0])) >= 0) alvos.push(PRIMEIRA_LINHA + i);
  });

  const removidos = [];
  alvos.reverse().forEach(function (linha) {
    const nome = texto_(sheet.getRange(linha, COL.empresa).getValue());
    const conteudo = sheet.getRange(linha, 1, 1, totalColunas_()).getDisplayValues()[0];
    arquivarExcluida_(conteudo);
    sheet.deleteRow(linha);
    removidos.push(nome);
  });

  SpreadsheetApp.flush();
  escreverLog_('(importação)', 'Importação desfeita', removidos.length + ' empresas',
    'arquivadas na aba ' + ABA_EXCLUIDAS);

  const painel = carregarPainel();
  painel.desfeito = removidos;
  return painel;
}

/* ------------------------------------------------------------------ *
 * Serviço contratado                                                  *
 * ------------------------------------------------------------------ */

function abaServicos_() {
  const planilha = planilha_();
  let sheet = planilha.getSheetByName(ABA_SERVICOS);
  if (sheet) return sheet;

  sheet = planilha.insertSheet(ABA_SERVICOS);
  sheet.appendRow(['Serviço']);
  sheet.getRange(1, 1).setFontWeight('bold');
  sheet.setFrozenRows(1);
  SERVICOS_PADRAO.forEach(function (nome) { sheet.appendRow([nome]); });
  return sheet;
}

function listarServicos_() {
  const sheet = abaServicos_();
  if (sheet.getLastRow() < 2) return [];
  return sheet
    .getRange(2, 1, sheet.getLastRow() - 1, 1)
    .getValues()
    .map(function (l) { return texto_(l[0]); })
    .filter(function (nome) { return nome !== ''; });
}

/** Acrescenta um serviço à lista — é assim que entram os "e outros". */
function criarServico(nome) {
  const limpo = String(nome || '').trim();
  if (!limpo) throw new Error('Informe o nome do serviço.');

  const existentes = listarServicos_();
  if (existentes.some(function (s) { return s.toUpperCase() === limpo.toUpperCase(); })) {
    throw new Error('Esse serviço já está na lista.');
  }

  abaServicos_().appendRow([limpo]);
  SpreadsheetApp.flush();
  escreverLog_('(serviços)', 'Serviço incluído na lista', '', limpo);
  return carregarPainel();
}

/**
 * Marca de uma vez todas as empresas que ainda estão sem serviço.
 * A planilha nasceu só de planejamento tributário, então preencher uma a uma
 * seria trabalho à toa — mas quem decide o valor é quem chama.
 */
function definirServicoDasSemServico(servico) {
  const limpo = String(servico || '').trim();
  if (!limpo) throw new Error('Informe o serviço.');
  if (listarServicos_().indexOf(limpo) < 0) {
    throw new Error('"' + limpo + '" não está na lista de serviços.');
  }

  const sheet = aba_();
  const ultimaLinha = sheet.getLastRow();
  if (ultimaLinha < PRIMEIRA_LINHA) return carregarPainel();

  const quantidade = ultimaLinha - PRIMEIRA_LINHA + 1;
  const nomes = sheet.getRange(PRIMEIRA_LINHA, COL.empresa, quantidade, 1).getValues();
  const servicos = sheet.getRange(PRIMEIRA_LINHA, COL.servico, quantidade, 1).getValues();

  let mexidas = 0;
  const novos = servicos.map(function (l, i) {
    if (texto_(nomes[i][0]) === '' || texto_(l[0]) !== '') return [l[0]];
    mexidas++;
    return [limpo];
  });

  if (mexidas) {
    sheet.getRange(PRIMEIRA_LINHA, COL.servico, novos.length, 1).setValues(novos);
    SpreadsheetApp.flush();
    escreverLog_('(serviços)', 'Serviço preenchido em massa', mexidas + ' empresas sem serviço', limpo);
  }
  return carregarPainel();
}

function garantirColunaServico_() {
  const sheet = aba_();
  const titulo = sheet.getRange(2, COLUNA_SERVICO);
  if (texto_(titulo.getValue()) === '') {
    titulo.setValue('Serviço');
    titulo.setFontWeight('bold');
  }
}

/** Cria o cabeçalho da coluna de CNPJ na primeira vez que o painel abre. */
function garantirColunaCNPJ_() {
  const sheet = aba_();
  const titulo = sheet.getRange(2, COLUNA_CNPJ);
  if (texto_(titulo.getValue()) === '') {
    titulo.setValue('CNPJ');
    titulo.setFontWeight('bold');
  }
}

/* ------------------------------------------------------------------ *
 * Abertura                                                            *
 * ------------------------------------------------------------------ */

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('📋 Planejamento')
    .addItem('Abrir painel', 'abrirPainel')
    .addToUi();
}

function abrirPainel() {
  const html = HtmlService.createHtmlOutputFromFile('Index')
    .setWidth(1600)
    .setHeight(1000);
  SpreadsheetApp.getUi().showModalDialog(html, 'Controle de Planejamento Tributário');
}

function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('Controle de Planejamento Tributário')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/* ------------------------------------------------------------------ *
 * Leitura                                                             *
 * ------------------------------------------------------------------ */

function aba_() {
  return planilha_().getSheetByName(ABA_DADOS);
}

/** Converte o que estiver na célula de data para ISO (aaaa-mm-dd) ou ''. */
function paraISO_(valor) {
  if (valor === '' || valor === null || valor === undefined) return '';
  if (valor instanceof Date) return Utilities.formatDate(valor, FUSO, 'yyyy-MM-dd');
  const texto = String(valor).trim();
  if (!texto || texto === '-') return '';
  const m = texto.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return m[3] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[1]).slice(-2);
  return '';
}

function paraBool_(valor) {
  if (valor === true) return true;
  return String(valor).trim().toUpperCase() === 'TRUE';
}

function texto_(valor) {
  if (valor === null || valor === undefined) return '';
  if (valor instanceof Date) return Utilities.formatDate(valor, FUSO, 'dd/MM/yyyy');
  return String(valor).trim();
}

function hojeISO_() {
  return Utilities.formatDate(new Date(), FUSO, 'yyyy-MM-dd');
}

function diasEntre_(isoA, isoB) {
  const a = new Date(isoA + 'T12:00:00');
  const b = new Date(isoB + 'T12:00:00');
  return Math.round((b - a) / 86400000);
}

/** Monta o objeto completo de uma empresa a partir da linha bruta. */
function montarEmpresa_(linhaNumero, valores) {
  const v = function (col) { return valores[col - 1]; };

  const empresa = {
    linha: linhaNumero,
    numero: texto_(v(COL.numero)),
    nome: texto_(v(COL.empresa)),
    contato: texto_(v(COL.contato)),
    dataContrato: paraISO_(v(COL.dataContrato)),
    assinatura: paraBool_(v(COL.assinatura)),
    prazoCombinado: texto_(v(COL.prazoCombinado)),
    previsaoEntrega: paraISO_(v(COL.previsaoEntrega)),
    entregaEfetiva: paraISO_(v(COL.entregaEfetiva)),
    regime: texto_(v(COL.regime)),
    observacao: texto_(v(COL.observacao)),
    servico: texto_(v(COL.servico)),
    campos: campos_().map(function (campo) {
      const bruto = v(campo.coluna);
      return {
        id: campo.id, rotulo: campo.rotulo, tipo: campo.tipo, servico: campo.servico,
        servicos: campo.servicos, opcoes: campo.listaDeOpcoes,
        valor: campo.tipo === 'data' ? paraISO_(bruto)
          : (campo.tipo === 'sim/não' ? paraBool_(bruto) : texto_(bruto))
      };
    }),
    cnpjs: lerCNPJs_(v(COL.cnpj)).map(function (c) {
      return { numero: c, formatado: formatarCNPJ_(c), valido: cnpjValido_(c) };
    }),
    etapas: []
  };

  // Sem CNPJ preenchido, ofereço o que estiver escrito na observação — sem gravar
  // nada: boa parte dessas empresas é grupo, e só quem conhece o caso sabe qual é o principal.
  empresa.cnpjSugerido = empresa.cnpjs.length ? [] :
    garimparCNPJs_(empresa.observacao).map(function (c) {
      return { numero: c, formatado: formatarCNPJ_(c) };
    });

  const naoAplica = lerNaoAplica_(v(COL.naoAplica));
  let concluidasEquivalentes = 0;
  let aplicaveis = 0;

  etapas_().forEach(function (def) {
    const etapa = {
      id: def.id,
      sigla: def.sigla,
      posicao: empresa.etapas.length + 1,
      servicos: def.servicos || [],
      doServico: etapaValePara_(def, empresa.servico),
      naoSeAplica: naoAplica.indexOf(def.id) >= 0,
      nome: def.nome,
      responsavel: texto_(v(def.resp)),
      data: paraISO_(v(def.data)),
      concluido: false,
      rotuloData: rotulosDe_(def.id).data,
      documentos: null
    };

    if (def.docInicio) {
      etapa.documentos = [];
      for (let c = def.docInicio; c <= def.docFim; c++) {
        etapa.documentos.push({
          coluna: c,
          nome: DOCUMENTOS[c - def.docInicio],
          entregue: paraBool_(v(c))
        });
      }
      const entregues = etapa.documentos.filter(function (d) { return d.entregue; }).length;
      etapa.progresso = entregues / etapa.documentos.length;
      etapa.concluido = entregues === etapa.documentos.length;
    } else {
      etapa.concluido = paraBool_(v(def.concluido));
      etapa.progresso = etapa.concluido ? 1 : 0;
    }

    if (def.dataFinal) {
      etapa.dataFinal = paraISO_(v(def.dataFinal));
      etapa.rotuloDataFinal = rotulosDe_(def.id).dataFinal;
    }
    if (def.obs) etapa.observacao = texto_(v(def.obs));

    if (!etapa.doServico) {
      // a etapa existe, mas não pertence ao serviço que esta empresa contratou
      etapa.progresso = 0;
      etapa.foraDoServico = true;
    } else if (etapa.naoSeAplica) {
      etapa.progresso = 0;
      etapa.concluido = false;
    } else {
      aplicaveis++;
      concluidasEquivalentes += etapa.progresso;
    }
    empresa.etapas.push(etapa);
  });

  // Sem nenhuma etapa aplicável não há o que fazer: o trabalho está completo.
  empresa.etapasAplicaveis = aplicaveis;
  empresa.progresso = aplicaveis === 0 ? 1 : concluidasEquivalentes / aplicaveis;

  const pendente = empresa.etapas.filter(function (e) {
    return !e.concluido && !e.naoSeAplica && e.doServico;
  })[0];
  empresa.etapaAtual = pendente ? pendente.nome : 'Concluído';
  empresa.etapaAtualId = pendente ? pendente.id : '';
  empresa.etapaAtualSigla = pendente ? pendente.sigla : '';
  empresa.etapaAtualPosicao = pendente ? pendente.posicao : etapas_().length;
  empresa.responsavelAtual = pendente ? pendente.responsavel : '';
  empresa.etapasConcluidas = empresa.etapas.filter(function (e) { return e.concluido; }).length;
  empresa.etapasNaoAplicaveis = empresa.etapas.filter(function (e) { return e.naoSeAplica; }).length;

  aplicarParada_(empresa);
  aplicarPrazo_(empresa);
  return empresa;
}

/**
 * Há quanto tempo a empresa não anda: a data mais recente registrada em qualquer
 * etapa. É o que diz se um trabalho está apenas em andamento ou esquecido.
 */
function aplicarParada_(empresa) {
  const hoje = hojeISO_();
  let ultima = '';

  empresa.etapas.forEach(function (etapa) {
    [etapa.data, etapa.dataFinal].forEach(function (data) {
      if (data && data <= hoje && data > ultima) ultima = data;
    });
  });

  empresa.ultimaMovimentacao = ultima;
  empresa.diasParada = ultima ? diasEntre_(ultima, hoje) : null;
}

/** Define status e dias restantes a partir da previsão e da entrega efetiva. */
function aplicarPrazo_(empresa) {
  const hoje = hojeISO_();

  if (empresa.entregaEfetiva) {
    const atraso = empresa.previsaoEntrega
      ? diasEntre_(empresa.previsaoEntrega, empresa.entregaEfetiva)
      : 0;
    empresa.status = atraso > 0 ? 'entregue_atraso' : 'entregue';
    empresa.diasRestantes = null;
    empresa.diasAtraso = atraso > 0 ? atraso : 0;
    return;
  }

  if (!empresa.previsaoEntrega) {
    empresa.status = 'sem_prazo';
    empresa.diasRestantes = null;
    return;
  }

  const dias = diasEntre_(hoje, empresa.previsaoEntrega);
  empresa.diasRestantes = dias;
  if (dias < 0) empresa.status = 'atrasado';
  else if (dias <= 7) empresa.status = 'semana';
  else empresa.status = 'em_dia';
}

/** Carrega tudo o que a tela precisa numa única chamada. */
function carregarPainel() {
  esquecerEtapas_();
  garantirColunaCNPJ_();
  garantirColunaServico_();
  garantirColunaNaoAplica_();
  esquecerCampos_();
  garantirEstruturaInicial_();
  const sheet = aba_();
  const ultimaLinha = sheet.getLastRow();
  const empresas = [];

  if (ultimaLinha >= PRIMEIRA_LINHA) {
    const valores = sheet
      .getRange(PRIMEIRA_LINHA, 1, ultimaLinha - PRIMEIRA_LINHA + 1, totalColunas_())
      .getValues();

    valores.forEach(function (linha, i) {
      if (!texto_(linha[COL.empresa - 1])) return;
      empresas.push(montarEmpresa_(PRIMEIRA_LINHA + i, linha));
    });
  }

  return {
    empresas: empresas,
    etapas: etapas_().map(function (e, i) {
      return { id: e.id, sigla: e.sigla, nome: e.nome, posicao: i + 1,
               tipo: e.tipo, removivel: e.tipo !== 'documentos',
               servicos: e.servicos || [] };
    }),
    usuarios: listarUsuarios_(),
    servicos: listarServicos_(),
    camposDeServico: campos_().map(function (c) {
      return { id: c.id, rotulo: c.rotulo, tipo: c.tipo, servico: c.servico,
               servicos: c.servicos, opcoes: c.listaDeOpcoes };
    }),
    tiposDeCampo: TIPOS_DE_CAMPO,
    regimes: REGIMES,
    hoje: hojeISO_(),
    usuarioAtual: Session.getActiveUser().getEmail() || ''
  };
}

function listarUsuarios_() {
  const sheet = planilha_().getSheetByName(ABA_USUARIOS);
  if (!sheet || sheet.getLastRow() < 2) return [];
  return sheet
    .getRange(2, 1, sheet.getLastRow() - 1, 1)
    .getValues()
    .map(function (l) { return texto_(l[0]); })
    .filter(function (nome) { return nome !== ''; });
}

function carregarEmpresa(linha) {
  const valores = aba_().getRange(linha, 1, 1, totalColunas_()).getValues()[0];
  return montarEmpresa_(linha, valores);
}

/* ------------------------------------------------------------------ *
 * Escrita                                                             *
 * ------------------------------------------------------------------ */

/**
 * Grava um valor numa célula e registra na trilha de auditoria.
 * tipo: 'texto' | 'data' | 'bool'
 */
function salvarCelula(linha, coluna, valor, tipo, descricao) {
  const sheet = aba_();
  const celula = sheet.getRange(linha, coluna);
  const anterior = celula.getDisplayValue();

  let novo;
  if (tipo === 'bool') {
    novo = valor === true || valor === 'true';
  } else if (tipo === 'data') {
    novo = valor ? new Date(valor + 'T12:00:00') : '';
  } else {
    novo = valor === null || valor === undefined ? '' : valor;
  }

  celula.setValue(novo);
  SpreadsheetApp.flush();

  registrarLog_(linha, descricao || ('Coluna ' + coluna), anterior, celula.getDisplayValue());
  return carregarEmpresa(linha);
}

/**
 * Marca ou desmarca uma etapa. Ao concluir sem data preenchida,
 * carimba a data de hoje — que é o que hoje se esquece na planilha.
 */
function alternarEtapa(linha, etapaId, concluido) {
  const def = acharEtapa_(etapaId);
  const sheet = aba_();

  // concluir uma etapa marcada como "não se aplica" reativa a etapa
  if (concluido === true) {
    const marcadas = lerNaoAplica_(sheet.getRange(linha, COL.naoAplica).getValue());
    if (marcadas.indexOf(etapaId) >= 0) {
      sheet.getRange(linha, COL.naoAplica)
        .setValue(marcadas.filter(function (id) { return id !== etapaId; }).join(', '));
      registrarLog_(linha, def.nome + ' — não se aplica', 'sim', 'não');
    }
  }

  if (def.docInicio) {
    // A etapa de documentação é concluída marcando os 10 documentos.
    const valores = [];
    for (let c = def.docInicio; c <= def.docFim; c++) valores.push(concluido === true);
    sheet.getRange(linha, def.docInicio, 1, valores.length).setValues([valores]);
    registrarLog_(linha, def.nome + ' — todos os documentos',
      concluido ? 'pendentes' : 'entregues', concluido ? 'entregues' : 'pendentes');
  } else {
    const celula = sheet.getRange(linha, def.concluido);
    const anterior = celula.getDisplayValue();
    celula.setValue(concluido === true);
    registrarLog_(linha, def.nome + ' — concluído', anterior, String(concluido === true));
  }

  if (concluido === true && def.data) {
    const celulaData = sheet.getRange(linha, def.data);
    const atual = texto_(celulaData.getValue());
    if (!atual || atual === '-') {
      celulaData.setValue(new Date());
      registrarLog_(linha, def.nome + ' — ' + rotulosDe_(def.id).data, '(vazio)', 'hoje');
    }
  }

  SpreadsheetApp.flush();
  return carregarEmpresa(linha);
}

function alternarDocumento(linha, coluna, entregue) {
  const docs = etapaDeDocumentos_();
  const nome = (docs && DOCUMENTOS[coluna - docs.docInicio]) || ('Documento ' + coluna);
  return salvarCelula(linha, coluna, entregue === true, 'bool', 'Documento: ' + nome);
}

function salvarEtapaCampo(linha, etapaId, campo, valor) {
  const def = acharEtapa_(etapaId);
  const rotulos = rotulosDe_(def.id);

  const mapa = {
    responsavel: { coluna: def.resp, tipo: 'texto', rotulo: 'responsável' },
    data: { coluna: def.data, tipo: 'data', rotulo: rotulos.data },
    dataFinal: { coluna: def.dataFinal, tipo: 'data', rotulo: rotulos.dataFinal },
    observacao: { coluna: def.obs, tipo: 'texto', rotulo: 'observações' }
  };

  const alvo = mapa[campo];
  if (!alvo || !alvo.coluna) throw new Error('Campo indisponível nesta etapa: ' + campo);

  return salvarCelula(linha, alvo.coluna, valor, alvo.tipo, def.nome + ' — ' + alvo.rotulo);
}

function salvarCabecalho(linha, campo, valor) {
  const mapa = {
    numero: { coluna: COL.numero, tipo: 'texto', rotulo: 'número' },
    nome: { coluna: COL.empresa, tipo: 'texto', rotulo: 'empresa' },
    contato: { coluna: COL.contato, tipo: 'texto', rotulo: 'responsável do cliente' },
    dataContrato: { coluna: COL.dataContrato, tipo: 'data', rotulo: 'data do contrato' },
    assinatura: { coluna: COL.assinatura, tipo: 'bool', rotulo: 'assinatura do contrato' },
    prazoCombinado: { coluna: COL.prazoCombinado, tipo: 'texto', rotulo: 'prazo combinado' },
    previsaoEntrega: { coluna: COL.previsaoEntrega, tipo: 'data', rotulo: 'previsão de entrega' },
    entregaEfetiva: { coluna: COL.entregaEfetiva, tipo: 'data', rotulo: 'entrega efetiva' },
    regime: { coluna: COL.regime, tipo: 'texto', rotulo: 'regime tributário' },
    observacao: { coluna: COL.observacao, tipo: 'texto', rotulo: 'observações do cliente' },
    cnpj: { coluna: COL.cnpj, tipo: 'texto', rotulo: 'CNPJ' },
    servico: { coluna: COL.servico, tipo: 'texto', rotulo: 'serviço' }
  };

  const alvo = mapa[campo];
  if (!alvo) throw new Error('Campo desconhecido: ' + campo);

  if (campo === 'cnpj') {
    const lista = lerCNPJs_(valor);
    const errados = lista.filter(function (c) { return !cnpjValido_(c); });
    if (errados.length) {
      throw new Error('CNPJ inválido: ' + errados.map(formatarCNPJ_).join(', ') +
        '. Confira os dígitos — nada foi gravado.');
    }
    valor = lista.map(formatarCNPJ_).join(', ');
  }

  return salvarCelula(linha, alvo.coluna, valor, alvo.tipo, alvo.rotulo);
}

/** Cria uma empresa nova no fim da lista, copiando o formato da última linha. */
function criarEmpresa(nome) {
  const limpo = String(nome || '').trim();
  if (!limpo) throw new Error('Informe o nome da empresa.');

  const sheet = aba_();
  const ultima = sheet.getLastRow();
  const nova = ultima + 1;

  const largura = totalColunas_();
  sheet.getRange(ultima, 1, 1, largura).copyTo(
    sheet.getRange(nova, 1, 1, largura),
    SpreadsheetApp.CopyPasteType.PASTE_FORMAT,
    false
  );

  // Limpa o conteúdo herdado, preservando as fórmulas de percentual.
  const percentualDosDocumentos = (etapaDeDocumentos_() || {}).colunaPercentual;
  for (let c = 1; c <= largura; c++) {
    if (c === COL.percentual || c === percentualDosDocumentos) continue;
    const celula = sheet.getRange(nova, c);
    if (celula.getFormula()) continue;
    celula.clearContent();
  }

  sheet.getRange(nova, COL.numero).setValue(nova - PRIMEIRA_LINHA + 1);
  sheet.getRange(nova, COL.empresa).setValue(limpo);
  SpreadsheetApp.flush();

  registrarLog_(nova, 'Empresa criada', '', limpo);
  return carregarEmpresa(nova);
}

/**
 * Exclui uma empresa da planilha.
 *
 * Antes de apagar, a linha inteira vai para a aba `Excluidas` com data e autor —
 * é dado de cliente, e `deleteRow` não tem volta. Para não apagar a empresa errada,
 * exige que o nome tenha sido digitado igual ao que está na planilha.
 */
function excluirEmpresa(linha, nomeConfirmado) {
  if (linha < PRIMEIRA_LINHA) {
    throw new Error('Essa linha é cabeçalho da planilha e não pode ser excluída.');
  }

  const sheet = aba_();
  if (linha > sheet.getLastRow()) throw new Error('Essa linha não existe mais. Atualize o painel.');

  const valores = sheet.getRange(linha, 1, 1, totalColunas_()).getDisplayValues()[0];
  const nome = texto_(valores[COL.empresa - 1]);
  if (!nome) throw new Error('Não há empresa nessa linha.');

  const digitado = String(nomeConfirmado || '').trim().toUpperCase();
  if (digitado !== nome.toUpperCase()) {
    throw new Error('O nome digitado não confere com "' + nome + '". Nada foi excluído.');
  }

  arquivarExcluida_(valores);
  sheet.deleteRow(linha);
  SpreadsheetApp.flush();

  escreverLog_(nome, 'Empresa excluída', nome, 'arquivada na aba ' + ABA_EXCLUIDAS);
  return carregarPainel();
}

/** Rótulos das 72 colunas, juntando as duas linhas de cabeçalho da planilha. */
function rotulosColunas_() {
  const largura = totalColunas_();
  const cabecalho = aba_().getRange(2, 1, 2, largura).getDisplayValues();
  const rotulos = [];
  let grupo = '';
  for (let c = 0; c < largura; c++) {
    if (texto_(cabecalho[0][c])) grupo = texto_(cabecalho[0][c]);
    const campo = texto_(cabecalho[1][c]);
    rotulos.push(campo ? grupo + ' — ' + campo : grupo);
  }
  return rotulos;
}

function abaExcluidas_() {
  const planilha = planilha_();
  let sheet = planilha.getSheetByName(ABA_EXCLUIDAS);
  const largura = totalColunas_() + 2;

  if (!sheet) {
    sheet = planilha.insertSheet(ABA_EXCLUIDAS);
    sheet.appendRow(['Excluída em', 'Excluída por'].concat(rotulosColunas_()));
    sheet.getRange(1, 1, 1, largura).setFontWeight('bold');
    sheet.setFrozenRows(1);
    return sheet;
  }

  // a planilha ganha colunas com o tempo (campos, etapas): o cabeçalho tem de acompanhar,
  // senão o que for arquivado daqui para frente sai sem nome de coluna
  if (sheet.getLastColumn() < largura) {
    sheet.getRange(1, 1, 1, largura)
      .setValues([['Excluída em', 'Excluída por'].concat(rotulosColunas_())])
      .setFontWeight('bold');
  }
  return sheet;
}

function arquivarExcluida_(valores) {
  abaExcluidas_().appendRow(
    [new Date(), Session.getActiveUser().getEmail() || 'desconhecido'].concat(valores));
}

/** Empresas já excluídas, da mais recente para a mais antiga. */
function listarExcluidas(limite) {
  const sheet = abaExcluidas_();
  const total = sheet.getLastRow();
  if (total < 2) return [];

  const quantas = Math.min(limite || 50, total - 1);
  const valores = sheet.getRange(total - quantas + 1, 1, quantas, sheet.getLastColumn()).getValues();

  return valores.reverse().map(function (l) {
    return {
      quando: l[0] instanceof Date ? Utilities.formatDate(l[0], FUSO, 'dd/MM/yyyy HH:mm') : texto_(l[0]),
      quem: texto_(l[1]),
      empresa: texto_(l[COL.empresa + 1]),
      contato: texto_(l[COL.contato + 1]),
      regime: texto_(l[COL.regime + 1])
    };
  });
}

/**
 * Renumera a coluna N. de cima para baixo, na ordem em que as empresas estão
 * hoje na planilha. Serve para arrumar número repetido e buraco na sequência.
 */
function renumerarEmpresas() {
  const sheet = aba_();
  const ultimaLinha = sheet.getLastRow();
  if (ultimaLinha < PRIMEIRA_LINHA) return carregarPainel();

  const nomes = sheet
    .getRange(PRIMEIRA_LINHA, COL.empresa, ultimaLinha - PRIMEIRA_LINHA + 1, 1)
    .getValues();

  let numero = 0;
  const novos = nomes.map(function (l) {
    if (texto_(l[0]) === '') return [''];
    numero++;
    return [numero];
  });

  sheet.getRange(PRIMEIRA_LINHA, COL.numero, novos.length, 1).setValues(novos);
  SpreadsheetApp.flush();

  escreverLog_('(lista)', 'Empresas renumeradas', '', '1 a ' + numero);
  return carregarPainel();
}

/* ------------------------------------------------------------------ *
 * Exportar para Excel                                                 *
 * ------------------------------------------------------------------ */

/** Como cada etapa aparece na planilha exportada. */
function situacaoDaEtapa_(etapa) {
  if (etapa.foraDoServico) return 'outro serviço';
  if (etapa.naoSeAplica) return 'não se aplica';
  if (etapa.concluido) return 'concluída';
  if (etapa.documentos) {
    const entregues = etapa.documentos.filter(function (d) { return d.entregue; }).length;
    return entregues + ' de ' + etapa.documentos.length + ' documentos';
  }
  return 'pendente';
}

const SITUACOES_POR_EXTENSO = {
  atrasado: 'Atrasado', semana: 'Vence em até 7 dias', em_dia: 'Em dia',
  sem_prazo: 'Sem previsão', entregue: 'Entregue', entregue_atraso: 'Entregue com atraso'
};

/** Monta a matriz que vai para o arquivo: uma linha por empresa, tudo legível. */
function montarExportacao_(linhas) {
  const painel = carregarPainel();
  const alvo = (linhas && linhas.length)
    ? painel.empresas.filter(function (e) { return linhas.indexOf(e.linha) >= 0; })
    : painel.empresas;

  const etapas = painel.etapas;
  const campos = painel.camposDeServico;

  const cabecalho = ['Nº', 'Empresa', 'CNPJ', 'Serviço', 'Regime', 'Responsável do cliente',
    'Em que etapa está', 'Responsável da etapa', 'Progresso', 'Etapas concluídas',
    'Etapas que se aplicam', 'Data do contrato', 'Prazo combinado', 'Previsão de entrega',
    'Entrega efetiva', 'Situação', 'Dias parada', 'Última movimentação', 'Observações']
    .concat(etapas.map(function (et) { return et.posicao + '. ' + et.nome; }))
    .concat(campos.map(function (c) {
      return c.servico ? c.rotulo + ' (' + c.servico + ')' : c.rotulo;
    }));

  const corpo = alvo.map(function (e) {
    const base = [
      e.numero, e.nome,
      (e.cnpjs || []).map(function (c) { return c.formatado; }).join(', '),
      e.servico, e.regime, e.contato,
      e.etapaAtual, e.responsavelAtual,
      Math.round(e.progresso * 100) / 100,
      e.etapasConcluidas, e.etapasAplicaveis,
      e.dataContrato, e.prazoCombinado, e.previsaoEntrega, e.entregaEfetiva,
      SITUACOES_POR_EXTENSO[e.status] || e.status,
      e.diasParada === null ? '' : e.diasParada,
      e.ultimaMovimentacao,
      e.observacao
    ];

    const porEtapa = etapas.map(function (et) {
      const etapa = e.etapas.filter(function (x) { return x.id === et.id; })[0];
      return etapa ? situacaoDaEtapa_(etapa) : '';
    });

    const porCampo = campos.map(function (c) {
      const campo = (e.campos || []).filter(function (x) { return x.id === c.id; })[0];
      if (!campo) return '';
      return campo.valor === true ? 'Sim' : (campo.valor === false ? '' : campo.valor);
    });

    return base.concat(porEtapa).concat(porCampo);
  });

  return { cabecalho: cabecalho, corpo: corpo, quantas: corpo.length };
}

/** Escapa o que vai dentro de um XML do arquivo Excel. */
function escaparXml_(valor) {
  return String(valor === null || valor === undefined ? '' : valor)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&apos;')
    // caracteres de controle quebram o arquivo e o Excel recusa abrir
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
}

function letraDaColuna_(n) {
  let nome = '';
  while (n > 0) {
    const resto = (n - 1) % 26;
    nome = String.fromCharCode(65 + resto) + nome;
    n = Math.floor((n - 1) / 26);
  }
  return nome;
}

/**
 * Monta o .xlsx aqui mesmo, sem depender de conversão externa: um arquivo
 * Excel é um zip com alguns XMLs dentro, e o Apps Script sabe zipar.
 * Texto vai como `inlineStr` e número como número, para o Excel somar e
 * ordenar sem reclamar do formato.
 */
function montarXlsx_(cabecalho, corpo, nomeDaAba) {
  const linhas = [cabecalho].concat(corpo);

  const celulas = linhas.map(function (linha, i) {
    const numeroDaLinha = i + 1;
    const conteudo = linha.map(function (valor, j) {
      const referencia = letraDaColuna_(j + 1) + numeroDaLinha;
      const vazio = valor === null || valor === undefined || valor === '';
      if (vazio) return '';

      const estilo = i === 0 ? ' s="1"' : '';
      const numerico = typeof valor === 'number' && isFinite(valor);
      if (numerico) {
        return '<c r="' + referencia + '"' + estilo + '><v>' + valor + '</v></c>';
      }
      return '<c r="' + referencia + '"' + estilo + ' t="inlineStr"><is><t xml:space="preserve">' +
        escaparXml_(valor) + '</t></is></c>';
    }).join('');

    return '<row r="' + numeroDaLinha + '">' + conteudo + '</row>';
  }).join('');

  const ultimaColuna = letraDaColuna_(Math.max(cabecalho.length, 1));
  const planilha =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ' +
    'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
    '<dimension ref="A1:' + ultimaColuna + Math.max(linhas.length, 1) + '"/>' +
    '<sheetViews><sheetView tabSelected="1" workbookViewId="0">' +
    '<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>' +
    '<selection pane="bottomLeft" activeCell="A2" sqref="A2"/>' +
    '</sheetView></sheetViews>' +
    '<sheetFormatPr defaultRowHeight="15"/>' +
    '<sheetData>' + celulas + '</sheetData>' +
    '<pageMargins left="0.7" right="0.7" top="0.75" bottom="0.75" header="0.3" footer="0.3"/>' +
    '</worksheet>';

  const workbook =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ' +
    'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
    '<fileVersion appName="xl" lastEdited="5" lowestEdited="5" rupBuild="9302"/>' +
    '<workbookPr/>' +
    '<bookViews><workbookView xWindow="0" yWindow="0" windowWidth="20000" windowHeight="12000"/></bookViews>' +
    '<sheets><sheet name="' + escaparXml_(nomeDaAba) + '" sheetId="1" r:id="rId1"/></sheets>' +
    '<calcPr calcId="0"/>' +
    '</workbook>';

  /* O Excel espera estilos e propriedades; sem eles ele recusa abrir o arquivo,
     mesmo que outros leitores aceitem. */
  const estilos =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    '<fonts count="2">' +
      '<font><sz val="11"/><color theme="1"/><name val="Calibri"/><family val="2"/></font>' +
      '<font><b/><sz val="11"/><color theme="1"/><name val="Calibri"/><family val="2"/></font>' +
    '</fonts>' +
    '<fills count="2"><fill><patternFill patternType="none"/></fill>' +
      '<fill><patternFill patternType="gray125"/></fill></fills>' +
    '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
    '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
    '<cellXfs count="2">' +
      '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
      '<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>' +
    '</cellXfs>' +
    '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
    '</styleSheet>';

  const propriedades =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<cp:coreProperties ' +
    'xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" ' +
    'xmlns:dc="http://purl.org/dc/elements/1.1/" ' +
    'xmlns:dcterms="http://purl.org/dc/terms/" ' +
    'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">' +
    '<dc:title>Controle de Planejamento Tributário</dc:title>' +
    '<dc:creator>Azuos Contábil</dc:creator>' +
    '<cp:lastModifiedBy>Azuos Contábil</cp:lastModifiedBy>' +
    '<dcterms:created xsi:type="dcterms:W3CDTF">' +
      Utilities.formatDate(new Date(), 'UTC', "yyyy-MM-dd'T'HH:mm:ss'Z'") + '</dcterms:created>' +
    '</cp:coreProperties>';

  const aplicativo =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" ' +
    'xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">' +
    '<Application>Controle de Planejamento Tributário</Application>' +
    '</Properties>';

  const relacoesDoWorkbook =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rId1" Target="worksheets/sheet1.xml" ' +
    'Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet"/>' +
    '<Relationship Id="rId2" Target="styles.xml" ' +
    'Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles"/>' +
    '</Relationships>';

  const relacoesRaiz =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rId1" Target="xl/workbook.xml" ' +
    'Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument"/>' +
    '<Relationship Id="rId2" Target="docProps/core.xml" ' +
    'Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties"/>' +
    '<Relationship Id="rId3" Target="docProps/app.xml" ' +
    'Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties"/>' +
    '</Relationships>';

  const tipos =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
    '<Default Extension="xml" ContentType="application/xml"/>' +
    '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
    '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' +
    '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
    '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>' +
    '<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>' +
    '</Types>';

  const partes = [
    Utilities.newBlob(tipos, 'application/xml', '[Content_Types].xml'),
    Utilities.newBlob(relacoesRaiz, 'application/xml', '_rels/.rels'),
    Utilities.newBlob(workbook, 'application/xml', 'xl/workbook.xml'),
    Utilities.newBlob(relacoesDoWorkbook, 'application/xml', 'xl/_rels/workbook.xml.rels'),
    Utilities.newBlob(estilos, 'application/xml', 'xl/styles.xml'),
    Utilities.newBlob(planilha, 'application/xml', 'xl/worksheets/sheet1.xml'),
    Utilities.newBlob(propriedades, 'application/xml', 'docProps/core.xml'),
    Utilities.newBlob(aplicativo, 'application/xml', 'docProps/app.xml')
  ];

  return Utilities.zip(partes);
}

/**
 * Gera o arquivo Excel da lista. Não cria nada no Drive nem chama serviço
 * externo: o arquivo é montado aqui e vai direto para o navegador baixar.
 */
function exportarParaExcel(linhas) {
  const dados = montarExportacao_(linhas);
  if (!dados.quantas) throw new Error('Não há empresas para exportar com esses filtros.');

  const carimbo = Utilities.formatDate(new Date(), FUSO, 'yyyy-MM-dd_HH-mm');
  const nomeArquivo = 'Controle_Planejamento_' + carimbo + '.xlsx';
  const arquivo = montarXlsx_(dados.cabecalho, dados.corpo, 'Empresas');

  escreverLog_('(exportação)', 'Exportado para Excel', '',
    dados.quantas + ' empresas · ' + nomeArquivo);

  return {
    nome: nomeArquivo,
    quantas: dados.quantas,
    colunas: dados.cabecalho.length,
    conteudo: Utilities.base64Encode(arquivo.getBytes())
  };
}

/* ------------------------------------------------------------------ *
 * Trilha de auditoria                                                 *
 * ------------------------------------------------------------------ */

function abaLog_() {
  const planilha = planilha_();
  let sheet = planilha.getSheetByName(ABA_LOG);
  if (!sheet) {
    sheet = planilha.insertSheet(ABA_LOG);
    sheet.appendRow(['Quando', 'Quem', 'Empresa', 'O que mudou', 'Valor anterior', 'Valor novo']);
    sheet.getRange(1, 1, 1, 6).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function registrarLog_(linha, descricao, anterior, novo) {
  if (String(anterior) === String(novo)) return;
  try {
    escreverLog_(texto_(aba_().getRange(linha, COL.empresa).getValue()), descricao, anterior, novo);
  } catch (e) {
    console.error('Falha ao registrar log: ' + e.message);
  }
}

/** Escreve no log com o nome da empresa já resolvido — usado quando a linha vai sumir. */
function escreverLog_(empresa, descricao, anterior, novo) {
  try {
    abaLog_().appendRow([
      new Date(),
      Session.getActiveUser().getEmail() || 'desconhecido',
      empresa,
      descricao,
      anterior === '' ? '(vazio)' : anterior,
      novo === '' ? '(vazio)' : novo
    ]);
  } catch (e) {
    console.error('Falha ao registrar log: ' + e.message);
  }
}

function lerLog(limite) {
  const sheet = abaLog_();
  const total = sheet.getLastRow();
  if (total < 2) return [];

  const quantas = Math.min(limite || 100, total - 1);
  const valores = sheet.getRange(total - quantas + 1, 1, quantas, 6).getValues();

  return valores.reverse().map(function (l) {
    return {
      quando: l[0] instanceof Date ? Utilities.formatDate(l[0], FUSO, 'dd/MM/yyyy HH:mm') : texto_(l[0]),
      quem: texto_(l[1]),
      empresa: texto_(l[2]),
      oque: texto_(l[3]),
      anterior: texto_(l[4]),
      novo: texto_(l[5])
    };
  });
}
