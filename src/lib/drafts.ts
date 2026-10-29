// The edit to send on approve: whatever the visitor changed, whether or not the editor is still open.
export function editFor(original: string | undefined, body: string): { body: string } | undefined {
  return body !== (original ?? "") ? { body } : undefined;
}
