export function isSiteWeightFlagged(job: any): boolean {
  return job?.siteArrivalWeightVarianceFlagged === true || job?.siteArrivalWeightVarianceStatus === 'flagged';
}

export function getSiteWeightFlagReason(job: any): string {
  const explicitReason = [
    job?.siteArrivalWeightVarianceReason,
    job?.siteFlagReason,
    job?.flagReason,
  ].find((reason) => typeof reason === 'string' && reason.trim());

  if (explicitReason) return explicitReason.trim();

  const variance = Number(job?.siteArrivalWeightVariance);
  const tolerance = Number(job?.siteArrivalWeightVarianceTolerance);
  if (Number.isFinite(variance)) {
    const varianceText = `${variance > 0 ? '+' : ''}${variance.toFixed(1)}T`;
    if (Number.isFinite(tolerance) && tolerance > 0) {
      return `Site arrival variance ${varianceText} exceeds the ${tolerance.toFixed(1)}T tolerance.`;
    }
    return `Site arrival variance ${varianceText} is outside the allowed tolerance.`;
  }

  return 'Site arrival weight is outside the allowed tolerance.';
}
