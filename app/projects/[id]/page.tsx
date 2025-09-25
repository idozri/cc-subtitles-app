'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import TranscriptionEditor from '@/components/transcription-editor';
import { Button } from '@/components/ui/button';
import ModalLanguagePicker from '@/components/modal-language-picker';
import { Env } from '@/lib/env';
import { Project } from '@/types/project';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { client } from '@/api/common';
import { ApiResponse } from '@/api/types';
import { useFontsStore } from '@/lib/store/fonts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { findLanguage, findLanguageByAnyCode } from '@/lib/languages';
import { Switch } from '@/components/ui';
import { SettingsContent } from '@/components/settings-content';
import { useVideoSettingsStore } from '@/lib/store/video-settings';
import {
  FileVideo,
  Languages,
  Clock,
  Calendar,
  Activity,
  Download,
  Video as VideoIcon,
  FileText,
  FileCode,
  File,
  Trash2,
} from 'lucide-react';
import { EditableTitle } from '@/components/editable-title';
import EditableDescription from '@/components/editable-description';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

type TranscriptionData = {
  segments: Array<{
    id: number;
    start: number;
    end: number;
    text: string;
    words: Array<{ word: string; start: number; end: number }>;
    translations?: Record<string, string>;
    pending?: Record<string, boolean>;
  }>;
  language?: string;
};

