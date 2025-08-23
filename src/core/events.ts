export const EV_ANCHOR_SET = 'op-anchor-set';
export const EV_AUTOCAP_CHANGED = 'op-autocap-changed';

export function emit(name: string, detail?: any) {
  try {
    document.dispatchEvent(new CustomEvent(name, { detail }));
  } catch {
  }
}