'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Plus,
  X,
  Save,
  FileText,
  Download,
  Copy,
  Trash2,
  Bold,
  Italic,
  Underline,
  Strikethrough,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  List,
  ListOrdered,
  Link as LinkIcon,
  Sparkles,
  AlertTriangle,
  FileCode,
  Check,
  FolderOpen,
  Maximize2,
  Minimize2,
  RemoveFormatting
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const springTransition = { type: 'spring', stiffness: 200, damping: 22 } as const;

interface OpenedFile {
  id: string;
  name: string;
  content: string;
  handle: any | null; // FileSystemFileHandle
  isModified: boolean;
}

// ── Pure JS CRC-32 Utility ──
const makeCRCTable = () => {
  let c;
  const crcTable = [];
  for (let n = 0; n < 256; n++) {
    c = n;
    for (let k = 0; k < 8; k++) {
      c = ((c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1));
    }
    crcTable[n] = c;
  }
  return crcTable;
};

const crcTable = makeCRCTable();

const crc32 = (dataBytes: Uint8Array): number => {
  let crc = 0 ^ (-1);
  for (let i = 0; i < dataBytes.length; i++) {
    crc = (crc >>> 8) ^ crcTable[(crc ^ dataBytes[i]) & 0xFF];
  }
  return (crc ^ (-1)) >>> 0;
};

// ── Pure JS ZIP Archive Compiler (Store mode - no compression) ──
function generateZip(filesMap: Record<string, string | Uint8Array>): Uint8Array {
  const encoder = new TextEncoder();
  const fileEntries: Array<{ pathBytes: Uint8Array; size: number; crc: number; offset: number }> = [];
  let currentOffset = 0;

  const localHeadersAndData: Uint8Array[] = [];
  for (const [path, data] of Object.entries(filesMap)) {
    const pathBytes = encoder.encode(path);
    const dataBytes = typeof data === 'string' ? encoder.encode(data) : data;
    const crc = crc32(dataBytes);
    const size = dataBytes.length;

    const lh = new Uint8Array(30 + pathBytes.length);
    const view = new DataView(lh.buffer);
    
    view.setUint32(0, 0x04034b50, true); // Signature
    view.setUint16(4, 10, true);         // Version needed
    view.setUint16(6, 0, true);          // Bit flag
    view.setUint16(8, 0, true);          // Compression method (0 = Store)
    view.setUint16(10, 0, true);         // Mod time
    view.setUint16(12, 0, true);         // Mod date
    view.setUint32(14, crc, true);        // CRC-32
    view.setUint32(18, size, true);       // Compressed size
    view.setUint32(22, size, true);       // Uncompressed size
    view.setUint16(26, pathBytes.length, true); // Name length
    view.setUint16(28, 0, true);         // Extra field length
    
    lh.set(pathBytes, 30);

    fileEntries.push({
      pathBytes,
      size,
      crc,
      offset: currentOffset
    });

    localHeadersAndData.push(lh);
    localHeadersAndData.push(dataBytes);

    currentOffset += lh.length + dataBytes.length;
  }

  const centralDirEntries: Uint8Array[] = [];
  let centralDirSize = 0;
  for (let i = 0; i < fileEntries.length; i++) {
    const entry = fileEntries[i];
    const pathBytes = entry.pathBytes;
    
    const cd = new Uint8Array(46 + pathBytes.length);
    const view = new DataView(cd.buffer);

    view.setUint32(0, 0x02014b50, true); // Signature
    view.setUint16(4, 20, true);         // Made by
    view.setUint16(6, 10, true);         // Needed
    view.setUint16(8, 0, true);          // Bit flag
    view.setUint16(10, 0, true);         // Compression method
    view.setUint16(12, 0, true);         // Mod time
    view.setUint16(14, 0, true);         // Mod date
    view.setUint32(16, entry.crc, true); // CRC-32
    view.setUint32(20, entry.size, true); // Compressed size
    view.setUint32(24, entry.size, true); // Uncompressed size
    view.setUint16(28, pathBytes.length, true); // Name length
    view.setUint16(30, 0, true);         // Extra field length
    view.setUint16(32, 0, true);         // Comment length
    view.setUint16(34, 0, true);         // Disk start
    view.setUint16(36, 0, true);         // Internal attr
    view.setUint32(38, 0, true);         // External attr
    view.setUint32(42, entry.offset, true); // Header offset
    
    cd.set(pathBytes, 46);
    centralDirEntries.push(cd);
    centralDirSize += cd.length;
  }

  const eocd = new Uint8Array(22);
  const eocdView = new DataView(eocd.buffer);
  eocdView.setUint32(0, 0x06054b50, true); // Signature
  eocdView.setUint16(4, 0, true);          // Disk number
  eocdView.setUint16(6, 0, true);          // Central dir disk
  eocdView.setUint16(8, fileEntries.length, true); // Disk records
  eocdView.setUint16(10, fileEntries.length, true); // Total records
  eocdView.setUint32(12, centralDirSize, true);     // Central dir size
  eocdView.setUint32(16, currentOffset, true);      // Central dir offset
  eocdView.setUint16(20, 0, true);         // Comment length

  const totalLength = currentOffset + centralDirSize + eocd.length;
  const result = new Uint8Array(totalLength);
  let pos = 0;
  for (const part of localHeadersAndData) {
    result.set(part, pos);
    pos += part.length;
  }
  for (const part of centralDirEntries) {
    result.set(part, pos);
    pos += part.length;
  }
  result.set(eocd, pos);

  return result;
}

