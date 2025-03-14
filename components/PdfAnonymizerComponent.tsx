"use client";

import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, FileText, Check, AlertTriangle } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";

export default function PdfAnonymizerComponent() {
  const [availableFiles, setAvailableFiles] = useState<string[]>([]);
  const [selectedFilename, setSelectedFilename] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [loadingFiles, setLoadingFiles] = useState(true);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [processingError, setProcessingError] = useState<string | null>(null);

  // Encryption options state
  const [encryptionOptions, setEncryptionOptions] = useState({
    name: true,
    email: true,
    affiliation: true,
    title: false,
    address: false
  });

  // Fetch available PDFs when component mounts
  useEffect(() => {
    const fetchAvailableFiles = async () => {
      try {
        const response = await fetch('/api/list-pdfs');
        if (!response.ok) {
          throw new Error('Failed to fetch PDF list');
        }
        const data = await response.json();
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

  // Handle checkbox changes
  const handleCheckboxChange = (option: string) => {
    setEncryptionOptions(prev => ({
      ...prev,
      [option]: !prev[option as keyof typeof prev]
    }));
  };

  // Process the selected file
  const handleProcess = async () => {
    if (!selectedFilename) {
      setError('Please select a PDF file first');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setProcessingError(null);
      setResult(null);

      console.log('Processing file:', selectedFilename);
      console.log('Encryption options:', encryptionOptions);

      const processResponse = await fetch('/api/py/process-pdf', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          filename: selectedFilename,
          encryptionOptions
        }),
      });

      if (!processResponse.ok) {
        const processError = await processResponse.json();
        setProcessingError(processError.error || 'Failed to process file');
        console.error('Processing error details:', processError.details);
        return;
      }

      const processResult = await processResponse.json();
      console.log('File processed successfully:', processResult);
      // Transform the result to include the mapping data which shows what was encrypted
      const transformedResult = {
        ...processResult,
        sensitiveDataFound: processResult.mapping.sensitive_data_found,
        authorCount: processResult.mapping.encrypted_data.filter((item: any) => item.name).length,
        encryptedItems: processResult.mapping.encrypted_data,
        totalReplacements: processResult.mapping.total_replacements
      };

      setResult(transformedResult);
    } catch (err) {
      console.error('Error in process flow:', err);
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle>Academic PDF Anonymizer</CardTitle>
        <CardDescription>
          Select an existing PDF from the server to redact author information and encrypt sensitive data.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="grid w-full items-center gap-2">
            {/* PDF Selection dropdown */}
            <div className="space-y-2">
              <Label htmlFor="pdf-select">Select PDF from server</Label>
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
                      <SelectItem key={file} value={file}>
                        {file}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Encryption options */}
            <div className="mt-4 mb-2">
              <h3 className="text-sm font-medium mb-2">Select information to encrypt:</h3>
              <div className="grid grid-cols-2 gap-2">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="encrypt-name"
                    checked={encryptionOptions.name}
                    onCheckedChange={() => handleCheckboxChange('name')}
                  />
                  <Label htmlFor="encrypt-name">Author Names</Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="encrypt-email"
                    checked={encryptionOptions.email}
                    onCheckedChange={() => handleCheckboxChange('email')}
                  />
                  <Label htmlFor="encrypt-email">Email Addresses</Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="encrypt-affiliation"
                    checked={encryptionOptions.affiliation}
                    onCheckedChange={() => handleCheckboxChange('affiliation')}
                  />
                  <Label htmlFor="encrypt-affiliation">University/Affiliation</Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="encrypt-title"
                    checked={encryptionOptions.title}
                    onCheckedChange={() => handleCheckboxChange('title')}
                  />
                  <Label htmlFor="encrypt-title">Article Title</Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="encrypt-address"
                    checked={encryptionOptions.address}
                    onCheckedChange={() => handleCheckboxChange('address')}
                  />
                  <Label htmlFor="encrypt-address">Addresses</Label>
                </div>
              </div>
            </div>

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
                <AlertTitle>Processing Error</AlertTitle>
                <AlertDescription>{processingError}</AlertDescription>
              </Alert>
            )}

            {result && (
              <Alert className="bg-green-50 border-green-200">
                <Check className="h-4 w-4 text-green-600" />
                <AlertTitle>Processing Complete</AlertTitle>
                <AlertDescription className="space-y-2">
                  <p>Successfully processed PDF</p>
                  <p>Download: <a href={result.download_url} className="text-blue-600 underline">Download Anonymized PDF</a></p>

                  <div className="mt-2">
                    <h4 className="font-medium">Sensitive data found and encrypted:</h4>
                    <ul className="list-disc pl-5 mt-1">
                      {result.sensitiveDataFound?.name &&
                        <li>Author names: {result.encryptedItems.filter((item: any) => item.name).length} found</li>}
                      {result.sensitiveDataFound?.email &&
                        <li>Email addresses: {result.encryptedItems.filter((item: any) => item.email).length} found</li>}
                      {result.sensitiveDataFound?.affiliation &&
                        <li>Institutional affiliations: {result.encryptedItems.filter((item: any) => item.affiliation).length} found</li>}
                      {result.sensitiveDataFound?.title && <li>Article title</li>}
                      {result.sensitiveDataFound?.address && <li>Address information</li>}
                      {!result.sensitiveDataFound?.name &&
                        !result.sensitiveDataFound?.email &&
                        !result.sensitiveDataFound?.affiliation &&
                        !result.sensitiveDataFound?.title &&
                        !result.sensitiveDataFound?.address &&
                        <li>No sensitive data found</li>}
                    </ul>
                  </div>
                </AlertDescription>
              </Alert>
            )}

            {result && result.mapping && result.mapping.encrypted_data && (
              <div className="mt-4">
                <h4 className="font-medium">Encrypted Data:</h4>
                <ScrollArea className="h-60 border rounded mt-2">
                  <div className="p-3 bg-gray-50">
                    {result.mapping.encrypted_data.map((item: any, index: number) => {
                      const dataType = Object.keys(item)[0];
                      const data = item[dataType];
                      return (
                        <div key={index} className="mb-2 p-2 border-b last:border-b-0">
                          <div className="flex justify-between">
                            <span className="font-semibold capitalize">{dataType}:</span>
                            <span className="text-xs bg-gray-200 px-2 py-1 rounded">
                              {data.algorithm || "AES-256-CBC"}
                            </span>
                          </div>
                          <div className="mt-1">
                            <span className="text-xs">Original: </span>
                            <code className="bg-green-100 px-1 py-0.5 rounded text-xs">{data.original}</code>
                          </div>
                          <div className="mt-1">
                            <span className="text-xs">Encrypted: </span>
                            <code className="bg-gray-100 px-1 py-0.5 rounded text-xs break-all">{data.encrypted}</code>
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
          onClick={handleProcess}
          disabled={!selectedFilename || loading}
          className="w-full"
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Processing...
            </>
          ) : (
            <>
              <FileText className="mr-2 h-4 w-4" />
              Process PDF
            </>
          )}
        </Button>
      </CardFooter>
    </Card>
  );
}