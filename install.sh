#!/usr/bin/env bash
#
# install.sh - Instalador do Presenter para Linux
#
# Detecta a distribuição e a arquitetura, baixa o pacote oficial mais recente
# do GitHub Releases e instala o aplicativo.
#
# Uso:
#   curl -fsSL https://raw.githubusercontent.com/silv4b/presenter/develop/install.sh | bash
#
# Requer bash: o script usa construcoes ausentes no sh (dash), como pipefail e
# quoting ANSI-C. Ao ser executado via pipe, o shebang e ignorado e quem
# interpreta o codigo e o shell do lado direito, por isso o "bash" explicito.
#
set -euo pipefail

REPO="silv4b/presenter"
PRODUCT="presenter"
GITHUB_API="https://api.github.com/repos/${REPO}"

TAG=""
DRY_RUN=false
TMPDIR_CREATED=""

# ---------------------------------------------------------------------------
# Saida
# ---------------------------------------------------------------------------

if [ -t 1 ] && [ -z "${NO_COLOR:-}" ]; then
    C_RESET=$'\033[0m'; C_BOLD=$'\033[1m'; C_RED=$'\033[31m'
    C_GREEN=$'\033[32m'; C_YELLOW=$'\033[33m'; C_BLUE=$'\033[34m'
else
    C_RESET=""; C_BOLD=""; C_RED=""; C_GREEN=""; C_YELLOW=""; C_BLUE=""
fi

info()    { printf '%s\n' "${C_BLUE}::${C_RESET} $*"; }
success() { printf '%s\n' "${C_GREEN}ok${C_RESET} $*"; }
warn()    { printf '%s\n' "${C_YELLOW}!!${C_RESET} $*" >&2; }
error()   { printf '%s\n' "${C_RED}erro:${C_RESET} $*" >&2; }
die()     { error "$*"; exit 1; }

cleanup() {
    if [ -n "${TMPDIR_CREATED}" ] && [ -d "${TMPDIR_CREATED}" ]; then
        rm -rf "${TMPDIR_CREATED}"
    fi
}
trap cleanup EXIT

# Executa um comando, ou apenas o exibe quando --dry-run esta ativo.
run() {
    if [ "${DRY_RUN}" = true ]; then
        printf '%s\n' "${C_YELLOW}[dry-run]${C_RESET} $*"
    else
        "$@"
    fi
}

# Como run, mas executa dentro de um diretório especifico.
# run_in_dir <dir> <comando> [args...]
run_in_dir() {
    local dir="$1"
    shift
    if [ "${DRY_RUN}" = true ]; then
        printf '%s\n' "${C_YELLOW}[dry-run]${C_RESET} (cd ${dir} && $*)"
    else
        ( cd "${dir}" && "$@" )
    fi
}

usage() {
    cat <<EOF
${C_BOLD}Presenter - instalador para Linux${C_RESET}

Uso:
  install.sh [opções]

Opções:
  -v, --version <tag>   Instala uma versão especifica (ex: v1.3.0 ou 1.3.0)
  -n, --dry-run         Mostra o que seria feito, sem alterar o sistema
  -h, --help            Exibe esta ajuda

Formatos suportados:
  Debian/Ubuntu/Mint    .deb      (via apt-get)
  Fedora/RHEL           .rpm      (via dnf)
  Demais distros        .AppImage (em /opt/presenter, symlink em /usr/local/bin)

Distros sem pacote próprio (Arch, openSUSE, ...) recebem o AppImage.

Variáveis de ambiente:
  NO_COLOR      Desativa as cores na Saida
  GITHUB_TOKEN  Token do GitHub, opcional. Evita o rate limit da API publica

Requisito:
  bash            Obrigatorio. O script nao roda com sh (dash), que em
                  Debian/Ubuntu nao suporta pipefail nem o quoting ANSI-C.

Exemplo:
  curl -fsSL https://raw.githubusercontent.com/${REPO}/develop/install.sh | bash
EOF
}

# ---------------------------------------------------------------------------
# Argumentos
# ---------------------------------------------------------------------------

while [ $# -gt 0 ]; do
    case "$1" in
        -v|--version)
            [ $# -ge 2 ] || die "--version exige um valor (ex: v1.3.0)"
            TAG="$2"
            shift 2
            ;;
        -n|--dry-run)
            DRY_RUN=true
            shift
            ;;
        -h|--help)
            usage
            exit 0
            ;;
        *)
            usage >&2
            die "opção desconhecida: $1"
            ;;
    esac
