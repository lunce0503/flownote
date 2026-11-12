import {test} from '@playwright/test';
import {registerCodeNotes} from './helpers/code-notes';
test.use({browserName:'webkit',viewport:{width:390,height:844},isMobile:true,hasTouch:true});
registerCodeNotes('webkit');
