import axios from 'axios';
import { API_BASE_URL } from './config';

/** Keep tunnel headers scoped to our API, including refresh, uploads and polling. */
export function needsTunnelHeader(url: string, baseURL = API_BASE_URL): boolean {
  try {
    const target = new URL(url, baseURL);
    const api = new URL(API_BASE_URL);
    return target.origin === api.origin && /\.(ngrok-free\.app|ngrok-free\.dev|ngrok\.app|ngrok\.io)$/.test(target.hostname);
  } catch {
    return false;
  }
}

const apiTransport = axios.create();
apiTransport.interceptors.request.use(config => {
  if (needsTunnelHeader(config.url || '', config.baseURL || API_BASE_URL)) {
    config.headers.set('ngrok-skip-browser-warning', '1');
  }
  return config;
});

export default apiTransport;
