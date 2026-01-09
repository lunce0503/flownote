import React, { useState , useRef, useEffect } from "react";
import HandleIcon from '../../../shared/assets/BlockHandleIcon.png';
import './BlogBlock.css';

interface BlockPropers {
    id : number;
    type: string|undefined;
    size: number;
    posion: {x: number, y: number};
    data: string; // text content, image url, video url, latex code etc.
}

interface BasePropers{
    content?: string
}

const Container= ({children} : {children: React.ReactNode}) => {
    return(
        <div className="container-component m-1 p-0">
            {children}
        </div>
    )
}

const TextBlock = (contentProp:BasePropers) => {
    const [isEditable, setIsEditable]= useState<boolean>(true);
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

const ImageBlock =(content:BasePropers) => {
    return (
        <div
            className="image-block "    
        >

        </div>
    );
}

const VideoBlock =(BasePropers:BasePropers)=>{
    return (
        <div>

        </div>
    );
}

const MathExpressionBlock = (BasePropers:BasePropers) => {
    return (
        <div>

        </div>
    );
}

const Block: React.FC<{Props: BlockPropers; onRemove: (id: number) => void}> = ({
    Props,
    onRemove,
    }) => {
    if(Props.type === 'text'){
        return (
            <Container>
                <TextBlock 
                    content={Props.data}
                />
            </Container>
        );}

    if(Props.type === 'image'){
        return (
            <Container>
                <ImageBlock 
                
                />
            </Container>
        );}

    if(Props.type ==='math'){
        return (
            <Container>
                <MathExpressionBlock
                
                />
            </Container>
        );}

    if(Props.type === 'video'){
        return (
            <Container>
                <VideoBlock
                    
                />
            </Container>
        );}
}

export default Block;