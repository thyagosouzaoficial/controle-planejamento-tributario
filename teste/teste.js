/**
 * Testa as funções puras do Codigo.gs contra os dados reais da planilha.
 * Carrega o arquivo do Apps Script num sandbox com a API do Google simulada.
 */
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const RAIZ = path.join(__dirname, '..');
const CSV = process.argv[2];

/* ---- API do Google simulada, só o que o código puro usa ---- */
const sandbox = {
  console,
  Utilities: {
    formatDate: function (data, fuso, formato) {
      const d = new Date(data.getTime() - 3 * 3600000); // America/Sao_Paulo
      const p = (n) => String(n).padStart(2, '0');
      if (formato === 'yyyy-MM-dd') return d.getUTCFullYear() + '-' + p(d.getUTCMonth() + 1) + '-' + p(d.getUTCDate());
      if (formato === 'dd/MM/yyyy') return p(d.getUTCDate()) + '/' + p(d.getUTCMonth() + 1) + '/' + d.getUTCFullYear();
      return d.toISOString();
    }
  },
  Session: { getActiveUser: () => ({ getEmail: () => 'teste@azuos' }) }
};
vm.createContext(sandbox);
const { carregarGrade, criarPlanilhaSimulada } = require('./comum.js');
const DataDoSandbox = vm.runInContext('Date', sandbox);
const gradeSimulada = carregarGrade(fs.readFileSync(CSV, 'utf8'), DataDoSandbox);
Object.assign(sandbox, criarPlanilhaSimulada(gradeSimulada,
  ['Adriel Moreira', 'Warley', 'Alessandra', 'Thyago Souza', 'Thierry'], DataDoSandbox));

vm.runInContext(fs.readFileSync(path.join(RAIZ, 'apps-script', 'Codigo.gs'), 'utf8'), sandbox);
// `const` de topo não vira propriedade do global do sandbox: exporto explicitamente.
vm.runInContext(
  'globalThis.__api = { ETAPAS_PADRAO, DOCUMENTOS, COL, REGIMES, montarEmpresa_, aplicarPrazo_, ' +
  'paraISO_, paraBool_, texto_, diasEntre_, hojeISO_, etapas_, carregarPainel, Date };', sandbox);
const API = sandbox.__api;
API.ETAPAS = API.etapas_();

/* ---- leitura do CSV ---- */
function lerCSV(texto) {
  const linhas = [];
  let campo = '', linha = [], aspas = false;
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (aspas) {
      if (c === '"' && texto[i + 1] === '"') { campo += '"'; i++; }
      else if (c === '"') aspas = false;
      else campo += c;
    } else if (c === '"') aspas = true;
    else if (c === ',') { linha.push(campo); campo = ''; }
    else if (c === '\n') { linha.push(campo); linhas.push(linha); linha = []; campo = ''; }
    else if (c !== '\r') campo += c;
  }
  if (campo || linha.length) { linha.push(campo); linhas.push(linha); }
  return linhas;
}

const linhas = lerCSV(fs.readFileSync(CSV, 'utf8'));
const brutas = linhas.slice(3)
  .map((l) => { const c = l.slice(); while (c.length < 110) c.push(''); return c; })
  .filter((l) => l[1].trim() !== '');

/* Converte o texto do CSV nos tipos que o Sheets realmente devolve. */
function comoSheets(linha) {
  return linha.map((v) => {
    const t = String(v).trim();
    if (t === 'TRUE') return true;
    if (t === 'FALSE') return false;
    const m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (m) return new API.Date(API.Date.UTC(+m[3], +m[2] - 1, +m[1], 15, 0, 0));
    return v;
  });
}

/* ---- verificações ---- */
let falhas = 0, checagens = 0;
function conferir(nome, condicao, detalhe) {
  checagens++;
  if (!condicao) { falhas++; console.log('  ✗ ' + nome + (detalhe ? ' → ' + detalhe : '')); }
}

console.log('=== 1. Estrutura do mapeamento ===');
conferir('12 etapas definidas', API.ETAPAS.length === 12, API.ETAPAS.length + ' etapas');
conferir('10 documentos definidos', API.DOCUMENTOS.length === 10, API.DOCUMENTOS.length);
const etapaDoc = API.ETAPAS[0];
conferir('faixa de documentos = 10 colunas', etapaDoc.docFim - etapaDoc.docInicio + 1 === 10);

