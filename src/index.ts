import * as ff from '@google-cloud/functions-framework';
import dotenv from 'dotenv';

dotenv.config({
    path: process.cwd() + '/.env'
});

ff.http('gpt-cloud-function', (req: ff.Request, res: ff.Response) => {
    res.send('OK');
});
