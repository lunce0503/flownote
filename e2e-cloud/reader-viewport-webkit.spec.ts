import {test} from '@playwright/test';
import {registerReaderViewport} from './helpers/reader-viewport';
test.use({browserName:'webkit'});
registerReaderViewport({width:820,height:1180,engine:'webkit',app:true});
