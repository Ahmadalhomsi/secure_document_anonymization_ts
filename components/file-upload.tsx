// components/file-upload.tsx
'use client';
import { FilePond, registerPlugin } from 'react-filepond';
import 'filepond/dist/filepond.min.css';
import FilePondPluginFileValidateType from 'filepond-plugin-file-validate-type';

// Register plugins
registerPlugin(FilePondPluginFileValidateType);

export default function FileUpload({ onupdatefiles } : any) {
  return (
    <FilePond
      allowMultiple={false}
      maxFiles={1}
      acceptedFileTypes={['application/pdf']}
      labelIdle='Drag & Drop your PDF or <span class="filepond--label-action">Browse</span>'
      onupdatefiles={onupdatefiles}
    />
  );
}