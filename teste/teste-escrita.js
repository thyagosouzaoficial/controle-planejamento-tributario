/**
 * Testa a GRAVAÇÃO: roda o Codigo.gs contra uma planilha simulada em memória,
 * carregada com os dados reais, e confere o que ficou escrito em cada célula.
 */
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const { carregarGrade, criarPlanilhaSimulada } = require('./comum.js');

const RAIZ = path.join(__dirname, '..');
const CSV = process.argv[2];

/* ---- monta o ambiente ---- */
const sandbox = { console };
vm.createContext(sandbox);
const DataDoSandbox = vm.runInContext('Date', sandbox);

const grade = carregarGrade(fs.readFileSync(CSV, 'utf8'), DataDoSandbox);
const ambiente = criarPlanilhaSimulada(grade,
  ['Adriel Moreira', 'Warley', 'Alessandra', 'Thyago Souza', 'Thierry'], DataDoSandbox);

Object.assign(sandbox, ambiente);
vm.runInContext(fs.readFileSync(path.join(RAIZ, 'apps-script', 'Codigo.gs'), 'utf8'), sandbox);
vm.runInContext(
  'globalThis.__api = { ETAPAS_PADRAO, DOCUMENTOS, COL, totalColunas_, etapas_, COLUNA_CNPJ, ' +
  'COLUNA_SERVICO, COLUNA_NAO_APLICA, SERVICOS_PADRAO, listarServicos_, criarServico, ' +
  'definirServicoDasSemServico, definirNaoAplica, cnpjValido_, ' +
  'formatarCNPJ_, garimparCNPJs_, carregarPainel, carregarEmpresa, ' +
  'salvarCabecalho, salvarEtapaCampo, alternarEtapa, alternarDocumento, criarEmpresa, lerLog, ' +
  'salvarCelula, excluirEmpresa, listarExcluidas, criarEtapa, renomearEtapa, excluirEtapa, acharEtapaParaTeste, ' +
  'definirServicosDaEtapa, definirServicosDeVarias, etapaValePara_, campos_, criarCampo, ' +
  'FOMENTO_INDICACAO, FOMENTO_SONDAGEM, FOMENTO_BUSCA, FOMENTO_TODOS, ' +
  'excluirCampo, salvarCampoDoServico, CAMPOS_INICIAIS, TIPOS_DE_CAMPO, ETAPAS_INICIAIS, ' +
  'interpretarListaDeClientes_, conferirListaDeClientes, importarClientes, desfazerImportacao, ' +
  'exportarParaExcel, montarExportacao_, ' +
  'renumerarEmpresas };', sandbox);

const API = sandbox.__api;
API.ETAPAS = API.etapas_();
API.TOTAL_COLUNAS = API.totalColunas_();
const controle = ambiente.abas.Controle.grade;
const celula = (linha, col) => controle[linha - 1][col - 1];

let falhas = 0, checagens = 0;
function conferir(nome, condicao, detalhe) {
  checagens++;
  if (!condicao) { falhas++; console.log('  ✗ ' + nome + (detalhe ? ' → ' + detalhe : '')); }
}

console.log('=== Carga inicial ===');
const painel = API.carregarPainel();
conferir('42 empresas', painel.empresas.length === 42, painel.empresas.length);
conferir('5 usuários lidos da aba Diagnostico', painel.usuarios.length === 5, painel.usuarios.join(', '));
conferir('regimes disponíveis', painel.regimes.length === 4);

/* A SUPER VAIDOSA (linha 9) está no começo do fluxo: boa cobaia. */
const LINHA = 9;
console.log('\n=== Empresa de teste: ' + celula(LINHA, 2) + ' (linha ' + LINHA + ') ===');

console.log('\n=== 1. Marcar etapa concluída carimba a data ===');
conferir('extrato começa pendente', celula(LINHA, 30) !== true, String(celula(LINHA, 30)));
let e = API.alternarEtapa(LINHA, 'extrato', true);
conferir('coluna 30 virou TRUE', celula(LINHA, 30) === true, String(celula(LINHA, 30)));
conferir('etapa lida como concluída', e.etapas.find((x) => x.id === 'extrato').concluido === true);
conferir('data carimbada na coluna 29', celula(LINHA, 29) instanceof DataDoSandbox,
  'ficou ' + celula(LINHA, 29));
conferir('data carimbada é hoje', e.etapas.find((x) => x.id === 'extrato').data === API.carregarPainel().hoje);

console.log('\n=== 2. Data já preenchida não é sobrescrita ===');
API.salvarEtapaCampo(LINHA, 'xml', 'data', '2025-03-10');
e = API.alternarEtapa(LINHA, 'xml', true);
conferir('data original preservada', e.etapas.find((x) => x.id === 'xml').data === '2025-03-10',
  e.etapas.find((x) => x.id === 'xml').data);

console.log('\n=== 3. Desmarcar etapa ===');
e = API.alternarEtapa(LINHA, 'extrato', false);
conferir('coluna 30 voltou a FALSE', celula(LINHA, 30) === false, String(celula(LINHA, 30)));
conferir('data permanece', celula(LINHA, 29) instanceof DataDoSandbox);

console.log('\n=== 4. Documentos ===');
const inicioDocs = API.ETAPAS[0].docInicio;
const percentualAntes = celula(LINHA, 24); // célula de fórmula: o app nunca escreve nela

API.alternarEtapa(LINHA, 'documentacao', false); // parte de um estado conhecido
e = API.alternarDocumento(LINHA, inicioDocs, true);
conferir('documento 1 marcado', celula(LINHA, inicioDocs) === true);
conferir('progresso da documentação = 10%', Math.round(e.etapas[0].progresso * 100) === 10,
  Math.round(e.etapas[0].progresso * 100) + '%');
conferir('documentação não fica concluída com 1 de 10', e.etapas[0].concluido === false);

e = API.alternarEtapa(LINHA, 'documentacao', true);
conferir('marcar a etapa marca os 10 documentos',
  e.etapas[0].documentos.every((d) => d.entregue), e.etapas[0].documentos.filter((d) => d.entregue).length + '/10');
conferir('documentação agora concluída', e.etapas[0].concluido === true);
conferir('coluna 24 (fórmula de %) nunca foi escrita', celula(LINHA, 24) === percentualAntes,
  'era "' + percentualAntes + '", virou "' + celula(LINHA, 24) + '"');
conferir('coluna 24 não virou booleano', typeof celula(LINHA, 24) !== 'boolean', String(celula(LINHA, 24)));

e = API.alternarEtapa(LINHA, 'documentacao', false);
conferir('desmarcar limpa os 10 documentos',
  e.etapas[0].documentos.every((d) => !d.entregue), e.etapas[0].documentos.filter((d) => d.entregue).length + '/10');

console.log('\n=== 5. Campos do cabeçalho ===');
e = API.salvarCabecalho(LINHA, 'previsaoEntrega', '2026-12-31');
conferir('previsão gravada como Date', celula(LINHA, 7) instanceof DataDoSandbox, String(celula(LINHA, 7)));
conferir('previsão lida de volta', e.previsaoEntrega === '2026-12-31', e.previsaoEntrega);
conferir('status recalculado para em dia', e.status === 'em_dia', e.status);

e = API.salvarCabecalho(LINHA, 'previsaoEntrega', '');
conferir('previsão limpa', celula(LINHA, 7) === '', String(celula(LINHA, 7)));
conferir('status vira sem prazo', e.status === 'sem_prazo', e.status);

e = API.salvarCabecalho(LINHA, 'regime', 'Lucro Real');
conferir('regime gravado', celula(LINHA, 9) === 'Lucro Real', String(celula(LINHA, 9)));
e = API.salvarCabecalho(LINHA, 'assinatura', true);
conferir('assinatura gravada como booleano', celula(LINHA, 5) === true, String(celula(LINHA, 5)));
e = API.salvarCabecalho(LINHA, 'observacao', 'linha 1\nlinha 2 com "aspas" e vírgula, ok');
conferir('observação com quebra e aspas', celula(LINHA, 10).indexOf('aspas') > 0, celula(LINHA, 10));

console.log('\n=== 6. Responsável da etapa ===');
e = API.salvarEtapaCampo(LINHA, 'dre', 'responsavel', 'Thyago Souza');
conferir('responsável gravado na coluna 44', celula(LINHA, 44) === 'Thyago Souza', String(celula(LINHA, 44)));
conferir('etapa atual reflete o responsável',
  e.etapas.find((x) => x.id === 'dre').responsavel === 'Thyago Souza');

console.log('\n=== 7. Campos que só existem em algumas etapas ===');
e = API.salvarEtapaCampo(LINHA, 'reuniao_cenarios', 'dataFinal', '2026-01-15');
conferir('data da última reunião gravada (col 51)', celula(LINHA, 51) instanceof DataDoSandbox);
let recusou = false;
try { API.salvarEtapaCampo(LINHA, 'dre', 'dataFinal', '2026-01-15'); } catch (err) { recusou = true; }
conferir('etapa sem data final recusa o campo', recusou, 'gravou onde não devia');
recusou = false;
try { API.salvarEtapaCampo(LINHA, 'inventada', 'data', '2026-01-15'); } catch (err) { recusou = true; }
conferir('etapa inexistente é recusada', recusou);
recusou = false;
try { API.salvarCabecalho(LINHA, 'inventado', 'x'); } catch (err) { recusou = true; }
conferir('campo de cabeçalho inexistente é recusado', recusou);

console.log('\n=== 8. Nenhuma outra empresa foi tocada ===');
const depois = API.carregarPainel();
let mexidas = 0;
painel.empresas.forEach((antes, i) => {
  if (antes.linha === LINHA) return;
  const agora = depois.empresas[i];
  if (JSON.stringify(antes) !== JSON.stringify(agora)) { mexidas++; console.log('    alterada: ' + antes.nome); }
});
conferir('as outras 41 empresas intactas', mexidas === 0, mexidas + ' alteradas');

