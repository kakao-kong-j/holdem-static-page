import { describe, it, expect } from "vitest";
import {
	normalizeCashSessions,
	normalizeTournamentSessions,
	dedupeSessions,
	parseBankrollFile,
	computeTrend,
	filterByDateRange,
	dateBounds,
	computeTagPerformance,
	computeTournamentMetrics,
	summarize,
	formatUsd,
	recalculateSessionProfit,
	hasMissingTicketPrice,
	extractTicketPrices,
	findTicketPrice,
	type RawCash,
	type RawTournament,
} from "./bankroll";

const cash: RawCash[] = [
	{
		game_type: "Texas Hold'em",
		minigames_type_id: 1,
		internal_ref: "c1",
		start_datetime: "2026-06-06 11:07:33",
		buy_in: "0.8",
		win_loss: "0.670000",
		total_no_hands: 27,
	},
	{
		game_type: "Omaha",
		minigames_type_id: 2,
		internal_ref: "c2",
		start_datetime: "2026-06-09 05:35:48",
		buy_in: "0.8",
		win_loss: "-0.020000",
		total_no_hands: 1,
	},
	{
		game_type: "Six cards omaha",
		minigames_type_id: 20,
		internal_ref: "c3",
		start_datetime: "2026-06-06 08:58:14",
		buy_in: "1.6",
		win_loss: "2.160000",
		total_no_hands: 8,
	},
];

const tourneys: RawTournament[] = [
	{
		tournament_id: "t1",
		tournament_name: "₮1.10 Early Hours Classic",
		minigames_type_id: 1,
		start_datetime: "2026-06-07 06:05:00",
		internal_ref: "r1",
		buy_in: "1.10",
		win_loss: "42.64",
		rank: 1,
		total_no_of_entries: 1,
	},
	{
		tournament_id: "t2",
		tournament_name: "Step",
		minigames_type_id: 1,
		start_datetime: "2026-06-11 16:05:00",
		internal_ref: "r2",
		buy_in: "1.20",
		win_loss: "0.00",
		rank: 18,
		total_no_of_entries: 3,
	},
];

describe("normalizeCashSessions", () => {
	it("uses win_loss as net profit and maps game-type tags", () => {
		const out = normalizeCashSessions(cash);
		expect(out).toHaveLength(3);
		const nl = out.find((s) => s.id === "c1")!;
		expect(nl.profit).toBeCloseTo(0.67, 5);
		expect(nl.tags).toEqual(["CoinPoker", "Cash History", "NL"]);
		expect(out.find((s) => s.id === "c2")!.tags).toContain("PLO4");
		expect(out.find((s) => s.id === "c3")!.tags).toContain("PLO6");
	});
});

