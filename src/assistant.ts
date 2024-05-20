import OpenAI from "openai";
import * as fs from "fs";
import {delay} from "./utils";
import {AssistantConfig, AssistantDefaults, ChatMessage, ChatResponse} from "./types";
import {Run} from "openai/resources/beta/threads";
import LastError = Run.LastError;

const defaults: AssistantDefaults = {
    NAME: process.env.NAME || 'QC Chat Amanda',
    INSTRUCTIONS: process.env.INSTRUCTIONS || 'You are a personal customer assistant. When asked a question, clear, short, brief statements to answer the question.',
    INITIAL_INSTRUCTIONS: process.env.INITIAL_INSTRUCTIONS || 'Please address the user as Sir/Madam',
    pollingInterval: 5000
}

export class AssistantManager {
    private _config: AssistantConfig;
    private readonly _openai: OpenAI;
    private readonly _pollingInterval: number;
    constructor(apiKey: string, {NAME, INSTRUCTIONS, INITIAL_INSTRUCTIONS}: AssistantConfig) {
        this._config = {
            NAME: NAME || defaults.NAME,
            INSTRUCTIONS: INSTRUCTIONS || defaults.INSTRUCTIONS,
            INITIAL_INSTRUCTIONS: INITIAL_INSTRUCTIONS || defaults.INITIAL_INSTRUCTIONS,
        };
        this._openai = new OpenAI({
            apiKey: apiKey
        });
        this._pollingInterval = defaults.pollingInterval;
    }

    async clear() {
        const assistants = await this._openai.beta.assistants.list();

        for(let i = 0; assistants.data[i]; i++) {
            const assistant = assistants.data[i];

            if (assistant) {
                if (assistant.tool_resources &&
                    assistant.tool_resources.file_search &&
                    assistant.tool_resources.file_search.vector_store_ids) {
                    const vectorStoreId = assistant.tool_resources.file_search.vector_store_ids[0];
                    if (vectorStoreId) {
                        await this._openai.beta.vectorStores.del(vectorStoreId);
                    }
                }
                await this._openai.beta.assistants.del(assistant.id);
            }
        }
    }

    /**
     * @name add
     * @description Create an assistant with JSON support and assign knowledge to it, so it can answer questions about any topic
     * @param {string[]} knowledgeSources - File path references for the knowledge files that the assistant will use as reference
     */
    async add(knowledgeSources: string[] = ["../knowledge.txt"]) {
        const assistant =  await this._openai.beta.assistants.create({
            instructions:
            this._config.INSTRUCTIONS,
            name: this._config.NAME,
            tools: [{type: "file_search"}],
            model: "gpt-3.5-turbo"/*,
        response_format: {
            type: "json_object"
        }*/
        });

        const vectorStore = await this._openai.beta.vectorStores.create({
            name: this._config.NAME,
        });

        const knowledgeBase = knowledgeSources
            .filter(source => fs.existsSync(source))
            .map(path=> fs.createReadStream(path));
        if (knowledgeBase.length) {
            const result = await this._openai.beta.vectorStores.fileBatches.uploadAndPoll(vectorStore.id, {files: knowledgeBase})
            if (result.vector_store_id) {
                await this._openai.beta.assistants.update(assistant.id, {
                    tool_resources: { file_search: { vector_store_ids: [result.vector_store_id] } },
                });
            }

        }

        return assistant;
    }

    /**
     * @name get
     * @description Returns the current active assistant with the same name or create one
     */
    async get() {
        const assistants = await this._openai.beta.assistants.list();
        const matchingAssistant = assistants.data
            .find(assistant => assistant.name === this._config.NAME)
        if (matchingAssistant) {
            return matchingAssistant;
        }

        return this.add();
    }

    /**
     * @name send
     * @description Send the user message to the OpenAI Assistant, and return with the answer
     * @param {ChatMessage}
     * @property {ChatMessage} content - Raw message content that the user sends to the AI
     * @property {string|undefined} threadId - The id of the thread our messages/history is connected to
     */
    async send({content, threadId}: ChatMessage): Promise<ChatResponse> {
        // If there is no thread, create one to keep the user interactions in the same context, and support history
        if (!threadId) {
            const thread = await this._openai.beta.threads.create();
            threadId = thread.id;
        }

        console.log('Get Assistant');
        const assistant = await this.get();

        // Append our message to the current thread
        await this._openai.beta.threads.messages.create(
            threadId,
            { role: "user", content: content }
        );

        // Run the Assistant and instruct to answer to the user
        const run = await this._openai.beta.threads.runs.create(
            threadId,
            {
                assistant_id: assistant.id,
                instructions: this._config.INITIAL_INSTRUCTIONS,
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
                retrieve = await this._openai.beta.threads.runs.retrieve(threadId, run.id);
                status = retrieve.status;
                maximumTries++;

                if (retrieve.status === "completed") {
                    const list = await this._openai.beta.threads.messages.list(threadId);
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
                    await delay(this._pollingInterval); // 5 seconds delay
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
}
