import { PatientRecord } from '../entities/PatientRecord';

/**
 * Porta (interface) para persistir um registro de paciente.
 * A camada de aplicacao depende apenas desta abstracao — nao sabe
 * (nem precisa saber) que a implementacao concreta usa Supabase.
 * Isso permite trocar Supabase por outro banco no futuro sem tocar
 * em domain/ ou application/.
 */
export interface ISyncRepository {
  savePatientRecord(record: PatientRecord): Promise<void>;
}
