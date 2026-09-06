import { researchProduct } from "@/server/research";
import { authorize, failure, readJson, success } from "@/lib/server/simulation-http";
import { ApiError } from "@/lib/server/simulation-store";
export const runtime = "nodejs";
export const maxDuration = 120;
export async function POST(request: Request) {
  try {
    // Uses the same durable cloud budgets and HttpOnly identity as agent requests.
    const owner = await authorize(request, true);
    const input = await readJson(request);
    if (typeof input.url !== "string") throw new ApiError(400, "Enter a public website URL.");
    const capture = await researchProduct(input.url);
    return success(capture, owner);
  } catch (error) { return failure(error); }
}
