import { useRef } from "react";
import Menu from "../shared/assets/menu.svg";


export default function Header() {
    const headerTitle = useRef<HTMLDivElement>(null);

    const onMenuClick = () => {
        console.log("Menu clicked");
    }

    return (
        <div className="w-full h-1/5 flex flex-row justify-start space-x-4 bg-amber-100 py-2">
            <nav className="row-span-1 flex flex-row items-center space-x-4 text-stone-600">
                <div onClick={onMenuClick} className="sidebar-toggle ml-5">
                    <img src={Menu} alt="menu" />
                </div>
                <div ref={headerTitle} className="header-title text-2xl text-stone-700 ml-5 font-mono">
                    <a className ="text-inherit hover:text-stone-400" href="/">Flownote</a>
                </div>
                <div className="text-stone-600">
                    <a className="text-inherit hover:text-stone-400" href="/blog">Blog</a>
                </div>
                <div className="text-stone-600">
                    <a className="text-inherit hover:text-stone-400" href="/social">Social</a>
                </div>
                <div className="text-stone-600">
                    <a className="text-inherit hover:text-stone-400" href="/task">Task</a>
                </div>
            </nav>
        </div>
    );
} 