const siglas = new Set();
API.ETAPAS.forEach((e) => {
  conferir(e.id + ': tem sigla', !!e.sigla, 'sem sigla');
  conferir(e.id + ': sigla curta', (e.sigla || '').length <= 5, e.sigla);
  conferir(e.id + ': sigla única', !siglas.has(e.sigla), e.sigla + ' repetida');
  siglas.add(e.sigla);
});

const usadas = new Set();
API.ETAPAS.forEach((e) => {
  [e.resp, e.data, e.concluido, e.dataFinal, e.obs].forEach((c) => {
    if (!c) return;
    conferir('coluna ' + c + ' única (' + e.id + ')', !usadas.has(c), 'duplicada');
    usadas.add(c);
  });
});
console.log('  ' + checagens + ' checagens de estrutura, ' + falhas + ' falhas');

console.log('\n=== 2. Cabeçalhos da planilha batem com o mapeamento ===');
const h1 = linhas[1], h2 = linhas[2];
function grupoDe(col0) { let g = ''; for (let i = 0; i <= col0; i++) if ((h1[i] || '').trim()) g = h1[i].trim(); return g; }

const esperado = [
  ['documentacao', 'Solicitar Documentação'],
  ['extrato', 'Baixar extrato Simples Nacional'],
  ['xml', 'Baixar/Solicitar XML'],
  ['movimentacao', 'Criar planilha com a movimenta'],
  ['beneficio', 'Procurar benefício fiscal'],
  ['dre', 'Fazer DRE'],
  ['reuniao_cenarios', 'Reunião para alinhar os cenários'],
  ['cenarios', 'Criar cenários na planilha'],
  ['alinhamento_final', 'Reunião de alinhamento final'],
  ['marcar_reuniao', 'Marcar reunião com cliente'],
  ['apresentacao', 'Apresentação do planejamento'],
  ['pdf', 'Enviar resumo do planejamento em PDF']
];

API.ETAPAS.forEach((e, i) => {
  const grupo = grupoDe(e.resp - 1);
  conferir(e.id + ': grupo na planilha', grupo.indexOf(esperado[i][1]) === 0,
    'esperava "' + esperado[i][1] + '…", achei "' + grupo + '"');
  conferir(e.id + ': col ' + e.resp + ' é Responsável',
    (h2[e.resp - 1] || '').trim() === 'Responsável:', 'achei "' + (h2[e.resp - 1] || '') + '"');
  if (e.concluido) {
    conferir(e.id + ': col ' + e.concluido + ' é Concluído',
      (h2[e.concluido - 1] || '').trim() === 'Concluído', 'achei "' + (h2[e.concluido - 1] || '') + '"');
  }
});
conferir('col 2 = Empresa', (h1[1] || '').trim() === 'Empresa:');
conferir('col 9 = Regime', (h2[8] || '').trim() === 'Regime Tributario');
conferir('col 24 = % dos documentos', (h2[23] || '').trim() === 'Concluído');

console.log('\n=== 3. Leitura das 42 empresas (tipos do Sheets) ===');
const empresas = brutas.map((l, i) => API.montarEmpresa_(4 + i, comoSheets(l)));
conferir('42 empresas lidas', empresas.length === 42, empresas.length + ' lidas');

empresas.forEach((e) => {
  conferir(e.nome + ': tem nome', !!e.nome);
  conferir(e.nome + ': progresso entre 0 e 1', e.progresso >= 0 && e.progresso <= 1, e.progresso);
  conferir(e.nome + ': 12 etapas', e.etapas.length === 12);
  conferir(e.nome + ': status definido', !!e.status);
  conferir(e.nome + ': etapa atual é a 1ª pendente', (function () {
    const primeira = e.etapas.find((x) => !x.concluido);
    return e.etapaAtual === (primeira ? primeira.nome : 'Concluído');
  })());
});

