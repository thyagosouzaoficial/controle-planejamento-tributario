/**
 * Testa a atualização de uma planilha JÁ EM USO.
 *
 * O caso real: a equipe classificou as empresas, criou serviços próprios, e o
 * código passa a prever uma estrutura diferente. Nada do que já existe pode se
 * perder — nem a classificação, nem os serviços que a equipe criou, nem as
 * etapas que ela ajustou.
 *
 *   node teste/teste-atualizacao.js /tmp/controle.csv
 */
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const { carregarGrade, criarPlanilhaSimulada } = require('./comum.js');

const RAIZ = path.join(__dirname, '..');
const CSV = process.argv[2];
const PRIMEIRA_LINHA = 4;

const sandbox = { console };
vm.createContext(sandbox);
const DataDoSandbox = vm.runInContext('Date', sandbox);
const ambiente = criarPlanilhaSimulada(
  carregarGrade(fs.readFileSync(CSV, 'utf8'), DataDoSandbox),
  ['Adriel Moreira', 'Warley', 'Alessandra'], DataDoSandbox);
Object.assign(sandbox, ambiente);
vm.runInContext(fs.readFileSync(path.join(RAIZ, 'apps-script', 'Codigo.gs'), 'utf8'), sandbox);
vm.runInContext(
  'globalThis.__api = { carregarPainel, salvarCabecalho, etapas_, campos_, ' +
  'ETAPAS_INICIAIS, FOMENTO_TODOS, FOMENTO_INDICACAO, FOMENTO_SONDAGEM, FOMENTO_BUSCA };',
  sandbox);
const API = sandbox.__api;

let falhas = 0, checagens = 0;
function conferir(nome, condicao, detalhe) {
  checagens++;
  if (!condicao) { falhas++; console.log('  ✗ ' + nome + (detalhe ? ' → ' + detalhe : '')); }
}

/* ------------------------------------------------------------------ *
 * Monta a planilha como ela estava antes da divisão em três caminhos  *
 * ------------------------------------------------------------------ */
API.carregarPainel();

const etapasNovas = API.ETAPAS_INICIAIS[0].etapas
  .filter((e) => (e.servicos || []).length < 3)
  .map((e) => e.nome)
  .concat(['Solicitar documentação do crédito', 'Abertura do processo']);

const abaEtapas = ambiente.abas.Etapas;
abaEtapas.grade.slice(1).forEach((l) => {
  if (etapasNovas.indexOf(String(l[2])) < 0) return;
  [l[5], l[6], l[7]].forEach((c) => {
    if (c) {
      ambiente.abas.Controle.grade[1][c - 1] = '';
      ambiente.abas.Controle.grade[2][c - 1] = '';
    }
  });
});
abaEtapas.grade = abaEtapas.grade.filter((l, i) => i === 0 || etapasNovas.indexOf(String(l[2])) < 0);
abaEtapas.grade.slice(1).forEach((l) => {
  if (String(l[13] || '').indexOf('Fomento') >= 0) l[13] = 'Goiás Fomento';
});
ambiente.abas.Campos.grade.slice(1).forEach((l) => {
  if (String(l[4] || '').indexOf('Fomento') >= 0) l[4] = 'Goiás Fomento';
});

const abaServicos = ambiente.abas.Servicos;
abaServicos.grade = abaServicos.grade.filter((l) => String(l[0]).indexOf('Fomento —') < 0);
abaServicos.appendRow(['Goiás Fomento']);
abaServicos.appendRow(['Auditoria Progoiás']);   // serviço criado pela equipe

/* a equipe classificou tudo */
const distribuicao = [['Planejamento Tributário', 20], ['Goiás Fomento', 15],
                      ['Auditoria', 2], ['Diagnóstico', 1], ['Auditoria Progoiás', 1]];
let linha = PRIMEIRA_LINHA, qual = 0, feitos = 0;
while (linha <= ambiente.abas.Controle.grade.length && qual < distribuicao.length) {
  const nomeDaEmpresa = String((ambiente.abas.Controle.grade[linha - 1] || [])[1] || '').trim();
  if (nomeDaEmpresa) {
    API.salvarCabecalho(linha, 'servico', distribuicao[qual][0]);
    feitos++;
    if (feitos >= distribuicao[qual][1]) { qual++; feitos = 0; }
  }
  linha++;
}

/* tira a estrutura nova só agora: classificar já chamaria a atualização */
abaServicos.grade = abaServicos.grade.filter((l) => String(l[0]).indexOf('Fomento —') < 0);
abaEtapas.grade.slice(1).forEach((l) => {
  if (String(l[13] || '').indexOf('Fomento') >= 0) l[13] = 'Goiás Fomento';
});

/* lê direto da planilha, sem passar pelo app, para medir o estado anterior */
const servicosAntes = abaServicos.grade.slice(1)
  .map((l) => String(l[0] || '').trim()).filter((n) => n);
