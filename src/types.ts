import {Run, RunStatus, ThreadCreateParams, Message} from "openai/resources/beta/threads";
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
