# Configurar o Firebase (login + banco de dados)

O Meu Saldo guarda os dados de cada pessoa no **Firestore** (banco de dados do Firebase) e usa o
**Firebase Authentication** para o login com e-mail e senha. O app roda no navegador e fala direto
com o Firebase; não existe servidor próprio. Quem protege os dados são as **regras de segurança**
do Firestore (passo 5), então não pule esse passo.

Tudo abaixo é feito uma vez só, no navegador, em <https://console.firebase.google.com> (entre com sua
conta Google). Os nomes dos botões podem variar um pouco conforme o idioma e a versão do console.

## 1. Criar o projeto

1. **Adicionar projeto** (ou *Criar um projeto*) e dê um nome, por exemplo `meu-saldo`.
2. O Google Analytics pode ficar **desativado**; o app não usa.
3. Aguarde terminar e clique em **Continuar**.

## 2. Registrar o app web e pegar as chaves

1. Na página inicial do projeto, clique no ícone **`</>` (Web)**.
2. Apelido: `meu-saldo`. **Não** marque o Firebase Hosting (o site continua no GitHub Pages).
3. Clique em **Registrar app**. O console mostra um bloco `firebaseConfig` parecido com este:

   ```js
   const firebaseConfig = {
     apiKey: "AIza...",
     authDomain: "meu-saldo-xxxx.firebaseapp.com",
     projectId: "meu-saldo-xxxx",
     storageBucket: "...",
     messagingSenderId: "...",
     appId: "1:123...:web:abc..."
   };
   ```

   Você vai usar **`apiKey`, `authDomain`, `projectId` e `appId`** (os outros dois não são necessários).
   Para ver o bloco de novo depois: ⚙️ *Configurações do projeto* › *Seus aplicativos*.

> Essas chaves **não são segredo**: elas só dizem ao navegador qual projeto usar. Quem decide o que cada
> pessoa pode ler ou gravar são as regras do passo 5.

## 3. Ativar o login por e-mail e senha

1. Menu **Criação** (*Build*) › **Authentication** › **Vamos começar**.
2. Aba **Método de login** › **E-mail/senha** › ative o primeiro interruptor (o *link por e-mail* pode
   ficar desligado) › **Salvar**.
3. Aba **Configurações** › **Domínios autorizados** › **Adicionar domínio**:
   `alexandre-gama.github.io`. (`localhost` já vem na lista, e serve para testar no seu computador.)

## 4. Criar o banco de dados Firestore

1. Menu **Criação** › **Firestore Database** › **Criar banco de dados**.
2. Edição **Standard**. ID do banco: deixe `(default)`.
3. Local: **`southamerica-east1` (São Paulo)**. *Atenção: o local não pode ser mudado depois.*
4. Modo: **Iniciar no modo de produção** (nega tudo até você publicar as regras do passo seguinte).
5. **Criar** e aguarde alguns segundos.

## 5. Publicar as regras de segurança

1. Em **Firestore Database**, aba **Regras**.
2. Apague o conteúdo e cole o arquivo [`firestore.rules`](../firestore.rules) deste repositório.
3. **Publicar**. O editor avisa se houver erro de sintaxe.

O que as regras fazem: cada pessoa só lê e grava os documentos que estão em `users/<seu uid>/...`,
e só se os campos tiverem o formato esperado (valor numérico, textos curtos, etc.). Qualquer outro
caminho é negado, inclusive para quem não está logado.

## 6. Rodar no seu computador

1. Copie `.env.example` para `.env.local` e preencha com os quatro valores do passo 2:

   ```
   VITE_FIREBASE_API_KEY=AIza...
   VITE_FIREBASE_AUTH_DOMAIN=meu-saldo-xxxx.firebaseapp.com
   VITE_FIREBASE_PROJECT_ID=meu-saldo-xxxx
   VITE_FIREBASE_APP_ID=1:123...:web:abc...
   ```

2. `npm install` (primeira vez) e `npm run dev`. Abra o endereço mostrado e crie sua conta.

O `.env.local` não vai para o Git (já está no `.gitignore`).

## 7. Publicar no GitHub Pages

O build do GitHub Actions precisa das mesmas quatro variáveis:

1. No GitHub: repositório › **Settings** › **Secrets and variables** › **Actions** › aba **Variables**.
2. **New repository variable**, quatro vezes, com estes nomes e os valores do passo 2:
   `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_APP_ID`.
3. Faça um push na `main` (ou **Actions** › *Deploy to GitHub Pages* › **Run workflow**) para gerar um
   novo build com elas.

Se o site publicado mostrar "Falta configurar o Firebase", é porque o build rodou sem essas variáveis.

## 8. Primeiro acesso e dados antigos

- Crie a conta pela aba **Criar conta** (senha com pelo menos 8 caracteres). Em **Esqueci minha senha**,
  o Firebase manda um e-mail com o link para criar outra.
- Se este navegador tinha lançamentos salvos pela versão anterior do app, aparece um aviso para
  **importar para a sua conta**. Depois de enviados ao servidor, eles são removidos do navegador.
- Se você tem um arquivo de backup das versões antigas: 👤 *Minha conta* › **Importar de um arquivo de backup**.
  Os lançamentos são somados aos da conta; importar o mesmo arquivo duas vezes não duplica nada.
- Ao **sair da conta**, o app também apaga a cópia local dos dados daquele aparelho.

## Como ficam os dados

```
users/{uid}/incomes/{id}          renda       { desc, value, category, date, createdAt, recurringId? }
users/{uid}/expenses/{id}         despesa     { desc, value, category, date, createdAt, recurringId? }
users/{uid}/recurring/{id}        lançamento mensal (repete todo mês)
users/{uid}/budgets/{categoria}   limite mensal da categoria { limit }
```

Para olhar no console: **Firestore Database** › aba **Dados**. O `uid` de cada pessoa aparece em
**Authentication** › **Usuários**.

O Firestore guarda uma cópia no aparelho, então o app abre e aceita lançamentos **sem internet**; as
alterações seguem para o servidor quando a conexão volta, e mudanças feitas em outro aparelho aparecem
sozinhas.

## Custos

O plano gratuito (Spark) tem uma cota diária de leituras e gravações muito acima do que um uso pessoal
gasta. Confira os números atuais em <https://firebase.google.com/pricing>. Em *Uso e faturamento*, no
console, dá para acompanhar o consumo.

## Problemas comuns

| Mensagem / sintoma | Causa e solução |
| --- | --- |
| "Falta configurar o Firebase" | Faltam as variáveis `VITE_FIREBASE_*` (`.env.local` no computador, variáveis do repositório no site publicado). |
| "O Firestore recusou o acesso" / `permission-denied` | As regras do passo 5 não foram publicadas, ou o app tentou gravar algo fora do formato esperado. |
| "O login por e-mail e senha ainda não foi ativado" | Passo 3.2. |
| "Este endereço não está autorizado no Firebase" | Passo 3.3: adicione o domínio onde o app está aberto. |
| Os lançamentos não sincronizam | Veja se o aparelho está online (o app avisa quando não está) e se o banco do passo 4 foi criado. |
