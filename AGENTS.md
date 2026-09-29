# AGENTS.md

Diretrizes para agentes que trabalham neste repositório.

## Commits em Lotes

Sempre que houver múltiplas mudanças não relacionadas, organize os commits em lotes independentes, cada um seguindo a convenção semantic release (em pt-BR):

- `feat:` — novas funcionalidades
- `fix:` — correções de bugs
- `chore:` — tarefas de manutenção (formatação, lint, dependências)
- `docs:` — alterações de documentação
- `refactor:` — refatorações sem mudança de comportamento
- `test:` — adição/ajuste de testes

Regras:

1. Agrupe mudanças relacionadas no mesmo commit, separe mudanças de naturezas diferentes.
2. Escreva a mensagem em português, de forma concisa, no imperativo.
3. Se mudanças em um mesmo arquivo forem de naturezas diferentes (ex.: `feat` e `fix` intercalados no mesmo arquivo), combine em um único commit coerente.
4. Não faça commit sem que o usuário peça explicitamente.
5. Antes de commitar, rode a verificação descrita abaixo.

## Verificação

Rode a verificação após cada alteração e antes de commit ou PR:

- Tipos e build do frontend: `npx tsc --noEmit && npx vite build`
  - É o mesmo que `npm run build`, sem o passo intermediário desnecessário.
- Backend Rust: `cargo check --manifest-path src-tauri\Cargo.toml`
  - Necessário apenas quando a alteração tocar `src-tauri/`.
- Lint e testes automatizados: não configurados neste projeto. Não invente comandos.

Notas:

- `npm run clean:tauri` falha se o `presenter.exe` estiver em execução (lock de arquivo no Windows).
- Ao alterar versões em `src-tauri/Cargo.toml`, sincronize o `Cargo.lock` com `cargo update --manifest-path src-tauri\Cargo.toml -p <crate>`.
