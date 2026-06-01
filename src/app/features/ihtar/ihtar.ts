import { Component, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpClientModule } from '@angular/common/http';

interface UploadFile {
  file: File;
  name: string;
  size: number;
  status: 'pending' | 'uploading' | 'success' | 'error';
  errorMessage?: string;
  progress: number;
}

@Component({
  selector: 'app-ihtar',
  standalone: true,
  imports: [CommonModule, HttpClientModule],
  templateUrl: './ihtar.html',
  styleUrl: './ihtar.css',
})
export class Ihtar {
  files: UploadFile[] = [];
  isDragging = false;
  isProcessing = false;

  apiUrl = 'http://10.162.64.32:8048/api/ihtar';

  constructor(private http: HttpClient, private cdr: ChangeDetectorRef) {}

  onDragOver(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging = true;
  }

  onDragLeave(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging = false;
  }

  onDrop(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging = false;
    
    if (event.dataTransfer && event.dataTransfer.files) {
      this.handleFileList(event.dataTransfer.files);
    }
  }

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files) {
      this.handleFileList(input.files);
    }
  }

  handleFileList(fileList: FileList) {
    for (let i = 0; i < fileList.length; i++) {
      const file = fileList.item(i);
      if (file && (file.name.endsWith('.docx') || file.name.endsWith('.doc'))) {
        if (!this.files.some(f => f.name === file.name)) {
          this.files.push({
            file: file,
            name: file.name,
            size: file.size,
            status: 'pending',
            progress: 0
          });
        }
      }
    }
    this.cdr.detectChanges();
  }

  removeFile(index: number) {
    if (this.files[index].status === 'uploading') return;
    this.files.splice(index, 1);
  }

  clearFiles() {
    this.files = [];
  }

  processFiles() {
    const pendingFiles = this.files.filter(f => f.status === 'pending' || f.status === 'error');
    if (pendingFiles.length === 0) return;

    this.isProcessing = true;
    
    if (pendingFiles.length === 1) {
      this.processFileSequentially(pendingFiles, 0);
    } else {
      this.processFilesBatch(pendingFiles);
    }
  }

  processFilesBatch(queue: UploadFile[]) {
    queue.forEach(item => {
      item.status = 'uploading';
      item.progress = 50;
    });
    this.cdr.detectChanges();

    const formData = new FormData();
    queue.forEach(item => {
      formData.append('file', item.file, item.name);
    });

    this.http.post(this.apiUrl, formData, {
      observe: 'response',
      responseType: 'blob'
    }).subscribe({
      next: (response) => {
        queue.forEach(item => {
          item.status = 'success';
          item.progress = 100;
        });

        const blob = response.body as Blob;
        const serverFilename = response.headers.get('X-Filename') || 'ihtarnameler.zip';

        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = serverFilename;

        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);

        this.isProcessing = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        queue.forEach(item => {
          item.status = 'error';
          item.progress = 0;
          item.errorMessage = 'Dönüştürme başarısız. API Sunucusu açık mı?';
        });
        this.isProcessing = false;
        this.cdr.detectChanges();
      }
    });
  }

  processFileSequentially(queue: UploadFile[], index: number) {
    if (index >= queue.length) {
      this.isProcessing = false;
      this.cdr.detectChanges();
      return;
    }

    const item = queue[index];
    item.status = 'uploading';
    item.progress = 50;
    this.cdr.detectChanges();

    const formData = new FormData();
    formData.append('file', item.file, item.name);

    this.http.post(this.apiUrl, formData, {
      observe: 'response',
      responseType: 'blob'
    }).subscribe({
      next: (response) => {
        item.status = 'success';
        item.progress = 100;
        
        const blob = response.body as Blob;
        const serverFilename = response.headers.get('X-Filename');
        
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        
        if (serverFilename) {
          a.download = serverFilename;
        } else {
          const baseName = item.name.substring(0, item.name.lastIndexOf('.')) || item.name;
          a.download = `${baseName}.pdf`;
        }
        
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);

        this.cdr.detectChanges();
        this.processFileSequentially(queue, index + 1);
      },
      error: (err) => {
        item.status = 'error';
        item.progress = 0;
        item.errorMessage = 'Dönüştürme başarısız. API Sunucusu açık mı?';
        this.cdr.detectChanges();
        this.processFileSequentially(queue, index + 1);
      }
    });
  }

  formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}
