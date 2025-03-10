// components/file-upload.tsx
'use client';
import { useEffect, useRef } from 'react';
import { FilePond, registerPlugin } from 'react-filepond';
import 'filepond/dist/filepond.min.css';
import FilePondPluginFileValidateType from 'filepond-plugin-file-validate-type';

// Register plugins
registerPlugin(FilePondPluginFileValidateType);

interface FileUploadProps {
  isSubmitting: boolean;
  onFileChange: (file: any) => void;
}

export default function FileUpload({ isSubmitting, onFileChange }: FileUploadProps) {
  const pondRef = useRef<FilePond>(null);

  // When isSubmitting changes to true, process the file
  useEffect(() => {
    if (isSubmitting && pondRef.current) {
      // This will trigger the upload process
      const pond = pondRef.current;
      const files = pond.getFiles();
      
      if (files.length > 0) {
        // We're manually handling the upload in the parent component
        onFileChange(files[0].file);
      }
    }
  }, [isSubmitting, onFileChange]);

  return (
    <FilePond
      ref={pondRef}
      allowMultiple={false}
      maxFiles={1}
      acceptedFileTypes={['application/pdf']}
      labelIdle='Drag & Drop your PDF or <span class="filepond--label-action">Browse</span>'
      onupdatefiles={(files) => {
        if (files.length > 0) {
          onFileChange(files[0].file);
        } else {
          onFileChange(null);
        }
      }}
      // Disabled server configuration since we're handling the upload in the parent
    />
  );
}