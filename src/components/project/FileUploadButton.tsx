import { useRef, useState } from 'react';
import { Upload, Loader2 } from 'lucide-react';
import { useProjectStore } from '../../store/useProjectStore';
import { useBackendStatus } from '../../hooks/useBackendStatus';

const ACCEPTED_TYPES_BACKEND = [
  'text/*',
  'application/json',
  'application/pdf',
  'application/xml',
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
].join(',');

const ACCEPTED_TYPES_LOCAL = [
  'text/*',
  'application/json',
  'application/xml',
].join(',');

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB per file
const BACKEND_PROJECT_SIZE_CAP = 50 * 1024 * 1024; // 50 MB with backend
const LOCAL_PROJECT_SIZE_CAP = 20 * 1024 * 1024;   // 20 MB browser-only

interface FileUploadButtonProps {
  projectId: string;
}

export function FileUploadButton({ projectId }: FileUploadButtonProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const uploadFile = useProjectStore((s) => s.uploadFile);
  const { isAvailable: backendAvailable } = useBackendStatus();

  const sizeCap = backendAvailable ? BACKEND_PROJECT_SIZE_CAP : LOCAL_PROJECT_SIZE_CAP;
  const acceptedTypes = backendAvailable ? ACCEPTED_TYPES_BACKEND : ACCEPTED_TYPES_LOCAL;

  const handleSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset input so the same file can be re-selected
    if (inputRef.current) inputRef.current.value = '';

    if (file.size > MAX_FILE_SIZE) {
      setError('File too large (10MB max)');
      setTimeout(() => setError(null), 3000);
      return;
    }

    // Check project total size cap
    const existingFiles = useProjectStore.getState().getProjectFiles(projectId);
    const currentTotal = existingFiles.reduce((sum, f) => sum + f.sizeBytes, 0);
    if (currentTotal + file.size > sizeCap) {
      const usedMB = (currentTotal / (1024 * 1024)).toFixed(1);
      const capMB = (sizeCap / (1024 * 1024)).toFixed(0);
      setError(`Project limit reached (${usedMB}/${capMB}MB used)`);
      setTimeout(() => setError(null), 4000);
      return;
    }

    setError(null);
    setUploading(true);
    try {
      await uploadFile(projectId, file);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
      setTimeout(() => setError(null), 3000);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="file"
        accept={acceptedTypes}
        onChange={handleSelect}
        className="hidden"
      />
      <button
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className="p-1 rounded text-[var(--color-text-muted)] hover:text-[var(--color-accent)] hover:bg-[var(--color-bg-hover)] transition-colors disabled:opacity-50"
        title={backendAvailable ? 'Upload file' : 'Upload text file (backend offline)'}
      >
        {uploading ? (
          <Loader2 size={14} className="animate-spin" />
        ) : (
          <Upload size={14} />
        )}
      </button>
      {error && (
        <div className="absolute top-full right-0 mt-1 px-2 py-1 rounded text-[10px] bg-red-500/10 text-red-500 whitespace-nowrap z-10">
          {error}
        </div>
      )}
    </div>
  );
}
