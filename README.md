# Controle de Planejamento Tributário — Azuos / Analyze

Interface para a planilha **Controle Planejamento Tribuario**, rodando dentro do
Google Drive como aplicativo do Google Apps Script.

A planilha continua sendo o banco de dados. O app lê e grava nas **mesmas células**,
então quem preferir continuar mexendo na planilha pode — nada é duplicado e nada é
migrado para fora do Drive.

## Como o sistema se organiza

Barra lateral com duas telas e dois diálogos:

| | |
|---|---|
| **Visão geral** | Os indicadores do topo, uma fileira de **cartões por serviço** (quantas empresas cada um tem e quantas em andamento) e os gráficos — incluindo um **quadro de andamento para cada serviço**. Clicar em qualquer barra leva para *Empresas* já filtrado por aquilo. |
| **Empresas** | A lista completa, com busca, filtros, classificação por qualquer coluna e o checklist de cada empresa — com a legenda das siglas logo acima da tabela. |
| **Etapas do checklist** | Incluir, renomear e excluir etapa. |
| **Histórico** | O que mudou, quem mudou, e as empresas excluídas. |

### Os quatro gráficos

| Gráfico | O que responde | Forma |
|---|---|---|
| **Empresas por serviço** | quantas empresas há em cada serviço, e quantas ainda estão sem | barras horizontais, uma cor; "sem serviço" em cinza |
| **Onde as empresas estão paradas** | em que etapa cada uma emperrou | barras horizontais, uma cor — o comprimento carrega a magnitude |
| **Andamento — um por serviço** | dentro de cada serviço: de quantas empresas cada etapa é exigida e quantas já a concluíram (`16/34`) | um cartão por serviço, com medidores por linha — o trilho é o total daquela etapa |
| **Situação do prazo** | atrasado / vence em 7 dias / em dia / sem previsão | barras com a paleta de status, cada uma com o nome por extenso |
| **Há quanto tempo sem andar** | faixas de 30 em 30 dias até "nunca movimentada" | rampa ordinal de um só azul, do claro ao escuro |
| **Carga por responsável** | quantas empresas esperam cada pessoa | barras horizontais, com "sem responsável" em cinza |

Todos têm valor visível na ponta, dica ao passar o mouse, versão **em tabela** (o
`ver como tabela` abaixo de cada um) e são clicáveis para filtrar a lista.

Repare que *Onde as empresas estão paradas* e *Andamento* respondem coisas diferentes: o
primeiro conta cada empresa **uma vez**, na etapa em que ela emperrou; o segundo olha etapa
por etapa e pergunta quantas das que precisam dela já a cumpriram — e vem separado por
serviço, porque cada serviço tem o seu fluxo e misturá-los dilui a conta dos dois.

Dois casos que o painel diz em voz alta em vez de esconder: empresa cujo serviço **ainda não
tem etapa nenhuma** aparece no funil como *sem etapa a cumprir* (em vez de sumir da conta), e
o quadro desse serviço avisa que falta definir as etapas.

As cores não foram escolhidas no olho: a rampa de tempo parado passou no validador de
paletas (monotonia de luminosidade, contraste da ponta clara, hue único) e os estados de
prazo usam a paleta de status reservada, sempre acompanhados do rótulo por extenso — a cor
nunca é a única portadora da informação. O sistema é só em modo claro, de propósito: ele
roda dentro do Google Sheets, que não tem modo escuro.

## O que o app faz além da planilha

