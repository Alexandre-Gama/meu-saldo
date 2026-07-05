# Meu Saldo

App simples para ver quanto sobra depois da renda e das despesas. Guarda tudo no
armazenamento local do navegador (localStorage) — nenhum dado sai do aparelho.

## Como usar agora mesmo

Abra `index.html` direto no navegador do celular (ou do computador). Já funciona:
adicionar renda/despesa, apagar itens e ver o saldo é 100% local.

## Para instalar como app no celular (ícone na tela, abre sem navegador)

Para o "Instalar app" aparecer e o cache offline funcionar de verdade, o navegador
exige que o site seja servido por **https** (não funciona com duplo clique no
arquivo, isso é uma regra do navegador, não do app). Duas formas simples e
gratuitas de resolver isso, sem precisar de servidor próprio:

- **Netlify Drop**: acesse https://app.netlify.com/drop e arraste esta pasta
  inteira. Você recebe um link https na hora, sem criar conta.
- **GitHub Pages**: crie um repositório, envie estes arquivos e ative o Pages
  nas configurações do repositório.

Depois de abrir o link https no celular:
- **Android/Chrome**: menu (⋮) → "Adicionar à tela inicial" ou "Instalar app".
- **iPhone/Safari**: botão de compartilhar → "Adicionar à Tela de Início".

A partir daí o app abre com ícone próprio, em tela cheia, e funciona sem internet
(o service worker guarda os arquivos em cache no primeiro acesso).

## Arquivos

- `index.html`, `style.css`, `app.js` — a interface e a lógica do app
- `manifest.json` — nome, cores e ícones para instalação
- `sw.js` — service worker que guarda os arquivos em cache para uso offline
- `icons/` — ícones do app
