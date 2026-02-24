import React, { useState , useRef, useEffect } from "react";
import Sortable from "../../shared/lib/Sortable";
import './BlogBlock.css';

interface BlockPropers {
    id : string;
    index: number;
    type: 'text' | 'image' | 'video' | 'math' | null;
    size: number;
    posion: {x: number, y: number};
    data: string; // text content, image url, video url, latex code etc.
    children?: React.ReactNode;
}

interface BasePropers{
    content?: string
}


const TextBlock = (contentProp:BasePropers) => {
    const [isEditable, setIsEditable]= useState<boolean>(!true);
    const [content, setContent] = useState<string|undefined>(contentProp.content);
    const textBlockRef = useRef<HTMLDivElement>(null);
    
    const onDoubleClick = (e: React.MouseEvent) => {
        if (e.button === 0){
            setIsEditable(!isEditable);
            console.log("isEditable",isEditable);
        }
        return isEditable
    };

    const onInput = () => {
        useEffect(() => {
            console.log("isChaged",content)
            if (textBlockRef.current) {
                const newText = textBlockRef.current.innerText;
                setContent(newText);
            }
        }, [content]);
    };
   
    return (
        <div
            onInput={onInput}
            onDoubleClick={onDoubleClick}
            className="text-block p-2 min-w-1/5 bg-white rounded-md text-black" 
            contentEditable={!isEditable} ref={textBlockRef} 
            suppressContentEditableWarning={true}
        >{content}
        </div>
    );
};

const ImageBlock =({content}:BasePropers) => {
    return (
        <div
            className="image-block "    
        >
            <img src={content} alt={content} />
        </div>
    );
}

const VideoBlock =(content:BasePropers)=>{
    return (
        <div>

        </div>
    );
}

const MathExpressionBlock = (content:BasePropers) => {
    return (
        <div>
            
        </div>
    );
}

const Block: React.FC<{blockProps: BlockPropers; onRemove: (id: number) => void}> = ({
    blockProps,
    onRemove,
    }) => {

    if(blockProps.type === 'text'){
        return (
                <Sortable 
                    id={blockProps.id} index={blockProps.index}
                >
                    <TextBlock 
                        content={blockProps.data}
                    />
                </Sortable>
        );}

    if(blockProps.type === 'image'){
        return (
                <Sortable 
                    id={blockProps.id} index={blockProps.index}
                >
                    <ImageBlock 
                        content={blockProps.data}
                    />
                </Sortable>
        );}

    if(blockProps.type ==='math'){
        return (
                <Sortable 
                    id={blockProps.id} index={blockProps.index}
                >
                    <MathExpressionBlock
                
                />
                </Sortable>
        );
}
    if(blockProps.type === 'video'){
        return (
                <Sortable 
                    id={blockProps.id} index={blockProps.index}
                >
                    <VideoBlock
                        
                    />
                </Sortable>
        );}
}

export default Block;