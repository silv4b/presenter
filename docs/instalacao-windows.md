# Instalação no Windows

O Presenter no Windows tem duas formas de uso: **instalado** (instalador NSIS ou
MSI) ou **portátil** (uma pasta com o `presenter.exe`, sem instalação).

- [Instalação automática via PowerShell](#instalação-via-powershell)
- [Versão portátil](#versão-portátil)

## Requisito

Windows 10 ou superior. O Windows 7 e o 8 não são suportados pelo Tauri 2.

---

# Instalação via PowerShell

O Presenter pode ser instalado no Windows com um único comando, sem baixar e
abrir instaladores manualmente. É o equivalente ao
[`curl | bash` do Linux](./instalacao-linux.md).

## Requisito do script

**PowerShell 5.1** (já presente no Windows 10 e 11) ou **PowerShell 7**.

Para conferir a versão:

```powershell
$PSVersionTable.PSVersion
```

Se o PowerShell 5.1 estiver desabilitado por política da empresa, instale o
[PowerShell 7](https://aka.ms/powershell) e use `pwsh` no lugar de `powershell`.

## Comando

```powershell
irm https://raw.githubusercontent.com/silv4b/presenter/develop/install.ps1 | iex
```

`irm` é o apelido de `Invoke-RestMethod` e `iex` o de `Invoke-Expression`. A
instalação é feita no modo **por usuário**, então não é preciso abrir o
PowerShell como administrador e o Windows não pede confirmação de UAC.

## O que acontece

1. Baixa o `install.ps1` da branch `develop` e o executa.
2. Detecta a arquitetura do processador (`AMD64` ou `ARM64`).
3. Consulta a API do GitHub para descobrir a versão mais recente publicada.
4. Baixa o instalador correspondente e confere se o download veio completo.
5. Executa a instalação silenciosa e mostra o caminho onde o app foi instalado.

O script exibe um resumo da detecção antes de instalar:

```text
Presenter v1.3.0
  sistema:      Microsoft Windows NT 10.0.26100.0
  arquitetura:  AMD64
  instalador:   presenter_1.3.0_x64-setup.exe (NSIS)
  tamanho:      2.19 MB
```

## Instaladores disponíveis

| Formato | Arquivo | Instalação |
| --- | --- | --- |
| NSIS (padrão) | `presenter_<versão>_x64-setup.exe` | executa com `/S` |
| MSI | `presenter_<versão>_x64_en-US.msi` | `msiexec /i /quiet` |

O NSIS é o padrão por oferecer uma interface de instalação mais simples. O MSI
interessa em ambientes corporativos, onde o `msiexec` se integra a políticas de
implantação de software.

## Opções

Como as opções são parâmetros do script, use `iex` com um bloco de script para
passá-las:

```powershell
# Inspecionar sem instalar
& ([scriptblock]::Create((irm https://raw.githubusercontent.com/silv4b/presenter/develop/install.ps1))) -DryRun

# Instalar uma versão específica
& ([scriptblock]::Create((irm https://raw.githubusercontent.com/silv4b/presenter/develop/install.ps1))) -Version v1.3.0

# Forçar o instalador MSI
& ([scriptblock]::Create((irm https://raw.githubusercontent.com/silv4b/presenter/develop/install.ps1))) -Msi
```

> Com o `irm | iex` simples não é possível passar parâmetros, porque o pipeline
> executa o script sem argumentos. Por isso o `& ([scriptblock]::Create(...))`.

## Atualização

Não há auto-update embutido no aplicativo. Para atualizar, basta reexecutar o
comando de instalação: o script busca a versão mais recente e substitui a
instalada.

## Desinstalação

**Configurações → Aplicativos → Presenter → Desinstalar.**

Pelo terminal, com o desinstalador que o próprio instalador deixou:

```powershell
# Instalação por usuário (padrão)
& "$env:LOCALAPPDATA\presenter\uninstall.exe" /S

# Instalação por máquina, se foi feita assim
& "C:\Program Files\presenter\uninstall.exe" /S
```

> Como o Presenter ainda não está no catálogo do `winget`, o
> `winget uninstall presenter` não encontra o app.

## Notas

- **Acesso de administrador:** não é necessário. O instalador é do modo por
  usuário, gravando em `%LOCALAPPDATA%\presenter` e criando o atalho apenas
  para o usuário atual. Se o instalador falhar com erro de permissão, repita o
  comando num PowerShell aberto como administrador.
- **Rate limit da API:** a API pública do GitHub permite 60 requisições por hora
  por IP. Se encontrar `403`, defina `$env:GITHUB_TOKEN` antes de rodar o comando.
- **Política de execução:** `irm | iex` não é bloqueada pela Execution Policy
  (ela só se aplica a arquivos `.ps1`). Baixando o arquivo e executando
  `./install.ps1`, pode ser necessário `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`.
- **Download truncado:** o script compara o tamanho obtido com o informado pela
  API e aborta se divergirem.
- **Windows ARM64:** as releases atuais são publicadas apenas para x64. Em um
  Windows ARM o script informa que não há instalador compatível.

## Alternativa: baixa manual

Quem preferir baixar o arquivo antes de executar:

```powershell
irm https://raw.githubusercontent.com/silv4b/presenter/develop/install.ps1 -OutFile install.ps1
.\install.ps1
```

Se a Execution Policy bloquear:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\install.ps1
```

Os instaladores também estão disponíveis diretamente na página de releases:
<https://github.com/silv4b/presenter/releases>

## winget

Para quem já usa o gerenciador de pacotes do Windows, o Presenter ainda não está
no catálogo do `winget`. Enquanto isso, use o comando PowerShell acima.

---

# Versão portátil

Cada release publica também um zip portátil, na raiz da página de releases:
`presenter_<versão>-portavel-win-x64.zip`.

Não precisa instalar nada. Extraia a pasta em qualquer lugar (pendrive, pasta de
rede, desktop) e execute o `presenter.exe`.

```text
presenter-1.3.0-portavel/
├── presenter.exe
├── portable.txt
└── app-data/          ← criado na primeira execução
```

## Requisito

Windows 10 1803 ou superior, que já traz o **Microsoft Edge WebView2 Runtime**
instalado. Se o app não abrir, baixe o runtime em
<https://developer.microsoft.com/microsoft-edge/webview2/>.

## Como funciona

O arquivo `portable.txt` é o marcador do modo portátil. Enquanto ele existir ao
lado do `presenter.exe`, o app guarda **todos** os seus dados na subpasta
`app-data`, ao lado do executável:

| Dado | Onde fica |
| --- | --- |
| Monitores marcados | `app-data\config.json` |
| Tema, sidebars, carrrossel, cronômetro, histórico | `app-data\EBWebView\` |

Nada é gravado no Registro nem em `%APPDATA%`. Isso vale tanto para o app
instalado quanto para o portátil: o comportamento é decidido pelo arquivo, não
por um build separado.

## Levar as configurações junto

Copie a pasta `app-data` inteira para o novo destino. É só isso — o app retoma
com as mesmas preferências, inclusive o histórico de PDFs abertos.

## Apagar o app

Feche o Presenter e apague a pasta. Não sobra nada no sistema.

Se você **apagar o `portable.txt`**, o mesmo `presenter.exe` volta ao
comportamento instalado, lendo e gravando em `%APPDATA%` e `%LOCALAPPDATA%`.

## Gerar o portable localmente

Para quem desenvolve ou quer um zip com outro nome:

```bash
npm run tauri:portable
```

O script compila o app (`tauri build --no-bundle`), monta a pasta em
`portable/presenter-<versão>-portavel/` e gera o zip ao lado. Para reaproveitar
um binário já compilado:

```bash
npm run tauri:portable -- --no-build
```

## Coexistir com a versão instalada

As duas versões podem ficar instaladas ao mesmo tempo. Elas não compartilham
preferências: a instalada usa `%APPDATA%`, a portátil usa a `app-data` ao lado
do `.exe`.
