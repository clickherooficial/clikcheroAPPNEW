// View principal "Memoria" da Knowledge Base.
// Spec: knowledge-base-rag (task 6.1 — R7.1, R7.2, R7.6)

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  FileText, FileSpreadsheet, Image as ImageIcon, FileJson, FileType,
  Plus, Search, Star, Loader2, AlertCircle,
} from 'lucide-react';
import { useKnowledge } from '@/hooks/use-knowledge';
import { KnowledgeUsageBanner } from './KnowledgeUsageBanner';
import { DocumentUploadDialog } from './DocumentUploadDialog';
import { DocumentDetailDrawer } from './DocumentDetailDrawer';
import type { KbDocStatus, KbDocType, KnowledgeDocument } from '@/types/knowledge';

const TYPE_ICONS: Record<KbDocType, React.ComponentType<{ className?: string }>> = {
  pdf: FileText,
  docx: FileText,
  xlsx: FileSpreadsheet,
  csv: FileSpreadsheet,
  json: FileJson,
  txt: FileType,
  md: FileType,
  image: ImageIcon,
};

const STATUS_LABELS: Record<KbDocStatus, string> = {
  pending: 'Aguardando',
  extracting: 'Extraindo',
  embedding: 'Indexando',
  indexed: 'Indexado',
  failed: 'Falhou',
};

const STATUS_VARIANTS: Record<KbDocStatus, 'default' | 'secondary' | 'destructive'> = {
  pending: 'secondary',
  extracting: 'secondary',
  embedding: 'secondary',
  indexed: 'default',
  failed: 'destructive',
};

export default function MemoryView() {
  const { documents, isLoading, isError, isReadOnly, filters, setFilters } = useKnowledge();
  const [uploadOpen, setUploadOpen] = useState(false);
  const [detail, setDetail] = useState<KnowledgeDocument | null>(null);
  const [search, setSearch] = useState(filters.search ?? '');

  const applySearch = () => {
    setFilters({ ...filters, search: search.trim() || undefined });
  };

  return (
    <div className="container max-w-5xl py-6 space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Memória</h1>
          <p className="text-sm text-muted-foreground">
            Documentos que a IA do Fury usa para gerar criativos e responder com base no seu negocio.
          </p>
        </div>
        <Button onClick={() => setUploadOpen(true)} disabled={isReadOnly}>
          <Plus className="h-4 w-4 mr-1" /> Adicionar
        </Button>
      </div>

      <KnowledgeUsageBanner />

      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por titulo ou descrição..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && applySearch()}
            onBlur={applySearch}
            className="pl-9"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : isError ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            <AlertCircle className="h-6 w-6 mx-auto mb-2" />
            Erro ao carregar documentos.
          </CardContent>
        </Card>
      ) : documents.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
            <p className="font-medium">Nenhum documento ainda</p>
            <p className="text-sm text-muted-foreground mb-4">
              Suba PDFs, fotos de produto, depoimentos, planilhas — qualquer coisa que ajude a IA a entender seu negocio.
            </p>
            <Button onClick={() => setUploadOpen(true)} disabled={isReadOnly}>
              <Plus className="h-4 w-4 mr-1" /> Adicionar primeiro documento
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {documents.map((doc) => {
            const Icon = TYPE_ICONS[doc.type] ?? FileText;
            return (
              <Card key={doc.id} className="cursor-pointer hover:bg-muted/50 transition" onClick={() => setDetail(doc)}>
                <CardContent className="py-3 flex items-center gap-3">
                  <Icon className="h-8 w-8 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium truncate">{doc.title}</span>
                      {doc.is_source_of_truth && (
                        <Badge variant="default" className="shrink-0">
                          <Star className="h-3 w-3 mr-1" /> Fonte
                        </Badge>
                      )}
                      {doc.source === 'chat_attachment' && (
                        <Badge variant="outline" className="shrink-0">do chat</Badge>
                      )}
                    </div>
                    {doc.description && (
                      <p className="text-xs text-muted-foreground truncate">{doc.description}</p>
                    )}
                    <div className="flex flex-wrap gap-1 mt-1">
                      {doc.tags.slice(0, 4).map((tag) => (
                        <Badge key={tag} variant="secondary" className="text-xs h-5">
                          {tag}
                        </Badge>
                      ))}
                      {doc.tags.length > 4 && (
                        <span className="text-xs text-muted-foreground">+{doc.tags.length - 4}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <Badge variant={STATUS_VARIANTS[doc.status]}>
                      {STATUS_LABELS[doc.status]}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {(doc.size_bytes / 1024).toFixed(0)} KB
                    </span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <DocumentUploadDialog open={uploadOpen} onOpenChange={setUploadOpen} />
      <DocumentDetailDrawer
        document={detail}
        open={!!detail}
        onOpenChange={(o) => !o && setDetail(null)}
      />
    </div>
  );
}
