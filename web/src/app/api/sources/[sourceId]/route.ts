import type { RemoteUpdateSourceRequestDto } from "../../../_data/repositories/remote-app-data-api-types";
import {
  parseJsonBody,
  errorResponse,
  mutationResultToResponse,
} from "../../_lib/mock-api-response";
import { mockAppDataStore } from "../../../../server/mock-data/app-data-store";
import { validateUpdateSourceRequest } from "../../../../server/mock-data/app-data-validation";

export const dynamic = "force-dynamic";

type SourceRouteContext = {
  params: Promise<{
    sourceId: string;
  }>;
};

export async function PATCH(request: Request, context: SourceRouteContext) {
  const { sourceId } = await context.params;
  const body = await parseJsonBody<RemoteUpdateSourceRequestDto>(request);

  if (!body?.source) {
    return errorResponse(400, "invalid_request", 'Request body must include "source".');
  }

  const validationResult = validateUpdateSourceRequest(sourceId, body);

  if (!validationResult.ok) {
    return mutationResultToResponse(validationResult);
  }

  return mutationResultToResponse(
    await mockAppDataStore.updateSource(sourceId, validationResult.data)
  );
}

export async function DELETE(_request: Request, context: SourceRouteContext) {
  const { sourceId } = await context.params;
  return mutationResultToResponse(await mockAppDataStore.removeSource(sourceId));
}
