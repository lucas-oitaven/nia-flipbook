# PDF Flipbook — V1

Flipbook estático para GitHub Pages.

- sem backend;
- sem banco de dados;
- HTML/CSS/JavaScript puro;
- PDF.js para abrir/renderizar o PDF;
- StPageFlip para a animação de páginas;
- PDF guardado no próprio repositório.

## Estrutura

```text
pdf-flipbook-v1/
├── index.html
├── css/
│   └── style.css
├── js/
│   └── app.js
└── books/
    └── sample.pdf
```

## Como adicionar seu livro

1. Coloque o PDF dentro de `books/`.
2. Exemplo:

```text
books/fauna-viva.pdf
```

3. Depois de publicar o projeto no GitHub Pages, abra:

```text
https://SEU-USUARIO.github.io/NOME-DO-REPOSITORIO/?book=fauna-viva.pdf
```

Também é possível definir um título só para a interface:

```text
https://SEU-USUARIO.github.io/NOME-DO-REPOSITORIO/?book=fauna-viva.pdf&title=Fauna%20Viva
```

Se `book` não for informado, o site tenta abrir `books/sample.pdf`.

## GitHub Pages

No repositório:

1. Abra **Settings**.
2. Entre em **Pages**.
3. Em **Build and deployment**, escolha **Deploy from a branch**.
4. Selecione a branch `main`.
5. Selecione `/ (root)`.
6. Salve.

Depois do deploy, o GitHub exibirá a URL pública.

## Testar localmente

Não abra `index.html` diretamente com `file://`, porque os módulos JavaScript e o carregamento do PDF dependem de HTTP.

Você pode usar qualquer servidor estático. Com Python:

```bash
python -m http.server 8000
```

Depois:

```text
http://localhost:8000/?book=sample.pdf
```

## Controles

- arrastar a página com mouse;
- swipe no celular;
- botões ← e →;
- teclado ← e →;
- `Home`: primeira página;
- `End`: última página;
- botão de tela cheia.

## Dependências

Carregadas por CDN e com versão fixa:

- `pdfjs-dist` 6.3.289
- `page-flip` 2.0.7

Se você quiser que o projeto funcione também sem internet, baixe essas dependências e substitua as URLs CDN por arquivos locais.

## Observação de desempenho

Nesta V1 todas as páginas são renderizadas no navegador antes de o livro ser liberado para leitura. Isso mantém o código simples e funciona bem para PDFs pequenos/médios.

Para livros fotográficos muito grandes, uma V2 pode implementar cache e renderização sob demanda para reduzir uso de memória e tempo inicial.
