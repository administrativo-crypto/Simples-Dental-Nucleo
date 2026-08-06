import { SupabaseClient } from '@supabase/supabase-js';
import { ISyncRepository } from '../../domain/repositories/ISyncRepository';
import { PatientRecord } from '../../domain/entities/PatientRecord';
import { logger } from '../logging/Logger';

/**
 * Implementacao concreta de ISyncRepository usando Supabase.
 *
 * Estrategia de idempotencia:
 * - patients: upsert por "cpf" (chave unica na tabela). Rodar a
 *   sincronizacao varias vezes NAO duplica pacientes.
 * - evolutions: como o Simples Dental nao fornece um ID estavel para
 *   cada evolucao neste scraping, a estrategia mais simples e segura e
 *   apagar as evolucoes anteriores daquele paciente e reinserir a lista
 *   atual completa a cada sincronizacao. Isso evita duplicatas sem
 *   precisar de un unique constraint complexo (data+hora+profissional
 *   nem sempre e suficiente para deduplicar com seguranca).
 */
export class SupabaseSyncRepository implements ISyncRepository {
  constructor(private readonly client: SupabaseClient) {}

  async savePatientRecord(record: PatientRecord): Promise<void> {
    const patientId = await this.upsertPatient(record);
    await this.replaceEvolutions(patientId, record);
  }

  private async upsertPatient(record: PatientRecord): Promise<string> {
    const { paciente } = record;

    if (!paciente.cpf) {
      throw new Error(
        `Paciente "${paciente.nome}" nao possui CPF capturado — nao e possivel fazer upsert sem uma chave unica.`,
      );
    }

    const { data, error } = await this.client
      .from('patients')
      .upsert(
        {
          cpf: paciente.cpf,
          nome: paciente.nome,
          data_nascimento: paciente.dataNascimento ?? null,
          telefone: paciente.telefone ?? null,
          email: paciente.email ?? null,
          observacoes: paciente.observacoes ?? null,
          tratamentos_ativos: paciente.tratamentosAtivos ?? [],
          procedimentos: paciente.procedimentos ?? [],
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'cpf' },
      )
      .select('id')
      .single();

    if (error || !data) {
      throw new Error(`Falha ao gravar paciente "${paciente.nome}" no Supabase: ${error?.message}`);
    }

    return data.id as string;
  }

  private async replaceEvolutions(patientId: string, record: PatientRecord): Promise<void> {
    const { error: deleteError } = await this.client
      .from('evolutions')
      .delete()
      .eq('patient_id', patientId);

    if (deleteError) {
      throw new Error(`Falha ao limpar evoluções antigas do paciente: ${deleteError.message}`);
    }

    if (record.evolucoes.length === 0) {
      return;
    }

    const rows = record.evolucoes.map((evolucao) => ({
      patient_id: patientId,
      data: evolucao.data ?? null,
      hora: evolucao.hora ?? null,
      profissional: evolucao.profissional ?? null,
      procedimento: evolucao.procedimento ?? null,
      texto: evolucao.texto ?? null,
      possui_anexo: evolucao.possuiAnexo,
    }));

    const { error: insertError } = await this.client.from('evolutions').insert(rows);
    if (insertError) {
      throw new Error(`Falha ao gravar evoluções: ${insertError.message}`);
    }

    logger.info(`${rows.length} evolução(ões) gravada(s) para o paciente "${record.paciente.nome}".`);
  }
}
