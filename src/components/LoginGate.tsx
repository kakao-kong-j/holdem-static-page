const ERROR_MESSAGES: Record<string, string> = {
  password: '비밀번호가 올바르지 않습니다.',
  state: '로그인 세션이 만료되었습니다. 다시 시도해 주세요.',
  config: '서버 설정 오류입니다. 관리자에게 문의하세요.',
  exchange: '구글 인증에 실패했습니다. 다시 시도해 주세요.',
};

export function LoginGate() {
  const params = new URLSearchParams(window.location.search);
  const errorCode = params.get('login_error');
  const errorMessage = errorCode ? ERROR_MESSAGES[errorCode] ?? '로그인에 실패했습니다.' : null;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900">
      <form
        method="POST"
        action="/api/auth/google"
        className="bg-gray-800 rounded-xl p-8 w-full max-w-sm mx-4 shadow-2xl"
      >
        <h1 className="text-xl font-bold text-white text-center mb-1">GTO Preflop Charts</h1>
        <p className="text-sm text-gray-400 text-center mb-6">비밀번호 입력 후 로그인하세요</p>

        <input
          type="password"
          name="password"
          required
          autoFocus
          placeholder="비밀번호"
          className="mb-4 w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-indigo-500"
        />

        {errorMessage && (
          <p className="text-red-400 text-sm text-center mb-4">{errorMessage}</p>
        )}

        <button
          type="submit"
          className="w-full flex items-center justify-center gap-3 py-3 bg-white text-gray-800 font-medium rounded-lg hover:bg-gray-100 transition-colors"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" aria-hidden="true">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
          </svg>
          Google로 로그인
        </button>
      </form>
    </div>
  );
}
