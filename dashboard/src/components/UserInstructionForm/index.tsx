import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  PaperAirplaneIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  BookmarkIcon
} from '@heroicons/react/24/outline';
import { useDashboardStore } from '../../store';
import { UserInstruction } from '../../types';
import { api } from '../../services/api';
import clsx from 'clsx';

interface FormData {
  content: string;
  priority: number;
  projectId?: string;
}

const priorityLevels = [
  { value: 1, label: 'Low', color: 'text-gray-600', bg: 'bg-gray-100' },
  { value: 3, label: 'Normal', color: 'text-blue-600', bg: 'bg-blue-100' },
  { value: 5, label: 'High', color: 'text-yellow-600', bg: 'bg-yellow-100' },
  { value: 8, label: 'Urgent', color: 'text-orange-600', bg: 'bg-orange-100' },
  { value: 10, label: 'Critical', color: 'text-red-600', bg: 'bg-red-100' },
];

const exampleInstructions = [
  "Create a new React component for user authentication",
  "Implement a REST API endpoint for data processing",
  "Fix the responsive layout issues on mobile devices",
  "Add unit tests for the payment processing module",
  "Optimize database queries for better performance",
  "Create documentation for the new feature",
];

const UserInstructionForm: React.FC = () => {
  const { projects, addUserInstruction } = useDashboardStore();
  const [formData, setFormData] = useState<FormData>({
    content: '',
    priority: 3,
    projectId: undefined,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showExamples, setShowExamples] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.content.trim()) {
      setError('Please enter an instruction');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const instruction: Omit<UserInstruction, 'id' | 'timestamp' | 'status'> = {
        content: formData.content.trim(),
        priority: formData.priority,
        ...(formData.projectId && { projectId: formData.projectId }),
      };

      // Submit to API
      const submittedInstruction = await api.instructions.submit(instruction);
      
      // Update store
      addUserInstruction(submittedInstruction);

      // Reset form
      setFormData({
        content: '',
        priority: 3,
        projectId: undefined,
      });
      
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
      
    } catch (err) {
      console.error('Failed to submit instruction:', err);
      setError('Failed to submit instruction. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleExampleClick = (example: string) => {
    setFormData(prev => ({ ...prev, content: example }));
    setShowExamples(false);
  };

  const currentPriority = priorityLevels.find(p => p.value === formData.priority);

  return (
    <div className="space-y-4">
      <form onSubmit={handleSubmit} className="space-y-4">
        
        {/* Instruction Content */}
        <div>
          <label htmlFor="instruction" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Instruction
          </label>
          <div className="relative">
            <textarea
              id="instruction"
              rows={4}
              value={formData.content}
              onChange={(e) => setFormData(prev => ({ ...prev, content: e.target.value }))}
              placeholder="Describe what you want the AI agents to accomplish..."
              className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 resize-none"
              disabled={isSubmitting}
            />
            
            {/* Character count */}
            <div className="absolute bottom-2 right-2 text-xs text-gray-400">
              {formData.content.length}/1000
            </div>
          </div>

          {/* Example instructions */}
          <div className="mt-2">
            <button
              type="button"
              onClick={() => setShowExamples(!showExamples)}
              className="text-sm text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 flex items-center space-x-1"
            >
              <BookmarkIcon className="w-4 h-4" />
              <span>Show examples</span>
            </button>
            
            {showExamples && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-2 space-y-1"
              >
                {exampleInstructions.map((example, index) => (
                  <button
                    key={index}
                    type="button"
                    onClick={() => handleExampleClick(example)}
                    className="block w-full text-left text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-700 px-2 py-1 rounded transition-colors"
                  >
                    "{example}"
                  </button>
                ))}
              </motion.div>
            )}
          </div>
        </div>

        {/* Priority and Project Selection */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          
          {/* Priority */}
          <div>
            <label htmlFor="priority" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Priority Level
            </label>
            <div className="relative">
              <select
                id="priority"
                value={formData.priority}
                onChange={(e) => setFormData(prev => ({ ...prev, priority: Number(e.target.value) }))}
                className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                disabled={isSubmitting}
              >
                {priorityLevels.map((level) => (
                  <option key={level.value} value={level.value}>
                    {level.label} ({level.value}/10)
                  </option>
                ))}
              </select>
              
              {/* Priority indicator */}
              {currentPriority && (
                <div className="absolute right-8 top-1/2 transform -translate-y-1/2">
                  <span className={clsx(
                    'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium',
                    currentPriority.bg,
                    currentPriority.color
                  )}>
                    {currentPriority.label}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Project Selection */}
          <div>
            <label htmlFor="project" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Project (Optional)
            </label>
            <select
              id="project"
              value={formData.projectId || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, projectId: e.target.value || undefined }))}
              className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              disabled={isSubmitting}
            >
              <option value="">Select a project...</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-4"
          >
            <div className="flex">
              <ExclamationTriangleIcon className="h-5 w-5 text-red-400" />
              <div className="ml-3">
                <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
              </div>
            </div>
          </motion.div>
        )}

        {/* Success Display */}
        {success && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md p-4"
          >
            <div className="flex">
              <ClockIcon className="h-5 w-5 text-green-400" />
              <div className="ml-3">
                <p className="text-sm text-green-800 dark:text-green-200">
                  Instruction submitted successfully! AI agents will begin processing shortly.
                </p>
              </div>
            </div>
          </motion.div>
        )}

        {/* Submit Button */}
        <div className="flex justify-end">
          <motion.button
            type="submit"
            disabled={isSubmitting || !formData.content.trim()}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className={clsx(
              'inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white transition-colors duration-200',
              isSubmitting || !formData.content.trim()
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500'
            )}
          >
            {isSubmitting ? (
              <>
                <div className="animate-spin -ml-1 mr-3 h-5 w-5 border-2 border-white border-t-transparent rounded-full" />
                Submitting...
              </>
            ) : (
              <>
                <PaperAirplaneIcon className="-ml-1 mr-2 h-5 w-5" />
                Submit Instruction
              </>
            )}
          </motion.button>
        </div>
      </form>

      {/* Info Box */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md p-4">
        <div className="flex">
          <ClockIcon className="h-5 w-5 text-blue-400 flex-shrink-0" />
          <div className="ml-3">
            <h4 className="text-sm font-medium text-blue-800 dark:text-blue-200">
              How it works
            </h4>
            <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
              Your instruction will be analyzed by the Boss AI, broken down into manageable tasks, 
              and distributed to available subordinate agents for execution. You'll receive real-time 
              updates on the dashboard as work progresses.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserInstructionForm;