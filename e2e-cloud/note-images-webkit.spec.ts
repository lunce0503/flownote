import {test} from '@playwright/test';
import {registerNoteImages} from './helpers/note-images';
test.use({browserName:'webkit'});
registerNoteImages('webkit');
