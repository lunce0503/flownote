import { useState, useRef } from "react";
import { v4 as uuidv4 } from "uuid";
import { createPortal } from "react-dom";

interface TaskProps {
    // db용
    id: string;
    create_at: Date;
    update_at: Date;
    // 고객용
    task_name: string;
    category: string | null;
    difficulty_level: 1 | 2 | 3;
    status: 'TODO'|'DOING'|'DONE';
    description: string | null;
    estimated_minutes: number;
    actual_minutes: number | null;
    due_date: string;
    memo: string | null;
    tags: string[];
    
}

const tableContianer = {
    display : 'divide-x md:grid-cols-9 md:grid',
    task : 'md:col-span-1',
    status : 'md:col-span-1',
    category : 'md:col-span-1',
    difficulty : 'md:col-span-1',
    estimated_time : 'md:col-span-1',
    actual_time : 'md:col-span-1',
    due_date: 'md:col-span-1',
    tags : 'md:col-span-1',
    memo : 'md:col-span-1',
}

const tableContainerMobile = {
    display : 'grid-cols-9 divide-x md:grid',
    task : 'col-span-1',
    status : 'col-span-1',
    category : 'col-span-1',
    difficulty : 'col-span-1',
    estimated_time : 'col-span-1',
    actual_time : 'col-span-1',
    due_date: 'col-span-1',
    tags : 'col-span-1',
    memo : 'hidden',
}

const taskHeaderContainer = {
    display : 'grid-cols-9 divide-x md:grid',
    task : 'col-span-1',
    status : 'col-span-1',
    category : 'col-span-1',
    difficulty : 'col-span-1',
    estimated_time : 'col-span-1',
    actual_time : 'col-span-1',
    due_date: 'col-span-1',
    tags : 'col-span-1',
    memo : 'hidden md:col-span-1',
}

const TaskHeader = () => {
    const tableContainer = tableContianer;

    return(
        <div className={`table-Header divide-x hidden md:grid grid-cols-9 mx-10 border`}>
            <div className={`task-title col-span-1 mx-1`}>일정</div>
            <div className={`task-state col-span-1 mx-1`}>상태</div>
            <div className={`task-category col-span-1 mx-1`}>카테고리</div>
            <div className={`task-difficulty col-span-1 mx-1`}>난이도</div>
            <div className={`task-estimated-time col-span-1 mx-1`}>소요 예상</div>
            <div className={`task-actual-time col-span-1 mx-1`}>걸린 시간</div>
            <div className={`task-due-date col-span-1 mx-1`}>마감 기한</div>
            <div className={`task-tags col-span-1 mx-1`}>태그</div>
            <div className={`task-memo col-span-1 mx-1`}>메모</div>
        </div>
    );
};

