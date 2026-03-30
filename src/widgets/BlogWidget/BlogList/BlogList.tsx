import { useState, type ReactElement } from "react";
interface BlogViewerBlockProps{
    title : String;
    preview? : ReactElement;
}

// const 
const BlogViewerBlock = ({title}: BlogViewerBlockProps ) => {
    return (
        <div>

        </div>
    );
};

const Bloglist = () => {
    const [notes, setNotes] = useState<number[]>([1,2]);

    return (
        <div>
            {notes.map((note,index)=>(
                <BlogViewerBlock key={index} />
            ))}
        </div>
    )

}

export default Bloglist;