import {MessagesPage, RunStatus} from "openai/resources/beta/threads";

export interface ChatMessage {
    content: string,
    threadId?: string
}

export interface ChatResponse {
    result?:  MessagesPage,
    threadId: string,
    status: RunStatus
}
