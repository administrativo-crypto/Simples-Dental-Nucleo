# Simples Dental Login (Playwright + TypeScript + Clean Architecture)

Automação de **login** no Simples Dental. Sincronização de dados **não** foi implementada — este projeto cobre apenas a etapa de autenticação, servindo de base para funcionalidades futuras.

## Estrutura (Clean Architecture)

```
src/
├── config/                 # Carregamento e validação do .env
│   └── env.ts
├── domain/                 # Regras de negócio puras, sem dependências externas
│   ├── entities/
│   │   ├── Credentials.ts
│   │   └── LoginResult.ts
│   └── repositories/
│       └── IAuthRepository.ts   # Interface (porta) de autenticação
├── application/             # Casos de uso — orquestram o domínio via interfaces
│   └── use-cases/
│       └── LoginUseCase.ts
├── infrastructure/          # Implementações concretas (detalhes técnicos)
│   ├── browser/
│   │   └── BrowserFactory.ts     # Cria/fecha o navegador Playwright
│   ├── logging/
│   │   └── Logger.ts             # Logger (winston) -> console + arquivos
│   └── auth/
│       └── SimplesDentalAuthRepository.ts  # Implementa IAuthRepository com Playwright
├── shared/
│   └── errors/
│       └── AuthenticationError.ts
└── main.ts                  # Composition root (liga todas as camadas)
```

A regra de dependência é respeitada: `domain` não conhece `infrastructure`; `application` depende apenas das interfaces do `domain`; `infrastructure` implementa essas interfaces; `main.ts` é o único lugar que "conecta" tudo.

## Instalação

```bash
npm install
```

O `postinstall` já baixa o Chromium usado pelo Playwright. Se quiser instalar manualmente:

```bash
npx playwright install chromium
```

## Configuração

```bash
cp .env.example .env
```

Edite o `.env` com suas credenciais:

```env
SIMPLES_DENTAL_LOGIN_URL=https://app.simplesdental.com/
SIMPLES_DENTAL_USERNAME=seu_usuario_ou_email
SIMPLES_DENTAL_PASSWORD=sua_senha
BROWSER_HEADLESS=false
```

> Rode com `BROWSER_HEADLESS=false` na primeira vez para ver o navegador e confirmar visualmente que o login funciona.

## Executando

```bash
npm run dev      # roda direto com ts-node
# ou
npm run build && npm start
```

## ⚠️ Ajuste dos seletores (importante)

O Simples Dental é uma SPA (renderizada via JavaScript), então não é possível "ler" o HTML da tela de login sem executar o navegador. Os seletores em `src/infrastructure/auth/SimplesDentalAuthRepository.ts` (objeto `SELECTORS`) são palpites baseados em padrões comuns de formulários de login e possuem múltiplos fallbacks, mas **provavelmente vão precisar de ajuste fino**.

Para descobrir os seletores reais, use o gerador de código do Playwright:

```bash
npx playwright codegen https://app.simplesdental.com/
```

Isso abre um navegador onde você faz o login manualmente, e o Playwright grava o código com os seletores exatos usados na página. Copie os seletores corretos para dentro de `SELECTORS` em `SimplesDentalAuthRepository.ts` (campos `usernameInput`, `passwordInput`, `submitButton`, `loggedInIndicator`, `errorMessage`).

## Logs

Os logs são gravados em `logs/app.log` (todos os níveis) e `logs/error.log` (apenas erros), além de aparecerem no console. Nível configurável via `LOG_LEVEL` no `.env`.

## Sessão persistida

Após um login bem-sucedido, os cookies/estado da sessão são salvos em `storage/session.json` (caminho configurável via `STORAGE_STATE_PATH`). Isso permitirá, em uma etapa futura, reaproveitar a sessão sem repetir o login a cada execução.

## Rodando automaticamente todo dia (GitHub Actions)

O projeto já inclui `.github/workflows/login-diario.yml`, configurado para rodar **todo dia às 8h (horário de Brasília)**.

Passos para ativar:

1. Suba este projeto para um repositório no GitHub (pode ser **privado**).
2. No repositório, vá em **Settings → Secrets and variables → Actions → Secrets** e crie:
   - `SIMPLES_DENTAL_USERNAME`
   - `SIMPLES_DENTAL_PASSWORD`
3. (Opcional) Em **Variables**, crie `SIMPLES_DENTAL_LOGIN_URL` se quiser sobrescrever a URL padrão.
4. Pronto — o workflow roda sozinho no horário definido. Você também pode disparar manualmente em **Actions → Login Simples Dental (diário) → Run workflow**.
5. Os logs de cada execução ficam disponíveis como *artifact* na aba **Actions**, mesmo se o login falhar.

Para mudar o horário, edite a linha `cron: '0 11 * * *'` no arquivo do workflow (o valor é em **UTC**; Brasília é UTC-3 o ano todo, já que não há mais horário de verão no Brasil).

> Nota: como a sessão (`storage/session.json`) é salva dentro do runner do GitHub Actions, ela **não persiste** entre execuções (cada run começa do zero). Isso é esperado para a etapa de login — quando a sincronização for implementada, vale considerar salvar esse estado em algum storage externo (ex: repositório, bucket) se quiser reaproveitar a sessão entre execuções.

## Próximos passos (fora do escopo deste projeto)

- Implementar a sincronização de dados (pacientes, agenda, etc.) como novos casos de uso na camada `application`, reaproveitando a sessão autenticada.
- Testes automatizados (unitários para `domain`/`application`, e2e para `infrastructure`).
