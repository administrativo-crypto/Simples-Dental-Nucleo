import { PatientDetails } from './PatientDetails';
import { EvolutionEntry } from './EvolutionEntry';

/**
 * Objeto final, agregado, no formato que sera exibido como JSON no console.
 * Corresponde ao "JSON esperado" da Sprint 02.
 */
export interface PatientRecord {
  paciente: PatientDetails;
  tratamentos: string[];
  evolucoes: EvolutionEntry[];
}
