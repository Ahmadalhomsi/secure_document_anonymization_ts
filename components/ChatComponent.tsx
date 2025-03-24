"use client";

import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, SendIcon } from "lucide-react";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";

interface Message {
  id: number;
  sender: string;
  receiver: string;
  message: string;
  createdAt: string;
}

export default function ChatComponent() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [selectedUser, setSelectedUser] = useState("");
  const [users, setUsers] = useState<string[]>([]);

  // Manager's fixed email
  const MANAGER_EMAIL = "manager@mng.com";

  // Fetch unique senders (users) who have sent messages
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const response = await fetch("/api/messages/users");
        const data = await response.json();
        setUsers(data.filter((user: string) => user !== MANAGER_EMAIL));
      } catch (error) {
        console.error("Error fetching users:", error);
      }
    };

    fetchUsers();
  }, []);

  // Fetch messages for selected user
  useEffect(() => {
    const fetchMessages = async () => {
      if (!selectedUser) return;

      try {
        setLoading(true);
        const response = await fetch(`/api/messages?user=${selectedUser}`);
        const data = await response.json();
        setMessages(data);
      } catch (error) {
        console.error("Error fetching messages:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchMessages();
  }, [selectedUser]);

  const sendMessage = async () => {
    if (inputValue.trim() && selectedUser) {
      try {
        setLoading(true);
        const response = await fetch("/api/messages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ 
            sender: MANAGER_EMAIL, 
            receiver: selectedUser, 
            message: inputValue 
          }),
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
        <CardTitle>Support Chat Management</CardTitle>
        <CardDescription>
          Select a user to chat with and send messages
        </CardDescription>
      </CardHeader>

      {/* User Selection Dropdown */}
      <CardContent className="pb-0">
        <Select 
          value={selectedUser} 
          onValueChange={setSelectedUser}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select a user to chat" />
          </SelectTrigger>
          <SelectContent>
            {users.map((user) => (
              <SelectItem key={user} value={user}>
                {user}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CardContent>

      <CardContent className="flex-1 overflow-hidden">
        <ScrollArea className="h-full p-4 border rounded-md">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : !selectedUser ? (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              Please select a user to view messages
            </div>
          ) : messages.length === 0 ? (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              No messages yet. Start a conversation!
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.sender === MANAGER_EMAIL ? "justify-end" : "justify-start"}`}
                >
                  <div className={`max-w-[80%] p-3 rounded-lg ${
                    msg.sender === MANAGER_EMAIL
                      ? "bg-blue-500 text-white"
                      : "bg-gray-200 text-gray-800"
                  }`}>
                    <div className="text-xs mb-1 opacity-75">
                      {msg.sender}
                    </div>
                    {msg.message}
                    <div className="text-xs mt-1 opacity-50 text-right">
                      {new Date(msg.createdAt).toLocaleString()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
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
            disabled={loading || !selectedUser}
          />
          <Button 
            onClick={sendMessage} 
            disabled={loading || !inputValue.trim() || !selectedUser}
          >
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