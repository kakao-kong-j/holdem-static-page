import { useState, useMemo } from 'react';

// Quick bet sizes as a fraction of the (pre-bet) pot.
const BET_SIZES: { label: string; fraction: number }[] = [
  { label: '1/3', fraction: 1 / 3 },
  { label: '1/2', fraction: 1 / 2 },
  { label: '2/3', fraction: 2 / 3 },
  { label: '3/4', fraction: 3 / 4 },
  { label: '팟', fraction: 1 },
  { label: '1.5x', fraction: 1.5 },
];

// Trim a computed number to a clean string (max 2 decimals, no trailing zeros).
function fmt(n: number): string {
  return Number(n.toFixed(2)).toString();
}

interface Result {
  requiredEquity: number; // percent
  potOdds: number; // pot-after-bet : call, expressed as "potOdds : 1"
}

export function EquityCalculatorPage() {
  const [pot, setPot] = useState('');
  const [bet, setBet] = useState('');
  const [myEquity, setMyEquity] = useState('');

  const potNum = parseFloat(pot);
  const betNum = parseFloat(bet);

  // X = pot before villain's bet, Y = villain's bet.
  // To call Y you win the current pot (X + Y); final pot = X + 2Y.
  // Required equity = Y / (X + 2Y).
  const result = useMemo<Result | null>(() => {
    if (!isFinite(potNum) || !isFinite(betNum) || potNum < 0 || betNum <= 0) {
      return null;
    }
    const requiredEquity = (betNum / (potNum + 2 * betNum)) * 100;
    const potOdds = (potNum + betNum) / betNum; // amount won : amount to call
    return { requiredEquity, potOdds };
  }, [potNum, betNum]);

  const equityNum = parseFloat(myEquity);
  const verdict = useMemo(() => {
    if (!result) return null;
    if (!isFinite(equityNum) || equityNum < 0 || equityNum > 100) return null;
    const margin = equityNum - result.requiredEquity;
    return { isCall: margin >= 0, margin };
  }, [result, equityNum]);

  const applyBetSize = (fraction: number) => {
    if (!isFinite(potNum) || potNum <= 0) return;
    setBet(fmt(potNum * fraction));
  };

  return (
    <div className="max-w-md mx-auto flex flex-col gap-6">
      <div className="text-center">
        <h2 className="text-lg font-bold text-white">에쿼티 계산기</h2>
        <p className="text-xs text-gray-400 mt-1">
          팟이 X일 때 상대가 Y만큼 베팅했다면, 콜하려면 몇 % 에쿼티가 필요한지 계산합니다.
        </p>
      </div>

      {/* Inputs */}
      <div className="flex flex-col gap-4">
        <label className="flex flex-col gap-1">
          <span className="text-sm text-gray-300">팟 (베팅 전)</span>
          <input
            type="number"
            inputMode="decimal"
            min={0}
            value={pot}
            onChange={(e) => setPot(e.target.value)}
            placeholder="예: 100"
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-base focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm text-gray-300">상대 베팅</span>
          <input
            type="number"
            inputMode="decimal"
            min={0}
            value={bet}
            onChange={(e) => setBet(e.target.value)}
            placeholder="예: 50"
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-base focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </label>

        {/* Quick bet-size buttons */}
        <div className="flex flex-wrap gap-2">
          {BET_SIZES.map(({ label, fraction }) => (
            <button
              key={label}
              type="button"
              onClick={() => applyBetSize(fraction)}
              disabled={!isFinite(potNum) || potNum <= 0}
              className="px-3 py-1.5 text-sm rounded-lg bg-gray-800 text-gray-300 hover:bg-indigo-600 hover:text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-gray-800 disabled:hover:text-gray-300"
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Results */}
      {result ? (
        <div className="bg-gray-900 border border-gray-700 rounded-xl p-5 flex flex-col gap-4">
          <div className="text-center">
            <div className="text-xs text-gray-400 uppercase tracking-wide">필요 에쿼티</div>
            <div className="text-4xl font-bold text-indigo-400 mt-1">
              {result.requiredEquity.toFixed(1)}%
            </div>
          </div>
          <div className="text-center text-sm text-gray-300">
            팟오즈 <b className="text-white">{fmt(result.potOdds)} : 1</b>
          </div>
        </div>
      ) : (
        <div className="text-center text-sm text-gray-500 py-6">
          팟과 베팅 금액을 입력하세요
        </div>
      )}

      {/* My-equity comparison */}
      <div className="flex flex-col gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-sm text-gray-300">내 에쿼티 (%)</span>
          <input
            type="number"
            inputMode="decimal"
            min={0}
            max={100}
            value={myEquity}
            onChange={(e) => setMyEquity(e.target.value)}
            placeholder="예: 35"
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-base focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </label>

        {verdict && (
          <div
            className={`rounded-xl p-4 text-center ${
              verdict.isCall
                ? 'bg-green-900/40 border border-green-600'
                : 'bg-red-900/40 border border-red-600'
            }`}
          >
            <div
              className={`text-2xl font-bold ${
                verdict.isCall ? 'text-green-400' : 'text-red-400'
              }`}
            >
              {verdict.isCall ? '콜 (+EV)' : '폴드'}
            </div>
            <div className="text-xs text-gray-300 mt-1">
              필요 {result!.requiredEquity.toFixed(1)}% 대비{' '}
              {verdict.margin >= 0 ? '+' : ''}
              {verdict.margin.toFixed(1)}%p
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