console.log('\n=== 9. Criar empresa ===');
const antesDeCriar = depois.empresas.length;
const nova = API.criarEmpresa('  EMPRESA DE TESTE LTDA  ');
conferir('nome sem espaços sobrando', nova.nome === 'EMPRESA DE TESTE LTDA', '"' + nova.nome + '"');
conferir('entrou uma linha depois da última', nova.linha === 46, 'linha ' + nova.linha);
conferir('nenhuma etapa concluída', nova.etapas.every((x) => !x.concluido));
conferir('progresso zero', nova.progresso === 0, nova.progresso);
conferir('aparece no painel', API.carregarPainel().empresas.length === antesDeCriar + 1);
recusou = false;
try { API.criarEmpresa('   '); } catch (err) { recusou = true; }
conferir('nome vazio é recusado', recusou);

console.log('\n=== 10. Trilha de auditoria ===');
const log = API.lerLog(200);
conferir('log registrou as alterações', log.length > 10, log.length + ' registros');
conferir('mais recente primeiro', log[0].oque.indexOf('Empresa criada') >= 0, log[0].oque);
conferir('log tem autor', log.every((l) => l.quem === 'previa@azuos'));
conferir('log tem empresa', log.filter((l) => l.empresa === 'SUPER VAIDOSA LTDA').length > 5);
const semMudanca = log.filter((l) => l.anterior === l.novo).length;
conferir('não registra o que não mudou', semMudanca === 0, semMudanca + ' registros inúteis');
console.log('  amostra: ' + log.slice(0, 3).map((l) => l.oque + ' (' + l.anterior + ' → ' + l.novo + ')').join(' | '));

console.log('\n=== 10b. CNPJ ===');
conferir('cabeçalho da coluna criado ao abrir o painel',
  celula(2, API.COLUNA_CNPJ) === 'CNPJ', String(celula(2, API.COLUNA_CNPJ)));

e = API.salvarCabecalho(LINHA, 'cnpj', '13113308000195');
conferir('grava formatado', celula(LINHA, API.COLUNA_CNPJ) === '13.113.308/0001-95',
  String(celula(LINHA, API.COLUNA_CNPJ)));
conferir('lido de volta como um só', e.cnpjs.length === 1 && e.cnpjs[0].valido === true);
conferir('sem sugestão quando já tem CNPJ', e.cnpjSugerido.length === 0);

const antesDoErro = celula(LINHA, API.COLUNA_CNPJ);
recusou = false;
try { API.salvarCabecalho(LINHA, 'cnpj', '11.222.333/0001-82'); } catch (err) {
  recusou = true;
  conferir('mensagem do CNPJ inválido é clara', err.message.indexOf('inválido') > 0, err.message);
}
conferir('CNPJ com dígito errado é recusado', recusou);
conferir('célula intacta depois da recusa', celula(LINHA, API.COLUNA_CNPJ) === antesDoErro);

e = API.salvarCabecalho(LINHA, 'cnpj', '13113308000195, 17.385.003/0001-93');
conferir('aceita grupo com dois CNPJs', e.cnpjs.length === 2, e.cnpjs.length + '');
conferir('os dois saem formatados',
  celula(LINHA, API.COLUNA_CNPJ) === '13.113.308/0001-95, 17.385.003/0001-93',
  String(celula(LINHA, API.COLUNA_CNPJ)));

recusou = false;
try { API.salvarCabecalho(LINHA, 'cnpj', '13113308000195, 11.222.333/0001-82'); } catch (err) { recusou = true; }
conferir('um inválido no meio derruba a gravação inteira', recusou);
conferir('grupo anterior preservado', (API.carregarEmpresa(LINHA).cnpjs || []).length === 2);

e = API.salvarCabecalho(LINHA, 'cnpj', '12ABC34501DE35');
conferir('aceita CNPJ alfanumérico', e.cnpjs.length === 1 && e.cnpjs[0].valido === true);
e = API.salvarCabecalho(LINHA, 'cnpj', '');
conferir('pode limpar', e.cnpjs.length === 0 && celula(LINHA, API.COLUNA_CNPJ) === '');

const comSugestao = API.carregarPainel().empresas.filter(function (x) {
  return x.cnpjSugerido && x.cnpjSugerido.length;
});
conferir('garimpa CNPJ das observações', comSugestao.length > 20, comSugestao.length + ' empresas');
conferir('só sugere CNPJ válido',
  comSugestao.every((x) => x.cnpjSugerido.every((c) => API.cnpjValido_(c.numero))));
conferir('não sugere para quem já tem',
  API.carregarPainel().empresas.every((x) => !(x.cnpjs.length && x.cnpjSugerido.length)));
console.log('  ' + comSugestao.length + ' empresas com CNPJ garimpado da observação; ' +
  'exemplo: ' + comSugestao[0].nome + ' → ' + comSugestao[0].cnpjSugerido.map((c) => c.formatado).join(', '));

console.log('\n=== 10c. Serviço contratado ===');
const painelServicos = API.carregarPainel();
conferir('cabeçalho da coluna criado', celula(2, API.COLUNA_SERVICO) === 'Serviço',
  String(celula(2, API.COLUNA_SERVICO)));
conferir('aba Servicos criada', !!ambiente.abas.Servicos);
conferir('com os três serviços do padrão',
  JSON.stringify(painelServicos.servicos) === JSON.stringify(API.SERVICOS_PADRAO),
  painelServicos.servicos.join(', '));
conferir('empresas começam sem serviço',
  painelServicos.empresas.every((x) => x.servico === ''));

e = API.salvarCabecalho(LINHA, 'servico', 'Auditoria');
conferir('serviço gravado', celula(LINHA, API.COLUNA_SERVICO) === 'Auditoria',
  String(celula(LINHA, API.COLUNA_SERVICO)));
conferir('lido de volta', e.servico === 'Auditoria', e.servico);

recusa('serviço repetido na lista', () => API.criarServico('auditoria'));
recusa('serviço sem nome', () => API.criarServico('   '));
const quantosServicos = API.listarServicos_().length;
const comNovo = API.criarServico('Recuperação de crédito');
conferir('serviço novo entra na lista', comNovo.servicos.length === quantosServicos + 1,
  comNovo.servicos.join(', '));
conferir('e vai para o fim',
  comNovo.servicos[comNovo.servicos.length - 1] === 'Recuperação de crédito');

recusa('serviço fora da lista no preenchimento em massa',
  () => API.definirServicoDasSemServico('Serviço inventado'));

const semServicoAntes = API.carregarPainel().empresas.filter((x) => !x.servico).length;
const preenchido = API.definirServicoDasSemServico('Planejamento Tributário');
conferir('todas passaram a ter serviço', preenchido.empresas.every((x) => !!x.servico),
  preenchido.empresas.filter((x) => !x.servico).length + ' ainda sem');
conferir('quem já tinha não foi sobrescrito',
  preenchido.empresas.filter((x) => x.linha === LINHA)[0].servico === 'Auditoria');
conferir('o preenchimento em massa ficou no log',
  API.lerLog(60).some((l) => l.oque === 'Serviço preenchido em massa'));
console.log('  ' + semServicoAntes + ' empresa(s) estavam sem serviço e foram marcadas');

console.log('\n=== 10d. Etapas que não se aplicam ===');
conferir('cabeçalho da coluna criado', celula(2, API.COLUNA_NAO_APLICA) === 'Etapas que não se aplicam',
  String(celula(2, API.COLUNA_NAO_APLICA)));

/* uma empresa limpa para medir o percentual com clareza */
const LINHA_NA = 10;
API.ETAPAS.forEach(function (et) { API.alternarEtapa(LINHA_NA, et.id, false); });
API.salvarCelula(LINHA_NA, API.COLUNA_NAO_APLICA, '', 'texto', 'limpeza do teste');
let na = API.carregarEmpresa(LINHA_NA);
conferir('empresa começa com 12 etapas aplicáveis', na.etapasAplicaveis === 12, na.etapasAplicaveis);
conferir('e 0% de progresso', na.progresso === 0, na.progresso);

na = API.alternarEtapa(LINHA_NA, 'dre', true);
conferir('1 de 12 concluída = 8%', Math.round(na.progresso * 100) === 8,
  Math.round(na.progresso * 100) + '%');

na = API.definirNaoAplica(LINHA_NA, 'beneficio', true);
conferir('etapa marcada como não se aplica',
  na.etapas.filter((x) => x.id === 'beneficio')[0].naoSeAplica === true);
conferir('gravada na célula', String(celula(LINHA_NA, API.COLUNA_NAO_APLICA)) === 'beneficio',
  String(celula(LINHA_NA, API.COLUNA_NAO_APLICA)));
conferir('sobraram 11 aplicáveis', na.etapasAplicaveis === 11, na.etapasAplicaveis);
conferir('e o percentual subiu: 1 de 11 = 9%', Math.round(na.progresso * 100) === 9,
  Math.round(na.progresso * 100) + '%');
conferir('a contagem de não aplicáveis aparece', na.etapasNaoAplicaveis === 1);

na = API.definirNaoAplica(LINHA_NA, 'cenarios', true);
conferir('duas etapas fora da conta', na.etapasAplicaveis === 10, na.etapasAplicaveis);
conferir('1 de 10 = 10%', Math.round(na.progresso * 100) === 10, Math.round(na.progresso * 100) + '%');
conferir('as duas ficam na célula, separadas por vírgula',
  String(celula(LINHA_NA, API.COLUNA_NAO_APLICA)) === 'beneficio, cenarios',
  String(celula(LINHA_NA, API.COLUNA_NAO_APLICA)));

/* etapa que não se aplica não pode continuar concluída */
API.alternarEtapa(LINHA_NA, 'xml', true);
na = API.definirNaoAplica(LINHA_NA, 'xml', true);
conferir('marcar não se aplica desmarca o concluído',
  na.etapas.filter((x) => x.id === 'xml')[0].concluido === false &&
  celula(LINHA_NA, API.acharEtapaParaTeste('xml').concluido) === false);