done

case "${TAG}" in
    "")       ;;
    v[0-9]*)  ;;
    [0-9]*)   TAG="v${TAG}" ;;
    *)        die "versão invalida: ${TAG} (use o formato v1.3.0 ou 1.3.0)" ;;
esac

# ---------------------------------------------------------------------------
# Dependencies
# ---------------------------------------------------------------------------

if command -v curl >/dev/null 2>&1; then
    DOWNLOADER="curl"
elif command -v wget >/dev/null 2>&1; then
    DOWNLOADER="wget"
else
    die "curl ou wget e necessário para baixar o instalador"
fi

if [ ! -r /etc/os-release ]; then
    die "/etc/os-release nao encontrado: distribuição nao suportada"
fi

# shellcheck disable=SC1091
. /etc/os-release

# ---------------------------------------------------------------------------
# Detecção de arquitetura
# ---------------------------------------------------------------------------

case "$(uname -m)" in
    x86_64|amd64)  ARCH="amd64"   ;;
    aarch64|arm64) ARCH="arm64"   ;;
    *)             ARCH=""        ;;
esac

if [ -z "${ARCH}" ]; then
    die "arquitetura nao suportada: $(uname -m) (suportado: x86_64, aarch64)"
fi

# ---------------------------------------------------------------------------
# Detecção da familia de distribuição
# ---------------------------------------------------------------------------

# Base: ID. Complemento: ID_LIKE (trata Debian-like, que costuma citar o ID).
case "${ID:-} ${ID_LIKE:-}" in
    *debian*|*ubuntu*) DISTRO_FAMILY="debian" ;;
    *fedora*|*rhel*)   DISTRO_FAMILY="fedora" ;;
    *)                 DISTRO_FAMILY="other"  ;;
esac

DISTRO_NAME="${PRETTY_NAME:-${ID:-desconhecida}}"

# ---------------------------------------------------------------------------
# Resolução da versão
# ---------------------------------------------------------------------------

api_get() {
    local url="$1"
    if [ -n "${GITHUB_TOKEN:-}" ]; then
        ${DOWNLOADER} -fsSL -H "Authorization: Bearer ${GITHUB_TOKEN}" -H "Accept: application/vnd.github+json" "$url"
    else
        ${DOWNLOADER} -fsSL -H "Accept: application/vnd.github+json" "$url"
    fi
}

# Extrai o valor de uma chave string do JSON da API sem depender do jq.
# api_string <chave>
# Le da entrada padrão e consome apenas a primeira ocorrencia.
api_string() {
    grep -o "\"$1\"[[:space:]]*:[[:space:]]*\"[^\"]*\"" \
        | head -n 1 \
        | sed "s/^\"$1\"[[:space:]]*:[[:space:]]*\"//; s/\"$//"
}

if [ -z "${TAG}" ]; then
    info "Consultando a versão mais recente..."
    RELEASE_JSON="$(api_get "${GITHUB_API}/releases/latest")" \
        || die "nao foi possível consultar a API do GitHub (verifique a conexão)"

    TAG="$(printf '%s' "${RELEASE_JSON}" | api_string tag_name || true)"
    [ -n "${TAG}" ] || die "resposta da API nao contem tag_name"
fi

# ---------------------------------------------------------------------------
# Escolha do artefato
# ---------------------------------------------------------------------------

# Padrões de sufixo por familia e arquitetura.
# O Tauri nomeia o .deb como _amd64.deb mas o .rpm como -1.x86_64.rpm,
# então casamos por sufixo em vez de montar o nome exato.
case "${DISTRO_FAMILY}:${ARCH}" in
    debian:amd64)   DEB_PATTERN='_amd64\.deb'   ; RPM_PATTERN='x86_64\.rpm'   ; APP_PATTERN='_amd64\.AppImage'   ;;
    debian:arm64)   DEB_PATTERN='_arm64\.deb'   ; RPM_PATTERN='aarch64\.rpm'  ; APP_PATTERN='_arm64\.AppImage'   ;;
    fedora:amd64)   DEB_PATTERN='_amd64\.deb'   ; RPM_PATTERN='x86_64\.rpm'   ; APP_PATTERN='_amd64\.AppImage'   ;;
    fedora:arm64)   DEB_PATTERN='_arm64\.deb'   ; RPM_PATTERN='aarch64\.rpm'  ; APP_PATTERN='_arm64\.AppImage'   ;;
    *)              DEB_PATTERN='_amd64\.deb'   ; RPM_PATTERN='x86_64\.rpm'   ; APP_PATTERN='_amd64\.AppImage'   ;;