| | |
|---|---|
| **Checklist na tela principal** | As 12 etapas de cada empresa aparecem na lista, um marco por etapa, com a sigla da etapa no cabeçalho da coluna e a legenda por extenso acima da tabela. Dá para marcar e desmarcar direto dali, sem abrir a ficha. O marco 1 são os 10 documentos: ele abre a ficha na lista deles. |
| **Em que etapa está** | Mostra a posição (`4/12`), o nome da etapa, quem está com ela e **há quanto tempo a empresa não anda** — calculado da data mais recente registrada em qualquer etapa. Acima de 30 dias fica âmbar, acima de 60 fica vermelho. |
| **Funil de etapas** | Faixa no topo com quantas empresas estão paradas em cada etapa, mais o total de entregues. Cada item filtra a lista. |
| **Classificar como quiser** | Clique em qualquer cabeçalho da tabela para ordenar por ele; clique de novo para inverter. O seletor continua valendo, com opções que não têm coluna própria (tempo parado). O número da empresa virou campo editável, e o botão *Renumerar* reescreve a coluna `N.` de 1 em diante. |
| **Paradas há +30 dias** | Cartão no topo que filtra as empresas esquecidas, e ordenação por tempo parado. Hoje são **29 das 34 em andamento**. |
| **Semáforo de prazo** | Cada empresa mostra atrasado / vence em 7 dias / em dia / entregue, calculado da previsão de entrega contra a data de hoje. |
| **Progresso correto** | 12 etapas, sendo a documentação contada pelos 10 documentos. A fórmula atual da planilha erra — veja *Achados* abaixo. |
| **Fila por responsável** | Filtra quem tem o quê na mão, olhando a etapa pendente, não a empresa inteira. |
| **Data automática** | Ao marcar uma etapa como concluída sem data preenchida, o app carimba o dia. Hoje isso se perde. |
| **Histórico** | Aba `Log` criada automaticamente: quem mudou o quê, quando, de que valor para qual. |
| **Exportar Excel** | Botão no topo: baixa a lista em `.xlsx` de verdade, com uma coluna por etapa (concluída / pendente / não se aplica / outro serviço) e uma por campo de serviço. Na tela *Empresas* leva o que está filtrado; na *Visão geral*, a carteira inteira. O arquivo é montado pelo próprio app — não cria nada no Drive nem chama serviço externo. |
| **Importar / atualizar lista** | Cola a lista como ela chega e o app cadastra no serviço escolhido. Mostra o que entendeu **antes** de gravar. Quem já está na planilha — reconhecido pelo **CNPJ ou pelo nome** — não vira linha nova: os campos em branco são completados com o que veio na lista, e o que já estava preenchido fica como está. Lê município, nome fantasia, protocolo, telefones, e-mails, proprietários, regime, capital social, receita bruta, data da análise e responsável. |
| **Fluxo próprio do Goiás Fomento** | Seis etapas criadas sozinhas na primeira abertura: *Validação inicial · Cadastro com restrição · Análise de documentos · Cancelado · Análise de crédito · Aprovado*. Ao mesmo tempo, as 12 etapas originais passam a pertencer ao **Planejamento Tributário**, para que as empresas do fomento não herdem um checklist que não é o delas. |
| **Um checklist, dividido por serviço** | A lista de etapas é uma só. Em *Etapas do checklist* há uma **matriz etapa × serviço**: marque as caixas e a mesma etapa serve a quantos serviços precisar. Cada etapa pode valer para **todos** os serviços (o normal) ou só para alguns. A empresa conta apenas as etapas do serviço que contratou; as demais aparecem marcadas como *de outro serviço*, fora da conta. Escolhendo um serviço no filtro, a tabela passa a mostrar só o checklist daquele serviço — cabeçalho, legenda e trilhas juntos. |
| **Etapa que não se aplica** | O checklist é o mesmo para todas, mas nem toda etapa cabe em todo caso. O botão `n/a` na ficha tira a etapa **daquela empresa** da conta do percentual: ela fica riscada, sai do destaque de "etapa da vez" e o percentual passa a ser calculado só sobre as que se aplicam. |
| **Campos próprios de cada serviço** | Informações que só um serviço pede. O Goiás Fomento já vem com os do cadastro e do contato ativo — *Município*, *Nome fantasia*, *Protocolo anterior*, *Telefone*, *Celulares*, *E-mails*, *Proprietários*, *Data da ligação de oferta*, *Quem ligou*, *Resultado do contato*, *Linha de crédito*, *Valor pretendido* e *Observações do contato*. Em **Campos por serviço** dá para criar outros (texto, data, número, dinheiro, lista de opções, sim/não), para qualquer serviço ou para todos. |
| **Mesma empresa, serviços diferentes** | Uma empresa pode ser cliente de mais de um serviço ao mesmo tempo. Cada serviço é um trabalho à parte, com seu fluxo e seu andamento — então cada um tem a própria linha. A importação só considera repetido quem já está **naquele serviço**; em outro, entra como linha nova e o app avisa. |
| **Serviço contratado** | Cada empresa recebe o serviço que contratou — Planejamento Tributário, Auditoria, Goiás Fomento ou qualquer outro que você acrescentar. O filtro de serviço vale para a lista **e** para os gráficos, então dá para ver o painel de um serviço só. |
| **CNPJ** | A planilha não tinha esse campo — o app cria a coluna `CNPJ` no fim da aba `Controle` e mostra o número na lista, sob a razão social. Valida o dígito verificador (inclusive o CNPJ alfanumérico novo), aceita mais de um por empresa (são grupos) e a busca acha com ou sem pontuação. Onde o campo está vazio, oferece o CNPJ que encontrar escrito na observação. |
| **Checklist configurável** | O botão *Etapas do checklist* permite incluir etapa, renomear e excluir. Cada etapa nova ganha três colunas na planilha (Responsável, Data, Concluído); a renomeação também troca o cabeçalho da `Controle`. |
| **Excluir empresa** | Botão no fim da ficha, com confirmação por digitação do nome. Antes de apagar, a linha inteira vai para a aba `Excluidas` com data e autor — dá para copiar de volta. |