// ── Pure JS ZIP Archive Reader ──
function readZipFile(arrayBuffer: ArrayBuffer, targetPath: string): string | null {
  const bytes = new Uint8Array(arrayBuffer);
  let pos = 0;
  const targetBytes = new TextEncoder().encode(targetPath);
  
  while (pos < bytes.length - 30) {
    // Check local header signature PK\3\4 (0x04034b50)
    if (bytes[pos] === 0x50 && bytes[pos+1] === 0x4B && bytes[pos+2] === 0x03 && bytes[pos+3] === 0x04) {
      const view = new DataView(bytes.buffer, bytes.byteOffset + pos);
      const nameLen = view.getUint16(26, true);
      const extraLen = view.getUint16(28, true);
      const compSize = view.getUint32(18, true);
      
      const fileNameBytes = bytes.subarray(pos + 30, pos + 30 + nameLen);
      let match = true;
      if (nameLen === targetBytes.length) {
        for (let i = 0; i < nameLen; i++) {
          if (fileNameBytes[i] !== targetBytes[i]) {
            match = false;
            break;
          }
        }
      } else {
        match = false;
      }
      
      const dataOffset = pos + 30 + nameLen + extraLen;
      if (match) {
        const dataBytes = bytes.subarray(dataOffset, dataOffset + compSize);
        return new TextDecoder().decode(dataBytes);
      }
      
      pos = dataOffset + compSize;
    } else {
      pos++;
    }
  }
  return null;
}

// ── Extract standard Word XML paragraphs ──
const extractWordHtml = (xmlString: string): string => {
  const pMatches = xmlString.match(/<w:p[^>]*>([\s\S]*?)<\/w:p>/g);
  if (pMatches) {
    return pMatches.map(p => {
      const tMatches = p.match(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g);
      if (tMatches) {
        const text = tMatches.map(t => {
          const m = t.match(/<w:t[^>]*>([\s\S]*?)<\/w:t>/);
          return m ? m[1] : '';
        }).join('');
        return `<div>${text || '<br>'}</div>`;
      }
      return '<div><br></div>';
    }).join('');
  }
  return '';
};

