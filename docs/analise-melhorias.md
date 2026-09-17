# Presenter — Melhorias (possibilidades)

## Funcionalidades Atuais

| # | Funcionalidade | Status |
| --- | --- | --- |
| 1 | Abertura de PDF via diálogo nativo | ✅ |
| 2 | Renderização de páginas em canvas (react-pdf + PDF.js) | ✅ |
| 3 | Modo apresentador multi-janela (controle + projeção) | ✅ |
| 4 | Seleção de monitor para projeção (persistente) | ✅ |
| 5 | Preview do próximo slide (sidebar redimensionável) | ✅ |
| 6 | Carrossel de slides (filmstrip horizontal) | ✅ |
| 7 | Navegação por teclado (Setas, Espaço, PgUp/PgDn, Home/End) | ✅ |
| 8 | Tela preta (B) | ✅ |
| 9 | Anotações ao vivo sincronizadas (caneta, marcador, laser, borracha) | ✅ |
| 10 | Borracha seletiva (arrastar para apagar segmentos) | ✅ |
| 11 | Ajuste de tamanho de ferramentas via scroll do mouse | ✅ |
| 12 | Cronômetro progressivo e regressivo | ✅ |
| 13 | Pré-carregamento de páginas adjacentes | ✅ |
| 14 | Confirmação ao fechar o app com PDF aberto | ✅ |
| 15 | Fechamento automático da janela de projeção ao encerrar | ✅ |
| 16 | Atalhos de teclado para ferramentas (L, P, H, E) | ✅ |
| 17 | Seletor de cores com presets e personalizado | ✅ |
| 18 | Desfazer/Refazer anotações (Ctrl+Z / Ctrl+Shift+Z) | ✅ |
| 19 | Lista de arquivos recentes (histórico) | ✅ |
| 20 | Abrir local do arquivo no explorador | ✅ |
| 21 | Configurações reais (cor de fundo, controles flutuantes) | ✅ |
| 22 | Zoom/Pan nos slides (Ctrl+scroll, Space+arrasto) | ✅ |
| 23 | Notas do apresentador (PDF annotations) | ✅ |
| 24 | Exportar anotações embutidas no PDF | ✅ |
| 25 | Atalhos Z/X/C para sidebars e carousel | ✅ |
| 26 | Drag-and-drop para abrir PDF | ✅ |

---

## A. Melhorias de UX

### A1. Configurações reais (dialog placeholder)

**Complexidade:** Média

O dialog de configurações mostra configurações reais: cor de fundo, controles flutuantes (sempre visíveis, timeout). Implementado em `SettingsDialog` + `useSettings`.

- ~~Monitor padrão ao abrir o app~~
- ~~Cor padrão da caneta/marcador~~
- ~~Toggle de persistência de anotações~~
- ~~Toggle de tema claro/escuro~~
- ~~Lista de arquivos recentes~~

### A2. Arrastar e soltar PDF (drag-and-drop) ✅

**Complexidade:** Baixa

Adicionar uma zona de drop na tela de boas-vindas e na área principal
para abrir PDFs arrastando o arquivo para a janela.

Implementado em `Welcome.tsx` com `onDragOver` e handler de `drop`
via `getCurrentWebview().onDragDropEvent`.

### A3. Lista de arquivos recentes ✅

**Complexidade:** Média

Manter um histórico dos últimos PDFs abertos (localStorage ou arquivo
de config). Exibir na tela de boas-vindas ou no menu de configurações.

Implementado em `src/lib/fileHistory.ts` e `WelcomeSidebar.tsx`.
Histórico exibido na sidebar com opções de abrir e remover.

### A4. Exibir caminho do arquivo / Abrir no explorador ✅

**Complexidade:** Baixa

Mostrar o caminho completo do PDF (tooltip ou barra de título). Adicionar
botão "Abrir local do arquivo" para revelar no explorador do sistema.

Implementado em `WelcomeSidebar.tsx` com `revealItemInDir` do
`@tauri-apps/plugin-opener` via menu dropdown.

### A5. Desfazer/Refazer anotações (undo/redo) ✅

**Complexidade:** Média

Implementar uma pilha por página para desfazer e refazer traços.
Atalhos: Ctrl+Z (desfazer), Ctrl+Shift+Z (refazer).

Implementado em `src/state/annotations/presenter.tsx` com
historyRef (max 50 snapshots) e sincronização com viewscreens.

### A6. Seletor de cores para anotações ✅

**Complexidade:** Baixa

