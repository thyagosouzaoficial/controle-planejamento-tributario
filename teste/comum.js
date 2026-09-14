/**
 * Peças compartilhadas pelos testes e pela prévia:
 * leitura do CSV exportado da planilha e uma planilha simulada em memória.
 *
 * Este arquivo roda tanto no Node (via require) quanto embutido no navegador
 * pela prévia — por isso nada de sintaxe moderna demais nem de import.
 */

function lerCSV(texto) {
  var linhas = [], campo = '', linha = [], aspas = false;
  for (var i = 0; i < texto.length; i++) {
    var c = texto[i];
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

/** Converte o texto do CSV nos tipos que o Sheets devolve: boolean, Date ou string. */
function tipar(valor, Data) {
  Data = Data || Date;
  var t = String(valor).trim();
  if (t === 'TRUE') return true;
  if (t === 'FALSE') return false;
  var m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return new Data(+m[3], +m[2] - 1, +m[1], 12, 0, 0);
  return valor;
}

/** Quantas colunas a aba Controle tem, incluindo as que o app cria (CNPJ e Serviço). */
var TOTAL_COLUNAS = 110;

/** Lê o CSV e devolve a grade completa (cabeçalhos + empresas), com todas as colunas. */
function carregarGrade(texto, Data) {
  var cru = lerCSV(texto);
  var ultima = 0;
  cru.forEach(function (l, i) { if (l[1] && l[1].trim()) ultima = i; });
  return cru.slice(0, ultima + 1).map(function (l) {
    var c = l.slice();
    while (c.length < TOTAL_COLUNAS) c.push('');
    return c.slice(0, TOTAL_COLUNAS).map(function (v) { return tipar(v, Data); });
  });
}

function exibirValor(v, Data) {
  Data = Data || Date;
  if (v === '' || v === null || v === undefined) return '';
  if (v instanceof Data || v instanceof Date) {
    var p = function (n) { return String(n).padStart(2, '0'); };
    return p(v.getDate()) + '/' + p(v.getMonth() + 1) + '/' + v.getFullYear();
  }
  if (v === true) return 'TRUE';
  if (v === false) return 'FALSE';
  return String(v);
}

/**
 * Monta uma planilha em memória com a mesma API do Apps Script que o Codigo.gs usa.
 * `Data` permite passar o construtor Date do sandbox, para `instanceof` funcionar lá.
 */
function criarPlanilhaSimulada(grade, usuarios, Data) {
  Data = Data || Date;

  function Aba(nome, conteudo) {
    var aba = this;
    this.nome = nome;
    this.grade = conteudo;

    function garantir(r, c) {
      while (aba.grade.length < r) aba.grade.push([]);
      var linha = aba.grade[r - 1];
      while (linha.length < c) linha.push('');
      return linha;
    }

    this.getLastRow = function () {
      for (var i = aba.grade.length; i > 0; i--) {
        var temAlgo = aba.grade[i - 1].some(function (v) {
          return v !== '' && v !== null && v !== undefined;
        });
        if (temAlgo) return i;
      }
      return 0;
    };

    this.getLastColumn = function () {
      var maior = 0;
      aba.grade.forEach(function (linha) {
        for (var i = linha.length; i > 0; i--) {
          if (linha[i - 1] !== '' && linha[i - 1] !== null && linha[i - 1] !== undefined) {
            if (i > maior) maior = i;
            break;
          }
        }
      });
      return maior;
    };

    this.getRange = function (r, c, nr, nc) {
      nr = nr || 1; nc = nc || 1;
      return {
        getValue: function () { return garantir(r, c)[c - 1]; },
        getDisplayValue: function () { return exibirValor(garantir(r, c)[c - 1], Data); },
        getFormula: function () { return ''; },
        clearContent: function () { garantir(r, c)[c - 1] = ''; return this; },
        setValue: function (v) { garantir(r, c)[c - 1] = v; return this; },
        setValues: function (vals) {
          vals.forEach(function (linha, i) {
            linha.forEach(function (v, j) { garantir(r + i, c + j)[c + j - 1] = v; });
          });
          return this;
        },
        getValues: function () {
          var saida = [];
          for (var i = 0; i < nr; i++) {
            var linha = garantir(r + i, c + nc - 1), pedaco = [];
            for (var j = 0; j < nc; j++) pedaco.push(linha[c + j - 1]);
            saida.push(pedaco);
          }
          return saida;
        },
        getDisplayValues: function () {
          var saida = [];
          for (var i = 0; i < nr; i++) {
            var linha = garantir(r + i, c + nc - 1), pedaco = [];
            for (var j = 0; j < nc; j++) pedaco.push(exibirValor(linha[c + j - 1], Data));
            saida.push(pedaco);
          }
          return saida;
        },
        copyTo: function () { return this; },
        setFontWeight: function () { return this; },
        insertCheckboxes: function () {
          for (var i = 0; i < nr; i++) {
            for (var j = 0; j < nc; j++) {
              var linha = garantir(r + i, c + j);
              if (linha[c + j - 1] === '') linha[c + j - 1] = false;
            }
          }
          return this;
        }
      };
    };

    this.appendRow = function (valores) { aba.grade.push(valores.slice()); };
    this.setFrozenRows = function () {};
    this.setName = function (novo) { aba.nome = novo; return aba; };
    this.deleteRow = function (r) { aba.grade.splice(r - 1, 1); };
  }

  var abas = {
    Controle: new Aba('Controle', grade),
    Diagnostico: new Aba('Diagnostico', [['Usuário']].concat(
      (usuarios || []).map(function (u) { return [u]; })))
  };

  var SpreadsheetApp = {
    openById: function () {
      return {
        getSheetByName: function (n) { return abas[n] || null; },
        insertSheet: function (n) { abas[n] = new Aba(n, []); return abas[n]; }
      };
    },
    flush: function () {},
    CopyPasteType: { PASTE_FORMAT: 'formato' },
    getUi: function () {
      return { createMenu: function () {
        return { addItem: function () { return this; }, addToUi: function () {} };
      } };
    }
  };

  var Utilities = {
    formatDate: function (d, fuso, formato) {
      var p = function (n) { return String(n).padStart(2, '0'); };
      if (formato === 'yyyy-MM-dd') return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
      if (formato === 'dd/MM/yyyy') return p(d.getDate()) + '/' + p(d.getMonth() + 1) + '/' + d.getFullYear();
      if (formato === 'dd/MM/yyyy HH:mm') {
        return p(d.getDate()) + '/' + p(d.getMonth() + 1) + '/' + d.getFullYear() +
          ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
      }
      if (formato === "yyyy-MM-dd'T'HH:mm:ss'Z'") {
        return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) +
          'T' + p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds()) + 'Z';
      }
      if (formato === 'yyyy-MM-dd_HH-mm') {
        return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) +
          '_' + p(d.getHours()) + '-' + p(d.getMinutes());
      }
      return d.toISOString();
    }
  };

  var Session = {
    getActiveUser: function () { return { getEmail: function () { return 'previa@azuos'; } }; }
  };

  var HtmlService = {
    createHtmlOutputFromFile: function () {
      return {
        setWidth: function () { return this; }, setHeight: function () { return this; },
        setTitle: function () { return this; }, addMetaTag: function () { return this; }
      };
    }
  };

  Utilities.base64Encode = function (bytes) {
    if (typeof Buffer !== 'undefined') {
      return Buffer.from(bytes && bytes.length !== undefined && typeof bytes !== 'string'
        ? Uint8Array.from(bytes) : String(bytes), typeof bytes === 'string' ? 'utf8' : undefined)
        .toString('base64');
    }
    return btoa(String(bytes));
  };

  function paraBytes(texto) {
    if (typeof TextEncoder !== 'undefined') return Array.from(new TextEncoder().encode(texto));
    return Array.from(Buffer.from(texto, 'utf8'));
  }

  Utilities.newBlob = function (conteudo, tipo, nome) {
    var bytes = paraBytes(String(conteudo));
    return {
      getBytes: function () { return bytes; },
      getName: function () { return nome; },
      setName: function (n) { nome = n; return this; },
      getContentType: function () { return tipo; }
    };
  };

  /* CRC32 — o zip exige, e sem ele o Excel recusa o arquivo */
  var TABELA_CRC = (function () {
    var tabela = [];
    for (var i = 0; i < 256; i++) {
      var c = i;
      for (var j = 0; j < 8; j++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      tabela[i] = c >>> 0;
    }
    return tabela;
  })();

  function crc32(bytes) {
    var c = 0xFFFFFFFF;
    for (var i = 0; i < bytes.length; i++) {
      c = TABELA_CRC[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
    }
    return (c ^ 0xFFFFFFFF) >>> 0;
  }

  /**
   * Zip sem compressão (método "store"): é o suficiente para o .xlsx e
   * mantém o simulador sem dependências.
   */
  Utilities.zip = function (blobs, nomeDoZip) {
    var saida = [];
    var diretorio = [];
    var posicao = 0;

    function escrever(lista, valor, tamanho) {
      for (var i = 0; i < tamanho; i++) lista.push((valor >>> (i * 8)) & 0xFF);
    }

    blobs.forEach(function (blob) {
      var nome = paraBytes(blob.getName());
      var dados = blob.getBytes();
      var crc = crc32(dados);
      var inicio = posicao;

      escrever(saida, 0x04034b50, 4);      // assinatura do cabeçalho local
      escrever(saida, 20, 2);              // versão necessária
      escrever(saida, 0, 2);               // sem flags
      escrever(saida, 0, 2);               // método: store
      escrever(saida, 0, 2);               // hora
      escrever(saida, 0, 2);               // data
      escrever(saida, crc, 4);
      escrever(saida, dados.length, 4);
      escrever(saida, dados.length, 4);
      escrever(saida, nome.length, 2);
      escrever(saida, 0, 2);               // sem extras
      nome.forEach(function (b) { saida.push(b); });
      dados.forEach(function (b) { saida.push(b); });
      posicao = saida.length;

      escrever(diretorio, 0x02014b50, 4);  // entrada no diretório central
      escrever(diretorio, 20, 2);
      escrever(diretorio, 20, 2);
      escrever(diretorio, 0, 2);
      escrever(diretorio, 0, 2);
      escrever(diretorio, 0, 2);
      escrever(diretorio, 0, 2);
      escrever(diretorio, crc, 4);
      escrever(diretorio, dados.length, 4);
      escrever(diretorio, dados.length, 4);
      escrever(diretorio, nome.length, 2);
      escrever(diretorio, 0, 2);
      escrever(diretorio, 0, 2);
      escrever(diretorio, 0, 2);
      escrever(diretorio, 0, 2);
      escrever(diretorio, 0, 4);
      escrever(diretorio, inicio, 4);
      nome.forEach(function (b) { diretorio.push(b); });
    });

    var inicioDiretorio = saida.length;
    diretorio.forEach(function (b) { saida.push(b); });

    escrever(saida, 0x06054b50, 4);        // fim do diretório central
    escrever(saida, 0, 2);
    escrever(saida, 0, 2);
    escrever(saida, blobs.length, 2);
    escrever(saida, blobs.length, 2);
    escrever(saida, diretorio.length, 4);
    escrever(saida, inicioDiretorio, 4);
    escrever(saida, 0, 2);

    var nome = nomeDoZip || 'arquivo.zip';
    return {
      getBytes: function () { return saida; },
      getName: function () { return nome; },
      setName: function (n) { nome = n; return this; },
      getContentType: function () { return 'application/zip'; }
    };
  };

  return { SpreadsheetApp: SpreadsheetApp, Utilities: Utilities, Session: Session,
           HtmlService: HtmlService, abas: abas };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { lerCSV: lerCSV, tipar: tipar, carregarGrade: carregarGrade,
                     TOTAL_COLUNAS: TOTAL_COLUNAS,
                     exibirValor: exibirValor, criarPlanilhaSimulada: criarPlanilhaSimulada };
}
