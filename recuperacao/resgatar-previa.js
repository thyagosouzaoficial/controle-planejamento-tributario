/* ------------------------------------------------------------------ *
 * RESGATE DA PRÉVIA
 *
 * Cole isto no console da aba antiga do painel (a que ainda mostra as
 * 83 empresas) e aperte Enter. Ele devolve a lista dos clientes que
 * foram importados, no mesmo formato em que você colou — pronta para
 * importar de novo na prévia nova, que já guarda o que você faz.
 * ------------------------------------------------------------------ */
(function () {
  if (typeof dados === 'undefined' || !dados.empresas) {
    console.log('Esta aba não é o painel. Abra a aba que mostra as empresas.');
    return;
  }

  function campo(empresa, rotulo) {
    var achado = (empresa.campos || []).filter(function (c) { return c.rotulo === rotulo; })[0];
    return achado && achado.valor ? String(achado.valor) : '';
  }

  var risco = '..................................................................................................';

  var blocos = dados.empresas.filter(function (e) {
    // tudo que foi importado tem CNPJ preenchido e serviço definido
    return e.servico && e.cnpjs && e.cnpjs.length;
  }).map(function (e) {
    var linhas = [];
    var municipio = campo(e, 'Município');
    if (municipio) linhas.push('MUNICÍPIO: ' + municipio);
    linhas.push('');
    linhas.push(e.nome);
    linhas.push('');
    linhas.push(e.cnpjs[0].formatado);

    var fantasia = campo(e, 'Nome fantasia');
    if (fantasia) linhas.push('Nome fantasia: ' + fantasia);

    var protocolo = campo(e, 'Protocolo anterior');
    if (protocolo) linhas.push('Protocolo anterior: ' + protocolo);

    var tel = campo(e, 'Telefone');
    if (tel) linhas.push('TEL.: ' + tel);

    campo(e, 'Celulares').split('·').forEach(function (c) {
      if (c.trim()) linhas.push('CEL.: ' + c.trim());
    });

    var emails = campo(e, 'E-mails').split('·').map(function (x) { return x.trim(); })
      .filter(function (x) { return x; });
    if (emails.length) linhas.push('EMAIL.: ' + emails.join('  '));

    var donos = campo(e, 'Proprietários');
    if (donos) linhas.push('PROPRIETÁRIO (A): ' + donos);

    return linhas.join('\n');
  });

  if (!blocos.length) {
    console.log('Nenhum cliente importado encontrado nesta aba.');
    return;
  }

  var texto = blocos.join('\n\n' + risco + '\n\n');

  console.log('=== ' + blocos.length + ' cliente(s) recuperados ===');
  console.log(texto);

  try {
    copy(texto);
    console.log('\n>>> A lista já está na área de transferência. É só colar em "Importar clientes".');
  } catch (e) {
    console.log('\n>>> Selecione o texto acima e copie.');
  }
})();