/* e concluir de volta reativa a etapa */
na = API.alternarEtapa(LINHA_NA, 'xml', true);
conferir('concluir reativa a etapa',
  na.etapas.filter((x) => x.id === 'xml')[0].naoSeAplica === false &&
  na.etapas.filter((x) => x.id === 'xml')[0].concluido === true);
// beneficio e cenarios seguem fora: 12 - 2 = 10
conferir('e ela volta para a conta', na.etapasAplicaveis === 10, na.etapasAplicaveis);

/* a etapa que não se aplica é pulada na "etapa atual" */
API.ETAPAS.forEach(function (et) { API.alternarEtapa(LINHA_NA, et.id, false); });
API.salvarCelula(LINHA_NA, API.COLUNA_NAO_APLICA, '', 'texto', 'limpeza do teste');
API.alternarEtapa(LINHA_NA, 'documentacao', true);
na = API.definirNaoAplica(LINHA_NA, 'extrato', true);
conferir('a etapa atual pula o que não se aplica',
  na.etapaAtual === API.ETAPAS[2].nome, na.etapaAtual);

/* desmarcar devolve tudo */
na = API.definirNaoAplica(LINHA_NA, 'extrato', false);
conferir('desmarcar devolve a etapa', na.etapasAplicaveis === 12, na.etapasAplicaveis);
conferir('célula esvaziada', String(celula(LINHA_NA, API.COLUNA_NAO_APLICA)) === '',
  '"' + celula(LINHA_NA, API.COLUNA_NAO_APLICA) + '"');
conferir('a mudança ficou no log',
  API.lerLog(60).some((l) => l.oque.indexOf('não se aplica') > 0));

recusa('etapa inexistente', () => API.definirNaoAplica(LINHA_NA, 'nao_existe', true));

/* todas fora da conta: não há o que fazer */
API.ETAPAS.forEach(function (et) { API.definirNaoAplica(LINHA_NA, et.id, true); });
na = API.carregarEmpresa(LINHA_NA);
conferir('nenhuma etapa aplicável', na.etapasAplicaveis === 0);
conferir('empresa sem etapa aplicável conta como pronta', na.progresso === 1, na.progresso);
conferir('e a etapa atual vira Concluído', na.etapaAtual === 'Concluído', na.etapaAtual);
API.ETAPAS.forEach(function (et) { API.definirNaoAplica(LINHA_NA, et.id, false); });

console.log('\n=== 10d2. Os três caminhos do Goiás Fomento ===');
const comFluxos = API.carregarPainel();
const pacote = API.ETAPAS_INICIAIS[0];
const doFomento = comFluxos.etapas.filter((e) =>
  (e.servicos || []).some((s) => API.FOMENTO_TODOS.indexOf(s) >= 0));

conferir('as etapas do fomento foram criadas',
  doFomento.length === pacote.etapas.length,
  doFomento.length + ' de ' + pacote.etapas.length);
conferir('na ordem que o fluxo pede',
  JSON.stringify(doFomento.map((e) => e.nome)) ===
  JSON.stringify(pacote.etapas.map((e) => e.nome)),
  doFomento.map((e) => e.nome).join(' → '));

/* cada caminho começa de um jeito e converge para o mesmo fim */
const fluxos = {};
API.FOMENTO_TODOS.forEach((sv) => {
  fluxos[sv] = comFluxos.etapas
    .filter((e) => !e.servicos.length || e.servicos.indexOf(sv) >= 0)
    .map((e) => e.nome);
});
conferir('a indicação começa pelo contato com o cliente',
  fluxos[API.FOMENTO_INDICACAO][0] === 'Contato com o cliente indicado',
  fluxos[API.FOMENTO_INDICACAO][0]);
conferir('a sondagem começa perguntando do interesse',
  fluxos[API.FOMENTO_SONDAGEM][0] === 'Sondar interesse no crédito',
  fluxos[API.FOMENTO_SONDAGEM][0]);
conferir('a busca própria começa prospectando e oferecendo',
  fluxos[API.FOMENTO_BUSCA][0] === 'Prospectar o cliente' &&
  fluxos[API.FOMENTO_BUSCA][1] === 'Oferecer o crédito',
  fluxos[API.FOMENTO_BUSCA].slice(0, 2).join(' → '));
conferir('os três convergem no mesmo fim',
  API.FOMENTO_TODOS.every((sv) =>
    fluxos[sv].slice(-8).join('|') === fluxos[API.FOMENTO_INDICACAO].slice(-8).join('|')),
  'o trecho comum difere entre os caminhos');
conferir('a busca própria tem uma etapa a mais que os outros dois',
  fluxos[API.FOMENTO_BUSCA].length === fluxos[API.FOMENTO_INDICACAO].length + 1,
  Object.keys(fluxos).map((k) => fluxos[k].length).join(' / '));
conferir('as 12 originais passaram a ser do planejamento tributário',
  comFluxos.etapas.filter((e) => JSON.stringify(e.servicos) ===
    JSON.stringify(['Planejamento Tributário'])).length === 12,
  comFluxos.etapas.filter((e) => JSON.stringify(e.servicos) ===
    JSON.stringify(['Planejamento Tributário'])).length + ' etapas');
conferir('cada etapa nova ganhou sigla própria',
  new Set(comFluxos.etapas.map((e) => e.sigla)).size === comFluxos.etapas.length);

const empresaFomento = API.salvarCabecalho(12, 'servico', API.FOMENTO_INDICACAO);
conferir('empresa do fomento conta só as etapas do caminho dela',
  empresaFomento.etapasAplicaveis === fluxos[API.FOMENTO_INDICACAO].length,
  empresaFomento.etapasAplicaveis + ' vs ' + fluxos[API.FOMENTO_INDICACAO].length);
conferir('e a etapa atual é a primeira do fluxo dela',
  empresaFomento.etapaAtual === 'Contato com o cliente indicado', empresaFomento.etapaAtual);
conferir('as etapas dos outros caminhos ficam de fora',
  empresaFomento.etapas.filter((e) => e.foraDoServico).length ===
  comFluxos.etapas.length - fluxos[API.FOMENTO_INDICACAO].length,
  empresaFomento.etapas.filter((e) => e.foraDoServico).length + '');

const empresaPlanejamento = API.carregarPainel().empresas
  .filter((x) => x.servico === 'Planejamento Tributário')[0];
conferir('empresa de planejamento não herda as etapas do fomento',
  empresaPlanejamento.etapasAplicaveis === 12, empresaPlanejamento.etapasAplicaveis);

API.carregarPainel();
conferir('rodar de novo não duplica nada',
  API.etapas_().length === comFluxos.etapas.length, API.etapas_().length + '');

console.log('\n=== 10e. Campos próprios de cada serviço ===');
const painelCampos = API.carregarPainel();
conferir('aba Campos criada', !!ambiente.abas.Campos);
conferir('os campos de cada serviço foram semeados',
  painelCampos.camposDeServico.length === API.CAMPOS_INICIAIS.length,
  painelCampos.camposDeServico.length + ' de ' + API.CAMPOS_INICIAIS.length);
conferir('cada campo semeado pertence aos serviços que o pediram',
  painelCampos.camposDeServico.every((c) =>
    API.CAMPOS_INICIAIS.some((d) => {
      const pedidos = Array.isArray(d.servico) ? d.servico : [d.servico];
      return d.rotulo === c.rotulo &&
        JSON.stringify(pedidos) === JSON.stringify(c.servicos);
    })),
  painelCampos.camposDeServico.map((c) => c.rotulo).join(', '));
conferir('os campos do fomento valem para os três caminhos',
  painelCampos.camposDeServico.filter((c) => c.servicos.length === 3).length >= 10,
  painelCampos.camposDeServico.filter((c) => c.servicos.length === 3).length + ' campos');
const campoLigacao = painelCampos.camposDeServico
  .filter((c) => c.rotulo === 'Data da ligação de oferta')[0];
conferir('a ligação de oferta é um campo de data',
  !!campoLigacao && campoLigacao.tipo === 'data', campoLigacao && campoLigacao.tipo);
const campoResultado = painelCampos.camposDeServico
  .filter((c) => c.rotulo === 'Resultado do contato')[0];
conferir('o resultado do contato é uma lista com opções',
  !!campoResultado && campoResultado.opcoes.length === 5,
  campoResultado && campoResultado.opcoes.join(' / '));
conferir('os dados da lista de clientes viraram campos',
  ['Município', 'Nome fantasia', 'Protocolo anterior', 'Telefone', 'Celulares',
   'E-mails', 'Proprietários'].every((r) =>
    painelCampos.camposDeServico.some((c) => c.rotulo === r &&
      (c.servicos || []).indexOf(API.FOMENTO_INDICACAO) >= 0)),
  painelCampos.camposDeServico.map((c) => c.rotulo).join(', '));
conferir('as colunas foram criadas com o rótulo no cabeçalho',
  API.campos_().every((c) => String(celula(2, c.coluna)) === c.rotulo),
  API.campos_().map((c) => c.coluna).join(','));
conferir('e com os serviços na linha de baixo',
  API.campos_().every((c) => String(celula(3, c.coluna)) === c.servico),
  API.campos_().map((c) => String(celula(3, c.coluna)).slice(0, 18)).join(' | '));
conferir('nenhuma coluna de campo pisa em coluna de etapa',
  API.campos_().every((c) => c.coluna > 75), API.campos_().map((c) => c.coluna).join(','));

recusa('campo sem nome', () => API.criarCampo('  ', 'texto', API.FOMENTO_INDICACAO));
recusa('tipo inventado', () => API.criarCampo('Teste', 'planilha', API.FOMENTO_INDICACAO));
recusa('serviço fora da lista', () => API.criarCampo('Teste', 'texto', 'Inexistente'));
recusa('campo repetido nos mesmos serviços',
  () => API.criarCampo('Quem ligou', 'texto', API.FOMENTO_TODOS));