console.log('\n=== 4. Conferência linha a linha contra o CSV cru ===');
brutas.forEach((bruta, i) => {
  const e = empresas[i];
  conferir(e.nome + ': nome idêntico ao CSV', e.nome === bruta[1].trim());
  conferir(e.nome + ': regime idêntico ao CSV', e.regime === bruta[8].trim());
  API.ETAPAS.forEach((def) => {
    const etapa = e.etapas.find((x) => x.id === def.id);
    conferir(e.nome + '/' + def.id + ': responsável', etapa.responsavel === bruta[def.resp - 1].trim());
    if (def.concluido) {
      conferir(e.nome + '/' + def.id + ': concluído',
        etapa.concluido === (bruta[def.concluido - 1].trim().toUpperCase() === 'TRUE'),
        'CSV=' + bruta[def.concluido - 1] + ' lido=' + etapa.concluido);
    }
  });
  const docsCSV = bruta.slice(13, 23).filter((v) => v.trim().toUpperCase() === 'TRUE').length;
  const docsLidos = e.etapas[0].documentos.filter((d) => d.entregue).length;
  conferir(e.nome + ': contagem de documentos', docsCSV === docsLidos, docsCSV + ' no CSV vs ' + docsLidos + ' lidos');
  conferir(e.nome + ': documentação concluída só com os 10 documentos',
    e.etapas[0].concluido === (docsCSV === 10), docsCSV + '/10 mas concluido=' + e.etapas[0].concluido);
  conferir(e.nome + ': previsão de entrega lida', e.previsaoEntrega === (function () {
    const m = bruta[6].trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    return m ? m[3] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[1]).slice(-2) : '';
  })(), 'CSV=' + bruta[6] + ' lido=' + e.previsaoEntrega);
});

console.log('\n=== 4b. Etapa atual e tempo parado ===');
empresas.forEach((e) => {
  const pendente = e.etapas.find((x) => !x.concluido);
  conferir(e.nome + ': posição da etapa atual',
    e.etapaAtualPosicao === (pendente ? pendente.posicao : 12), e.etapaAtualPosicao);
  conferir(e.nome + ': sigla da etapa atual',
    e.etapaAtualSigla === (pendente ? pendente.sigla : ''), e.etapaAtualSigla);
  conferir(e.nome + ': contagem de etapas concluídas',
    e.etapasConcluidas === e.etapas.filter((x) => x.concluido).length);
  conferir(e.nome + ': posições de 1 a 12',
    JSON.stringify(e.etapas.map((x) => x.posicao)) === JSON.stringify([1,2,3,4,5,6,7,8,9,10,11,12]));

  const datas = [];
  e.etapas.forEach((x) => { if (x.data) datas.push(x.data); if (x.dataFinal) datas.push(x.dataFinal); });
  const maior = datas.filter((d) => d <= API.hojeISO_()).sort().pop() || '';
  conferir(e.nome + ': última movimentação é a data mais recente',
    e.ultimaMovimentacao === maior, 'achei ' + e.ultimaMovimentacao + ', esperava ' + maior);
  conferir(e.nome + ': dias parada coerente',
    e.ultimaMovimentacao ? e.diasParada >= 0 : e.diasParada === null, e.diasParada);
});
const semMovimento = empresas.filter((e) => e.ultimaMovimentacao === '').length;
console.log('  ' + semMovimento + ' empresa(s) sem nenhuma data registrada em etapa alguma');

console.log('\n=== 5. Datas e prazo ===');
conferir('paraISO_ com Date', API.paraISO_(new API.Date(API.Date.UTC(2025, 8, 15, 15))) === '2025-09-15');
conferir('paraISO_ com texto dd/mm/aaaa', API.paraISO_('15/09/2025') === '2025-09-15');
conferir('paraISO_ com traço', API.paraISO_('-') === '');
conferir('paraISO_ vazio', API.paraISO_('') === '');
conferir('paraISO_ com lixo', API.paraISO_('a combinar') === '');
conferir('diasEntre_ atravessa mês', API.diasEntre_('2025-10-28', '2025-11-04') === 7);
conferir('diasEntre_ negativo', API.diasEntre_('2025-11-04', '2025-10-28') === -7);

const cenarios = [
  { nome: 'entregue no prazo', prev: '2025-11-04', efetiva: '2025-11-04', status: 'entregue' },
  { nome: 'entregue com atraso', prev: '2025-10-13', efetiva: '2025-10-17', status: 'entregue_atraso', atraso: 4 },
  { nome: 'entregue adiantado', prev: '2025-11-04', efetiva: '2025-11-01', status: 'entregue' },
  { nome: 'sem previsão', prev: '', efetiva: '', status: 'sem_prazo' }
];
cenarios.forEach((c) => {
  const e = { previsaoEntrega: c.prev, entregaEfetiva: c.efetiva };
  API.aplicarPrazo_(e);
  conferir('prazo: ' + c.nome, e.status === c.status, 'deu ' + e.status);
  if (c.atraso !== undefined) conferir('prazo: dias de atraso de ' + c.nome, e.diasAtraso === c.atraso, e.diasAtraso);
});

