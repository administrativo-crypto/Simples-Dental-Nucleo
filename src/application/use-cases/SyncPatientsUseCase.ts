import { IPatientRepository } from '../../domain/repositories/IPatientRepository';
import { PatientRecord } from '../../domain/entities/PatientRecord';
import { logger } from '../../infrastructure/logging/Logger';

/**
 * Caso de uso: percorre todos os pacientes, le ficha + evolucoes de cada um,
 * e retorna a lista de registros em formato de dominio (pronto para virar JSON).
 *
 * IMPORTANTE: nesta sprint NAO grava nada em banco de dados. Apenas retorna
 * os dados em memoria para quem chamou (main.ts) exibir/usar.
 *
 * Regra de resiliencia: se um paciente falhar (ficha nao abre, campo nao
 * encontrado, etc.), o erro e logado e a sincronizacao continua para o
 * proximo paciente — nunca aborta o processo inteiro por causa de um so.
 */
export class SyncPatientsUseCase {
  constructor(private readonly patientRepository: IPatientRepository) {}

  async execute(): Promise<PatientRecord[]> {
    const patients = await this.patientRepository.listPatients();
    logger.info(`Iniciando leitura de ${patients.length} paciente(s).`);

    const records: PatientRecord[] = [];
    let sucesso = 0;
    let falhas = 0;

    for (const patient of patients) {
      try {
        logger.info(`Abrindo ficha do paciente: ${patient.nome}`);
        const { details, evolucoes } = await this.patientRepository.getPatientDetails(patient);

        records.push({
          paciente: details,
          tratamentos: details.tratamentosAtivos,
          evolucoes,
        });

        sucesso += 1;
        logger.info(`Paciente "${patient.nome}" processado com sucesso (${evolucoes.length} evolução(ões)).`);
      } catch (error) {
        falhas += 1;
        logger.error(`Falha ao processar o paciente "${patient.nome}". Pulando para o próximo.`, { error });
        continue;
      }
    }

    logger.info(`Sincronização concluída: ${sucesso} paciente(s) com sucesso, ${falhas} com falha.`);
    return records;
  }
}