## Dado de cliente não entra neste repositório

O **ID da planilha também não**: o script fica vinculado a ela (Extensões › Apps Script),
então `SpreadsheetApp.getActiveSpreadsheet()` já sabe qual é. A constante `PLANILHA_ID` no
`Codigo.gs` existe só para o caso de apontar para outra planilha, e deve ficar vazia.


As listas de importação e a prévia gerada contêm CNPJ, telefone, e-mail e nome de
proprietário de clientes reais — sigilo profissional contábil e LGPD. Elas estão no
`.gitignore` e ficam só na máquina de quem trabalha no sistema.

Para que os testes rodem em qualquer clone, existe **`teste/dados/exemplo-importacao.txt`**,
com empresas fictícias e CNPJs válidos inventados, cobrindo os mesmos casos-limite (bloco sem
nome fantasia, sem telefone, sem proprietário, campos de diagnóstico). Os testes usam o
arquivo real quando ele está presente e o fictício quando não está.

O que continua sendo necessário para rodar os testes é o **CSV da planilha** — baixado na
hora, nunca versionado.

## Instalação (10 minutos, uma vez só)

1. Abra a planilha → menu **Extensões › Apps Script**.
2. No editor, apague o conteúdo de `Código.gs` e cole o de [`apps-script/Codigo.gs`](apps-script/Codigo.gs).
3. **+ › HTML**, nomeie exatamente `Index`, apague o conteúdo e cole o de [`apps-script/Index.html`](apps-script/Index.html).
4. ⚙️ **Configurações do projeto** → marque *Mostrar arquivo de manifesto "appsscript.json"*.
   Abra o `appsscript.json` que aparecer e cole o de [`apps-script/appsscript.json`](apps-script/appsscript.json).
5. Salve. Recarregue a planilha: aparece o menu **📋 Planejamento › Abrir painel**.
   Na primeira execução o Google pede autorização — é o seu próprio script acessando a sua planilha.

### Para a equipe usar por link, sem abrir a planilha

No editor: **Implantar › Nova implantação › Aplicativo da Web**
· Executar como **Usuário que acessa o app**
· Quem tem acesso **Qualquer pessoa da Azuos Contábil**.

Cada pessoa entra com a própria conta Google — o histórico registra quem foi, e
ninguém enxerga mais do que já enxerga na planilha.

> Executar como *usuário que acessa* é de propósito: mantém a permissão da planilha
> valendo e evita que o app vire uma porta lateral para quem não deveria ver os dados
> dos clientes.

## Mexer no sistema depois

No Claude Code, use **`/planejamento`** — a skill já carrega o contexto do projeto, o
mapeamento das colunas e as regras que não podem ser quebradas:

```
/planejamento quem está atrasado
/planejamento adiciona uma etapa de conferência antes da apresentação
/planejamento publica as mudanças
```

Definida em `~/.claude/commands/planejamento.md`.

## Estrutura

```
apps-script/
  Codigo.gs        backend: mapeamento das 72 colunas, leitura, gravação, log
  Index.html       a tela inteira (painel + ficha da empresa)
  appsscript.json  manifesto: fuso, escopos, configuração do app web
teste/
  teste.js         1.533 checagens contra os dados reais das 42 empresas
```

## Ver antes de instalar

```bash
# o ID da planilha está na URL dela, entre /d/ e /edit
PLANILHA="cole-aqui-o-id-da-sua-planilha"
curl -sL "https://docs.google.com/spreadsheets/d/$PLANILHA/export?format=csv&gid=0" -o /tmp/controle.csv
node teste/previa.js /tmp/controle.csv && open previa.html
```

Gera um HTML único que roda o `Codigo.gs` de verdade no navegador, sobre uma planilha
simulada com os dados reais. Dá para clicar, marcar etapa, importar clientes e abrir o
histórico — **sem tocar na planilha do Drive**.

O que você fizer na prévia **fica guardado no navegador** e volta ao recarregar a página; o
botão *Recomeçar do zero*, na faixa de baixo, apaga esse estado e recarrega da planilha.
Rodar `node teste/previa.js` de novo **não apaga** o que você já tinha feito — só reconstrói
o arquivo com a versão mais recente do código.

