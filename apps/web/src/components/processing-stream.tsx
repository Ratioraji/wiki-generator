'use client';

import { useEffect, useRef } from 'react';
import { useSSEStream } from '@/hooks/use-sse-stream';

const PHASES = [
  'ingestion',
  'grouping',
  'classification',
  'analysis',
  'assembly',
] as const;
type Phase = (typeof PHASES)[number];

interface ProcessingStreamProps {
  repoUrl: string;
  branch: string;
  forceRegenerate?: boolean;
  onWikiReady: (wikiId: string) => void;
}

function formatElapsed(startMs: number, eventMs: number): string {
  const totalSecs = Math.floor((eventMs - startMs) / 1000);
  const m = Math.floor(totalSecs / 60)
    .toString()
    .padStart(2, '0');
  const s = (totalSecs % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

export function ProcessingStream({
  repoUrl,
  branch,
  forceRegenerate = false,
  onWikiReady,
}: ProcessingStreamProps) {
  const { status, events, currentPhase, progress, wikiId, error, start, cancel } =
    useSSEStream({ repoUrl, branch, forceRegenerate });

  // Auto-start on mount
  useEffect(() => {
    start();
    return () => cancel();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Navigate when wiki is ready
  useEffect(() => {
    if (wikiId) onWikiReady(wikiId);
  }, [wikiId, onWikiReady]);

  // Auto-scroll event log to bottom
  const logRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [events]);

  // Timestamp tracking for event log
  const startTimeRef = useRef<number>(0);
  const eventTimesRef = useRef<number[]>([]);
  if (events.length > 0 && eventTimesRef.current.length === 0) {
    startTimeRef.current = Date.now();
  }
  while (eventTimesRef.current.length < events.length) {
    eventTimesRef.current.push(Date.now());
  }

  // Derive which phases are complete
  const phaseIndex = currentPhase
    ? PHASES.indexOf(currentPhase as Phase)
    : -1;
  const phasesComplete: Set<Phase> =
    status === 'complete'
      ? new Set(PHASES)
      : new Set(phaseIndex > 0 ? (PHASES.slice(0, phaseIndex) as Phase[]) : []);

  // Subsystem tracking during analysis
  const subsystemsInOrder: string[] = [];
  for (const e of events) {
    if (e.phase === 'analysis' && e.subsystem) {
      if (!subsystemsInOrder.includes(e.subsystem)) {
        subsystemsInOrder.push(e.subsystem);
      }
    }
  }
  const activeSubsystem =
    currentPhase === 'analysis' && subsystemsInOrder.length > 0
      ? subsystemsInOrder[subsystemsInOrder.length - 1]
      : null;

  const latestMessage =
    events.length > 0
      ? (events[events.length - 1].message ?? '')
      : status === 'connecting'
        ? 'Connecting to pipeline...'
        : 'Waiting...';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Pipeline phase indicator */}
      <div
        style={{
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border-default)',
          padding: '20px',
        }}
      >
        <div
          style={{
            fontSize: '10px',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.12em',
            color: 'var(--text-secondary)',
            marginBottom: '16px',
          }}
        >
          Pipeline
        </div>

        {/* Phase steps */}
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '0',
            flexWrap: 'wrap',
          }}
        >
          {PHASES.map((phase, i) => {
            const isComplete = phasesComplete.has(phase);
            const isActive = currentPhase === phase;
            const isPending = !isComplete && !isActive;

            return (
              <div
                key={phase}
                style={{ display: 'flex', alignItems: 'flex-start' }}
              >
                {/* Phase block */}
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '6px',
                    minWidth: '80px',
                  }}
                >
                  <span
                    className={isActive ? 'phase-active' : ''}
                    style={{
                      fontSize: '14px',
                      fontFamily: 'inherit',
                      color: isPending ? 'var(--text-muted)' : 'var(--accent)',
                    }}
                  >
                    {isComplete ? '[■]' : isActive ? '[▪]' : '[ ]'}
                  </span>
                  <span
                    style={{
                      fontSize: '10px',
                      fontWeight: 600,
                      textTransform: 'uppercase',
                      letterSpacing: '0.12em',
                      color: isPending
                        ? 'var(--text-muted)'
                        : isActive
                          ? 'var(--text-accent)'
                          : 'var(--text-secondary)',
                      textAlign: 'center',
                    }}
                  >
                    {phase}
                  </span>
                </div>

                {/* Connector arrow (not after last) */}
                {i < PHASES.length - 1 && (
                  <span
                    style={{
                      fontSize: '12px',
                      color: 'var(--text-muted)',
                      marginTop: '2px',
                      padding: '0 4px',
                    }}
                  >
                    →
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* Progress bar */}
        <div
          style={{
            marginTop: '20px',
            height: '4px',
            backgroundColor: 'var(--bar-ghost)',
          }}
        >
          <div
            style={{
              height: '100%',
              width: `${Math.min(100, progress)}%`,
              backgroundColor: 'var(--bar-primary)',
              transition: 'width 0.5s ease-out',
            }}
          />
        </div>

        {/* Progress label */}
        <div
          style={{
            marginTop: '8px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span
            style={{
              fontSize: '13px',
              color: 'var(--text-primary)',
              fontFamily: 'inherit',
            }}
          >
            {latestMessage}
          </span>
          <span
            style={{
              fontSize: '12px',
              fontWeight: 700,
              color: 'var(--text-accent)',
            }}
          >
            {Math.round(progress)}%
          </span>
        </div>

        {/* Subsystem list during analysis */}
        {subsystemsInOrder.length > 0 && (
          <div
            style={{
              marginTop: '16px',
              borderTop: '1px solid var(--border-subtle)',
              paddingTop: '12px',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
            }}
          >
            <div
              style={{
                fontSize: '10px',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.12em',
                color: 'var(--text-secondary)',
                marginBottom: '4px',
              }}
            >
              Subsystems
            </div>
            {subsystemsInOrder.map((name) => {
              const isDone = name !== activeSubsystem || status === 'complete';
              return (
                <div
                  key={name}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                >
                  <span
                    className={!isDone ? 'phase-active' : ''}
                    style={{
                      fontSize: '12px',
                      color: isDone ? 'var(--accent)' : 'var(--accent)',
                    }}
                  >
                    {isDone ? '●' : '◷'}
                  </span>
                  <span
                    style={{
                      fontSize: '12px',
                      color: isDone
                        ? 'var(--text-secondary)'
                        : 'var(--text-primary)',
                    }}
                  >
                    {name}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Event log — terminal style */}
      <div
        style={{
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border-default)',
        }}
      >
        <div
          style={{
            padding: '10px 12px',
            borderBottom: '1px solid var(--border-default)',
            fontSize: '10px',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.12em',
            color: 'var(--text-secondary)',
          }}
        >
          Event Log
        </div>

        <div
          ref={logRef}
          style={{
            backgroundColor: 'var(--bg-primary)',
            padding: '12px',
            maxHeight: '400px',
            overflowY: 'scroll',
            fontFamily: 'inherit',
          }}
        >
          {events.length === 0 && (
            <div
              style={{
                fontSize: '12px',
                color: 'var(--text-muted)',
                fontStyle: 'italic',
              }}
            >
              Waiting for events...
            </div>
          )}

          {events.map((event, i) => {
            const elapsed =
              eventTimesRef.current[i] !== undefined
                ? formatElapsed(startTimeRef.current, eventTimesRef.current[i])
                : '00:00';
            const isPhaseLabel =
              event.type === 'status' && Boolean(event.phase);
            const message = event.message ?? event.type;

            return (
              <div
                key={i}
                className="event-line"
                style={{
                  display: 'flex',
                  gap: '12px',
                  marginBottom: '3px',
                  lineHeight: 1.5,
                }}
              >
                <span
                  style={{
                    fontSize: '11px',
                    color: 'var(--text-muted)',
                    flexShrink: 0,
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {elapsed}
                </span>
                <span
                  style={{
                    fontSize: '12px',
                    color: isPhaseLabel
                      ? 'var(--text-accent)'
                      : 'var(--text-primary)',
                    textTransform: isPhaseLabel ? 'uppercase' : 'none',
                    letterSpacing: isPhaseLabel ? '0.06em' : 'normal',
                    wordBreak: 'break-word',
                  }}
                >
                  {message}
                </span>
              </div>
            );
          })}

          {/* Blinking cursor when active */}
          {(status === 'connecting' || status === 'processing') && (
            <span
              className="phase-active"
              style={{ fontSize: '12px', color: 'var(--accent)' }}
            >
              _
            </span>
          )}
        </div>
      </div>

      {/* Error state */}
      {status === 'error' && error && (
        <div
          style={{
            backgroundColor: 'rgba(139, 58, 58, 0.1)',
            border: '1px solid #8b3a3a',
            padding: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '16px',
          }}
        >
          <div>
            <div
              style={{
                fontSize: '10px',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.12em',
                color: '#8b3a3a',
                marginBottom: '4px',
              }}
            >
              ✗ Pipeline Failed
            </div>
            <div
              style={{
                fontSize: '12px',
                color: 'var(--text-secondary)',
                wordBreak: 'break-word',
              }}
            >
              {error}
            </div>
          </div>

          <button
            onClick={() => start()}
            style={{
              backgroundColor: 'transparent',
              border: '1px solid var(--border-default)',
              color: 'var(--text-secondary)',
              fontFamily: 'inherit',
              fontSize: '11px',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              padding: '8px 16px',
              cursor: 'pointer',
              flexShrink: 0,
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'var(--accent)';
              e.currentTarget.style.color = 'var(--text-primary)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'var(--border-default)';
              e.currentTarget.style.color = 'var(--text-secondary)';
            }}
          >
            Retry
          </button>
        </div>
      )}
    </div>
  );
}
