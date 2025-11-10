'use client';

import React from 'react';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { UploadProgress } from '@/types/upload';

interface ProcessingStep {
  id: string;
  label: string;
  status: 'pending' | 'in-progress' | 'completed' | 'error';
  progress?: number;
  uploadProgress?: UploadProgress;
}

interface ProjectProcessingOverlayProps {
  steps: ProcessingStep[];
  currentStepId: string;
  projectTitle: string;
}

const ProjectProcessingOverlay: React.FC<ProjectProcessingOverlayProps> = ({
  steps,
  currentStepId,
  projectTitle,
}) => {
  const formatBytes = (bytes: number): string => {
    if (!Number.isFinite(bytes)) return '0 B';
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    const value = bytes / Math.pow(1024, i);
    return `${value.toFixed(value >= 100 ? 0 : value >= 10 ? 1 : 2)} ${
      sizes[i]
    }`;
  };

  const formatTime = (seconds: number): string => {
    if (!Number.isFinite(seconds) || seconds < 0) return '--:--';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const currentStep = steps.find((s) => s.id === currentStepId);

  return (
    <div className="fixed inset-0 bg-background flex items-center justify-center p-6 z-[99999]">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-3xl font-bold mb-2">Creating Your Project</h1>
        </div>

        {/* Steps */}
        <div className="space-y-6">
          {steps.map((step, index) => {
            const isActive = step.id === currentStepId;
            const isPending = step.status === 'pending';
            const isCompleted = step.status === 'completed';
            const isInProgress = step.status === 'in-progress';

            return (
              <div
                key={step.id}
                className={`relative transition-all duration-500 ${
                  isActive
                    ? 'scale-100 opacity-100'
                    : isPending
                    ? 'scale-95 opacity-40'
                    : 'scale-95 opacity-60'
                }`}
              >
                <div
                  className={`rounded-2xl border-2 p-6 transition-all duration-500 ${
                    isCompleted
                      ? 'bg-green-500/5 border-green-500/20'
                      : isInProgress
                      ? 'bg-primary/5 border-primary/20 shadow-lg shadow-primary/10'
                      : 'bg-muted/20 border-muted'
                  }`}
                >
                  <div className="flex items-center gap-4 mb-4">
                    {/* Step Icon */}
                    <div
                      className={`flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center transition-all duration-500 ${
                        isCompleted
                          ? 'bg-green-500 text-white scale-110'
                          : isInProgress
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      {isCompleted ? (
                        <CheckCircle2 className="w-6 h-6" />
                      ) : (
                        <span className="text-lg font-bold">{index + 1}</span>
                      )}
                    </div>

                    {/* Step Label */}
                    <div className="flex-1">
                      <h3
                        className={`text-xl font-semibold transition-colors duration-300 ${
                          isCompleted
                            ? 'text-green-600 dark:text-green-400'
                            : isInProgress
                            ? 'text-foreground'
                            : 'text-muted-foreground'
                        }`}
                      >
                        {step.label}
                      </h3>
                      {isCompleted && (
                        <p className="text-sm text-green-600 dark:text-green-400 mt-1">
                          Completed
                        </p>
                      )}
                    </div>

                    {/* Status Indicator */}
                    {isInProgress && (
                      <div className="flex-shrink-0">
                        <Loader2 className="w-6 h-6 text-primary animate-spin" />
                      </div>
                    )}
                  </div>

                  {/* Progress Bar - Single progress indicator */}
                  {isInProgress &&
                    (step.uploadProgress ||
                      typeof step.progress === 'number') && (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">
                            Progress
                          </span>
                          <span className="font-semibold text-primary">
                            {step.uploadProgress
                              ? `${step.uploadProgress.progress}%`
                              : `${step.progress ?? 0}%`}
                          </span>
                        </div>
                        <div className="relative h-3 bg-primary/10 rounded-full overflow-hidden">
                          <div
                            className="absolute inset-y-0 left-0 bg-gradient-to-r from-primary to-primary/80 rounded-full transition-all duration-300 ease-out"
                            style={{
                              width: `${
                                step.uploadProgress?.progress ??
                                step.progress ??
                                0
                              }%`,
                            }}
                          >
                            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer" />
                          </div>
                        </div>

                        {/* Upload Details - Only show if we have upload progress */}
                        {step.uploadProgress && (
                          <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
                            <span>
                              {formatBytes(step.uploadProgress.uploadedBytes)} /{' '}
                              {formatBytes(step.uploadProgress.totalBytes)}
                            </span>
                            <span>
                              {step.uploadProgress.estimatedTimeRemaining
                                ? `${formatTime(
                                    step.uploadProgress.estimatedTimeRemaining
                                  )} remaining`
                                : 'Calculating...'}
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer Message */}
        <div className="text-center mt-12">
          <p className="text-sm text-muted-foreground">
            Please don't close this window. This process may take a few minutes.
          </p>
        </div>
      </div>
    </div>
  );
};

export default ProjectProcessingOverlay;
