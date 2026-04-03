import type { RemoteSetRoleRequestDto } from "../../_data/repositories/remote-app-data-api-types";
import {
  parseJsonBody,
  errorResponse,
  mutationResultToResponse,
  successResponse,
} from "../_lib/mock-api-response";
import { mockAppDataStore } from "../../../server/mock-data/app-data-store";
import { validateSetRoleRequest } from "../../../server/mock-data/app-data-validation";

export const dynamic = "force-dynamic";

export async function GET() {
  return successResponse(await mockAppDataStore.getRole());
}

export async function PATCH(request: Request) {
  const body = await parseJsonBody<RemoteSetRoleRequestDto>(request);

  if (!body?.role) {
    return errorResponse(400, "invalid_request", 'Request body must include "role".');
  }

  const validationResult = validateSetRoleRequest(body);

  if (!validationResult.ok) {
    return mutationResultToResponse(validationResult);
  }

  return mutationResultToResponse(
    await mockAppDataStore.setRole(validationResult.data)
  );
}