const comComum = API.criarCampo('Indicado por', 'texto', '');
conferir('campo sem serviço vale para todos',
  comComum.camposDeServico.filter((c) => c.rotulo === 'Indicado por')[0].servico === '',
  'serviço: "' + comComum.camposDeServico.filter((c) => c.rotulo === 'Indicado por')[0].servico + '"');
conferir('mesmo nome em serviço diferente é permitido',
  !!API.criarCampo('Quem ligou', 'texto', 'Auditoria'));

/* preencher os campos de uma empresa */
const LINHA_GF = 12;
API.salvarCabecalho(LINHA_GF, 'servico', API.FOMENTO_INDICACAO);
const campoData = API.campos_().filter((c) => c.rotulo === 'Data da ligação de oferta')[0];
const campoQuem = API.campos_().filter((c) => c.rotulo === 'Quem ligou' &&
  c.servicos.indexOf(API.FOMENTO_INDICACAO) >= 0)[0];
const campoLista = API.campos_().filter((c) => c.rotulo === 'Resultado do contato')[0];

let gf = API.salvarCampoDoServico(LINHA_GF, campoData.id, '2026-09-01');
conferir('data da ligação gravada como data',
  celula(LINHA_GF, campoData.coluna) instanceof DataDoSandbox);
conferir('lida de volta em ISO',
  gf.campos.filter((c) => c.id === campoData.id)[0].valor === '2026-09-01',
  gf.campos.filter((c) => c.id === campoData.id)[0].valor);

gf = API.salvarCampoDoServico(LINHA_GF, campoQuem.id, 'Thyago Souza');
conferir('quem ligou gravado', celula(LINHA_GF, campoQuem.coluna) === 'Thyago Souza');

recusa('opção fora da lista', () => API.salvarCampoDoServico(LINHA_GF, campoLista.id, 'Talvez'));
gf = API.salvarCampoDoServico(LINHA_GF, campoLista.id, 'Interessado');
conferir('opção válida gravada', celula(LINHA_GF, campoLista.coluna) === 'Interessado');
conferir('o preenchimento ficou no log',
  API.lerLog(40).some((l) => l.oque === 'Resultado do contato'));

conferir('a empresa carrega os valores dos campos',
  gf.campos.length === API.campos_().length, gf.campos.length + ' campos');
conferir('empresa de outro serviço não tem valor nos campos do Goiás Fomento',
  API.carregarEmpresa(LINHA).campos
    .filter((c) => c.servico === API.FOMENTO_INDICACAO).every((c) => !c.valor));

/* excluir campo */
recusa('nome errado na confirmação', () => API.excluirCampo(campoQuem.id, 'outro nome'));
const semCampo = API.excluirCampo(campoQuem.id, 'quem ligou');
conferir('campo saiu da ficha',
  !semCampo.camposDeServico.some((c) => c.id === campoQuem.id));
conferir('a coluna continua na planilha, marcada',
  String(celula(2, campoQuem.coluna)).indexOf('(campo removido)') > 0,
  String(celula(2, campoQuem.coluna)));
conferir('o valor que estava lá não se perdeu',
  celula(LINHA_GF, campoQuem.coluna) === 'Thyago Souza');
conferir('e o campo excluído não volta sozinho no próximo carregamento',
  !API.carregarPainel().camposDeServico.some((c) => c.rotulo === 'Quem ligou' &&
    c.servico === API.FOMENTO_INDICACAO),
  'o campo ressuscitou');

console.log('\n=== 10f. Importar a lista de clientes ===');
/* dado de cliente real não entra no repositório: os testes rodam sobre um
   exemplo fictício, e usam o arquivo de verdade se ele estiver na máquina */
const CAMINHO_LISTA = ['clientes-exemplo.txt', 'exemplo-importacao.txt']
  .map((n) => path.join(RAIZ, 'teste', 'dados', n))
  .filter((c) => fs.existsSync(c))[0];
const listaBruta = fs.readFileSync(CAMINHO_LISTA, 'utf8');
const lidos = API.interpretarListaDeClientes_(listaBruta);
const QUANTOS_NA_LISTA = lidos.length;

conferir('leu todos os clientes da lista', QUANTOS_NA_LISTA >= 3,
  QUANTOS_NA_LISTA + ' clientes de ' + path.basename(CAMINHO_LISTA));
conferir('o cabeçalho da lista não virou cliente',
  !lidos.some((c) => c.nome.indexOf('CLIENTES QUE AINDA') >= 0));
conferir('cada bloco virou uma empresa com nome',
  lidos.every((c) => c.nome && c.nome.length > 3), lidos.map((c) => c.nome).join(' | '));
conferir('todos os CNPJs válidos', lidos.every((c) => API.cnpjValido_(c.cnpj)));
conferir('o sufixo do tipo fica no nome, como vem na lista',
  lidos.some((c) => /(VIP|MEI)/.test(c.nome)), lidos.map((c) => c.nome).join(' | '));

const viggma = lidos[0].campos;
conferir('município lido', !!viggma['Município'], viggma['Município']);
conferir('nome fantasia lido', !!viggma['Nome fantasia'], viggma['Nome fantasia']);
conferir('protocolo anterior lido inteiro, com o histórico ao lado',
  viggma['Protocolo anterior'].indexOf('/20') > 0 &&
  viggma['Protocolo anterior'].indexOf('quitado') > 0,
  viggma['Protocolo anterior']);
conferir('telefone lido', /^\(\d{2}\) \d/.test(viggma['Telefone']), viggma['Telefone']);
conferir('vários celulares numa linha só',
  viggma['Celulares'].split('·').length >= 2, viggma['Celulares']);
conferir('e-mails separados, não colados',
  viggma['E-mails'].split('·').length >= 2 &&
  viggma['E-mails'].split('·').every((e) => e.indexOf('@') > 0),
  viggma['E-mails']);
conferir('dois proprietários na mesma linha',
  viggma['Proprietários'].indexOf('//') > 0, viggma['Proprietários']);

const semFantasia = lidos.filter((c) => c.campos['Nome fantasia'] === undefined ||
  c.campos['Telefone'] === undefined || c.campos['Proprietários'] === undefined);
conferir('o que falta no bloco não é inventado', semFantasia.length >= 1,
  'todo bloco veio completo, sem caso-limite para conferir');
conferir('TEL vazio é ignorado',
  lidos.every((c) => c.campos['Telefone'] === undefined || c.campos['Telefone'] !== ''));

const conferencia = API.conferirListaDeClientes(listaBruta);
conferir('a conferência mostra todos antes de gravar',
  conferencia.total === QUANTOS_NA_LISTA);
conferir('e nenhum consta como já cadastrado',
  conferencia.clientes.every((c) => !c.jaCadastrado));
conferir('conferir não grava nada',
  API.carregarPainel().empresas.length === API.carregarPainel().empresas.length);

const antesDaImportacao = API.carregarPainel().empresas.length;
recusa('importar sem serviço', () => API.importarClientes(listaBruta, ''));
recusa('importar para serviço inexistente', () => API.importarClientes(listaBruta, 'Nada'));
recusa('texto sem nenhum cliente', () => API.importarClientes('bom dia', API.FOMENTO_INDICACAO));

const importado = API.importarClientes(listaBruta, API.FOMENTO_INDICACAO);
conferir('todas as empresas da lista entraram',
  importado.empresas.length === antesDaImportacao + QUANTOS_NA_LISTA,
  importado.empresas.length + ' vs ' + (antesDaImportacao + QUANTOS_NA_LISTA));
conferir('o retorno diz o que foi feito',
  importado.importacao.criados.length === QUANTOS_NA_LISTA &&
  importado.importacao.repetidos.length === 0,
  JSON.stringify(importado.importacao));

const novaViggma = importado.empresas.filter((x) => x.nome === lidos[0].nome)[0];
conferir('com o serviço certo', novaViggma.servico === API.FOMENTO_INDICACAO,
  novaViggma.servico);
conferir('com o CNPJ formatado e válido',
  novaViggma.cnpjs.length === 1 && novaViggma.cnpjs[0].numero === lidos[0].cnpj,
  JSON.stringify(novaViggma.cnpjs));
conferir('com o município preenchido',
  novaViggma.campos.filter((c) => c.rotulo === 'Município')[0].valor ===
  lidos[0].campos['Município']);
conferir('com os celulares preenchidos',
  novaViggma.campos.filter((c) => c.rotulo === 'Celulares')[0].valor ===
  lidos[0].campos['Celulares']);
conferir('com os proprietários preenchidos',
  novaViggma.campos.filter((c) => c.rotulo === 'Proprietários')[0].valor ===
  lidos[0].campos['Proprietários']);
conferir('sem nenhuma etapa concluída: ainda não foram contatados',
  novaViggma.etapas.every((e) => !e.concluido), 'alguma etapa veio marcada');
conferir('e já no fluxo daquele caminho do fomento',
  novaViggma.etapaAtual === 'Contato com o cliente indicado', novaViggma.etapaAtual);
conferir('sem data de ligação, porque ninguém ligou ainda',
  !novaViggma.campos.filter((c) => c.rotulo === 'Data da ligação de oferta')[0].valor);

/* importar de novo não duplica nem mexe no que já está preenchido */
const segundaVez = API.importarClientes(listaBruta, API.FOMENTO_INDICACAO);
conferir('reimportar não duplica ninguém',
  segundaVez.empresas.length === importado.empresas.length,
  segundaVez.empresas.length + ' vs ' + importado.empresas.length);
conferir('e não altera nada, porque já está tudo preenchido',
  segundaVez.importacao.criados.length === 0 && segundaVez.importacao.atualizados.length === 0,
  JSON.stringify(segundaVez.importacao));
conferir('a conferência passa a marcar os já cadastrados naquele serviço',
  API.conferirListaDeClientes(listaBruta, API.FOMENTO_INDICACAO).clientes.every((c) => c.jaCadastrado));
