export const NETWORK_ERROR_EVENT = 'ywap-network-error';

export function reportNetworkError() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(NETWORK_ERROR_EVENT));
  }
}

export function isNetworkError(error: unknown) {
  return error instanceof TypeError;
}
