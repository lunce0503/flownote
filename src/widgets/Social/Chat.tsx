import React, { useState, useRef, useEffect } from "react";
import axios from 'axios';


import ReactMarkdownRender from "../../shared/ui/ReactMarkdownRender";

// 1. 타입 정의 
interface ChatMessage {
    id: string;
    sender: 'user' | 'assistant' ;
    timestamp: Date;
    message: string;
}

// 2. 메시지 블록 컴포넌트 
const ChatBlock = ({ sender, message }: ChatMessage) => {
    const isUser = sender === "user";

    return (
        <div className={`chat-block flex w-full mb-4 ${isUser ? 'justify-end' : 'justify-start'}`}>
            <div className={`chat-block-design max-w-[85%] p-3 rounded-2xl shadow-sm ${
                isUser 
                ? 'bg-blue-600 text-white rounded-tr-none' 
                : 'bg-white text-gray-800 border border-gray-200 rounded-tl-none'
            }`}>
                <div className="markdown-render text-sm leading-relaxed markdown-body">
                    <ReactMarkdownRender message={message}/>
                </div>
            </div>
        </div>
    );
};

// 3. 전송 바 컴포넌트 
const ChatSendBlock = ({ onSend, onMode }: { onSend: (text: string) => void; onMode: () => void}) => {
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
            <button className="mode-button"
                onClick={onMode} />
            <div className="flex-1 bg-white border border-gray-300 p-3 rounded-xl focus-within:ring-2 focus-within:ring-blue-400 transition-all">
                <div 
                    className="textbox outline-none text-stone-800 min-h-[24px] max-h-40 overflow-y-auto"
                    ref={editableRef}
                    contentEditable 
                    role="textbox"
                    aria-multiline="true"
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
    const [isAsking, setIsAsking] = useState(false);

    const chatContainerRef = useRef<HTMLDivElement>(null);
    
    const scrollToBottom = () => {
            if (chatContainerRef.current) {
                const container = chatContainerRef.current;
                container.scrollTo({
                    top: container.scrollHeight,
                    behavior: "auto"
                });
        }
    }

    const getMessages = async () => {
            const response = await axios.get('http://127.0.0.1:8000/api/chat');
            setMessages(response.data); 
        };

    
    const askAgent = async () => {
        try{
            const response = await fetch("http://localhost:8000/api/aiclient/ask_stream", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                // 현재 백엔드에서 받는 body가 없으므로 생략하거나 빈 객체 전달
                body: JSON.stringify({}), 
            });
            if (!response.body) throw new Error("응답 바디가 없습니다.");

            // 2. 스트림 읽기 준비
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let done = false;

            // AI의 답변을 담을 임시 변수
            let aiResponseText = "";

            // 3. 데이터 조각(Chunk) 반복해서 읽기
            while (!done) {
                const { value, done: doneReading } = await reader.read();   
                done = doneReading;
            
                // 8비트 숫자를 텍스트로 변환
                const chunk = decoder.decode(value, { stream: true });
                aiResponseText=aiResponseText+chunk;

                // 리액트 상태 업데이트 (실시간으로 글자가 타이핑되는 효과)
                setMessages((prev : ChatMessage[]) => {
                    const lastMsg = prev[prev.length - 1];
                    if (lastMsg && lastMsg.sender === "assistant") {
                        // 마지막 메시지가 assistant면 내용만 교체
                        return [...prev.slice(0, -1), { ...lastMsg, message: aiResponseText }];
                    } else {
                        const newAiMsg: ChatMessage = {
                            id: crypto.randomUUID(), // string 형식의 고유 ID
                            sender: "assistant",     // 리터럴 타입 'assistant' 일치
                            timestamp: new Date(),    // 필수 Date 객체 추가
                            message: aiResponseText,  // 현재까지 받은 텍스트
                        };
                        return [...prev, newAiMsg];
                    }
                });
            }
        } catch (error) {
            console.error("fetch error:", error)
        } finally{
            setIsAsking(false);
        }
    }

    const sendUserMessage = async (text:string) => {
        const userMessage: ChatMessage = {
                id: crypto.randomUUID(),
                sender: "user",
                timestamp: new Date(),
                message: text,
            };

            setMessages(prev => [...prev, userMessage]);
            setIsLoading(true);

            try {
                // axios.post(url, payload, config) 구조입니다.
                const response = await axios.post("http://localhost:8000/api/chat", {
                    message: text,
                    sender: "user",
                    timestamp: new Date(),
                    id: crypto.randomUUID()
                });

                // axios는 응답 바디가 자동으로 response.data에 담깁니다.
                const data = response.data; 
                
                console.log(data.message);
                console.log(data);
                
            } catch (error) {
                // axios 에러 핸들링
                if (axios.isAxiosError(error)) {
                    console.error("Axios Error:", error.response?.data || error.message);
                } else {
                    console.error("Unexpected Error:", error);
                }
            } finally {
                setIsLoading(false);
            }
    }

    const handleSend = async (text: string) => {
        if (isAsking === false) {
            sendUserMessage(text);
        } 
        
        if (isAsking === true) {
            sendUserMessage(text);
            console.log("AI mode");
            askAgent();
        }
    };

    const handleChatMode = () => {
        setIsAsking(!isAsking);
        // console.log(!isAsking);
    }

    // when first enter
    useEffect(() => {
        getMessages();
        scrollToBottom();
        // console.log(isAsking);
    },[]);

    // when update messages
    useEffect(() => {
        scrollToBottom();
    }, [messages]);


    return (
        <div className="flex flex-col h-[600px] max-w-lg mx-auto border rounded-2xl overflow-hidden shadow-xl bg-gray-100">
            <div ref={chatContainerRef}
                className="flex-1 overflow-y-auto p-4 flex flex-col"
            >
                {messages.length === 0 }
                {messages.map((msg) => (
                    <ChatBlock key={msg.id} {...msg} />
                ))}
            </div>
            <ChatSendBlock onSend={handleSend} onMode={handleChatMode}/>
        </div>
    ); 
};

export default Chat;