const colunaDoServico = 74;
const contagemAntes = {};
distribuicao.forEach(([nome]) => {
  contagemAntes[nome] = ambiente.abas.Controle.grade.slice(PRIMEIRA_LINHA - 1)
    .filter((l) => String(l[colunaDoServico - 1] || '').trim() === nome).length;
});
const totalAntes = ambiente.abas.Controle.grade.slice(PRIMEIRA_LINHA - 1)
  .filter((l) => String(l[1] || '').trim()).length;

console.log('=== a planilha como estava ===');
distribuicao.forEach(([nome]) => console.log('  ' + nome.padEnd(26) + contagemAntes[nome]));
conferir('o cenário reproduz a estrutura anterior',
  servicosAntes.indexOf('Goiás Fomento') >= 0 && servicosAntes.indexOf('Auditoria Progoiás') >= 0,
  servicosAntes.join(' | '));
conferir('e ainda sem os três caminhos',
  API.FOMENTO_TODOS.every((s) => servicosAntes.indexOf(s) < 0), servicosAntes.join(' | '));

/* ------------------------------------------------------------------ *
 * Abrir o painel é o que dispara a atualização                        *
 * ------------------------------------------------------------------ */
const depois = API.carregarPainel();

console.log('\n=== depois de abrir o painel com o código novo ===');
distribuicao.forEach(([nome]) => console.log('  ' + nome.padEnd(26) +
  depois.empresas.filter((e) => e.servico === nome).length));

conferir('nenhuma empresa mudou de serviço',
  distribuicao.every(([nome]) =>
    depois.empresas.filter((e) => e.servico === nome).length === contagemAntes[nome]),
  distribuicao.map(([n]) => n + '=' + depois.empresas.filter((e) => e.servico === n).length).join(', '));
conferir('nenhuma empresa se perdeu', depois.empresas.length === totalAntes,
  depois.empresas.length + ' vs ' + totalAntes);
conferir('o serviço que a equipe criou continua na lista',
  depois.servicos.indexOf('Auditoria Progoiás') >= 0, depois.servicos.join(' | '));
conferir('o serviço antigo do fomento continua na lista',
  depois.servicos.indexOf('Goiás Fomento') >= 0);
conferir('os três caminhos novos foram acrescentados',
  API.FOMENTO_TODOS.every((s) => depois.servicos.indexOf(s) >= 0));

const fluxoDe = (sv) => depois.etapas
  .filter((e) => !e.servicos.length || e.servicos.indexOf(sv) >= 0)
  .map((e) => e.nome);

conferir('quem está no fomento antigo continua com o fluxo dele',
  fluxoDe('Goiás Fomento').indexOf('Validação inicial') >= 0,
  fluxoDe('Goiás Fomento').join(' → '));
conferir('a indicação começa pelo contato',
  fluxoDe(API.FOMENTO_INDICACAO)[0] === 'Contato com o cliente indicado',
  fluxoDe(API.FOMENTO_INDICACAO)[0]);
conferir('a sondagem começa perguntando do interesse',
  fluxoDe(API.FOMENTO_SONDAGEM)[0] === 'Sondar interesse no crédito',
  fluxoDe(API.FOMENTO_SONDAGEM)[0]);
conferir('a busca própria começa prospectando',
  fluxoDe(API.FOMENTO_BUSCA)[0] === 'Prospectar o cliente',
  fluxoDe(API.FOMENTO_BUSCA)[0]);
conferir('as etapas novas entram na ordem certa, não no fim',
  fluxoDe(API.FOMENTO_INDICACAO).indexOf('Solicitar documentação do crédito') <
  fluxoDe(API.FOMENTO_INDICACAO).indexOf('Validação inicial'),
  fluxoDe(API.FOMENTO_INDICACAO).join(' → '));
conferir('os campos do fomento passam a valer para os três',
  depois.camposDeServico.filter((c) =>
    API.FOMENTO_TODOS.every((s) => (c.servicos || []).indexOf(s) >= 0)).length >= 10,
  depois.camposDeServico.filter((c) => (c.servicos || []).length >= 3).length + ' campos');

/* ------------------------------------------------------------------ *
 * Abrir de novo não pode mexer em mais nada                           *
 * ------------------------------------------------------------------ */
const terceiraVez = API.carregarPainel();
conferir('abrir de novo não acrescenta serviço',
  JSON.stringify(terceiraVez.servicos) === JSON.stringify(depois.servicos));
conferir('nem etapa', terceiraVez.etapas.length === depois.etapas.length,
  terceiraVez.etapas.length + ' vs ' + depois.etapas.length);
conferir('nem campo', terceiraVez.camposDeServico.length === depois.camposDeServico.length);
conferir('e a classificação segue intacta',
  distribuicao.every(([nome]) =>
    terceiraVez.empresas.filter((e) => e.servico === nome).length === contagemAntes[nome]));

console.log('\n' + '='.repeat(60));
console.log(falhas === 0 ? '✅ ' + checagens + ' checagens de atualização, 0 falhas'
                         : '❌ ' + falhas + ' falhas em ' + checagens + ' checagens');
process.exit(falhas === 0 ? 0 : 1);