export default function OperationalNotesPage() {
  const [files, setFiles] = useState<OpenedFile[]>([
    { id: '1', name: '', content: '<div><h2>OPERATIONAL MEMORANDUM</h2><p>Use the formatting toolbar above to compose detailed memos, reports, or logs. Save files as <strong>.html</strong> or <strong>.docx</strong> formats to open directly in Microsoft Word with formatting preserved.</p></div>', handle: null, isModified: false }
  ]);
  const [activeFileId, setActiveFileId] = useState<string>('1');
  const [isApiSupported, setIsApiSupported] = useState<boolean>(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);
  
  // Custom styling controls
  const [textColor, setTextColor] = useState<string>('#333333');
  const [fontFamily, setFontFamily] = useState<string>('Arial');
  const [fontSize, setFontSize] = useState<string>('3'); // Browser sizes 1-7
  const [wordCount, setWordCount] = useState<number>(0);
  const [charCount, setCharCount] = useState<number>(0);

  const fallbackInputRef = useRef<HTMLInputElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);

  // Check Browser File System Access API Support
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const supported = 'showOpenFilePicker' in window && 'showSaveFilePicker' in window;
      setIsApiSupported(supported);
    }
  }, []);

  const activeFile = files.find(f => f.id === activeFileId) || files[0];

  // Helper to trigger notifications
  const showToast = (type: 'success' | 'error' | 'info', message: string) => {
    setNotification({ type, message });
    setTimeout(() => {
      setNotification(null);
    }, 4000);
  };

  // Sync canvas with active file content
  useEffect(() => {
    if (editorRef.current && activeFile) {
      if (editorRef.current.innerHTML !== activeFile.content) {
        editorRef.current.innerHTML = activeFile.content || '<div><br></div>';
      }
      updateCounts();
    }
  }, [activeFileId]);

  // Handle Input Changes on contentEditable
  const handleEditorInput = () => {
    if (editorRef.current) {
      const html = editorRef.current.innerHTML;
      setFiles(prev => prev.map(f => f.id === activeFileId ? { ...f, content: html, isModified: true } : f));
      updateCounts();
    }
  };

  // Calculate stats
  const updateCounts = () => {
    if (!editorRef.current) return;
    const text = editorRef.current.innerText || '';
    const chars = text.length;
    const words = text.trim() === '' ? 0 : text.trim().split(/\s+/).length;
    setCharCount(chars);
    setWordCount(words);
  };

  // Helper to extract body content from HTML
  const parseImportedHtml = (text: string): string => {
    if (text.includes('<body') || text.includes('<BODY')) {
      const match = text.match(/<body[^>]*>([\s\S]*)<\/body>/i);
      if (match && match[1]) {
        return match[1].trim();
      }
    }
    if (!text.includes('<p>') && !text.includes('<div>') && !text.includes('<br>')) {
      return text.split('\n').map(line => `<div>${line || '<br>'}</div>`).join('');
    }
    return text;
  };

  // Wrap rich content into full HTML structure
  const wrapHtmlDocument = (bodyContent: string, titleName: string): string => {
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${titleName || 'Document'}</title>
  <style>
    body {
      font-family: '${fontFamily}', 'Arial', sans-serif;
      line-height: 1.6;
      color: #333333;
      padding: 40px;
      max-width: 800px;
      margin: 0 auto;
      background-color: #ffffff;
    }
    h1 { font-size: 24pt; color: #111111; margin-bottom: 12pt; font-weight: bold; }
    h2 { font-size: 18pt; color: #222222; margin-top: 18pt; margin-bottom: 8pt; font-weight: bold; }
    h3 { font-size: 14pt; color: #333333; margin-top: 14pt; margin-bottom: 6pt; font-weight: bold; }
    p { margin-bottom: 10pt; font-size: 11pt; }
    ul, ol { margin-left: 20pt; margin-bottom: 10pt; }
    strong { font-weight: bold; }
    em { font-style: italic; }
    u { text-decoration: underline; }
  </style>
</head>
<body>
  ${bodyContent}
</body>
</html>`;
  };

  // ── Format Command Ribbon Actions ──
  const runCommand = (command: string, value: string = '') => {
    if (typeof document !== 'undefined') {
      document.execCommand(command, false, value);
      handleEditorInput();
      editorRef.current?.focus();
    }
  };

  const handleColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const color = e.target.value;
    setTextColor(color);
    runCommand('foreColor', color);
  };

  const handleFontChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const font = e.target.value;
    setFontFamily(font);
    runCommand('fontName', font);
  };

  const handleFontSizeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const size = e.target.value;
    setFontSize(size);
    runCommand('fontSize', size);
  };

  const handleInsertLink = () => {
    const url = prompt('ENTER URL LINK:');
    if (url) {
      runCommand('createLink', url);
    }
  };

  // Generate binary docx payload
  const buildDocxPayload = (content: string, name: string): Uint8Array => {
    const htmlDoc = wrapHtmlDocument(content, name);
    const filesMap = {
      '[Content_Types].xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Default Extension="html" ContentType="text/html"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`,
      '_rels/.rels': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`,
      'word/_rels/document.xml.rels': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/aFChunk" Target="afchunk.html"/>
</Relationships>`,
      'word/document.xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <w:body>
    <w:altChunk r:id="rId1"/>
    <w:sectPr>
      <w:pgSz w:w="12240" w:h="15840"/>
      <w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/>
    </w:sectPr>
  </w:body>
</w:document>`,
      'word/afchunk.html': htmlDoc
    };

    return generateZip(filesMap);
  };

  // ── File Manager Operations ──

  // Create new blank tab
  const handleNewFile = () => {
    const newId = Date.now().toString();
    const newFile: OpenedFile = {
      id: newId,
      name: '',
      content: '<div><br></div>',
      handle: null,
      isModified: false
    };
    setFiles(prev => [...prev, newFile]);
    setActiveFileId(newId);
    showToast('info', 'CREATED NEW OPERATIONAL MEMO');
  };

  // Parse docx buffer
  const loadDocxBuffer = (arrayBuffer: ArrayBuffer): string => {
    // 1. Look for altchunk first
    const altChunkHtml = readZipFile(arrayBuffer, 'word/afchunk.html');
    if (altChunkHtml) {
      return parseImportedHtml(altChunkHtml);
    }
    // 2. Fallback to parsing document.xml paragraphs
    const mainXml = readZipFile(arrayBuffer, 'word/document.xml');
    if (mainXml) {
      return extractWordHtml(mainXml);
    }
    throw new Error('Could not find readable document payload in docx.');
  };

  // Open local file
  const handleOpenFile = async () => {
    if (isApiSupported) {
      try {
        const [handle] = await (window as any).showOpenFilePicker({
          types: [{
            description: 'Document Buffers (*.docx, *.html, *.doc, *.txt)',
            accept: {
              'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
              'text/html': ['.html', '.htm', '.doc'],
              'text/plain': ['.txt', '.md', '.log']
            }
          }]
        });

        // Avoid opening the same file twice
        const alreadyOpened = files.find(f => f.handle && f.handle.name === handle.name);
        if (alreadyOpened) {
          setActiveFileId(alreadyOpened.id);
          showToast('info', `SWITCHED TO BUFFER: ${handle.name}`);
          return;
        }

        const file = await handle.getFile();
        let parsedContent = '';

        if (file.name.endsWith('.docx')) {
          const buffer = await file.arrayBuffer();
          parsedContent = loadDocxBuffer(buffer);
        } else {
          const rawContent = await file.text();
          parsedContent = parseImportedHtml(rawContent);
        }

        const newId = Date.now().toString();
        const newFile: OpenedFile = {
          id: newId,
          name: file.name,
          content: parsedContent,
          handle,
          isModified: false
        };

        setFiles(prev => {
          if (prev.length === 1 && prev[0].name === '' && prev[0].content.includes('OPERATIONAL MEMORANDUM') && !prev[0].handle) {
            return [newFile];
          }
          return [...prev, newFile];
        });
        setActiveFileId(newId);
        showToast('success', `MOUNTED DIRECT UPLINK TO: ${file.name}`);
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          showToast('error', `FILESYSTEM UPLINK REJECTED: ${err.message}`);
        }
      }
    } else {
      fallbackInputRef.current?.click();
    }
  };

  // Fallback upload change handler
  const handleFallbackUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        let parsedContent = '';
        if (file.name.endsWith('.docx')) {
          const buffer = event.target?.result as ArrayBuffer;
          parsedContent = loadDocxBuffer(buffer);
        } else {
          const rawContent = event.target?.result as string;
          parsedContent = parseImportedHtml(rawContent);
        }

        const newId = Date.now().toString();
        const newFile: OpenedFile = {
          id: newId,
          name: file.name,
          content: parsedContent,
          handle: null,
          isModified: false
        };

        setFiles(prev => {
          if (prev.length === 1 && prev[0].name === '' && prev[0].content.includes('OPERATIONAL MEMORANDUM') && !prev[0].handle) {
            return [newFile];
          }
          return [...prev, newFile];
        });
        setActiveFileId(newId);
        showToast('success', `IMPORTED LOG BUFFER: ${file.name}`);
      } catch (err: any) {
        showToast('error', `DECODING ERROR: ${err.message}`);
      }
    };
    reader.onerror = () => {
      showToast('error', 'FAILED TO READ IMPORTED BUFFER FILE.');
    };

    if (file.name.endsWith('.docx')) {
      reader.readAsArrayBuffer(file);
    } else {
      reader.readAsText(file);
    }
    e.target.value = '';
  };

  // Save current active file
  const handleSaveFile = async () => {
    if (!activeFile) return;

    const isDocx = activeFile.name.endsWith('.docx');
    const payload = isDocx 
      ? buildDocxPayload(activeFile.content, activeFile.name)
      : wrapHtmlDocument(activeFile.content, activeFile.name);

    if (isApiSupported && activeFile.handle) {
      try {
        const writable = await activeFile.handle.createWritable();
        await writable.write(payload);
        await writable.close();

        setFiles(prev => prev.map(f => f.id === activeFile.id ? { ...f, isModified: false } : f));
        showToast('success', `CHANGES COMMITTED: ${activeFile.name}`);
      } catch (err: any) {
        showToast('error', `FAILED TO COMMIT CHANGES: ${err.message}`);
      }
    } else {
      handleSaveAsFile();
    }
  };

  // Save active file As (Force Save Picker / Anchor Fallback)
  const handleSaveAsFile = async () => {
    if (!activeFile) return;

    const isDocx = activeFile.name.endsWith('.docx');
    const suggestedName = activeFile.name || (isDocx ? 'untitled.docx' : 'untitled.html');

    if (isApiSupported) {
      try {
        const handle = await (window as any).showSaveFilePicker({
          suggestedName,
          types: [{
            description: 'Word Processing Documents (*.docx, *.html, *.doc)',
            accept: {
              'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
              'text/html': ['.html', '.htm', '.doc']
            }
          }]
        });

        const isNewDocx = handle.name.endsWith('.docx');
        const payload = isNewDocx
          ? buildDocxPayload(activeFile.content, handle.name)
          : wrapHtmlDocument(activeFile.content, handle.name);

        const writable = await handle.createWritable();
        await writable.write(payload);
        await writable.close();

        setFiles(prev => prev.map(f => f.id === activeFile.id ? { ...f, name: handle.name, handle, isModified: false } : f));
        showToast('success', `BUFFER SAVED AS: ${handle.name}`);
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          showToast('error', `FAILED TO SAVE FILE: ${err.message}`);
        }
      }
    } else {
      try {
        const payload = isDocx 
          ? buildDocxPayload(activeFile.content, suggestedName)
          : wrapHtmlDocument(activeFile.content, suggestedName);

        const blob = isDocx
          ? new Blob([payload as any], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' })
          : new Blob([payload as any], { type: 'text/html;charset=utf-8' });

        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = suggestedName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        setFiles(prev => prev.map(f => f.id === activeFile.id ? { ...f, name: suggestedName, isModified: false } : f));
        showToast('success', `DOWNLOADED COMPATIBLE FILE: ${suggestedName}`);
      } catch (err: any) {
        showToast('error', `DOWNLOAD TRIPPED FAULT: ${err.message}`);
      }
    }
  };

  // Close a specific tab
  const handleCloseTab = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();

    const fileToClose = files.find(f => f.id === id);
    if (!fileToClose) return;

    if (fileToClose.isModified) {
      const confirmClose = confirm(`DISCARD UNCOMMITTED CHANGES IN "${fileToClose.name || 'untitled'}"?`);
      if (!confirmClose) return;
    }

    const remaining = files.filter(f => f.id !== id);
    if (remaining.length === 0) {
      const newId = Date.now().toString();
      setFiles([{ id: newId, name: '', content: '<div><br></div>', handle: null, isModified: false }]);
      setActiveFileId(newId);
    } else {
      setFiles(remaining);
      if (activeFileId === id) {
        setActiveFileId(remaining[remaining.length - 1].id);
      }
    }
    showToast('info', `RELEASED BUFFER: ${fileToClose.name || 'untitled'}`);
  };

  return (
    <div className="flex flex-col gap-5 font-mono h-[calc(100vh-140px)] relative select-none">
      
      {/* Hidden File Input for Fallback imports */}
      <input
        type="file"
        ref={fallbackInputRef}
        onChange={handleFallbackUpload}
        className="hidden"
        accept=".docx,.html,.htm,.doc,.txt,.md,.log"
      />

      {/* Toast Alert */}
      <AnimatePresence>
        {notification && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className="fixed top-[80px] right-8 z-[100] px-4 py-3 border rounded shadow-2xl flex items-center gap-2.5 text-xs select-none"
            style={{
              backgroundColor: notification.type === 'error' ? 'rgba(239, 68, 68, 0.15)' : notification.type === 'success' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(6, 182, 212, 0.15)',
              borderColor: notification.type === 'error' ? 'var(--danger)' : notification.type === 'success' ? 'var(--success)' : 'var(--brand)',
              color: notification.type === 'error' ? 'var(--danger)' : notification.type === 'success' ? 'var(--success)' : 'var(--brand)',
              boxShadow: '0 0 20px rgba(0, 0, 0, 0.4)'
            }}
          >
            {notification.type === 'error' ? <AlertTriangle className="w-4 h-4 shrink-0" /> : <Check className="w-4 h-4 shrink-0" />}
            <span>// {notification.message}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Page Title & Disk Operations */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={springTransition}
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0 select-none"
      >
        <div>
          <h1 className="text-xl font-extrabold tracking-widest text-[#ef4444] flex items-center gap-2">
            <FileText className="w-5.5 h-5.5 animate-pulse text-[#ef4444]" />
            // OPERATIONAL_NOTES_EDITOR (WORD_MODE)
          </h1>
          <p className="mt-1 text-[10px] text-slate-500 tracking-wider uppercase">
            SECURE WYSIWYG DOCUMENT PROCESSOR. LOCALSTORAGE EXPORTS OPEN DIRECTLY IN MS WORD.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={handleOpenFile}
            className="btn btn-secondary px-3.5 h-9 text-[10px] cursor-pointer flex items-center gap-1.5"
            title="Import HTML or Word document from disk"
          >
            <FolderOpen className="w-3.5 h-3.5" />
            OPEN DOCUMENT
          </button>
          
          <button
            onClick={handleSaveFile}
            className="btn btn-primary px-3.5 h-9 text-[10px] cursor-pointer flex items-center gap-1.5 border-0"
            title="Commit changes directly to disk"
          >
            <Save className="w-3.5 h-3.5" />
            SAVE DOCUMENT
          </button>
          
          <button
            onClick={handleSaveAsFile}
            className="btn btn-secondary px-3.5 h-9 text-[10px] cursor-pointer flex items-center gap-1.5"
            title="Save as HTML/Word document on disk"
          >
            <Download className="w-3.5 h-3.5" />
            SAVE AS
          </button>
        </div>
      </motion.div>

      {/* Main layout workspace */}
      <div className="flex-1 flex flex-col md:flex-row gap-4 min-h-0 overflow-hidden">
        
        {/* SIDE BAR: Tab buffers manager */}
        <motion.div
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          className="w-full md:w-[220px] shrink-0 card flex flex-col overflow-hidden p-0"
          style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-card)' }}
        >
          <div className="px-4 pt-3.5 pb-2.5 border-b select-none flex items-center justify-between" style={{ borderColor: 'var(--border)' }}>
            <span className="text-[9px] font-extrabold text-slate-500 uppercase tracking-widest">// ACTIVE_MEMOS</span>
            <button
              onClick={handleNewFile}
              className="p-1 rounded bg-white/5 border border-white/10 text-cyan-400 hover:bg-white/10 hover:text-white cursor-pointer transition-colors"
              title="Create new blank document tab"
            >
              <Plus className="w-3 h-3" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-1.5 scrollbar-thin">
            {files.map((file) => {
              const isActive = file.id === activeFileId;
              return (
                <div
                  key={file.id}
                  onClick={() => setActiveFileId(file.id)}
                  className={`group w-full text-left px-3 py-2.5 rounded font-mono text-[11px] cursor-pointer flex items-center justify-between border transition-all ${
                    isActive
                      ? 'bg-cyan-500/10 border-cyan-500/30 text-white font-bold'
                      : 'bg-transparent border-transparent text-slate-400 hover:bg-white/5 hover:text-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    <FileText className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-[#ef4444]' : 'text-slate-500'}`} />
                    <span className={`truncate ${!file.name ? 'italic text-slate-500' : ''}`}>
                      {file.name || 'untitled'}
                    </span>
                    {file.isModified && (
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" title="Buffer has unsaved edits" />
                    )}
                  </div>
                  
                  <button
                    onClick={(e) => handleCloseTab(file.id, e)}
                    className="p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-rose-500/10 hover:text-rose-400 cursor-pointer transition-all"
                    title="Close tab buffer"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              );
            })}
          </div>

          <div className="p-3.5 bg-zinc-950/20 border-t text-[9px] text-slate-500 space-y-1" style={{ borderColor: 'var(--border)' }}>
            <div className="flex justify-between">
              <span>MODE:</span>
              <span className="text-emerald-400 font-bold uppercase">WYSIWYG RICH TEXT</span>
            </div>
            <div className="flex justify-between">
              <span>ACTIVE_MEMOS:</span>
              <span className="text-white font-bold">{files.length}</span>
            </div>
          </div>
        </motion.div>

        {/* WORKSPACE AREA */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex-1 card flex flex-col overflow-hidden p-0 relative"
          style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-card)' }}
        >
          {/* Top Info metadata bar */}
          <div className="px-4 py-3 bg-zinc-950/40 border-b flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shrink-0" style={{ borderColor: 'var(--border)' }}>
            <div className="flex items-center gap-2.5 min-w-0">
              <input
                type="text"
                value={activeFile.name}
                onChange={(e) => {
                  const newName = e.target.value;
                  setFiles(prev => prev.map(f => f.id === activeFile.id ? { ...f, name: newName, isModified: true } : f));
                }}
                placeholder="untitled (e.g. memo.docx)"
                className="bg-transparent text-xs font-bold text-white tracking-widest outline-none border-b border-transparent focus:border-cyan-400 py-0.5 px-1.5 w-64 font-mono uppercase"
                title="Edit document name & format extension"
              />
              {activeFile.handle && (
                <span className="px-2 py-0.5 text-[8px] font-extrabold bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 rounded tracking-wide">DISK_LINKED</span>
              )}
              {activeFile.isModified && (
                <span className="px-2 py-0.5 text-[8px] font-extrabold bg-amber-500/10 text-amber-400 border border-amber-500/25 rounded tracking-wide">MODIFIED</span>
              )}
            </div>

            {/* Quick Word & Char Telemetry */}
            <div className="flex items-center gap-3 text-[10px] text-slate-400">
              <span>Words: <strong className="text-white">{wordCount}</strong></span>
              <span>Chars: <strong className="text-white">{charCount}</strong></span>
            </div>
          </div>

          {/* Microsoft Word Format Ribbon Toolbar */}
          <div className="px-4 py-2 border-b bg-zinc-950/20 flex flex-wrap items-center gap-1.5 select-none" style={{ borderColor: 'var(--border)' }}>
            
            {/* Font Family selector */}
            <select
              value={fontFamily}
              onChange={handleFontChange}
              className="bg-zinc-900 border border-white/10 text-slate-300 text-[10px] rounded px-2 py-1 outline-none font-sans font-bold cursor-pointer"
              title="Font Family"
            >
              <option value="Arial">Arial</option>
              <option value="Times New Roman">Times New Roman</option>
              <option value="Courier New">Courier New</option>
              <option value="Georgia">Georgia</option>
              <option value="Verdana">Verdana</option>
              <option value="Trebuchet MS">Trebuchet MS</option>
            </select>

            {/* Font Size Selector */}
            <select
              value={fontSize}
              onChange={handleFontSizeChange}
              className="bg-zinc-900 border border-white/10 text-slate-300 text-[10px] rounded px-2 py-1 outline-none font-bold cursor-pointer"
              title="Font Size"
            >
              <option value="1">8pt</option>
              <option value="2">10pt</option>
              <option value="3">12pt</option>
              <option value="4">14pt</option>
              <option value="5">18pt</option>
              <option value="6">24pt</option>
              <option value="7">36pt</option>
            </select>

            <div className="w-[1px] h-4 bg-white/10 mx-1" />

            {/* Text styling buttons */}
            <button
              onClick={() => runCommand('bold')}
              className="p-1.5 rounded bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white cursor-pointer"
              title="Bold"
            >
              <Bold className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={() => runCommand('italic')}
              className="p-1.5 rounded bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white cursor-pointer"
              title="Italic"
            >
              <Italic className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={() => runCommand('underline')}
              className="p-1.5 rounded bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white cursor-pointer"
              title="Underline"
            >
              <Underline className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={() => runCommand('strikeThrough')}
              className="p-1.5 rounded bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white cursor-pointer"
              title="Strikethrough"
            >
              <Strikethrough className="w-3.5 h-3.5" />
            </button>

            <div className="w-[1px] h-4 bg-white/10 mx-1" />

            {/* Font Color Picker */}
            <div className="flex items-center gap-1.5 bg-white/5 px-2 py-0.5 rounded border border-white/10" title="Text Color">
              <span className="text-[9px] font-bold text-slate-400">COLOR:</span>
              <input
                type="color"
                value={textColor}
                onChange={handleColorChange}
                className="w-4 h-4 bg-transparent outline-none border-0 cursor-pointer p-0"
              />
            </div>

            <div className="w-[1px] h-4 bg-white/10 mx-1" />

            {/* Header/Block formats selector */}
            <select
              onChange={(e) => runCommand('formatBlock', e.target.value)}
              defaultValue="div"
              className="bg-zinc-900 border border-white/10 text-slate-300 text-[10px] rounded px-2 py-1 outline-none font-bold cursor-pointer"
              title="Paragraph Style"
            >
              <option value="div">Normal Text</option>
              <option value="h1">Heading 1</option>
              <option value="h2">Heading 2</option>
              <option value="h3">Heading 3</option>
            </select>

            <div className="w-[1px] h-4 bg-white/10 mx-1" />

            {/* Text Alignment buttons */}
            <button
              onClick={() => runCommand('justifyLeft')}
              className="p-1.5 rounded bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white cursor-pointer"
              title="Align Left"
            >
              <AlignLeft className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={() => runCommand('justifyCenter')}
              className="p-1.5 rounded bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white cursor-pointer"
              title="Align Center"
            >
              <AlignCenter className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={() => runCommand('justifyRight')}
              className="p-1.5 rounded bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white cursor-pointer"
              title="Align Right"
            >
              <AlignRight className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={() => runCommand('justifyFull')}
              className="p-1.5 rounded bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white cursor-pointer"
              title="Justify"
            >
              <AlignJustify className="w-3.5 h-3.5" />
            </button>

            <div className="w-[1px] h-4 bg-white/10 mx-1" />

            {/* List formatting buttons */}
            <button
              onClick={() => runCommand('insertUnorderedList')}
              className="p-1.5 rounded bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white cursor-pointer"
              title="Bullet List"
            >
              <List className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={() => runCommand('insertOrderedList')}
              className="p-1.5 rounded bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white cursor-pointer"
              title="Numbered List"
            >
              <ListOrdered className="w-3.5 h-3.5" />
            </button>

            <div className="w-[1px] h-4 bg-white/10 mx-1" />

            {/* Link button */}
            <button
              onClick={handleInsertLink}
              className="p-1.5 rounded bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white cursor-pointer"
              title="Insert Link"
            >
              <LinkIcon className="w-3.5 h-3.5" />
            </button>

            {/* Clear formats button */}
            <button
              onClick={() => runCommand('removeFormat')}
              className="p-1.5 rounded bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white cursor-pointer ml-auto"
              title="Clear Formatting"
            >
              <RemoveFormatting className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Microsoft Word Canvas Area (A4 Styled Page) */}
          <div className="flex-1 bg-zinc-950/40 overflow-y-auto p-6 md:p-10 scrollbar-thin flex justify-center">
            
            {/* White A4 paper sheet container */}
            <div
              className="w-full max-w-[800px] min-h-[900px] bg-white text-slate-800 shadow-2xl p-10 md:p-14 border rounded flex flex-col focus-within:ring-2 focus-within:ring-cyan-500/30 transition-all select-text"
              style={{
                borderColor: 'var(--border-strong)',
                fontFamily: `${fontFamily}, sans-serif`
              }}
            >
              {/* WYSIWYG Editable content canvas */}
              <div
                ref={editorRef}
                contentEditable
                onInput={handleEditorInput}
                className="w-full flex-1 outline-none text-sm leading-relaxed prose prose-slate max-w-none text-left"
                style={{
                  color: '#2d3748',
                  minHeight: '100%'
                }}
                spellCheck="false"
              />
            </div>

          </div>

          {/* Bottom status bar info */}
          <div className="px-4 py-2 border-t bg-zinc-950/40 text-[10px] text-slate-500 flex justify-between items-center shrink-0 select-none" style={{ borderColor: 'var(--border)' }}>
            <span>OPERATIONAL MEMORANDUM CANVAS</span>
            <div className="flex items-center gap-1.5">
              <span>FORMAT COMPATIBLE WITH:</span>
              <strong className="text-cyan-400 font-extrabold">MICROSOFT WORD / WORDPAD (.HTML, .DOC, .DOCX)</strong>
            </div>
          </div>

        </motion.div>

      </div>

    </div>
  );
}
