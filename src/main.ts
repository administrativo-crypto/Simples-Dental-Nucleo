import { env } from './config/env';
import { logger } from './infrastructure/logging/Logger';
import { BrowserFactory } from './infrastructure/browser/BrowserFactory';
import { SimplesDentalAuthRepository } from './infrastructure/auth/SimplesDentalAuthRepository';
import { LoginUseCase } from './application/use-cases/LoginUseCase';
import { SimplesDentalPatientRepository } from './infrastructure/simplesDental/SimplesDentalPatientRepository';
import { SyncPatientsUseCase } from './application/use-cases/SyncPatientsUseCase';
import { PersistPatientRecordsUseCase } from './application/use-cases/PersistPatientRecordsUseCase';
import { createSupabaseClient } from './infrastructure/supabase/SupabaseClientFactory';
import { SupabaseSyncRepository } from './infrastructure/supabase/SupabaseSyncRepository';
import { HttpSyncRepository } from './infrastructure/http/HttpSyncRepository';

/**
 * Composition root: aqui e onde as camadas sao "conectadas".
 * O dominio e a aplicacao nao sabem que estao usando Playwright;
 * apenas essa funcao sabe disso.
 */
async function main(): Promise<void> {
  const browserFactory = new BrowserFactory();

  try {
    const context = await browserFactory.launch();
    const authRepository = new SimplesDentalAuthRepository(context);
    const loginUseCase = new LoginUseCase(authRepository);

    const result = await loginUseCase.execute(
      env.simplesDental.username,
      env.simplesDental.password,
    );

    if (!result.success) {
      logger.error(`✘ Falha no login: ${result.message}`);
      process.exitCode = 1;
      return;
    }

    logger.info(`✔ ${result.message}`);

    // Abre uma nova aba dentro do MESMO contexto autenticado (reaproveita a
    // sessao/cookies do login, sem precisar logar de novo) e navega para a
    // area logada antes de acessar o menu de Pacientes.
    const patientsPage = await context.newPage();
    await patientsPage.goto(env.simplesDental.loginUrl, { waitUntil: 'domcontentloaded' });

    const patientRepository = new SimplesDentalPatientRepository(patientsPage);
    const syncPatientsUseCase = new SyncPatientsUseCase(patientRepository);

    logger.info('Iniciando navegação em Pacientes...');
    const records = await syncPatientsUseCase.execute();

    // Nesta etapa o robo apenas navega e le os dados — a gravacao no
    // Supabase (se habilitada) acontece depois, como um passo separado.
    console.log('\n===== JSON DOS PACIENTES =====\n');
    console.log(JSON.stringify(records, null, 2));
    console.log(`\n===== Total de registros lidos: ${records.length} =====\n`);

    if (env.lovableSync.enabled) {
      // Caminho recomendado: envia via HTTP para uma Edge Function dentro
      // do proprio projeto Lovable. Nao exige service_role key nem
      // migracao de backend — o Lovable Cloud grava internamente.
      logger.info('ENABLE_LOVABLE_HTTP_SYNC=true — enviando dados para o Lovable via HTTP...');
      const httpRepository = new HttpSyncRepository();
      const persistResult = await httpRepository.sendBatch(records);
      logger.info(`Lovable confirmou: ${persistResult.sucesso} sucesso(s), ${persistResult.falhas} falha(s).`);
    } else if (env.supabase.enabled) {
      // Caminho alternativo: gravacao direta em um projeto Supabase externo
      // conectado (exige SUPABASE_URL + SUPABASE_SERVICE_KEY).
      logger.info('ENABLE_SUPABASE_SYNC=true — iniciando gravação no Supabase...');
      const supabaseClient = createSupabaseClient();
      const syncRepository = new SupabaseSyncRepository(supabaseClient);
      const persistUseCase = new PersistPatientRecordsUseCase(syncRepository);
      await persistUseCase.execute(records);
    } else {
      logger.info('Nenhum destino de sincronização habilitado — pulando gravação (apenas leitura/console).');
    }

    process.exitCode = 0;
  } catch (error) {
    logger.error('Erro fatal na execucao.', { error });
    process.exitCode = 1;
  } finally {
    await browserFactory.close();
  }
}

main();
