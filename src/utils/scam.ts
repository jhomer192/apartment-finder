import type { ScamAssessment } from '../api/types';

export function riskLabel(scam: ScamAssessment): string {
  switch (scam.band) {
    case 'high':
      return 'Several scam warning signs';
    case 'medium':
      return 'Worth a closer look';
    default:
      return scam.reasons.length > 0 ? 'Minor things to check' : 'Nothing suspicious found';
  }
}
