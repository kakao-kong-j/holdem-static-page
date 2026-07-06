import type { AllData, StackSize } from '../types';

const REQUIRED_STACKS: StackSize[] = ['15BB', '25BB', '40BB', '100BB'];

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function validateChartDataPayload(value: unknown): AllData {
  if (!isPlainObject(value) || !isPlainObject(value.data)) {
    throw new Error('Chart data payload must contain a data object');
  }

  const data = value.data;
  for (const stack of REQUIRED_STACKS) {
    const stackValue = data[stack];
    if (!isPlainObject(stackValue)) {
      throw new Error(`Chart data missing stack: ${stack}`);
    }

    for (const [chartName, chartValue] of Object.entries(stackValue)) {
      if (!isPlainObject(chartValue)) {
        throw new Error(`Chart data chart must be an object: ${stack} > ${chartName}`);
      }

      for (const [action, hands] of Object.entries(chartValue)) {
        if (!Array.isArray(hands) || hands.some(hand => typeof hand !== 'string')) {
          throw new Error(`Chart data action must be a string array: ${stack} > ${chartName} > ${action}`);
        }
      }
    }
  }

  return data as unknown as AllData;
}
