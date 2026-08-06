import { PatientListItem } from '../entities/PatientListItem';
import { PatientDetails } from '../entities/PatientDetails';
import { EvolutionEntry } from '../entities/EvolutionEntry';

/**
 * Porta (interface) que define o contrato de navegacao/leitura de pacientes.
 * A camada de aplicacao depende apenas desta abstracao, nunca do Playwright.
 */
export interface IPatientRepository {
  /** Le a tabela de listagem de pacientes (menu "Pacientes"). */
  listPatients(): Promise<PatientListItem[]>;

  /**
   * Abre a ficha de um paciente especifico, le seus dados e a aba de
   * Evolucoes. Retorna os dois em conjunto porque, na navegacao real,
   * ambos sao lidos na mesma "visita" a ficha do paciente (evita abrir
   * a ficha duas vezes).
   */
  getPatientDetails(
    patient: PatientListItem,
  ): Promise<{ details: PatientDetails; evolucoes: EvolutionEntry[] }>;
}
