const FX_URL =
  'https://m.search.naver.com/p/csearch/content/qapirender.nhn' +
  '?key=calculator&pkid=141&q=%ED%99%98%EC%9C%A8&where=m' +
  '&u1=keb&u6=standardUnit&u7=0&u3=USD&u4=KRW&u8=down&u2=1';

interface FxResponse {
  country?: { value?: string; currencyUnit?: string }[];
}

/** USD→KRW rate from Naver calculator API. null on any failure. */
export async function fetchUsdKrwRate(): Promise<number | null> {
  try {
    const res = await fetch(FX_URL);
    if (!res.ok) return null;
    const data = (await res.json()) as FxResponse;
    const raw = data.country?.[1]?.value;
    if (!raw) return null;
    const n = parseFloat(raw.replace(/,/g, ''));
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}