describe("normalizeTournamentSessions", () => {
	it("computes net = win_loss - total buy_in and tags", () => {
		const out = normalizeTournamentSessions(tourneys);
		expect(out.find((s) => s.id === "t1")!.profit).toBeCloseTo(41.54, 5);
		expect(out.find((s) => s.id === "t2")!.profit).toBeCloseTo(-1.2, 5);
		expect(out.find((s) => s.id === "t1")!.tags).toEqual([
			"CoinPoker",
			"Tournament History",
		]);
	});

	it("adds the supplied ticket price as prize value for ticket tournaments", () => {
		const out = normalizeTournamentSessions(
			[
				{
					tournament_id: "ticket-1",
					tournament_name: "Ticket Event",
					minigames_type_id: 1,
					start_datetime: "2026-06-12 18:00:00",
					internal_ref: "r-ticket",
					buy_in: "0.00",
					win_loss: "15.00",
					rank: 3,
					total_no_of_entries: 2,
					is_ticket: true,
				},
			],
			{ ticketPrices: { "ticket-1": 5.5 } },
		);

		expect(out[0].profit).toBeCloseTo(20.5, 5);
		expect(out[0].buyIn).toBeCloseTo(0, 5);
		expect(out[0].ticketPrice).toBeCloseTo(5.5, 5);
		expect(out[0].isTicket).toBe(true);
	});

	it("counts ticket prizes as prize value minus cash buy-in", () => {
		const out = normalizeTournamentSessions(
			[
				{
					tournament_id: "67362",
					tournament_name: "Step [2] to ₮109 CoinMasters PENGU",
					minigames_type_id: 1,
					start_datetime: "2026-06-16 13:05:00",
					internal_ref: "r-ticket-win",
					buy_in: "1.10",
					win_loss: "0.00",
					rank: 19,
					total_no_of_entries: 1,
					is_ticket: true,
				},
			],
			{ ticketPrices: { "dest:₮109 coinmasters pengu": 11 } },
		);

		expect(out[0].buyIn).toBeCloseTo(1.1, 5);
		expect(out[0].ticketPrice).toBeCloseTo(11, 5);
		expect(out[0].profit).toBeCloseTo(9.9, 5);
	});

	it("falls back to 1 entry when total_no_of_entries is 0", () => {
		const out = normalizeTournamentSessions([
			{
				tournament_id: "z",
				tournament_name: "z",
				minigames_type_id: 1,
				start_datetime: "2026-06-07 06:05:00",
				internal_ref: "i",
				buy_in: "1.10",
				win_loss: "0.00",
				total_no_of_entries: 0,
			},
		]);
		expect(out[0].profit).toBeCloseTo(-1.1, 5);
	});
});

describe("id validation", () => {
	it("drops rows missing the dedupe key", () => {
		const cashBad = normalizeCashSessions([
			{
				game_type: "Texas Hold'em",
				minigames_type_id: 1,
				internal_ref: "",
				start_datetime: "2026-06-06 11:07:33",
				buy_in: "0.8",
				win_loss: "0.10",
			},
		] as RawCash[]);
		expect(cashBad).toHaveLength(0);
		const tourBad = normalizeTournamentSessions([
			{
				tournament_name: "x",
				minigames_type_id: 1,
				start_datetime: "2026-06-07 06:05:00",
				internal_ref: "i",
				buy_in: "1.10",
				win_loss: "0.00",
				total_no_of_entries: 1,
			},
		] as unknown as RawTournament[]);
		expect(tourBad).toHaveLength(0);
	});
});

describe("dedupeSessions", () => {
	it("keeps one per id, last wins", () => {
		const a = normalizeCashSessions(cash);
		const dup = normalizeCashSessions([{ ...cash[0], win_loss: "9.99" }]);
		const merged = dedupeSessions([...a, ...dup]);
		expect(merged).toHaveLength(3);
		expect(merged.find((s) => s.id === "c1")!.profit).toBeCloseTo(9.99, 5);
	});
});

describe("parseBankrollFile", () => {
	it("detects tournament by tournament_id key", () => {
		const out = parseBankrollFile(tourneys);
		expect(out[0].kind).toBe("tournament");
	});
	it("passes ticket prices through tournament parsing", () => {
		const out = parseBankrollFile(
			[
				{
					tournament_id: "ticket-parse",
					tournament_name: "Ticket Event",
					minigames_type_id: 1,
					start_datetime: "2026-06-12 18:00:00",
					internal_ref: "r-ticket",
					buy_in: "0.00",
					win_loss: "12.00",
					total_no_of_entries: 1,
					is_ticket: true,
				},
			],
			{ ticketPrices: { "ticket-parse": 3.3 } },
		);

		expect(out[0].profit).toBeCloseTo(15.3, 5);
	});
	it("detects cash otherwise", () => {
		const out = parseBankrollFile(cash);
		expect(out[0].kind).toBe("cash");
	});
	it("returns [] for empty/non-array", () => {
		expect(parseBankrollFile([])).toEqual([]);
		expect(parseBankrollFile({} as unknown)).toEqual([]);
	});
});

