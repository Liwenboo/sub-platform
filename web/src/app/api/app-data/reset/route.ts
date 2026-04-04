import { successResponse } from "../../_lib/mock-api-response";
import { getRequestRole, requireAdminForMutation } from "../../_lib/mock-api-auth";
import { mockAppDataStore } from "../../../../server/mock-data/app-data-store";

export const dynamic = "force-dynamic";

export async function POST() {
  const authFailureResponse = await requireAdminForMutation();
  if (authFailureResponse) {
    return authFailureResponse;
  }

  const role = await getRequestRole();
  const appData = await mockAppDataStore.resetAppData();

  return successResponse({
    ...appData,
    role,
  });
}
