import { useState } from 'react';

interface Props {
  onLogin: (password: string) => Promise<boolean>;
}

export function PasswordGate({ onLogin }: Props) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!password || loading) return;
    setLoading(true);
    setError(false);
    const ok = await onLogin(password);
    if (!ok) {
      setError(true);
      setPassword('');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900">
      <div className="bg-gray-800 rounded-xl p-8 w-full max-w-sm mx-4 shadow-2xl">
        <h1 className="text-xl font-bold text-white text-center mb-6">
          GTO Preflop Charts
        </h1>

        <div className="space-y-4">
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSubmit()}
            placeholder="비밀번호 입력"
            autoFocus
            className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-indigo-500"
          />

          {error && (
            <p className="text-red-400 text-sm text-center">
              비밀번호가 틀렸습니다
            </p>
          )}

          <button
            onClick={handleSubmit}
            disabled={loading || !password}
            className="w-full py-3 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? '확인 중...' : '확인'}
          </button>
        </div>
      </div>
    </div>
  );
}
