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

## Sprint 02 — Navegação, leitura de pacientes e evoluções

Depois do login, o robô agora:

1. Abre o menu **Pacientes** e lê a tabela de listagem (com paginação).
2. Para cada paciente, abre a ficha individual e lê seus dados.
3. Abre a aba **Evoluções** e lê todas as evoluções clínicas (registra apenas se há anexos — não baixa nada).
4. Monta um array de objetos JSON e **exibe no console** ao final.

**Nada é gravado em banco de dados nesta etapa** — isso fica para a próxima sprint (sincronização com Supabase).

### Novos arquivos

```
src/
├── domain/entities/
│   ├── PatientListItem.ts     # dados resumidos da tabela de listagem
│   ├── PatientDetails.ts      # dados completos da ficha do paciente
│   ├── EvolutionEntry.ts      # uma evolução clínica
│   └── PatientRecord.ts       # objeto final agregado (o que vira JSON)
├── domain/repositories/
│   └── IPatientRepository.ts  # porta: listPatients() + getPatientDetails()
├── application/use-cases/
│   └── SyncPatientsUseCase.ts # orquestra tudo, NUNCA aborta por 1 erro
├── infrastructure/simplesDental/
│   ├── patients.selectors.ts       # todos os seletores CSS/texto centralizados
│   ├── patients.service.ts         # Passo 1: lista + paginação
│   ├── patientDetails.service.ts   # Passo 2: abre ficha e lê dados
│   ├── evolutions.service.ts       # Passo 3: lê aba de evoluções
│   └── SimplesDentalPatientRepository.ts  # implementa IPatientRepository
└── shared/utils/
    ├── text.ts                 # limpeza/normalização de texto (parser)
    └── playwrightHelpers.ts    # locateFirst() com fallback de seletores
```

### ⚠️ Seletores ainda precisam de ajuste fino

Assim como no login, **não foi possível inspecionar o HTML real** da área logada (é uma SPA e exige autenticação). Todos os seletores de pacientes/ficha/evoluções estão centralizados em `src/infrastructure/simplesDental/patients.selectors.ts`, com múltiplos fallbacks e comentários indicando o que ajustar.

Fluxo recomendado para calibrar:
```bash
npx playwright codegen https://app.simplesdental.com/
```
Faça login manualmente, abra Pacientes → clique em um paciente → abra a aba Evoluções, e copie os seletores reais gravados para dentro de `patients.selectors.ts`.

### Testando com segurança

Use `SIMPLES_DENTAL_MAX_PATIENTS=3` no `.env` para processar só os 3 primeiros pacientes durante os testes, evitando rodar contra a base inteira enquanto os seletores ainda não estão calibrados.

### Resiliência

`SyncPatientsUseCase` captura o erro de cada paciente individualmente — se um falhar (ficha não abre, campo não encontrado, etc.), o erro é logado (`logs/error.log`) e a sincronização **continua para o próximo paciente**, nunca aborta o processo inteiro.

## Sprint 03 — Sincronização com Supabase

Com `ENABLE_SUPABASE_SYNC=true` no `.env`, depois de ler todos os pacientes o robô também **grava** os dados no Supabase. Com `false` (padrão), ele continua se comportando como na Sprint 02: só lê e mostra o JSON no console.

### Configurar

1. Crie um projeto em [supabase.com](https://supabase.com) (ou use um existente).
2. No **SQL Editor**, rode o script `supabase/schema.sql` deste projeto — ele cria as tabelas `patients` e `evolutions`.
3. Em **Project Settings → API**, copie a **URL** do projeto e a **service_role key** (não a `anon` — a service role é necessária para gravar dados a partir de um script de backend, e ignora RLS).
4. No `.env`:
   ```env
   ENABLE_SUPABASE_SYNC=true
   SUPABASE_URL=https://SEU_PROJETO.supabase.co
   SUPABASE_SERVICE_KEY=sua_service_role_key
   ```

⚠️ **A `service_role key` dá acesso total ao seu banco, ignorando qualquer regra de segurança.** Nunca a exponha em código de frontend, nunca a commite. Ela só deve existir no `.env` local e nos **Secrets** do GitHub Actions (veja abaixo).

### Estratégia de gravação (idempotência)

- **Pacientes**: `upsert` por `cpf` (chave única) — rodar a sincronização várias vezes não duplica pacientes, apenas atualiza.
- **Evoluções**: como o scraping não tem um ID estável por evolução, a cada sincronização o robô **apaga as evoluções antigas daquele paciente e insere a lista atual completa**. Simples e evita duplicatas, ao custo de recriar os IDs a cada rodada.
- **Resiliência**: se a gravação de um paciente falhar (ex: sem CPF capturado), o erro é logado e a gravação **continua para o próximo** — nunca aborta tudo.

### Novos arquivos

```
supabase/
└── schema.sql                          # tabelas patients + evolutions

src/
├── domain/repositories/
│   └── ISyncRepository.ts              # porta: savePatientRecord()
├── application/use-cases/
│   └── PersistPatientRecordsUseCase.ts # persiste a lista, resiliente a falhas
└── infrastructure/supabase/
    ├── SupabaseClientFactory.ts        # cria o client com a service_role key
    └── SupabaseSyncRepository.ts       # implementa ISyncRepository (upsert + replace)
```

### Rodando com o GitHub Actions

Se for usar o workflow agendado (`.github/workflows/login-diario.yml`), adicione os mesmos secrets usados localmente:

- `SUPABASE_URL` (pode ser uma **Variable**, não é segredo)
- `SUPABASE_SERVICE_KEY` (deve ser um **Secret**)

E inclua essas linhas no passo "Criar .env a partir dos Secrets" do workflow:
```yaml
echo "ENABLE_SUPABASE_SYNC=true" >> .env
echo "SUPABASE_URL=${{ vars.SUPABASE_URL }}" >> .env
echo "SUPABASE_SERVICE_KEY=${{ secrets.SUPABASE_SERVICE_KEY }}" >> .env
```

## Próximos passos (fora do escopo deste projeto)

- Testes automatizados (unitários para `domain`/`application`, e2e para `infrastructure`).
- Deduplicação mais robusta de evoluções (ex: hash do conteúdo em vez de "apagar e reinserir").
- Alertas (e-mail/Slack) quando a taxa de falhas por paciente passar de um limite.
