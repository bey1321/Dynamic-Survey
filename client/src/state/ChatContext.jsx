import React, { createContext, useState, useCallback, useRef } from 'react';

const generateId = () => Math.random().toString(36).substr(2, 9);

export const ChatContext = createContext();

export const ChatProvider = ({ children }) => {
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [conversationContext, setConversationContext] = useState({
    currentStep: 1,
    activeQuestionId: null,
    regenerationAttempt: 0,
  });
  const abortControllerRef = useRef(null);

  const addMessage = useCallback((role, content, metadata = {}) => {
    const message = {
      id: generateId(),
      role,
      content,
      timestamp: new Date(),
      metadata,
    };
    setMessages((prev) => [...prev, message]);
    return message;
  }, []);

  const sendChatMessage = useCallback(
    async (userMessage, context = {}) => {
      if (!userMessage.trim()) {
        setError('Message cannot be empty');
        return null;
      }

      setError(null);
      setIsLoading(true);

      // Add user message to thread
      addMessage('user', userMessage);

      try {
        // Cancel previous request if still pending
        if (abortControllerRef.current) {
          abortControllerRef.current.abort();
        }
        abortControllerRef.current = new AbortController();

        const response = await fetch('http://localhost:4000/api/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message: userMessage,
            context: {
              currentStep: context.currentStep || conversationContext.currentStep,
              surveyDraft: context.surveyDraft,
              variableModel: context.variableModel,
              questions: context.questions,
              evaluations: context.evaluations,
            },
            conversationHistory: messages.map((m) => ({
              role: m.role,
              content: m.content,
            })),
            action: context.action || 'chat',
          }),
          signal: abortControllerRef.current.signal,
        });

        if (!response.ok) {
          throw new Error(`API error: ${response.statusText}`);
        }

        const data = await response.json();

        // Add assistant message
        addMessage('assistant', data.message, {
          action: data.action,
          regeneratedQuestions: data.regeneratedQuestions,
        });

        setIsLoading(false);
        return data;
      } catch (err) {
        if (err.name === 'AbortError') {
          // Request was cancelled — clear loading state so spinner doesn't get stuck
          setIsLoading(false);
          return null;
        }
        const errorMsg = err.message || 'Failed to send message';
        setError(errorMsg);
        console.error('Chat error:', err);
        setIsLoading(false);
        return null;
      }
    },
    [messages, conversationContext, addMessage]
  );

  const clearChat = useCallback(() => {
    setMessages([]);
    setError(null);
    setConversationContext({
      currentStep: 1,
      activeQuestionId: null,
      regenerationAttempt: 0,
    });
  }, []);

  const updateConversationContext = useCallback((updates) => {
    setConversationContext((prev) => ({
      ...prev,
      ...updates,
    }));
  }, []);

  const regenerateQuestions = useCallback(
    async (feedback, context = {}) => {
      return sendChatMessage(feedback, {
        ...context,
        action: 'regenerate_questions',
      });
    },
    [sendChatMessage]
  );

  const value = {
    messages,
    isLoading,
    error,
    conversationContext,
    addMessage,
    sendChatMessage,
    clearChat,
    updateConversationContext,
    regenerateQuestions,
  };

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
};

export const useChat = () => {
  const context = React.useContext(ChatContext);
  if (!context) {
    throw new Error('useChat must be used within ChatProvider');
  }
  return context;
};
