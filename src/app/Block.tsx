import { useState } from "react";


function Block() {

    const [title, setTitle]= useState("Block Title"); 
    const [edit, setEdit]= useState("Edit");
    const [state, setState]= useState("preview");
    

    return (
        <>
            <div className="block-header">
                <h2 id="block-head-title">{title}</h2>
            </div>  
            <div className="block-body">
                <textarea name="" id=""></textarea>
            </div>

            <div className="block-footer">
                <button>{edit}</button>
                <button>{state}</button>
                
            </div>
        </> 
    );
}

export default Block;