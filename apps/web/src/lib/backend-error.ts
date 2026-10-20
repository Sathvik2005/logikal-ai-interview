/** Turn a failed backend response into a readable Error (surfaces the API's own message when present). */
export async function backendError(res: Response, fallback: string): Promise<Error> {
  let detail = "";
  try {
    const body = (await res.json()) as { message?: string | string[] };
    detail = Array.isArray(body?.message) ? body.message.join(", ") : (body?.message ?? "");
  } catch {
    /* non-JSON error body */
  }
  return new Error(detail || `${fallback} (${res.status} ${res.statusText})`.trim());
}
