import winston from 'winston';
import path from 'path';
import fs from 'fs';
import { env } from '../../config/env';

if (!fs.existsSync(env.log.dir)) {
  fs.mkdirSync(env.log.dir, { recursive: true });
}

const { combine, timestamp, printf, colorize, errors } = winston.format;

const logFormat = printf((info) => {
  const { level, message, timestamp: ts, stack, ...meta } = info;
  let extra = '';

  // Se algum callsite passou logger.error('msg', { error }), extrai a
  // mensagem/stack real do erro em vez de deixar ela invisivel — sem
  // isso, o log so mostra a mensagem generica e some com a causa raiz.
  const metaError = (meta as Record<string, unknown>).error;
  if (metaError instanceof Error) {
    extra = ` | causa: ${metaError.stack ?? metaError.message}`;
  } else if (metaError) {
    extra = ` | causa: ${JSON.stringify(metaError)}`;
  }

  return `[${ts}] ${level}: ${stack ?? message}${extra}`;
});

/**
 * Logger central da aplicacao.
 * Grava em arquivo (logs/app.log e logs/error.log) e no console.
 */
export const logger = winston.createLogger({
  level: env.log.level,
  format: combine(errors({ stack: true }), timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), logFormat),
  transports: [
    new winston.transports.File({
      filename: path.join(env.log.dir, 'error.log'),
      level: 'error',
    }),
    new winston.transports.File({
      filename: path.join(env.log.dir, 'app.log'),
    }),
    new winston.transports.Console({
      format: combine(colorize(), timestamp({ format: 'HH:mm:ss' }), logFormat),
    }),
  ],
});
