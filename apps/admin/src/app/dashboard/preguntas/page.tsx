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
  HelpCircle,
  Plus,
  Edit2,
  Trash2,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  CheckCircle,
  XCircle,
  Loader2,
  Eye,
  Code
} from 'lucide-react';
import { useApi } from '@/lib/use-api';
import { ApiError } from '@/lib/api';
import { marked } from 'marked';
import DOMPurify from 'isomorphic-dompurify';

interface FAQ {
  id: string;
  question: string;
  answerHtml: string;
  answerMd: string | null;
  category: string;
  position: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

type Mode = 'list' | 'create' | 'edit';

const CATEGORIES = [
  { value: 'general', label: 'General' },
  { value: 'envios', label: 'Envíos y Entregas' },
  { value: 'pagos', label: 'Pagos y Señales' },
  { value: 'talles', label: 'Talles y Personalización' },
];

export default function FaqsCMSPage() {
  const api = useApi();
  const queryClient = useQueryClient();

  const [mode, setMode] = useState<Mode>('list');
  const [editingFaq, setEditingFaq] = useState<FAQ | null>(null);

  // Form State
  const [question, setQuestion] = useState('');
  const [answerMd, setAnswerMd] = useState('');
  const [category, setCategory] = useState('general');
  const [isActive, setIsActive] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Tab editor vs preview
  const [activeFormTab, setActiveFormTab] = useState<'editor' | 'preview'>('editor');

  const { data: faqs, isLoading } = useQuery({
    queryKey: ['admin', 'faqs'],
    queryFn: () => api<FAQ[]>('/admin/cms/faqs'),
  });

  const saveMutation = useMutation({
    mutationFn: () => {
      const answerHtml = marked.parse(answerMd) as string;
      const body = {
        question,
        answerHtml,
        answerMd,
        category: category.toLowerCase().trim(),
        isActive,
      };

      return mode === 'edit' && editingFaq
        ? api<FAQ>(`/admin/cms/faqs/${editingFaq.id}`, { method: 'PUT', body: JSON.stringify(body) })
        : api<FAQ>('/admin/cms/faqs', { method: 'POST', body: JSON.stringify(body) });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'faqs'] });
      resetForm();
      setMode('list');
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : 'No se pudo guardar la FAQ'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api(`/admin/cms/faqs/${id}`, { method: 'DELETE' }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['admin', 'faqs'] }),
  });

  const reorderMutation = useMutation({
    mutationFn: (ids: string[]) =>
      api('/admin/cms/faqs/reorder', { method: 'PATCH', body: JSON.stringify({ ids }) }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['admin', 'faqs'] }),
  });

  const moveFaq = (index: number, direction: 'up' | 'down') => {
    if (!faqs) return;
    const list = [...faqs];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= list.length) return;

    // Intercambiar
    const temp = list[index]!;
    list[index] = list[targetIndex]!;
    list[targetIndex] = temp;

    const ids = list.map((f) => f.id);
    reorderMutation.mutate(ids);
  };

  const openCreate = () => {
    resetForm();
    setMode('create');
  };

  const openEdit = (faq: FAQ) => {
    setError(null);
    setEditingFaq(faq);
    setQuestion(faq.question);
    setAnswerMd(faq.answerMd || '');
    setCategory(faq.category);
    setIsActive(faq.isActive);
    setActiveFormTab('editor');
    setMode('edit');
  };

  const handleDelete = (id: string) => {
    if (confirm('¿Estás seguro de que deseas eliminar esta pregunta frecuente?')) {
      deleteMutation.mutate(id);
    }
  };

  const resetForm = () => {
    setQuestion('');
    setAnswerMd('');
    setCategory('general');
    setIsActive(true);
    setEditingFaq(null);
    setError(null);
    setActiveFormTab('editor');
  };

  const getSanitizedPreview = () => {
    try {
      const rawHtml = marked.parse(answerMd) as string;
      return DOMPurify.sanitize(rawHtml);
    } catch {
      return '';
    }
  };

  if (isLoading) {
    return <p className="text-sm text-muted-foreground animate-pulse">Cargando preguntas frecuentes...</p>;
  }

  return (
    <div className="space-y-6">
      {mode === 'list' ? (
        <>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Preguntas Frecuentes (FAQ)</h1>
              <p className="text-sm text-muted-foreground">
                Gestioná las preguntas frecuentes agrupadas por categoría y ordenadas por orden de visualización.
              </p>
            </div>
            <Button onClick={openCreate} className="gap-2">
              <Plus className="h-4 w-4" /> Nueva FAQ
            </Button>
          </div>

          <div className="rounded-lg border border-border bg-background">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12 text-center">Orden</TableHead>
                  <TableHead>Pregunta</TableHead>
                  <TableHead>Categoría</TableHead>
                  <TableHead className="w-32">Estado</TableHead>
                  <TableHead className="w-24 text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {faqs && faqs.length > 0 ? (
                  faqs.map((faq, index) => (
                    <TableRow key={faq.id}>
                      <TableCell className="text-center">
                        <div className="flex flex-col items-center justify-center gap-0.5">
                          <button
                            disabled={index === 0}
                            onClick={() => moveFaq(index, 'up')}
                            className="text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:hover:text-muted-foreground"
                          >
                            <ArrowUp className="h-3.5 w-3.5" />
                          </button>
                          <button
                            disabled={index === faqs.length - 1}
                            onClick={() => moveFaq(index, 'down')}
                            className="text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:hover:text-muted-foreground"
                          >
                            <ArrowDown className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </TableCell>
                      <TableCell className="font-semibold text-foreground flex items-center gap-2 pt-4">
                        <HelpCircle className="h-4 w-4 text-primary" />
                        {faq.question}
                      </TableCell>
                      <TableCell className="capitalize text-xs text-muted-foreground">
                        {CATEGORIES.find((cat) => cat.value === faq.category)?.label || faq.category}
                      </TableCell>
                      <TableCell>
                        {faq.isActive ? (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-600">
                            <CheckCircle className="h-3.5 w-3.5" /> Activa
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground">
                            <XCircle className="h-3.5 w-3.5" /> Inactiva
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="inline-flex gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEdit(faq)}
                            className="h-8 w-8 p-0"
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(faq.id)}
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
                    <TableCell colSpan={5} className="h-24 text-center text-sm text-muted-foreground">
                      No hay preguntas frecuentes creadas todavía.
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
                {mode === 'create' ? 'Crear Nueva FAQ' : 'Editar FAQ'}
              </h1>
              <p className="text-xs text-muted-foreground">
                Agrega respuestas informativas de ayuda para los compradores de la tienda.
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
                <Label htmlFor="question">Pregunta</Label>
                <Input
                  id="question"
                  type="text"
                  placeholder="¿Cuánto tarda el envío por encargo?"
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="category">Categoría</Label>
                <select
                  id="category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full rounded-md border border-input bg-transparent h-10 px-3 text-sm focus:border-primary/50 focus:outline-none"
                >
                  {CATEGORIES.map((cat) => (
                    <option key={cat.value} value={cat.value}>
                      {cat.label}
                    </option>
                  ))}
                </select>
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
                  <Label htmlFor="answer">Respuesta (Markdown)</Label>
                  <textarea
                    id="answer"
                    value={answerMd}
                    onChange={(e) => setAnswerMd(e.target.value)}
                    required
                    className="w-full min-h-[250px] font-mono text-sm rounded-md border border-input bg-transparent px-3 py-2 outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50"
                    placeholder="Escribí la respuesta de la pregunta..."
                  />
                </div>
              ) : (
                <div className="pt-4 prose prose-sm max-w-none min-h-[250px] border border-border/60 bg-muted/10 rounded-lg p-4 overflow-y-auto">
                  {answerMd.trim() ? (
                    <div dangerouslySetInnerHTML={{ __html: getSanitizedPreview() }} />
                  ) : (
                    <p className="text-sm text-muted-foreground italic">La respuesta está vacía.</p>
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
                    Pregunta activa y visible
                  </label>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <Button
                  onClick={() => saveMutation.mutate()}
                  disabled={saveMutation.isPending || !question || !answerMd}
                  className="w-full h-11 font-semibold"
                >
                  {saveMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Guardando...
                    </>
                  ) : (
                    'Guardar FAQ'
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
