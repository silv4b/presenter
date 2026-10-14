# Graphify — Tutorial dos Principais Comandos

O **graphify** transforma qualquer pasta de arquivos (código, docs, PDFs,
imagens, vídeos) em um **grafo de conhecimento navegável**, com detecção de
comunidades, rastreabilidade honesta (`EXTRACTED` / `INFERRED` / `AMBIGUOUS`) e
três saídas: um HTML interativo, um JSON pronto para GraphRAG e um relatório em
linguagem natural (`GRAPH_REPORT.md`).

Este tutorial cobre os comandos do dia a dia. Para a referência completa de
flags, veja `graphify --help`.

- [Como invocar](#como-invocar)
- [Pipeline completo (build)](#pipeline-completo-build)
- [Consultar o grafo](#consultar-o-grafo)
- [Adicionar conteúdo ao corpus](#adicionar-conteúdo-ao-corpus)
- [Atualização incremental e manutenção](#atualização-incremental-e-manutenção)
- [Exportações](#exportações)
- [Flags de build](#flags-de-build)
- [O que é gerado](#o-que-é-gerado)
- [CLI direto (sem o agente)](#cli-direto-sem-o-agente)
- [Exemplo real neste repositório](#exemplo-real-neste-repositório)
- [Boas práticas e solução de problemas](#boas-práticas-e-solução-de-problemas)

---

## Como invocar

Dentro do agente (OpenCode, Claude Code, Cursor etc.) o graphify é uma **skill**,
invocada com `/graphify`. O agente executa o pipeline e devolve o relatório.

```text
/graphify                       # pipeline completo no diretório atual
/graphify <caminho>             # pipeline completo em um caminho específico
/graphify --help                # mostra a lista de comandos e para
```

Fora do agente existe o **CLI** `graphify` com os mesmos recursos — útil para CI
ou para consultar o grafo já construído. Os dois são mostrados lado a lado
abaixo.

> **Precisa de API key?** Não. O código é extraído estruturalmente (AST), sem
> LLM e sem chave. Apenas docs/papers/imagens usam um LLM, e aí a própria sessão
> do agente atua como modelo (ou defina `GEMINI_API_KEY` / `GOOGLE_API_KEY` para
> usar o Gemini).

---

## Pipeline completo (build)

O comando principal. Ele detecta os arquivos, extrai entidades e relações,
clusteriza, rotula as comunidades e gera as saídas.

```text
/graphify                              # diretório atual
/graphify src                          # somente a pasta src
/graphify "D:\projetos\meu-app"        # caminho absoluto (aspas se tiver espaços)
```

### Repositório no GitHub

```text
/graphify https://github.com/silv4b/presenter
/graphify https://github.com/silv4b/presenter --branch develop
```

Clona o repositório em um diretório de trabalho do graphify e roda o pipeline
sobre ele. Várias URLs na mesma chamada geram **um grafo unificado cross-repo**.

```text
/graphify https://github.com/org/repo-a https://github.com/org/repo-b
```

### Modo profundo

```text
/graphify . --mode deep
```

Extração mais agressiva: cria mais arestas `INFERRED` (dependências indiretas,
acoplamentos latentes). Útil para entender arquitetura; mais lento e mais caro.

### Grafo direcionado

```text
/graphify . --directed
```

Preserva a direção das arestas (`origem → destino`) em vez do grafo não
direcionado padrão. Bom para analisar fluxo de chamadas e dependências.

### Sem visualização

```text
/graphify . --no-viz
```

Gera apenas o relatório e o JSON (útil em CI ou em grafos muito grandes).

> A flag `--html` existe mas é **no-op**: o HTML é gerado por padrão.

---

## Consultar o grafo

Depois de construído, o grafo fica em `graphify-out/graph.json` e pode ser
consultado sem reconstruir nada.

### Pergunta aberta (BFS)

```text
/graphify query "Como funciona o fluxo de anotações?"
/graphify query "O que conecta a camada de estado à API?" --budget 1500
/graphify query "..." --dfs        # DFS: traça um caminho específico
```

- Padrão: **BFS** — contexto amplo ao redor da pergunta.
- `--dfs` — aprofunda em um caminho.
- `--budget N` — limita a resposta a N tokens (padrão 2000).

### Caminho mais curto entre dois conceitos

```text
/graphify path "PresentationProvider" "list_monitors"
```

Mostra como dois nós se ligam — quais comunidades a travessia cruza e por quais
pontes. Excelente para descobrir dependências inesperadas.

### Explicar um nó

```text
/graphify explain "exportFullPdf"
```

Explicação em linguagem natural do nó e dos seus vizinhos.

### Equivalentes no CLI

```bash
graphify query "Como funciona o fluxo de anotações?"
graphify query "..." --dfs --budget 1500
graphify path "PresentationProvider" "list_monitors"
graphify explain "exportFullPdf"
graphify god-nodes --top 15          # hubs mais conectados
graphify affected "storage.ts"       # o que é impactado por um nó (traversal reverso)
```

---

## Adicionar conteúdo ao corpus

```text
/graphify add https://exemplo.com/artigo
/graphify add https://exemplo.com/artigo --author "Fulano"
/graphify add https://exemplo.com/artigo --contributor "Bruno"
```

Baixa a URL para `./raw`, marca autor/contribuidor e atualiza o grafo existente.
No CLI:

```bash
graphify add https://exemplo.com/artigo --author "Fulano" --contributor "Bruno"
```

---

## Atualização incremental e manutenção

### Reextrair apenas o que mudou

```text
/graphify . --update
```

Detecta arquivos novos/alterados desde a última execução (via
`graphify-out/manifest.json`) e reextrai só eles. Bem mais rápido que o build
completo em projetos grandes.

```bash
graphify update .            # equivalente no CLI
graphify update . --force    # sobrescreve mesmo se o grafo encolher (após refactor que remove código)
```

### Reclusterizar sem reextrair

```text
/graphify . --cluster-only
```

Reprocessa apenas o agrupamento de comunidades e regenera o relatório sobre um
`graph.json` já existente.

```bash
graphify cluster-only .
graphify label . --missing-only     # renomear só comunidades sem rótulo
```

### Assistir mudanças

```text
/graphify . --watch
```

Observa a pasta e reconstrói o grafo a cada alteração de código (sem LLM).

```bash
graphify watch .
```

---

## Exportações

Todas opcionais, adicionadas ao final do build (ou depois, via `graphify export`):

| Flag | O que gera | CLI |
| --- | --- | --- |
| `--obsidian` | Cofre Obsidian (`graphify-out/obsidian/`) | `graphify export obsidian [--dir PATH]` |
| `--svg` | `graph.svg` (embute em Notion, GitHub) | `graphify export svg` |
| `--graphml` | `graph.graphml` (Gephi, yEd) | `graphify export graphml` |
| `--wiki` | Wiki markdown (`index.md` + artigo por comunidade) | `graphify export wiki` |
| `--neo4j` | `graphify-out/cypher.txt` para Neo4j | `graphify export neo4j` |
| `--neo4j-push bolt://localhost:7687` | Envia direto ao Neo4j | `graphify export neo4j --push bolt://localhost:7687` |
| `--falkordb` | Cypher para FalkorDB | `graphify export falkordb` |
| `--falkordb-push falkordb://localhost:6379` | Envia direto ao FalkorDB | `graphify export falkordb --push ...` |
| `--mcp` | Servidor MCP (stdio) para outros agentes consultarem | `python -m graphify.serve graphify-out/graph.json` |

```text
/graphify . --obsidian --obsidian-dir ~/vaults/presenter
/graphify . --svg --graphml
```

> `--obsidian` gera um arquivo por nó; só use se você realmente quer o cofre.

---

## Flags de build

| Flag | Efeito |
| --- | --- |
| `--mode deep` | Extração profunda, mais arestas `INFERRED` |
| `--directed` | Grafo direcionado (mantém `origem → destino`) |
| `--no-viz` | Não gera HTML |
| `--obsidian` | Gera cofre Obsidian |
| `--whisper-model medium` | Modelo maior do Whisper (melhor transcrição de vídeo/áudio) |
| `--branch <branch>` | Branch específica ao clonar do GitHub |
| `--update` | Reextração incremental |
| `--cluster-only` | Reclusteriza grafo existente |
| `--watch` | Reconstrói ao detectar mudanças |
| `--svg` / `--graphml` | Exportações extras |
| `--neo4j` / `--falkordb` | Cypher/prepara para banco de grafos |
| `--mcp` | Servidor MCP |
| `--wiki` | Wiki de comunidades |

---

## O que é gerado

Tudo fica em `graphify-out/` (na raiz do projeto analisado):

```text
graphify-out/
├── graph.html          # grafo interativo — abra no navegador, sem servidor
├── GRAPH_REPORT.md     # relatório: god nodes, conexões surpreendentes, comunidades, lacunas
├── graph.json          # dados brutos do grafo (GraphRAG-ready)
├── manifest.json       # estado para --update (arquivos e hashes)
├── cost.json           # histórico de tokens gastos por execução
├── cache/              # cache de extração (AST e semântica)
└── obsidian/           # apenas se --obsidian foi usado
```

Sugestão: adicione `graphify-out/` ao `.gitignore` — é um artefato gerado
(caches, HTML e JSON grandes) e pode ser reconstruído a qualquer momento.

---

## CLI direto (sem o agente)

O binário `graphify` cobre construção, consulta e exportação. Principais
comandos:

```bash
# Construção e manutenção
graphify extract . --backend gemini        # extração headless (CI/scripts)
graphify extract . --code-only             # só código (AST, sem API key)
graphify update .                          # incremental
graphify cluster-only .                    # re-clusterizar
graphify label . --missing-only            # rotular comunidades
graphify watch .                           # rebuild contínuo

# Consulta
graphify query "..." [--dfs] [--budget N]
graphify path "A" "B" [--undirected]
graphify explain "X"
graphify god-nodes [--top N]
graphify affected "X" [--depth N]

# Diagnóstico e utilidades
graphify diagnose multigraph               # risco de colapso de arestas
graphify benchmark                         # ganho de redução de tokens
graphify check-update .                    # há reextração pendente?
graphify prs                               # dashboard de PRs
graphify clone <github-url>                # clona e imprime o caminho

# Exportações
graphify export html|svg|graphml|obsidian|wiki|neo4j|falkordb|callflow-html

# Instalação da skill em outros agentes/IDE
graphify install --platform opencode       # claude|codex|cursor|gemini|...
graphify hook install                      # rebuild automático no post-commit
```

---

## Exemplo real neste repositório

O grafo do **Presenter** foi construído com `/graphify .`:

```text
Corpus: 117 arquivos · ~39.259 palavras
  código:  65 arquivos (.tsx .ts .json .rs .toml .js .ps1 .sh)
  docs:    13 arquivos (.md .yml .html)
  imagens: 39 arquivos (.png)

Grafo: 602 nós · 1.338 arestas · 31 comunidades
Extração: 96% EXTRACTED · 4% INFERRED
Redução de tokens: 25,5× por consulta (~1.574 vs ~40.133 tokens)
```

Consultas úteis para começar:

```text
/graphify query "Por que o react conecta a Sidebar ao estado de apresentação?"
/graphify path "usePresentation" "open_projections"
/graphify explain "AnnotationLayer"
```

---

## Boas práticas e solução de problemas

- **Corpus pequeno:** se o relatório disser que o corpus "cabe em uma janela de
  contexto", você talvez não precise do grafo para ler — o valor está na
  clareza estrutural e na redução de tokens, não em comprimir algo que já era
  pequeno.
- **Sem API key:** o modo código funciona 100% sem chave. Docs/imagens usam a
  própria sessão como LLM. Para usar o Gemini, defina `GEMINI_API_KEY` ou
  `GOOGLE_API_KEY` e instale `pip install 'graphifyy[gemini]'`.
- **Aviso de saúde do grafo:** arestas "dangling/missing/collapsed" aparecem no
  fim do build. O grafo continua usável, mas o aviso é mantido visível de
  propósito (rastreabilidade honesta).
- **Grafo encolheu após refactor:** use `--force` (ou `GRAPHIFY_FORCE=1`) para
  sobrescrever mesmo com menos nós.
- **Windows:** o cache de AST pode falhar com `PermissionError` se o
  `presenter.exe`/outro processo estiver segurando arquivos de `graphify-out/`.
  Feche o app e rode de novo. O build cai para extração sequencial
  automaticamente.
- **HTML grande:** o graphify agrega para visão por comunidade quando o grafo
  passa de ~5.000 nós.
- **`.gitignore`:** inclua `graphify-out/` para não versionar caches e saídas.

---

## Referência rápida

```text
# Mais usados
/graphify                          build no diretório atual
/graphify <caminho>                build em um caminho
/graphify . --update               incremental
/graphify . --cluster-only         recomunizar
/graphify . --mode deep            extração profunda
/graphify . --no-viz               sem HTML
/graphify . --obsidian             cofre Obsidian
/graphify query "pergunta"         consultar (BFS)
/graphify query "pergunta" --dfs   consultar (DFS)
/graphify path "A" "B"             caminho mais curto
/graphify explain "X"              explicar um nó
/graphify add <url>                adicionar conteúdo
```
