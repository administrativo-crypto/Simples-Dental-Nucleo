import { ISyncRepository } from '../../domain/repositories/ISyncRepository';
import { PatientRecord } from '../../domain/entities/PatientRecord';
import { env } from '../../config/env';
import { logger } from '../logging/Logger';

/**
 * Implementacao concreta de ISyncRepository que envia os dados via HTTP
 * para um endpoint (Edge Function) criado dentro do proprio projeto Lovable.
 *
 * Vantagem sobre falar direto com o banco: nao precisa de service_role key,
 * nao precisa migrar/conectar um Supabase externo — o Lovable Cloud
 * gerenciado ja tem acesso interno ao banco, entao a Edge Function cuida
 * da gravacao. O robo so precisa saber a URL e uma API key simples.
 *
 * Usa fetch nativo do Node (Node 18+), sem dependencia extra.
 */
export class HttpSyncRepository implements ISyncRepository {
  async savePatientRecord(record: PatientRecord): Promise<void> {
    await this.sendBatch([record]);
  }

  /**
   * Envia varios pacientes de uma vez (mais eficiente que 1 requisicao por
   * paciente). PersistPatientRecordsUseCase chama savePatientRecord() por
   * paciente para manter a resiliencia por-paciente; quem quiser enviar tudo
   * de uma vez pode usar este metodo diretamente a partir de main.ts.
   */
  async sendBatch(records: PatientRecord[]): Promise<{ sucesso: number; falhas: number }> {
    if (!env.lovableSync.url || !env.lovableSync.apiKey) {
      throw new Error(
        'LOVABLE_SYNC_URL e LOVABLE_SYNC_API_KEY precisam estar configurados no .env quando ENABLE_LOVABLE_HTTP_SYNC=true.',
      );
    }

    logger.info(`Enviando ${records.length} paciente(s) para o endpoint do Lovable...`);

    const response = await fetch(env.lovableSync.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': env.lovableSync.apiKey,
      },
      body: JSON.stringify(records),
    });

    if (!response.ok) {
      const bodyText = await response.text().catch(() => '');
      throw new Error(
        `Falha ao enviar dados para o Lovable (HTTP ${response.status}): ${bodyText || response.statusText}`,
      );
    }

    const result = (await response.json().catch(() => ({}))) as { sucesso?: number; falhas?: number };
    const sucesso = result.sucesso ?? records.length;
    const falhas = result.falhas ?? 0;

    logger.info(`Endpoint do Lovable respondeu: ${sucesso} sucesso(s), ${falhas} falha(s).`);
    return { sucesso, falhas };
  }
}
