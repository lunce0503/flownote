import { useState } from "react";
import getTaskData from "../../entities/task/api/getTaskData";
import TaskList from "../../widgets/TaskWidget/TaskList";
import TaskTable from "../../widgets/TaskWidget/TaskTable";

const TaskPage = () => {
    

    return (
        <div>
            <TaskTable />
        </div>
    );
}

export default TaskPage;