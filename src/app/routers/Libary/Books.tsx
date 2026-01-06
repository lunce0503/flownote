import React from "react";
import { usePDF } from "@react-pdf/renderer";

const Books = () => {
    const [toPDF, targetRef] = usePDF("pdf.pdf");
    <div>
         <button onClick={() => {toPDF}}>Download PDF</button>
         <div ref={targetRef}>
            Content to be generated to PDF
         </div>
    </div>
}

export default Books;