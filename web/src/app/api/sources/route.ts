import type { RemoteCreateSourceRequestDto } from "../../_data/repositories/remote-app-data-api-types";
import {
  parseJsonBody,
  errorResponse,
  mutationResultToResponse,
  successResponse,
} from "../_lib/mock-api-response";
import { requireAdminForMutation, requireViewerReadAccess } from "../_lib/mock-api-auth";
import { mockAppDataStore } from "../../../server/mock-data/app-data-store";
import { readStoredAppDataState } from "../../../server/mock-data/app-data-storage";
import { validateCreateSourceRequest } from "../../../server/mock-data/app-data-validation";

export const dynamic = "force-dynamic";

export async function GET() {
  const accessFailureResponse = await requireViewerReadAccess();
  if (accessFailureResponse) {
    return accessFailureResponse;
  }

  return successResponse(await mockAppDataStore.listSources());
}

export async function POST(request: Request) {
  const authFailureResponse = await requireAdminForMutation();
  if (authFailureResponse) {
    return authFailureResponse;
  }

  const body = await parseJsonBody<RemoteCreateSourceRequestDto>(request);

  if (!body?.source) {
    return errorResponse(400, "invalid_request", 'Request body must include "source".');
  }

  const validationResult = validateCreateSourceRequest(
    await readStoredAppDataState(),
    body
  );

  if (!validationResult.ok) {
    return mutationResultToResponse(validationResult);
  }

  return mutationResultToResponse(
    await mockAppDataStore.createSource(validationResult.data),
    201
  );
}
