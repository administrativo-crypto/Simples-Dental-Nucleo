import { ISyncRepository } from '../../domain/repositories/ISyncRepository';
import { PatientRecord } from '../../domain/entities/PatientRecord';
import { logger } from '../../infrastructure/logging/Logger';

/**
 * Caso de uso: persiste uma lista de PatientRecord ja capturada
 * (normalmente vinda de SyncPatientsUseCase) usando a abstracao
 * ISyncRepository — nao sabe que a implementacao e Supabase.
 *
 * Mesma regra de resiliencia da Sprint 02: um paciente com erro
 * ao gravar nao interrompe a gravacao dos demais.
 */
export class PersistPatientRecordsUseCase {
  constructor(private readonly syncRepository: ISyncRepository) {}

  async execute(records: PatientRecord[]): Promise<{ sucesso: number; falhas: number }> {
    let sucesso = 0;
    let falhas = 0;

    for (const record of records) {
      try {
        await this.syncRepository.savePatientRecord(record);
        sucesso += 1;
        logger.info(`Paciente "${record.paciente.nome}" gravado no Supabase com sucesso.`);
      } catch (error) {
        falhas += 1;
        logger.error(`Falha ao gravar paciente "${record.paciente.nome}" no Supabase. Pulando para o próximo.`, {
          error,
        });
        continue;
      }
    }

    logger.info(`Persistência concluída: ${sucesso} paciente(s) gravado(s), ${falhas} com falha.`);
    return { sucesso, falhas };
  }
}
