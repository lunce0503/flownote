import {test} from '@playwright/test';
import { registerCanvasSafety } from './helpers/canvas-safety';
test.use({browserName:'webkit'});
registerCanvasSafety('webkit');
