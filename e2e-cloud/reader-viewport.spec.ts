import {registerReaderViewport} from './helpers/reader-viewport';
for(const spec of [{width:390,height:844,app:true},{width:600,height:480,app:false},{width:1440,height:900,app:false}])registerReaderViewport({...spec,engine:'chromium'});
