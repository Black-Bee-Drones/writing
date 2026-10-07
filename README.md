# Repositório de Publicações - Black Bee Drones

Este repositório é dedicado ao armazenamento, versionamento e revisão dos artigos e publicações técnicas da Black Bee Drones. O objetivo é centralizar a produção de conteúdo utilizando Markdown para garantir o histórico e facilitar a revisão por pares antes da publicação manual em plataformas externas, como o Medium.

## Estrutura do Repositório

O repositório é organizado de forma modular. Cada artigo ou publicação é tratado como um projeto e possui seu próprio diretório isolado dentro da pasta `content/`.

```text
/
├── content/
│   ├── introducao-a-drones-autonomos/
│   │   ├── index.md         # Arquivo-fonte contendo o texto do artigo
│   │   └── assets/          # Imagens (PNG, JPG), gráficos e dependências visuais
│   └── processamento-de-imagens-embarcado/
│       ├── index.md
│       └── assets/
└── README.md
```

Cada diretório de projeto deve conter obrigatoriamente:
- Um arquivo `index.md` com o texto completo do artigo.
- Uma subpasta `assets/` para armazenar todas as mídias referenciadas no respectivo artigo.

## Padrão de Arquivo (Frontmatter)

Para manter o controle de autoria e organização, todo arquivo `index.md` deve iniciar com um bloco de metadados padrão no topo:

```yaml
---
title: "Título descritivo do artigo"
author: "Nome(s) do(s) Autor(es)"
date: "YYYY-MM-DD"
tags: ["drone", "hardware", "ia"]
---
```
O corpo do texto em Markdown deve começar imediatamente abaixo deste bloco.

## Fluxo de Trabalho

Para contribuir com um novo artigo, siga as etapas abaixo:

1. **Ramificação:** Crie uma nova branch a partir da `main` (ex: `post/nome-do-artigo`).
2. **Estrutura:** Crie um novo diretório com o nome do seu artigo dentro da pasta `content/`.
3. **Escrita:** Adicione o arquivo `index.md` com o cabeçalho de metadados e coloque todas as imagens necessárias na pasta `assets/`.
4. **Revisão:** Faça o commit das alterações e abra um Pull Request (PR) para a `main`.
5. **Aprovação e Publicação:** Após a revisão de texto e acurácia técnica feita pelos membros da equipe, o PR passará por merge. O autor ou responsável poderá então copiar o conteúdo validado e publicá-lo na plataforma de destino.