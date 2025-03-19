"use client";

import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, Check, AlertTriangle, Unlock, Key } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Paper {
  trackingNumber: string;
  filePath: string;
  category: string;
}

interface DecryptedItem {
  [key: string]: {
    encrypted: string;
    original: string;
  };
}

interface MappingData {
  sensitive_data_found?: {
    name?: boolean;
    email?: boolean;
    affiliation?: boolean;
    title?: boolean;
    address?: boolean;
  };
  encrypted_data?: any[];
  total_replacements?: number;
}

interface ProcessResult {
  download_url: string;
  decrypted_items_count: number;
  decrypted_items: DecryptedItem[];
}

export default function PdfDecrypterComponent() {
  // State for encrypted files
  const [availableFiles, setAvailableFiles] = useState<Paper[]>([]);
  const [selectedFilename, setSelectedFilename] = useState<string>("");
  const [decryptionKey, setDecryptionKey] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [loadingFiles, setLoadingFiles] = useState<boolean>(true);
  const [result, setResult] = useState<ProcessResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [processingError, setProcessingError] = useState<string | null>(null);
  
  // Mapping data for decryption
  const [mappingData, setMappingData] = useState<MappingData | null>(null);

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
    // Fetch mapping data for the selected file
    fetchMappingData(filename);
  };

  // Fetch mapping data for a specific file
  const fetchMappingData = async (filename: string) => {
    try {
      // You'll need to create this API endpoint to get file mapping data
      const response = await fetch(`/api/get-mapping-data?filename=${encodeURIComponent(filename)}`);
      if (!response.ok) {
        throw new Error('Failed to fetch mapping data');
      }
      const data = await response.json();
      setMappingData(data.mapping || null);
    } catch (err) {
      console.error('Error fetching mapping data:', err);
      // Not setting an error here as it's not critical
    }
  };

  // Process the selected file for decryption
  const handleDecrypt = async () => {
    if (!selectedFilename) {
      setError('Please select a PDF file first');
      return;
    }

    if (!decryptionKey) {
      setError('Please enter the decryption key');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setProcessingError(null);
      setResult(null);

      console.log('Decrypting file:', selectedFilename);
      console.log('Using decryption key:', decryptionKey);

      // You'll need to create this API endpoint to handle PDF decryption
      const processResponse = await fetch('/api/py/decrypt-pdf', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          filename: selectedFilename,
          decryptionKey: decryptionKey
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
        decrypted_items_count: processResult.decrypted_items_count || 0,
        decrypted_items: processResult.decrypted_items || []
      });
    } catch (err) {
      console.error('Error in decryption process:', err);
      setError(err instanceof Error ? err.message : 'An unknown error occurred during decryption');
    } finally {
      setLoading(false);
    }
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

            {/* Decryption key input */}
            <div className="grid w-full items-center gap-2 mt-4">
              <Label htmlFor="decryption-key">Decryption Key</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="decryption-key"
                  type="text"
                  placeholder="Enter decryption key"
                  value={decryptionKey}
                  onChange={(e) => setDecryptionKey(e.target.value)}
                  className="flex-1"
                />
                <Button variant="outline" size="icon">
                  <Key className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Enter the decryption key provided when the PDF was anonymized
              </p>
            </div>

            {/* Display mapping data if available */}
            {mappingData && (
              <div className="mt-4">
                <h4 className="font-medium">Encrypted Data Types:</h4>
                <div className="mt-2 p-3 bg-gray-50 border rounded">
                  <ul className="list-disc pl-5">
                    {mappingData.sensitive_data_found?.name && <li>Author names</li>}
                    {mappingData.sensitive_data_found?.email && <li>Email addresses</li>}
                    {mappingData.sensitive_data_found?.affiliation && <li>Institutional affiliations</li>}
                    {mappingData.sensitive_data_found?.title && <li>Article title</li>}
                    {mappingData.sensitive_data_found?.address && <li>Address information</li>}
                    {!mappingData.sensitive_data_found?.name &&
                      !mappingData.sensitive_data_found?.email &&
                      !mappingData.sensitive_data_found?.affiliation &&
                      !mappingData.sensitive_data_found?.title &&
                      !mappingData.sensitive_data_found?.address &&
                      <li>No encrypted data found in mapping</li>}
                  </ul>
                </div>
              </div>
            )}

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
                  <p>Download: <a href={result.download_url} className="text-blue-600 underline">Download Decrypted PDF</a></p>

                  <div className="mt-2">
                    <h4 className="font-medium">Decryption summary:</h4>
                    <p>Total items decrypted: {result.decrypted_items_count}</p>
                  </div>
                </AlertDescription>
              </Alert>
            )}

            {result && result.decrypted_items && result.decrypted_items.length > 0 && (
              <div className="mt-4">
                <h4 className="font-medium">Decrypted Data:</h4>
                <ScrollArea className="h-60 border rounded mt-2">
                  <div className="p-3 bg-gray-50">
                    {result.decrypted_items.map((item, index) => {
                      const dataType = Object.keys(item)[0];
                      const data = item[dataType];
                      return (
                        <div key={index} className="mb-2 p-2 border-b last:border-b-0">
                          <div className="flex justify-between">
                            <span className="font-semibold capitalize">{dataType}:</span>
                          </div>
                          <div className="mt-1">
                            <span className="text-xs">Encrypted: </span>
                            <code className="bg-gray-100 px-1 py-0.5 rounded text-xs break-all">{data.encrypted}</code>
                          </div>
                          <div className="mt-1">
                            <span className="text-xs">Decrypted: </span>
                            <code className="bg-green-100 px-1 py-0.5 rounded text-xs">{data.original}</code>
                          </div>
                        </div>
                      );
                    })}
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
          disabled={!selectedFilename || !decryptionKey || loading}
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