conferir('e em outro serviço eles aparecem como novos, não como repetidos',
  API.conferirListaDeClientes(listaBruta, 'Auditoria').clientes.every((c) => !c.jaCadastrado));
conferir('a importação ficou no log',
  API.lerLog(40).some((l) => l.oque.indexOf('Lista aplicada em') === 0),
  API.lerLog(5).map((l) => l.oque).join(' | '));

console.log('  --- trechos que não viram cliente ---');
const comLixo = listaBruta + '\n' +
  '..................................................................................................\n' +
  'MUNICÍPIO: GOIANIA\nEMPRESA SEM CNPJ LTDA\nTEL.: (62) 3333-3333\n' +
  '..................................................................................................\n' +
  'MUNICÍPIO: GOIANIA\n05.667.935/0001-99\n';
const conferida = API.conferirListaDeClientes(comLixo);
conferir('o bloco sem CNPJ é recusado, não ignorado em silêncio',
  conferida.recusados.some((r) => r.motivo === 'sem CNPJ válido'),
  JSON.stringify(conferida.recusados));
conferir('e o CNPJ com dígito errado também',
  conferida.recusados.length === 2, JSON.stringify(conferida.recusados.map((r) => r.motivo)));
conferir('os clientes bons continuam sendo reconhecidos',
  conferida.total === QUANTOS_NA_LISTA, conferida.total);

console.log('  --- desfazer a importação ---');
const nomesImportados = importado.importacao.criados;
const antesDeDesfazer = API.carregarPainel().empresas.length;
recusa('desfazer sem lista', () => API.desfazerImportacao([]));

const desfeito = API.desfazerImportacao(nomesImportados);
conferir('as importadas saíram',
  desfeito.empresas.length === antesDeDesfazer - QUANTOS_NA_LISTA,
  desfeito.empresas.length + ' vs ' + (antesDeDesfazer - QUANTOS_NA_LISTA));
conferir('o retorno diz quais saíram',
  (desfeito.desfeito || []).length === QUANTOS_NA_LISTA, JSON.stringify(desfeito.desfeito));
conferir('nenhuma delas continua na lista',
  !desfeito.empresas.some((e) => nomesImportados.indexOf(e.nome) >= 0));
conferir('as outras empresas continuam lá',
  desfeito.empresas.length === antesDeDesfazer - QUANTOS_NA_LISTA &&
  desfeito.empresas.length > 30);
conferir('elas foram arquivadas, não apagadas',
  API.listarExcluidas(30).filter((x) => nomesImportados.indexOf(x.empresa) >= 0).length ===
  QUANTOS_NA_LISTA,
  API.listarExcluidas(30).map((x) => x.empresa).join(', '));
conferir('o desfazer ficou no log',
  API.lerLog(20).some((l) => l.oque === 'Importação desfeita'));
conferir('e dá para importar de novo depois de desfazer',
  API.importarClientes(listaBruta, API.FOMENTO_INDICACAO).importacao.criados.length ===
  QUANTOS_NA_LISTA);

console.log('\n=== 10g. Atualizar as empresas de prospecção ===');
/* usa a lista real se ela estiver na máquina; senão, monta uma equivalente a
   partir do exemplo fictício — o caso que importa é a empresa que já é cliente
   de outro serviço, e esse eu construo com uma que já está na planilha */
const caminhoProsp = path.join(RAIZ, 'teste', 'dados', 'prospeccao.txt');
const naPlanilha = API.carregarPainel().empresas
  .filter((e) => e.servico !== 'Diagnóstico Prospecção' && e.nome.length > 5);

/* a lista real já traz empresas que são clientes de outro serviço; a fictícia
   não, então uso uma da planilha para construir o mesmo caso */
const nomesDaListaReal = fs.existsSync(caminhoProsp)
  ? API.interpretarListaDeClientes_(fs.readFileSync(caminhoProsp, 'utf8')).map((c) => c.nome)
  : [];
const empresaQueJaExiste = nomesDaListaReal.length
  ? naPlanilha.filter((e) => nomesDaListaReal.indexOf(e.nome) >= 0)[0]
  : naPlanilha[0];

const listaProspeccao = fs.existsSync(caminhoProsp)
  ? fs.readFileSync(caminhoProsp, 'utf8')
  : [
      'MUNICÍPIO: GOIANIA', '', empresaQueJaExiste.nome, '', '11.222.333/0001-81',
      'Regime Tributário: LUCRO REAL', 'Capital Social: 100.000,00',
      'Receita Bruta Anual: 500.000,00', 'Data da Análise: 10/10/2025',
      'Responsável pela Análise: Equipe Analyze',
      '', '.'.repeat(98), '',
      'MUNICÍPIO: GOIANIA', '', 'CONSULTORIA EXEMPLO LTDA', '', '11.444.777/0001-61',
      'Regime Tributário: SIMPLES NACIONAL', 'Capital Social: 50.000,00',
      'Receita Bruta Anual: 300.000,00', 'Data da Análise: 11/10/2025',
      'Responsável pela Análise: Equipe Analyze'
    ].join('\n');

const lidasProsp = API.interpretarListaDeClientes_(listaProspeccao);
const QUANTAS_PROSP = lidasProsp.length;
conferir('leu a lista de prospecção', QUANTAS_PROSP >= 2, QUANTAS_PROSP + ' empresas');
conferir('todos os CNPJs válidos, inclusive os escritos fora do padrão',
  lidasProsp.every((c) => API.cnpjValido_(c.cnpj)));
conferir('leu o regime tributário', !!lidasProsp[0].campos['Regime'],
  lidasProsp[0].campos['Regime']);
conferir('leu capital, receita, data e responsável',
  !!lidasProsp[0].campos['Capital social'] && !!lidasProsp[0].campos['Receita bruta anual'] &&
  !!lidasProsp[0].campos['Data da análise'] && !!lidasProsp[0].campos['Responsável pela análise'],
  JSON.stringify(lidasProsp[0].campos));

const conferidaProsp = API.conferirListaDeClientes(listaProspeccao, 'Diagnóstico Prospecção');
conferir('nenhuma consta como já cadastrada no serviço',
  conferidaProsp.clientes.every((c) => !c.jaCadastrado));
const noutroServico = conferidaProsp.clientes.filter((c) => c.tambemEm);
conferir('mas avisa quais já são clientes de outro serviço',
  noutroServico.length >= 1,
  noutroServico.map((c) => c.nome.slice(0, 16) + '→' + c.tambemEm).join(', '));

const antesProsp = API.carregarPainel();
const wbproAntes = antesProsp.empresas.filter((e) => e.nome === empresaQueJaExiste.nome)[0];
const servicoOriginal = wbproAntes.servico;
const regimeOriginal = wbproAntes.regime;

const depoisProsp = API.importarClientes(listaProspeccao, 'Diagnóstico Prospecção');
conferir('todas viram linha nova, mesmo as que já existiam em outro serviço',
  depoisProsp.empresas.length === antesProsp.empresas.length + QUANTAS_PROSP,
  depoisProsp.empresas.length + ' vs ' + (antesProsp.empresas.length + QUANTAS_PROSP));
conferir('o retorno aponta quem já era cliente de outro serviço',
  depoisProsp.importacao.criados.length === QUANTAS_PROSP &&
  depoisProsp.importacao.tambemEmOutroServico.length >= 1,
  JSON.stringify({ criadas: depoisProsp.importacao.criados.length,
                   noutro: depoisProsp.importacao.tambemEmOutroServico.length }));

const wbpros = depoisProsp.empresas.filter((e) => e.nome === empresaQueJaExiste.nome);
conferir('a mesma empresa passa a ter uma linha por serviço', wbpros.length === 2,
  wbpros.map((e) => e.servico || '(sem serviço)').join(' + '));
conferir('a linha antiga fica como estava',
  wbpros.filter((e) => e.servico === servicoOriginal)[0].regime === regimeOriginal);
conferir('e a nova nasce em Diagnóstico Prospecção',
  wbpros.filter((e) => e.servico === 'Diagnóstico Prospecção').length === 1);
conferir('cada uma com o seu próprio andamento',
  wbpros[0].etapasAplicaveis !== undefined && wbpros[1].etapasAplicaveis !== undefined);

const gasol = depoisProsp.empresas.filter((e) => e.nome === lidasProsp[0].nome &&
  e.servico === 'Diagnóstico Prospecção')[0];
conferir('a empresa nova entrou no serviço de diagnóstico',
  gasol.servico === 'Diagnóstico Prospecção', gasol.servico);
conferir('com regime, capital, receita, data e responsável',
  gasol.regime === lidasProsp[0].campos['Regime'] &&
  !!gasol.campos.filter((c) => c.rotulo === 'Capital social')[0].valor &&
  !!gasol.campos.filter((c) => c.rotulo === 'Data da análise')[0].valor,
  gasol.campos.filter((c) => c.valor).map((c) => c.rotulo).join(', '));

/* aplicar a mesma lista de novo, no mesmo serviço, não duplica */
const deNovo = API.importarClientes(listaProspeccao, 'Diagnóstico Prospecção');
conferir('reaplicar no mesmo serviço não cria nem altera nada',
  deNovo.empresas.length === depoisProsp.empresas.length &&
  deNovo.importacao.criados.length === 0 && deNovo.importacao.atualizados.length === 0,
  JSON.stringify({ total: deNovo.empresas.length,
                   criadas: deNovo.importacao.criados.length,
                   completadas: deNovo.importacao.atualizados.length }));

/* a mesma lista em outro serviço é outro trabalho: entra de novo */
const emAuditoria = API.importarClientes(listaProspeccao, 'Auditoria');
conferir('a mesma lista em outro serviço cria as linhas daquele serviço',
  emAuditoria.importacao.criados.length === QUANTAS_PROSP,
  emAuditoria.importacao.criados.length + ' criadas');
