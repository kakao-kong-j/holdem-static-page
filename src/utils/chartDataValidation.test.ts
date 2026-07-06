import { describe, expect, it } from 'vitest';
import { validateChartDataPayload } from './chartDataValidation';

const stack = {
  'UTG RFI': {
    raise: ['AA', 'AKs'],
    fold: ['72o'],
  },
};

function validPayload() {
  return {
    data: {
      '15BB': stack,
      '25BB': stack,
      '40BB': stack,
      '100BB': stack,
    },
  };
}

describe('validateChartDataPayload', () => {
  it('returns typed chart data for a valid payload', () => {
    const data = validateChartDataPayload(validPayload());
    expect(data['100BB']['UTG RFI'].raise).toEqual(['AA', 'AKs']);
  });

  it('throws when root data object is missing', () => {
    expect(() => validateChartDataPayload({})).toThrow('Chart data payload must contain a data object');
  });

  it('throws when a required stack is missing', () => {
    const payload = validPayload();
    delete (payload.data as Record<string, unknown>)['40BB'];
    expect(() => validateChartDataPayload(payload)).toThrow('Chart data missing stack: 40BB');
  });

  it('throws when an action value is not a string array', () => {
    const payload = validPayload();
    (payload.data['15BB']['UTG RFI'] as Record<string, unknown>).raise = ['AA', 123];
    expect(() => validateChartDataPayload(payload)).toThrow('Chart data action must be a string array: 15BB > UTG RFI > raise');
  });
});
