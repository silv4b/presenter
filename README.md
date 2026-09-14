# Presenter

Aplicativo de apresentação de PDFs para desktop, construído com **Tauri 2** + **React** + **TypeScript**. Transforma um arquivo PDF em uma apresentação estilo PowerPoint, com uma janela de controle para o apresentador e uma janela de projeção em tela cheia para o público.

## Recursos

- **Abertura de PDF** — selecione qualquer arquivo `.pdf` do computador.
- **Renderização em alta resolução** — cada página é desenhada em `<canvas>` via PDF.js (react-pdf), redimensionando-se automaticamente ao tamanho da janela.
- **Modo apresentador multi-janela** — a janela principal controla uma segunda janela (`viewscreen`) exibida em tela cheia no projetor.
- **Seleção de monitor** — identifique os monitores disponíveis e escolha em qual tela a apresentação será exibida (configuração persistida em disco).
- **Pré-carregamento** — as páginas anterior e posterior à atual são carregadas em segundo plano para transições instantâneas.
- **Preview do próximo slide** — miniatura da próxima página na sidebar direita, com tamanho redimensionável via arraste do mouse.
- **Carrossel de slides** — filmstrip na parte inferior com miniaturas de todas as páginas; clique para pular para qualquer slide.
- **Cronômetro** — modo progressivo (stopwatch) ou regressivo (countdown) para controle de tempo.
- **Tela preta** — oculta temporariamente o conteúdo do projetor (pausa visual).
- **Anotações ao vivo** — desenhe sobre os slides durante a apresentação com ferramentas sincronizadas em tempo real com o projetor:
  - **Caneta** — traço contínuo em vermelho (espessura ajustável via scroll do mouse).
  - **Marcador de texto** — destaque semi-transparente em amarelo (espessura ajustável via scroll).
  - **Laser** — ponteiro luminoso vermelho para chamar atenção.
  - **Borracha** — apague apenas os traços selecionados arrastando sobre eles (raio ajustável via scroll; duplo-clique apaga tudo).
- **Botão de reset de tamanhos** — restaura os tamanhos padrão das ferramentas de anotação.

## Atalhos de teclado

| Tecla | Ação |
| --- | --- |
| `F5` | Iniciar / Encerrar apresentação |
| `→` / `Espaço` / `Page Down` | Próximo slide |
| `←` / `Page Up` | Slide anterior |
| `Home` | Primeiro slide |
| `End` | Último slide |
| `B` | Alternar tela preta |
| `Esc` | Encerrar apresentação |
| `Scroll do mouse` (com ferramenta ativa) | Aumentar/diminuir tamanho da caneta, marcador ou borracha |
| `Duplo-clique` (com borracha) | Apagar todas as anotações do slide |

## Stack

- [Tauri 2](https://tauri.app/) — shell desktop (Rust)
- [React 19](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/)
- [Vite](https://vite.dev/) — bundler
- [Tailwind CSS 4](https://tailwindcss.com/) + [shadcn/ui](https://ui.shadcn.com/) (Radix UI)
- [react-pdf](https://github.com/wojtekmaj/react-pdf) — renderização de PDF (PDF.js)
- [Lucide](https://lucide.dev/) — ícones

## Arquitetura

- `src/` — frontend React/TypeScript
  - `src/state/presentation.tsx` — estado global (Context), navegação de slides, seleção de monitor
  - `src/state/annotations.ts` — hooks de anotações (apresentador + viewscreen)
  - `src/components/` — UI
    - `Sidebar.tsx` — painel de controle (abrir PDF, monitor, ferramentas, cronômetro)
    - `PdfStage.tsx` — renderizador de página com suporte a overlay
    - `AnnotationLayer.tsx` — canvas de anotações (caneta, marcador, laser, borracha)
    - `SlideCarousel.tsx` — filmstrip de miniaturas na parte inferior
    - `NextPreview.tsx` — preview do próximo slide
    - `Timer.tsx` — cronômetro progressivo/regressivo
    - `Welcome.tsx` — tela inicial vazia
  - `src/viewscreen/` — janela de projeção (instância secundária)
  - `src/lib/` — helpers
    - `pdf.ts` — leitura de PDF e comandos Rust (read_pdf, set_document, get_document)
    - `monitors.ts` — detecção de monitores e controle da janela de projeção
    - `annotations.ts` — tipos, constantes e utilidades de anotações
    - `shared.ts` — constantes de eventos e interfaces compartilhadas
- `src-tauri/` — backend Rust
  - `src/lib.rs` — comandos (`read_pdf`, `set_document`, `get_document`, `list_monitors`, `open_projection`, `close_projection`, etc.)
  - `capabilities/default.json` — permissões das janelas
  - `tauri.conf.json` — configuração do app e janelas

A sincronização entre janelas usa os eventos globais do Tauri: `mudar-slide` (troca de página), `tela-preta` (blackout) e eventos de anotações (`anotacao-traco`, `anotacao-laser`, `anotacao-apagar`, `anotacao-limpar`). A janela de projeção é criada/posicionada/fechada por comandos Rust (`open_projection` / `close_projection`), que a movem para o monitor escolhido e ativam o modo tela cheia.

## Como executar

### Pré-requisitos

- [Node.js](https://nodejs.org/) (v18+ recomendado) e npm
- [Rust](https://www.rust-lang.org/tools/install) (toolchain stable)
- Plataforma de build do Tauri — no Windows, o [Visual Studio Build Tools](https://visualstudio.microsoft.com/pt-br/visual-cpp-build-tools/) com a carga de trabalho "Desenvolvimento para desktop com C++" e o [WebView2 Runtime](https://developer.microsoft.com/microsoft-edge/webview2/) (normalmente já presente no Windows 10/11).

### Passos

1. **Clone e instale as dependências**

   ```sh
   npm install
   ```

2. **Execute em modo desenvolvimento**

   ```sh
   npm run tauri dev
   ```

   Isso inicia o Vite (frontend em `http://localhost:1420`) e abre a janela do app com recarregamento automático.

3. **Gere o instalador de produção**

   ```sh
   npm run tauri build
   ```

   Os artefatos são gerados em `src-tauri/target/release/bundle/` (`.msi` e `.exe` no Windows).

### Uso

1. Clique em **Abrir PDF** e selecione o arquivo da apresentação.
2. (Opcional) Na seção **Tela de projeção**, escolha em qual monitor exibir a apresentação.
3. Clique em **Iniciar (F5)** — a janela de projeção abre em tela cheia no monitor escolhido.
4. Navegue com as setas, `Espaço` ou pelos controles da sidebar.
5. Use as ferramentas de anotação (caneta, marcador, laser, borracha) na barra inferior da sidebar.
6. Use `B` para tela preta e `F5`/`Esc` para encerrar.
