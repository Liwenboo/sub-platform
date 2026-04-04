import { successResponse } from "../_lib/mock-api-response";
import { getRequestRole, requireViewerReadAccess } from "../_lib/mock-api-auth";
import { mockAppDataStore } from "../../../server/mock-data/app-data-store";

export const dynamic = "force-dynamic";

export async function GET() {
  const accessFailureResponse = await requireViewerReadAccess();
  if (accessFailureResponse) {
    return accessFailureResponse;
  }

  const role = await getRequestRole();
  const appData = await mockAppDataStore.loadAppData();

  return successResponse({
    ...appData,
    role,
  });
}
