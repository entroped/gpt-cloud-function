import OpenAI from "openai";
import config from "../assistant-config.json";
import * as fs from "fs";
import {delay} from "./utils";
import {ChatMessage, ChatResponse} from "./types";


const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});
const pollingInterval = 5000;


/**
 * @name createAssistant
 * @description Create an assistant with JSON support and assign knowledge to it, so it can answer questions about any topic
 * @param {string[]} knowledgeSources - File path references for the knowledge files that the assistant will use as reference
 */
export async function createAssistant(knowledgeSources: string[] = ["../knowledge.txt"]) {
    const assistant =  await openai.beta.assistants.create({
        instructions:
        config.instructions,
        name: config.name,
        tools: [{type: "file_search"}],
        model: "gpt-3.5-turbo",
        response_format: {
            type: "json_object"
        }
    });

    const vectorStore = await openai.beta.vectorStores.create({
        name: config.name,
    });

    const knowledgeBase = knowledgeSources
        .filter(source => fs.existsSync(source))
        .map(path=> fs.createReadStream(path));
    if (knowledgeBase.length) {
        await openai.beta.vectorStores.fileBatches.uploadAndPoll(vectorStore.id, {files: knowledgeBase})
        await openai.beta.assistants.update(assistant.id, {
            tool_resources: { file_search: { vector_store_ids: [vectorStore.id] } },
        });
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
        .find(assistant => assistant.name === config.name)
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
            instructions: config.initial_instruction,
        }
    );

    let result,
        retrieve,
        status = run.status;


    while (run.status === 'queued' || run.status === 'in_progress') {
        try {
            retrieve = await openai.beta.threads.runs.retrieve(threadId, run.id);

            if (retrieve.status === "completed") {
                result = await openai.beta.threads.messages.list(threadId);
                break;
            } else if (retrieve.status === "queued" || retrieve.status === "in_progress") {
                // Polling delay to prevent too frequent requests
                await delay(pollingInterval); // 5 seconds delay
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
        status: status
    }
}