conferir('e a empresa passa a aparecer nos dois',
  emAuditoria.empresas.filter((e) => e.nome === lidasProsp[0].nome &&
    ['Diagnóstico Prospecção', 'Auditoria'].indexOf(e.servico) >= 0).length === 2);

console.log('  ' + QUANTAS_PROSP + ' empresas de prospecção, ' +
  depoisProsp.importacao.tambemEmOutroServico.length + ' delas já clientes de outro serviço');

console.log('\n=== 11. Excluir empresa ===');
const antesDeExcluir = API.carregarPainel().empresas;
const alvo = antesDeExcluir.filter((x) => x.nome === 'EMPRESA DE TESTE LTDA')[0];
conferir('achou a empresa criada no teste', !!alvo, alvo ? alvo.nome : 'não achei');

function recusa(rotulo, fn) {
  const linhasAntes = ambiente.abas.Controle.grade.length;
  let recusou = false, mensagem = '';
  try { fn(); } catch (err) { recusou = true; mensagem = err.message; }
  conferir(rotulo + ': recusado', recusou, 'não recusou');
  conferir(rotulo + ': planilha intacta',
    ambiente.abas.Controle.grade.length === linhasAntes, 'a planilha encolheu');
  return mensagem;
}

let msg = recusa('sem confirmar o nome', () => API.excluirEmpresa(alvo.linha, ''));
conferir('mensagem cita o nome esperado', msg.indexOf('EMPRESA DE TESTE LTDA') > 0, msg);
recusa('nome errado', () => API.excluirEmpresa(alvo.linha, 'OUTRA EMPRESA'));
recusa('nome quase igual', () => API.excluirEmpresa(alvo.linha, 'EMPRESA DE TESTE'));
recusa('linha de cabeçalho', () => API.excluirEmpresa(2, 'Empresa:'));
recusa('linha inexistente', () => API.excluirEmpresa(999, 'qualquer'));
recusa('linha vazia', () => API.excluirEmpresa(ambiente.abas.Controle.grade.length + 1, ''));

const painelDepois = API.excluirEmpresa(alvo.linha, '  empresa de teste ltda  ');
conferir('aceita nome com espaços e caixa diferente', true);
conferir('empresa sumiu do painel',
  !painelDepois.empresas.some((x) => x.nome === 'EMPRESA DE TESTE LTDA'));
conferir('painel voltou ao tamanho original',
  painelDepois.empresas.length === antesDeExcluir.length - 1,
  painelDepois.empresas.length + ' vs ' + (antesDeExcluir.length - 1));

console.log('\n=== 12. Excluir do meio não embaralha as outras ===');
const antesDoMeio = API.carregarPainel().empresas;
const meio = antesDoMeio[20];
const vizinhaDeBaixo = antesDoMeio[21];
const depoisDoMeio = API.excluirEmpresa(meio.linha, meio.nome);

/* depois de excluir, as linhas de baixo sobem: comparo pela identidade da
   empresa (nome + serviço), não pelo número da linha */
conferir('a excluída sumiu',
  !depoisDoMeio.empresas.some((x) => x.nome === meio.nome && x.servico === meio.servico),
  meio.nome + ' / ' + (meio.servico || '(sem serviço)'));
conferir('e só ela: a linha com o mesmo nome em outro serviço permanece',
  depoisDoMeio.empresas.filter((x) => x.nome === meio.nome).length ===
  antesDoMeio.filter((x) => x.nome === meio.nome).length - 1,
  meio.nome);
conferir('uma empresa a menos', depoisDoMeio.empresas.length === antesDoMeio.length - 1);
conferir('a de baixo subiu uma linha',
  depoisDoMeio.empresas[20].nome === vizinhaDeBaixo.nome,
  'esperava ' + vizinhaDeBaixo.nome + ', veio ' + depoisDoMeio.empresas[20].nome);
conferir('a de baixo subiu com os dados certos',
  JSON.stringify(depoisDoMeio.empresas[20].etapas) === JSON.stringify(vizinhaDeBaixo.etapas),
  'as etapas não acompanharam a linha');
conferir('as de cima ficaram intactas',
  JSON.stringify(depoisDoMeio.empresas.slice(0, 20).map((x) => x.nome)) ===
  JSON.stringify(antesDoMeio.slice(0, 20).map((x) => x.nome)));

console.log('\n=== 13. A excluída fica recuperável ===');
const arquivadas = API.listarExcluidas(30);
conferir('toda empresa excluída foi arquivada',
  arquivadas.some((x) => x.empresa === meio.nome) &&
  arquivadas.some((x) => x.empresa === 'EMPRESA DE TESTE LTDA'),
  arquivadas.map((x) => x.empresa).join(', '));
conferir('mais recente primeiro', arquivadas[0].empresa === meio.nome, arquivadas[0].empresa);
conferir('guarda o responsável do cliente', arquivadas[0].contato === meio.contato,
  '"' + arquivadas[0].contato + '" vs "' + meio.contato + '"');
conferir('guarda o regime', arquivadas[0].regime === meio.regime);
conferir('guarda quem excluiu', arquivadas[0].quem === 'previa@azuos');
const abaExcluidas = ambiente.abas.Excluidas;
conferir('aba Excluidas existe', !!abaExcluidas);
conferir('cabeçalho cobre todas as colunas da planilha',
  abaExcluidas.grade[0].length === API.totalColunas_() + 2,
  abaExcluidas.grade[0].length + ' vs ' + (API.totalColunas_() + 2));
conferir('linha arquivada tem tudo',
  abaExcluidas.grade[1].length === API.totalColunas_() + 2);
conferir('o cabeçalho nomeia as colunas novas',
  abaExcluidas.grade[0].slice(2).filter((r) => String(r).trim() !== '').length >= 70,
  abaExcluidas.grade[0].slice(2).filter((r) => String(r).trim() !== '').length + ' rótulos');
const linhaDoMeio = abaExcluidas.grade.slice(1)
  .filter((l) => String(l[2 + API.COL.empresa - 1]) === meio.nome)[0];
conferir('a linha arquivada é a da empresa certa', !!linhaDoMeio, meio.nome);
conferir('e preserva o que ela tinha marcado',
  !!linhaDoMeio && linhaDoMeio.slice(2).some((v) => v === 'TRUE'), 'nenhum TRUE preservado');

console.log('\n=== 14. O log da exclusão nomeia quem foi excluída ===');
const logFinal = API.lerLog(200);
const registros = logFinal.filter((l) => l.oque === 'Empresa excluída');
conferir('duas exclusões registradas', registros.length === 2, registros.length);
conferir('log nomeia a empresa certa, não a que subiu de linha',
  registros[0].empresa === meio.nome, 'registrou "' + registros[0].empresa + '", era "' + meio.nome + '"');
conferir('log diz para onde foi', registros[0].novo.indexOf('Excluidas') > 0, registros[0].novo);
console.log('  arquivadas: ' + arquivadas.map((a) => a.empresa).join(' | '));

console.log('\n=== 15. O checklist é configurável ===');
const abaEtapas = ambiente.abas.Etapas;
const TOTAL_ETAPAS = API.etapas_().length;
conferir('aba Etapas criada sozinha', !!abaEtapas);
conferir('registro com uma linha por etapa', abaEtapas.grade.length === TOTAL_ETAPAS + 1,
  (abaEtapas.grade.length - 1) + ' de ' + TOTAL_ETAPAS);
conferir('o molde original abre a lista, na ordem',
  JSON.stringify(API.etapas_().slice(0, API.ETAPAS_PADRAO.length).map((e) => e.id)) ===
  JSON.stringify(API.ETAPAS_PADRAO.map((e) => e.id)));

console.log('\n--- incluir ---');
recusa('etapa sem nome', () => API.criarEtapa('   '));
recusa('etapa com nome repetido', () => API.criarEtapa('Fazer DRE com as despesas'));

const colunasAntes = API.totalColunas_();
const cnpjAntes = celula(9, API.COLUNA_CNPJ);
const painelNovo = API.criarEtapa('Conferir cálculo com o cliente');
const ultima = painelNovo.etapas[painelNovo.etapas.length - 1];
conferir('o checklist ganhou uma etapa', painelNovo.etapas.length === TOTAL_ETAPAS + 1,
  painelNovo.etapas.length);
conferir('a nova entrou no fim', ultima.nome === 'Conferir cálculo com o cliente');
conferir('ganhou sigla automática', !!ultima.sigla, ultima.sigla);
conferir('sigla não repete',
  new Set(painelNovo.etapas.map((e) => e.sigla)).size === painelNovo.etapas.length);
conferir('id sem acento nem espaço', /^[a-z0-9_]+$/.test(ultima.id), ultima.id);
conferir('três colunas novas', API.totalColunas_() === colunasAntes + 3,
  colunasAntes + ' → ' + API.totalColunas_());
conferir('cabeçalho do grupo escrito', celula(2, colunasAntes + 1) === 'Conferir cálculo com o cliente',
  String(celula(2, colunasAntes + 1)));
conferir('subcabeçalhos como nas outras etapas',
  celula(3, colunasAntes + 1) === 'Responsável:' && celula(3, colunasAntes + 2) === 'Data:' &&
  celula(3, colunasAntes + 3) === 'Concluído');
conferir('coluna do CNPJ não se mexeu', celula(9, API.COLUNA_CNPJ) === cnpjAntes,
  'era ' + cnpjAntes + ', virou ' + celula(9, API.COLUNA_CNPJ));
conferir('toda empresa passou a enxergar a etapa nova',
  painelNovo.empresas.every((x) => x.etapas.length === TOTAL_ETAPAS + 1));
conferir('progresso recalculado sobre 13',
  painelNovo.empresas[0].progresso < antesDeExcluir[0].progresso,
  'antes ' + antesDeExcluir[0].progresso + ', agora ' + painelNovo.empresas[0].progresso);

const idNovo = ultima.id;
let comNova = API.alternarEtapa(9, idNovo, true);
const marcada = comNova.etapas.filter((x) => x.id === idNovo)[0];
conferir('dá para marcar a etapa nova',
  marcada.concluido === true && celula(9, colunasAntes + 3) === true);
