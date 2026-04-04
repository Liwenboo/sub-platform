import {
  errorResponse,
  successResponse,
} from "../_lib/mock-api-response";
import { getRequestRole, requireViewerReadAccess } from "../_lib/mock-api-auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const accessFailureResponse = await requireViewerReadAccess();
  if (accessFailureResponse) {
    return accessFailureResponse;
  }

  return successResponse({ role: await getRequestRole() });
}

export async function PATCH() {
  return errorResponse(
    405,
    "role_switch_disabled",
    "Role switching via API is disabled. Use /api/auth/login or /api/auth/logout."
  );
}
