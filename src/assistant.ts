import OpenAI from "openai";
import config from "../assistant-config.json";
import * as fs from "fs";

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});
const pollingInterval = 5000;

export async function createAssistant() {
    return openai.beta.assistants.create({
        instructions:
        config.instructions,
        name: config.name,
        tools: [{type: "file_search"}],
        model: "gpt-3.5-turbo",
        response_format: {
            type: "json_object"
        }
    });
}

export async function getAssistant() {
    const assistants = await openai.beta.assistants.list();
    if (assistants.data.length) {
        return assistants.data[0];
    }

    return createAssistant();
}

export async function sendMessage(message: string, threadId?: string, knowledgeBase?: fs.ReadStream[]) {
    if (!threadId) {
        const thread = await openai.beta.threads.create();
        threadId = thread.id;
    }
    const assistant = await getAssistant();

    if (!knowledgeBase && fs.existsSync("../knowledge.txt")) {
        const vectorStore = await openai.beta.vectorStores.create({
            name: config.name,
        });

        knowledgeBase = ['../knowledge.txt"'].map(path=> fs.createReadStream(path));
        await openai.beta.vectorStores.fileBatches.uploadAndPoll(vectorStore.id, {files: knowledgeBase})
        await openai.beta.assistants.update(assistant.id, {
            tool_resources: { file_search: { vector_store_ids: [vectorStore.id] } },
        });
    }


    const threadMessages = await openai.beta.threads.messages.create(
        threadId,
        { role: "user", content: message }
    );

    const run = await openai.beta.threads.runs.create(
        threadId,
        {
            assistant_id: assistant.id,
            instructions: config.initial_instruction,
        }
    );

    let result,
        retrieve;

    while (run.status === 'queued' || run.status === 'in_progress') {
        try {
            retrieve = await openai.beta.threads.runs.retrieve(threadId, run.id);

            if (retrieve.status === "completed") {
                result = await openai.beta.threads.messages.list(threadId);
                break;
            } else if (retrieve.status === "queued" || retrieve.status === "in_progress") {
                // Polling delay to prevent too frequent requests
                await new Promise(resolve => setTimeout(resolve, pollingInterval)); // 5 seconds delay
            } else {
                console.log(`Unexpected Run status: ${retrieve.status}`);
                break;
            }
        } catch (error) {
            console.error("Error retrieving run status:", error);
            break;
        }
    }

    return {
        result: result,
        knowledgeBase: knowledgeBase,
        threadId: threadId
    }
}
