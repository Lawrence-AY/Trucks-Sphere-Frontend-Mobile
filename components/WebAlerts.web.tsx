import React, { useEffect, useRef, useSyncExternalStore } from 'react';
import { useTheme } from '../hooks/useTheme';
import {
  dismissWebAlert, enqueueWebAlert, getServerWebAlert, getWebAlert,
  selectWebAlertButton, subscribeWebAlerts,
} from '../utils/webAlertQueue';
import type { AlertPayload } from '../utils/webAlert';

/** A top-layer dialog stays above open forms and traps keyboard focus. */
export default function WebAlerts() {
  const alert = useSyncExternalStore(subscribeWebAlerts, getWebAlert, getServerWebAlert);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const colors = useTheme();

  useEffect(() => {
    const handleAlert = (event: Event) => {
      const payload = (event as CustomEvent<AlertPayload>).detail;
      if (payload?.title || payload?.message) enqueueWebAlert(payload.title || '', payload.message);
    };
    window.addEventListener('trucksphere:alert', handleAlert);
    return () => window.removeEventListener('trucksphere:alert', handleAlert);
  }, []);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog || !alert) return;
    dialog.showModal();
    return () => { dialog.close(); };
  }, [alert?.id]);

  if (!alert) return null;
  const cancelIndex = alert.buttons.findIndex((button) => button.style === 'cancel');
  const focusIndex = cancelIndex >= 0 ? cancelIndex : Math.max(0, alert.buttons.findIndex((button) => button.isPreferred));

  return (
    <dialog
      key={alert.id}
      ref={dialogRef}
      className="trucksphere-alert"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="trucksphere-alert-title"
      aria-describedby="trucksphere-alert-message"
      onCancel={(event) => { event.preventDefault(); dismissWebAlert(alert.id, true); }}
      onClick={(event) => { if (event.target === event.currentTarget) dismissWebAlert(alert.id); }}
      style={{ padding: 0, border: `1px solid ${colors.border}`, borderRadius: 16, width: 'min(440px, calc(100vw - 32px))', maxHeight: 'calc(100dvh - 48px)', background: colors.surface, color: colors.text, boxShadow: '0 24px 80px #0005', fontFamily: 'inherit' }}
    >
      <style>{`.trucksphere-alert::backdrop { background: rgba(15,23,42,.48); }
        .trucksphere-alert button:focus-visible { outline: 3px solid #60a5fa; outline-offset: 3px; }
        .trucksphere-alert button:hover { filter: brightness(.95); }`}</style>
      <div style={{ padding: 24 }}>
        <h2 id="trucksphere-alert-title" style={{ margin: 0, fontSize: 20, lineHeight: 1.4 }}>{alert.title}</h2>
        <p id="trucksphere-alert-message" style={{ margin: '12px 0 24px', fontSize: 15, lineHeight: 1.6, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', color: colors.textSecondary }}>{alert.message}</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 10 }}>
          {alert.buttons.map((button, index) => (
            <button
              key={index}
              type="button"
              autoFocus={index === focusIndex}
              onClick={() => selectWebAlertButton(alert.id, index)}
              style={{ minHeight: 44, padding: '10px 18px', borderRadius: 8, border: `1px solid ${colors.border}`, font: 'inherit', fontWeight: 600, cursor: 'pointer', background: button.style === 'cancel' ? colors.surface : button.style === 'destructive' ? '#DC2626' : colors.primary, color: button.style === 'cancel' ? colors.text : '#FFFFFF' }}
            >{button.text || 'OK'}</button>
          ))}
        </div>
      </div>
    </dialog>
  );
}
