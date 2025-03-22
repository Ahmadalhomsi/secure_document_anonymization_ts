"use client";

import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, Check, AlertTriangle, Unlock, FileText } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";

interface Paper {
  trackingNumber: string;
  filePath: string;
  category: string;
}

interface DecryptedItem {
  encrypted: string;
  decrypted: string;
  method?: string;
  error?: string;
}

interface ProcessResult {
  download_url: string;
  decrypted_items_count: number;
  decrypted_items: Record<string, { encrypted: string, original: string }>[]; // Original format
  decryption_results?: DecryptedItem[]; // New format from backend
}

export default function PdfDecrypterComponent() {
  // State for encrypted files
  const [availableFiles, setAvailableFiles] = useState<Paper[]>([]);
  const [selectedFilename, setSelectedFilename] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [loadingFiles, setLoadingFiles] = useState<boolean>(true);
  const [result, setResult] = useState<ProcessResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [processingError, setProcessingError] = useState<string | null>(null);
  
  // New state for replacement option
  const [replaceWithNewPage, setReplaceWithNewPage] = useState<boolean>(true);

  // Fetch available encrypted PDFs when component mounts
  useEffect(() => {
    const fetchAvailableFiles = async () => {
      try {
        // Use the existing API endpoint for reviewed PDFs
        const response = await fetch('/api/list-reviewed');
        if (!response.ok) {
          throw new Error('Failed to fetch PDF list');
        }
        const data = await response.json();
        console.log('Available PDF files:', data.files);

        setAvailableFiles(data.files || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load PDF files');
      } finally {
        setLoadingFiles(false);
      }
    };

    fetchAvailableFiles();
  }, []);

  // Handle file selection
  const handleFileSelection = (filename: string) => {
    setSelectedFilename(filename);
    setError(null);
    setProcessingError(null);
    setResult(null);
  };

  // Process the selected file for decryption
  const handleDecrypt = async () => {
    if (!selectedFilename) {
      setError('Please select a PDF file first');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setProcessingError(null);
      setResult(null);

      console.log('Decrypting file:', selectedFilename);

      let content;
      try {
        const res = await fetch(`/api/upload-pdf`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            filename: ("processed_" + selectedFilename),
          }),
        });
        if (!res.ok) {
          throw new Error('Failed to fetch PDF content');
        }
        content = await res.text();
      } catch (error) {
        console.log('Error fetching PDF content:', error);
        setError('Failed to fetch PDF content');
        setLoading(false);
        return;
      }

      console.log('PDF content:', content);

      // Send to API for decryption with new option to replace pages
      const processResponse = await fetch('/api/py/decrypt', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          pdfFileContent: content,
          fileName: ("reviewed_" + selectedFilename),
          replaceWithNewPage: replaceWithNewPage
        }),
      });
      
      if (!processResponse.ok) {
        const processError = await processResponse.json();
        setProcessingError(processError.error || 'Failed to decrypt file');
        console.error('Decryption error details:', processError.details);
        return;
      }

      const processResult = await processResponse.json();
      console.log('File decrypted successfully:', processResult);
      
      try { // process pdf by passing tracking number to update its status
        const selectedPaper = availableFiles.find(file => file.filePath === selectedFilename);
        if (!selectedPaper) {
          throw new Error('Selected file not found in available files');
        }

        await fetch('/api/process-decrypted-pdf', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            trackingNumber: selectedPaper.trackingNumber,
          }),
        });
      } catch (error) {
        console.error('Error updating paper status:', error);
        setError('Failed to update paper status');
      }

      setResult({
        download_url: processResult.download_url,
        decrypted_items_count: processResult.total_decrypted || processResult.decrypted_items_count || 0,
        decrypted_items: processResult.decrypted_items || [],
        decryption_results: processResult.decryption_results || []
      });
    } catch (err) {
      console.error('Error in decryption process:', err);
      setError(err instanceof Error ? err.message : 'An unknown error occurred during decryption');
    } finally {
      setLoading(false);
    }
  };

  // Format the decryption results for display
  const getFormattedResults = () => {
    if (!result) return [];
    
    // Use new format if available
    if (result.decryption_results && result.decryption_results.length > 0) {
      return result.decryption_results.map((item, index) => ({
        index,
        dataType: 'Data',
        encrypted: item.encrypted,
        original: item.decrypted,
        method: item.method
      }));
    }
    
    // Fallback to old format
    return (result.decrypted_items || []).map((item, index) => {
      const dataType = Object.keys(item)[0];
      const data = item[dataType];
      return {
        index,
        dataType,
        encrypted: data.encrypted,
        original: data.original
      };
    });
  };

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle>Academic PDF Decrypter</CardTitle>
        <CardDescription>
          Decrypt previously anonymized PDFs to restore author information and sensitive data.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="grid w-full items-center gap-2">
            {/* PDF Selection dropdown */}
            <div className="space-y-2">
              <Label htmlFor="pdf-select">Select PDF to decrypt</Label>
              <Select
                value={selectedFilename}
                onValueChange={handleFileSelection}
                disabled={loadingFiles}
              >
                <SelectTrigger id="pdf-select" className="w-full">
                  <SelectValue placeholder={loadingFiles ? "Loading files..." : "Select a PDF file"} />
                </SelectTrigger>
                <SelectContent>
                  {availableFiles.length === 0 && !loadingFiles ? (
                    <SelectItem value="no-files" disabled>No PDFs available</SelectItem>
                  ) : (
                    availableFiles.map(file => (
                      <SelectItem key={file.filePath} value={file.filePath}>
                        {file.filePath} ({file.category})
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* New option for replacing pages */}
            <div className="flex items-center justify-between space-x-2 mt-4">
              <Label htmlFor="replace-option" className="flex-1">
                Replace encrypted pages with a new summary page
              </Label>
              <Switch
                id="replace-option"
                checked={replaceWithNewPage}
                onCheckedChange={setReplaceWithNewPage}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              When enabled, the decrypted PDF will have a new summary page with all decrypted data
            </p>

            {error && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {processingError && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Decryption Error</AlertTitle>
                <AlertDescription>{processingError}</AlertDescription>
              </Alert>
            )}

            {result && (
              <Alert className="bg-green-50 border-green-200">
                <Check className="h-4 w-4 text-green-600" />
                <AlertTitle>Decryption Complete</AlertTitle>
                <AlertDescription className="space-y-2">
                  <p>Successfully decrypted PDF</p>
                  <p>Download: <a href={result.download_url} className="text-blue-600 underline">
                    <FileText className="h-4 w-4 inline mr-1" />
                    Download Decrypted PDF
                  </a></p>

                  <div className="mt-2">
                    <h4 className="font-medium">Decryption summary:</h4>
                    <p>Total items decrypted: {result.decrypted_items_count}</p>
                    {replaceWithNewPage && (
                      <p className="text-xs text-muted-foreground mt-1">
                        A new summary page has been added to the PDF with all decrypted information
                      </p>
                    )}
                  </div>
                </AlertDescription>
              </Alert>
            )}

            {result && getFormattedResults().length > 0 && (
              <div className="mt-4">
                <h4 className="font-medium">Decrypted Data:</h4>
                <ScrollArea className="h-60 border rounded mt-2">
                  <div className="p-3 bg-gray-50">
                    {getFormattedResults().map((item : any) => (
                      <div key={item.index} className="mb-2 p-2 border-b last:border-b-0">
                        <div className="flex justify-between">
                          <span className="font-semibold capitalize">{item.dataType}:</span>
                          {item.method && <span className="text-xs bg-blue-100 px-2 py-0.5 rounded">Method: {item.method}</span>}
                        </div>
                        <div className="mt-1">
                          <span className="text-xs">Encrypted: </span>
                          <code className="bg-gray-100 px-1 py-0.5 rounded text-xs break-all">{item.encrypted}</code>
                        </div>
                        <div className="mt-1">
                          <span className="text-xs">Decrypted: </span>
                          <code className="bg-green-100 px-1 py-0.5 rounded text-xs">{item.original}</code>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            )}
          </div>
        </div>
      </CardContent>
      <CardFooter>
        <Button
          onClick={handleDecrypt}
          disabled={!selectedFilename || loading}
          className="w-full"
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Decrypting...
            </>
          ) : (
            <>
              <Unlock className="mr-2 h-4 w-4" />
              Decrypt PDF
            </>
          )}
        </Button>
      </CardFooter>
    </Card>
  );
}