# Fluxos de Atualização do Presenter

## Fluxo 1: Download Manual do Instalador

O usuário baixa o instalador do site/GitHub e executa manualmente.

```text
┌──────────────┐     ┌──────────────┐     ┌─────────────────┐
│  Usuário     │────▶│  Site/GitHub │────▶│  Download .exe  │
│  acessa      │     │  Releases    │     │  NSIS v1.1.0    │
└──────────────┘     └──────────────┘     └────────┬────────┘
                                                   │
                                                   ▼
                                          ┌─────────────────┐
                                          │  Executa o      │
                                          │  instalador     │
                                          └────────┬────────┘
                                                   │
                                          ┌────────▼────────┐
                                          │  NSIS detecta   │
                                          │  instalação     │
                                          │  existente      │
                                          └────────┬────────┘
                                                   │
                                          ┌────────▼────────┐
                                          │  Substitui      │
                                          │  binários       │
                                          │  (sobrescreve)  │
                                          └────────┬────────┘
                                                   │
                                          ┌────────▼────────┐
                                          │  Atualização    │
                                          │  concluída      │
                                          └─────────────────┘
```

**Vantagens:**

- Simples de implementar (já funciona com o build atual)
- Não requer infraestrutura adicional (servidor, CDN)
- Controle total do usuário sobre quando atualizar

**Desvantagens:**

- Usuário precisa saber que existe uma versão nova
- Processo manual:訪ar site → baixar → executar → instalar
- Sem notificação automática
- Risco do usuário usar versão antiga sem saber

---

## Fluxo 2: Botão "Buscar Atualização" no App (Updater Plugin)

O app verifica automaticamente ou sob demanda se existe uma versão nova e instala direto.

```text
┌─────────────────────────────────────────────────────────────┐
│                     FLUXO NO APP                            │
└─────────────────────────────────────────────────────────────┘

┌──────────┐     ┌──────────────┐     ┌──────────────────┐
│  App     │────▶│  check()     │────▶│  GET latest.json │
│  inicia  │     │  automático  │     │  no endpoint     │
└──────────┘     └──────────────┘     └────────┬─────────┘
                                               │
                                      ┌────────▼─────────┐
                                      │  Endpoint        │
                                      │  compara versão  │
                                      │  (1.0.0 vs 1.1.0)│
                                      └────────┬─────────┘
                                               │
                              ┌─────────────────┼─────────────────┐
                              │ 204 No Content  │                 │ 200 OK
                              │ (sem update)    │                 │ (update ok)
                              ▼                 │                 ▼
                     ┌─────────────────┐        │        ┌─────────────────┐
                     │  Usuário noti-  │        │        │  Dialog nativo: │
                     │  ficado: "App   │        │        │  "Versão 1.1.0  │
                     │  atualizado"    │        │        │   disponível"   │
                     └─────────────────┘        │        │  [Instalar]     │
                                                │        │  [Depois]       │
                                                │        └────────┬────────┘
                                                │                 │
                                                │        ┌────────▼────────┐
                                                │        │  Usuário clica  │
                                                │        │  "Instalar"     │
                                                │        └────────┬────────┘
                                                │                 │
                                                │        ┌────────▼────────┐
                                                │        │  downloadAnd-   │
                                                │        │  Install()      │
                                                │        │                 │
                                                │        │  1. Baixa .nsis │
                                                │        │     .zip (~MB)  │
                                                │        │  2. Verifica    │
                                                │        │     assinatura  │
                                                │        │     (pubkey)    │
                                                │        │  3. Extrai e    │
                                                │        │     sobrescreve │
                                                │        └────────┬────────┘
                                                │                 │
                                                │        ┌────────▼────────┐
                                                │        │  app.restart()  │
                                                │        │  ou relaunch()  │
                                                │        └────────┬────────┘
                                                │                 │
                                                │        ┌────────▼────────┐
                                                │        │  App reinicia   │
                                                │        │  v1.1.0 ativo   │
                                                │        └─────────────────┘
```

**Fluxo detalhado com o `tauri-plugin-updater`:**

```text
┌─────────────────────────────────────────────────────────────────┐
│  1. CHECK (verificação)                                         │
│                                                                 │
│  Frontend: check() do @tauri-apps/plugin-updater                │
│  Backend:  GET https://releases.example.com/latest.json         │
│                                                                 │
│  Resposta 204 → sem update → retorna null                       │
│  Resposta 200 → JSON com versão, notas, URLs por plataforma     │
│                                                                 │
│  Plugin compara: versão_remota > versão_atual (CARGO_PKG_VER)   │
├─────────────────────────────────────────────────────────────────┤
│  2. DOWNLOAD (download)                                         │
│                                                                 │
│  URL: platforms.windows-x86_64.url                              │
│  Arquivo: presenter_1.1.0_x64-setup.nsis.zip                    │
│                                                                 │
│  Callbacks de progresso:                                        │
│    Started { content_length } → iniciar barra de progresso      │
│    Progress { chunk_length }   → atualizar barra                │
│    Finished                    → download completo              │
├─────────────────────────────────────────────────────────────────┤
│  3. VERIFY (assinatura)                                         │
│                                                                 │
│  Plugin lê o .sig (signature) do JSON manifest                  │
│  Compara com a pubkey embutida no binário                       │
│  Se não bater → ERRO, update rejeitado                          │
├─────────────────────────────────────────────────────────────────┤
│  4. INSTALL (instalação)                                        │
│                                                                 │
│  Windows: NSIS installer em modo silencioso                     │
│    - Fecha o app atual                                          │
│    - Sobrescreve binários                                       │
│    - Reinicia                                                   │
│                                                                 │
│  macOS: extrai .app.tar.gz sobre /Applications                  │
│    - Precisa de relaunch manual                                 │
│                                                                 │
│  Linux: extrai AppImage ou deb                                  │
│    - Precisa de relaunch manual                                 │
├─────────────────────────────────────────────────────────────────┤
│  5. RESTART (reinício)                                          │
│                                                                 │
│  Windows: automático (app.exit() + spawn novo processo)         │
│  macOS/Linux: relaunch() do @tauri-apps/plugin-process          │
│  Resultado: app abre com nova versão                            │
└─────────────────────────────────────────────────────────────────┘
```

