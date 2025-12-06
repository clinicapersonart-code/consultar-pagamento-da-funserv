import React, { useCallback } from 'react';
import { UploadCloud, FileType } from 'lucide-react';

interface FileUploadProps {
  onFilesSelected: (files: File[]) => void;
  isProcessing: boolean;
}

const FileUpload: React.FC<FileUploadProps> = ({ onFilesSelected, isProcessing }) => {
  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      if (isProcessing) return;
      
      const droppedFiles = Array.from(e.dataTransfer.files) as File[];
      // Allow PDF, Excel (xls, xlsx) and CSV
      const validFiles = droppedFiles.filter(f => 
        f.type === 'application/pdf' || 
        f.name.match(/\.(xls|xlsx|csv)$/i)
      );
      
      if (validFiles.length > 0) onFilesSelected(validFiles);
    },
    [onFilesSelected, isProcessing]
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (isProcessing) return;
      const files = e.target.files ? Array.from(e.target.files) : [];
      if (files.length > 0) onFilesSelected(files);
    },
    [onFilesSelected, isProcessing]
  );

  return (
    <div
      onDrop={handleDrop}
      onDragOver={(e) => e.preventDefault()}
      className={`border-2 border-dashed rounded-xl p-10 text-center transition-all duration-300 cursor-pointer 
        ${isProcessing 
          ? 'bg-gray-50 border-gray-300 cursor-wait opacity-50' 
          : 'bg-white border-medical-500 hover:bg-medical-50 hover:shadow-lg'
        }`}
    >
      <input
        type="file"
        multiple
        accept=".pdf, .xls, .xlsx, .csv"
        onChange={handleChange}
        className="hidden"
        id="fileInput"
        disabled={isProcessing}
      />
      <label htmlFor="fileInput" className="cursor-pointer flex flex-col items-center">
        <div className={`p-4 rounded-full mb-4 ${isProcessing ? 'bg-gray-200' : 'bg-medical-100 text-medical-600'}`}>
          {isProcessing ? (
             <UploadCloud size={40} className="animate-pulse text-gray-400" />
          ) : (
             <div className="flex gap-2">
               <FileType size={40} />
             </div>
          )}
        </div>
        <h3 className="text-xl font-semibold text-slate-700">
          {isProcessing ? 'Processando Arquivos...' : 'Upload de Demonstrativos'}
        </h3>
        <p className="text-slate-500 mt-2 max-w-md mx-auto text-sm">
          {isProcessing 
            ? 'Analisando dados...' 
            : 'Suporta PDF, Excel (.xls, .xlsx) e CSV. O sistema detecta pagamentos e glosas automaticamente.'}
        </p>
      </label>
    </div>
  );
};

export default FileUpload;