esac

info "Consultando os artefatos de ${TAG}..."
RELEASE_JSON="$(api_get "${GITHUB_API}/releases/tags/${TAG}")" \
    || die "nao foi possível consultar os artefatos de ${TAG}"

# Lista as URLs de download declaradas no JSON.
asset_urls() {
    printf '%s' "${RELEASE_JSON}" | grep -o '"browser_download_url"[[:space:]]*:[[:space:]]*"[^"]*"' \
        | sed 's/.*"[[:space:]]*:[[:space:]]*"//; s/"$//'
}

find_asset() {
    asset_urls | grep -E "$1" | head -n 1 || true
}

case "${DISTRO_FAMILY}" in
    debian) ASSET_URL="$(find_asset "(${DEB_PATTERN})\$")" ;;
    fedora) ASSET_URL="$(find_asset "(${RPM_PATTERN})\$")" ;;
    *)      ASSET_URL="" ;;
esac

# O método de instalação coincide com a familia da distribuição; vira
# "appimage" quando nao ha pacote nativo compatível.
INSTALL_METHOD="${DISTRO_FAMILY}"

# Sem pacote nativo (ou distro nao mapeada), tenta o AppImage.
if [ -z "${ASSET_URL}" ]; then
    if [ "${DISTRO_FAMILY}" != "other" ]; then
        warn "sem pacote nativo para ${DISTRO_NAME} (${ARCH}); usando AppImage"
    else
        info "distribuição nao mapeada (${DISTRO_NAME}); usando AppImage"
    fi
    ASSET_URL="$(find_asset "(${APP_PATTERN})\$")"
    INSTALL_METHOD="appimage"
fi

if [ -z "${ASSET_URL}" ]; then
    error "nenhum artefato compatível encontrado em ${TAG} para ${ARCH}"
    # Lista apenas pacotes Linux; .dmg/.msi/.exe sao de outras plataformas.
    LINUX_ASSETS="$(asset_urls | sed 's#.*/##' | grep -Ei '\.(deb|rpm|appimage)$' || true)"
    if [ -n "${LINUX_ASSETS}" ]; then
        printf '\nArtefatos Linux disponíveis nesta release:\n'
        printf '%s\n' "${LINUX_ASSETS}" | sed 's/^/  - /'
        printf '\n'
    fi
    die "instale manualmente a partir de https://github.com/${REPO}/releases/tag/${TAG}"
fi

ASSET_NAME="${ASSET_URL##*/}"

# ---------------------------------------------------------------------------
# Resumo
# ---------------------------------------------------------------------------

printf '\n%s\n' "${C_BOLD}Presenter ${TAG}${C_RESET}"
printf '  distribuição: %s\n' "${DISTRO_NAME}"
printf '  familia:      %s\n' "${DISTRO_FAMILY}"
printf '  arquitetura:  %s\n' "${ARCH}"
printf '  artefato:     %s\n' "${ASSET_NAME}"
printf '  método:       %s\n' "${INSTALL_METHOD}"
printf '\n'

# ---------------------------------------------------------------------------
# Download
# ---------------------------------------------------------------------------

TMPDIR_CREATED="$(mktemp -d)"
TARGET="${TMPDIR_CREATED}/${ASSET_NAME}"

download() {
    local url="$1" dest="$2"
    if [ "${DOWNLOADER}" = "curl" ]; then
        if [ -t 1 ] && [ "${DRY_RUN}" = false ]; then
            curl -fL --progress-bar -o "${dest}" "$url"
        else
            curl -fsSL -o "${dest}" "$url"
        fi
    else
        if [ -t 1 ] && [ "${DRY_RUN}" = false ]; then
            wget --show-progress --progress=bar:force:noscroll -O "${dest}" "$url"
        else
            wget -q -O "${dest}" "$url"
        fi
    fi
}

info "Baixando ${ASSET_NAME}..."
if [ "${DRY_RUN}" = true ]; then
    run ${DOWNLOADER} -fsSL -o "${TARGET}" "${ASSET_URL}"
else
    download "${ASSET_URL}" "${TARGET}" || die "falha ao baixar ${ASSET_URL}"
    [ -s "${TARGET}" ] || die "arquivo baixado esta vazio"
fi

# ---------------------------------------------------------------------------
# Privilegios
# ---------------------------------------------------------------------------