> Isso não substitui publicar: a prévia guarda no seu navegador, não na planilha.

## Rodar os testes

```bash
node teste/teste.js /tmp/controle.csv            # leitura: 1.821 checagens
node teste/teste-escrita.js /tmp/controle.csv    # gravação: 359 checagens
node teste/teste-interface.js /tmp/controle.csv  # tela: 212 checagens (precisa do Chrome)
```

Os dois primeiros carregam o `Codigo.gs` de verdade num sandbox com a API do Google simulada.

O de **leitura** confere, empresa por empresa: o mapeamento das 72 colunas contra os
cabeçalhos da planilha, a leitura de datas nos dois formatos que convivem lá (`Date` e
texto `dd/mm/aaaa`), a contagem de documentos, a etapa atual e os cortes de prazo.

O de **gravação** exercita o fluxo real sobre uma cópia em memória e confere o que ficou
em cada célula: a data que é carimbada ao concluir (e a que **não** é sobrescrita quando
já existe), os 10 documentos em bloco, a célula de fórmula que nunca pode ser escrita,
os campos recusados, o fato de nenhuma outra empresa ser tocada, e a trilha de auditoria.
Na exclusão, confere que a empresa errada não pode ser apagada, que a linha de baixo sobe com
os dados certos, que a excluída fica arquivada com as 72 colunas e que o log nomeia quem foi
excluída — e não quem subiu de linha.

O de **tela** abre a prévia no Chrome headless e clica de verdade. Nos gráficos: confere que
os quatro desenham, que cada um soma exatamente as empresas em andamento, que toda barra tem
rótulo e número, que existe a versão em tabela, que a dica aparece no hover e some depois, e
que clicar numa barra leva para a lista já filtrada. Na lista: confere que
as siglas do cabeçalho ficam alinhadas com os marcos ao pixel, que a posição `N/12` de cada
linha bate com o dado, e que o filtro e a ordenação por tempo parado funcionam. No checklist: confere que
os marcos verdes de cada uma das 42 linhas batem com as etapas concluídas no dado, marca uma
etapa pela lista (sem abrir a ficha), desmarca, e confirma que o marco dos documentos abre a
ficha em vez de marcar os 10 de uma vez. Na exclusão: pede a exclusão, digita nome errado (o
botão continua travado), digita o certo, confirma, e confere que a empresa sumiu da lista e
apareceu no histórico.

## Abas que o app cria sozinho

| Aba | Para quê |
|---|---|
| `Log` | Toda alteração feita pelo painel: quando, quem, empresa, campo, valor anterior e novo. |
| `Excluidas` | A linha completa de cada empresa excluída, com data e autor. É daqui que se recupera uma exclusão: copie a linha de volta para a aba `Controle`. |
| `Servicos` | A lista de serviços que aparece no filtro e na ficha. Começa com Planejamento Tributário, Auditoria, Goiás Fomento e Diagnóstico Prospecção; cresce pelo `+ novo serviço` da ficha ou digitando direto nesta aba. |
| `Campos` | Os campos próprios de cada serviço: nome, tipo, a que serviço pertence e em que coluna da `Controle` o valor fica. |
| `Etapas` | O checklist em si: nome, sigla, a que serviços pertence (vazio = todos) e em que colunas da `Controle` cada etapa vive. É esta aba que manda — o código só a cria na primeira vez, com as 12 etapas originais. |
| `Etapas excluidas` | Quando uma etapa sai do checklist, o que cada empresa tinha nela (responsável, data, concluído, observações) fica guardado aqui, uma linha por empresa. |

Nenhuma delas interfere nos dados da `Controle`. Se você apagar qualquer uma, ela é recriada vazia
no próximo uso.

## Como o checklist se divide sem se quebrar

A lista de etapas continua **uma só**, e as colunas da planilha são as mesmas para todas as
empresas — é isso que mantém a tabela alinhada e a planilha legível. O que muda é a quem
cada etapa pertence:

- **Etapa sem serviço** (o padrão, a coluna *Todos* da matriz) vale para todo mundo.
- **Etapa de um ou mais serviços** só conta para as empresas daqueles serviços. Marcar duas
  colunas põe a mesma etapa nos dois serviços — é o caso comum de etapas como *Solicitar
  documentação*, que servem a mais de uma frente. Nas outras
  ela aparece hachurada, com a dica *não faz parte do serviço X*, e some do percentual.
- **Com um serviço escolhido no filtro**, a tabela mostra só o checklist daquele serviço.

