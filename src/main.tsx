import { render } from 'preact';
import 'katex/dist/katex.min.css';
import '@fontsource/cinzel/700.css';
import '@fontsource/dotgothic16/400.css';
import { App } from './app';
import { installSyncHooks, loadCachedUnlock } from './engine/sync';
import { installSessionWatch } from './engine/session';

loadCachedUnlock();
installSyncHooks();
installSessionWatch();

const root = document.getElementById('app')!;
// GAS の入口ページは「読み込み中…」を入れて待っているので、描く前に空にする
root.textContent = '';
render(<App />, root);
