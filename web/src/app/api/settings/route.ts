import type { RemoteSaveSettingsRequestDto } from "../../_data/repositories/remote-app-data-api-types";
import {
  parseJsonBody,
  errorResponse,
  mutationResultToResponse,
  successResponse,
} from "../_lib/mock-api-response";
import { requireAdminForMutation, requireViewerReadAccess } from "../_lib/mock-api-auth";
import { mockAppDataStore } from "../../../server/mock-data/app-data-store";
import { validateSaveSettingsRequest } from "../../../server/mock-data/app-data-validation";

export const dynamic = "force-dynamic";

export async function GET() {
  const accessFailureResponse = await requireViewerReadAccess();
  if (accessFailureResponse) {
    return accessFailureResponse;
  }

  return successResponse(await mockAppDataStore.getSettings());
}

export async function PATCH(request: Request) {
  const authFailureResponse = await requireAdminForMutation();
  if (authFailureResponse) {
    return authFailureResponse;
  }

  const body = await parseJsonBody<RemoteSaveSettingsRequestDto>(request);

  if (!body?.settings) {
    return errorResponse(
      400,
      "invalid_request",
      'Request body must include "settings".'
    );
  }

  const validationResult = validateSaveSettingsRequest(body);

  if (!validationResult.ok) {
    return mutationResultToResponse(validationResult);
  }

  return mutationResultToResponse(
    await mockAppDataStore.saveSettings(validationResult.data)
  );
}
