import React from "react";

import Canvas from "../app/canvas";
import Block from "../app/Block";

export default function MainContent() {
    return (
        <>  
            <div className="skedule-viewer">
                <h3>Schedule Viewer</h3>
            </div>
            <Canvas />
            <Block />
        </>
    );
}