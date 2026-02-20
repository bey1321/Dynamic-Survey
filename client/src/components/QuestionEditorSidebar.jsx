import React, { useState, useRef, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Send, Trash2 } from 'lucide-react';
import { useSurvey } from '../state/SurveyContext';
import { useToast } from '../state/ToastContext';
import { ChatMessage } from './ChatMessage';

export const QuestionEditorSidebar = ({ questions = [], evaluations = [] }) => {
  const { surveyDraft, variableModel, questionsState, setQuestionsFromAI } = useSurvey();
  const { showToast } = useToast();

  // Separate chat state for sidebar (independent from floating chat)
  const [sidebarMessages, setSidebarMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [input, setInput] = useState('');
  const messagesEndRef = useRef(null);

  // Auto-scroll to bottom when messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [sidebarMessages]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userInput = input.trim();
    setInput('');

    // Add user message to sidebar chat
    const userMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: userInput,
      timestamp: new Date()
    };
    setSidebarMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);

    try {
      // Make direct API call for sidebar chat (separate from floating chat)
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userInput,
          context: {
            currentStep: 3,
            surveyDraft,
            variableModel: variableModel?.model,
            questions: questionsState?.questions || [],
            evaluations: evaluations || [],
          },
          conversationHistory: sidebarMessages.map(m => ({
            role: m.role,
            content: m.content
          }))
        })
      });

      if (!response.ok) throw new Error('Chat request failed');

      const data = await response.json();

      // Add assistant message to sidebar chat
      const assistantMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.message,
        timestamp: new Date()
      };
      setSidebarMessages((prev) => [...prev, assistantMessage]);

      // Handle question regeneration if applicable
      if (data?.regeneratedQuestions) {
        setQuestionsFromAI(data.regeneratedQuestions);
        showToast('Questions regenerated!');
      }
    } catch (error) {
      console.error('Chat error:', error);
      showToast('Failed to send message', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  if (isCollapsed) {
    return (
      <button
        onClick={() => setIsCollapsed(false)}
        className="fixed right-6 top-1/2 transform -translate-y-1/2 w-12 h-12 bg-gradient-to-br from-teal-500 to-blue-600 text-white rounded-full shadow-lg hover:shadow-xl hover:scale-110 transition-all z-30 flex items-center justify-center"
        title="Expand editor"
      >
        <ChevronLeft className="w-6 h-6" />
      </button>
    );
  }

  return (
    <div className="w-full h-full bg-white border-l border-gray-200 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gradient-to-r from-teal-50 to-blue-50 shrink-0">
        <h3 className="font-semibold text-gray-800">Question Editor</h3>
        <button
          onClick={() => setIsCollapsed(true)}
          className="text-gray-500 hover:text-gray-700 transition p-1"
          title="Collapse"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-hidden flex flex-col">
        <div className="flex flex-col h-full">
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {sidebarMessages.length === 0 ? (
                <div className="text-center text-gray-500 text-sm py-8">
                  <p className="mb-2">💬 No messages yet</p>
                  <p className="text-xs">Ask questions about your survey or request edits</p>
                </div>
              ) : (
                <>
                  {sidebarMessages.map((msg) => (
                    <ChatMessage key={msg.id} message={msg} />
                  ))}
                  {isLoading && (
                    <div className="flex gap-3">
                      <div className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center bg-teal-100">
                        <div className="w-3 h-3 bg-teal-600 rounded-full animate-pulse" />
                      </div>
                      <div className="text-sm text-gray-500">Thinking...</div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </>
              )}
            </div>

            {/* Input */}
            <div className="border-t border-gray-200 bg-gray-50 p-3 shrink-0">
              <form onSubmit={handleSendMessage} className="flex gap-2">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask anything..."
                  disabled={isLoading}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                />
                <button
                  type="submit"
                  disabled={isLoading || !input.trim()}
                  className="px-3 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </div>
          </div>
      </div>

      {/* Footer */}
      <div className="border-t border-gray-200 bg-gray-50 p-3 shrink-0">
        <button
          onClick={() => {
            if (window.confirm('Clear chat history?')) {
              setSidebarMessages([]);
              showToast('Chat cleared');
            }
          }}
          disabled={sidebarMessages.length === 0}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm text-gray-600 hover:text-gray-700 hover:bg-white border border-gray-300 rounded transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Trash2 className="w-4 h-4" />
          Clear Chat
        </button>
      </div>
    </div>
  );
};
