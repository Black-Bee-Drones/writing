# Repositório de Publicações - Black Bee Drones

Este repositório é dedicado ao armazenamento, versionamento e revisão dos artigos e publicações técnicas da Black Bee Drones. O objetivo é centralizar a produção de conteúdo utilizando Markdown para garantir o histórico e facilitar a revisão por pares antes da publicação em plataformas externas, como o Medium.

Para eliminar o trabalho manual de formatação, o repositório possui um **pipeline automático**: a partir do `index.md` de cada artigo, ele gera uma página pronta para **copiar e colar no Medium**, com as imagens já apontando para URLs públicas, blocos de código íntegros e equações convertidas em embeds.

## Sumário

- [Visão geral](#visão-geral)
- [Pré-requisitos e instalação](#pré-requisitos-e-instalação)
- [Estrutura do repositório](#estrutura-do-repositório)
- [Padrão de arquivo (frontmatter)](#padrão-de-arquivo-frontmatter)
- [Fluxo de trabalho](#fluxo-de-trabalho)
- [Como escrever: o que o pipeline converte](#como-escrever-o-que-o-pipeline-converte)
- [Equações](#equações)
- [Comandos](#comandos)
- [Configuração](#configuração)
- [Automação com GitHub Actions](#automação-com-github-actions)
- [Calibração inicial (uma única vez)](#calibração-inicial-uma-única-vez)
- [Limitações do Medium](#limitações-do-medium)
- [Solução de problemas](#solução-de-problemas)
- [Estrutura interna dos scripts](#estrutura-interna-dos-scripts)

## Visão geral

```text
 você escreve                 o pipeline converte                  você publica
┌────────────────┐   merge   ┌──────────────────────────┐  pull   ┌────────────────────┐
│ content/<nome>/│ ────────► │ medium-stories/<nome>/   │ ──────► │ abre index.html,   │
│   index.md     │  (CI)     │   index.html  meta.md    │         │ "Copy for Medium", │
│   assets/      │           └──────────────────────────┘         │ cola no Medium     │
└────────────────┘                                                └────────────────────┘
```

O que é resolvido automaticamente:

| Problema antes | Agora |
|---|---|
| Baixar e subir imagens uma a uma no lugar certo | Caminhos locais viram URLs públicas do GitHub; o Medium baixa as imagens ao colar |
| Blocos de código quebrados em 2 ou 3 pedaços | Linhas em branco dentro do código são protegidas |
| Frontmatter aparecendo ou tendo de ser apagado | É removido do texto e vira um checklist de publicação (`meta.md`) |
| Equações feitas à mão no embed.fun | Detectadas no `.md`; as URLs ficam registradas em `equations.json` |
| Tabelas perdidas na colagem | Viram listas de tópicos |
| Criar pasta, branch e arquivos de um novo artigo | `npm run new -- nome-do-artigo` |

## Pré-requisitos e instalação

- **Node.js 22 ou superior** e Git.
- O repositório precisa ser **público**. O Medium baixa as imagens de `raw.githubusercontent.com`, o que não funciona em repositórios privados (o CI emite um aviso se detectar repositório privado).

```bash
git clone <url-do-repositorio>
cd <repositorio>
npm install
npm test        # deve terminar com todos os testes passando
```

## Estrutura do repositório

```text
/
├── content/                           # VOCÊ escreve aqui
│   └── <nome-do-artigo>/
│       ├── index.md                   # texto do artigo (com frontmatter)
│       ├── assets/                    # imagens, gráficos e outras mídias
│       └── equations.json             # só existe se o artigo tiver equações
│
├── medium-stories/                    # GERADO pelo CI, não edite à mão
│   ├── <nome-do-artigo>/
│   │   ├── index.html                 # página pronta para copiar e colar no Medium
│   │   └── meta.md                    # checklist de publicação (tags, subtítulo, capa...)
│   └── REPORT.md                      # avisos e erros da última geração
│
├── scripts/                           # o pipeline (ver seção final)
├── templates/story/index.md           # modelo usado por `npm run new`
├── test/                              # testes automatizados
├── .github/workflows/                 # automações do GitHub Actions
├── medium.config.json                 # configurações do pipeline
├── package.json
└── README.md
```

Cada diretório de artigo deve conter obrigatoriamente:

- Um arquivo `index.md` com o texto completo do artigo.
- Uma subpasta `assets/` para armazenar todas as mídias referenciadas no artigo.

Pastas locais de teste (`.medium-preview/`) são ignoradas pelo Git. Adicione ao `.gitignore`:

```text
node_modules/
.medium-preview/
```

## Padrão de arquivo (frontmatter)

Todo `index.md` deve iniciar com um bloco de metadados no topo:

```yaml
---
title: "Título descritivo do artigo"
author: "Nome(s) do(s) Autor(es)"
date: "YYYY-MM-DD"
tags: ["drone", "hardware", "ia"]
---
```

O frontmatter serve para **controle interno**: ele **não é publicado**. O pipeline o remove do texto e o transforma em um checklist (`meta.md` e o painel no topo do `index.html` gerado) com título, subtítulo sugerido, tags, imagem de capa e créditos, para você preencher na hora de publicar.

Regras:

- O corpo do texto começa imediatamente abaixo do bloco.
- O Medium aceita **no máximo 5 tags**. Com mais de 5, o build avisa e você escolhe na publicação.
- Se o corpo não tiver um `# Título`, o pipeline usa o `title` do frontmatter (o Medium usa o primeiro `<h1>` como título da história).
- Campo opcional `draft: true` faz o pipeline **ignorar** o artigo enquanto ele não está pronto.
- Qualquer outro campo que você acrescentar aparece no checklist.

## Fluxo de trabalho

Para contribuir com um novo artigo:

1. **Criação:** execute `npm run new -- nome-do-artigo`. Isso cria a branch `story/nome-do-artigo` e a pasta `content/nome-do-artigo/` com `index.md` (a partir do modelo) e `assets/`.
   - *Alternativa:* crie e envie uma branch chamada `story/nome-do-artigo`; o GitHub Actions cria a pasta nela. Nesse caso é preciso dar `git pull` antes de escrever. O comando local é mais rápido e evita esse passo.
2. **Escrita:** edite o `index.md` e coloque as imagens em `assets/`. Veja [Como escrever](#como-escrever-o-que-o-pipeline-converte).
3. **Pré-visualização:** `npm run dev` gera e atualiza a página a cada salvamento em `.medium-preview/<nome>/index.html`. As imagens são lidas do disco, então **não cole essa versão no Medium**.
4. **Equações (se houver):** `npm run equations -- nome-do-artigo` e siga a seção [Equações](#equações).
5. **Revisão:** faça o commit, envie a branch e abra um Pull Request para a `main`. O CI roda os testes e gera uma prévia da página (artefato `medium-stories-preview` na aba *Actions*). A revisão de texto e acurácia técnica continua sendo feita pelos membros da equipe.
6. **Aprovação:** após o merge, o CI regenera tudo e faz o commit de `medium-stories/` na branch principal.
7. **Publicação:** `git pull`, abra `medium-stories/nome-do-artigo/index.html` no navegador, clique em **Copy for Medium** e cole em uma nova história no Medium. Percorra o `meta.md` (tags, subtítulo, capa, créditos).

> **Colar antes do merge:** depois de enviar a branch, rode `npm run paste -- nome-do-artigo`. Ele gera, em `.medium-preview/`, uma página com as URLs das imagens fixadas no seu último commit, que já pode ser colada no Medium. O commit precisa ter sido enviado (`git push`) antes, senão as imagens ainda não existirão no GitHub.

## Como escrever: o que o pipeline converte

Escreva Markdown normalmente. O pipeline cuida de adaptar para o Medium:

| No `index.md` | No Medium |
|---|---|
| `![alt](assets/foto.png)` ou `<div align="center"><img src="assets/foto.png"/></div>` | Imagem com URL pública (espaços e acentos no nome são tratados). **Arquivo inexistente ou com maiúsculas/minúsculas diferentes é erro** |
| Linha **só em itálico** logo após uma imagem | Legenda da imagem |
| Várias `<img>` dentro de uma mesma `<div>` | Imagens separadas (o Medium empilha; arraste-as para formar uma linha no editor) |
| Bloco de código com linhas em branco | Permanece **um único bloco** |
| `$$ ... $$` e `$ ... $` | Embed do embed.fun (ver [Equações](#equações)) |
| `R$ 50`, `US$ 5`, `$` em código ou comentários | Mantidos como texto, não são equações |
| Tabelas | Lista de tópicos: **primeira coluna** — Cabeçalho: valor; ... |
| `##` | Heading do Medium |
| `###`, `####`, `#####`, `######` | Subheading do Medium (o Medium só tem dois níveis) |
| Listas aninhadas | Achatadas em um nível (limitação do Medium) |
| Listas de tarefas (`- [ ]`) | Marcadores removidos |
| `<!-- comentários -->` | Ignorados, inclusive imagens ou equações dentro deles |
| `<sub>` / `<sup>` | Mantidos, mas com aviso: o Medium não tem subscrito/sobrescrito |
| Links relativos (`./outro.md`) | Aviso: não funcionam no Medium |

Convenções úteis:

- Coloque **todas** as imagens em `assets/` e referencie com caminho relativo (`assets/nome.png`). Prefira PNG ou JPG (SVG pode não ser aceito pelo Medium).
- Prefira nomes de arquivo sem espaços e sem acentos (funcionam, mas evitam surpresas).
- Para legendar, escreva a legenda em itálico na linha imediatamente seguinte à imagem:
  ```markdown
  ![Arena](assets/arena.jpg)

  *Arena utilizada no teste de voo.*
  ```
- Comentários como `<!-- IMAGEM A INSERIR -->` são um bom jeito de marcar pendências: o pipeline os ignora.

## Equações

Escreva fórmulas em LaTeX com `$$ ... $$` (o GitHub também as renderiza no próprio repositório):

```markdown
$$
P(t) = K_p \, e(t)
$$
```

O embed.fun só fornece a URL (`https://math.embed.fun/<id>`) depois que você publica a fórmula no site, e não há API pública, então esse único passo é manual. O pipeline automatiza todo o resto:

1. Execute `npm run equations -- nome-do-artigo`. Ele lista as fórmulas sem URL e cria/atualiza `content/nome-do-artigo/equations.json`:
   ```json
   {
     "b4a28b702f": { "latex": "P(t) = K_p \\, e(t)", "url": "" }
   }
   ```
2. Cole cada fórmula em <https://math.embed.fun>, publique e copie a URL gerada.
3. Cole a URL no campo `"url"` da entrada correspondente e faça o commit.

Daí em diante, todo build reaproveita a URL. A chave é um hash da fórmula: se você **editar** a fórmula, a URL antiga é marcada como não usada (remova com `npm run equations -- nome --prune`) e a nova aparece como pendente.

Comportamento:

- Uma fórmula **sem URL não quebra** o build: aparece como `⚠ PENDING EQUATION` no texto gerado e como aviso no relatório.
- No Medium, uma URL sozinha em uma linha vira embed. Se alguma não converter após colar, coloque o cursor no fim da linha e pressione Enter. O `meta.md` lembra disso.
- O Medium não permite matemática "no meio da frase". Uma equação dentro de um parágrafo é movida para um bloco próprio (com aviso). Prefira `$$ ... $$` em linhas separadas.
- **Modo automático alternativo:** com `"equations": "codecogs"` em `medium.config.json`, cada equação vira uma imagem PNG gerada pelo serviço codecogs, sem `equations.json`. A desvantagem é que é uma imagem, não um embed.

## Comandos

| Comando | O que faz |
|---|---|
| `npm run new -- <nome>` | Cria a branch `story/<nome>` e `content/<nome>/` com `index.md` e `assets/` (`--no-branch` cria só a pasta) |
| `npm run dev` | Prévia local que se atualiza ao salvar (saída em `.medium-preview/`) |
| `npm run build:local` | Gera a prévia local uma vez |
| `npm run paste -- <nome>` | Gera a versão **colável no Medium** com URLs fixadas no commit atual (envie o commit antes) |
| `npm run equations -- [nome]` | Lista equações sem URL e mantém o `equations.json` (`--prune` remove entradas sem uso) |
| `npm run build` | Gera `medium-stories/` (normalmente feito pelo CI) |
| `npm run probe` | Gera uma página de teste para calibrar a colagem no Medium (ver calibração) |
| `npm test` | Roda os testes automatizados |

Opções do `build`: `--ref=<sha|branch>`, `--code=nbsp|zwsp|br|none`, `--equations=embedfun|codecogs`, `--tables=list|keep`, `--out=<pasta>`, `--strict` (avisos também falham o build). O código de saída é 1 quando há erros.

**Erros** (falham o build): imagem inexistente, YAML inválido, `equations.json` inválido.
**Avisos** (não falham): fórmula sem URL, mais de 5 tags, imagens lado a lado, `<sub>/<sup>`, links relativos.

## Configuração

Arquivo `medium.config.json`, na raiz:

```json
{
  "imageRef": "main",
  "equations": "embedfun",
  "tables": "list",
  "codeBlankLines": "nbsp"
}
```

| Chave | Padrão | Significado |
|---|---|---|
| `imageRef` | `master` | Branch usada nas URLs das imagens em builds locais. No CI é automaticamente a branch que recebeu o push |
| `equations` | `embedfun` | `embedfun` (URLs do `equations.json`) ou `codecogs` (imagens automáticas) |
| `tables` | `list` | `list` (tabelas viram tópicos) ou `keep` (mantém `<table>`; o Medium vai achatar) |
| `codeBlankLines` | `nbsp` | Como proteger linhas em branco em código: `nbsp`, `zwsp`, `br` ou `none` |
| `branchPrefix` | `story/` | Prefixo das branches de artigo (se mudar, altere também `scaffold-story.yml`) |

## Automação com GitHub Actions

Dois workflows em `.github/workflows/`:

**`build-medium.yml`**

| Evento | O que acontece |
|---|---|
| Pull Request que altera `content/**` ou `scripts/**` | Roda os testes e gera a prévia como artefato `medium-stories-preview`. As imagens apontam para o commit do PR, então a prévia já é colável antes do merge |
| Push (merge) em `main`/`master` | Regenera todos os artigos e faz o commit de `medium-stories/` com a mensagem `chore(medium): rebuild stories [skip ci]`. Se houver erros (ex.: imagem faltando), os artigos válidos ainda são commitados e a execução termina em falha |

O resultado é determinístico: sem mudanças no conteúdo, não há commit. O commit do bot não dispara novo build.

**`scaffold-story.yml`**

Ao enviar uma branch chamada `story/<nome>`, cria `content/<nome>/` com `index.md` e `assets/` e faz o commit na própria branch.

Configurações necessárias no GitHub:

- *Settings → Actions → General → Workflow permissions*: **Read and write permissions** (para o bot fazer commits).
- Se a branch principal for protegida, o bot precisa de permissão para ignorar a proteção, ou o último passo do workflow deve ser trocado por um PR automático.

## Calibração inicial (uma única vez)

Como o Medium se comporta ao colar HTML só pode ser confirmado no próprio Medium, existe uma página de teste:

```bash
npm run probe
```

1. Abra `.medium-preview/_probe/index.html`, clique em **Copy for Medium** e cole em um rascunho descartável no Medium.
2. Verifique:
   - **Código:** das 4 variantes, quais permanecem em um único bloco (a variante `none` reproduz o problema original).
   - **Imagem com legenda:** a imagem foi enviada e a legenda foi mantida?
   - **Embed:** a URL do embed.fun (variante A, texto puro; variante B, link) virou embed sozinha ou só após Enter?
3. Ajuste `codeBlankLines` em `medium.config.json` para a variante vencedora.

Se nenhuma variante resolver os blocos de código, a alternativa é publicar o código como Gist do GitHub e colar a URL do Gist em uma linha própria.

## Limitações do Medium

O pipeline contorna o que é possível, mas o Medium não suporta:

- **Tabelas:** convertidas em listas de tópicos.
- **Matemática no meio do texto:** movida para um bloco próprio.
- **Subscrito/sobrescrito** (`<sub>`, `<sup>`): o texto é colado sem a formatação (`K<sub>p</sub>` vira "Kp").
- **Mais de um nível de lista:** listas aninhadas são achatadas.
- **Imagens lado a lado ao colar:** ficam empilhadas; agrupe-as arrastando no editor.
- **Mais de 5 tags** por história.

## Solução de problemas

| Sintoma | Causa provável e solução |
|---|---|
| Imagens quebradas no Medium | Repositório ainda privado; ou o commit não foi enviado (no caso de `npm run paste`); ou cache do GitHub por alguns minutos |
| `image not found` | Verifique o nome exato: no CI maiúsculas e minúsculas importam (`Foto.PNG` ≠ `foto.png`) |
| `⚠ PENDING EQUATION` no texto | Falta a URL em `equations.json`; rode `npm run equations -- nome` |
| Aviso "cannot determine the GitHub repo" | Adicione um `git remote` ou defina `MEDIUM_REPO=usuario/repositorio` |
| Push do bot rejeitado | Ver permissões em [Automação](#automação-com-github-actions) |
| Pasta sem página gerada | Falta o `index.md`, ou o frontmatter tem `draft: true` |
| Conferir tudo que foi gerado | Leia `medium-stories/REPORT.md` (ou o resumo do job na aba *Actions*) |

## Estrutura interna dos scripts

```text
scripts/
├── new-story.mjs        # npm run new          cria pasta + branch
├── build-medium.mjs     # npm run build        converte um ou todos os artigos
├── equations.mjs        # npm run equations    registra URLs do embed.fun
├── probe.mjs            # npm run probe        página de calibração
└── lib/
    ├── pipeline.mjs     # orquestra as etapas, em ordem
    ├── frontmatter.mjs  # separa e valida o cabeçalho YAML
    ├── protect.mjs      # protege código e comentários da detecção de equações
    ├── math.mjs         # detecta equações e consulta o equations.json
    ├── transforms.mjs   # imagens, legendas, código, tabelas, listas, títulos
    ├── output.mjs       # monta o index.html e o meta.md
    ├── config.mjs       # configurações e detecção do repositório
    ├── util.mjs         # slugify, checagem de arquivo, coletor de avisos
    └── cli.mjs          # leitura de argumentos
```

Ordem das etapas de cada artigo: separar frontmatter → proteger código e comentários → trocar equações por marcadores → Markdown para HTML → sanitizar → ajustes para o Medium (estrutura, imagens, legendas, código) → substituir equações por embeds → gerar `index.html` e `meta.md`.

Para alterar o comportamento, edite o módulo correspondente e rode `npm test`; os testes cobrem, entre outros, o tratamento de `R$`, blocos de código com linhas em branco, nomes de imagem com acentos e o cabeçalho removido.