export default function GeneratePage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [data, setData] = useState<TranscriptionData | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [visibleCodes, setVisibleCodes] = useState<Record<string, boolean>>({});
  const [extraLangNames, setExtraLangNames] = useState<Record<string, string>>(
    {}
  );
  const [error, setError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  // const [project, setProject] = useState<Project | null>(null);
  // const [isLoadingJson, setIsLoadingJson] = useState(true);

  // get the project with react query
  const { data: project, isLoading } = useQuery({
    queryKey: ['project', params.id],
    queryFn: async () => {
      const res = await client.get<ApiResponse<Project>>(
        `/projects/${params.id}`
      );
      return res.data.data;
    },
    enabled: !!params.id,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
  });

  const { data: jsonFile, isLoading: isLoadingJson } = useQuery({
    queryKey: ['transcription', params.id],
    queryFn: async () => {
      const res = await fetch(project?.transcriptionJsonUrl!);
      const raw = await res.json();
      return raw;
    },
    enabled: !!project?.transcriptionJsonUrl,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
  });

  useEffect(() => {
    if (jsonFile) {
      setData(jsonFile);
    }
  }, [jsonFile]);

  // Mutation for updating project
  const updateProjectMutation = useMutation({
    mutationFn: async (updates: { title?: string; description?: string }) => {
      const res = await client.put<ApiResponse<Project>>(
        `/projects/${params.id}`,
        updates
      );
      return res.data.data;
    },
    onSuccess: (updatedProject) => {
      // Update the project in the cache
      queryClient.setQueryData(['project', params.id], updatedProject);
    },
  });

  // Mutation for deleting project
  const deleteProjectMutation = useMutation({
    mutationFn: async () => {
      const res = await client.delete(`/projects/${params.id}`);
      return res.data;
    },
    onSuccess: () => {
      // Redirect to projects page after successful deletion
      router.push('/projects');
    },
  });

  // Determine default font: last recent or Roboto
  const recentFonts = useFontsStore((s) => s.recent);
  const defaultFont = recentFonts[0] || 'Roboto';

  const originalLanguageCode = useMemo<string | undefined>(() => {
    return data?.language || project?.originalLanguage || undefined;
  }, [data?.language, project?.originalLanguage]);

  const originalLanguage = useMemo(() => {
    if (!originalLanguageCode) return undefined;
    return findLanguage(originalLanguageCode);
  }, [originalLanguageCode]);

  // Build translation language names once (from the first segment having translations)
  const translationLanguageNames = useMemo<Record<string, string>>(() => {
    const names: Record<string, string> = {};
    const sample = data?.segments?.find(
      (s) => s.translations && Object.keys(s.translations).length > 0
    );
    if (!sample || !sample.translations) return names;
    for (const code of Object.keys(sample.translations)) {
      const lang = findLanguageByAnyCode(code);
      names[code] = lang?.name || code;
    }
    return names;
  }, [data?.segments]);

  const combinedLanguageNames = useMemo<Record<string, string>>(
    () => ({ ...translationLanguageNames, ...extraLangNames }),
    [translationLanguageNames, extraLangNames]
  );

  // Validation function to ensure at least one language is always enabled
  const canToggleLanguage = (
    languageCode: string,
    newValue: boolean
  ): boolean => {
    if (newValue) return true; // Always allow turning on a language

    // If turning off, check if any other language would remain enabled
    const currentVisible = { ...visibleCodes };
    currentVisible[languageCode] = newValue;

    // Check if any language is still enabled
    const hasAnyEnabled = Object.values(currentVisible).some(
      (enabled) => enabled
    );
    return hasAnyEnabled;
  };

  const handleDeleteProject = async () => {
    setIsDeleting(true);
    try {
      await deleteProjectMutation.mutateAsync();
    } catch (error) {
      console.error('Failed to delete project:', error);
    } finally {
      setIsDeleting(false);
    }
  };

  // Initialize visibility: show source + any translations found
  useEffect(() => {
    const vis: Record<string, boolean> = { ...(visibleCodes || {}) };
    if (originalLanguageCode)
      vis[originalLanguageCode] = vis[originalLanguageCode] ?? true;
    const sample = data?.segments?.find(
      (s) => s.translations && Object.keys(s.translations).length > 0
    );
    if (sample?.translations) {
      for (const code of Object.keys(sample.translations)) {
        vis[code] = vis[code] ?? true;
      }
    }
    setVisibleCodes(vis);
  }, [data?.segments, originalLanguageCode]);

  if (isLoading || isLoadingJson) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full"></div>
        </div>
      </div>
    );
  }

  if (!isLoading && !isLoadingJson && (error || !data)) {
    return (
      <div className="container mx-auto p-6">
        <div className="max-w-xl mx-auto text-center space-y-4">
          <p className="text-destructive font-medium">{error || 'No data'}</p>
          <Button onClick={() => router.back()}>Back</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 lg:p-6">
      {/* Provide translation language names to children via window for reuse */}
      {(() => {
        if (typeof window !== 'undefined') {
          (window as any).__transLangNames = combinedLanguageNames;
          (window as any).__visibleLangs = visibleCodes;
        }
        return null;
      })()}
      {/* Project info header */}
      <div className="flex flex-col gap-3">
        <div className="flex items-start justify-between gap-2">
          <EditableTitle
            title={project?.title || ''}
            onSave={async (newTitle) => {
              await updateProjectMutation.mutateAsync({ title: newTitle });
            }}
            className="flex-1"
          />
          <div className="flex gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  size="sm"
                  variant="secondary"
                  className="text-xs sm:text-sm"
                >
                  <Download className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                  <span className="hidden sm:inline">Export</span>
                  <span className="sm:hidden">Export</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                {/* <DropdownMenuItem
                  onClick={() =>
                    document.dispatchEvent(
                      new CustomEvent('cc:export:download')
                    )
                  }
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download video
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() =>
                    document.dispatchEvent(new CustomEvent('cc:export:video'))
                  }
                >
                  <VideoIcon className="h-4 w-4 mr-2" />
                  Export video
                </DropdownMenuItem> */}
                <DropdownMenuItem
                  className="cursor-pointer"
                  onClick={() =>
                    document.dispatchEvent(new CustomEvent('cc:export:text'))
                  }
                >
                  <FileText className="h-4 w-4 mr-2" />
                  Text
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="cursor-pointer"
                  onClick={() =>
                    document.dispatchEvent(new CustomEvent('cc:export:srt'))
                  }
                >
                  <FileCode className="h-4 w-4 mr-2" />
                  SRT
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="cursor-pointer"
                  onClick={() =>
                    document.dispatchEvent(new CustomEvent('cc:export:vtt'))
                  }
                >
                  <File className="h-4 w-4 mr-2" />
                  VTT
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  size="sm"
                  variant="destructive"
                  className="text-xs sm:text-sm"
                  disabled={isDeleting}
                >
                  {isDeleting ? (
                    <>
                      <div className="animate-spin w-3 h-3 sm:w-4 sm:h-4 border-2 border-current border-t-transparent rounded-full mr-1 sm:mr-2" />
                      <span className="hidden sm:inline">Deleting...</span>
                      <span className="sm:hidden">Deleting...</span>
                    </>
                  ) : (
                    <>
                      <Trash2 className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                      <span className="hidden sm:inline">Delete</span>
                      <span className="sm:hidden">Delete</span>
                    </>
                  )}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Project</AlertDialogTitle>
                  <AlertDialogDescription>
                    This action will permanently delete this project and all its
                    files. This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDeleteProject}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Yes, Delete Project
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>

        <EditableDescription
          description={project?.description || ''}
          onSave={async (newDesc) => {
            await updateProjectMutation.mutateAsync({ description: newDesc });
          }}
        />
      </div>

      {/* Desktop grid: left editor, right translations + settings */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left: video + lines (stacked) */}
        <div className="lg:col-span-8 order-2 lg:order-1">
          <TranscriptionEditor
            videoSrc={project?.srcUrl!}
            transcription={data!}
            initialFontFamily={defaultFont}
            projectId={project?._id}
            projectStatus={project?.status}
            sourceLanguageName={originalLanguage?.name || originalLanguageCode}
            sourceLanguageCode={originalLanguageCode}
            onDirtyChange={setHasUnsavedChanges}
            initialExportJobId={project?.exportJobId || null}
            initialExportedUrl={project?.exportedVideoUrl || null}
          />
        </div>

        {/* Right: translations and settings */}
        <div className="relative lg:col-span-4 space-y-4 order-1 lg:order-2 ">
          <div className="lg:sticky lg:top-0 space-y-4">
            <div className="flex flex-wrap items-center gap-4 mb-4 p-4 rounded-lg border bg-card text-card-foreground shadow-sm">
              <div className="flex flex-wrap items-center gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <FileVideo className="h-4 w-4 text-muted-foreground" />
                  <span
                    className="font-medium truncate max-w-[240px]"
                    title={project?.fileName}
                  >
                    {project?.fileName}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Languages className="h-4 w-4 text-muted-foreground" />
                <span>
                  {originalLanguage?.name || originalLanguageCode || 'Unknown'}
                </span>
              </div>
              {project?.duration && (
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span>{project.duration}</span>
                </div>
              )}
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-muted-foreground" />
                <span className="capitalize">{project?.status}</span>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span>
                  {project?.createdAt
                    ? new Date(project.createdAt).toLocaleDateString()
                    : ''}
                </span>
              </div>
            </div>
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Translations</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-3">
                    {originalLanguage?.image ? (
                      <img
                        src={`/assets/flags/${originalLanguage.image}`}
                        alt={`${originalLanguage.name} flag`}
                        className="w-6 h-6 rounded-sm"
                      />
                    ) : (
                      <span className="text-xl">
                        {originalLanguage?.flag || '🏳️'}
                      </span>
                    )}
                    <div>
                      <p className="text-sm text-muted-foreground">
                        Original language
                      </p>
                      <p className="font-medium">
                        {originalLanguage?.name ||
                          originalLanguageCode ||
                          'Unknown'}
                      </p>
                    </div>
                    <div className="ml-auto flex items-center gap-2">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div>
                              <Switch
                                checked={
                                  !!visibleCodes[originalLanguageCode || '']
                                }
                                disabled={
                                  !canToggleLanguage(
                                    originalLanguageCode || '',
                                    false
                                  )
                                }
                                onCheckedChange={(v) => {
                                  const languageCode =
                                    originalLanguageCode || '';
                                  if (canToggleLanguage(languageCode, !!v)) {
                                    setVisibleCodes((prev) => ({
                                      ...prev,
                                      [languageCode]: !!v,
                                    }));
                                  }
                                }}
                              />
                            </div>
                          </TooltipTrigger>
                          {!canToggleLanguage(
                            originalLanguageCode || '',
                            false
                          ) && (
                            <TooltipContent>
                              <p>At least one language must be enabled</p>
                            </TooltipContent>
                          )}
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                  </div>

                  {Object.keys(translationLanguageNames).length > 0 && (
                    <div className="space-y-3">
                      {Object.entries(translationLanguageNames).map(
                        ([code, name]) => {
                          const lang = findLanguageByAnyCode(code);
                          return (
                            <div
                              key={code}
                              className="flex items-center gap-3 py-4"
                            >
                              {lang?.image ? (
                                <img
                                  src={`/assets/flags/${lang.image}`}
                                  alt={`${lang.name} flag`}
                                  className="w-6 h-6 rounded-sm"
                                />
                              ) : (
                                <span className="text-xl">
                                  {lang?.flag || '🌐'}
                                </span>
                              )}
                              <p className="font-medium">{name}</p>
                              <div className="ml-auto flex items-center gap-2">
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <div>
                                        <Switch
                                          checked={!!visibleCodes[code]}
                                          disabled={
                                            !canToggleLanguage(code, false)
                                          }
                                          onCheckedChange={(v) => {
                                            if (canToggleLanguage(code, !!v)) {
                                              setVisibleCodes((prev) => ({
                                                ...prev,
                                                [code]: !!v,
                                              }));
                                            }
                                          }}
                                        />
                                      </div>
                                    </TooltipTrigger>
                                    {!canToggleLanguage(code, false) && (
                                      <TooltipContent>
                                        <p>
                                          At least one language must be enabled
                                        </p>
                                      </TooltipContent>
                                    )}
                                  </Tooltip>
                                </TooltipProvider>
                              </div>
                            </div>
                          );
                        }
                      )}
                    </div>
                  )}

                  <div className="flex items-center gap-3">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setPickerOpen(true)}
                      disabled={hasUnsavedChanges}
                      title={
                        hasUnsavedChanges
                          ? 'Save changes before adding a translation'
                          : undefined
                      }
                    >
                      <span className="text-xl">🌐</span>
                      Add translation
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* External settings card for desktop */}
              {/* <RightSettings /> */}
            </div>
          </div>
        </div>
      </div>
      <ModalLanguagePicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        purpose="translation"
        disabledCodes={Array.from(
          new Set(
            (data?.segments || []).flatMap((s) =>
              Object.keys(s.translations || {})
            )
          )
        )}
        onSelect={async (language) => {
          try {
            setPickerOpen(false);
            // 3) enqueue translation
            const tgt = language.translateCode || language.code!;
            // Make sure names map includes the chosen language immediately (for pending labels)
            setExtraLangNames((prev) => ({ ...prev, [tgt]: language.name }));
            const res = await fetch(`${Env.API_URL}/translate`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({
                projectId: project?._id,
                src: originalLanguageCode,
                tgt,
                // forceFresh: true,
              }),
            });
            const { jobId } = await res.json();
            setActiveJobId(jobId);
            // Mark all lines as pending for selected target
            setData((prev) => {
              if (!prev) return prev;
              const segs = prev.segments.map((s) => ({
                ...s,
                pending: { ...(s.pending || {}), [tgt]: true },
              }));
              return { ...prev, segments: segs };
            });
            // 4) open SSE stream (proxied) and update lines live
            const es = new EventSource(
              `/api/common/forward-stream?url=/translate/stream&jobId=${jobId}`
            );
            es.addEventListener('segment', (ev) => {
              const payload = JSON.parse((ev as MessageEvent).data) as {
                id: number;
                text: string;
              };
              setData((prev) => {
                if (!prev) return prev;
                const segs = [...prev.segments];
                const tgt = language.translateCode || language.code!;
                const trans = { ...(segs[payload.id].translations || {}) };
                trans[tgt] = payload.text;
                const pending = { ...(segs[payload.id].pending || {}) };
                delete pending[tgt];
                segs[payload.id] = {
                  ...segs[payload.id],
                  translations: trans,
                  pending,
                } as any;
                // }
                return { ...prev, segments: segs };
              });
            });
            es.addEventListener('done', () => {
              // Ensure any remaining pending flags for this target are cleared
              const tgt = language.translateCode || language.code!;
              setData((prev) => {
                if (!prev) return prev;
                const segs = prev.segments.map((s) => {
                  if (!s.pending || !s.pending[tgt]) return s;
                  const nextPending = { ...(s.pending || {}) };
                  delete nextPending[tgt];
                  return { ...s, pending: nextPending } as any;
                });
                return { ...prev, segments: segs };
              });
              es.close();
              setActiveJobId(null);
            });
          } catch (e) {
            console.error(e);
          }
        }}
      />
    </div>
  );
}

// Local component to render settings bound to the shared store
function RightSettings() {
  const {
    color1,
    color2,
    fontFamily,
    subtitleScale,
    subtitlePosition,
    subtitleBackground,
    subtitleOutline,
    setColor1,
    setColor2,
    setFontFamily,
    setSubtitleScale,
    setSubtitlePosition,
    setSubtitleBackground,
    setSubtitleOutline,
  } = useVideoSettingsStore();
  return (
    <Card className="hidden lg:block">
      <CardHeader>
        <CardTitle>Subtitle Settings</CardTitle>
      </CardHeader>
      <CardContent>
        <SettingsContent
          color1={color1}
          setColor1={setColor1}
          color2={color2}
          setColor2={setColor2}
          fontFamily={fontFamily}
          setFontFamily={setFontFamily}
          subtitleScale={subtitleScale}
          setSubtitleScale={setSubtitleScale}
          subtitlePosition={subtitlePosition}
          setSubtitlePosition={setSubtitlePosition}
          subtitleBackground={subtitleBackground}
          setSubtitleBackground={setSubtitleBackground}
          subtitleOutline={subtitleOutline}
          setSubtitleOutline={setSubtitleOutline}
        />
      </CardContent>
    </Card>
  );
}
