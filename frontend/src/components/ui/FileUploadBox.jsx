import { File, Upload, X } from "lucide-react";
import React from "react";
import { toast } from "sonner";
import { Label } from "./label";

export const FileUploadBox = ({
  label,
  accept,
  onChange,
  file,
  onRemove,
  required = false,
  description,
  maxSize = 10 * 1024 * 1024, // 10MB default
}) => {
  const fileInputRef = React.useRef(null);

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      // Validate file size
      if (selectedFile.size > maxSize) {
        toast.error(`File size must be less than ${formatFileSize(maxSize)}`);
        return;
      }

      // Validate file type
      if (accept) {
        const acceptedTypes = accept.split(",").map((t) => t.trim());
        const fileExtension =
          "." + selectedFile.name.split(".").pop().toLowerCase();
        const mimeType = selectedFile.type;

        const isValid = acceptedTypes.some((type) => {
          if (type.startsWith(".")) {
            return fileExtension === type;
          }
          return mimeType.match(new RegExp(type.replace("*", ".*")));
        });

        if (!isValid) {
          toast.error(`Invalid file type. Accepted: ${accept}`);
          return;
        }
      }

      onChange(selectedFile);
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();

    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile) {
      handleFileChange({ target: { files: [droppedFile] } });
    }
  };

  return (
    <div className="space-y-2">
      {label && (
        <Label>
          {label} {required && <span className="text-destructive">*</span>}
        </Label>
      )}
      {description && (
        <p className="text-xs text-muted-foreground">{description}</p>
      )}

      <div
        className="p-6 text-center transition-all duration-200 border-2 border-dashed rounded-lg cursor-pointer border-border hover:border-primary hover:bg-primary/5"
        onClick={handleClick}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={accept}
          onChange={handleFileChange}
          className="hidden"
          required={required && !file}
        />

        {file ? (
          <div className="space-y-3">
            <div className="flex items-center justify-center gap-3 p-3 rounded-lg bg-primary/10">
              <File className="flex-shrink-0 w-8 h-8 text-primary" />
              <div className="flex-1 text-left">
                <p className="text-sm font-medium text-foreground truncate max-w-[200px]">
                  {file.name}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatFileSize(file.size)}
                </p>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove();
                  if (fileInputRef.current) {
                    fileInputRef.current.value = "";
                  }
                }}
                className="p-1 transition-colors rounded-full hover:bg-destructive/10"
                aria-label="Remove file"
              >
                <X className="w-4 h-4 text-destructive" />
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              Click to change file or drag and drop a new one
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <Upload className="w-12 h-12 mx-auto text-muted-foreground" />
            <div>
              <p className="text-sm font-medium text-foreground">
                Click to upload or drag and drop
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {accept
                  ? `Accepted formats: ${accept}`
                  : "All file types accepted"}
              </p>
              <p className="text-xs text-muted-foreground">
                Maximum file size: {formatFileSize(maxSize)}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