describe("extractTicketPrices", () => {
	it("builds a tournament id and name map from CoinPoker ticket exports", () => {
		const prices = extractTicketPrices([
			{
				title: "20 Seats to ₮109 CoinMasters PENGU",
				sourceName: "20 Seats to ₮109 CoinMasters PENGU",
				ticketAmount: 11,
				selectedEligibleTournamentId: 67361,
				eligibleTournaments: [
					{
						tourneyId: 67361,
						tourneyName: "20 Seats to ₮109 CoinMasters PENGU",
					},
				],
			},
		]);

		expect(prices).toMatchObject({
			"67361": 11,
			"name:20 seats to ₮109 coinmasters pengu": 11,
			"dest:₮109 coinmasters pengu": 11,
		});
	});

	it("returns an empty map for non-ticket exports", () => {
		expect(extractTicketPrices(tourneys)).toEqual({});
		expect(extractTicketPrices(cash)).toEqual({});
	});

	it.each([undefined, null, "", "invalid", "11usd"])(
		"rejects malformed ticketAmount %j instead of treating it as zero or a partial number",
		(ticketAmount) => {
			expect(
				extractTicketPrices([
					{ ticketAmount, selectedEligibleTournamentId: "ticket-invalid" },
				]),
			).toEqual({});
		},
	);
});

describe("findTicketPrice", () => {
	it("finds ticket prices by destination name when tournament ids differ", () => {
		const ticketPrices = extractTicketPrices([
			{
				ticketAmount: 11,
				selectedEligibleTournamentId: 67361,
				title: "20 Seats to ₮109 CoinMasters PENGU",
			},
		]);

		expect(
			findTicketPrice(
				"67362",
				"Step [2] to ₮109 CoinMasters PENGU",
				ticketPrices,
			),
		).toBeCloseTo(11, 5);
	});
});

describe("parseBankrollFile with ticket export prices", () => {
	it("uses prices extracted from a ticket export for matching ticket tournaments", () => {
		const ticketPrices = extractTicketPrices([
			{ ticketAmount: 1.1, selectedEligibleTournamentId: 63886 },
		]);
		const out = parseBankrollFile(
			[
				{
					tournament_id: "63886",
					tournament_name: "Step [2] to ₮109 CoinMasters PEPE",
					minigames_type_id: 1,
					start_datetime: "2026-06-12 18:00:00",
					internal_ref: "r-ticket",
					buy_in: "0.00",
					win_loss: "12.00",
					total_no_of_entries: 1,
					is_ticket: true,
				},
			],
			{ ticketPrices },
		);

		expect(out[0].ticketPrice).toBeCloseTo(1.1, 5);
		expect(out[0].profit).toBeCloseTo(13.1, 5);
		expect(hasMissingTicketPrice(out[0])).toBe(false);
	});

	it("matches ticket exports to ticket tournaments by destination name when ids differ", () => {
		const ticketPrices = extractTicketPrices([
			{
				ticketAmount: 11,
				selectedEligibleTournamentId: 67361,
				title: "20 Seats to ₮109 CoinMasters PENGU",
			},
		]);
		const out = parseBankrollFile(
			[
				{
					tournament_id: "67362",
					tournament_name: "Step [2] to ₮109 CoinMasters PENGU",
					minigames_type_id: 1,
					start_datetime: "2026-06-16 15:05:00",
					internal_ref: "r-ticket",
					buy_in: "1.10",
					win_loss: "0.00",
					total_no_of_entries: 1,
					is_ticket: true,
				},
			],
			{ ticketPrices },
		);

		expect(out[0].ticketPrice).toBeCloseTo(11, 5);
		expect(out[0].profit).toBeCloseTo(9.9, 5);
		expect(hasMissingTicketPrice(out[0])).toBe(false);
	});
});

const all = [
	...normalizeCashSessions(cash),
	...normalizeTournamentSessions(tourneys),
];

