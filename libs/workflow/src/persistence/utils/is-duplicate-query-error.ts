import { QueryFailedError } from 'typeorm';

interface QueryDriverError {
  code?: string;
}

export function isDuplicateQueryError(
  error: unknown,
): error is QueryFailedError & { driverError: QueryDriverError } {
  if (!(error instanceof QueryFailedError)) {
    return false;
  }

  const driverError = error.driverError as QueryDriverError | undefined;

  if (
    typeof driverError !== 'object' ||
    driverError === null ||
    !('code' in driverError)
  ) {
    return false;
  }

  return true;
}

export function isDuplicateKeyError(error: unknown): boolean {
  if (!isDuplicateQueryError(error)) {
    return false;
  }

  return (
    error.driverError.code === 'ER_DUP_ENTRY' ||
    error.driverError.code === '23505'
  );
}
