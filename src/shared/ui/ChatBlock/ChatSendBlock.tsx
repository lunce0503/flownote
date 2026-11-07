<<<<<<< HEAD
import { useRef,useState } from "react";

const ChatSendBlock = ({ onSend, onMode, isAsking}: { onSend: (text: string) => void; onMode: () => void; isAsking:boolean}) => {
    const editableRef = useRef<HTMLDivElement>(null);
    
    const handleInternalSend = () => {
        const text = editableRef.current?.innerText || "";
        if (text.trim()) {
=======
import { useEffect, useRef, type ReactNode } from "react";

type ChatSendBlockProps = {
    onSend: (text: string) => void;
    disabled?: boolean;
    draftText?: string;
    draftKey?: number;
    actionSlot?: ReactNode;
    canSendEmpty?: boolean;
};

const ChatSendBlock = ({ onSend, disabled = false, draftText, draftKey, actionSlot, canSendEmpty = false }: ChatSendBlockProps) => {
    const editableRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!draftText || !editableRef.current) return;

        editableRef.current.innerText = draftText;
        editableRef.current.focus();
    }, [draftText, draftKey]);
    
    const handleInternalSend = () => {
        const text = editableRef.current?.innerText || "";
        if (text.trim() || canSendEmpty) {
>>>>>>> 678fcbf (separate repository to flownote-service)
            onSend(text);
            if (editableRef.current) editableRef.current.innerText = ""; // 전송 후 입력창 비우기
        }
    };
    
    return (
        <div className="flex items-end gap-2 p-4 border-t bg-gray-100">
<<<<<<< HEAD
            <button className={`mode-button  w-12 h-10 rounded-xl font-bold transition-all ease-in-out ${ 
                isAsking 
                ? 'bg-blue-600  text-white hover:bg-blue-700' 
                : 'bg-gray-800 text-white hover:bg-gray-900'}`}
                onClick={onMode} 
            >
                AI
            </button>
=======
            {actionSlot}
>>>>>>> 678fcbf (separate repository to flownote-service)
            <div className="flex-1 bg-white border border-gray-300 p-3 rounded-xl focus-within:ring-2 focus-within:ring-blue-400 transition-all">
                <div 
                    className="textbox outline-none text-stone-800 min-h-6 max-h-40 overflow-y-auto"
                    ref={editableRef}
<<<<<<< HEAD
                    contentEditable 
                    role="textbox"
                    aria-multiline="true"
=======
                    contentEditable={!disabled}
                    role="textbox"
                    aria-multiline="true"
                    aria-disabled={disabled}
>>>>>>> 678fcbf (separate repository to flownote-service)
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleInternalSend();
                        }
                    }}
                />
            </div>
            <button 
<<<<<<< HEAD
                className="bg-blue-600 hover:bg-blue-700 active:scale-95 text-white px-5 py-2 rounded-xl font-medium transition-all"
                onClick={handleInternalSend}
=======
                className="bg-blue-600 hover:bg-blue-700 active:scale-95 disabled:cursor-not-allowed disabled:bg-gray-400 text-white px-5 py-2 rounded-xl font-medium transition-all"
                onClick={handleInternalSend}
                disabled={disabled}
>>>>>>> 678fcbf (separate repository to flownote-service)
            >
                Send
            </button>
        </div>
    );
};

<<<<<<< HEAD
export default ChatSendBlock;
=======
export default ChatSendBlock;
>>>>>>> 678fcbf (separate repository to flownote-service)