describe("computeTrend", () => {
	it("sorts by datetime and accumulates profit from 0", () => {
		const pts = computeTrend(all);
		expect(pts).toHaveLength(5);
		expect(pts[0].datetime <= pts[pts.length - 1].datetime).toBe(true);
		const last = pts[pts.length - 1].value;
		const sum = all.reduce((a, s) => a + s.profit, 0);
		expect(last).toBeCloseTo(sum, 5);
	});
});

describe("computeTournamentMetrics", () => {
	it("summarizes ROI, ABI, ITM, final table, and top 3 from tournaments only", () => {
		const metrics = computeTournamentMetrics([
			...normalizeCashSessions(cash),
			...normalizeTournamentSessions([
				{
					tournament_id: "a",
					tournament_name: "a",
					minigames_type_id: 1,
					start_datetime: "2026-06-01 00:00:00",
					internal_ref: "a",
					buy_in: "2",
					win_loss: "8",
					rank: 1,
					total_no_of_entries: 1,
				},
				{
					tournament_id: "b",
					tournament_name: "b",
					minigames_type_id: 1,
					start_datetime: "2026-06-02 00:00:00",
					internal_ref: "b",
					buy_in: "3",
					win_loss: "0",
					rank: 9,
					total_no_of_entries: 1,
				},
				{
					tournament_id: "c",
					tournament_name: "c",
					minigames_type_id: 1,
					start_datetime: "2026-06-03 00:00:00",
					internal_ref: "c",
					buy_in: "5",
					win_loss: "0",
					rank: 20,
					total_no_of_entries: 1,
				},
			]),
		]);

		expect(metrics.games).toBe(3);
		expect(metrics.totalBuyIn).toBeCloseTo(10, 5);
		expect(metrics.roi).toBeCloseTo(-0.2, 5);
		expect(metrics.abi).toBeCloseTo(10 / 3, 5);
		expect(metrics.itmRate).toBeCloseTo(1 / 3, 5);
		expect(metrics.finalTableRate).toBeCloseTo(2 / 3, 5);
		expect(metrics.top3Rate).toBeCloseTo(1 / 3, 5);
	});
});

describe("filterByDateRange", () => {
	it("returns all when both bounds empty", () => {
		expect(filterByDateRange(all, "", "")).toHaveLength(all.length);
	});
	it("filters inclusively by date part", () => {
		// cash c1 (06-06), c2 (06-09), c3 (06-06); tour t1 (06-07), t2 (06-11)
		expect(
			filterByDateRange(all, "2026-06-07", "2026-06-09")
				.map((s) => s.id)
				.sort(),
		).toEqual(["c2", "t1"]);
		expect(
			filterByDateRange(all, "2026-06-09", "")
				.map((s) => s.id)
				.sort(),
		).toEqual(["c2", "t2"]);
		expect(
			filterByDateRange(all, "", "2026-06-06")
				.map((s) => s.id)
				.sort(),
		).toEqual(["c1", "c3"]);
	});
});

describe("dateBounds", () => {
	it("returns min/max date or null", () => {
		expect(dateBounds(all)).toEqual({ min: "2026-06-06", max: "2026-06-11" });
		expect(dateBounds([])).toBeNull();
	});
});

describe("computeTagPerformance", () => {
	it("aggregates profit/sessions per tag with CoinPoker first", () => {
		const rows = computeTagPerformance(all);
		expect(rows[0].tag).toBe("CoinPoker");
		const nl = rows.find((r) => r.tag === "NL")!;
		expect(nl.sessions).toBe(1);
		expect(nl.profit).toBeCloseTo(0.67, 5);
		const coin = rows.find((r) => r.tag === "CoinPoker")!;
		expect(coin.sessions).toBe(5);
	});
});

