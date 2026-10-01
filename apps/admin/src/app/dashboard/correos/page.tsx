'use client';

import { Badge, Button, Input, Label } from '@tienda/ui';
import {
  EMAIL_TEMPLATE_CATALOG,
  type EmailTemplateDto,
  type EmailTemplateInfo,
  type EmailTemplateKey,
} from '@tienda/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Eye, Mail, RotateCcw } from 'lucide-react';
import { useState } from 'react';

import { ApiError } from '@/lib/api';
import { useApi } from '@/lib/use-api';

type Plantilla = EmailTemplateDto & EmailTemplateInfo;

export default function CorreosPage() {
  const api = useApi();
  const queryClient = useQueryClient();

  const [editando, setEditando] = useState<EmailTemplateKey | null>(null);
  const [subject, setSubject] = useState('');
  const [bodyHtml, setBodyHtml] = useState('');
  const [previsualizacion, setPrevisualizacion] = useState<{ subject: string; html: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [guardado, setGuardado] = useState(false);

  const { data: plantillas, isLoading } = useQuery({
    queryKey: ['admin', 'email-templates'],
    queryFn: () => api<Plantilla[]>('/admin/email-templates'),
  });

  const actual = plantillas?.find((p) => p.key === editando) ?? null;
  const invalidar = () => queryClient.invalidateQueries({ queryKey: ['admin', 'email-templates'] });

  const abrir = (p: Plantilla) => {
    setEditando(p.key);
    setSubject(p.subject);
    setBodyHtml(p.bodyHtml);
    setPrevisualizacion(null);
    setError(null);
    setGuardado(false);
  };

  const guardarMutation = useMutation({
    mutationFn: () =>
      api(`/admin/email-templates/${editando}`, { method: 'PUT', body: JSON.stringify({ subject, bodyHtml }) }),
    onSuccess: async () => {
      await invalidar();
      setGuardado(true);
      setError(null);
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : 'No se pudo guardar'),
  });

  const previewMutation = useMutation({
    mutationFn: () =>
      api<{ subject: string; html: string }>(`/admin/email-templates/${editando}/preview`, {
        method: 'POST',
        body: JSON.stringify({ subject, bodyHtml }),
      }),
    onSuccess: (data) => {
      setPrevisualizacion(data);
      setError(null);
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : 'No se pudo previsualizar'),
  });

  const restaurarMutation = useMutation({
    mutationFn: () => api<EmailTemplateDto>(`/admin/email-templates/${editando}/restore`, { method: 'POST' }),
    onSuccess: async (data) => {
      setSubject(data.subject);
      setBodyHtml(data.bodyHtml);
      setPrevisualizacion(null);
      setGuardado(false);
      await invalidar();
    },
  });

  /** Inserta la variable al final del cuerpo; es lo previsible sin manejar el cursor. */
  const insertarVariable = (nombre: string) => {
    setBodyHtml((previo) => `${previo}{{${nombre}}}`);
    setGuardado(false);
  };

  // ---------------------------------------------------------------- listado
  if (!editando || !actual) {
    return (
      <div>
        <div className="mb-6">
          <h1 className="text-xl font-semibold">Correos</h1>
          <p className="text-sm text-muted-foreground">
            Editá el texto de los correos que envía la tienda. Los que no toques usan el texto original.
          </p>
        </div>

        {isLoading && <p className="text-sm text-muted-foreground">Cargando…</p>}

        <div className="grid gap-3 md:grid-cols-2">
          {plantillas?.map((p) => (
            <button
              key={p.key}
              type="button"
              onClick={() => abrir(p)}
              className="rounded-lg border border-border bg-background p-4 text-left transition-colors hover:border-primary/50"
            >
              <div className="mb-1 flex items-start justify-between gap-2">
                <span className="flex items-center gap-2 font-medium">
                  <Mail className="h-4 w-4 shrink-0 text-muted-foreground" />
                  {p.label}
                </span>
                <Badge variant={p.personalizada ? 'default' : 'outline'} className="shrink-0">
                  {p.personalizada ? 'Editado' : 'Original'}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">{p.description}</p>
              <p className="mt-2 text-xs text-muted-foreground">
                Va a: <span className="font-medium text-foreground">{p.audience}</span>
              </p>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // ----------------------------------------------------------------- editor
  const info = EMAIL_TEMPLATE_CATALOG[actual.key];

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <button
            type="button"
            onClick={() => setEditando(null)}
            className="mb-2 flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Volver
          </button>
          <h1 className="text-xl font-semibold">{info.label}</h1>
          <p className="text-sm text-muted-foreground">{info.description}</p>
        </div>
        {actual.personalizada && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => restaurarMutation.mutate()}
            disabled={restaurarMutation.isPending}
            className="shrink-0"
          >
            <RotateCcw className="mr-2 h-3.5 w-3.5" />
            Restaurar original
          </Button>
        )}
      </div>

      <div className="rounded-lg border border-border bg-background p-4">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Variables disponibles
        </p>
        <div className="flex flex-wrap gap-2">
          {info.variables.map((v) => (
            <button
              key={v.name}
              type="button"
              onClick={() => insertarVariable(v.name)}
              title={`${v.description}. Tocá para agregarla al final del cuerpo.`}
              className="rounded-md border border-border bg-muted/50 px-2 py-1 font-mono text-xs transition-colors hover:border-primary/50 hover:bg-muted"
            >
              {`{{${v.name}}}`}
              {v.isHtml && <span className="ml-1 text-[10px] text-muted-foreground">(bloque)</span>}
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Las marcadas <span className="font-medium">(bloque)</span> las arma el sistema: insertan la tabla de
          productos ya formateada.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="subject">Asunto</Label>
        <Input
          id="subject"
          value={subject}
          onChange={(e) => {
            setSubject(e.target.value);
            setGuardado(false);
          }}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="body">Cuerpo del correo (HTML)</Label>
        <textarea
          id="body"
          value={bodyHtml}
          onChange={(e) => {
            setBodyHtml(e.target.value);
            setGuardado(false);
          }}
          spellCheck={false}
          className="h-80 w-full rounded-md border border-border bg-background p-3 font-mono text-xs leading-relaxed text-foreground focus:border-primary focus:outline-none"
        />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
      {guardado && <p className="text-sm text-primary">Guardado. Los próximos correos usan este texto.</p>}

      <div className="flex flex-wrap gap-3">
        <Button onClick={() => guardarMutation.mutate()} disabled={guardarMutation.isPending || !subject || !bodyHtml}>
          {guardarMutation.isPending ? 'Guardando…' : 'Guardar'}
        </Button>
        <Button variant="outline" onClick={() => previewMutation.mutate()} disabled={previewMutation.isPending}>
          <Eye className="mr-2 h-4 w-4" />
          {previewMutation.isPending ? 'Generando…' : 'Previsualizar'}
        </Button>
      </div>

      {previsualizacion && (
        <div className="rounded-lg border border-border bg-background">
          <div className="border-b border-border p-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Así lo va a recibir</p>
            <p className="mt-1 text-sm font-semibold">{previsualizacion.subject}</p>
          </div>
          {/* Se muestra dentro de un iframe aislado: el HTML del correo trae sus
              propios estilos y sin aislar se mezclarían con los del panel. */}
          <iframe
            title="Previsualización del correo"
            srcDoc={previsualizacion.html}
            sandbox=""
            className="h-[28rem] w-full rounded-b-lg bg-white"
          />
        </div>
      )}
    </div>
  );
}
