/**
 * Dados completos da ficha individual do paciente.
 */
export interface PatientDetails {
  nome: string;
  cpf?: string;
  dataNascimento?: string;
  telefone?: string;
  email?: string;
  tratamentosAtivos: string[];
  procedimentos: string[];
  observacoes?: string;
}
