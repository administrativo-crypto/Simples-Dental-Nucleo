import { Credentials } from '../../domain/entities/Credentials';
import { LoginResult } from '../../domain/entities/LoginResult';
import { IAuthRepository } from '../../domain/repositories/IAuthRepository';

/**
 * Caso de uso: efetuar login no Simples Dental.
 * Depende apenas da abstracao IAuthRepository (Dependency Inversion),
 * nao conhece detalhes de Playwright, HTML ou seletores.
 */
export class LoginUseCase {
  constructor(private readonly authRepository: IAuthRepository) {}

  async execute(username: string, password: string): Promise<LoginResult> {
    const credentials = Credentials.create(username, password);
    return this.authRepository.login(credentials);
  }
}
