import { successResponse } from "../_lib/mock-api-response";
import { mockAppDataStore } from "../../../server/mock-data/app-data-store";

export const dynamic = "force-dynamic";

export async function GET() {
  return successResponse(await mockAppDataStore.loadAppData());
}
