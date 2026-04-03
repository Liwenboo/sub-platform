import {
  successResponse,
} from "../../_lib/mock-api-response";
import { mockAppDataStore } from "../../../../server/mock-data/app-data-store";

export const dynamic = "force-dynamic";

export async function POST() {
  return successResponse(await mockAppDataStore.resetSettings());
}
