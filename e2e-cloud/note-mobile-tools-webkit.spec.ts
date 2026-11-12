import { test } from '@playwright/test';
import { registerNoteMobileTools } from './helpers/note-mobile-tools';

test.use({ browserName: 'webkit', hasTouch: true, isMobile: true, viewport: { width: 390, height: 900 } });
registerNoteMobileTools('webkit');