Atualmente caneta = vermelho (#ef4444), marcador = amarelo (#facc15).
Adicionar um palette de cores predefinidas ou um color picker.

Implementado em `ColorPicker.tsx` com 6 cores predefinidas,
HexColorPicker para cores customizadas, e input hex.

### A7. Indicador de página na projeção

**Complexidade:** Baixa

Exibir "3 / 24" como overlay discreto no canto da janela de projeção
(opcional, ativável nas configurações).

### A8. Atalhos de teclado para ferramentas ✅

**Complexidade:** Baixa

Adicionar: `1` = Caneta, `2` = Marcador, `3` = Laser, `4` = Borracha,
`0` = Nenhuma ferramenta (modo navegação).

Implementado com atalhos diferentes mas funcional: L = Laser,
P = Caneta, H = Marcador, E = Borracha (em `useKeyboardShortcuts.ts`).

### A9. Cronômetro visível na projeção

**Complexidade:** Baixa

Exibir o tempo decorrido como um HUD discreto na janela de projeção,
além de apenas na sidebar.

### A10. Zoom/Pan nos slides ✅

**Complexidade:** Alta

Permitir dar zoom em uma área específica do slide durante a apresentação
(útil para slides com muito detalhe). Modo lupa com scroll + arrasto.

Implementado em `PdfStage.tsx`: Ctrl+scroll para zoom (0.25x–4x),
Space+arrasto para pan. Reset com Ctrl+0.

### A11. Notas do apresentador ✅

**Complexidade:** Alta

Parsear e exibir notas embutidas no PDF (se existirem) em uma área
dedicada na sidebar ou em uma janela flutuante.

Implementado em `src/lib/pdf.ts` (extractNotesFromPdf) usando
`page.getAnnotations()` filtrando `subtype === "Text"`.
Exibido no `PresenterNotes.tsx` na sidebar do preview.

### A12. Tela branca (além da tela preta) ✅

**Complexidade:** Baixa

Adicionar um toggle para tela branca (W), útil para iluminar um sala
durante perguntas.

### A13. Barra de progresso de slides

**Complexidade:** Baixa

Exibir "Slide 5 de 24" com uma barra de progresso visual ao invés
de apenas um campo numérico.

### A14. Argumento de linha de comando ⛔

**Complexidade:** Baixa

Permitir `presenter.exe myfile.pdf` para abrir um arquivo
automaticamente ao iniciar.

### A15. Imprimir slide atual

**Complexidade:** Baixa

Botão para impressão rápida da página atual do PDF.

---

## B. Melhorias de Performance

### B1. Transferência base64 do PDF (problema crítico)

**Complexidade:** Alta

Atualmente o Rust lê o arquivo, codifica em base64 e envia pela IPC.
Para um PDF de 100MB, são ~133MB de texto trafegando pela IPC + ~100MB
no heap JS como data URL.

**Solução:** Usar um protocolo customizado do Tauri (`tauri://localhost/...`)
ou o plugin `fs` para servir o arquivo diretamente, evitando a cópia
completa pela IPC.

### B2. Carrossel renderiza todas as páginas de uma vez

**Complexidade:** Média

O `SlideCarousel` cria um `<Page>` para cada página do PDF. Para um
PDF com 200 páginas, são 200 elementos canvas simultâneos.

**Solução:** Virtualizar — renderizar apenas as páginas visíveis + um
buffer (ex: 10 páginas de cada lado).

### B3. NextPreview cria Document separado

**Complexidade:** Média

Cada renderização do `NextPreview` cria uma nova instância do
react-pdf `<Document>` com parse separado do PDF.js. O arquivo já
está carregado no estágio principal.

**Solução:** Compartilhar o documento parsed ou reutilizar o data URL
de forma mais eficiente.

### B4. Redesenho completo do canvas a cada mudança

**Complexidade:** Média

O `drawScene` redesenha todos os traços da página a cada render.
Para páginas com muitas anotações, isso pode ficar lento.

**Solução:** Dirty-rect tracking ou redesenhar apenas o traço alterado.

### B5. GC pressure durante desenho ⛔

**Complexidade:** Média

`onStrokePoint` cria uma cópia do array de traços a cada evento de
ponteiro (60+ vezes por segundo), gerando muita pressão de garbage
collection.

**Solução:** Usar um ref mutável para o traço ativo e commitar no
estado React apenas no `onStrokeEnd`.

### B6. Memoização dos Page no carrossel

**Complexidade:** Baixa

Cada `<Page>` no carrossel re-renderiza quando `currentPage` muda.
Envolver com `React.memo` e estabilizar props.

### B7. Worker do PDF.js

**Complexidade:** Baixa

O worker é carregado via `new URL("pdfjs-dist/build/pdf.worker.min.mjs",
import.meta.url)`. Em produção pode causar carregamento inicial grande.
Considerar inline ou fallback via CDN.

---

## C. Funcionalidades Novas

### C1. Persistência de anotações

**Complexidade:** Média

Serializar os traços em JSON (por página, chaveado pelo hash do path
do documento) e recarregá-los ao reabrir o mesmo PDF.

### C2. Sessões de apresentação

**Complexidade:** Alta

Salvar "setup de apresentação" (documento + anotações + monitor +
configurações do timer) para reutilização futura.

### C3. Transições entre slides

**Complexidade:** Média

Adicionar animações CSS configuráveis (fade, slide, zoom) ao trocar
de slide na projeção.

### C4. Ferramentas de forma

**Complexidade:** Alta

Retângulo, círculo, seta e linha como ferramentas de anotação
adicionais para markup mais estruturado.

### C5. Anotação de texto

**Complexidade:** Alta

Permitir colocar caixas de texto nos slides (ex: digitar uma nota
durante perguntas).

### C6. Visão multi-página

**Complexidade:** Alta

Mostrar duas ou mais páginas lado a lado (útil para comparação
ou quando o PDF tem páginas facing).

### C7. Exportar anotações ✅

**Complexidade:** Alta

Exportar slides anotados como um novo PDF com as anotações embutidas.

Implementado em `src/lib/exportPdf.ts` usando jsPDF. Renderiza
cada página em canvas, sobrepõe traços, e gera PDF via save_file.

### C8. Controle remoto via celular/tablet

**Complexidade:** Alta

Expor um servidor web leve para que um celular funcione como
controle remoto (next/prev/laser/laser remoto).

### C9. Atualização automática

**Complexidade:** Média

Adicionar `tauri-plugin-updater` para verificação e instalação
de atualizações in-app.

---

## D. Qualidade de Código

### D1. Linter e formatter

**Complexidade:** Baixa

Adicionar ESLint (ou Biome) e Prettier. Não existe nenhuma
configuração atualmente.

### D2. Testes unitários

**Complexidade:** Média

Não existe nenhum arquivo de teste. Adicionar testes para:

- `lib/annotations.ts` (funções de erase, clamp)
- `state/annotations.ts` (hooks)
- `state/presentation.tsx` (lógica de negócio)

### D3. Error boundaries

**Complexidade:** Baixa

Adicionar React error boundaries ao redor dos componentes
`Document`/`Page` para evitar crash completo do app.

### D4. Runtime validation com Zod

**Complexidade:** Média

Comandos como `list_monitors` podem retornar null ou formatos
inesperados. Adicionar validação runtime (Zod) ou no mínimo
checks defensivos.

### D5. Internacionalização (i18n)

**Complexidade:** Média

O texto da UI está em português, mas identificadores de código
estão em inglês. Padronizar: ou i18n completo ou tudo em um idioma.

### D6. CSP (Content Security Policy)

**Complexidade:** Média

`tauri.conf.json` tem `"csp": null`, desabilitando completamente
a CSP. Definir uma CSP adequada para produção.

### D7. Tipos compartilhados (não necessário)

**Complexidade:** Baixa

Criar diretório `types/` para tipos usados em múltiplos módulos
(ex: `MonitorInfo`, `DocumentInfo`).

Analisado: com apenas 12 tipos exportados e padrão de domínio
colocado, criar pasta `types/` seria over-engineering. Tipos
permanecem colocados com seus módulos.

### D8. Import paths inconsistentes

**Complexidade:** Baixa

Alguns componentes importam `cn` de `"cn"` (pacote) enquanto o
resto importa de `"@/lib/utils"`. Padronizar em um caminho.

---

## E. Plataforma e Build

### E1. Build para macOS/Linux

**Complexidade:** Média

O bundle lista "all" mas o app foi desenvolvido apenas no Windows.
Testar e ajustar: decorações no macOS, fullscreen, detecção de
monitores no Wayland vs X11.

### E2. Ícone do app

**Complexidade:** Baixa

Os ícones são placeholders genéricos do Tauri. Criar um ícone
personalizado para o Presenter.

### E3. Metadados do instalador ✅

**Complexidade:** Baixa

Preencher copyright, descrição, publisher no `tauri.conf.json`
para distribuição profissional.

Implementado em `Cargo.toml` e `package.json` com descrição,
autor (Bruno Silva), licença (MIT), homepage e repository.

### E4. Code signing

**Complexidade:** Média

Necessário para macOS e Windows SmartScreen. Configurar
certificados de assinatura.

---

## Priorização Sugerida

### Fase 1 — Quick Wins (fáceis, alto impacto)

1. ~~Drag-and-drop para abrir PDF (A2)~~ ✅
2. ~~Atalhos de teclado para ferramentas (A8)~~ ✅
3. Tela branca (A12)
4. Barra de progresso de slides (A13)
5. Argumento de linha de comando (A14)
6. Memoização dos Page no carrossel (B6)
7. Linter + formatter (D1)
8. Error boundaries (D3)

### Fase 2 — Médio prazo

1. Persistência de anotações (C1)
2. ~~Lista de arquivos recentes (A3)~~ ✅
3. ~~Seletor de cores (A6)~~ ✅
4. Indicador de página na projeção (A7)
5. ~~Configurações reais (A1)~~ ✅
6. Virtualização do carrossel (B2)
7. ~~Undo/redo de anotações (A5)~~ ✅
8. Testes unitários (D2)

### Fase 3 — Longo prazo

1. Correção de performance base64 (B1)
2. Transições entre slides (C3)
3. ~~Notas do apresentador (A11)~~ ✅
4. ~~Zoom/Pan nos slides (A10)~~ ✅
5. Controle remoto via celular (C8)
6. Ferramentas de forma (C4)
7. ~~Exportar anotações como PDF (C7)~~ ✅
