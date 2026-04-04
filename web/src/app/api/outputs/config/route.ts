import type { RemoteSaveOutputConfigRequestDto } from "../../../_data/repositories/remote-app-data-api-types";
import {
  parseJsonBody,
  errorResponse,
  mutationResultToResponse,
  successResponse,
} from "../../_lib/mock-api-response";
import { requireAdminForMutation, requireViewerReadAccess } from "../../_lib/mock-api-auth";
import { mockAppDataStore } from "../../../../server/mock-data/app-data-store";
import { readStoredAppDataState } from "../../../../server/mock-data/app-data-storage";
import { validateSaveOutputConfigRequest } from "../../../../server/mock-data/app-data-validation";

export const dynamic = "force-dynamic";

export async function GET() {
  const accessFailureResponse = await requireViewerReadAccess();
  if (accessFailureResponse) {
    return accessFailureResponse;
  }

  return successResponse(await mockAppDataStore.getOutputConfig());
}

export async function PATCH(request: Request) {
  const authFailureResponse = await requireAdminForMutation();
  if (authFailureResponse) {
    return authFailureResponse;
  }

  const body = await parseJsonBody<RemoteSaveOutputConfigRequestDto>(request);

  if (!body?.outputConfig) {
    return errorResponse(
      400,
      "invalid_request",
      'Request body must include "outputConfig".'
    );
  }

  const validationResult = validateSaveOutputConfigRequest(
    await readStoredAppDataState(),
    body
  );

  if (!validationResult.ok) {
    return mutationResultToResponse(validationResult);
  }

  return mutationResultToResponse(
    await mockAppDataStore.saveOutputConfig(validationResult.data)
  );
}
