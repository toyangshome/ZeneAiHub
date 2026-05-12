import fs from 'fs';
import path from 'path';
import type { FileParseResult } from '@shared/types';

const TEXT_EXTENSIONS = new Set([
  '.txt', '.md', '.json', '.csv', '.xml', '.yaml', '.yml', '.toml', '.ini', '.cfg', '.log',
]);

const CODE_EXTENSIONS: Record<string, string> = {
  '.py': 'python', '.js': 'javascript', '.ts': 'typescript', '.jsx': 'jsx', '.tsx': 'tsx',
  '.go': 'go', '.rs': 'rust', '.java': 'java', '.c': 'c', '.cpp': 'cpp', '.h': 'c',
  '.cs': 'csharp', '.rb': 'ruby', '.php': 'php', '.swift': 'swift', '.kt': 'kotlin',
  '.sh': 'bash', '.bat': 'batch', '.ps1': 'powershell', '.sql': 'sql', '.html': 'html',
  '.css': 'css', '.scss': 'scss', '.vue': 'vue', '.svelte': 'svelte', '.lua': 'lua',
  '.r': 'r', '.scala': 'scala', '.ex': 'elixir', '.exs': 'elixir', '.dart': 'dart',
};

const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.svg']);

const PDF_EXTENSIONS = new Set(['.pdf']);
const DOCX_EXTENSIONS = new Set(['.docx', '.doc']);
const EXCEL_EXTENSIONS = new Set(['.xlsx', '.xls']);

const MAX_TEXT_SIZE = 10 * 1024 * 1024;   // 10MB
const MAX_IMAGE_SIZE = 20 * 1024 * 1024;  // 20MB
const MAX_DOC_SIZE = 20 * 1024 * 1024;    // 20MB

export class FileProcessor {
  async processFile(filePath: string): Promise<FileParseResult> {
    const ext = path.extname(filePath).toLowerCase();
    const stat = fs.statSync(filePath);

    if (IMAGE_EXTENSIONS.has(ext)) {
      if (stat.size > MAX_IMAGE_SIZE) throw new Error(`图片文件过大: ${(stat.size / 1024 / 1024).toFixed(1)}MB > 20MB`);
      const base64 = fs.readFileSync(filePath, 'base64');
      const mime = ext === '.svg' ? 'image/svg+xml' : `image/${ext.slice(1)}`;
      return { type: 'image', content: base64, mimeType: mime };
    }

    if (PDF_EXTENSIONS.has(ext)) {
      if (stat.size > MAX_DOC_SIZE) throw new Error(`PDF 文件过大: ${(stat.size / 1024 / 1024).toFixed(1)}MB > 20MB`);
      return this.parsePDF(filePath);
    }

    if (DOCX_EXTENSIONS.has(ext)) {
      if (stat.size > MAX_DOC_SIZE) throw new Error(`文档文件过大: ${(stat.size / 1024 / 1024).toFixed(1)}MB > 20MB`);
      return this.parseDOCX(filePath);
    }

    if (EXCEL_EXTENSIONS.has(ext)) {
      if (stat.size > MAX_DOC_SIZE) throw new Error(`Excel 文件过大: ${(stat.size / 1024 / 1024).toFixed(1)}MB > 20MB`);
      return this.parseExcel(filePath);
    }

    if (TEXT_EXTENSIONS.has(ext) || CODE_EXTENSIONS[ext]) {
      if (stat.size > MAX_TEXT_SIZE) throw new Error(`文件过大: ${(stat.size / 1024 / 1024).toFixed(1)}MB > 10MB`);
      const content = fs.readFileSync(filePath, 'utf-8');
      return { type: 'text', content, language: CODE_EXTENSIONS[ext], mimeType: 'text/plain' };
    }

    // 其他文件类型读取为文本尝试
    if (stat.size <= MAX_TEXT_SIZE) {
      try {
        const content = fs.readFileSync(filePath, 'utf-8');
        return { type: 'text', content, mimeType: 'application/octet-stream' };
      } catch {
        throw new Error(`不支持的文件类型: ${ext}`);
      }
    }

    throw new Error(`不支持的文件类型: ${ext}`);
  }

  private async parsePDF(filePath: string): Promise<FileParseResult> {
    const { PDFParse } = await import('pdf-parse');
    const data = fs.readFileSync(filePath);
    const parser = new PDFParse({ data });
    try {
      const result = await parser.getText();
      return { type: 'text', content: result.text, mimeType: 'application/pdf' };
    } finally {
      await parser.destroy();
    }
  }

  private async parseDOCX(filePath: string): Promise<FileParseResult> {
    const mammoth = await import('mammoth');
    const buffer = fs.readFileSync(filePath);
    const result = await mammoth.extractRawText({ buffer });
    return { type: 'text', content: result.value, mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' };
  }

  private async parseExcel(filePath: string): Promise<FileParseResult> {
    const XLSX = await import('xlsx');
    const workbook = XLSX.readFile(filePath);
    const sheets: string[] = [];
    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      const csv = XLSX.utils.sheet_to_csv(sheet);
      sheets.push(`=== ${sheetName} ===\n${csv}`);
    }
    const content = sheets.join('\n\n');
    return { type: 'text', content, mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' };
  }

  getFileInfo(filePath: string) {
    const ext = path.extname(filePath).toLowerCase();
    const stat = fs.statSync(filePath);
    const isText = TEXT_EXTENSIONS.has(ext) || !!CODE_EXTENSIONS[ext];
    const isImage = IMAGE_EXTENSIONS.has(ext);
    const isPDF = PDF_EXTENSIONS.has(ext);
    const isDOCX = DOCX_EXTENSIONS.has(ext);
    const isExcel = EXCEL_EXTENSIONS.has(ext);
    return {
      name: path.basename(filePath),
      extension: ext,
      size: stat.size,
      isText,
      isImage,
      isPDF,
      isDOCX,
      isExcel,
      language: CODE_EXTENSIONS[ext],
    };
  }
}
