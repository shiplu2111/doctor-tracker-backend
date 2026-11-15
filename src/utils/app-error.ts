export interface AppErrorDetail {
  path: string;
  message: string;
}

export class AppError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly details?: AppErrorDetail[];
  public readonly isOperational: boolean;

  constructor(
    code: string,
    statusCode: number,
    message: string,
    details?: AppErrorDetail[],
    isOperational = true,
  ) {
    super(message);
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    this.isOperational = isOperational;
    Object.setPrototypeOf(this, new.target.prototype);
    Error.captureStackTrace(this, this.constructor);
  }
}
