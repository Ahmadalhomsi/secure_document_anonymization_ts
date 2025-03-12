"use client";

import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, FileText, Check, AlertTriangle, Info } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<boolean>(false);
  const [processingError, setProcessingError] = useState<string | null>(null);

  // Encryption options state
  const [encryptionOptions, setEncryptionOptions] = useState({
    name: true,
    email: true,
    affiliation: true,
    title: false,
    address: false
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile && selectedFile.type === 'application/pdf') {
      setFile(selectedFile);
      setError(null);
      setUploadError(null);
      setProcessingError(null);
      setUploadSuccess(false);
      setResult(null);
    } else {
      setFile(null);
      setError('Please select a valid PDF file.');
    }
  };

  // Handle checkbox changes
  const handleCheckboxChange = (option: string) => {
    setEncryptionOptions(prev => ({
      ...prev,
      [option]: !prev[option as keyof typeof prev]
    }));
  };

  // This is the corrected version of your handleUpload function
  const handleUpload = async () => {
    if (!file) return;

    try {
      setLoading(true);
      setError(null);
      setUploadError(null);
      setProcessingError(null);
      setResult(null);

      // First upload the file to the server
      const formData = new FormData();
      formData.append('file', file);

      console.log('Uploading file:', file.name);

      const uploadResponse = await fetch('/api/upload-pdf', {
        method: 'POST',
        body: formData,
      });

      if (!uploadResponse.ok) {
        const uploadResult = await uploadResponse.json();
        setUploadError(uploadResult.error || 'Failed to upload file');
        return;
      }

      const uploadResult = await uploadResponse.json();
      setUploadSuccess(true);
      console.log('File uploaded successfully:', uploadResult);

      // Then process the uploaded file with encryption options
      console.log('Processing file:', uploadResult.filename);
      console.log('Encryption options:', encryptionOptions);

      const processResponse = await fetch('/api/py/process-pdf', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          filename: uploadResult.filename,
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

      // // Add a download link if available
      // if (processResult.download_url) {
      //   setDownloadUrl(processResult.download_url);
      // }

    } catch (err) {
      console.error('Error in upload/process flow:', err);
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
    } finally {
      setLoading(false);
    }
  };

  // Add a function to decode hash values
  const [decodedValues, setDecodedValues] = useState<{ [key: string]: string }>({});

  const decodeHash = async (hash: string) => {
    try {
      if (decodedValues.hasOwnProperty(hash)) {
        return; // Already decoded this hash
      }

      const response = await fetch('/api/py/decrypt-data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          hash: hash,
          mapping: result.mapping
        }),
      });

      if (!response.ok) {
        console.error('Failed to decode hash');
        return;
      }

      const data = await response.json();

      if (data.success) {
        setDecodedValues(prev => ({
          ...prev,
          [hash]: data.original_value
        }));
      }
    } catch (err) {
      console.error('Error decoding hash:', err);
    }
  };

  return (
    <main className="container mx-auto py-8 px-4">
      <Card className="w-full max-w-xl mx-auto">
        <CardHeader>
          <CardTitle>Academic PDF Anonymizer</CardTitle>
          <CardDescription>
            Upload an academic paper in PDF format to redact author information and encrypt sensitive data.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid w-full items-center gap-2">
              <Input
                id="pdf-upload"
                type="file"
                accept=".pdf"
                onChange={handleFileChange}
                className="cursor-pointer"
              />

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

              {uploadError && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Upload Error</AlertTitle>
                  <AlertDescription>{uploadError}</AlertDescription>
                </Alert>
              )}

              {uploadSuccess && !processingError && !result && (
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertTitle>File Uploaded Successfully</AlertTitle>
                  <AlertDescription>Now processing the PDF...</AlertDescription>
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

                    {result.encryptedItems && result.encryptedItems.length > 0 && (
                      <div className="mt-3">
                        <h4 className="font-medium">Details of encrypted items:</h4>
                        <div className="bg-gray-50 p-2 mt-1 text-xs overflow-auto max-h-40 border rounded">
                          {result.encryptedItems.map((item: any, index: any) => (
                            <div key={index} className="mb-1">
                              {item.name && (
                                <p>Name: {item.name.original} → {item.name.sha256.substring(0, 10)}...</p>
                              )}
                              {item.email && (
                                <p>Email: {item.email.original} → {item.email.sha256.substring(0, 10)}...</p>
                              )}
                              {item.affiliation && (
                                <p>Affiliation: {item.affiliation.original} → {item.affiliation.sha256.substring(0, 10)}...</p>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </AlertDescription>
                </Alert>
              )}

              {result && result.mapping && result.mapping.encrypted_data && (
                <div className="mt-4">
                  <h4 className="font-medium">Encrypted Data:</h4>
                  <div className="bg-gray-50 p-3 rounded border mt-2 max-h-60 overflow-auto">
                    {result.mapping.encrypted_data.map((item : any, index : any) => {
                      const dataType = Object.keys(item)[0];
                      const data = item[dataType];
                      return (
                        <div key={index} className="mb-2 p-2 border-b">
                          <div className="flex justify-between">
                            <span className="font-semibold capitalize">{dataType}:</span>
                            <button
                              onClick={() => decodeHash(data.sha256)}
                              className="text-xs text-blue-600 hover:underline"
                            >
                              {decodedValues[data.sha256] ? 'Hide Original' : 'Show Original'}
                            </button>
                          </div>
                          <div className="mt-1">
                            <span className="text-xs">Encrypted: </span>
                            <code className="bg-gray-100 px-1 py-0.5 rounded text-xs">{data.sha256.substring(0, 10)}...</code>
                          </div>
                          {decodedValues[data.sha256] && (
                            <div className="mt-1">
                              <span className="text-xs">Original: </span>
                              <code className="bg-green-100 px-1 py-0.5 rounded text-xs">{decodedValues[data.sha256]}</code>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}


            </div>
          </div>
        </CardContent>
        <CardFooter>
          <Button
            onClick={handleUpload}
            disabled={!file || loading}
            className="w-full"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {uploadSuccess ? 'Processing...' : 'Uploading...'}
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
    </main>
  );
}