# Instalação no Linux via curl

O Presenter pode ser instalado no Linux com um único comando, sem baixar e abrir
instaladores manualmente.

## Requisito

O script precisa do **bash**. Não funciona com `sh`, que em Debian e Ubuntu é um
link simbólico para o `dash` — o dash não suporta `pipefail` nem o quoting
ANSI-C usados pelo instalador.

Todos os sistemas Linux com bash instalado atendem ao requisito. Caso o `bash`
não esteja disponível, instale-o antes (`sudo apt install bash` no Debian/Ubuntu,
`sudo dnf install bash` no Fedora).

## Comando

```sh
curl -fsSL https://raw.githubusercontent.com/silv4b/presenter/develop/install.sh | bash
```

## O que acontece

1. Baixa o `install.sh` da branch `develop` e o executa com o bash.
2. Detecta a distribuição lendo `/etc/os-release` e a arquitetura com `uname -m`.
3. Consulta a API do GitHub para descobrir a versão mais recente publicada.
4. Baixa o artefato correspondente e instala.

O script exibe um resumo da detecção antes de instalar:

```
Presenter v1.3.0
  distribuição: Ubuntu 24.04.5 LTS
  família:      debian
  arquitetura:  amd64
  artefato:     presenter_1.3.0_amd64.deb
  método:       debian
```

## Formatos por distribuição

| Distribuição | Artefato | Instalação |
| --- | --- | --- |
| Debian, Ubuntu, Linux Mint, Pop!_OS | `.deb` | `apt-get install` |
| Fedora, RHEL, CentOS | `.rpm` | `dnf install` |
| Arch, openSUSE e demais | `.AppImage` | `/opt/presenter` + symlink em `/usr/local/bin` |

As dependências de sistema (`libwebkit2gtk`, `libgtk-3`, etc.) são resolvidas
automaticamente pelo `apt-get` ou pelo `dnf`, conforme o caso. No caminho
AppImage, não há dependência de gerenciador de pacotes.

## Opções

Inspecionar o que seria feito, sem alterar o sistema:

```sh
curl -fsSL https://raw.githubusercontent.com/silv4b/presenter/develop/install.sh | bash -s -- --dry-run
```

Instalar uma versão específica:

```sh
curl -fsSL https://raw.githubusercontent.com/silv4b/presenter/develop/install.sh | bash -s -- --version v1.3.0
```

Ver a ajuda completa:

```sh
curl -fsSL https://raw.githubusercontent.com/silv4b/presenter/develop/install.sh | bash -s -- --help
```

Repare no `--` antes das opções. Ele separa os argumentos do script dos
argumentos do próprio shell.

## Atualização

Não há auto-update embutido no aplicativo. Para atualizar, basta reexecutar o
comando de instalação: o script busca a versão mais recente e substitui a
instalada.

## Desinstalação

```sh
# Debian/Ubuntu
sudo apt remove presenter

# Fedora/RHEL
sudo dnf remove presenter

# AppImage
sudo rm /usr/local/bin/presenter /opt/presenter/presenter.AppImage
```

## Notas

- **Ubuntu/Debian:** o `apt-get` só aceita um `.deb` local na forma
  `./arquivo.deb`, relativo ao diretório de trabalho. O instalador executa o
  comando dentro do diretório temporário do download por esse motivo.
- **Rate limit da API:** a API pública do GitHub permite 60 requisições por hora
  por IP. Se encontrar `403`, exporte `GITHUB_TOKEN` antes de rodar o comando.
- **`NO_COLOR`:** defina `NO_COLOR=1` para desativar as cores na saída.
- **Falhas de permissão:** a instalação exige privilégios de administrador. O
  script usa `sudo` quando executado por usuário comum e funciona diretamente
  quando executado como root.

## Alternativa: baixa manual

Quem preferir baixar o arquivo antes de executar:

```sh
curl -fsSLO https://raw.githubusercontent.com/silv4b/presenter/develop/install.sh
chmod +x install.sh
./install.sh
```

Os artefatos também estão disponíveis diretamente na página de releases:
<https://github.com/silv4b/presenter/releases>
