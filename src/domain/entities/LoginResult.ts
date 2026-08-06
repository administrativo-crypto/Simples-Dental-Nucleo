/**
 * Representa o resultado de uma tentativa de login.
 */
export class LoginResult {
  private constructor(
    public readonly success: boolean,
    public readonly message: string,
  ) {}

  static success(message = 'Login realizado com sucesso.'): LoginResult {
    return new LoginResult(true, message);
  }

  static failure(message: string): LoginResult {
    return new LoginResult(false, message);
  }
}