describe("summarize", () => {
	it("splits cash and tournament profit", () => {
		const s = summarize(all);
		expect(s.sessionCount).toBe(5);
		expect(s.cashProfit).toBeCloseTo(0.67 - 0.02 + 2.16, 5);
		expect(s.tournamentProfit).toBeCloseTo(41.54 - 1.2, 5);
		expect(s.totalProfit).toBeCloseTo(s.cashProfit + s.tournamentProfit, 5);
	});
});

describe("formatUsd", () => {
	it("formats with sign", () => {
		expect(formatUsd(12.85)).toBe("$12.85");
		expect(formatUsd(-0.72)).toBe("-$0.72");
	});
});

describe("recalculateSessionProfit", () => {
	it("sets cash profit from edited winLoss", () => {
		const [session] = normalizeCashSessions(cash);

		expect(
			recalculateSessionProfit({ ...session, winLoss: -1.25 }).profit,
		).toBeCloseTo(-1.25, 5);
	});

	it("adds edited ticket price to tournament profit", () => {
		const [session] = normalizeTournamentSessions(
			[
				{
					tournament_id: "ticket-edit",
					tournament_name: "Ticket Event",
					minigames_type_id: 1,
					start_datetime: "2026-06-12 18:00:00",
					internal_ref: "r-ticket",
					buy_in: "0.00",
					win_loss: "20.00",
					total_no_of_entries: 2,
					is_ticket: true,
				},
			],
			{ ticketPrices: { "ticket-edit": 4 } },
		);

		const updated = recalculateSessionProfit({
			...session,
			ticketPrice: 6,
			entries: 3,
		});

		expect(updated.buyIn).toBeCloseTo(0, 5);
		expect(updated.profit).toBeCloseTo(26, 5);
	});

	it("uses edited buyIn as total cost, not per-entry cost", () => {
		const [session] = normalizeTournamentSessions([
			{
				tournament_id: "rebuy-edit",
				tournament_name: "Rebuy",
				minigames_type_id: 1,
				start_datetime: "2026-06-12 18:00:00",
				internal_ref: "r-rebuy",
				buy_in: "2.20",
				win_loss: "5.79",
				total_no_of_entries: 2,
			},
		]);

		const updated = recalculateSessionProfit({
			...session,
			buyIn: 3,
			entries: 4,
		});

		expect(updated.profit).toBeCloseTo(2.79, 5);
	});
});

describe("hasMissingTicketPrice", () => {
	it("flags ticket tournaments without a saved ticket price", () => {
		const [session] = normalizeTournamentSessions([
			{
				tournament_id: "ticket-missing",
				tournament_name: "Ticket Event",
				minigames_type_id: 1,
				start_datetime: "2026-06-12 18:00:00",
				internal_ref: "r-ticket",
				buy_in: "0.00",
				win_loss: "0.00",
				total_no_of_entries: 1,
				is_ticket: true,
			},
		]);

		expect(hasMissingTicketPrice(session)).toBe(true);
	});

	it("does not flag non-ticket tournaments or explicit zero ticket prices", () => {
		const [regular] = normalizeTournamentSessions(tourneys);
		const [ticket] = normalizeTournamentSessions(
			[
				{
					tournament_id: "ticket-zero",
					tournament_name: "Ticket Event",
					minigames_type_id: 1,
					start_datetime: "2026-06-12 18:00:00",
					internal_ref: "r-ticket",
					buy_in: "0.00",
					win_loss: "0.00",
					total_no_of_entries: 1,
					is_ticket: true,
				},
			],
			{ ticketPrices: { "ticket-zero": 0 } },
		);

		expect(hasMissingTicketPrice(regular)).toBe(false);
		expect(hasMissingTicketPrice(ticket)).toBe(false);
	});
});

