import { describe, expect, it } from "vitest";
import { flattenStore, type BankrollStore } from "./bankrollSync";

const store: BankrollStore = {
	cash: [],
	tournament: [
		{
			id: "rebuy-stored",
			kind: "tournament",
			datetime: "2026-06-08 06:05:00",
			profit: 1.39,
			winLoss: 5.79,
			buyIn: 2.2,
			entries: 2,
			name: "Rebuy",
			tags: ["CoinPoker", "Tournament History"],
		},
	],
};

describe("flattenStore", () => {
	it("recalculates stored tournament profit from total buyIn", () => {
		const [session] = flattenStore(store);

		expect(session.profit).toBeCloseTo(3.59, 5);
	});
});
