import { render } from 'preact';
import 'katex/dist/katex.min.css';
import '@fontsource/cinzel/700.css';
import '@fontsource/dotgothic16/400.css';
import { App } from './app';
import { installSyncHooks, loadCachedUnlock } from './engine/sync';

loadCachedUnlock();
installSyncHooks();

render(<App />, document.getElementById('app')!);
