"use client"
import React, { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CardContent, CardFooter } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

interface Message {
  id: number;
  sender: string;
  receiver: string;
  message: string;
  createdAt: string;
}

interface ChatSectionProps {
  trackingNumber?: string;
}

export function ChatSection({ trackingNumber }: ChatSectionProps) {
  const [email, setEmail] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(true);
  const [emailError, setEmailError] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Validate email
  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  // Scroll to bottom of chat when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Fetch messages when email is set
  useEffect(() => {
    const fetchMessages = async () => {
      if (!email) return;

      try {
        const response = await fetch(`/api/messages?user=${email}`);
        const data = await response.json();
        setMessages(data);
      } catch (error) {
        console.error('Error fetching messages:', error);
      }
    };

    fetchMessages();
  }, [email]);

  // Handle email submission
  const handleEmailSubmit = () => {
    if (!validateEmail(email)) {
      setEmailError("Please enter a valid email address");
      return;
    }

    setEmailError("");
    setIsEmailModalOpen(false);

    // Send initial welcome message
    const initialMessage: Message = {
      id: Date.now(),
      sender: 'support',
      receiver: email,
      message: "Welcome to support chat. How can we help you with your paper submission?",
      createdAt: new Date().toISOString()
    };
    setMessages([initialMessage]);
  };

  const sendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();

    if (inputValue.trim()) {
      try {
        const response = await fetch('/api/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ 
            sender: email, 
            receiver: 'support', 
            message: inputValue 
          }),
        });

        if (response.ok) {
          const newMessage = await response.json();
          setMessages(prev => [...prev, newMessage]);
          setInputValue("");
        } else {
          console.error('Failed to send message');
        }
      } catch (error) {
        console.error('Error sending message:', error);
      }
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
      {/* Email Input Modal */}
      <Dialog open={isEmailModalOpen} onOpenChange={setIsEmailModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Enter Your Email</DialogTitle>
            <DialogDescription>
              Please provide your email to start the chat
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
              />
              {emailError && (
                <p className="text-red-500 text-sm">{emailError}</p>
              )}
            </div>
            <Button 
              onClick={handleEmailSubmit}
              className="w-full"
            >
              Start Chat
            </Button>
          </div>
        </DialogContent>
      </Dialog>

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
                  className={`flex ${msg.sender === email ? "justify-end" : "justify-start"}`}
                >
                  <div className={`flex items-start max-w-[80%] ${msg.sender === email ? "flex-row-reverse" : ""}`}>
                    <Avatar className={`${msg.sender === email ? "ml-2" : "mr-2"} h-8 w-8`}>
                      <AvatarFallback>
                        {msg.sender === email ? "U" : "S"}
                      </AvatarFallback>
                    </Avatar>
                    <div className={`p-3 rounded-lg ${msg.sender === email
                        ? "bg-blue-500 text-white rounded-tr-none"
                        : "bg-gray-200 text-gray-800 rounded-tl-none"
                      }`}>
                      {msg.message}
                      <div className="text-xs mt-1 opacity-50 text-right">
                        {new Date(msg.createdAt).toLocaleString()}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}
        </ScrollArea>

        <form 
          onSubmit={sendMessage} 
          className="flex space-x-2"
          style={{ display: isEmailModalOpen ? 'none' : 'flex' }}
        >
          <Input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            disabled={isEmailModalOpen}
          />
          <Button
            type="submit"
            disabled={!inputValue.trim() || isEmailModalOpen}
          >
            Send
          </Button>
        </form>
      </CardContent>

      <CardFooter className="text-sm text-gray-500">
        <div className="flex items-center">
          <div className="h-2 w-2 rounded-full bg-green-500 mr-2"></div>
          {email ? `Connected as ${email}` : "Not connected"}
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