conferir('e a data foi carimbada', !!marcada.data, marcada.data);

console.log('\n--- renomear ---');
recusa('renomear para vazio', () => API.renomearEtapa(idNovo, ''));
recusa('renomear para nome já usado', () => API.renomearEtapa(idNovo, 'Fazer DRE com as despesas'));
recusa('renomear etapa inexistente', () => API.renomearEtapa('nao_existe', 'Qualquer'));

const renomeado = API.renomearEtapa(idNovo, 'Conferência final com o cliente', 'CONF');
const depoisDoNome = renomeado.etapas.filter((x) => x.id === idNovo)[0];
conferir('nome trocado no painel', depoisDoNome.nome === 'Conferência final com o cliente');
conferir('sigla trocada', depoisDoNome.sigla === 'CONF');
conferir('cabeçalho da planilha acompanhou',
  celula(2, colunasAntes + 1) === 'Conferência final com o cliente',
  String(celula(2, colunasAntes + 1)));
conferir('a marcação continua lá', celula(9, colunasAntes + 3) === true);

const renomeadoPadrao = API.renomearEtapa('dre', 'DRE gerencial', 'DREG');
conferir('etapa original também pode ser renomeada',
  renomeadoPadrao.etapas.filter((e) => e.id === 'dre')[0].nome === 'DRE gerencial');
conferir('cabeçalho da etapa original acompanhou', celula(2, 44) === 'DRE gerencial',
  String(celula(2, 44)));
API.renomearEtapa('dre', 'Fazer DRE com as despesas', 'DRE');

console.log('\n--- excluir ---');
recusa('etapa de documentos não sai', () => API.excluirEtapa('documentacao', 'Solicitar documentação'));
recusa('nome errado na confirmação', () => API.excluirEtapa(idNovo, 'outro nome'));
recusa('etapa inexistente', () => API.excluirEtapa('nao_existe', 'x'));

const dadosOutraEtapa = celula(9, 44);
const painelSemNova = API.excluirEtapa(idNovo, '  conferência final com o cliente  ');
conferir('o checklist voltou ao tamanho de antes',
  painelSemNova.etapas.length === TOTAL_ETAPAS, painelSemNova.etapas.length);
conferir('a etapa sumiu do painel', !painelSemNova.etapas.some((e) => e.id === idNovo));
conferir('as empresas voltaram ao checklist anterior',
  painelSemNova.empresas.every((x) => x.etapas.length === TOTAL_ETAPAS));
conferir('as colunas continuam na planilha (nada deslocou)',
  celula(9, 44) === dadosOutraEtapa && celula(9, API.COLUNA_CNPJ) === cnpjAntes);
conferir('cabeçalho marcado como removido',
  String(celula(2, colunasAntes + 1)).indexOf('(etapa removida do checklist)') > 0,
  String(celula(2, colunasAntes + 1)));
conferir('ordem renumerada sem buraco',
  JSON.stringify(painelSemNova.etapas.map((e) => e.posicao)) ===
  JSON.stringify(painelSemNova.etapas.map((_, i) => i + 1)));

const arquivoEtapa = ambiente.abas['Etapas excluidas'];
conferir('aba de etapas excluídas criada', !!arquivoEtapa);
conferir('arquivou uma linha por empresa',
  arquivoEtapa.grade.length === painelSemNova.empresas.length + 1,
  (arquivoEtapa.grade.length - 1) + ' linhas para ' + painelSemNova.empresas.length + ' empresas');
const arquivadaMarcada = arquivoEtapa.grade.slice(1).filter((l) => l[6] === 'TRUE');
conferir('guardou quem tinha a etapa concluída', arquivadaMarcada.length === 1,
  arquivadaMarcada.length + ' marcadas');
conferir('guardou o nome da etapa',
  arquivoEtapa.grade[1][2] === 'Conferência final com o cliente', arquivoEtapa.grade[1][2]);

const logChecklist = API.lerLog(300).filter((l) => l.empresa === '(checklist)');
conferir('as três operações ficaram no log', logChecklist.length >= 3,
  logChecklist.map((l) => l.oque).join(', '));

console.log('\n=== 15b. Um checklist só, dividido por serviço ===');
conferir('as etapas do molde valem para o planejamento tributário',
  API.etapas_().slice(0, API.ETAPAS_PADRAO.length)
    .every((e) => e.servicos.length === 0 || e.servicos.indexOf('Planejamento Tributário') >= 0),
  'alguma etapa do molde ficou fora do planejamento');
conferir('etapa sem serviço vale para qualquer empresa',
  API.etapaValePara_({ servicos: [] }, 'Auditoria') === true);

recusa('serviço fora da lista', () => API.definirServicosDaEtapa('dre', ['Inexistente']));
conferir('o mesmo serviço duas vezes não duplica',
  API.definirServicosDaEtapa('dre', ['Auditoria', 'Auditoria'])
    .etapas.filter((e) => e.id === 'dre')[0].servicos.length === 1);

/* a empresa da linha 9 é de Auditoria; as demais, de Planejamento Tributário */
const daLinha = API.carregarEmpresa(LINHA);
conferir('empresa de teste é de Auditoria', daLinha.servico === 'Auditoria', daLinha.servico);
const aplicaveisAntes = daLinha.etapasAplicaveis;

API.definirServicosDaEtapa('dre', []); // parte de um estado conhecido
const aplicaveisComDre = API.carregarEmpresa(LINHA).etapasAplicaveis;
const comServico = API.definirServicosDaEtapa('dre', ['Planejamento Tributário']);
const auditoria = comServico.empresas.filter((x) => x.linha === LINHA)[0];
const outra = comServico.empresas.filter((x) => x.servico === 'Planejamento Tributário')[0];

conferir('a etapa passou a pertencer a um serviço',
  JSON.stringify(comServico.etapas.filter((e) => e.id === 'dre')[0].servicos) ===
  JSON.stringify(['Planejamento Tributário']));
conferir('some da conta de quem é de outro serviço',
  auditoria.etapasAplicaveis === aplicaveisComDre - 1,
  auditoria.etapasAplicaveis + ' vs ' + (aplicaveisComDre - 1));
conferir('a etapa vem marcada como fora do serviço',
  auditoria.etapas.filter((x) => x.id === 'dre')[0].foraDoServico === true);
conferir('mas continua valendo para quem é do serviço',
  outra.etapas.filter((x) => x.id === 'dre')[0].foraDoServico !== true &&
  outra.etapas.filter((x) => x.id === 'dre')[0].doServico === true);
conferir('a etapa segue existindo para todo mundo na lista',
  comServico.etapas.length === API.etapas_().length);

/* etapa de dois serviços */
const doisServicos = API.definirServicosDaEtapa('dre', ['Planejamento Tributário', 'Auditoria']);
conferir('etapa pode pertencer a mais de um serviço',
  doisServicos.empresas.filter((x) => x.linha === LINHA)[0]
    .etapas.filter((x) => x.id === 'dre')[0].doServico === true);
conferir('e volta para a conta', doisServicos.empresas.filter((x) => x.linha === LINHA)[0]
  .etapasAplicaveis === aplicaveisComDre,
  doisServicos.empresas.filter((x) => x.linha === LINHA)[0].etapasAplicaveis);

/* etapa atual pula o que é de outro serviço */
API.definirServicosDaEtapa('documentacao', ['Planejamento Tributário']);
const pulando = API.carregarEmpresa(LINHA);
conferir('a etapa atual ignora o que é de outro serviço',
  pulando.etapas.filter((x) => x.nome === pulando.etapaAtual)[0].doServico === true,
  pulando.etapaAtual);
API.definirServicosDaEtapa('documentacao', []);

/* voltar ao comum */
const semServico = API.definirServicosDaEtapa('dre', []);
conferir('lista vazia devolve a etapa para todos',
  semServico.etapas.filter((e) => e.id === 'dre')[0].servicos.length === 0);
conferir('todas as empresas voltam a contar a etapa',
  semServico.empresas.every((x) => x.etapas.filter((y) => y.id === 'dre')[0].doServico === true));
conferir('a mudança de serviço ficou no log',
  API.lerLog(80).some((l) => l.oque.indexOf('— serviços') > 0));

/* etapa criada já com serviço */
const criadaComServico = API.criarEtapa('Relatório final de auditoria', 'RELAT', ['Auditoria']);
const etapaDeAuditoria = criadaComServico.etapas[criadaComServico.etapas.length - 1];
conferir('dá para criar etapa já de um serviço',
  JSON.stringify(etapaDeAuditoria.servicos) === JSON.stringify(['Auditoria']), JSON.stringify(etapaDeAuditoria.servicos));
conferir('ela não entra na conta de quem é de outro serviço',
  criadaComServico.empresas.filter((x) => x.servico === 'Planejamento Tributário')[0]
    .etapas.filter((y) => y.id === etapaDeAuditoria.id)[0].foraDoServico === true);
conferir('e entra na de quem é do serviço',
  criadaComServico.empresas.filter((x) => x.linha === LINHA)[0]
    .etapas.filter((y) => y.id === etapaDeAuditoria.id)[0].doServico === true);
API.excluirEtapa(etapaDeAuditoria.id, 'Relatório final de auditoria');

console.log('\n--- a matriz: várias etapas de uma vez ---');
const antesDoLote = API.etapas_().map((e) => ({ id: e.id, servicos: (e.servicos || []).join(',') }));
const paraLote = API.etapas_().slice(0, 3).map((e) => ({ id: e.id, servicos: ['Auditoria'] }));
const emLote = API.definirServicosDeVarias(paraLote);
conferir('as três etapas mudaram juntas',
  paraLote.every((p) => JSON.stringify(
    emLote.etapas.filter((e) => e.id === p.id)[0].servicos) === JSON.stringify(['Auditoria'])));
