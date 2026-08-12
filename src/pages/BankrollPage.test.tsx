import { act, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BankrollPage } from './BankrollPage';
import type { BankrollSession } from '../utils/bankroll';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const existingTicketSession: BankrollSession = {
	id: '63887',
	kind: 'tournament',
	datetime: '2026-08-12 12:00:00',
	profit: -0.1,
	winLoss: 0,
	buyIn: 0.1,
	entries: 1,
	name: 'Step [3] to ₮109 CoinMasters SHIBA',
	rank: 4,
  isTicket: true,
  tags: ['CoinPoker', 'Tournament History'],
};

const pricedTicketSession: BankrollSession = {
	...existingTicketSession,
	profit: 1,
	ticketPrice: 1.1,
};

function renderNode(node: ReactNode) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => root.render(node));
  return {
    container,
    cleanup() {
      act(() => root.unmount());
      container.remove();
    },
  };
}

async function flushEffects() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
  document.body.replaceChildren();
});

describe('BankrollPage ticket imports', () => {
  it('locks record actions while uploaded files are still being read', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      if (input === '/api/bankroll') {
        return {
          ok: true,
          json: async () => ({ cash: [], tournament: [existingTicketSession] }),
        };
      }
      return { ok: false, status: 503 };
    }));

    const view = renderNode(<BankrollPage />);
    await flushEffects();
    let resolveText: ((value: string) => void) | undefined;
    const delayedFile = {
      name: 'delayed-ticket-history.json',
      text: () => new Promise<string>((resolve) => {
        resolveText = resolve;
      }),
    };
    const input = view.container.querySelector('input[type="file"]') as HTMLInputElement;
    Object.defineProperty(input, 'files', { configurable: true, value: [delayedFile] });

    act(() => input.dispatchEvent(new Event('change', { bubbles: true })));

    const editButton = [...view.container.querySelectorAll('button')]
      .find((button) => button.textContent === '수정') as HTMLButtonElement;
    expect(editButton.disabled).toBe(true);

    await act(async () => {
      resolveText?.('[]');
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });
    view.cleanup();
  });

  it('applies a later ticket export to an existing tournament and persists the recalculated profit', async () => {
    const postedSessions: BankrollSession[][] = [];
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (input === '/api/bankroll' && init?.method === 'POST') {
        const body = JSON.parse(String(init.body)) as { sessions: BankrollSession[] };
        postedSessions.push(body.sessions);
        return {
          ok: true,
          json: async () => ({ cash: [], tournament: body.sessions }),
        };
      }
      if (input === '/api/bankroll') {
        return {
          ok: true,
          json: async () => ({ cash: [], tournament: [existingTicketSession] }),
        };
      }
      return { ok: false, status: 503 };
    }));

    const view = renderNode(<BankrollPage />);
    await flushEffects();
    expect(view.container.textContent).toContain('티켓 가격 필요');
		expect(view.container.textContent).toContain('-$0.10');

		const ticketExport = [{
			ticketAmount: 1.1,
			eligibleTournaments: [{
				tourneyId: 63886,
				tourneyName: 'Step [2] to ₮109 CoinMasters PEPE',
			}],
    }];
    const file = new File([JSON.stringify(ticketExport)], 'ticket-history.json', {
      type: 'application/json',
    });
    const input = view.container.querySelector('input[type="file"]') as HTMLInputElement;
    Object.defineProperty(input, 'files', { configurable: true, value: [file] });

    await act(async () => {
      input.dispatchEvent(new Event('change', { bubbles: true }));
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

		expect(view.container.textContent).toContain('Ticket +$1.10');
		expect(view.container.textContent).toContain('$1.00');
    expect(postedSessions).toHaveLength(1);
    expect(postedSessions[0]).toEqual([
      expect.objectContaining({
				id: '63887',
				ticketPrice: 1.1,
				profit: 1,
      }),
    ]);
    view.cleanup();
  });

  it('keeps a ticket export for a tournament history uploaded in a later selection', async () => {
    const postedSessions: BankrollSession[][] = [];
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (input === '/api/bankroll' && init?.method === 'POST') {
        const body = JSON.parse(String(init.body)) as { sessions: BankrollSession[] };
        postedSessions.push(body.sessions);
        return {
          ok: true,
          json: async () => ({ cash: [], tournament: body.sessions }),
        };
      }
      if (input === '/api/bankroll') {
        return {
          ok: true,
          json: async () => ({ cash: [], tournament: [] }),
        };
      }
      return { ok: false, status: 503 };
    }));

    const view = renderNode(<BankrollPage />);
    await flushEffects();
    const input = view.container.querySelector('input[type="file"]') as HTMLInputElement;
    const ticketExport = [{
      ticketAmount: 1.1,
      eligibleTournaments: [{
        tourneyId: 63886,
        tourneyName: 'Step [2] to ₮109 CoinMasters PEPE',
      }],
    }];
    const ticketFile = new File([JSON.stringify(ticketExport)], 'ticket-history.json', {
      type: 'application/json',
    });
    Object.defineProperty(input, 'files', { configurable: true, value: [ticketFile] });

    await act(async () => {
      input.dispatchEvent(new Event('change', { bubbles: true }));
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    const tournamentHistory = [{
      tournament_id: '63887',
      tournament_name: 'Step [3] to ₮109 CoinMasters SHIBA',
      minigames_type_id: 1,
      start_datetime: '2026-06-05 11:45:00',
      internal_ref: 'ref-63887',
      buy_in: '0.10',
      win_loss: '0.00',
      rank: 4,
      total_no_of_entries: 1,
      is_ticket: true,
    }];
    const tournamentFile = new File(
      [JSON.stringify(tournamentHistory)],
      'tournament-history.json',
      { type: 'application/json' },
    );
    Object.defineProperty(input, 'files', { configurable: true, value: [tournamentFile] });

    await act(async () => {
      input.dispatchEvent(new Event('change', { bubbles: true }));
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(postedSessions).toHaveLength(1);
    expect(postedSessions[0]).toEqual([
      expect.objectContaining({
        id: '63887',
        ticketPrice: 1.1,
        profit: 1,
      }),
    ]);
    expect(view.container.textContent).toContain('Ticket +$1.10');
    expect(view.container.textContent).toContain('$1.00');
    view.cleanup();
  });

  it('ignores a malformed ticket amount without changing or persisting the existing session', async () => {
    const postedSessions: BankrollSession[][] = [];
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (input === '/api/bankroll' && init?.method === 'POST') {
        const body = JSON.parse(String(init.body)) as { sessions: BankrollSession[] };
        postedSessions.push(body.sessions);
        return {
          ok: true,
          json: async () => ({ cash: [], tournament: body.sessions }),
        };
      }
      if (input === '/api/bankroll') {
        return {
          ok: true,
          json: async () => ({ cash: [], tournament: [pricedTicketSession] }),
        };
      }
      return { ok: false, status: 503 };
    }));

    const view = renderNode(<BankrollPage />);
    await flushEffects();
		const malformedExport = [{
			ticketAmount: 'invalid',
			eligibleTournaments: [{
				tourneyId: 63886,
				tourneyName: 'Step [2] to ₮109 CoinMasters PEPE',
			}],
    }];
    const file = new File([JSON.stringify(malformedExport)], 'malformed-ticket-history.json', {
      type: 'application/json',
    });
    const input = view.container.querySelector('input[type="file"]') as HTMLInputElement;
    Object.defineProperty(input, 'files', { configurable: true, value: [file] });

    await act(async () => {
      input.dispatchEvent(new Event('change', { bubbles: true }));
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(postedSessions).toHaveLength(0);
		expect(view.container.textContent).toContain('Ticket +$1.10');
		expect(view.container.textContent).toContain('$1.00');
    view.cleanup();
  });

  it('keeps the imported ticket price when the affected record was already being edited', async () => {
    const postedSessions: BankrollSession[][] = [];
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (input === '/api/bankroll' && init?.method === 'POST') {
        const body = JSON.parse(String(init.body)) as { sessions: BankrollSession[] };
        postedSessions.push(body.sessions);
        return {
          ok: true,
          json: async () => ({ cash: [], tournament: body.sessions }),
        };
      }
      if (input === '/api/bankroll') {
        return {
          ok: true,
          json: async () => ({ cash: [], tournament: [existingTicketSession] }),
        };
      }
      return { ok: false, status: 503 };
    }));

    const view = renderNode(<BankrollPage />);
    await flushEffects();
    const editButton = [...view.container.querySelectorAll('button')]
      .find((button) => button.textContent === '수정');
    act(() => editButton?.click());

		const ticketExport = [{
			ticketAmount: 1.1,
			eligibleTournaments: [{
				tourneyId: 63886,
				tourneyName: 'Step [2] to ₮109 CoinMasters PEPE',
			}],
    }];
    const file = new File([JSON.stringify(ticketExport)], 'ticket-history.json', {
      type: 'application/json',
    });
    const input = view.container.querySelector('input[type="file"]') as HTMLInputElement;
    Object.defineProperty(input, 'files', { configurable: true, value: [file] });

    await act(async () => {
      input.dispatchEvent(new Event('change', { bubbles: true }));
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });
    const saveButton = [...view.container.querySelectorAll('button')]
      .find((button) => button.textContent === '저장');
    await act(async () => {
      saveButton?.click();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(postedSessions).toHaveLength(2);
    expect(postedSessions[1]).toEqual([
      expect.objectContaining({
				id: '63887',
				ticketPrice: 1.1,
				profit: 1,
      }),
    ]);
		expect(view.container.textContent).toContain('Ticket +$1.10');
		expect(view.container.textContent).toContain('$1.00');
    view.cleanup();
  });

  it('restores the imported price in an edited draft even when the stored price already matches', async () => {
    const postedSessions: BankrollSession[][] = [];
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (input === '/api/bankroll' && init?.method === 'POST') {
        const body = JSON.parse(String(init.body)) as { sessions: BankrollSession[] };
        postedSessions.push(body.sessions);
        return {
          ok: true,
          json: async () => ({ cash: [], tournament: body.sessions }),
        };
      }
      if (input === '/api/bankroll') {
        return {
          ok: true,
          json: async () => ({ cash: [], tournament: [pricedTicketSession] }),
        };
      }
      return { ok: false, status: 503 };
    }));

    const view = renderNode(<BankrollPage />);
    await flushEffects();
    const editButton = [...view.container.querySelectorAll('button')]
      .find((button) => button.textContent === '수정');
    act(() => editButton?.click());
    const ticketLabel = [...view.container.querySelectorAll('label')]
      .find((label) => label.textContent?.includes('Ticket'));
    const ticketInput = ticketLabel?.querySelector('input') as HTMLInputElement;
    act(() => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(ticketInput, '');
      ticketInput.dispatchEvent(new Event('input', { bubbles: true }));
    });

		const ticketExport = [{
			ticketAmount: 1.1,
			eligibleTournaments: [{
				tourneyId: 63886,
				tourneyName: 'Step [2] to ₮109 CoinMasters PEPE',
			}],
    }];
    const file = new File([JSON.stringify(ticketExport)], 'ticket-history.json', {
      type: 'application/json',
    });
    const input = view.container.querySelector('input[type="file"]') as HTMLInputElement;
    Object.defineProperty(input, 'files', { configurable: true, value: [file] });

    await act(async () => {
      input.dispatchEvent(new Event('change', { bubbles: true }));
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });
    const saveButton = [...view.container.querySelectorAll('button')]
      .find((button) => button.textContent === '저장');
    await act(async () => {
      saveButton?.click();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(postedSessions).toHaveLength(1);
    expect(postedSessions[0]).toEqual([
      expect.objectContaining({
				id: '63887',
				ticketPrice: 1.1,
				profit: 1,
      }),
    ]);
    view.cleanup();
  });
});
