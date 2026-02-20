import React, { useState, useRef, useEffect } from 'react';
import { ChevronRight, Send, Trash2 } from 'lucide-react';
import { useSurvey } from '../state/SurveyContext';
import { useToast } from '../state/ToastContext';
import { ChatMessage } from './ChatMessage';

export const QuestionEditorSidebar = ({ questions = [], evaluations = [], onCollapse }) => {
  const { surveyDraft, variableModel, questionsState, setQuestionsFromAI } = useSurvey();
  const { showToast } = useToast();

  // Separate chat state for sidebar (independent from floating chat)
  const [sidebarMessages, setSidebarMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
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

  return (
    <div className="w-full h-full bg-white flex flex-col" style={{ borderLeft: "1px solid #d0eaea" }}>
      {/* Header */}
      <div
        className="flex items-center justify-between p-4 shrink-0"
        style={{ borderBottom: "1px solid #d0eaea", backgroundColor: "#f0f8f8" }}
      >
        <h3 className="font-semibold text-sm" style={{ color: "#1B6B8A" }}>Question Editor</h3>
        <button
          onClick={onCollapse}
          className="transition p-1 rounded"
          style={{ color: "#9ab8c0" }}
          onMouseEnter={e => { e.currentTarget.style.color = "#1B6B8A"; }}
          onMouseLeave={e => { e.currentTarget.style.color = "#9ab8c0"; }}
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
              <div className="text-center text-sm py-8">
                <p className="mb-2" style={{ color: "#9ab8c0" }}>💬 No messages yet</p>
                <p className="text-xs" style={{ color: "#9ab8c0" }}>
                  Ask questions about your survey or request edits
                </p>
              </div>
            ) : (
              <>
                {sidebarMessages.map((msg) => (
                  <ChatMessage key={msg.id} message={msg} />
                ))}
                {isLoading && (
                  <div className="flex gap-3">
                    <div
                      className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center"
                      style={{ backgroundColor: "#e8f6f7" }}
                    >
                      <div className="w-3 h-3 rounded-full animate-pulse" style={{ backgroundColor: "#2AABBA" }} />
                    </div>
                    <div className="text-sm" style={{ color: "#9ab8c0" }}>Thinking...</div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </>
            )}
          </div>

          {/* Input */}
          <div className="p-3 shrink-0" style={{ borderTop: "1px solid #d0eaea", backgroundColor: "#f0f8f8" }}>
            <form onSubmit={handleSendMessage} className="flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask anything..."
                disabled={isLoading}
                className="flex-1 px-3 py-2 rounded-lg text-sm outline-none transition-all disabled:cursor-not-allowed"
                style={{
                  border: "1px solid #b0d4dc",
                  backgroundColor: isLoading ? "#f0f8f8" : "#ffffff",
                  color: "#1B6B8A",
                }}
                onFocus={e => { e.currentTarget.style.border = "1px solid #2AABBA"; e.currentTarget.style.boxShadow = "0 0 0 3px #2AABBA22"; }}
                onBlur={e => { e.currentTarget.style.border = "1px solid #b0d4dc"; e.currentTarget.style.boxShadow = "none"; }}
              />
              <button
                type="submit"
                disabled={isLoading || !input.trim()}
                className="px-3 py-2 rounded-lg text-white transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                style={{ backgroundColor: "#1B6B8A" }}
                onMouseEnter={e => { if (!e.currentTarget.disabled) e.currentTarget.style.backgroundColor = "#155a75"; }}
                onMouseLeave={e => { e.currentTarget.style.backgroundColor = "#1B6B8A"; }}
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="p-3 shrink-0" style={{ borderTop: "1px solid #d0eaea", backgroundColor: "#f0f8f8" }}>
        <button
          onClick={() => {
            if (window.confirm('Clear chat history?')) {
              setSidebarMessages([]);
              showToast('Chat cleared');
            }
          }}
          disabled={sidebarMessages.length === 0}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ border: "1px solid #b0d4dc", color: "#1B6B8A", backgroundColor: "transparent" }}
          onMouseEnter={e => { if (!e.currentTarget.disabled) e.currentTarget.style.backgroundColor = "#e8f6f7"; }}
          onMouseLeave={e => { e.currentTarget.style.backgroundColor = "transparent"; }}
        >
          <Trash2 className="w-4 h-4" />
          Clear Chat
        </button>
      </div>
    </div>
  );
};
