import React,{use, useRef, useState}from "react";
import './magic.css'

type Rune = {
    id: number
    name: string
    simbool: string
    description: string
}

const Magic = () => {
    const resetButton = useRef<HTMLButtonElement>(null);
    const runePalette = useRef<HTMLDivElement>(null);
    const magicCircleSvg = useRef<SVGSVGElement>(null);
    const statusMessage = useRef<HTMLDivElement>(null);

    const runeButton = useRef<HTMLButtonElement>(null);
    const runetype: Rune[] = [
        {id:1, name:"기초", simbool:"△", description:"기초 룬입니다."},
        {id:2, name:"증폭", simbool:"▲", description:"마법의 위력을 증폭시킵니다."},
        {id:3, name:"치유", simbool:"✚", description:"상처를 치유합니다."},
        {id:4, name:"소환", simbool:"⬢", description:"대상을 소환합니다"},
        {id:5, name:"보호", simbool:"⬡", description:"대상을 보호합니다."}
    ];

    for(let i=0; i<runetype.length; i++){
        runeButton.current = document.createElement("button");
        runeButton.current.textContent = runetype[i].simbool + " " + runetype[i].name;
        runePalette.current?.appendChild(runeButton.current);
    };

    return (
        <div className="container">
            <div className="controls-panel">
                <h2 className="title-header">마법진 제어판</h2>
                
                <div>
                    <h3>기본 조작</h3>
                    <button ref={resetButton} className="control-button">초기화 (Reset)</button>
                    <p className="text-xs text-gray-400 mt-1 mb-3">Shift 키: 원 생성 / 마법 발동</p>
                </div>

                <div>
                    <h3>룬 목록</h3>
                    <div ref={runePalette} className="rune-palette">
                        </div>
                </div>

                
            </div>
            <div className="flex flex-col items-center w-full">
                <svg ref={magicCircleSvg} viewBox="0 0 500 500" preserveAspectRatio="xMidYMid meet"></svg>
                <div ref={statusMessage} className="status-message">Shift 키를 눌러 마법진 생성을 시작하세요.</div>
            </div>
        </div>
    );
};

export default Magic;