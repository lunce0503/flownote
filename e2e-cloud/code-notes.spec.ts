import {test} from '@playwright/test';
import {registerCodeNotes} from './helpers/code-notes';
test.use({viewport:{width:1440,height:1000}});
registerCodeNotes('chromium');
