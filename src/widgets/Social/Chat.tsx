import React, { useState, useRef, useEffect } from "react";
import axios from 'axios';
// 1. 타입 정의 
interface ChatMessage {
    id: string;
    sender: 'user' | 'assistant' | 'bot';
    timestamp: Date;
    message: string;
}

// 2. 메시지 블록 컴포넌트 
const ChatBlock = ({ sender, message }: ChatMessage) => {
    const isUser = sender === "user";
    return (
        <div className={`flex w-full mb-4 ${isUser ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[70%] p-3 rounded-2xl shadow-sm ${
                isUser 
                ? 'bg-blue-500 text-white rounded-tr-none' 
                : 'bg-white text-black border border-gray-200 rounded-tl-none'
            }`}>
                <p className="whitespace-pre-wrap text-sm">{message}</p>
            </div>
        </div>
    );
};

// 3. 전송 바 컴포넌트 
const ChatSendBlock = ({ onSend }: { onSend: (text: string) => void }) => {
    const editableRef = useRef<HTMLDivElement>(null);

    const handleInternalSend = () => {
        const text = editableRef.current?.innerText || "";
        if (text.trim()) {
            onSend(text);
            if (editableRef.current) editableRef.current.innerText = ""; // 전송 후 입력창 비우기
        }
    };

    return (
        <div className="flex items-end gap-2 p-4 border-t bg-gray-50">
            <div className="flex-1 bg-white border border-gray-300 p-3 rounded-xl focus-within:ring-2 focus-within:ring-blue-400 transition-all">
                <div 
                    ref={editableRef}
                    contentEditable 
                    role="textbox"
                    aria-multiline="true"
                    className="outline-none text-stone-800 min-h-[24px] max-h-40 overflow-y-auto"
                    onKeyDown={(e) => {
                        // Enter로 전송 (Shift+Enter는 줄바꿈)
                        if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleInternalSend();
                        }
                    }}
                />
            </div>
            <button 
                className="bg-blue-600 hover:bg-blue-700 active:scale-95 text-white px-5 py-2 rounded-xl font-medium transition-all"
                onClick={handleInternalSend}
            >
                전송
            </button>
        </div>
    );
};

// 4. 메인 채팅 컴포넌트
const Chat = () => {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    
    useEffect(() => {
        const getMessages = async () => {
            const response = await axios.get('http://127.0.0.1:8000/api/chat');
            setMessages(response.data); // .json() 과정 없이 바로 .data로 접근
        };
        getMessages();
    },[]);

    const handleSend = async (text: string) => {
        const userMessage: ChatMessage = {
            id: crypto.randomUUID(), // 고유 ID 생성
            sender: "user",
            timestamp: new Date(),
            message: text,
        };
        setMessages(prev => [...prev, userMessage]);
        setIsLoading(true);
        try {
            const response = await fetch("http://localhost:8000/api/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ message: text, sender : "user" , timestamp : new Date(), id : crypto.randomUUID()}),
            });
            const data = await response.json();
            console.log(data.message);
            console.log(data);
        } catch (error) {
            console.error("Error sending message:", error);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex flex-col h-[600px] max-w-lg mx-auto border rounded-2xl overflow-hidden shadow-xl bg-gray-100">
            <div className="flex-1 overflow-y-auto p-4 flex flex-col">
                {messages.length === 0 }
                {messages.map((msg) => (
                    <ChatBlock key={msg.id} {...msg} />
                ))}
            </div>
            <ChatSendBlock onSend={handleSend} />
        </div>
    ); 
};

export default Chat;