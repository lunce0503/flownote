import React from "react";

import Canvas from "../pages/canvas";
import Block from "./Block";

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