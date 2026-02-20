import { useEffect, useRef, useState } from 'react';
import { X, Send, Loader, Trash2 } from 'lucide-react';
import { useChat } from '../state/ChatContext';
import { useSurvey } from '../state/SurveyContext';
import { useToast } from '../state/ToastContext';
import { ChatMessage } from './ChatMessage';

export const ChatSidebar = () => {
  const { messages, isLoading, error, sendChatMessage, clearChat, conversationContext } = useChat();
  const { surveyDraft, variableModel, questionsState, evaluations, setQuestionsFromAI } = useSurvey();
  const { showToast } = useToast();
  const [input, setInput] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userInput = input.trim();
    setInput('');

    const contextToSend = {
      currentStep: conversationContext.currentStep,
      surveyDraft,
      variableModel: variableModel?.model,
      questions: questionsState?.questions || [],
      evaluations: evaluations || [],
    };

    const response = await sendChatMessage(userInput, contextToSend);

    if (response?.regeneratedQuestions) {
      setQuestionsFromAI(response.regeneratedQuestions);
      showToast('Questions updated based on your feedback!');
    }
  };

  const handleClearChat = () => {
    if (window.confirm('Clear chat history?')) {
      clearChat();
      showToast('Chat cleared');
    }
  };

  // ── Closed: floating bubble button ───────────────────────────────────────
  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 w-14 h-14 bg-gradient-to-br from-teal-500 to-blue-600 text-white rounded-full shadow-lg hover:shadow-xl hover:scale-110 transition-all flex items-center justify-center z-40"
        title="Open chat"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
      </button>
    );
  }

  // ── Open: fixed floating panel (400 × 600, bottom-right) ─────────────────
  return (
    <div className="fixed bottom-6 right-6 w-96 h-[600px] bg-white rounded-lg shadow-2xl flex flex-col z-50 border border-gray-200">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gradient-to-r from-teal-50 to-blue-50">
        <h3 className="font-semibold text-gray-800">Survey Assistant</h3>
        <button
          onClick={() => setIsOpen(false)}
          className="text-gray-500 hover:text-gray-700 transition"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-white">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center">
            <div className="w-12 h-12 bg-teal-100 rounded-full flex items-center justify-center mb-3">
              <svg className="w-6 h-6 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <p className="text-sm text-gray-600 font-medium mb-1">Need help?</p>
            <p className="text-xs text-gray-500">
              Ask me to regenerate questions, clarify your survey needs, or explain quality issues.
            </p>
          </div>
        ) : (
          <>
            {messages.map((message) => (
              <ChatMessage key={message.id} message={message} />
            ))}
            {isLoading && (
              <div className="flex gap-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center bg-teal-100">
                  <Loader className="w-5 h-5 text-teal-600 animate-spin" />
                </div>
                <div className="flex-1 max-w-md px-4 py-2 rounded-lg bg-gray-100 text-gray-500 rounded-bl-none text-sm">
                  Thinking...
                </div>
              </div>
            )}
            {error && (
              <div className="px-3 py-2 rounded bg-red-50 border border-red-200">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Input area */}
      <div className="border-t border-gray-200 bg-gray-50 p-4 space-y-3">
        <form onSubmit={handleSendMessage} className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask anything..."
            disabled={isLoading}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
            title="Send message"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>

        <div className="flex gap-2">
          <button
            onClick={handleClearChat}
            disabled={isLoading || messages.length === 0}
            className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm text-gray-600 hover:text-gray-700 hover:bg-white border border-gray-300 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
            title="Clear chat history"
          >
            <Trash2 className="w-4 h-4" />
            Clear
          </button>
        </div>

        {messages.length === 0 && (
          <div className="space-y-2 text-xs">
            <p className="text-gray-600 font-medium">Try asking:</p>
            <button
              onClick={() => setInput('Make the questions simpler')}
              className="block w-full text-left px-2 py-1 text-gray-600 hover:text-blue-600 hover:bg-white rounded transition"
            >
              • "Make the questions simpler"
            </button>
            <button
              onClick={() => setInput('Regenerate the questions')}
              className="block w-full text-left px-2 py-1 text-gray-600 hover:text-blue-600 hover:bg-white rounded transition"
            >
              • "Regenerate the questions"
            </button>
            <button
              onClick={() => setInput('Explain the quality issues')}
              className="block w-full text-left px-2 py-1 text-gray-600 hover:text-blue-600 hover:bg-white rounded transition"
            >
              • "Explain the quality issues"
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
