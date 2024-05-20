import * as ff from '@google-cloud/functions-framework';
import dotenv from 'dotenv';

dotenv.config({
    path: process.cwd() + '/.env'
});

import {AssistantManager} from "./assistant";
import {ChatMessage} from "./types";
import {getOpenApiSecret} from "./utils";

const supportedContentTypes = [
    'application/json',
    'application/x-www-form-urlencoded'
];

const initialConfig = {
    NAME: process.env.NAME,
    INSTRUCTIONS: process.env.INSTRUCTIONS,
    INITIAL_INSTRUCTIONS: process.env.INITIAL_INSTRUCTIONS,
}
let assistantManager: undefined|AssistantManager;

if (process.env.OPENAI_API_KEY) {
    assistantManager = new AssistantManager(process.env.OPENAI_API_KEY, initialConfig);
} else {
    getOpenApiSecret(process.env.OPENAI_SECRET_NAME || "OPENAI_API_KEY")
        .then((secret) => {
            if (secret) {
                assistantManager = new AssistantManager(secret, initialConfig);
            }
        });
}
ff.http('gpt-cloud-function', async (req: ff.Request, res: ff.Response) => {
    // Allow CORS Headers
    res.set('Access-Control-Allow-Origin', '*');

    if (req.method === 'OPTIONS') {
        // Send response to OPTIONS requests
        res.set('Access-Control-Allow-Methods', 'POST');
        res.set('Access-Control-Allow-Headers', 'Content-Type');
        res.set('Access-Control-Max-Age', '3600');
        res.sendStatus(204);
    } else if (req.method === 'POST') {
        if (!assistantManager) {
            return res.status(503).send('Server is not ready to accept requests yet.');
        }
        const contentType = req.get('content-type');
        if (!contentType || !supportedContentTypes.includes(contentType)) {
            // Bad Request
            return res.sendStatus(400);
        }
        if (!req.body || !req.body.content) {
            // Bas Request === Missing the whole body or the content
            return res.status(400).send('Missing one or more required fields: content');
        }
        const response = await assistantManager.send(req.body as ChatMessage);
        res.status(200).send(response);
    } else {
        // Method is not supported error
        res.sendStatus(405);
    }
});
