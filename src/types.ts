import {Run, RunStatus, Message} from "openai/resources/beta/threads";
import LastError = Run.LastError;

export interface ChatMessage {
    content: string,
    threadId?: string
}

export interface ChatResponse {
    result?:  Message[],
    threadId: string,
    status: RunStatus,
    runId?: string,
    lastError?: LastError
}

export interface AssistantConfig {
    NAME?: string,
    INSTRUCTIONS?: string,
    INITIAL_INSTRUCTIONS?: string,
}

export interface AssistantDefaults {
    NAME: string,
    INSTRUCTIONS: string,
    INITIAL_INSTRUCTIONS: string,
    pollingInterval: number,
}
