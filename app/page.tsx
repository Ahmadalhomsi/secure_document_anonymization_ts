// app/upload/page.tsx
"use client"
import { useEffect, useState, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import FileUpload from "@/components/file-upload";
import axios from "axios";

export default function UploadPage() {
  // File upload state
  const [email, setEmail] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState<string>("");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  
  // Chat state
  const [messages, setMessages] = useState<{ id: number; text: string; sender: "user" | "support" }[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Active tab state
  const [activeTab, setActiveTab] = useState("upload");

  // Scroll to bottom of chat when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Connect to WebSocket
  useEffect(() => {
    // Connect to the WebSocket server
    const ws = new WebSocket("ws://localhost:8080");

    ws.onopen = () => {
      console.log("Connected to WebSocket server");
      setIsConnected(true);
      
      // Add welcome message
      setMessages([
        { 
          id: Date.now(), 
          text: "Welcome to support chat. How can we help you with your paper submission?", 
          sender: "support" 
        }
      ]);
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      setMessages((prev) => [...prev, { 
        id: Date.now(), 
        text: data.message,
        sender: "support"
      }]);
    };

    ws.onclose = () => {
      console.log("Disconnected from WebSocket server");
      setIsConnected(false);
    };

    setSocket(ws);

    // Cleanup on unmount
    return () => {
      ws.close();
    };
  }, []);

  const handleFileChange = (newFile: File | null) => {
    setFile(newFile);
    setFileName(newFile?.name || "");
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!email) {
      setError("Please provide your email address.");
      return;
    }

    if (!file) {
      setError("Please select a PDF file to upload.");
      return;
    }

    setIsSubmitting(true);
    setUploadProgress(0);

    try {
      const formData = new FormData();
      formData.append("authorEmail", email);
      formData.append("file", file);
      formData.append("originalFileName", file.name);

      const response = await axios.post("/api/upload", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
        onUploadProgress: (progressEvent) => {
          if (progressEvent.total) {
            const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            setUploadProgress(percentCompleted);
          }
        },
      });

      setTrackingNumber(response.data.trackingNumber);
      
      // Automatically switch to chat tab after successful upload
      setActiveTab("chat");
      
      // Send notification to chat about upload
      if (socket && socket.readyState === WebSocket.OPEN) {
        setTimeout(() => {
          // Add system message about upload
          setMessages(prev => [...prev, {
            id: Date.now(),
            text: `Your paper has been uploaded successfully. Tracking number: ${response.data.trackingNumber}`,
            sender: "support"
          }]);
        }, 1000);
      }
    } catch (error: any) {
      console.error("Upload error:", error);
      setError(error.response?.data?.error || "Failed to upload paper. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const sendMessage = (e?: React.FormEvent) => {
    e?.preventDefault();
    
    if (socket && inputValue.trim() && socket.readyState === WebSocket.OPEN) {
      // Add user message to chat
      const newMessage = { 
        id: Date.now(), 
        text: inputValue,
        sender: "user"
      };
      setMessages(prev => [...prev, { ...newMessage, sender: newMessage.sender as "user" | "support" }]);
      
      // Send to server
      const message = { message: inputValue, email, trackingNumber };
      socket.send(JSON.stringify(message));
      
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
    <div className="flex items-center justify-center min-h-screen bg-gray-50 p-4">
      <Card className="w-full max-w-4xl">
        <CardHeader>
          <CardTitle>Paper Submission Portal</CardTitle>
          <CardDescription>Upload your paper and chat with our support team</CardDescription>
        </CardHeader>
        
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="upload">Upload Paper</TabsTrigger>
            <TabsTrigger value="chat">
              Support Chat
              {!isConnected && <Badge variant="destructive" className="ml-2">Offline</Badge>}
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="upload">
            <CardContent>
              <form onSubmit={handleUploadSubmit} className="space-y-4">
                <Input
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={isSubmitting}
                />

                <FileUpload
                  onFileChange={handleFileChange}
                  isSubmitting={isSubmitting}
                />

                {fileName && (
                  <div className="text-sm text-gray-600 mt-2 p-2 bg-gray-100 rounded-md">
                    Selected file: {fileName}
                  </div>
                )}

                {isSubmitting && (
                  <div className="w-full">
                    <div className="bg-gray-200 rounded-full h-2.5">
                      <div
                        className="bg-blue-600 h-2.5 rounded-full"
                        style={{ width: `${uploadProgress}%` }}
                      ></div>
                    </div>
                    <p className="text-sm text-center mt-1">Uploading: {uploadProgress}%</p>
                  </div>
                )}

                {error && (
                  <div className="p-3 bg-red-100 text-red-800 rounded-md">
                    {error}
                  </div>
                )}
              </form>
            </CardContent>
            
            <CardFooter className="flex flex-col items-center">
              <Button
                onClick={handleUploadSubmit}
                disabled={isSubmitting || !email || !file}
                className="w-full"
              >
                {isSubmitting ? "Uploading..." : "Submit"}
              </Button>

              {trackingNumber && (
                <div className="mt-4 p-3 bg-green-100 text-green-800 rounded-md w-full">
                  Paper uploaded successfully! Your tracking number is: <br />
                  <span className="font-bold">{trackingNumber}</span>
                  <Button 
                    variant="link" 
                    className="p-0 h-auto mt-2" 
                    onClick={() => setActiveTab("chat")}
                  >
                    Need help? Chat with our support team.
                  </Button>
                </div>
              )}
            </CardFooter>
          </TabsContent>
          
          <TabsContent value="chat">
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
                  disabled={!isConnected}
                />
                <Button 
                  type="submit" 
                  disabled={!isConnected || !inputValue.trim()}
                >
                  Send
                </Button>
              </form>
            </CardContent>
            
            <CardFooter className="text-sm text-gray-500">
              {isConnected ? (
                <div className="flex items-center">
                  <div className="h-2 w-2 rounded-full bg-green-500 mr-2"></div>
                  Connected to support
                </div>
              ) : (
                <div className="flex items-center">
                  <div className="h-2 w-2 rounded-full bg-red-500 mr-2"></div>
                  Disconnected from support
                </div>
              )}
              
              {trackingNumber && (
                <div className="ml-auto">
                  Tracking number: <span className="font-medium">{trackingNumber}</span>
                </div>
              )}
            </CardFooter>
          </TabsContent>
        </Tabs>
      </Card>
    </div>
  );
}