Clicar no **nome do serviço** no cabeçalho da matriz marca (ou limpa) aquela coluna inteira,
para configurar um serviço novo de uma vez em vez de etapa por etapa.

O checklist é o mesmo; o que muda por serviço é **quais etapas contam** e **quais campos a
ficha pede**. Uma empresa de Goiás Fomento vê o bloco *Informações de Goiás Fomento* logo
acima das etapas; uma de Planejamento não vê esse bloco.

Há dois jeitos de uma etapa sair da conta, e eles não se confundem: **por serviço** (regra
geral, definida em *Etapas do checklist*) e **`n/a`** (decisão caso a caso, na ficha de uma
empresa).

## Sobre "Cancelado" e "Aprovado"

As duas entraram como etapas, na ordem que você passou. Vale saber que elas se comportam
diferente das outras: são **desfechos**, não passos — uma empresa cancelada não segue para a
análise de crédito, e marcar *Cancelado* não deixa o processo mais perto do fim, embora conte
no percentual como se deixasse.

Se isso incomodar no uso, há duas saídas sem reescrever nada: marcar o desfecho que não
aconteceu como `n/a` naquela empresa, ou transformar os dois num campo *Situação* (lista) em
**Campos por serviço** e excluí-los do checklist. É uma decisão de como vocês trabalham — o
sistema aceita as duas.

## Duas decisões que valem explicação

**As colunas de CNPJ, Serviço e "Etapas que não se aplicam" foram para o fim da planilha**, e
não ao lado da razão social. Inserir uma
coluna no meio empurraria as 72 colunas existentes e quebraria todo o mapeamento — inclusive
das fórmulas da própria planilha. No fim, nada se desloca.

**O "não se aplica" mora numa coluna só.** Em vez de uma coluna por etapa, cada empresa tem
uma célula com a lista das etapas que não valem para ela (`beneficio, cenarios`). Assim
nenhuma coluna de etapa muda de significado, a célula de "Concluído" continua sendo um
checkbox limpo e as fórmulas que a planilha já tinha seguem funcionando. Concluir uma etapa
marcada como `n/a` devolve ela para a conta — os dois estados não convivem.

**Excluir uma etapa não apaga as colunas dela.** Pelo mesmo motivo: apagar colunas do meio
desloca tudo o que vem depois. A etapa sai do checklist, o conteúdo vai para
`Etapas excluidas`, e o cabeçalho da coluna fica marcado como *(etapa removida do checklist)*.
Se quiser a coluna de fato apagada da planilha, dá para fazer depois, à mão, sem pressa e com
o dado já salvo. A etapa **Solicitar documentação** não pode ser excluída: ela sustenta a
lista dos 10 documentos e a fórmula de percentual.

## Achados na planilha atual

**1. A coluna `%` (K) está errada.** A fórmula é:

```
= (IF(X4="100%";1;0) + COUNTIF(AL4;TRUE) + ... ) / 10
```

Dois problemas:

- `IF(X4="100%")` compara um **número** (`X` é `COUNTIF(N:W;TRUE)/10`) com o **texto**
  `"100%"` — nunca é verdadeiro. A etapa de documentação **nunca conta**, mesmo com os
  10 documentos entregues.
- Divide por 10, mas as etapas *Baixar extrato* (AD) e *Baixar/Solicitar XML* (AH) estão
  fora da conta. São 12 etapas, 10 no divisor, 9 realmente somadas.

Efeito prático: a RVC, com 11 das 12 etapas prontas, aparece como **80%** — o app mostra
os **92%** reais. O app não altera a coluna K; se quiser, eu corrijo a fórmula.

**2. Numeração duplicada.** Existem duas empresas com o número 10 (LEDCOLLOR e ABC CENTRO
AUTOMOTIVO), e o 39 não existe. O app usa a linha da planilha como identificador, então isso
não quebra nada — mas confunde na hora de conversar sobre "a empresa 10". O botão **Renumerar**
arruma isso de uma vez.

**3. O que o painel mostra hoje:** 11 empresas atrasadas, a mais antiga há 330 dias
(SUPER VAIDOSA); 21 empresas em andamento sem responsável na etapa atual; 23 sem previsão
de entrega preenchida. Cinco empresas travadas exatamente na mesma etapa — *Baixar extrato* —
sem ninguém designado. E **29 das 34 em andamento estão paradas há mais de 30 dias**, sete
delas sem nenhuma data registrada em etapa alguma. O funil deixa o gargalo evidente: das 34
em andamento, **18 estão na primeira etapa e 16 na segunda — nenhuma passou da segunda**.
