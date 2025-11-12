import React, { useState } from 'react';
import { MOCK_TASKS } from '../constants';
import { Task } from '../types';
import { suggestTaskPriority } from '../services/geminiService';

type Priority = 'High' | 'Medium' | 'Low' | 'None';
const priorityConfig: Record<Priority, { color: string; icon: string }> = {
    'High': { color: 'border-red-500', icon: 'fa-solid fa-angles-up text-red-500' },
    'Medium': { color: 'border-yellow-500', icon: 'fa-solid fa-angle-up text-yellow-500' },
    'Low': { color: 'border-blue-500', icon: 'fa-solid fa-angle-down text-blue-500' },
    'None': { color: 'border-slate-600', icon: 'fa-solid fa-minus text-slate-500' },
};

const TaskCard: React.FC<{ task: Task, onEdit: (task: Task) => void }> = ({ task, onEdit }) => (
    <div onClick={() => onEdit(task)} className={`bg-slate-800/50 p-4 rounded-lg border-l-4 ${priorityConfig[task.priority].color} cursor-pointer hover:bg-slate-700/50 transition-colors`}>
        <h3 className="font-bold">{task.title}</h3>
        <p className="text-sm text-slate-400 mt-1 mb-3 line-clamp-2">{task.description}</p>
        <div className="flex justify-between items-center text-xs text-slate-400">
            <span className="flex items-center space-x-2">
                <i className="fa-regular fa-calendar"></i>
                <span>{task.dueDate}</span>
            </span>
            <span className="flex items-center space-x-1.5">
                <i className={priorityConfig[task.priority].icon}></i>
                <span>{task.priority}</span>
            </span>
        </div>
    </div>
);

const TaskColumn: React.FC<{ title: string; tasks: Task[]; onEdit: (task: Task) => void }> = ({ title, tasks, onEdit }) => (
    <div className="bg-slate-900/50 backdrop-blur-sm rounded-xl p-4 h-full flex flex-col min-h-0">
        <h2 className="text-lg font-semibold text-white mb-4 px-2 flex-shrink-0">{title} <span className="text-sm text-slate-400 font-normal">({tasks.length})</span></h2>
        <div className="space-y-4 flex-1 overflow-y-auto min-h-0">
            {tasks.length === 0 ? (
                <div className="text-center text-slate-400 py-8">
                    <p>No tasks in this column</p>
                </div>
            ) : (
                tasks.map(task => <TaskCard key={task.id} task={task} onEdit={onEdit}/>)
            )}
        </div>
    </div>
);

const TaskModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onSave: (task: Omit<Task, 'id' | 'status'>) => void;
    task: Partial<Task> | null;
}> = ({ isOpen, onClose, onSave, task }) => {
    const [formData, setFormData] = useState({ title: '', description: '', dueDate: '', priority: 'None' as Priority });
    const [aiSuggestion, setAiSuggestion] = useState<{ priority: Priority; justification: string } | null>(null);
    const [isLoadingAi, setIsLoadingAi] = useState(false);

    React.useEffect(() => {
        setFormData({
            title: task?.title || '',
            description: task?.description || '',
            dueDate: task?.dueDate || '',
            priority: task?.priority || 'None'
        });
        setAiSuggestion(null);
    }, [task]);

    if (!isOpen) return null;

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSuggestPriority = async () => {
        if (!formData.title || !formData.dueDate) {
            alert("Please fill in at least the Title and Due Date.");
            return;
        }
        setIsLoadingAi(true);
        setAiSuggestion(null);
        try {
            const suggestion = await suggestTaskPriority({
                title: formData.title,
                description: formData.description,
                dueDate: formData.dueDate
            });
            setAiSuggestion(suggestion as { priority: Priority; justification: string });
        } catch (error) {
            console.error(error);
            alert("Could not get AI suggestion.");
        }
        setIsLoadingAi(false);
    };
    
    const handleApplySuggestion = () => {
        if (aiSuggestion) {
            setFormData({...formData, priority: aiSuggestion.priority });
            setAiSuggestion(null);
        }
    }

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave(formData);
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="w-full max-w-lg bg-slate-800 border border-white/10 rounded-2xl p-6 text-white shadow-2xl">
                <h2 className="text-2xl font-bold mb-6">{task?.id ? 'Edit Task' : 'Add New Task'}</h2>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <input name="title" value={formData.title} onChange={handleChange} placeholder="Task Title" className="w-full bg-slate-900/80 border border-slate-700 rounded-lg px-4 py-2" required />
                    <textarea name="description" value={formData.description} onChange={handleChange} placeholder="Description" className="w-full bg-slate-900/80 border border-slate-700 rounded-lg px-4 py-2 h-24" />
                    <input type="date" name="dueDate" value={formData.dueDate} onChange={handleChange} className="w-full bg-slate-900/80 border border-slate-700 rounded-lg px-4 py-2" required />
                    <div className="flex items-end space-x-4">
                        <div className="flex-grow">
                             <label className="block text-sm font-medium text-slate-300 mb-1">Priority</label>
                            <select name="priority" value={formData.priority} onChange={handleChange} className="w-full bg-slate-900/80 border border-slate-700 rounded-lg px-4 py-2">
                                <option value="None">None</option>
                                <option value="Low">Low</option>
                                <option value="Medium">Medium</option>
                                <option value="High">High</option>
                            </select>
                        </div>
                       <button type="button" onClick={handleSuggestPriority} disabled={isLoadingAi} className="bg-purple-600 hover:bg-purple-700 px-4 py-2 rounded-lg flex items-center space-x-2 disabled:bg-slate-600">
                           {isLoadingAi ? <i className="fa-solid fa-spinner fa-spin"></i> : <i className="fa-solid fa-wand-magic-sparkles"></i>}
                           <span>Suggest</span>
                       </button>
                    </div>
                     {aiSuggestion && (
                        <div className="bg-purple-900/50 border border-purple-500/50 p-3 rounded-lg text-sm">
                            <p className="font-semibold">AI Suggestion: <span className="text-purple-300">{aiSuggestion.priority}</span></p>
                            <p className="text-slate-300 italic">"{aiSuggestion.justification}"</p>
                            <button type="button" onClick={handleApplySuggestion} className="text-purple-300 hover:text-white mt-2 font-semibold">Apply Suggestion</button>
                        </div>
                    )}
                    <div className="flex justify-end space-x-4 pt-4">
                        <button type="button" onClick={onClose} className="bg-slate-600 hover:bg-slate-700 px-4 py-2 rounded-lg">Cancel</button>
                        <button type="submit" className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg">Save Task</button>
                    </div>
                </form>
            </div>
        </div>
    );
};


const TaskManagement: React.FC = () => {
    const [tasks, setTasks] = useState<Task[]>(MOCK_TASKS);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingTask, setEditingTask] = useState<Task | null>(null);

    const handleOpenModal = (task: Task | null = null) => {
        setEditingTask(task);
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setEditingTask(null);
    };

    const handleSaveTask = (taskData: Omit<Task, 'id' | 'status'>) => {
        if (editingTask) {
            setTasks(tasks.map(t => t.id === editingTask.id ? { ...editingTask, ...taskData } : t));
        } else {
            const newTask: Task = {
                id: Date.now().toString(),
                status: 'To Do',
                ...taskData
            };
            setTasks([...tasks, newTask]);
        }
        handleCloseModal();
    };

    return (
        <div className="text-white h-full flex flex-col min-h-0">
            <div className="flex justify-end mb-4 flex-shrink-0">
                <button onClick={() => handleOpenModal()} className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-bold py-2 px-4 rounded-lg transition-all hover:scale-105 flex items-center space-x-2">
                   <i className="fa-solid fa-plus"></i>
                   <span className="hidden sm:inline">Add Task</span>
                </button>
            </div>
            <div className="flex-grow flex flex-col lg:flex-row space-y-4 lg:space-y-0 lg:space-x-4 lg:overflow-hidden min-h-0">
                <div className="flex-1 min-w-0 lg:overflow-y-auto lg:pr-2">
                    <TaskColumn title="To Do" tasks={tasks.filter(t => t.status === 'To Do')} onEdit={handleOpenModal} />
                </div>
                <div className="flex-1 min-w-0 lg:overflow-y-auto lg:pr-2">
                    <TaskColumn title="In Progress" tasks={tasks.filter(t => t.status === 'In Progress')} onEdit={handleOpenModal} />
                </div>
                <div className="flex-1 min-w-0 lg:overflow-y-auto lg:pr-2">
                    <TaskColumn title="Done" tasks={tasks.filter(t => t.status === 'Done')} onEdit={handleOpenModal} />
                </div>
            </div>
            <TaskModal
                isOpen={isModalOpen}
                onClose={handleCloseModal}
                onSave={handleSaveTask}
                task={editingTask}
            />
        </div>
    );
};

export default TaskManagement;