describe("reference dataset invariants", () => {
	const refCash: RawCash[] = [
		{
			game_type: "Omaha",
			minigames_type_id: 2,
			internal_ref: "rc1",
			start_datetime: "2026-06-09 05:35:48",
			buy_in: "0.8",
			win_loss: "-0.02",
		},
		{
			game_type: "Texas Hold'em",
			minigames_type_id: 1,
			internal_ref: "rc2",
			start_datetime: "2026-06-09 05:25:19",
			buy_in: "1.2",
			win_loss: "0.00",
		},
		{
			game_type: "Omaha",
			minigames_type_id: 2,
			internal_ref: "rc3",
			start_datetime: "2026-06-07 11:41:15",
			buy_in: "1.2",
			win_loss: "0.00",
		},
		{
			game_type: "Texas Hold'em",
			minigames_type_id: 1,
			internal_ref: "rc4",
			start_datetime: "2026-06-06 11:07:33",
			buy_in: "0.8",
			win_loss: "0.67",
		},
		{
			game_type: "Six cards omaha",
			minigames_type_id: 20,
			internal_ref: "rc5",
			start_datetime: "2026-06-06 08:58:14",
			buy_in: "1.6",
			win_loss: "2.16",
		},
		{
			game_type: "Omaha",
			minigames_type_id: 2,
			internal_ref: "rc6",
			start_datetime: "2026-06-06 08:56:00",
			buy_in: "0.8",
			win_loss: "-0.80",
		},
		{
			game_type: "Texas Hold'em",
			minigames_type_id: 1,
			internal_ref: "rc7",
			start_datetime: "2026-06-06 02:29:41",
			buy_in: "0.8",
			win_loss: "-0.10",
		},
		{
			game_type: "Texas Hold'em",
			minigames_type_id: 1,
			internal_ref: "rc8",
			start_datetime: "2026-06-05 06:17:11",
			buy_in: "0.8",
			win_loss: "-0.10",
		},
		{
			game_type: "Texas Hold'em",
			minigames_type_id: 1,
			internal_ref: "rc9",
			start_datetime: "2026-06-05 03:13:35",
			buy_in: "0.8",
			win_loss: "-0.80",
		},
		{
			game_type: "Texas Hold'em",
			minigames_type_id: 1,
			internal_ref: "rc10",
			start_datetime: "2026-06-05 00:00:19",
			buy_in: "1.6",
			win_loss: "-0.39",
		},
	];

	it("cash totals + game-type tag breakdown match the screenshot", () => {
		const s = normalizeCashSessions(refCash);
		expect(summarize(s).cashProfit).toBeCloseTo(0.62, 2);
		const rows = computeTagPerformance(s);
		const byTag = (t: string) => rows.find((r) => r.tag === t)!;
		expect(byTag("NL").sessions).toBe(6);
		expect(byTag("NL").profit).toBeCloseTo(-0.72, 2);
		expect(byTag("PLO4").sessions).toBe(3);
		expect(byTag("PLO4").profit).toBeCloseTo(-0.82, 2);
		expect(byTag("PLO6").sessions).toBe(1);
		expect(byTag("PLO6").profit).toBeCloseTo(2.16, 2);
		expect(byTag("Cash History").sessions).toBe(10);
	});

	it("tournament net = win_loss - total buy_in", () => {
		const t = normalizeTournamentSessions([
			{
				tournament_id: "big",
				tournament_name: "x",
				minigames_type_id: 1,
				start_datetime: "2026-06-07 06:05:00",
				internal_ref: "i",
				buy_in: "1.10",
				win_loss: "42.64",
				total_no_of_entries: 1,
			},
			{
				tournament_id: "reb",
				tournament_name: "y",
				minigames_type_id: 1,
				start_datetime: "2026-06-08 06:05:00",
				internal_ref: "j",
				buy_in: "2.20",
				win_loss: "5.79",
				total_no_of_entries: 2,
			},
		]);
		expect(t.find((s) => s.id === "big")!.profit).toBeCloseTo(41.54, 2);
		expect(t.find((s) => s.id === "reb")!.profit).toBeCloseTo(3.59, 2);
	});
});
