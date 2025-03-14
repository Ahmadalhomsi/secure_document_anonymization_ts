"use client";

import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, SendIcon } from "lucide-react";

export default function ChatComponent() {
  const [messages, setMessages] = useState<{ id: number; text: string }[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Fetch messages from the server
    const fetchMessages = async () => {
      try {
        setLoading(true);
        const response = await fetch("/api/messages");
        const data = await response.json();
        console.log("Fetched Data:", data);

        // Transform the data to match your component's expected format
        const formattedMessages = data.map((msg: any) => ({
          id: msg.id,
          text: msg.message // Use the 'message' field as the 'text'
        }));

        setMessages(formattedMessages);
      } catch (error) {
        console.error("Error fetching messages:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchMessages();
  }, []);

  const sendMessage = async () => {
    if (inputValue.trim()) {
      try {
        setLoading(true);
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
      } finally {
        setLoading(false);
      }
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      sendMessage();
    }
  };

  return (
    <Card className="w-full max-w-4xl mx-auto h-[80vh] flex flex-col">
      <CardHeader>
        <CardTitle>Chat Application</CardTitle>
        <CardDescription>
          Send and receive messages in real-time
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden">
        <ScrollArea className="h-full p-4 border rounded-md">
          {loading && messages.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              No messages yet. Start a conversation!
            </div>
          ) : (
            messages.map((msg) => (
              <div key={msg.id} className="mb-4 p-3 bg-slate-50 rounded-lg">
                {msg.text}
              </div>
            ))
          )}
        </ScrollArea>
      </CardContent>
      <CardFooter>
        <div className="flex w-full space-x-2">
          <Input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Type a message..."
            disabled={loading}
          />
          <Button onClick={sendMessage} disabled={loading || !inputValue.trim()}>
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <SendIcon className="h-4 w-4" />
            )}
            <span className="ml-2">Send</span>
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}