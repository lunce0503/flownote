import { useState , useRef, useEffect } from "react";
import HandleIcon from '../../../shared/assets/BlockHandleIcon.png';
import './BlogBlock.css';

interface Propers {
    size: number;
    posion: {x: number, y: number};
}

const TextBlock = () => {
    const [isEdited, setIsEdited]= useState<boolean>(true);
    const textBlockRef = useRef<HTMLDivElement>(null);
    
    const onDoubleClick = (e: React.MouseEvent) => {
        if (e.button === 0){
            setIsEdited(!isEdited);
            console.log("Block clicked",isEdited);
        }
        return isEdited
    };

    return (
        <div
            onDoubleClick={onDoubleClick}
            className="text-block p-2 rounded-md" 
            contentEditable={isEdited} ref={textBlockRef} 
        >
        </div>
    );
};

const ImageBlock =() => {
    return (
        <div>

        </div>
    );
}

const Block = () => {
    const currentBlocks : HTMLDivElement[] = [];
    currentBlocks.push(<TextBlock/> as unknown as HTMLDivElement);
    currentBlocks.push(<TextBlock/> as unknown as HTMLDivElement);
    currentBlocks.push(<TextBlock/> as unknown as HTMLDivElement);
    currentBlocks.push(<TextBlock/> as unknown as HTMLDivElement);
    currentBlocks.push(<TextBlock/> as unknown as HTMLDivElement);
    currentBlocks.push(<TextBlock/> as unknown as HTMLDivElement);

    useEffect(() => {
        return () => {
            currentBlocks.push(<TextBlock/> as unknown as HTMLDivElement);
        }
    },[currentBlocks])

    return (
        <div className="block-component flex justify-between m-4 rounded-lg text-black bg-white"
        >
            {currentBlocks.map((block: HTMLDivElement) => (
                <TextBlock key={block.id} />
            ))}
        </div>
    );
}

export default Block;