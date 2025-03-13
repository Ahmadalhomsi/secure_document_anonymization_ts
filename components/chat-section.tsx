// components/chat-section.tsx
"use client"
import React, { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CardContent, CardFooter } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

interface Message {
  id: number;
  text: string;
  sender: "user" | "support";
}

interface ChatSectionProps {
  email: string;
  trackingNumber: string;
}

export function ChatSection({ email, trackingNumber }: ChatSectionProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom of chat when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Add welcome message on component mount
  useEffect(() => {
    setMessages([
      {
        id: Date.now(),
        text: "Welcome to support chat. How can we help you with your paper submission?",
        sender: "support"
      }
    ]);
  }, []);

  // Send tracking number notification to chat after successful upload
  useEffect(() => {
    if (trackingNumber) {
      setTimeout(() => {
        // Add system message about upload
        setMessages(prev => [...prev, {
          id: Date.now(),
          text: `Your paper has been uploaded successfully. Tracking number: ${trackingNumber}`,
          sender: "support"
        }]);
      }, 1000);
    }
  }, [trackingNumber]);

  const sendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();

    if (inputValue.trim()) {
      // Add user message to chat
      const newMessage: Message = {
        id: Date.now(),
        text: inputValue,
        sender: "user"
      };
      setMessages(prev => [...prev, newMessage]);

      // Send to server using fetch
      try {
        const response = await fetch('/api/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ sender: email, receiver: 'support', message: inputValue }),
        });

        if (response.ok) {
          const data = await response.json();
          // Optionally, handle the server response
        } else {
          console.error('Failed to send message');
        }
      } catch (error) {
        console.error('Error sending message:', error);
      }

      setInputValue("");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <>
      <CardContent className="flex flex-col h-[400px]">
        <ScrollArea className="flex-1 p-4 border rounded-md mb-4">
          {messages.length === 0 ? (
            <div className="h-full flex items-center justify-center text-gray-400">
              No messages yet. Start the conversation!
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.sender === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div className={`flex items-start max-w-[80%] ${msg.sender === "user" ? "flex-row-reverse" : ""}`}>
                    <Avatar className={`${msg.sender === "user" ? "ml-2" : "mr-2"} h-8 w-8`}>
                      <AvatarFallback>
                        {msg.sender === "user" ? "U" : "S"}
                      </AvatarFallback>
                    </Avatar>
                    <div className={`p-3 rounded-lg ${
                      msg.sender === "user"
                        ? "bg-blue-500 text-white rounded-tr-none"
                        : "bg-gray-200 text-gray-800 rounded-tl-none"
                    }`}>
                      {msg.text}
                    </div>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}
        </ScrollArea>

        <form onSubmit={sendMessage} className="flex space-x-2">
          <Input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
          />
          <Button
            type="submit"
            disabled={!inputValue.trim()}
          >
            Send
          </Button>
        </form>
      </CardContent>

      <CardFooter className="text-sm text-gray-500">
        <div className="flex items-center">
          <div className="h-2 w-2 rounded-full bg-green-500 mr-2"></div>
          Connected to support
        </div>

        {trackingNumber && (
          <div className="ml-auto">
            Tracking number: <span className="font-medium">{trackingNumber}</span>
          </div>
        )}
      </CardFooter>
    </>
  );
}
