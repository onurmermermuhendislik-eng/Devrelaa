import { start } from './core/app.js';

// Cocuk uygulamasi: uzun basma menusu, secim ve yakinlastirma kapali.
window.addEventListener('contextmenu', (e) => e.preventDefault());
start(document.getElementById('app'));
