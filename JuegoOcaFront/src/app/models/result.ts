export class Result<T = void> {
  [x: string]: any;
  success: boolean;
  statusCode: number;
  error: string;
  data: T;

  private constructor(success: boolean, statusCode: number, error: string = null, data: T = null) {
    this.success = success;
    this.error = error;
    this.statusCode = statusCode;
    this.data = data;
  }

  // Método para verificar si la operación fue exitosa
  isSuccess(): boolean {
    return this.success;
  }

  // Método para obtener los datos (si la operación fue exitosa)
  getData(): T | null {
    return this.data;
  }

  // Método para obtener el error (si la operación falló)
  getError(): string | null {
    return this.error;
  }

  // Método para lanzar una excepción si hay un error
  throwIfError() {
    if (!this.success) {
      throw new Error(this.error);
    }
  }

  // Método estático para crear un resultado exitoso
  static success<T = void>(statusCode: number, data: T = null): Result<T> {
    return new Result(true, statusCode, null, data);
  } 

  // Método estático para crear un resultado con error
  static error<T = void>(statusCode: number, error: string = null): Result<T> {
    return new Result(false, statusCode, error);
  } 
}