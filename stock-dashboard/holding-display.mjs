/** Missing or invalid position fields must never be presented as zero. */
export function hasHoldingValue(value) {
  return value !== null && value !== undefined && String(value).trim() !== "" && Number.isFinite(Number(value)) && Number(value) > 0;
}
