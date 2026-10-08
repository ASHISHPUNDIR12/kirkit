export type NativePdfWorkflow = {
  print(html: string): Promise<{ uri: string; base64?: string }>;
  persist(base64: string, filename: string): Promise<string>;
  canShare(): Promise<boolean>;
  share(uri: string): Promise<void>;
};

/** Put Print's PDF in an Expo-owned cache path before passing it to Android Sharing. */
export async function runNativePdfWorkflow(
  html: string,
  filename: string,
  workflow: NativePdfWorkflow,
): Promise<string> {
  const generated = await workflow.print(html);
  if (!generated.base64) throw new Error('Expo Print did not return PDF data.');
  const sharedUri = await workflow.persist(generated.base64, filename);
  if (!await workflow.canShare()) throw new Error('PDF sharing is not available on this device.');
  await workflow.share(sharedUri);
  return sharedUri;
}
