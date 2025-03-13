"use client";

import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

export default function ChatPage() {
  const [messages, setMessages] = useState<{ id: number; text: string }[]>([]);
  const [inputValue, setInputValue] = useState("");

  useEffect(() => {
    // Fetch messages from the server
    const fetchMessages = async () => {
      try {
        const response = await fetch("/api/messages");
        const data = await response.json();
        console.log("Fetched Data:", data);

        // Transform the data to match your component's expected format
        const formattedMessages = data.map((msg : any) => ({
          id: msg.id,
          text: msg.message // Use the 'message' field as the 'text'
        }));

        setMessages(formattedMessages);
      } catch (error) {
        console.error("Error fetching messages:", error);
      }
    };

    fetchMessages();
  }, []);

  const sendMessage = async () => {
    if (inputValue.trim()) {
      try {
        const response = await fetch("/api/messages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ message: inputValue }),
        });

        if (response.ok) {
          const newMessage = await response.json();
          setMessages((prev) => [...prev, newMessage]);
          setInputValue("");
        } else {
          console.error("Error sending message:", await response.text());
        }
      } catch (error) {
        console.error("Error sending message:", error);
      }
    }
  };

  return (
    <div className="flex flex-col h-screen p-4">
      <h1 className="text-2xl font-bold mb-4">Chat Application</h1>
      <ScrollArea className="flex-1 p-4 border rounded-md overflow-y-auto">
        {messages.map((msg) => (
          <div key={msg.id} className="mb-2">
            {msg.text}
          </div>
        ))}
      </ScrollArea>
      <div className="flex mt-4 space-x-2">
        <Input
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder="Type a message..."
        />
        <Button onClick={sendMessage}>Send</Button>
      </div>
    </div>
  );
}
