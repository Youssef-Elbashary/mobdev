const NAME_RE = /^[\p{L}\p{M} .'’-]+$/u;
const SLOT_RE = /^[\p{L}\p{M}\p{N}\s .,'’:;\/_+&()#–—-]+$/u;

const clean = (value: unknown) => String(value ?? '').normalize('NFC').trim().replace(/\s+/g, ' ');

/** Normalises and validates the labels an admin enters for a teaching session. */
export function sessionDetails(taInput: unknown, slotInput: unknown) {
  const taName = clean(taInput);
  const timeSlot = clean(slotInput);
  const valid = taName.length >= 2 && taName.length <= 60 && NAME_RE.test(taName)
    && timeSlot.length >= 2 && timeSlot.length <= 80 && SLOT_RE.test(timeSlot);
  return { taName, timeSlot, valid };
}
