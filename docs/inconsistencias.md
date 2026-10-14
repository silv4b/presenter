# Inconsistências do projeto

Auditoria de consistência feita por código, comparando o frontend (`src/`), o
backend (`src-tauri/`), os workflows (`.github/workflows/`), os scripts e a
documentação (`docs/`).

**Escopo analisado:** 48 arquivos em `src/`, todo o `src-tauri/src`, 4 workflows,
7 documentos, `package.json`, `Cargo.toml`, `tauri.conf.json` e
`capabilities/default.json`.

**Método:** cinco análises paralelas (contrato TS↔Rust, estado e persistência,
documentação × código, infraestrutura e CI, consistência interna do frontend),
seguidas de verificação manual de cada achado crítico.

## Status

Cada achado abaixo está marcado com o resultado da correção:

| Marca | Significado |
| ----- | ------------ |
| ✅ | **Corrigido** nesta branch |
| ⏳ | **Pendente** — exige decisão ou mudança de comportamento |
| ❌ | **Falso positivo** — retirado da auditoria |

| Severidade | Quantidade | ✅ | ⏳ | ❌ |
| --------- | ---------- | -- | -- | -- |
| 🔴 Críticos (quebram a funcionalidade ou perdem dado) | 12 | 12 | 0 | 0 |
| 🟡 Médios | 78 | 78 | 0 | 0 |
| 🔵 Baixos (dívida) | 4 | 4 | 0 | 0 |

### Pendências que sobraram

Nenhuma. Todos os achados estão encerrados — corrigidos, falsos positivos ou
decididos pelo maintainer.

Decidido pelo maintainer:

- ✅ **`scripts/release.js` não será versionado** (crítico 12) — decisão
  explícita: fica gitignored (`scripts/*` com `!scripts/portable.js`), é uso
  pessoal do maintainer. O `package.json:26` (`npm run release`) continua
  dependendo da cópia local.
- ✅ **`Cargo.lock`/`package-lock.json` fora do `git add` do release** — a
  cópia local do script agora sincroniza os dois locks antes do commit
  (`npm install --package-lock-only` + `cargo update -p presenter`, a convenção
  do AGENTS.md) e os inclui no `git add`. Como o script não é versionado, o
  repositório não carrega esse bug.
- ✅ **Release de Linux e macOS sem teste** — mantida a publicação direta
  (`releaseDraft: false`); acrescentado um checklist pré-release no item E1 do
  `analise-melhorias.md`, a rodar antes de criar a tag `v*`.