SUDO=""
if [ "$(id -u)" -ne 0 ]; then
    if ! command -v sudo >/dev/null 2>&1; then
        die "é necessário executar como root ou ter o sudo disponível"
    fi
    SUDO="sudo"
fi

# ---------------------------------------------------------------------------
# Instalação
# ---------------------------------------------------------------------------

confirm() {
    # Sem TTY nao ha como perguntar: presume-se "sim".
    [ -t 0 ] || return 0
    local reply
    printf '%s [s/N] ' "$1"
    read -r reply
    case "${reply}" in
        [sSyY]*) return 0 ;;
        *)       return 1 ;;
    esac
}

# O apt-get so aceita um .deb local na forma "./arquivo.deb", resolvida a partir
# do diretório de trabalho atual. Como o download vive num temporário, o cd
# precisa acontecer dentro da própria invocação.
apt_install() {
    ( cd "${TMPDIR_CREATED}" && ${SUDO} apt-get install -y "./${ASSET_NAME}" )
}

if [ "${INSTALL_METHOD}" = "appimage" ]; then
    APP_DIR="/opt/${PRODUCT}"
    APP_PATH="${APP_DIR}/${PRODUCT}.AppImage"
    BIN_PATH="/usr/local/bin/${PRODUCT}"

    printf '\n'
    if [ -e "${APP_PATH}" ] && [ "${DRY_RUN}" = false ]; then
        if confirm "O Presenter ja esta instalado em ${APP_PATH}. Substituir?"; then
            info "Substituindo a versão existente..."
        else
            info "Cancelado. O Presenter atual foi mantido."
            exit 0
        fi
    fi

    info "Instalando em ${APP_PATH}..."
    run ${SUDO} install -d -m 755 "${APP_DIR}"
    run ${SUDO} install -m 755 "${TARGET}" "${APP_PATH}"
    info "Criando link simbólico em ${BIN_PATH}..."
    run ${SUDO} ln -sf "${APP_PATH}" "${BIN_PATH}"

    INSTALLED_BIN="${BIN_PATH}"
else
    printf '\n'
    # Em dry-run mostramos o comando canônico da familia detectada, sem consultar
    # o sistema: o gerenciador de pacotes local pode nao existir e levaria a
    # exibir o comando errado (ex.: rpm em um Ubuntu).
    if [ "${DRY_RUN}" = true ]; then
        if [ "${INSTALL_METHOD}" = "debian" ]; then
            info "Instalando com apt-get..."
            run_in_dir "${TMPDIR_CREATED}" ${SUDO} apt-get install -y "./${ASSET_NAME}"
        else
            info "Instalando com dnf..."
            run ${SUDO} dnf install -y "${TARGET}"
        fi
    elif [ "${INSTALL_METHOD}" = "debian" ]; then
        # apt-get resolve as dependências (libwebkit2gtk, libgtk-3, etc);
        # dpkg sozinho falharia por dependência nao satisfeita.
        if command -v apt-get >/dev/null 2>&1; then
            info "Instalando com apt-get..."
            apt_install
        else
            warn "apt-get nao encontrado; usando dpkg"
            run ${SUDO} dpkg -i "${TARGET}"
        fi
    else
        if command -v dnf >/dev/null 2>&1; then
            info "Instalando com dnf..."
            run ${SUDO} dnf install -y "${TARGET}"
        else
            warn "dnf nao encontrado; usando rpm"
            run ${SUDO} rpm -Uvh "${TARGET}"
        fi
    fi

    INSTALLED_BIN="$(command -v ${PRODUCT} 2>/dev/null || echo /usr/bin/${PRODUCT})"
fi

# ---------------------------------------------------------------------------
# Conclusão
# ---------------------------------------------------------------------------

printf '\n'
if [ "${DRY_RUN}" = true ]; then
    info "dry-run concluído. Nenhuma alteração foi feita no sistema."
    exit 0
fi

if [ -e "${INSTALLED_BIN}" ]; then
    success "Presenter ${TAG} instalado."
else
    warn "instalação concluida, mas ${INSTALLED_BIN} nao foi encontrado."
    warn "abra um novo terminal e rode: ${PRODUCT} --help"
fi

printf '\n'
printf '  %s\n' "Execute:  ${PRODUCT}"
printf '  %s\n' "Atalhos:  F5 inicia a apresentação, Esc encerra"
printf '  %s\n' "Desinstalar:  sudo apt remove ${PRODUCT}   (ou sudo dnf remove ${PRODUCT})"
printf '\n'