const TaskList = ({ tasks, onDeleteClick, onChange}:
    {
        tasks: TaskProps[]; 
        onDeleteClick: (deleteTask:TaskProps)=>void; 
        onChange: (updateTask:TaskProps) => void
    }) => {
   
        const tableContainer = tableContianer;
    
    
    const handleDelete = (task:TaskProps) => {
        onDeleteClick(task);
    }
    const handleChange = (e: React.FocusEvent<HTMLDivElement>, task: TaskProps, field: keyof TaskProps) => {
         const newValue = e.currentTarget.innerText.trim();
    
        // 값이 변하지 않았다면 무시
        if (String(task[field]) === newValue) return;

        // 새로운 객체 생성 (React 불변성 유지)
        const updatedTask = {
        ...task,
        [field]: field === 'tags' ? newValue.split(',').map(t => t.trim()) : newValue,
        update_at: new Date()
        };

        // 난이도나 시간 같은 숫자형 데이터 처리
        if (field === 'difficulty_level' || field === 'estimated_minutes' || field === 'actual_minutes') {
            (updatedTask[field] as any) = Number(newValue);
        }

        onChange(updatedTask);
    }
    return (
        <div>  
            <div>
                    {tasks.map((task)=>(
                        <div key={task.id} className={`task-item ${tableContainer.display} mx-10 text-black border-b bg-white`}>
                            
                            {/* Task Content */}
                            <div className={`col-span-1 md:flex md:flex-row`}>
                                <button 
                                    className="w-4 h-4 text-xs bg-stone-600 text-white text-center hover:bg-stone-700 md:flex-1" 
                                    onClick={() => handleDelete(task)}
                                >-</button>

                                <div className={`task-title ${tableContainerMobile.task} ${tableContainer.task} ml-1 md:flex-9`} 
                                    contentEditable suppressContentEditableWarning={true} 
                                   onBlur={(e) => {handleChange(e, task, 'task_name')}}>
                                        {task.task_name}
                                </div>
                                <span className={`md:hidden`}> 

                                </span>
                            </div>
                            
                            {/* Task Status */}
                            <div className={`task-state ${tableContainer.status} mx-1`} 
                                contentEditable suppressContentEditableWarning={true} 
                               onBlur={(e) => {handleChange(e, task, 'status')}}>
                                    <span className={`status-indicator inline-block w-3 h-3 rounded-full mr-1 ${task.status === 'TODO' ? 'bg-red-500' : task.status === 'DOING' ? 'bg-yellow-500' : 'bg-green-500'}`}></span>
                            </div>
                            
                            {/* Task Category */}
                            <div className={`task-category ${tableContainer.category} mx-1`} 
                                contentEditable suppressContentEditableWarning={true} 
                               onBlur={(e) => {handleChange(e, task, 'category')}}>
                                    <span>
                                        {task.category && (
                                            <span className="inline-block bg-gray-200 rounded-full px-2 py-1 text-xs font-semibold text-gray-700 mr-1">
                                                {task.category}
                                            </span>
                                        )}
                                    </span>
                            </div>

                            {/* Task Difficulty */}
                            <div className={`task-difficulty ${tableContainer.difficulty} mx-1`} 
                                contentEditable suppressContentEditableWarning={true} 
                               onBlur={(e) => {handleChange(e, task, 'difficulty_level')}}>
                                    <span>
                                        {Array.from({ length: task.difficulty_level }, (_, index) => (
                                            <span key={index} className="inline-block w-3 h-3 bg-gray-400 rounded-full ml-1"></span>
                                        ))}
                                    </span>
                            </div>

                            {/* Task Estimated Time */}
                            <div className={`task-estimated-time ${tableContainer.estimated_time} mx-1`} 
                                contentEditable suppressContentEditableWarning={true} 
                               onBlur={(e) => {handleChange(e, task, 'estimated_minutes')}}>
                                    <span>
                                    {task.estimated_minutes !== null && task.estimated_minutes !== 0 && (
                                        <span className={`ml-2  `}>
                                            {Math.floor(task.estimated_minutes / 60) > 10 ? Math.floor(task.estimated_minutes / 60):`0${Math.floor(task.estimated_minutes / 60)}`}:{task.estimated_minutes % 60 < 10 ? `0${task.estimated_minutes % 60}` : task.estimated_minutes % 60}
                                        </span>
                                    )}
                                </span>
                            </div>

                            {/* Task Actual Time */}
                            <div className={`task-actual-time ${tableContainer.actual_time} mx-1`} 
                                contentEditable suppressContentEditableWarning={true} 
                               onBlur={(e) => {handleChange(e, task, 'actual_minutes')}}>
                                <span>
                                    {task.actual_minutes !== null && task.estimated_minutes !== 0 && (
                                        <span className={`ml-2  `}>
                                            {Math.floor(task.actual_minutes / 60) > 10 ? Math.floor(task.actual_minutes / 60):`0${Math.floor(task.actual_minutes / 60)}`}:{task.estimated_minutes % 60 < 10 ? `0${task.estimated_minutes % 60}` : task.estimated_minutes % 60}
                                        </span>
                                    )}
                                </span>
                            </div>
                            {/* Task Due Date */}
                            <div className={`task-due-date ${tableContainer.due_date} mx-1`} 
                                contentEditable suppressContentEditableWarning={true} 
                               onBlur={(e) => {handleChange(e, task, 'due_date')}}>
                                    {task.due_date}
                            </div>

                            {/* Task Tags */}
                            <div className={`task-tags ${tableContainer.tags} mx-1`} 
                                contentEditable suppressContentEditableWarning={true} 
                               onBlur={(e) => {handleChange(e, task, 'tags')}}>
                                    <span>
                                        {task.tags.length > 0 ? task.tags.map((tag, index) => (
                                            <span key={index} className="inline-block bg-gray-200 rounded-full px-2 py-1 text-xs font-semibold text-gray-700 mr-1">
                                                {tag}
                                            </span>
                                        )) : 'No Tags'}
                                    </span>
                            </div>

                            {/* Task Memo */}
                            <div className={`task-memo ${tableContainer.memo} mx-1`} 
                                contentEditable suppressContentEditableWarning={true} 
                               onBlur={(e) => {handleChange(e, task, 'memo')}}>
                                    {task.memo}
                            </div>
                        </div>
                    ))}
            </div>
        </div>
    );
};

