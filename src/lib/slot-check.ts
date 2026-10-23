/**
 * A verification result belongs to one opening of the booking sheet, not to a
 * slot id: every opening creates a new selection object, so reopening the same
 * slot later shows "checking" until its own fresh result arrives.
 */
export function resultForOpening<Selection extends object, Check>(
  result: { opening: Selection; check: Check } | null,
  opening: Selection | null,
  pending: Check,
): Check {
  return result && opening && result.opening === opening ? result.check : pending;
}
