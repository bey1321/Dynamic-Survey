import React from 'react';
import { MessageCircle, Bot } from 'lucide-react';

export const ChatMessage = ({ message }) => {
  const isUser = message.role === 'user';

  return (
    <div className={`flex gap-3 mb-4 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      {/* Avatar */}
      <div
        className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
          isUser
            ? 'bg-blue-100'
            : 'bg-gradient-to-br from-teal-100 to-blue-100'
        }`}
      >
        {isUser ? (
          <MessageCircle className="w-5 h-5 text-blue-600" />
        ) : (
          <Bot className="w-5 h-5 text-teal-600" />
        )}
      </div>

      {/* Message bubble */}
      <div
        className={`flex-1 max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
          isUser
            ? 'bg-blue-500 text-white rounded-br-none'
            : 'bg-gray-100 text-gray-900 rounded-bl-none'
        }`}
      >
        <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">
          {message.content}
        </p>
        {message.metadata?.action && (
          <p className="text-xs mt-2 opacity-75">
            {message.metadata.action === 'questions_regenerated'
              ? '✓ Questions regenerated'
              : message.metadata.action === 'regenerate_questions_triggered'
              ? '⟳ Regenerating...'
              : ''}
          </p>
        )}
      </div>
    </div>
  );
};