const TaskInput = ({ onClick } : {onClick: (task:TaskProps) => void}) => {
    const [task, setTask] = useState<TaskProps|null>(null);

    const taskTitleRef = useRef<HTMLDivElement>(null);
    const statusRef = useRef<HTMLDivElement>(null);
    const categoryRef = useRef<HTMLDivElement>(null);
    const difficultyRef = useRef<HTMLDivElement>(null);
    const estTimeRef = useRef<HTMLDivElement>(null);
    const actTimeRef = useRef<HTMLDivElement>(null);
    const dueDateRef = useRef<HTMLDivElement>(null);
    const tagsRef = useRef<HTMLDivElement>(null);
    const memoRef = useRef<HTMLDivElement>(null);
    const tableContainer = tableContianer;

    const resetRef = () => {
        if (taskTitleRef.current) taskTitleRef.current.innerText = "";
        if (statusRef.current) statusRef.current.innerText = "";
        if (categoryRef.current) categoryRef.current.innerText = "";
        if (difficultyRef.current) difficultyRef.current.innerText = "";
        if (estTimeRef.current) estTimeRef.current.innerText = "";
        if (actTimeRef.current) actTimeRef.current.innerText = "";
        if (dueDateRef.current) {
            const yearDiv = dueDateRef.current.querySelector('.year');
            const monthDiv = dueDateRef.current.querySelector('.month');
            const dayDiv = dueDateRef.current.querySelector('.day');
            if (yearDiv) yearDiv.textContent = "";
            if (monthDiv) monthDiv.textContent = "";
            if (dayDiv) dayDiv.textContent = "";
        }
        if (tagsRef.current) tagsRef.current.innerText = "";
        if (memoRef.current) memoRef.current.innerText = "";
    };

    const handleAddFunction = () => {
        const newTask: TaskProps = {
            id: uuidv4(),
            task_name: taskTitleRef.current?.innerText || "",
            status: statusRef.current?.innerText as "TODO"|"DOING"|"DONE",
            description: null,
            category: categoryRef.current?.innerText || "",
            difficulty_level: Number(difficultyRef.current?.innerText) as 1|2|3,
            estimated_minutes: Number(estTimeRef.current?.innerText) || 0,
            actual_minutes: Number(actTimeRef.current?.innerText) || 0,
            due_date: dueDateRef.current?.querySelectorAll('.year')?.[0]?.textContent + '-' + dueDateRef.current?.querySelectorAll('.month')?.[0]?.textContent + '-' + dueDateRef.current?.querySelectorAll('.day')?.[0]?.textContent || "",
            tags: [tagsRef.current?.innerText || ""], 
            memo: memoRef.current?.innerText || "",
            create_at: new Date(),
            update_at: new Date()
        };
        onClick(newTask);
        resetRef();
    };
    
    


    return(
        <div>
            <div className={`input-bar ${tableContainer.display} mx-10 border`} >
                {/* Task Title */}
                <div className="flex flex-row">
                    <span className="flex-2 md:hidden">일정 추가</span>
                    <div 
                        ref={taskTitleRef} 
                        className={`task-title flex-8 ${tableContainer.task} mx-1  `} 
                        contentEditable 
                        suppressContentEditableWarning
                    >

                    </div>
                </div>

    

                {/* Task Status */}
                <div className="flex flex-row">
                    <span className="flex-2 md:hidden">상태</span>
                    <div 
                        ref={statusRef} 
                        className={`task-state flex-8 ${tableContainer.status} mx-1  `} 
                        contentEditable 
                        suppressContentEditableWarning
                    >

                    </div>
                </div>
                

                {/* Task Category */}
                <div className="flex flex-row">
                    <span className="flex-2 md:hidden">카테고리</span>
                    <div 
                        ref={categoryRef} 
                        className={`task-category flex-8 ${tableContainer.category} mx-1  `} 
                        contentEditable 
                        suppressContentEditableWarning
                    >

                    </div>
                </div>
                

                {/* Task Difficulty */}
                <div 
                    ref={difficultyRef} 
                    className={`task-difficulty flex flex-row ${tableContainer.difficulty} mx-1  `} 
                >
                    <div className="flex-2 md:hidden">난이도</div>
                    <button onClick={() => difficultyRef.current && (difficultyRef.current.innerText = "1")} 
                    className="text-xs flex-1 hover:bg-gray-700"><span className="text-green-500">●</span></button>
                    <button onClick={() => difficultyRef.current && (difficultyRef.current.innerText = "2")}
                    className="text-xs flex-1 hover:bg-gray-700"><span className="text-yellow-500">●</span></button>
                    <button onClick={() => difficultyRef.current && (difficultyRef.current.innerText = "3")}
                    className="text-xs flex-1 hover:bg-gray-700"><span className="text-red-500">●</span></button>
                </div>

                {/* Task Estimated Time */}
                <div className="flex flex-row">
                    <span className="flex-2 md:hidden">소요 예상</span>
                    <div 
                        ref={estTimeRef} 
                        className={`task-estimated-time flex-8 ${tableContainer.estimated_time} mx-1  `} 
                        contentEditable 
                        suppressContentEditableWarning
                    >
                        
                    </div>
                </div>
                
                
                {/* Task Actual Time */}
                <div className="flex flex-row">
                    <span className="flex-2 md:hidden">소요 시간</span>
                    <div 
                        ref={actTimeRef} 
                        className={`task-actual-time flex-8 ${tableContainer.actual_time} mx-1  `} 
                        contentEditable 
                        suppressContentEditableWarning
                    >
                        
                    </div>
                </div>
                
                {/* Task Due Date */}
                <div className="flex flex-row">
                    <span className="flex-2 md:hidden">마감일</span>
                    <div 
                        ref={dueDateRef} 
                        className={`task-due-date flex-8 flex flex-row ${tableContainer.due_date} mx-1`} 
                    >
                        <div className="year flex-2" contentEditable suppressContentEditableWarning>2000</div>-
                        <div className="month flex-1" contentEditable suppressContentEditableWarning>01</div>-
                        <div className="day flex-1" contentEditable suppressContentEditableWarning>01</div>
                    </div>
                </div>
                
                {/* Task Tags */}
                <div className="flex flex-row">
                    <span className="flex-2 md:hidden">태그</span>
                    <div 
                        ref={tagsRef} 
                        className={`task-tags flex-8 ${tableContainer.tags} mx-1  `} 
                        contentEditable 
                        suppressContentEditableWarning
                    >
                    
                    </div>
                </div>
                
                
                {/* Task Memo */}
                <div className="flex flex-row">
                    <span className="flex-2 md:hidden">메모</span>
                    <div 
                        ref={memoRef} 
                        className={`task-memo flex-8 ${tableContainer.memo} mx-1  `} 
                        contentEditable 
                        suppressContentEditableWarning
                    >

                    </div>  
                </div>
                         
            </div>
            <div className={`grid grid-cols-9 mx-10`}>
                <button className="add-task-button col-span-9 bg-gray-600 hover:bg-gray-700" onClick={handleAddFunction}>+</button> 
            </div>
        </div>
        
    );
};

export { TaskHeader, TaskList, TaskInput};
export type { TaskProps };