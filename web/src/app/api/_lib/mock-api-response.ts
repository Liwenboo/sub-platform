import type { RemoteApiResponseDto } from "../../_data/repositories/remote-app-data-api-types";
import type { AppDataStoreMutationResult } from "../../../server/mock-data/app-data-store-contract";

export async function parseJsonBody<T>(request: Request): Promise<T | null> {
  try {
    return (await request.json()) as T;
  } catch {
    return null;
  }
}

export function successResponse<T>(data: T, status = 200): Response {
  const body: RemoteApiResponseDto<T> = {
    success: true,
    data,
    error: null,
  };

  return Response.json(body, { status });
}

export function errorResponse(
  status: number,
  code: string,
  message: string,
  recoverable = true
): Response {
  const body: RemoteApiResponseDto<null> = {
    success: false,
    data: null,
    error: {
      code,
      message,
      recoverable,
    },
  };

  return Response.json(body, { status });
}

export function mutationResultToResponse<T>(
  result: AppDataStoreMutationResult<T>,
  successStatus = 200
): Response {
  if (!result.ok) {
    return errorResponse(
      result.status,
      result.error.code,
      result.error.message,
      result.error.recoverable
    );
  }

  return successResponse(result.data, successStatus);
}