conferir('as demais ficaram como estavam',
  antesDoLote.slice(3).every((a) =>
    emLote.etapas.filter((e) => e.id === a.id)[0].servicos.join(',') === a.servicos),
  'alguma etapa fora do lote mudou');

const antesDaRecusa = API.etapas_().map((e) => (e.servicos || []).join(','));
recusa('um serviço inválido no lote derruba o lote inteiro', () =>
  API.definirServicosDeVarias([
    { id: API.etapas_()[5].id, servicos: ['Auditoria'] },
    { id: API.etapas_()[6].id, servicos: ['Não existe'] }
  ]));
conferir('e nenhuma etapa foi alterada pela tentativa',
  JSON.stringify(API.etapas_().map((e) => (e.servicos || []).join(','))) ===
  JSON.stringify(antesDaRecusa));

const limpo = API.definirServicosDeVarias(
  API.etapas_().map((e) => ({ id: e.id, servicos: [] })));
conferir('limpar a coluna devolve tudo para todos',
  limpo.etapas.every((e) => e.servicos.length === 0));
conferir('e isso não faz o fluxo do Goiás Fomento ser criado de novo',
  API.carregarPainel().etapas.length === limpo.etapas.length,
  API.carregarPainel().etapas.length + ' vs ' + limpo.etapas.length);

console.log('\n=== 15c. Exportar para Excel ===');
const exportado = API.exportarParaExcel();
const painelAtual2 = API.carregarPainel();

conferir('o arquivo tem nome com data',
  /^Controle_Tarefas_e_Servicos_\d{4}-\d{2}-\d{2}_\d{2}-\d{2}\.xlsx$/.test(exportado.nome),
  exportado.nome);
conferir('exporta todas as empresas', exportado.quantas === painelAtual2.empresas.length,
  exportado.quantas + ' vs ' + painelAtual2.empresas.length);

/* o arquivo tem de ser um .xlsx de verdade — zip com as partes que o Excel exige */
const bytes = Buffer.from(exportado.conteudo, 'base64');
conferir('começa com a assinatura de um zip',
  bytes[0] === 0x50 && bytes[1] === 0x4B, bytes.slice(0, 2).toString('hex'));

fs.writeFileSync('/tmp/exportacao-do-teste.xlsx', bytes);
const { execFileSync } = require('child_process');
const tipo = execFileSync('file', ['-b', '/tmp/exportacao-do-teste.xlsx']).toString().trim();
conferir('o sistema reconhece como Excel', tipo.indexOf('Excel') >= 0, tipo);

const partes = execFileSync('python3', ['-c',
  'import zipfile,sys; z=zipfile.ZipFile("/tmp/exportacao-do-teste.xlsx"); ' +
  'print("INTEGRO" if z.testzip() is None else "CORROMPIDO"); print("|".join(z.namelist()))'
]).toString().trim().split('\n');
conferir('o zip está íntegro', partes[0] === 'INTEGRO', partes[0]);
['[Content_Types].xml', '_rels/.rels', 'xl/workbook.xml', 'xl/_rels/workbook.xml.rels',
 'xl/styles.xml', 'xl/worksheets/sheet1.xml', 'docProps/core.xml',
 'docProps/app.xml'].forEach(function (parte) {
  conferir('tem ' + parte, partes[1].indexOf(parte) >= 0, partes[1]);
});

/* o Excel recusa arquivo com XML malformado ou relação apontando para o vazio */
const validacao = execFileSync('python3', ['-c',
  'import zipfile,re\n' +
  'from xml.etree import ElementTree as ET\n' +
  'z=zipfile.ZipFile("/tmp/exportacao-do-teste.xlsx")\n' +
  'p=[]\n' +
  'for n in z.namelist():\n' +
  '    try: ET.fromstring(z.read(n))\n' +
  '    except Exception as e: p.append(n+": XML invalido")\n' +
  'for rels in ["_rels/.rels","xl/_rels/workbook.xml.rels"]:\n' +
  '    base = "" if rels == "_rels/.rels" else "xl/"\n' +
  '    for m in re.finditer(r\'Target="([^"]+)"\', z.read(rels).decode()):\n' +
  '        alvo=(base+m.group(1)).replace("//","/")\n' +
  '        if alvo not in z.namelist(): p.append(rels+" aponta para "+alvo)\n' +
  'for m in re.finditer(r\'PartName="/([^"]+)"\', z.read("[Content_Types].xml").decode()):\n' +
  '    if m.group(1) not in z.namelist(): p.append("Content_Types declara "+m.group(1))\n' +
  'print("OK" if not p else " | ".join(p))'
]).toString().trim();
conferir('todo XML é válido e toda parte declarada existe', validacao === 'OK', validacao);

const conteudoDaAba = execFileSync('python3', ['-c',
  'import zipfile; print(zipfile.ZipFile("/tmp/exportacao-do-teste.xlsx")' +
  '.read("xl/worksheets/sheet1.xml").decode("utf-8"))'
]).toString();

const linhasNoXml = (conteudoDaAba.match(/<row r="\d+"/g) || []).length;
conferir('uma linha por empresa, mais o cabeçalho',
  linhasNoXml === painelAtual2.empresas.length + 1, linhasNoXml + ' linhas');
conferir('a primeira linha fica congelada', conteudoDaAba.indexOf('state="frozen"') > 0);

/* o XML escapa & < > " ' — desescapo para comparar com o que está no painel */
function desescapar(t) {
  return t.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'");
}
const textos = [];
conteudoDaAba.replace(/<t xml:space="preserve">([^<]*)<\/t>/g, function (_, t) {
  textos.push(desescapar(t)); return _;
});
conferir('o cabeçalho abre com as colunas de identificação',
  textos.slice(0, 5).join(';') === 'Nº;Empresa;CNPJ;Serviço;Regime', textos.slice(0, 5).join(';'));
conferir('tem uma coluna por etapa',
  painelAtual2.etapas.every((et) => textos.indexOf(et.posicao + '. ' + et.nome) >= 0),
  'faltou alguma etapa no cabeçalho');
conferir('e uma por campo de serviço',
  painelAtual2.camposDeServico.every((c) =>
    textos.some((t) => t.indexOf(c.rotulo) === 0)), 'faltou algum campo');
conferir('as empresas aparecem pelo nome',
  painelAtual2.empresas.every((e) => textos.indexOf(e.nome) >= 0),
  'alguma empresa ficou de fora');
conferir('o progresso vai como número, não texto',
  /<c r="I2"><v>[\d.]+<\/v><\/c>/.test(conteudoDaAba),
  (conteudoDaAba.match(/<c r="I2"[^>]*>.{0,40}/) || [''])[0]);
conferir('nenhuma etapa sai como TRUE/FALSE',
  textos.indexOf('TRUE') < 0 && textos.indexOf('FALSE') < 0);

const soUma = API.exportarParaExcel([painelAtual2.empresas[0].linha]);
conferir('dá para exportar só o que está filtrado', soUma.quantas === 1, soUma.quantas);
fs.writeFileSync('/tmp/exportacao-uma.xlsx', Buffer.from(soUma.conteudo, 'base64'));
const linhasDeUma = execFileSync('python3', ['-c',
  'import zipfile,re; x=zipfile.ZipFile("/tmp/exportacao-uma.xlsx")' +
  '.read("xl/worksheets/sheet1.xml").decode("utf-8"); print(len(re.findall(r\'<row r=\', x)))'
]).toString().trim();
conferir('e o arquivo sai com uma linha só, mais o cabeçalho', linhasDeUma === '2', linhasDeUma);

recusa('exportar sem nenhuma empresa', () => API.exportarParaExcel([99999]));
conferir('a exportação ficou no log',
  API.lerLog(20).some((l) => l.oque === 'Exportado para Excel'));
console.log('  arquivo de exemplo: /tmp/exportacao-do-teste.xlsx (' +
  (bytes.length / 1024).toFixed(0) + ' KB, ' + exportado.colunas + ' colunas)');

console.log('\n=== 16. Classificar pela numeração ===');
const painelAtual = API.carregarPainel();
const numerosAntes = painelAtual.empresas.map((e) => e.numero);
const repetidos = numerosAntes.filter((n, i) => numerosAntes.indexOf(n) !== i);
console.log('  antes de renumerar: ' + repetidos.length + ' número(s) repetido(s)' +
  (repetidos.length ? ' (' + [...new Set(repetidos)].join(', ') + ')' : ''));

e = API.salvarCabecalho(LINHA, 'numero', '99');
conferir('número da empresa é editável', celula(LINHA, API.COL.numero) === '99',
  String(celula(LINHA, API.COL.numero)));
conferir('lido de volta', e.numero === '99', e.numero);

const nomesAntes = painelAtual.empresas.map((x) => x.nome);
const renumerado = API.renumerarEmpresas();
const numerosDepois = renumerado.empresas.map((x) => Number(x.numero));

conferir('numeração vai de 1 ao total',
  JSON.stringify(numerosDepois) ===
  JSON.stringify(renumerado.empresas.map((_, i) => i + 1)),
  numerosDepois.slice(0, 5).join(',') + ' … ' + numerosDepois.slice(-3).join(','));
conferir('sem número repetido', new Set(numerosDepois).size === numerosDepois.length);
conferir('nenhuma empresa mudou de lugar',
  JSON.stringify(renumerado.empresas.map((x) => x.nome)) === JSON.stringify(nomesAntes));
conferir('nada além do número foi tocado',
  JSON.stringify(renumerado.empresas.map((x) => x.etapas)) ===
  JSON.stringify(painelAtual.empresas.map((x) => x.etapas)));
conferir('renumeração registrada no log',
  API.lerLog(50).some((l) => l.oque === 'Empresas renumeradas'));

console.log('\n' + '='.repeat(60));
console.log(falhas === 0 ? '✅ ' + checagens + ' checagens de gravação, 0 falhas'
                         : '❌ ' + falhas + ' falhas em ' + checagens + ' checagens');
process.exit(falhas === 0 ? 0 : 1);
