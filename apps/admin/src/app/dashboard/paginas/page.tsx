'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Button,
  Input,
  Label,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@tienda/ui';
import {
  FileText,
  Plus,
  Edit2,
  Trash2,
  ArrowLeft,
  Eye,
  CheckCircle,
  XCircle,
  Loader2,
  Code
} from 'lucide-react';
import { slugify } from '@tienda/shared';
import { useApi } from '@/lib/use-api';
import { ApiError } from '@/lib/api';
import { marked } from 'marked';
import DOMPurify from 'isomorphic-dompurify';

interface StaticPage {
  id: string;
  title: string;
  slug: string;
  contentHtml: string;
  contentMd: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

type Mode = 'list' | 'create' | 'edit';

export default function PagesCMSPage() {
  const api = useApi();
  const queryClient = useQueryClient();

  const [mode, setMode] = useState<Mode>('list');
  const [editingPage, setEditingPage] = useState<StaticPage | null>(null);

  // Form State
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [contentMd, setContentMd] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [slugTouched, setSlugTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Tab editor vs preview
  const [activeFormTab, setActiveFormTab] = useState<'editor' | 'preview'>('editor');

  const { data: pages, isLoading } = useQuery({
    queryKey: ['admin', 'pages'],
    queryFn: () => api<StaticPage[]>('/admin/cms/pages'),
  });

  const saveMutation = useMutation({
    mutationFn: () => {
      // Parse markdown to HTML
      const contentHtml = marked.parse(contentMd) as string;
      const body = {
        title,
        slug: slug.toLowerCase().trim(),
        contentHtml,
        contentMd,
        isActive,
      };

      return mode === 'edit' && editingPage
        ? api<StaticPage>(`/admin/cms/pages/${editingPage.id}`, { method: 'PUT', body: JSON.stringify(body) })
        : api<StaticPage>('/admin/cms/pages', { method: 'POST', body: JSON.stringify(body) });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'pages'] });
      resetForm();
      setMode('list');
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : 'No se pudo guardar la página'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api(`/admin/cms/pages/${id}`, { method: 'DELETE' }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['admin', 'pages'] }),
  });

  const handleTitleChange = (val: string) => {
    setTitle(val);
    if (!slugTouched) {
      setSlug(slugify(val));
    }
  };

  const handleSlugChange = (val: string) => {
    setSlugTouched(true);
    setSlug(val.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''));
  };

  const openCreate = () => {
    resetForm();
    setMode('create');
  };

  const openEdit = (page: StaticPage) => {
    setError(null);
    setEditingPage(page);
    setTitle(page.title);
    setSlug(page.slug);
    setContentMd(page.contentMd || '');
    setIsActive(page.isActive);
    setSlugTouched(true);
    setActiveFormTab('editor');
    setMode('edit');
  };

  const handleDelete = (id: string) => {
    if (confirm('¿Estás seguro de que quieres eliminar esta página?')) {
      deleteMutation.mutate(id);
    }
  };

  const resetForm = () => {
    setTitle('');
    setSlug('');
    setContentMd('');
    setIsActive(true);
    setSlugTouched(false);
    setEditingPage(null);
    setError(null);
    setActiveFormTab('editor');
  };

  // Convert preview markdown to html safely
  const getSanitizedPreview = () => {
    try {
      const rawHtml = marked.parse(contentMd) as string;
      return DOMPurify.sanitize(rawHtml);
    } catch {
      return '';
    }
  };

  if (isLoading) {
    return <p className="text-sm text-muted-foreground animate-pulse">Cargando páginas...</p>;
  }

  return (
    <div className="space-y-6">
      {mode === 'list' ? (
        <>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Páginas Informativas (CMS)</h1>
              <p className="text-sm text-muted-foreground">
                Administrá las páginas estáticas de información (Términos, Envíos, Preguntas, etc.).
              </p>
            </div>
            <Button onClick={openCreate} className="gap-2">
              <Plus className="h-4 w-4" /> Nueva Página
            </Button>
          </div>

          <div className="rounded-lg border border-border bg-background">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Título</TableHead>
                  <TableHead>Ruta (Slug)</TableHead>
                  <TableHead className="w-32">Estado</TableHead>
                  <TableHead className="w-24 text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pages && pages.length > 0 ? (
                  pages.map((page) => (
                    <TableRow key={page.id}>
                      <TableCell className="font-semibold text-foreground flex items-center gap-2">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        {page.title}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        /p/{page.slug}
                      </TableCell>
                      <TableCell>
                        {page.isActive ? (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-600">
                            <CheckCircle className="h-3.5 w-3.5" /> Activa
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground">
                            <XCircle className="h-3.5 w-3.5" /> Borrador
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="inline-flex gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEdit(page)}
                            className="h-8 w-8 p-0"
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(page.id)}
                            className="h-8 w-8 p-0 text-destructive hover:bg-destructive/10"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={4} className="h-24 text-center text-sm text-muted-foreground">
                      No hay páginas creadas todavía.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </>
      ) : (
        <div className="mx-auto max-w-4xl space-y-6">
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setMode('list')}
              className="h-9 w-9 p-0"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-xl font-bold">
                {mode === 'create' ? 'Crear Nueva Página' : `Editar: ${editingPage?.title}`}
              </h1>
              <p className="text-xs text-muted-foreground">
                Escribí el contenido en formato Markdown y previsualizalo en tiempo real.
              </p>
            </div>
          </div>

          {error && (
            <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm font-semibold">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Form Fields */}
            <div className="md:col-span-2 space-y-4 rounded-lg border border-border bg-background p-5">
              <div className="space-y-2">
                <Label htmlFor="title">Título de la Página</Label>
                <Input
                  id="title"
                  type="text"
                  placeholder="Cómo comprar"
                  value={title}
                  onChange={(e) => handleTitleChange(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="slug">Slug (URL corta)</Label>
                <div className="flex rounded-md border border-input bg-muted/40 items-center overflow-hidden">
                  <span className="px-3 text-xs text-muted-foreground font-mono bg-muted py-2.5 border-r border-input">
                    /p/
                  </span>
                  <input
                    id="slug"
                    type="text"
                    placeholder="como-comprar"
                    value={slug}
                    onChange={(e) => handleSlugChange(e.target.value)}
                    required
                    className="flex-1 bg-transparent px-3 py-1.5 text-sm outline-none font-mono"
                  />
                </div>
              </div>

              {/* Tabs para Editor vs Preview */}
              <div className="border-b border-border mt-6">
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setActiveFormTab('editor')}
                    className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold border-b-2 -mb-[1px] transition-colors ${activeFormTab === 'editor' ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
                  >
                    <Code className="h-4 w-4" /> Editor (Markdown)
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveFormTab('preview')}
                    className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold border-b-2 -mb-[1px] transition-colors ${activeFormTab === 'preview' ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
                  >
                    <Eye className="h-4 w-4" /> Previsualización
                  </button>
                </div>
              </div>

              {activeFormTab === 'editor' ? (
                <div className="space-y-2 pt-2">
                  <Label htmlFor="content">Contenido de la página (Markdown)</Label>
                  <textarea
                    id="content"
                    value={contentMd}
                    onChange={(e) => setContentMd(e.target.value)}
                    required
                    className="w-full min-h-[350px] font-mono text-sm rounded-md border border-input bg-transparent px-3 py-2 outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50"
                    placeholder="# Título Principal&#10;&#10;Escribí texto en **negrita**, *cursiva* o crea listas:&#10;- Paso 1&#10;- Paso 2"
                  />
                </div>
              ) : (
                <div className="pt-4 prose prose-sm max-w-none min-h-[350px] border border-border/60 bg-muted/10 rounded-lg p-4 overflow-y-auto">
                  {contentMd.trim() ? (
                    <div dangerouslySetInnerHTML={{ __html: getSanitizedPreview() }} />
                  ) : (
                    <p className="text-sm text-muted-foreground italic">El contenido está vacío. Escribí en el editor para previsualizar.</p>
                  )}
                </div>
              )}
            </div>

            {/* Sidebar Ajustes */}
            <div className="space-y-6">
              <div className="rounded-lg border border-border bg-background p-5 space-y-4">
                <h3 className="font-bold text-sm text-foreground">Ajustes de Publicación</h3>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="isActive"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                    className="rounded border-border text-primary focus:ring-primary h-4 w-4"
                  />
                  <label htmlFor="isActive" className="text-sm font-medium text-foreground select-none">
                    Página activa y visible
                  </label>
                </div>
                <p className="text-xs text-muted-foreground">
                  Si desactivas la página, se guardará como borrador y los clientes no podrán acceder a ella.
                </p>
              </div>

              <div className="flex flex-col gap-2">
                <Button
                  onClick={() => saveMutation.mutate()}
                  disabled={saveMutation.isPending || !title || !slug || !contentMd}
                  className="w-full h-11 font-semibold"
                >
                  {saveMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Guardando...
                    </>
                  ) : (
                    'Guardar Página'
                  )}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setMode('list')}
                  className="w-full h-11"
                >
                  Cancelar
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
