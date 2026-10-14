import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const SRC_BIN = join(ROOT, "src-tauri", "target", "release", "presenter.exe");
const OUT_DIR = join(ROOT, "portable");

const READ_ME = `Presenter — versão portátil

Como usar
---------
1. Extraia esta pasta em qualquer lugar (pendrive, pasta de rede, desktop).
2. Dê dois cliques em presenter.exe. Não precisa instalar nada.

Requisitos
----------
Windows 10 1803 ou superior (o Microsoft Edge WebView2 Runtime já vem instalado
nessas versões). Se o app não abrir, baixe o runtime em:
https://developer.microsoft.com/microsoft-edge/webview2/

Onde ficam os seus dados
------------------------
Tudo fica na subpasta "app-data", ao lado do presenter.exe:

  app-data\\config.json   monitores marcados
  app-data\\EBWebView\\   preferências do app (tema, sidebars, cronômetro, histórico)

Para levar suas configurações junto, copie a pasta "app-data" inteira.

Apagar o app
------------
Feche o Presenter e apague esta pasta. Nada é gravado no Registro do Windows
nem em %APPDATA% quando o arquivo "portable.txt" está presente.

Se você apagar o arquivo "portable.txt", o presenter volta a usar %APPDATA% e
%LOCALAPPDATA% (comportamento da versão instalada).
`;

function getVersion() {
    return JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")).version;
}

function build() {
    console.log("▸ Compilando o presenter (release, sem instalador)...");
    const npx = process.platform === "win32" ? "npx.cmd" : "npx";
    execFileSync(npx, ["tauri", "build", "--no-bundle"], {
        cwd: ROOT,
        stdio: "inherit",
    });
}

function pack() {
    const version = getVersion();
    const stage = join(OUT_DIR, `presenter-${version}-portavel`);

    console.log("▸ Montando a pasta portátil...");
    rmSync(stage, { recursive: true, force: true });
    mkdirSync(stage, { recursive: true });

    copyFileSync(SRC_BIN, join(stage, "presenter.exe"));
    writeFileSync(join(stage, "portable.txt"), "Marcador do modo portátil do Presenter.\n");
    writeFileSync(join(stage, "LEIA-ME.txt"), READ_ME);

    console.log("▸ Gerando o zip...");
    const zip = join(OUT_DIR, `presenter-${version}-portavel-win-x64.zip`);
    rmSync(zip, { force: true });
    execFileSync(
        "powershell",
        [
            "-NoProfile",
            "-Command",
            `Compress-Archive -Path '${join(stage, "*")}' -DestinationPath '${zip}' -Force`,
        ],
        { stdio: "inherit" },
    );

    console.log(`\n✓ Porta: ${stage}`);
    console.log(`✓ Zip:   ${zip}`);
}

function main() {
    if (process.platform !== "win32") {
        console.error("A versão portátil só é gerada no Windows.");
        process.exit(1);
    }

    const skipBuild = process.argv.includes("--no-build");

    if (!skipBuild) {
        build();
    }

    if (!existsSync(SRC_BIN)) {
        console.error(`Binário não encontrado: ${SRC_BIN}`);
        process.exit(1);
    }

    pack();
}

main();