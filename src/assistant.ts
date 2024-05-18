import OpenAI from "openai";
import * as fs from "fs";
import {delay} from "./utils";
import {ChatMessage, ChatResponse} from "./types";
import {Run} from "openai/resources/beta/threads";
import LastError = Run.LastError;


const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});
const pollingInterval = 5000;
const config = {
    NAME: process.env.NAME,
    INSTRUCTIONS: process.env.INSTRUCTIONS,
    INITIAL_INSTRUCTIONS: process.env.INITIAL_INSTRUCTIONS,
}

export async function clearAssistants() {
    const assistants = await openai.beta.assistants.list();

    for(let i = 0; assistants.data[i]; i++) {
        const assistant = assistants.data[i];

        if (assistant) {
            if (assistant.tool_resources &&
                assistant.tool_resources.file_search &&
                assistant.tool_resources.file_search.vector_store_ids) {
                const vectorStoreId = assistant.tool_resources.file_search.vector_store_ids[0];
                if (vectorStoreId) {
                    await openai.beta.vectorStores.del(vectorStoreId);
                }
            }
            await openai.beta.assistants.del(assistant.id);
        }
    }
}

/**
 * @name createAssistant
 * @description Create an assistant with JSON support and assign knowledge to it, so it can answer questions about any topic
 * @param {string[]} knowledgeSources - File path references for the knowledge files that the assistant will use as reference
 */
export async function createAssistant(knowledgeSources: string[] = ["../knowledge.txt"]) {
    const assistant =  await openai.beta.assistants.create({
        instructions:
        config.INSTRUCTIONS,
        name: config.NAME,
        tools: [{type: "file_search"}],
        model: "gpt-3.5-turbo"/*,
        response_format: {
            type: "json_object"
        }*/
    });

    const vectorStore = await openai.beta.vectorStores.create({
        name: config.NAME,
    });

    const knowledgeBase = knowledgeSources
        .filter(source => fs.existsSync(source))
        .map(path=> fs.createReadStream(path));
    if (knowledgeBase.length) {
        const result = await openai.beta.vectorStores.fileBatches.uploadAndPoll(vectorStore.id, {files: knowledgeBase})
        if (result.vector_store_id) {
            await openai.beta.assistants.update(assistant.id, {
                tool_resources: { file_search: { vector_store_ids: [result.vector_store_id] } },
            });
        }

    }

    return assistant;
}


/**
 * @name getAssistant
 * @description Returns the current active assistant with the same name or create one
 */
export async function getAssistant() {
    const assistants = await openai.beta.assistants.list();
    const matchingAssistant = assistants.data
        .find(assistant => assistant.name === config.NAME)
    if (matchingAssistant) {
        return matchingAssistant;
    }

    return createAssistant();
}


/**
 * @name sendMessage
 * @description Send the user message to the OpenAI Assistant, and return with the answer
 * @param {ChatMessage}
 * @property {ChatMessage} content - Raw message content that the user sends to the AI
 * @property {string|undefined} threadId - The id of the thread our messages/history is connected to
 */
export async function sendMessage({content, threadId}: ChatMessage): Promise<ChatResponse> {
    // If there is no thread, create one to keep the user interactions in the same context, and support history
    if (!threadId) {
        const thread = await openai.beta.threads.create();
        threadId = thread.id;
    }

    console.log('Get Assistant');
    const assistant = await getAssistant();

    // Append our message to the current thread
    await openai.beta.threads.messages.create(
        threadId,
        { role: "user", content: content }
    );

    // Run the Assistant and instruct to answer to the user
    const run = await openai.beta.threads.runs.create(
        threadId,
        {
            assistant_id: assistant.id,
            instructions: config.INITIAL_INSTRUCTIONS,
        }
    );

    let result,
        retrieve,
        status = run.status,
        maximumTries = 0,
        lastError;


    console.log('Waiting answer');
    while (status === 'queued' || status === 'in_progress') {
        try {
            retrieve = await openai.beta.threads.runs.retrieve(threadId, run.id);
            status = retrieve.status;
            maximumTries++;

            if (retrieve.status === "completed") {
                const list = await openai.beta.threads.messages.list(threadId);
                if (list && Array.isArray(list.data)) {
                    result = list.data;
                } else {
                    lastError = {
                        code: "server_error",
                        message: "Response doesn't contain valid message thread"
                    } as LastError;
                }
                break;
            } else if (retrieve.status === "queued" || retrieve.status === "in_progress") {
                // Polling delay to prevent too frequent requests
                if (maximumTries >= 10) {
                    console.log('Timeout ' + maximumTries + ' seconds');
                    break;
                }
                await delay(pollingInterval); // 5 seconds delay
            } else if (retrieve.status === "failed" && retrieve.last_error) {
                lastError = retrieve.last_error;
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
        threadId: threadId,
        status: status,
        runId: run.id,
        lastError: lastError
    }
}
