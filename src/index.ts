import * as ff from '@google-cloud/functions-framework';
import dotenv from 'dotenv';
import {sendMessage} from "./assistant";
import {ChatMessage} from "./types";

dotenv.config({
    path: process.cwd() + '/.env'
});

const supportedContentTypes = [
    'application/json',
    'application/x-www-form-urlencoded'
];

ff.http('gpt-cloud-function', async (req: ff.Request, res: ff.Response) => {
    if (req.method === 'OPTIONS') {
        // Send response to OPTIONS requests
        res.set('Access-Control-Allow-Methods', 'POST');
        res.set('Access-Control-Allow-Headers', 'Content-Type');
        res.set('Access-Control-Max-Age', '3600');
        res.sendStatus(204);
    } else if (req.method === 'POST') {
        const contentType = req.get('content-type');
        if (!contentType || !supportedContentTypes.includes(contentType)) {
            // Bad Request
            return res.sendStatus(400);
        }
        if (!req.body || !req.body.content) {
            // Bas Request === Missing the whole body or the content
            return res.status(400).set('Missing one or more required fields: content');
        }
        const response = await sendMessage(req.body as ChatMessage);
        res.status(200).send(response);
    } else {
        // Method is not supported error
        res.sendStatus(405);
    }
});
