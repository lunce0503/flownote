import { useState, useEffect, useRef } from "react";

import getTaskData from "../../entities/task/api/getTaskData";
import postTaskData from "../../entities/task/api/postTaskData";
import deleteTasksData from "../../entities/task/api/deleteTaskData";
import updateTasksData from "../../entities/task/api/updateTaskData";

import { TaskHeader,TaskInput, TaskList } from "./TaskEliment";
import type { TaskProps } from "./TaskEliment";

const TaskTable = () => {
    const [tasks, setTasks] = useState<TaskProps[]>([]);

    const fetchTasks = async () => {
            const tasksData = await getTaskData();
            setTasks(tasksData);
        };

    const AddTask = (task : TaskProps) => {
        postTaskData(task);
        setTasks((prevTask)=>[...prevTask, task]);
    }
    
    const UpadateTask = (updatedTask:TaskProps) => {
        try{
            // 1. 낙관적 UI 업데이트: 사용자에게 즉각적인 피드백 제공
            setTasks((prevTasks) =>
                prevTasks.map((t) => (t.id === updatedTask.id ? updatedTask : t))
            );

            // 2. 백엔드 전송: 전체 객체 또는 변경된 필드를 전송
            // 이제 updateTasksData는 {status: string} 뿐만 아니라 전체 데이터를 보낼 수 있습니다.
            updateTasksData(updatedTask.id, updatedTask);
        } catch (error) {
            // 에러 발생 시 원래 상태로 롤백하거나 에러 알림 처리
            console.error("수정 중 오류 발생, 다시 시도해주세요.");
            fetchTasks(); // 최신 데이터 다시 불러오기
        }
    };

    const handleDeleteTask = (deleteTask:TaskProps)=>{
        deleteTasksData(deleteTask.id);
        setTasks((prevTasks) => prevTasks.filter((task)=>task.id !== deleteTask.id))
    }

    useEffect(() => {
        fetchTasks();
    },[]);


    return (
        <div>
            <div className="tasks-table bg-amber-50 text-black m-3 p-3 rounded-2xl">Task Table</div>
            <TaskHeader />
            <TaskList tasks={tasks} onDeleteClick={handleDeleteTask} onChange={UpadateTask} />
            <TaskInput onClick={AddTask}/>
        </div>
    );
};

export default TaskTable;