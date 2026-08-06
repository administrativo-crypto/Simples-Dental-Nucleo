/**
 * Uma evolução clínica individual, capturada da aba "Evoluções" do paciente.
 */
export interface EvolutionEntry {
  data?: string;
  hora?: string;
  profissional?: string;
  procedimento?: string;
  texto?: string;
  /** true se a evolução possui imagens/anexos (não baixados nesta etapa). */
  possuiAnexo: boolean;
}
