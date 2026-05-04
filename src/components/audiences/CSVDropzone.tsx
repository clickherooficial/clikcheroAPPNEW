// audience-management (Sprint 3/8) — drag-and-drop de CSV.
// Parser cliente-side simples (split por linha + virgula). Limite 1MB.
// Retorna {schema, rawData} pra parent que faz hash.
import { useCallback, useState } from 'react';
import { Upload, FileText, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import type { AudienceCustomerSchema } from '@/types/audiences';

const MAX_BYTES = 1_048_576;

interface Props {
  onParsed: (parsed: { schema: AudienceCustomerSchema[]; rawData: string[][]; previewRows: string[][] }) => void;
}

const SCHEMA_OPTIONS: AudienceCustomerSchema[] = ['EMAIL', 'PHONE', 'FN', 'LN', 'GEN', 'DOBY', 'COUNTRY'];

function splitCsvLine(line: string): string[] {
  // Parser simples: split por virgula, sem suporte a campos com aspas.
  // Suficiente pra audiencias (email/phone nao tem virgula).
  return line.split(',').map((s) => s.trim());
}

export function CSVDropzone({ onParsed }: Props) {
  const [dragOver, setDragOver] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [previewRows, setPreviewRows] = useState<string[][]>([]);
  const [allRows, setAllRows] = useState<string[][]>([]);
  const [columnCount, setColumnCount] = useState(0);
  const [schema, setSchema] = useState<AudienceCustomerSchema[]>([]);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setFileName(null); setPreviewRows([]); setAllRows([]);
    setColumnCount(0); setSchema([]); setError(null);
  };

  const handleFile = useCallback(async (file: File) => {
    setError(null);
    if (file.size > MAX_BYTES) {
      setError(`Arquivo muito grande (${(file.size / 1024).toFixed(0)} KB). Limite: 1 MB.`);
      return;
    }
    const text = await file.text();
    const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lines.length === 0) {
      setError('CSV vazio.');
      return;
    }
    const rows = lines.map(splitCsvLine);
    const cols = rows[0].length;
    if (!rows.every((r) => r.length === cols)) {
      setError('Linhas com numero diferente de colunas.');
      return;
    }
    setFileName(file.name);
    setColumnCount(cols);
    setAllRows(rows);
    setPreviewRows(rows.slice(0, 5));
    setSchema(Array(cols).fill('EMAIL') as AudienceCustomerSchema[]);
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) void handleFile(f);
  }, [handleFile]);

  const confirmSchema = () => {
    if (schema.length !== columnCount) return;
    onParsed({ schema, rawData: allRows, previewRows });
  };

  return (
    <div className="space-y-3">
      {!fileName ? (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          className={cn(
            'border-2 border-dashed rounded-lg p-8 text-center cursor-pointer',
            dragOver ? 'border-primary bg-primary/5' : 'border-border',
          )}
          onClick={() => document.getElementById('audience-csv-input')?.click()}
        >
          <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
          <p className="text-sm">Arraste o CSV ou clique para selecionar</p>
          <p className="text-xs text-muted-foreground mt-1">Max 1 MB · 1 coluna por campo · sem header</p>
          <input
            id="audience-csv-input"
            type="file"
            accept=".csv,text/csv,text/plain"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleFile(f); }}
          />
        </div>
      ) : (
        <div className="border rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">{fileName}</span>
              <span className="text-xs text-muted-foreground">({allRows.length} linhas, {columnCount} colunas)</span>
            </div>
            <Button variant="ghost" size="icon" onClick={reset}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="space-y-2">
            <div className="text-xs font-medium">Mapeie cada coluna pro tipo Meta:</div>
            <div className="flex flex-wrap gap-2">
              {schema.map((s, i) => (
                <Select
                  key={i}
                  value={s}
                  onValueChange={(v) => setSchema((prev) => prev.map((p, j) => j === i ? (v as AudienceCustomerSchema) : p))}
                >
                  <SelectTrigger className="w-32 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SCHEMA_OPTIONS.map((opt) => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
                  </SelectContent>
                </Select>
              ))}
            </div>
          </div>

          <div className="text-xs text-muted-foreground">Preview (5 primeiras linhas):</div>
          <div className="border rounded text-xs font-mono">
            <div className="grid divide-y" style={{ gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))` }}>
              {previewRows.flatMap((row, ri) =>
                row.map((cell, ci) => (
                  <div key={`${ri}-${ci}`} className="px-2 py-1 truncate border-r">{cell}</div>
                )),
              )}
            </div>
          </div>

          <div className="flex justify-end">
            <Button onClick={confirmSchema} size="sm">Usar este CSV</Button>
          </div>
        </div>
      )}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
