"use client";

import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MessageCircle, Lock, Unlock } from "lucide-react";

import PdfAnonymizerComponent from '@/components/PdfAnonymizerComponent';
import ChatComponent from '@/components/ChatComponent';
import PdfDecrypterComponent from '@/components/PdfDecrypterComponent';


export default function Home() {
  const [activeTab, setActiveTab] = useState("chat");

  return (
    <main className="container mx-auto py-8 px-4">
      <Tabs defaultValue="chat" value={activeTab} onValueChange={setActiveTab} className="w-full max-w-6xl mx-auto">
        <div className="flex justify-center mb-6">
          <TabsList>
            <TabsTrigger value="chat" className="flex items-center gap-2">
              <MessageCircle className="h-4 w-4" />
              Chat
            </TabsTrigger>
            <TabsTrigger value="pdf-anonymizer" className="flex items-center gap-2">
              <Lock className="h-4 w-4" />
              PDF Anonymizer
            </TabsTrigger>
            <TabsTrigger value="pdf-decrypter" className="flex items-center gap-2">
              <Unlock className="h-4 w-4" />
              PDF Decrypter
            </TabsTrigger>
          </TabsList>
        </div>
        
        <TabsContent value="chat" className="mt-0">
          <ChatComponent />
        </TabsContent>
        
        <TabsContent value="pdf-anonymizer" className="mt-0">
          <PdfAnonymizerComponent />
        </TabsContent>
        
        <TabsContent value="pdf-decrypter" className="mt-0">
          <PdfDecrypterComponent />
        </TabsContent>
      </Tabs>
    </main>
  );
}