const hoje = API.hojeISO_();
function maisDias(iso, d) { const x = new Date(iso + 'T12:00:00'); x.setDate(x.getDate() + d); return x.toISOString().slice(0, 10); }
[[-3, 'atrasado'], [0, 'semana'], [5, 'semana'], [7, 'semana'], [8, 'em_dia'], [40, 'em_dia']].forEach(([d, esperado]) => {
  const e = { previsaoEntrega: maisDias(hoje, d), entregaEfetiva: '' };
  API.aplicarPrazo_(e);
  conferir('prazo: previsão em ' + d + ' dia(s) → ' + esperado, e.status === esperado, 'deu ' + e.status);
  conferir('prazo: diasRestantes = ' + d, e.diasRestantes === d, 'deu ' + e.diasRestantes);
});

console.log('\n=== 6. Progresso: novo cálculo vs. coluna K da planilha ===');
function percentualDaPlanilha(bruta) {
  // Reproduz a fórmula K4 da planilha, como ela está hoje.
  const colsK = [37, 41, 45, 49, 55, 59, 63, 67, 71];
  const docPct = bruta.slice(13, 23).filter((v) => v.trim().toUpperCase() === 'TRUE').length / 10;
  const conta = colsK.filter((c) => bruta[c].trim().toUpperCase() === 'TRUE').length;
  return ((docPct === 1 ? 0 : 0) + conta) / 10; // IF(X="100%") nunca é verdadeiro: X é número
}
let divergem = 0;
brutas.forEach((bruta, i) => {
  const naPlanilha = Math.round(percentualDaPlanilha(bruta) * 100);
  const exibido = parseFloat(String(bruta[10]).replace('%', '').replace(',', '.'));
  conferir(empresas[i].nome + ': fórmula K reproduzida', Math.abs(naPlanilha - exibido) < 0.6,
    'reproduzi ' + naPlanilha + '% mas a planilha exibe ' + exibido + '%');
  if (Math.abs(Math.round(empresas[i].progresso * 100) - exibido) > 0.6) divergem++;
});
console.log('  ' + divergem + ' de ' + brutas.length + ' empresas com progresso diferente do exibido na planilha (esperado: a fórmula K ignora 3 etapas)');

console.log('\n=== 7. Amostra do que a tela vai mostrar ===');
empresas.slice(0, 6).forEach((e) => {
  console.log('  ' + String(Math.round(e.progresso * 100)).padStart(3) + '% | ' +
    e.status.padEnd(16) + ' | ' + e.nome.slice(0, 34).padEnd(34) + ' | ' +
    e.etapaAtual.slice(0, 38).padEnd(38) + ' | ' + (e.responsavelAtual || '—'));
});

console.log('\n=== 8. Panorama da carteira hoje (' + API.hojeISO_() + ') ===');
const porStatus = {};
empresas.forEach((e) => { porStatus[e.status] = (porStatus[e.status] || 0) + 1; });
Object.keys(porStatus).sort().forEach((s) => console.log('  ' + s.padEnd(18) + porStatus[s]));
const atrasadas = empresas.filter((e) => e.status === 'atrasado')
  .sort((a, b) => a.previsaoEntrega.localeCompare(b.previsaoEntrega));
console.log('  --- atrasadas, da mais antiga para a mais recente ---');
atrasadas.forEach((e) => console.log('  ' + String(-e.diasRestantes).padStart(4) + 'd | ' +
  e.nome.slice(0, 40).padEnd(40) + ' | ' + e.etapaAtual.slice(0, 34).padEnd(34) + ' | ' + (e.responsavelAtual || 'sem responsável')));
const semResp = empresas.filter((e) => e.status !== 'entregue' && e.status !== 'entregue_atraso' && !e.responsavelAtual);
console.log('  ' + semResp.length + ' empresa(s) em andamento sem responsável na etapa atual');
const semPrazo = empresas.filter((e) => e.status === 'sem_prazo');
console.log('  ' + semPrazo.length + ' empresa(s) sem previsão de entrega preenchida');

console.log('\n' + '='.repeat(60));
console.log(falhas === 0 ? '✅ ' + checagens + ' checagens, 0 falhas' : '❌ ' + falhas + ' falhas em ' + checagens + ' checagens');
process.exit(falhas === 0 ? 0 : 1);
