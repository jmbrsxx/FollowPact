export class RequestBodyTooLarge extends Error {}

export async function readLimitedBody(request: Request, maxBytes: number): Promise<string> {
  const declaredLength = Number(request.headers.get("content-length"));
  if (declaredLength > maxBytes) throw new RequestBodyTooLarge();

  const reader = request.body?.getReader();
  if (!reader) return "";

  const decoder = new TextDecoder();
  let size = 0;
  let text = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) return text + decoder.decode();
    size += value.byteLength;
    if (size > maxBytes) {
      await reader.cancel().catch(() => undefined);
      throw new RequestBodyTooLarge();
    }
    text += decoder.decode(value, { stream: true });
  }
}
