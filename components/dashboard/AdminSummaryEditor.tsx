import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, useWindowDimensions } from 'react-native';
import { neutral, accent, glass } from '@/theme/colors';
import { spacing, radius } from '@/theme/spacing';
import { font } from '@/theme/typography';
import { breakpoints } from '@/theme/breakpoints';

/**
 * AdminSummaryEditor
 * -------------------
 * Admin-only inline editor for a single post's AI summary, shown on each post
 * card when the viewer is an admin.
 *
 * Layout:
 *   - Desktop/tablet: field ~90% width, with the Save (✓) and Cancel (✕)
 *     buttons stacked in the ~10% column beside it.
 *   - Mobile: field full width, Save / Cancel stacked below.
 *
 * Shortcuts: Cmd+Enter / Ctrl+Enter saves.
 *
 * The control absorbs taps so they don't reach the parent post card (which
 * would open the video). Render gating is the parent's job; the write route
 * re-checks admin status server-side.
 *
 * One job: edit and persist one post summary.
 */

interface Props {
  postId: string;
  value:  string;
  /** Called with the saved summary so the card can update its displayed text. */
  onSaved: (summary: string) => void;
}

export function AdminSummaryEditor({ postId, value, onSaved }: Props) {
  const { width }   = useWindowDimensions();
  const wide        = width >= breakpoints.tablet;

  const [editing,   setEditing]   = useState(false);
  const [draft,     setDraft]     = useState(value);
  const [saving,    setSaving]    = useState(false);
  const [error,     setError]     = useState<string | null>(null);
  const [justSaved, setJustSaved] = useState(false);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savingRef  = useRef(false);

  useEffect(() => () => { if (savedTimer.current) clearTimeout(savedTimer.current); }, []);

  const open   = () => { setDraft(value); setError(null); setEditing(true); };
  const cancel = () => { setEditing(false); setError(null); };

  const save = async () => {
    if (savingRef.current) return;
    const next = draft.trim();
    if (!next) { setError('Summary cannot be empty'); return; }

    savingRef.current = true;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/post-summary', {
        method:      'POST',
        headers:     { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body:        JSON.stringify({ postId, summary: next }),
      });
      const data = (await res.json().catch(() => ({}))) as { summary?: string; error?: string };
      if (!res.ok) { setError(data.error ?? 'Save failed'); return; }
      onSaved(data.summary ?? next);
      setEditing(false);
      setJustSaved(true);
      if (savedTimer.current) clearTimeout(savedTimer.current);
      savedTimer.current = setTimeout(() => setJustSaved(false), 2000);
    } catch {
      setError('Network error — not saved');
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const swallow = (e: { stopPropagation?: () => void }) => { e.stopPropagation?.(); };

  // Cmd+Enter / Ctrl+Enter to save (web).
  const handleKey = (e: any) => {
    const ne   = e?.nativeEvent ?? {};
    const key  = ne.key ?? e?.key;
    const meta = ne.metaKey ?? e?.metaKey;
    const ctrl = ne.ctrlKey ?? e?.ctrlKey;
    if (key === 'Enter' && (meta || ctrl)) {
      e?.preventDefault?.();
      save();
    }
  };

  if (!editing) {
    return (
      <Pressable
        onPress={(e) => { swallow(e); open(); }}
        style={({ pressed }) => [styles.editBtn, pressed && { opacity: 0.7 }]}
      >
        <Text style={[styles.editBtnText, justSaved && styles.savedText]}>
          {justSaved ? '✓  Saved' : '✎  Edit summary'}
        </Text>
      </Pressable>
    );
  }

  const field = (
    <TextInput
      value={draft}
      onChangeText={setDraft}
      onKeyPress={handleKey}
      multiline
      editable={!saving}
      placeholder="Post summary…"
      placeholderTextColor={neutral.textMid}
      style={[styles.input, wide ? styles.inputWide : styles.inputFull]}
    />
  );

  const saveBtn = (extra?: object) => (
    <Pressable
      onPress={(e) => { swallow(e); save(); }}
      disabled={saving}
      style={({ pressed }) => [styles.saveBtn, extra, (pressed || saving) && { opacity: 0.8 }]}
    >
      <Text style={styles.saveIcon}>{saving ? '…' : '✓'}</Text>
      {!wide ? <Text style={styles.saveLabel}>{saving ? 'Saving…' : 'Save'}</Text> : null}
    </Pressable>
  );

  const cancelBtn = (extra?: object) => (
    <Pressable
      onPress={(e) => { swallow(e); cancel(); }}
      disabled={saving}
      style={({ pressed }) => [styles.cancelBtn, extra, pressed && { opacity: 0.6 }]}
    >
      <Text style={styles.cancelIcon}>✕</Text>
      {!wide ? <Text style={styles.cancelLabel}>Cancel</Text> : null}
    </Pressable>
  );

  return (
    <Pressable onPress={swallow} style={styles.wrap}>
      {wide ? (
        <View style={styles.row}>
          {field}
          <View style={styles.sideActions}>
            {saveBtn({ flex: 1 })}
            {cancelBtn({ flex: 1 })}
          </View>
        </View>
      ) : (
        <>
          {field}
          <View style={styles.stackActions}>
            {cancelBtn()}
            {saveBtn({ flex: 1 })}
          </View>
        </>
      )}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {wide ? <Text style={styles.hint}>⌘/Ctrl + Enter to save</Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  editBtn: {
    alignSelf: 'flex-start',
    marginTop: spacing.xs,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  editBtnText: { fontFamily: font.bold, fontSize: 13, color: accent.indigo },
  savedText:   { color: accent.mint },

  wrap: { marginTop: spacing.sm, gap: spacing.xs },

  // Desktop: field + side column
  row: { flexDirection: 'row', alignItems: 'stretch', gap: spacing.sm },
  sideActions: { flex: 1, flexDirection: 'column', gap: spacing.sm },

  input: {
    textAlignVertical: 'top',
    fontFamily: font.ui,
    fontSize: 14,
    lineHeight: 20,
    color: neutral.text,
    backgroundColor: glass.fill,
    borderWidth: 1,
    borderColor: accent.indigo,
    borderRadius: radius.sm,
    padding: spacing.sm,
    minHeight: 110,
  },
  inputWide: { flex: 9 },   // ~90% of the row
  inputFull: { alignSelf: 'stretch' },

  // Mobile stacked actions
  stackActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },

  saveBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: spacing.xs,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.base,
    borderRadius: radius.sm,
    backgroundColor: accent.indigo,
  },
  saveIcon:  { fontFamily: font.bold, fontSize: 18, color: neutral.text },
  saveLabel: { fontFamily: font.bold, fontSize: 14, color: neutral.text },

  cancelBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: spacing.xs,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.base,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: glass.border,
  },
  cancelIcon:  { fontFamily: font.bold, fontSize: 16, color: neutral.textMid },
  cancelLabel: { fontFamily: font.bold, fontSize: 14, color: neutral.textMid },

  error: { fontFamily: font.ui, fontSize: 12, color: accent.mint },
  hint:  { fontFamily: font.ui, fontSize: 11, color: neutral.textMid },
});
