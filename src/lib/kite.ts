import { KiteConnect } from "kiteconnect";

export function createKiteClient(apiKey: string) {
  return new KiteConnect({ api_key: apiKey });
}

export function getKiteLoginUrl(apiKey: string): string {
  const kc = createKiteClient(apiKey);
  return kc.getLoginURL();
}
