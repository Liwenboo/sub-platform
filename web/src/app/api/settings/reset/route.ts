import {
  successResponse,
} from "../../_lib/mock-api-response";
import { requireAdminForMutation } from "../../_lib/mock-api-auth";
import { mockAppDataStore } from "../../../../server/mock-data/app-data-store";

export const dynamic = "force-dynamic";

export async function POST() {
  const authFailureResponse = await requireAdminForMutation();
  if (authFailureResponse) {
    return authFailureResponse;
  }

  return successResponse(await mockAppDataStore.resetSettings());
}
