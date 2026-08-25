import type { AuthState } from '../auth';

export const OFFER_PROMPT_DISMISS_KEY = 'bells_offer_prompt_dismissed';
export const OFFER_PROMPT_EVENT = 'bells-open-offer-prompt';

const OFFER_STAGES = ['offer_issued', 'awaiting_acceptance_fee', 'admission'];

export function hasPendingAdmissionOffer(auth: AuthState | null | undefined) {
  if (!auth || auth.is_student) return false;
  if (auth.unpaid_acceptance_fee) return true;
  return OFFER_STAGES.includes(auth.lifecycle_stage || '');
}

export function resetOfferPrompt() {
  sessionStorage.removeItem(OFFER_PROMPT_DISMISS_KEY);
}

export function dismissOfferPrompt() {
  sessionStorage.setItem(OFFER_PROMPT_DISMISS_KEY, '1');
}

export function isOfferPromptDismissed() {
  return sessionStorage.getItem(OFFER_PROMPT_DISMISS_KEY) === '1';
}

export function openOfferPrompt() {
  sessionStorage.removeItem(OFFER_PROMPT_DISMISS_KEY);
  window.dispatchEvent(new Event(OFFER_PROMPT_EVENT));
}
