export function isSiteWeightFlagged(job: any): boolean {
  return job?.siteArrivalWeightVarianceFlagged === true
    || job?.siteArrivalWeightVarianceStatus === 'flagged'
    || job?.hasWeightDiscrepancy === true;
}

export function isSecurityFlagged(job: any): boolean {
  return job?.securityFlag?.status === 'flagged' || job?.isFlagged === true;
}

/** A previously suspended driver/truck has been cleared and may operate again. */
export function isSecurityCleared(job: any): boolean {
  return job?.securityFlag?.status === 'cleared';
}

export function isDeliveryFlagged(job: any): boolean {
  return isSiteWeightFlagged(job)
    || isSecurityFlagged(job);
}

export function getDeliveryFlagReason(job: any): string {
  if (job?.securityFlag?.status === 'flagged') {
    return job.securityFlag.reason || 'Security review is required for this delivery.';
  }
  if (job?.hasWeightDiscrepancy === true && job?.differenceNote) return job.differenceNote;
  return getSiteWeightFlagReason(job);
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
