interface ChatMessage {
    id: string;
    sender: 'user' | 'assistant' ;
    timestamp: Date;
    message: string;
}

export type { ChatMessage };