Resolvidos nesta rodada sem decisão do maintainer: cache do `config.json` (#3),
autoescuta de eventos no presenter (#12), persistência das cores (#5), prefixo
`presenter-file-history` (#4), a lista de alvos do bundle (sem MSI/rpm), a
classificação de build do `shadcn`/Tailwind e a remoção dos 10 logos
`Square*Logo.png`/`StoreLogo.png`, que só o MSI consumia.

Índice:

- [🔴 Críticos](#-críticos)
- [🟡 Médios](#-médios)
- [🔵 Baixos](#-baixos)
- [✅ Coerências confirmadas](#-coerências-confirmadas)
- [Correções por área](#correções-por-área)

---

## 🔴 Críticos

### 1. ✅ `Ctrl+Shift+Z` não refaz — ele escondia a sidebar

`src/hooks/useKeyboardShortcuts.ts:52` exige `!e.shiftKey`, então
`Ctrl+Shift+Z` passava direto para o `case "z"/"Z"` em `:107` e chamava
`toggleSidebar()`. O atalho está documentado como "Refazer anotação" em
`README.md:31`, `README.md:59` e `docs/analise-melhorias.md:24,85`.

O atalho real de refazer é `Ctrl+Y` (`:55`) — e o tooltip do app já dizia certo.

**Corrigido:** guarda de `shiftKey` em `useKeyboardShortcuts.ts:107-113`, mais
o tooltip de `App.tsx` que anunciava `(B)` para a sidebar, que na verdade é `Z`
(`B` é a tela preta).

### 2. ✅ `ColorPicker` vazava um listener de `scroll` por abertura

```
src/components/ColorPicker.tsx:119   window.addEventListener("scroll", handleScroll, true);
src/components/ColorPicker.tsx:122   window.removeEventListener("scroll", handleScroll);
```

A remoção exigia o flag `capture` idêntico ao do registro. Com `true` no
`addEventListener` e ausente no `removeEventListener`, a remoção era um no-op.
Cada abrir/fechar do picker empilhava um listener que chamava `setPickerStyle`
em componente já desmontado.

**Corrigido:** o `removeEventListener` recebe o mesmo `true`.

### 3. ✅ O Rust nunca esquecia o documento — a projeção mostrava o PDF anterior

Não existia `clear_document` no `generate_handler!`. `closeDocument` zerava o
estado **local** e não avisava o Rust, que continuava com o `DocInfo` anterior.

**Reprodução:** abrir PDF → `Esc` → voltar ao início → `F5` com um monitor
secundário marcado. A janela de projeção abria o PDF **antigo**.

**Corrigido:** novo comando `clear_document` em Rust, registrado no handler, e
`closeDocument` passa a chamá-lo.

### 4. ✅ Tela preta/branca nunca chegava na primeira apresentação

`presentation.tsx` emitia `mudar-slide`, `tela-preta` e `tela-branca` logo após
`await openProjections()`. O Rust criava a janela e dava `show()` — o JavaScript
ainda não tinha montado e o `listen` do `Viewscreen` não existia. Os três
payloads eram descartados.

**Corrigido:** evento `EVENT_VIEWSCREEN_READY` (`"projecao-pronta"`) em
`src/lib/shared.ts`; a projeção o emite depois de registrar seus listeners e o
`Viewscreen` reemite slide, tela preta e tela branca ao recebê-lo.

### 5. ✅ O tema não chegava na projeção

`src/viewscreen/Viewscreen.tsx` não tinha nenhuma ocorrência de `theme` nem de
`dark`. A classe `.dark` só era aplicada na janela principal. Abrir uma
apresentação com o tema escuro mostrava a projeção em tema claro.

**Corrigido:** o `Viewscreen` lê `THEME_KEY`, valida o hex com `readHexColor` e
repassa `bgColor` ao `PdfStage`.

### 6. ✅ `scaleFactor` chegava sempre `undefined`

`MonitorInfo` derivava apenas `Serialize`, sem
`#[serde(rename_all = "camelCase")]`, e o campo se chamava `scale_factor`,
enquanto o TypeScript declara `scaleFactor` como obrigatório.

**Corrigido:** `#[serde(rename_all = "camelCase")]` em `MonitorInfo`. Como
`scaleFactor` (e `x`/`y`) não eram consumidos por nenhum indicador de UI,
foram removidos dos dois lados em vez de corrigidos.

### 7. ✅ `NaN` nos tamanhos das ferramentas corrompia a sessão

`presenter.tsx` fazia `Number(v)` sem checar `Number.isFinite` e **re-gravava** o
resultado. `Number("abc")` produz `NaN`, que era persistido de volta. O `NaN`
chegava em `ctx.arc(NaN, ...)`, que lança `IndexSizeError` dentro de um
`useEffect` sem error boundary.

`App.tsx` e `useSettings.ts` já validavam corretamente — **a convenção existia e
não foi aplicada naquele arquivo**.

**Corrigido:** validação `Number.isFinite` na leitura e na escrita.

### 8. ✅ `getHistory()` não validava a forma do JSON

```
src/lib/fileHistory.ts:14   return JSON.parse(raw) as HistoryEntry[];
src/lib/fileHistory.ts:22   const history = getHistory().filter(...)
```

O cast era cego. Com um JSON válido que não fosse array, `.filter` não existia e
o `TypeError` acontecia **fora** do `try`. O `TypeError` subia até um `catch`
que ficava **antes** do `setDocument`, e a projeção ficava eternamente em
"Aguardando documento…".

**Corrigido:** validação da forma de cada entrada e tolerância a JSON inválido.

### 9. ✅ O cronômetro aplicava os dígitos do render anterior

`Timer.tsx` chamava `applyDigitsImmediate()` logo depois de `setDigits(...)`. A
função lia o `digits` do closure do render atual, ou seja, o valor antigo. O
display mostrava o dígito novo, mas o tempo persistido só assumia o valor no
próximo input.

**Corrigido:** `digitsRef` como espelho sempre atualizado, e
`src/lib/time.ts` com `formatTime`, `toTimerDigits` e `parseTimerDigits`
compartilhados com o `FloatingTimer`.

### 10. ✅ Listeners de mouse vazavam em três componentes

`PdfStage.tsx` (pan), `App.tsx` (resize do preview) e `SlideCarousel.tsx`
(resize do carrossel) nasciam `mousemove`/`mouseup` no `mousedown` e só os
removiam dentro do `onMouseUp`. Se o `mouseup` nunca chegasse — perda de foco,
Alt+Tab — ou o componente desmontasse no meio do arraste, os listeners vazavam.

**Corrigido:** cleanup registrado em ref e disparado no `onUp` **e** na
desmontagem, nos três arquivos.

### 11. ✅ `pdfCanvasRef` apontava para dois canvases diferentes

A mesma ref era anexada ao canvas do react-pdf e ao canvas de anotações. O
`.current` nunca era lido: era encanamento morto com ambiguidade sobre qual
elemento estava sendo referenciado.

**Corrigido:** a ref duplicada foi removida; sobrou só `annotationCanvasRef`.

### 12. ✅ `scripts/release.js` está fora do git

O `.gitignore` (`scripts/*` com exceção de `!scripts/portable.js`) deixa o
`release.js` de fora. O `package.json:26` referencia esse arquivo em
`npm run release`, então o script quebra com `MODULE_NOT_FOUND` em qualquer
clone novo.

**Resolvido por decisão explícita do maintainer: o arquivo não será
versionado** — é uso pessoal, e a quebra em clones novos é aceita. O achado
irmão, de que o `git add` do script omitia `Cargo.lock`, também está resolvido:
a cópia local sincroniza e versiona `Cargo.lock` e `package-lock.json`.

---

## 🟡 Médios

### Projeção multi-monitor

- ✅ **Cor de fundo aplicada pela metade.** O div externo usava `bgColor`, mas o
  `PdfStage` caía no default `#000000`. Escolher fundo branco deixava a moldura
  preta na projeção. O `bgColor` validado agora chega ao `PdfStage`.
- ✅ **Validação assimétrica do hex.** O presenter validava com
  `/^#[0-9a-f]{6}$/i`; a projeção lia o valor cru, tanto na inicialização quanto
  no handler de `storage`. Agora os dois usam `readHexColor` de
  `src/lib/storage.ts`.
- ✅ `isSingleMonitor` tratava `selectedMonitors === []` como "monoclock", o que
  fazia `startPresentation` cair em fullscreen local em vez de abrir a projeção
  numa máquina com dois monitores. Lista vazia agora significa "nenhum
  selecionado".
- ✅ O presenter escutava eventos que ele mesmo emite (`anotacao-limpar` e
  `anotacao-limpar-pagina`). O `emit` do Tauri é broadcast e inclui o emissor.
  Os dois `listen` foram removidos: `clearAnnotations`/`clearPage` já limpam o
  estado local antes de emitir, então a escuta era eco puro. Como o `clear` do
  `closeDocument` vem de fora do provider de anotações, ele deixou de passar pelo
  barramento e passou a ser um efeito em `docPath` — quando não há documento, o
  presenter zera traços e laser. O broadcast para a projeção continua saindo de
  `closeDocument`, uma única vez, e `viewscreen.ts` segue tratando traços e laser
  no mesmo handler.
- ✅ `setDocument` era fire-and-forget com `.catch(() => {})`. Agora registra o
  erro no console, junto das demais chamadas de IPC do módulo.
- ✅ **Fechar a janela podia ficar impossível.** `main.tsx` fazia `preventDefault()`
  e depois `await emit("app-close-requested")` sem `try/catch`: se o `emit`
  rejeitasse, ou se o `listen` do `App.tsx` falhasse ao se registrar, a
  rejeição saída depois do `preventDefault` e a janela ficava sem forma de
  fechar e sem mensagem. Agora os dois lados fecham na falha: o `emit` de
  `main.tsx` está em `try/catch` e chama `destroy()`, e o `.catch` do `listen` em
  `App.tsx` também chama `destroy()` — este último é necessário porque o `emit`
  é broadcast e resolve com sucesso mesmo sem ninguém ouvindo, o que deixaria a
  janela presa sem a falha aparecer no `main.tsx`. Encerrar sem confirmação é
  melhor do que travar o app. O nome do evento também foi para
  `EVENT_APP_CLOSE_REQUESTED` em `lib/shared.ts`, junto dos demais.

### `config.json` (lado Rust)

- ✅ **Falha de escrita totalmente silenciosa.** `let _ = std::fs::write(...)`
  descartava o resultado e o comando retornava `()`, então `invoke` **nunca**
  rejeitava e o `.catch` do TypeScript era código morto: a seleção de monitor
  parecia salva e sumia ao reiniciar. `set_monitor_config` agora retorna
  `Result<(), String>`, propaga a falha e só atualiza o cache depois de
  escrever.
- ✅ **Escrita não-atômica.** `fs::write` truncava o arquivo antes de escrever, e
  a leitura usava `.ok()?` em 100% dos casos. Um arquivo truncado voltava
  silenciosamente como `[]`, sem log e sem backup — todos os monitores
  apareciam desmarcados. Agora a escrita vai para `config.json.tmp` seguida de
  `rename`.
- ✅ `write_monitor_config` descartava quaisquer outras chaves que existissem no
  `config.json`. Agora preserva as demais.
- ✅ **Cache nunca invalidado.** Editar o arquivo por fora, ou trocar a pasta
  portátil na mesma sessão, era ignorado por causa do `MonitorState` em Rust, que
  guardava só a lista de ids. Agora o estado é `MonitorCache { ids, signature }` e
  `get_monitor_config` relê o arquivo sempre que a assinatura (tamanho + data de
  modificação) muda. `set_monitor_config` só renova assinatura e ids **depois** de
  gravar, para não mascarar uma escrita que falhou.

### Persistência

- ✅ `floatingControlsTimeout` validava apenas `> 0`, sem teto, enquanto o diálogo
  limitava a faixa 1..30 — um valor corrompido como `999999` deixava os
  controles flutuantes visíveis para sempre. `readNumber` faz o clamp correto em
  `src/lib/storage.ts`, e o `useSettings` foi reescrito em cima dele.
- ✅ **Prefixos divergentes.** As chaves de tamanho de ferramenta usavam
  `presenter:` enquanto todo o resto usava `presenter.`; foram migradas para
  `presenter.`, com a chave antiga lida como fallback em `readToolSize` para não
  perder a escolha de quem já usava o app.
- ✅ `presenter-file-history` (traço) segue fora do padrão `presenter.` porque
  trocá-la apagaria o histórico já salvo. A chave nova é `presenter.fileHistory` e
  `getHistory` ainda lê a antiga quando a nova está ausente, migrando o valor na
  hora; `clearHistory` apaga as duas. Trocar a chave não custa o histórico de
  ninguém.
- ✅ Cor de caneta e de marcador **não** persistiam; o tamanho sim
  (`presenter.tsx`). A assimetria fechou: `presenter.penColor` e
  `presenter.highlighterColor` usam o `readHexColor` já existente em
  `storage.ts`, que valida o formato e cai no default quando o valor é inválido.
  `resetColors` volta ao default e persiste como qualquer outra escolha.
- ✅ Defaults duplicados removidos: `#000000` estava em três arquivos e virou
  `DEFAULT_BG_COLOR`; os limites do carrossel 160/300/180 e do preview 320/512
  passaram a ser exportados pelos próprios componentes que os aplicam; `zoom = 1`
  virou `ZOOM_DEFAULT`; o default morto `delay = 3000` do `useAutoHide` foi
  removido (`delay` passou a ser obrigatório).
- ✅ Flash de tema a cada abertura: `index.html` agora tem um script inline no
  `<head>` que lê `presenter.theme` e adiciona a classe `dark` antes da primeira
  pintura.

### Anotações

- ✅ `strokesByPageRef` não era atualizado em `applyEraseNow`. Um erase de um
  toque (start e end no mesmo tick) chamava `pushHistory` com o snapshot
  pré-erase, então **o undo não desfazia nada**.
- ✅ `AnnotationsProvider` montava o valor do contexto **sem `useMemo`**,
  ao contrário do `PresentationProvider`. Todo consumidor re-renderizava a cada
  evento de laser (~60 fps), o que quebrava o `memo` do carrossel.
- ✅ `MAX_HISTORY` era nomeado duas vezes com valores diferentes: 50 (pilha de
  anotações) e 100 (histórico de arquivos). Não é a mesma coisa, mas o mesmo
  nome invites a confusão. Agora são `MAX_UNDO_HISTORY = 50` em
  `annotations/presenter.tsx` e `MAX_FILE_HISTORY = 100` em `lib/fileHistory.ts`,
  cada um com comentário apontando o outro.
- ✅ Undo e redo limpavam o estado mas não o laser: a projeção mantinha o ponto
  congelado.
- ✅ `loadingTask.destroy()` nunca era chamado. O worker e o documento do pdf.js
  ficavam retidos a cada abertura e a cada exportação. Agora `pdf.ts` e
  `exportPdf.ts` liberam em `finally`.
- ✅ `onLaser` emitia a cada `pointermove`, sem coalescer, enquanto os traços eram
  coalescidos por `requestAnimationFrame` — volume de IPC assimétrico. Agora
  passa pelo mesmo `schedule`.

### Infraestrutura, build e CI

- ✅ **`.gitattributes` sem baseline.** Agora define LF como padrão, marca
  binários com `-text` e trata `.bat`/`.cmd` como CRLF.
  *O `git add --renormalize .` não foi executado de propósito: ele faria staging
  de todo o repositório, e nada deve ser commitado nesta rodada.*
- ✅ **Modelo de branch incoerente.** Os três workflows de build disparam só em
  `main` enquanto a branch de trabalho é `develop`. Agora disparam em ambas.
- ✅ `contents: write` removido dos três `build-*.yml` — só o `release.yml`
  publica algo.
- ✅ `bundle.targets: "all"` gerava MSI (Windows) e rpm (Linux) que ninguém
  consumia e era o que justificava os `Square*Logo.png` do WiX. Agora
  `"targets": ["nsis", "deb", "appimage", "dmg", "app"]` — os uploads dos quatro
  workflows já só coletam esses formatos.
- ✅ O release publica binários de **Linux e macOS não testados**, com
  `releaseDraft: false` — vão direto para o público, por decisão do maintainer.
  Foi acrescentado um checklist pré-release no item E1 para rodar antes da tag.
  (O README fala em "ARM64", mas nenhum `--target` é passado: a arquitetura
  depende do default do runner.)
- ✅ **CSS de produção importa dependências de build.** `@tailwindcss/vite`,
  `tailwindcss` e `tw-animate-css` só serviam ao build e estavam em
  `dependencies`. Movidas para `devDependencies`; o `package-lock.json` será
  regerado pelo maintainer.
- ✅ `@import "shadcn/tailwind.css"` em `src/index.css:5` resolve para um
  `devDependency` — o que é o correto: `shadcn` é tooling de build, na mesma
  categoria de `tw-animate-css` (também importado pelo CSS e também em
  `devDependencies`). Não é acoplamento de runtime.
- ✅ Sem `engines`, sem `.nvmrc`, sem `.npmrc`, e o README dizia **"Node.js v18+
  recomendado"**, incompatível com o `vite ^8.3.1`. Agora há
  `engines.node: "^20.19.0 || >=22.12.0"`, `.nvmrc` e o README corrigido.
- ✅ `scripts/release.js` fazia `git add` de `Cargo.toml` mas **não** de
  `Cargo.lock` (era a linha 141), contrariando o AGENTS.md. A cópia local agora
  sincroniza `Cargo.lock` e `package-lock.json` e os inclui no `git add`.
  Mantido local por decisão do maintainer (item 12): o repositório não carrega
  o bug.
- ✅ `tsconfig.node.json` é `composite`, mas o build rodava `tsc`, não `tsc -b` —
  **`vite.config.ts` nunca era type-checked**, e o AGENTS.md reproduzia o mesmo
  comando. Agora `npm run typecheck` cobre os dois projetos e `build` depende
  dele.
- ✅ **Sete permissões mortas** em `capabilities/default.json`. Todas as
  operações de janela são feitas no Rust, que não passa pelo ACL.
- ✅ `VIEWSCREEN_PREFIX` vivia em três lugares sem fonte única. `main.tsx` agora
  importa de `src/lib/shared.ts`, e o Rust é a única outra ocorrência.
- ✅ `release.yml` usava `$zip.FullName` sem guarda de nulo: se a etapa portátil
  não gerasse nada, o job falhava com erro de propriedade nula.
- ✅ Chaves mortas na matriz do release: `args: ""` (sempre vazio) e `label:`, que
  nunca era referenciado.
- ✅ `concurrency:` no release e cache de npm em todos os workflows, apesar de
  todos rodarem `npm ci`.

### Documentação

- ✅ **Atalhos implementados e não documentados:** `W` (tela branca), `F1`/`F2`
  (iniciar/pausar e zerar o cronômetro) e `↑`/`↓` (zoom). O README agora também
  explicita as três condições que restringem atalhos: `B` e `W` só valem com
  `isPresenting`, `O` só sem documento aberto e `Espaço` só avança com
  `zoom <= 1`.
- ✅ O README dizia que o release cria um **draft** — é `releaseDraft: false` — e
  que todos os workflows rodam a cada push na `main` — o `release.yml` só
  dispara por tag.
- ✅ `install.sh` mandava rodar `presenter --help`, mas o app **não trata argv**.
- ✅ `docs/plano-migracao-config.md` listava quatro chaves que não existiam e
  omitia oito que existem.
- ✅ `README.md` listava um diretório `tests/` na árvore que não existe e omitia
  `install.ps1`, `install.sh` e `AGENTS.md`.
- ✅ Tooltip em `App.tsx` dizia "Mostrar sidebar **(B)**". `B` é a tela preta; a
  sidebar é `Z`.
- ✅ A lista da pasta portátil omitia o `LEIA-ME.txt`, que o script gera.
- ✅ Docs diziam "Aplicativos → **Presenter**", mas o `productName` é `presenter`
  (minúsculo), como mostra o `%LOCALAPPDATA%\presenter\uninstall.exe`.
- ✅ Erros editoriais: "carr**rr**osel", "Car**rr**ousel" e um caractere CJK
  residual em `docs/fluxo-atualizacao.md`.

**Marcadores errados em `docs/analise-melhorias.md` (todos corrigidos):**

| Item | Problema encontrado |
| ---- | ------------------- |
| B2 | Marcado ✅, mas não há virtualização alguma: o carrossel monta um `<Page>` por página. |
| A7 | Marcado ✅, mas o `Viewscreen` não tem overlay "3 / 24" — o contador está só na janela principal. |
| B6 | Sem marcador, mas implementado. |
| E3 | Pede `publisher`, `copyright` e `description` no `tauri.conf.json`; o arquivo não tem nenhum dos três. |
| D2 | Cita `state/annotations.ts`, caminho que não existe. |
| D8 | Diz que "alguns componentes" importam `cn` do pacote; só `lib/utils.ts` fazia isso. |
| A2 | Declara drop na welcome **e na área principal**; só existe na welcome. |
| A5 e #18 | Dizem `Ctrl+Shift+Z` para refazer; o código faz `Ctrl+Y`. |

### Convenções quebradas

- ✅ **Clamps escritos à mão** apesar de o helper `clamp` existir, espalhados por
  `annotations.ts`, `App.tsx`, `SlideCarousel.tsx` e `presentation.tsx`.
- ✅ Entrada de hex, regex `/^[0-9a-fA-F]{0,6}$/` e commit em seis dígitos
  **duplicados** entre `ColorPicker` e `SettingsDialog` — os dois arquivos podiam
  passar a validar de formas diferentes. Virou `src/components/HexInput.tsx`.
- ✅ Formatação de tempo `hh:mm:ss.cc` implementada duas vezes com assinaturas
  diferentes, e `type Mode` duplicando o `TimerMode` exportado. Virou
  `src/lib/time.ts` com um `TimerMode` compartilhado.
- ✅ `#ef4444` e `#eab308` hard-coded onde já existem constantes
  (`PEN_COLOR`/`HIGHLIGHTER_COLOR`).
- ✅ Conversão ponteiro→canvas, teste de bounds e "inicializar a partir do último
  ponto do mouse" repetidos **três vezes** em `AnnotationLayer.tsx`. Agora são
  helpers de módulo e um único efeito de `pointermove` com um único estado de
  cursor.
- ✅ Geração do id de monitor em **dois lugares** no Rust. Agora é a função
  `monitor_id(&Monitor)`, fonte única.
- ✅ Os `.catch(() => {})` silenciosos foram eliminados (eram 23, não 16 como
  antes registrado: faltavam 7 em `annotations/presenter.tsx` e 1 em
  `viewscreen/Viewscreen.tsx`). Os 17 que eram `emit` passam por `emitSafe`, em
  `lib/shared.ts`, que registra o evento e o erro no console. Os 6 restantes
  (leitura de monitores, extração de notas, tela cheia, encerramento da
  projeção e limpeza do documento) ganharam log explícito com contexto. Nenhum
  estado local depende desses emits, então falhar não tira a apresentação da frente.
- ✅ `localStorage` **sem try/catch em cerca de quinze pontos**, enquanto
  `fileHistory.ts` protegia a mesma operação — acessar `localStorage` lança em
  navegação privada. Agora passa por `src/lib/storage.ts`.
- ✅ `PdfStage.tsx` lia `panningRef.current` **durante o render**, o que nunca
  re-renderiza: o cursor de arraste nunca mudava para `cursor-grabbing`.
- ✅ `presentation.tsx` tinha `openPdf` como `useCallback` com `[]` que
  referenciava `loadPdfFromPath`, declarado **depois**. Funcionava só porque a
  variável é estável.
- ✅ `AnnotationsProvider` recriava objetos e funções a cada render, passando
  props instáveis para componentes `memo`.
- ✅ Deps de efeito faltando: o `SlideCarousel` usava `resizing` sem declará-lo, e
  o `AnnotationLayer` incluía `penSize` e `highlighterSize`, irrelevantes.
- ❌ **"Oito arquivos importam tipos sem `import type`"** — eram **três** imports
  em um arquivo só, `AnnotationLayer.tsx`. Verificado com
  `tsc --verbatimModuleSyntax`, que hoje passa limpo em `src` e em
  `tsconfig.node.json`. (`lib/` ainda mistura caminho relativo e alias `@/`, o que
  é escolha de estilo, não erro.)

### Acessibilidade

- ✅ Botões só com ícone usando `title` e **sem `aria-label`** em
  `FloatingControls`, `FloatingTimer` e `WelcomeSidebar`.
- ✅ `role="switch"` e `<input type="number">` **sem nome acessível** em
  `SettingsDialog`.
- ✅ `MonitorSelector`: botões que funcionam como checkbox sem `role="checkbox"`
  nem `aria-checked` — o estado era só visual.
- ✅ Swatches de cor e os oito inputs de dígito do cronômetro sem rótulo. O
  `ColorPicker` ganhou `PRESET_LABELS` para que as amostras não dependessem só
  de cor.
- ✅ `"Close"` em inglês no diálogo, herdado do shadcn, numa interface toda em
  português.
- ✅ Os dois handles de redimensionamento tinham `aria-hidden` e nenhuma
  alternativa de teclado. Agora são `role="separator"` com
  `aria-valuenow/min/max`, focáveis e ajustáveis com as setas.

### Constantes mágicas

| Valor | Onde estava | Situação |
| ----- | ----------- | -------- |
| `320`, `512` | `App.tsx:41-42`, `w-80` em `WelcomeSidebar.tsx:44` | ✅ `PREVIEW_MIN_WIDTH`/`PREVIEW_MAX_WIDTH` exportados de `PreviewPanel.tsx` |
| `160`, `300`, `180` | `App.tsx:43-46` e `SlideCarousel.tsx:17-18` | ✅ `CAROUSEL_MIN/MAX/DEFAULT_HEIGHT` exportados de `SlideCarousel.tsx` |
| `+6` | `App.tsx:343` | ✅ nomeado |
| `-32` | `PreviewPanel.tsx:66` | ✅ nomeado |
| `-700` (assumindo largura da sidebar) | `ColorPicker.tsx:99` | ✅ `PICKER_LEFT_OFFSET`, com comentário explicando que é empírico |
| `222`, `zIndex: 50` | `ColorPicker.tsx:5,107` | ✅ `PICKER_WIDTH` (largura padrão do react-colorful) e `PICKER_Z_INDEX` |
| `600` ms | `MonitorSelector.tsx:32` | ✅ `REFRESH_MIN_DURATION_MS` |
| `-66` | `SlideCarousel.tsx:179` | ✅ `CAROUSEL_CHROME_HEIGHT` |
| `* 1000` | `App.tsx:230` | ✅ `MS_PER_SECOND` |
| `new Array(8)`, limites 5 e 6 | `Timer.tsx:52,111,186,239` | ✅ `DIGIT_COUNT`, `LAST_EDITABLE_INDEX`, `DIGITS_PER_FIELD`, `FIELD_COUNT` |
| escala fixa `2` | `exportPdf.ts:20,34` e `SlideCarousel.tsx:30-32`, contra `devicePixelRatio` em `AnnotationLayer.tsx:224` | ✅ **Não era bug:** o export usa escala fixa de propósito para o PDF não variar com o DPI de quem exporta. Commentado. |
| timeout 1..30 | `SettingsDialog.tsx:222-227` contra a checagem `> 0` em `useSettings.ts:40` | ✅ `MIN_CONTROLS_TIMEOUT`/`MAX_CONTROLS_TIMEOUT` compartilhados |

---

## 🔵 Baixos

### Código morto

Removidos: `src/components/ui/select.tsx` (189 linhas, nunca importado) ·
`VIEWSCREEN_LABEL` (`shared.ts`) · `interface Settings` (`useSettings.ts`) ·
`bgRef` (`useSettings.ts`) · `loadingDoc` (estado escrito e nunca lido no
contexto de apresentação) · `MonitorInfo.x`, `.y` e `.scaleFactor` em TS e Rust ·
`buttonVariants` (`button.tsx`) · `NextPreview.className` · `onEditingChange`
(`ColorPicker.tsx`) · `lastPickedRef` em `AnnotationToolbar.tsx` (era só
escrito; o equivalente em `FloatingControls.tsx` é lido) · o default morto
`delay = 3000` do `useAutoHide`.

Mantidos por serem custo de migração, não dívida de código: `docName` e
`notesByPage` expostos no contexto (ambos são consumidos — `docName` em
`FileControls`, `PresentationControls` e `SlideNavigation`; `notesByPage` em
`PreviewPanel`).

✅ **"Logos do Windows Store versionados sem target `msix`/`appx`"** — eram **10**
PNGs (`StoreLogo.png` + 9 `Square*Logo.png`), não 20. A premissa confundia MSIX
com MSI: quem consome esses quadrados é o template WiX do **MSI**, não o
empacotamento da Store. Com o alvo `msi` fora da lista de bundle, os 10 ficaram
sem consumidor e foram **removidos**.

❌ **"`setMonitorConfig` nunca lido em Rust"** — falso positivo. `set_monitor_config`
é um comando Tauri registrado no `generate_handler!`; é o IPC que o TypeScript
chama em `src/lib/monitors.ts` e `presentation.tsx`. Não há "leitura" em Rust
esperada para um comando.

### Nomenclatura

- ✅ Comentários em inglês no projeto que é pt-BR (`Timer.tsx`,
  `AnnotationLayer.tsx`, `FloatingTimer.tsx`, `lib.rs`, `main.rs`,
  `PresentationControls.tsx`).
- ✅ Nome invertido: `canStart` era usado como `disabled`. Virou
  `needsMonitorSelection` + `startDisabled`, com o mesmo comportamento — o botão
  "Encerrar" nunca é desabilitado.
- ✅ `cn` importado de três caminhos diferentes. Os seis arquivos de
  `components/ui/` que importavam do pacote `"cn"` passaram a usar `@/lib/utils`.
  (Nota: `"cn"` é o pacote npm `cn@0.3.0`, reexportado por `src/lib/utils.ts`,
  não o wrapper do shadcn — a mudança é de consistência, sem efeito funcional.)
- ✅ `MonitorSelector.tsx:57` desalinhado, único ponto fora do padrão do arquivo.

---

## ✅ Coerências confirmadas

Verificado e **sem problema**:

- **Versões 100% alinhadas**: `1.3.0` em `package.json`, `package-lock.json`,
  `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml`, `src-tauri/Cargo.lock`, e
  a tag mais recente é `v1.3.0`.
- **Nomes dos artefatos de bundle batem com a documentação**:
  `presenter_1.3.0_x64-setup.exe`, `presenter_1.3.0_amd64.deb`,
  `presenter_1.3.0_amd64.AppImage`.
- **Contrato TS↔Rust íntegro**: nenhum comando Rust órfão, nenhuma invocação sem
  comando correspondente e zero erro de digitação em nome de evento Tauri.
- `Option<Vec<String>>` serializando para `null` é tratado em
  `src/lib/monitors.ts`.
- **Nenhuma permissão faltando** em `capabilities/default.json`.
- **Actions coerentes nos quatro workflows**: `checkout@v5`, `setup-node@v5`,
  `dtolnay/rust-toolchain@stable`, `swatinem/rust-cache@v2`,
  `upload-artifact@v4`, `tauri-apps/tauri-action@v1`.
- `frontendDist: "../dist"` correto; `devUrl: localhost:1420` bate com
  `strictPort: true` do Vite; `withGlobalTauri` ausente e `window.__TAURI__`
  nunca usado, coerente.
- A migração da chave legada `monitor` para array é **correta e
  retrocompatível** em Rust, e o formato do TS bate com `Option<Vec<String>>`.
- As quatro opções do `SettingsDialog` são persistidas e aplicadas.
- O histórico de anotações respeita o limite de 50: `push` com `structuredClone`
  e `shift` mantêm o tamanho e realinham `historyIndexRef`.
- Cancelamento de `requestAnimationFrame`, `ResizeObserver` e `key` de listas
  estão corretos em todos os arquivos verificados.
- `Cargo.toml` sem dependência órfã; `package.json` sem dependência não
  importada.
- O asset do worker do pdf.js usa caminho relativo, que é o formato correto
  para produção.

---

## Correções por área

| Área | O que mudou |
| ---- | ----------- |
| **Rust** (`src-tauri/src/lib.rs`) | `clear_document` novo · `MonitorInfo` com `camelCase` e sem campos mortos · `monitor_id` como fonte única · `write_monitor_config` preserva outras chaves, propaga erro e grava em `config.json.tmp` + `rename` · `set_monitor_config` só atualiza o cache depois de escrever · `MonitorState` guarda `MonitorCache { ids, signature }` e relê o `config.json` quando tamanho/data de modificação mudam · comentários em pt-BR |
| **Capacidades** (`capabilities/default.json`) | Sete permissões mortas removidas |
| **Persistência** | `src/lib/storage.ts` novo (`readRaw`, `writeStorage`, `removeStorage`, `readBoolean`, `readNumber`, `readHexColor`, `readEnum`) · chaves e defaults centralizados em `src/hooks/useSettings.ts` · timeout com teto 1..30 · prefixo `presenter:` migrado para `presenter.` com fallback da chave antiga · cor de caneta e marcador persistem em `presenter.penColor`/`presenter.highlighterColor` · histórico de arquivos em `presenter.fileHistory`, migrando `presenter-file-history` |
| **Tempo** | `src/lib/time.ts` novo, compartilhado entre `Timer` e `FloatingTimer` |
| **Cor** | `src/components/HexInput.tsx` novo, removendo a duplicação entre `ColorPicker` e `SettingsDialog` |
| **Projeção** | Sinal de prontidão `EVENT_VIEWSCREEN_READY` · tema e `bgColor` validados chegam ao `PdfStage` · tela preta/branca/slide reemitidos na primeira apresentação |
| **Anotações** | Conversão ponteiro→canvas deduplicada · laser coalescido por `requestAnimationFrame` · undo/redo limpam o laser · `context` memoizado · NaN barrado · `loadingTask.destroy()` em `finally` · presenter não escuta mais os próprios eventos de limpeza; fechar o documento zera traços e laser por efeito em `docPath` |
| **Ciclo de vida da janela** | `EVENT_APP_CLOSE_REQUESTED` em `lib/shared.ts` · `main.tsx` fecha com `destroy()` se o `emit` falhar · `App.tsx` faz o mesmo se o `listen` falhar |
| **Componentes** | Constantes do carrossel e do preview com fonte única · handles de redimensionamento acessíveis por teclado · `aria-label`/`role`/`aria-checked` em controles, amostras de cor, timer, seleção de monitores e diálogo · "Close" → "Fechar" |
| **Estado** | `loadingDoc` morto removido · `openPdf` com deps corretas · `goToPage` com clamp e log de IPC · `isSingleMonitor` trata lista vazia |
| **Infra** | `.gitattributes`, `.gitignore`, `.nvmrc`, `engines`, scripts `typecheck`/`build` · workflows em `main` e `develop`, com `contents: read`, cache npm, `concurrency` e guarda de nulo no zip portátil · release.js local (não versionado) sincroniza e versiona `Cargo.lock` e `package-lock.json` |
| **Empacotamento** | `bundle.targets` reduzido a `["nsis", "deb", "appimage", "dmg", "app"]` (sem MSI/rpm) · `install.ps1` e `install.sh` sem o caminho MSI/rpm · 10 logos WiX (`Square*Logo.png`/`StoreLogo.png`) removidos · `tailwindcss`/`@tailwindcss/vite`/`tw-animate-css` movidos para `devDependencies` |
| **Documentação** | README, `docs/analise-melhorias.md`, `docs/instalacao-windows.md`, `docs/instalacao-linux.md`, `docs/fluxo-atualizacao.md`, `docs/plano-migracao-config.md`, `install.sh`, `install.ps1`, `AGENTS.md` |

### Verificação

Toda a rodada passou sem commit:

```
cargo check --manifest-path src-tauri\Cargo.toml
cargo fmt --manifest-path src-tauri\Cargo.toml -- --check
tsc --noEmit
tsc -p tsconfig.node.json --noEmit
vite build
bash -n install.sh
[Parser]::ParseFile('install.ps1', ...) retornou zero erros
varredura byte-a-byte dos arquivos tocados (encoding/LF)
```

> Não há teste automatizado no projeto — o AGENTS.md é explícito sobre isso — nem
> lint configurado. A projeção multi-monitor e o sinal de prontidão merecem uma
> verificação manual antes de publicar.