**Vantagens:**

- Experiência do usuário: notificação → 1 clique → atualizado
- Verificação de integridade (assinatura criptográfica)
- Funciona cross-platform (Windows, macOS, Linux)
- Pode verificar automaticamente ao iniciar o app

**Desvantagens:**

- Requer infraestrutura: servidor para hospedar `latest.json` + instaladores
- Requer geração e gerenciamento de chaves de assinatura
- Requer atualização do workflow CI/CD para assinar builds e gerar `latest.json`
- Mais complexidade na configuração

---

## Infraestrutura Necessária para o Fluxo 2

### Componentes

```text
┌─────────────────────────────────────────────────────────┐
│                    ARQUITETURA                          │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  GitHub Releases                                        │
│  ├── presenter_1.0.0_x64-setup.nsis.zip                 │
│  ├── presenter_1.0.0_x64-setup.nsis.zip.sig             │
│  ├── presenter_1.0.0_aarch64.dmg                        │
│  ├── presenter_1.0.0_aarch64.dmg.sig                    │
│  ├── presenter_1.0.0_amd64.AppImage.tar.gz              │
│  └── presenter_1.0.0_amd64.AppImage.tar.gz.sig          │
│                                                         │
│  latest.json (hospedado no repo ou GitHub Pages)        │
│  ├── version: "1.1.0"                                   │
│  ├── notes: "Correções e melhorias"                     │
│  ├── platforms:                                         │
│  │   ├── windows-x86_64: { signature, url }             │
│  │   ├── darwin-aarch64: { signature, url }             │
│  │   └── linux-x86_64: { signature, url }               │
│  │                                                      │
│  Chaves de Assinatura                                   │
│  ├── ~/.tauri/presenter.key      (privada, secreta)     │
│  └── ~/.tauri/presenter.key.pub  (pública, no app)      │
│                                                         │
│  GitHub Actions (CI/CD)                                 │
│  ├── Build com TAURI_SIGNING_PRIVATE_KEY                │
│  ├── Gera .sig junto com o instalador                   │
│  ├── Atualiza latest.json automaticamente               │
│  └── Publica na release do GitHub                       │
│                                                         │
│  App (Tauri)                                            │
│  ├── tauri-plugin-updater                               │
│  ├── @tauri-apps/plugin-updater (JS)                    │
│  ├── @tauri-apps/plugin-process (para relaunch)         │
│  └── tauri.conf.json → plugins.updater                  │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Configuração no App

```text
tauri.conf.json:
├── bundle.createUpdaterArtifacts: true
├── plugins.updater.endpoints: ["https://.../latest.json"]
├── plugins.updater.pubkey: "<conteúdo da .key.pub>"
└── bundle.targets: ["nsis", "updater"]

capabilities/default.json:
├── "updater:default"
├── "updater:allow-check"
└── "updater:allow-download-and-install"
```

---

## Comparação

| Aspecto | Fluxo 1 (Manual) | Fluxo 2 (Updater) |
| --- | --- | --- |
| **Implementação** | Já funciona | ~2-3h de config |
| **Experiência do usuário** | Ruim (5+ passos) | Ótima (1 clique) |
| **Notificação** | Nenhuma | Automática |
| **Verificação de integridade** | Depende do OS | Assinatura criptográfica |
| **Infraestrutura** | Nenhuma | Servidor/CDN |
| **Manutenção** | Baixa | Média (chaves, CI/CD) |
| **Velocidade de adoção** | Lenta | Rápida |

---

## Recomendação

**O Fluxo 2 (Updater Plugin) é o mais recomendado** para este projeto.

Motivos:

1. **O app já tem GitHub Actions + Releases** — a infraestrutura base já existe
2. **O NSIS já é o instalador** — o updater baixa `.nsis.zip` e instala silenciosamente
3. **Segurança** — assinatura criptográfica garante que o update é legítimo
4. **UX** — diferença enorme entre "abrir app → botão → atualizado" vs "visitar GitHub → baixar → instalar"
5. **Adoção** — usuários tendem a não atualizar quando o processo é manual
6. **Custo baixo** — pode hospedar `latest.json` + bins no próprio GitHub Releases (gratuito)

### Implementação Sugerida (Fase 1)

1. Gerar chaves de assinatura (`npx tauri signer generate`)
2. Adicionar `tauri-plugin-updater` + `@tauri-apps/plugin-updater`
3. Configurar `tauri.conf.json` com endpoint apontando para GitHub Releases
4. Atualizar workflow `release.yml` para assinar builds e gerar `latest.json`
5. Adicionar botão "Buscar atualização" no app (ou verificação automática ao iniciar)

### Implementação Sugerida (Fase 2)

- Verificação automática ao iniciar o app (silenciosa)
- Dialog nativo quando update disponível
- Barra de progresso durante download
- Relaunch automático após instalação

---

## Riscos e Mitigações

| Risco | Mitigação |
| --- | --- |
| Chave privada vazada | Usar GitHub Secrets, nunca commitar |
| Endpoint offline | Usar múltiplos endpoints (fallback) |
| Update quebrado | Testar fluxo completo antes de publicar |
| Usuário com Windows sem permissão | NSIS pede UAC elevation |
| Internet lenta | Mostrar progresso do download |
