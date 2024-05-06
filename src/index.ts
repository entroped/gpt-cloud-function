import * as ff from '@google-cloud/functions-framework';

ff.http('gpt-cloud-function', (req: ff.Request, res: ff.Response) => {
    res.send('OK');
});
