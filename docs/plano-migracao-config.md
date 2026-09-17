# Plano de Migração: localStorage → Arquivo de Configuração

## Objetivo
Mover configurações persistentes do `localStorage` para um arquivo `config.json` no diretório de configuração do app (via Tauri), mantendo portabilidade, versionamento e edição manual.

---

## Configurações a Migrar

| Chave localStorage | Tipo | Destino no config.json |
|---|---|---|
| `presenter:penColor` | string | `annotations.penColor` |
| `presenter:highlighterColor` | string | `annotations.highlighterColor` |
| `presenter:penSize` | number | `annotations.penSize` |
| `presenter:highlighterSize` | number | `annotations.highlighterSize` |
| `presenter:eraserRadius` | number | `annotations.eraserRadius` |
| `presenter:alwaysShowFloatingControls` | boolean | `presentation.alwaysShowFloatingControls` |
| `presenter:floatingControlsTimeout` | number | `presentation.floatingControlsTimeout` |
| `presenter:backgroundColor` | string | `presentation.backgroundColor` |
| `presenter:selectedMonitors` | string[] | `presentation.selectedMonitors` |
| `presenter:fileHistory` | HistoryEntry[] | `history.files` |

---

## Estrutura do `config.json`

```json
{
  "version": 1,
  "annotations": {
    "penColor": "#ef4444",
    "highlighterColor": "#facc15",
    "penSize": 2.5,
    "highlighterSize": 18,
    "eraserRadius": 18
  },
  "presentation": {
    "alwaysShowFloatingControls": false,
    "floatingControlsTimeout": 5,
    "backgroundColor": "#000000",
    "selectedMonitors": []
  },
  "history": {
    "files": [
      { "path": "...", "name": "...", "openedAt": "..." }
    ]
  }
}
```

---

## Implementação Backend (Rust)

### Novos comandos em `src-tauri/src/lib.rs`

```rust
// Estrutura
#[derive(Serialize, Deserialize)]
struct AppConfig {
    version: u32,
    annotations: AnnotationConfig,
    presentation: PresentationConfig,
    history: HistoryConfig,
}

// Comandos
#[tauri::command]
fn get_config(app: AppHandle) -> Result<AppConfig, String>

#[tauri::command]
fn set_config(app: AppHandle, config: AppConfig) -> Result<(), String>

// Helpers
fn config_path(app: &AppHandle) -> PathBuf {
    app.config_dir().unwrap().join("config.json")
}
```

### Migração do `monitor_config` existente
- `get_monitor_config` / `set_monitor_config` → unificados em `get_config` / `set_config`
- `config.json` substitui o arquivo separado

---

## Implementação Frontend

### Novo hook: `src/hooks/useConfig.ts`

```typescript
interface AppConfig { ... }

export function useConfig() {
  const [config, setConfig] = useState<AppConfig>(defaultConfig);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    invoke<AppConfig>("get_config").then(setConfig).finally(() => setLoading(false));
  }, []);

  const update = useCallback((patch: Partial<AppConfig>) => {
    const next = { ...config, ...patch };
    setConfig(next);
    invoke("set_config", { config: next });
  }, [config]);

  return { config, update, loading };
}
```

### Atualização dos hooks existentes

| Hook | Mudança |
|---|---|
| `useSettings` | Usa `useConfig` + `update({ presentation: { backgroundColor } })` |
| `usePresenterAnnotations` | Inicializa via `invoke("get_config")`, `setPenColor` etc. chamam `update` |

---

## Fluxo de Carregamento

1. App inicia → `useConfig` carrega `config.json` via `get_config`
2. Se não existe → cria defaults + `set_config`
3. Consumidores (`useSettings`, `usePresenterAnnotations`) leem do estado compartilhado
4. Mudanças → `update()` → `set_config` (escrita atômica)

---

## Ordem de Execução

1. **Backend**: Adicionar `get_config` / `set_config` + structs + testes
2. **Frontend**: Criar `useConfig` hook
3. **Migração hooks**: `useSettings` → `useConfig`
4. **Migração hooks**: `usePresenterAnnotations` → `useConfig` (remove localStorage)
5. **Migração**: `fileHistory` → `config.history.files`
6. **Cleanup**: Remover imports `localStorage` dos hooks migrados
7. **Teste**: Verificar persistência entre reinícios, edição manual do JSON

---

## Riscos e Mitigações

| Risco | Mitigação |
|---|---|
| Race condition escritas simultâneas | `set_config` serializado no Rust (mutex) ou debounce no frontend |
| Schema v1 → v2 no futuro | Campo `version` + migração automática no `get_config` |
| Arquivo corrompido | Try/catch + fallback para defaults + log de erro |
| Performance (muitas escritas) | Debounce 300ms no `update` do hook |

---

## Critérios de Aceitação

- [ ] `config.json` criado no primeiro run
- [ ] Cores/tamanhos persistem entre reinícios
- [ ] Edição manual do JSON reflete no app (após reload)
- [ ] Histórico de arquivos persiste
- [ ] Seleção de monitores persiste
- [ ] Build passa sem warnings