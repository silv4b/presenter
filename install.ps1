<#
.SYNOPSIS
    Instalador do Presenter para Windows.

.DESCRIPTION
    Detecta a arquitetura, baixa o instalador oficial mais recente do GitHub
    Releases e executa a instalacao silenciosa.

    O script exige PowerShell 5.1 ou superior.

.EXAMPLE
    Invoke-WebRequest https://raw.githubusercontent.com/silv4b/presenter/develop/install.ps1 -OutFile install.ps1
    ./install.ps1

.EXAMPLE
    ./install.ps1 -Version v1.3.0

.EXAMPLE
    ./install.ps1 -DryRun
#>
[CmdletBinding()]
param(
    # Versao especifica (ex.: v1.3.0). Padrao: a mais recente.
    [string]$Version,

    # Mostra o que seria feito, sem baixar nem instalar.
    [switch]$DryRun,

    # Usa o instalador .msi em vez do .exe do NSIS.
    [switch]$Msi
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$Repo = "silv4b/presenter"
$Product = "presenter"
$GitHubApi = "https://api.github.com/repos/$Repo"

# ---------------------------------------------------------------------------
# Saida
# ---------------------------------------------------------------------------

function Write-Info    { param($m) Write-Host ":: $m" -ForegroundColor Cyan }
function Write-Success { param($m) Write-Host "ok $m" -ForegroundColor Green }
function Write-Warn    { param($m) Write-Host "!! $m" -ForegroundColor Yellow }
function Write-Err     { param($m) Write-Host "erro: $m" -ForegroundColor Red }

# ---------------------------------------------------------------------------
# Pre-requisitos
# ---------------------------------------------------------------------------

if ($PSVersionTable.PSVersion.Major -lt 5) {
    Write-Err "PowerShell 5.1 ou superior e necessario (encontrado $($PSVersionTable.PSVersion))"
    exit 1
}

# ---------------------------------------------------------------------------
# Deteccao de arquitetura
# ---------------------------------------------------------------------------

$arch = $env:PROCESSOR_ARCHITECTURE
if (-not $arch) { $arch = "AMD64" }
if ($env:PROCESSOR_ARCHITEW6432) { $arch = $env:PROCESSOR_ARCHITEW6432 }

switch ($arch) {
    "AMD64" { $TauriArch = "x64";   $MsiArch = "x64"   }
    "ARM64" { $TauriArch = "arm64"; $MsiArch = "arm64" }
    default {
        Write-Err "arquitetura nao suportada: $arch (suportado: AMD64, ARM64)"
        exit 1
    }
}

# ---------------------------------------------------------------------------
# Consulta da release
# ---------------------------------------------------------------------------

function Get-Headers {
    $h = @{ "Accept" = "application/vnd.github+json"; "User-Agent" = "presenter-install" }
    if ($env:GITHUB_TOKEN) { $h["Authorization"] = "Bearer $env:GITHUB_TOKEN" }
    return $h
}

if (-not $Version) {
    Write-Info "Consultando a versao mais recente..."
    try {
        $release = Invoke-RestMethod -Uri "$GitHubApi/releases/latest" -Headers (Get-Headers)
        $Version = $release.tag_name
    } catch {
        Write-Err "nao foi possivel consultar a API do GitHub: $($_.Exception.Message)"
        exit 1
    }
} else {
    if ($Version -notmatch '^v\d') { $Version = "v$Version" }
    try {
        $release = Invoke-RestMethod -Uri "$GitHubApi/releases/tags/$Version" -Headers (Get-Headers)
    } catch {
        Write-Err "release $Version nao encontrada: $($_.Exception.Message)"
        exit 1
    }
}

if (-not $Version) {
    Write-Err "resposta da API nao contem tag_name"
    exit 1
}

# ---------------------------------------------------------------------------
# Selecao do artefato
# ---------------------------------------------------------------------------

# O Tauri nomeia o NSIS como _x64-setup.exe e o MSI como _x64_en-US.msi.
# O padrao precisa ser ancorado no final: sem isso, -Msi acabaria casando
# com o .exe, que aparece antes na lista de assets.
if ($Msi) {
    $patterns = @("_$MsiArch.*\.msi$")
} else {
    $patterns = @("_$TauriArch-setup\.exe$", "_$MsiArch.*\.msi$")
}

$asset = $null
foreach ($p in $patterns) {
    $asset = $release.assets |
        Where-Object { $_.name -match $p } |
        Select-Object -First 1
    if ($asset) { break }
}

if (-not $asset) {
    Write-Err "nenhum instalador compativel encontrado em $Version para $arch"
    Write-Host ""
    Write-Host "Instaladores disponiveis nesta release:"
    $release.assets |
        Where-Object { $_.name -match '\.(exe|msi)$' } |
        ForEach-Object { Write-Host "  - $($_.name)" }
    Write-Host ""
    exit 1
}

# ---------------------------------------------------------------------------
# Resumo
# ---------------------------------------------------------------------------

$os    = [System.Environment]::OSVersion.VersionString
$kind  = if ($asset.name -match '\.msi$') { "MSI" } else { "NSIS" }

Write-Host ""
Write-Host "Presenter $Version" -ForegroundColor Cyan
Write-Host "  sistema:      $os"
Write-Host "  arquitetura:  $arch"
Write-Host "  instalador:   $($asset.name) ($kind)"
Write-Host "  tamanho:      $([math]::Round($asset.size / 1MB, 2)) MB"
Write-Host ""

# ---------------------------------------------------------------------------
# Download
# ---------------------------------------------------------------------------

$tempDir = Join-Path ([System.IO.Path]::GetTempPath()) ("presenter-install-" + [System.Guid]::NewGuid().ToString("N").Substring(0, 8))
$target  = Join-Path $tempDir $asset.name

try {
    if ($DryRun) {
        Write-Host "[dry-run] Invoke-WebRequest $($asset.browser_download_url) -OutFile $target" -ForegroundColor Yellow
    } else {
        Write-Info "Baixando $($asset.name)..."
        New-Item -ItemType Directory -Path $tempDir -Force | Out-Null

        $oldProgress = $ProgressPreference
        $ProgressPreference = "SilentlyContinue"
        try {
            Invoke-WebRequest -Uri $asset.browser_download_url -OutFile $target -Headers (Get-Headers)
        } finally {
            $ProgressPreference = $oldProgress
        }

        if (-not (Test-Path $target)) { Write-Err "download falhou"; exit 1 }
        $size = (Get-Item $target).Length
        if ($size -ne $asset.size) {
            Write-Err "download incompleto: esperado $($asset.size) bytes, obtido $size"
            exit 1
        }
        Write-Success "Download concluido ($([math]::Round($size / 1MB, 2)) MB)"
    }

    # ------------------------------------------------------------------------
    # Instalacao
    # ------------------------------------------------------------------------

    if ($DryRun) {
        if ($kind -eq "MSI") {
            Write-Host "[dry-run] Start-Process msiexec -ArgumentList '/i', '$target', '/quiet', '/norestart' -Wait" -ForegroundColor Yellow
        } else {
            Write-Host "[dry-run] Start-Process '$target' -ArgumentList '/S' -Wait" -ForegroundColor Yellow
        }
        Write-Host ""
        Write-Info "dry-run concluido. Nada foi instalado."
        exit 0
    }

    # O instalador precisa de privilegio de administrador: cria atalhos no
    # Menu Iniciar e chaves no registro do sistema.
    $isAdmin = ([Security.Principal.WindowsPrincipal] `
        [Security.Principal.WindowsIdentity]::GetCurrent()
    ).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

    if (-not $isAdmin) {
        Write-Info "Solicitando privilegio de administrador..."
        $argList = @("-NoProfile", "-ExecutionPolicy", "Bypass", "-File", "`"$($MyInvocation.MyCommand.Path)`"")
        if ($Version) { $argList += "-Version" ; $argList += $Version }
        if ($Msi)     { $argList += "-Msi" }
        try {
            $p = Start-Process -FilePath "powershell.exe" -ArgumentList $argList -Verb RunAs -Wait -PassThru
            exit $p.ExitCode
        } catch {
            Write-Err "elevacao cancelada ou negada: $($_.Exception.Message)"
            exit 1
        }
    }

    Write-Info "Instalando (pode levar alguns segundos)..."

    if ($kind -eq "MSI") {
        $proc = Start-Process -FilePath "msiexec.exe" `
            -ArgumentList "/i", "`"$target`"", "/quiet", "/norestart" `
            -Wait -PassThru
    } else {
        # /S e o modo silencioso do instalador NSIS gerado pelo Tauri.
        $proc = Start-Process -FilePath $target -ArgumentList "/S" -Wait -PassThru
    }

    $code = $proc.ExitCode
    if ($code -ne 0) {
        Write-Err "instalador retornou codigo de saida $code"
        exit $code
    }

    # ------------------------------------------------------------------------
    # Conclusao
    # ------------------------------------------------------------------------

    $exe = Get-ChildItem -Path "C:\Program Files\presenter", "$env:LOCALAPPDATA\Programs\presenter" `
        -Filter "presenter.exe" -Recurse -ErrorAction SilentlyContinue |
        Select-Object -First 1

    Write-Host ""
    if ($exe) {
        Write-Success "Presenter $Version instalado em $($exe.DirectoryName)"
    } else {
        Write-Success "Presenter $Version instalado."
    }

    Write-Host ""
    Write-Host "  Execute:      presenter"
    Write-Host "  Atalhos:      F5 inicia a apresentacao, Esc encerra"
    Write-Host "  Desinstalar:  Configuracoes > Aplicativos > Presenter"
    Write-Host ""

} finally {
    if (Test-Path $tempDir) {
        Remove-Item -Path $tempDir -Recurse -Force -ErrorAction SilentlyContinue
    }
}
