/**
 * app/admin/index.tsx
 * --------------------
 * Admin panel — manage tracked profiles, account types, and bulk import.
 * Access is enforced SERVER-SIDE: every /api/admin/* route requires a valid
 * Firebase session whose email is on the ADMIN_EMAILS allowlist
 * (lib/adminAuth.ts). A 403 from the first data fetch renders the
 * not-authorised gate instead of the panel.
 * Web-only — never rendered on native.
 */

import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  Pressable,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { useRouter } from 'expo-router';
import { neutral, knox } from '@/theme/colors';
import { spacing } from '@/theme/spacing';

// ── Types ─────────────────────────────────────────────────────────────────────

interface AccountType {
  id:   number;
  name: string;
}

interface AdminAccount {
  id:               string;
  name:             string | null;
  profile:          string | null;
  party:            string | null;
  affiliation:      string | null;
  avatar:           string | null;
  displayName:      string | null;
  displayJobTitle:  string | null;
  isActive:         boolean | null;
  accountTypeIds:   string | null;
  accountTypeNames: string | null;
}

interface EditState {
  name:           string;
  displayName:    string;
  displayJobTitle: string;
  party:          string;
  affiliation:    string;
  accountTypeIds: number[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseIds(csv: string | null): number[] {
  if (!csv) return [];
  return csv.split(',').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n));
}

function toEditState(a: AdminAccount): EditState {
  return {
    name:            a.name            ?? '',
    displayName:     a.displayName     ?? '',
    displayJobTitle: a.displayJobTitle ?? '',
    party:           a.party           ?? '',
    affiliation:     a.affiliation     ?? '',
    accountTypeIds:  parseIds(a.accountTypeIds),
  };
}

/** Parse pasted CSV into row objects. First line must be headers. */
function parseCSV(raw: string): Array<Record<string, string>> {
  const lines = raw.trim().split('\n').filter(l => l.trim());
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map(h => h.trim());
  return lines.slice(1).map(line => {
    const vals = line.split(',').map(v => v.trim());
    return Object.fromEntries(headers.map((h, i) => [h, vals[i] ?? '']));
  });
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function AdminPanel() {
  const router = useRouter();

  // Accounts
  const [accounts,     setAccounts]     = useState<AdminAccount[]>([]);
  const [accountTypes, setAccountTypes] = useState<AccountType[]>([]);
  const [loadingData,  setLoadingData]  = useState(true);
  const [error,        setError]        = useState<string | null>(null);
  const [forbidden,    setForbidden]    = useState(false);
  const [showInactive, setShowInactive] = useState(false);
  const [filterType,   setFilterType]   = useState<string | null>(null);
  const [searchQuery,  setSearchQuery]  = useState('');
  const [sortCol,      setSortCol]      = useState<string>('name');
  const [sortDir,      setSortDir]      = useState<'asc' | 'desc'>('asc');

  // Row editing
  const [editingId,  setEditingId]  = useState<string | null>(null);
  const [editState,  setEditState]  = useState<EditState | null>(null);
  const [saving,     setSaving]     = useState(false);
  const [saveError,  setSaveError]  = useState<string | null>(null);

  // Add-profile form
  const [showAddForm, setShowAddForm] = useState(false);
  const [addForm,     setAddForm]     = useState({
    profile: '', name: '', displayName: '', displayJobTitle: '',
    party: '', affiliation: '', accountTypeIds: [] as number[],
  });
  const [addSaving,  setAddSaving]  = useState(false);
  const [addError,   setAddError]   = useState<string | null>(null);
  const [addSuccess, setAddSuccess] = useState<string | null>(null);

  // CSV import
  const [showCsv,      setShowCsv]      = useState(false);
  const [csvText,      setCsvText]      = useState('');
  const [csvParsed,    setCsvParsed]    = useState<Array<Record<string, string>>>([]);
  const [csvImporting, setCsvImporting] = useState(false);
  const [csvProgress,  setCsvProgress]  = useState<string | null>(null);
  const [csvError,     setCsvError]     = useState<string | null>(null);

  // Account type management
  const [showTypes,     setShowTypes]     = useState(false);
  const [newTypeName,   setNewTypeName]   = useState('');
  const [renamingId,    setRenamingId]    = useState<number | null>(null);
  const [renameVal,     setRenameVal]     = useState('');
  const [typesSaving,   setTypesSaving]   = useState(false);
  const [typesError,    setTypesError]    = useState<string | null>(null);

  // ── Data fetch ──────────────────────────────────────────────────────────────

  const fetchData = useCallback(async () => {
    setLoadingData(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/accounts', { credentials: 'same-origin' });
      if (res.status === 403) {
        // Server-side admin check failed (no session, or email not on
        // ADMIN_EMAILS) — show the clean not-authorised screen, not the panel.
        setForbidden(true);
        return;
      }
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      const data: { accounts: AdminAccount[]; accountTypes: AccountType[] } = await res.json();
      setAccounts(data.accounts ?? []);
      setAccountTypes(data.accountTypes ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoadingData(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ── Row edit handlers ───────────────────────────────────────────────────────

  function startEdit(account: AdminAccount) {
    setEditingId(account.id);
    setEditState(toEditState(account));
    setSaveError(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditState(null);
    setSaveError(null);
  }

  async function saveEdit(id: string) {
    if (!editState) return;
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch(`/api/admin/accounts/${encodeURIComponent(id)}`, {
        method:      'PATCH',
        credentials: 'same-origin',
        headers:     { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name:            editState.name            || null,
          displayName:     editState.displayName     || null,
          displayJobTitle: editState.displayJobTitle || null,
          party:           editState.party           || null,
          affiliation:     editState.affiliation     || null,
          accountTypeIds:  editState.accountTypeIds,
        }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? `HTTP ${res.status}`);
      setAccounts(prev => prev.map(a => {
        if (a.id !== id) return a;
        return {
          ...a,
          name:             editState.name            || null,
          displayName:      editState.displayName     || null,
          displayJobTitle:  editState.displayJobTitle || null,
          party:            editState.party           || null,
          affiliation:      editState.affiliation     || null,
          accountTypeIds:   editState.accountTypeIds.join(',') || null,
          accountTypeNames: editState.accountTypeIds
            .map(tid => accountTypes.find(t => t.id === tid)?.name ?? '')
            .filter(Boolean).join(',') || null,
        };
      }));
      setEditingId(null);
      setEditState(null);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(account: AdminAccount) {
    const next = !(account.isActive ?? true);
    try {
      const res = await fetch(`/api/admin/accounts/${encodeURIComponent(account.id)}`, {
        method:      'PATCH',
        credentials: 'same-origin',
        headers:     { 'Content-Type': 'application/json' },
        body:        JSON.stringify({ isActive: next }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? `HTTP ${res.status}`);
      setAccounts(prev => prev.map(a => a.id === account.id ? { ...a, isActive: next } : a));
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to update');
    }
  }

  function toggleType(typeId: number) {
    setEditState(prev => {
      if (!prev) return prev;
      const has = prev.accountTypeIds.includes(typeId);
      return { ...prev, accountTypeIds: has ? prev.accountTypeIds.filter(id => id !== typeId) : [...prev.accountTypeIds, typeId] };
    });
  }

  // ── Add-profile handlers ────────────────────────────────────────────────────

  function toggleAddType(typeId: number) {
    setAddForm(prev => {
      const has = prev.accountTypeIds.includes(typeId);
      return { ...prev, accountTypeIds: has ? prev.accountTypeIds.filter(id => id !== typeId) : [...prev.accountTypeIds, typeId] };
    });
  }

  async function submitAddForm() {
    if (!addForm.name.trim() || !addForm.profile.trim()) {
      setAddError('Name and profile handle are required');
      return;
    }
    setAddSaving(true);
    setAddError(null);
    setAddSuccess(null);
    try {
      const res = await fetch('/api/admin/accounts', {
        method:      'POST',
        credentials: 'same-origin',
        headers:     { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name:            addForm.name.trim()            || null,
          profile:         addForm.profile.trim(),
          displayName:     addForm.displayName.trim()     || null,
          displayJobTitle: addForm.displayJobTitle.trim() || null,
          party:           addForm.party.trim()           || null,
          affiliation:     addForm.affiliation.trim()     || null,
          accountTypeIds:  addForm.accountTypeIds,
        }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? `HTTP ${res.status}`);
      setAddSuccess(`@${addForm.profile.replace(/^@/, '')} added — N8N webhook fired.`);
      setAddForm({ profile: '', name: '', displayName: '', displayJobTitle: '', party: '', affiliation: '', accountTypeIds: [] });
      setShowAddForm(false);
      fetchData();
    } catch (err) {
      setAddError(err instanceof Error ? err.message : 'Failed to add profile');
    } finally {
      setAddSaving(false);
    }
  }

  // ── CSV import handlers ─────────────────────────────────────────────────────

  function previewCsv() {
    setCsvError(null);
    const rows = parseCSV(csvText);
    if (!rows.length) { setCsvError('No rows parsed — check your CSV format'); return; }
    setCsvParsed(rows);
  }

  async function importCsv() {
    if (!csvParsed.length) return;
    setCsvImporting(true);
    setCsvError(null);
    let done = 0;
    for (const row of csvParsed) {
      setCsvProgress(`Importing ${done + 1} of ${csvParsed.length}…`);
      try {
        const res = await fetch('/api/admin/accounts', {
          method:      'POST',
          credentials: 'same-origin',
          headers:     { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            profile:         row.profile?.trim()         || null,
            name:            row.name?.trim()            || null,
            displayName:     row.displayName?.trim()     || null,
            displayJobTitle: row.displayJobTitle?.trim() || null,
            party:           row.party?.trim()           || null,
            affiliation:     row.affiliation?.trim()     || null,
            accountTypeIds:  [],
          }),
        });
        if (!res.ok) {
          const b = await res.json().catch(() => ({}));
          throw new Error(`Row ${done + 1} (${row.profile}): ${b.error ?? res.status}`);
        }
      } catch (err) {
        setCsvError(err instanceof Error ? err.message : 'Import error');
        setCsvImporting(false);
        setCsvProgress(null);
        return;
      }
      done++;
    }
    setCsvProgress(`Done — ${done} profiles imported.`);
    setCsvImporting(false);
    setCsvParsed([]);
    setCsvText('');
    fetchData();
  }

  // ── Account type handlers ───────────────────────────────────────────────────

  async function addType() {
    if (!newTypeName.trim()) return;
    setTypesSaving(true);
    setTypesError(null);
    try {
      const res = await fetch('/api/admin/account-types', {
        method:      'POST',
        credentials: 'same-origin',
        headers:     { 'Content-Type': 'application/json' },
        body:        JSON.stringify({ name: newTypeName.trim() }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? `HTTP ${res.status}`);
      const data: { id: number; name: string } = await res.json();
      setAccountTypes(prev => [...prev, { id: data.id, name: data.name }]);
      setNewTypeName('');
    } catch (err) {
      setTypesError(err instanceof Error ? err.message : 'Failed to add type');
    } finally {
      setTypesSaving(false);
    }
  }

  async function saveRename(id: number) {
    if (!renameVal.trim()) return;
    setTypesSaving(true);
    setTypesError(null);
    try {
      const res = await fetch(`/api/admin/account-types/${id}`, {
        method:      'PATCH',
        credentials: 'same-origin',
        headers:     { 'Content-Type': 'application/json' },
        body:        JSON.stringify({ name: renameVal.trim() }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? `HTTP ${res.status}`);
      setAccountTypes(prev => prev.map(t => t.id === id ? { ...t, name: renameVal.trim() } : t));
      setRenamingId(null);
      setRenameVal('');
    } catch (err) {
      setTypesError(err instanceof Error ? err.message : 'Failed to rename');
    } finally {
      setTypesSaving(false);
    }
  }

  async function deleteType(id: number) {
    setTypesSaving(true);
    setTypesError(null);
    try {
      const res = await fetch(`/api/admin/account-types/${id}`, {
        method:      'DELETE',
        credentials: 'same-origin',
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? `HTTP ${res.status}`);
      setAccountTypes(prev => prev.filter(t => t.id !== id));
    } catch (err) {
      setTypesError(err instanceof Error ? err.message : 'Failed to delete');
    } finally {
      setTypesSaving(false);
    }
  }

  // ── Derived data ─────────────────────────────────────────────────────────────

  const COL_KEY: Record<string, keyof AdminAccount> = {
    'Profile':      'profile',
    'Name':         'name',
    'Display name': 'displayName',
    'Title':        'displayJobTitle',
    'Party':        'party',
    'Affiliation':  'affiliation',
  };

  function handleSortCol(label: string) {
    if (!COL_KEY[label]) return;
    if (sortCol === label) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortCol(label);
      setSortDir('asc');
    }
  }

  const visibleAccounts = (() => {
    let list = showInactive ? accounts : accounts.filter(a => a.isActive !== false);
    if (filterType) {
      list = list.filter(a =>
        (a.accountTypeNames ?? '').split(',').map(s => s.trim()).includes(filterType)
      );
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(a =>
        (a.name    ?? '').toLowerCase().includes(q) ||
        (a.profile ?? '').toLowerCase().includes(q)
      );
    }
    const key = COL_KEY[sortCol] ?? 'name';
    list = [...list].sort((a, b) => {
      const av = (a[key] as string | null) ?? '';
      const bv = (b[key] as string | null) ?? '';
      return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
    });
    return list;
  })();

  // ── Render ──────────────────────────────────────────────────────────────────

  // Not authorised — clean gate instead of a panel full of failing requests.
  if (forbidden) {
    return (
      <View style={[s.root, s.center, { flex: 1 }]}>
        <Text style={s.heading}>Not authorised</Text>
        <Text style={s.dimText}>
          This area is restricted. Sign in with an admin account, then try again.
        </Text>
        <Pressable style={s.saveBtn} onPress={() => router.replace('/login')}>
          <Text style={s.saveBtnText}>Sign in</Text>
        </Pressable>
        <Pressable onPress={() => router.replace('/')} style={s.backBtn}>
          <Text style={s.backBtnText}>← Back to dashboard</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView style={s.root} contentContainerStyle={s.content}>

      {/* Header */}
      <View style={s.header}>
        <Pressable onPress={() => router.replace('/')} style={s.backBtn}>
          <Text style={s.backBtnText}>← Dashboard</Text>
        </Pressable>
        <Text style={s.heading}>Admin Panel</Text>
        <Text style={s.subheading}>Manage tracked profiles</Text>
      </View>

      {/* Global success banner */}
      {addSuccess && (
        <View style={s.successBanner}>
          <Text style={s.successText}>{addSuccess}</Text>
          <Pressable onPress={() => setAddSuccess(null)}><Text style={s.successText}>✕</Text></Pressable>
        </View>
      )}

      {/* ── Profiles section ── */}
      <View style={s.section}>
        <View style={s.sectionHeader}>
          <Text style={s.sectionTitle}>
            Profiles ({visibleAccounts.length}{showInactive ? '' : ` active`})
          </Text>
          <View style={s.sectionActions}>
            <Pressable
              style={[s.filterBtn, showInactive && s.filterBtnActive]}
              onPress={() => setShowInactive(v => !v)}
            >
              <Text style={[s.filterBtnText, showInactive && s.filterBtnTextActive]}>
                {showInactive ? 'Hiding inactive' : 'Show inactive'}
              </Text>
            </Pressable>
            <Pressable style={s.addBtn} onPress={() => { setShowAddForm(v => !v); setAddError(null); }}>
              <Text style={s.addBtnText}>{showAddForm ? 'Cancel' : '+ Add profile'}</Text>
            </Pressable>
          </View>
        </View>

        {/* Add-profile form */}
        {showAddForm && (
          <View style={s.addForm}>
            <Text style={s.formTitle}>New profile</Text>
            <View style={s.formGrid}>
              <FormField label='TikTok handle *' placeholder='@handle'                        value={addForm.profile}         onChangeText={v => setAddForm(p => ({ ...p, profile: v }))} />
              <FormField label='Name *'           placeholder='Full name'                      value={addForm.name}            onChangeText={v => setAddForm(p => ({ ...p, name: v }))} />
              <FormField label='Display name'     placeholder='How it appears on site'         value={addForm.displayName}     onChangeText={v => setAddForm(p => ({ ...p, displayName: v }))} />
              <FormField label='Job title'        placeholder='e.g. MP for Westminster Central' value={addForm.displayJobTitle} onChangeText={v => setAddForm(p => ({ ...p, displayJobTitle: v }))} />
              <FormField label='Party'            placeholder='e.g. Labour'                    value={addForm.party}           onChangeText={v => setAddForm(p => ({ ...p, party: v }))} />
              <FormField label='Affiliation'      placeholder='e.g. Scottish'                  value={addForm.affiliation}     onChangeText={v => setAddForm(p => ({ ...p, affiliation: v }))} />
            </View>
            <Text style={s.fieldLabel}>Account types</Text>
            <View style={s.typeGrid}>
              {accountTypes.map(t => (
                <TypeChip key={t.id} label={t.name} active={addForm.accountTypeIds.includes(t.id)} onPress={() => toggleAddType(t.id)} />
              ))}
            </View>
            {addError && <Text style={s.errText}>{addError}</Text>}
            <Pressable style={[s.saveBtn, addSaving && s.saveBtnDisabled]} onPress={submitAddForm} disabled={addSaving}>
              <Text style={s.saveBtnText}>{addSaving ? 'Adding…' : 'Add profile + trigger N8N'}</Text>
            </Pressable>
          </View>
        )}
      </View>

      {/* ── Search ── */}
      <TextInput
        style={s.searchInput}
        placeholder='Search by name or handle…'
        placeholderTextColor={neutral.strokeHi}
        value={searchQuery}
        onChangeText={setSearchQuery}
      />

      {/* ── Type filter chips ── */}
      {accountTypes.length > 0 && (
        <View style={s.filterRow}>
          <Pressable
            style={[s.filterChip, filterType === null && s.filterChipActive]}
            onPress={() => setFilterType(null)}
          >
            <Text style={[s.filterChipText, filterType === null && s.filterChipTextActive]}>All</Text>
          </Pressable>
          {accountTypes.map(t => (
            <Pressable
              key={t.id}
              style={[s.filterChip, filterType === t.name && s.filterChipActive]}
              onPress={() => setFilterType(filterType === t.name ? null : t.name)}
            >
              <Text style={[s.filterChipText, filterType === t.name && s.filterChipTextActive]}>{t.name}</Text>
            </Pressable>
          ))}
        </View>
      )}

      {/* ── Accounts table ── */}
      {loadingData ? (
        <View style={s.center}>
          <ActivityIndicator color={knox.primaryOrange} />
          <Text style={s.dimText}>Loading accounts…</Text>
        </View>
      ) : error ? (
        <View style={s.center}>
          <Text style={s.errText}>{error}</Text>
          <Pressable style={s.saveBtn} onPress={fetchData}><Text style={s.saveBtnText}>Retry</Text></Pressable>
        </View>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator style={s.tableScroll}>
          <View>
            <View style={[s.row, s.rowHeader]}>
              {['Profile', 'Name', 'Display name', 'Title', 'Party', 'Affiliation', 'Types', 'Active', ''].map((h, i) => {
                const sortable = !!COL_KEY[h];
                const active   = sortCol === h;
                const wide     = h === 'Title' || h === 'Types';
                const narrow   = h === 'Active' || h === '';
                return (
                  <Text
                    key={i}
                    onPress={sortable ? () => handleSortCol(h) : undefined}
                    style={[
                      s.cell, s.cellHeader,
                      wide   && s.cellWide,
                      narrow && s.cellNarrow,
                      active && s.cellHeaderActive,
                      sortable && { cursor: 'pointer' } as any,
                    ]}
                  >
                    {h}{active ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''}
                  </Text>
                );
              })}
            </View>

            {visibleAccounts.map((account, i) => {
              const isEditing = editingId === account.id;
              const es        = isEditing ? editState! : null;
              const inactive  = account.isActive === false;

              return (
                <View key={account.id} style={[s.row, i % 2 === 0 ? s.rowEven : s.rowOdd, inactive && s.rowInactive]}>

                  <Text style={[s.cell, inactive && s.dimCell]}>{account.profile ?? '—'}</Text>

                  {isEditing
                    ? <TextInput style={[s.cell, s.cellInput]} value={es!.name} onChangeText={v => setEditState(p => p ? { ...p, name: v } : p)} />
                    : <Text style={[s.cell, inactive && s.dimCell]}>{account.name ?? '—'}</Text>
                  }

                  {isEditing
                    ? <TextInput style={[s.cell, s.cellInput]} value={es!.displayName} onChangeText={v => setEditState(p => p ? { ...p, displayName: v } : p)} placeholder='Display name' placeholderTextColor={neutral.strokeHi} />
                    : <Text style={[s.cell, inactive && s.dimCell]}>{account.displayName ?? <Text style={s.dimCellText}>—</Text>}</Text>
                  }

                  {isEditing
                    ? <TextInput style={[s.cell, s.cellInput, s.cellWide]} value={es!.displayJobTitle} onChangeText={v => setEditState(p => p ? { ...p, displayJobTitle: v } : p)} placeholder='Title / role' placeholderTextColor={neutral.strokeHi} />
                    : <Text style={[s.cell, s.cellWide, inactive && s.dimCell]} numberOfLines={2}>{account.displayJobTitle ?? <Text style={s.dimCellText}>—</Text>}</Text>
                  }

                  {isEditing
                    ? <TextInput style={[s.cell, s.cellInput]} value={es!.party} onChangeText={v => setEditState(p => p ? { ...p, party: v } : p)} placeholder='Party' placeholderTextColor={neutral.strokeHi} />
                    : <Text style={[s.cell, inactive && s.dimCell]}>{account.party ?? '—'}</Text>
                  }

                  {isEditing
                    ? <TextInput style={[s.cell, s.cellInput]} value={es!.affiliation} onChangeText={v => setEditState(p => p ? { ...p, affiliation: v } : p)} placeholder='Affiliation' placeholderTextColor={neutral.strokeHi} />
                    : <Text style={[s.cell, inactive && s.dimCell]}>{account.affiliation ?? '—'}</Text>
                  }

                  <View style={[s.cell, s.cellWide, s.cellTypeContainer]}>
                    {isEditing
                      ? accountTypes.map(t => (
                          <TypeChip key={t.id} label={t.name} active={es!.accountTypeIds.includes(t.id)} onPress={() => toggleType(t.id)} small />
                        ))
                      : account.accountTypeNames
                          ? account.accountTypeNames.split(',').map((n, i) => (
                              <View key={i} style={s.typeTag}>
                                <Text style={s.typeTagText} numberOfLines={1}>{n.trim()}</Text>
                              </View>
                            ))
                          : <Text style={s.dimCellText}>—</Text>
                    }
                  </View>

                  {/* Active toggle */}
                  <View style={[s.cell, s.cellNarrow, { alignItems: 'center' }]}>
                    <Pressable
                      style={[s.toggleBtn, account.isActive !== false && s.toggleBtnActive]}
                      onPress={() => toggleActive(account)}
                    >
                      <Text style={[s.toggleBtnText, account.isActive !== false && s.toggleBtnTextActive]}>
                        {account.isActive !== false ? 'Active' : 'Off'}
                      </Text>
                    </Pressable>
                  </View>

                  {/* Edit / Save / Cancel */}
                  <View style={[s.cell, s.cellNarrow, s.cellActionRow]}>
                    {isEditing ? (
                      <>
                        <Pressable style={[s.actionBtn, s.actionSave]} onPress={() => saveEdit(account.id)} disabled={saving}>
                          <Text style={s.actionBtnText}>{saving ? '…' : 'Save'}</Text>
                        </Pressable>
                        <Pressable style={[s.actionBtn, s.actionCancel]} onPress={cancelEdit}>
                          <Text style={s.actionBtnText}>Cancel</Text>
                        </Pressable>
                        {saveError && <Text style={s.errTextSmall}>{saveError}</Text>}
                      </>
                    ) : (
                      <Pressable style={s.actionBtn} onPress={() => startEdit(account)}>
                        <Text style={s.actionBtnText}>Edit</Text>
                      </Pressable>
                    )}
                  </View>

                </View>
              );
            })}
          </View>
        </ScrollView>
      )}

      {/* ── CSV bulk import ── */}
      <View style={[s.section, { marginTop: spacing.xl }]}>
        <View style={s.sectionHeader}>
          <Text style={s.sectionTitle}>Bulk import</Text>
          <Pressable style={s.addBtn} onPress={() => { setShowCsv(v => !v); setCsvParsed([]); setCsvError(null); setCsvProgress(null); }}>
            <Text style={s.addBtnText}>{showCsv ? 'Cancel' : 'Import CSV'}</Text>
          </Pressable>
        </View>

        {showCsv && (
          <View style={s.addForm}>
            <Text style={s.formTitle}>Paste CSV</Text>
            <Text style={s.fieldLabel}>
              Required headers: <Text style={{ color: neutral.text }}>profile,name,displayName,displayJobTitle,party,affiliation</Text>
            </Text>
            <TextInput
              style={[s.formInput, { height: 140, marginVertical: spacing.sm, textAlignVertical: 'top' }]}
              multiline
              placeholder={'profile,name,displayName,displayJobTitle,party,affiliation\n@handle,Full Name,Display Name,MP for X,Labour,Scottish'}
              placeholderTextColor={neutral.strokeHi}
              value={csvText}
              onChangeText={v => { setCsvText(v); setCsvParsed([]); }}
            />
            {csvError && <Text style={s.errText}>{csvError}</Text>}
            {csvProgress && <Text style={s.successText}>{csvProgress}</Text>}

            {!csvParsed.length ? (
              <Pressable style={s.saveBtn} onPress={previewCsv}>
                <Text style={s.saveBtnText}>Preview</Text>
              </Pressable>
            ) : (
              <>
                <Text style={[s.fieldLabel, { marginBottom: spacing.sm }]}>{csvParsed.length} rows ready to import:</Text>
                <ScrollView horizontal style={{ marginBottom: spacing.sm }}>
                  <View>
                    <View style={[s.row, s.rowHeader]}>
                      {['profile','name','displayName','displayJobTitle','party','affiliation'].map(h => (
                        <Text key={h} style={[s.cell, s.cellHeader]}>{h}</Text>
                      ))}
                    </View>
                    {csvParsed.slice(0, 5).map((row, i) => (
                      <View key={i} style={[s.row, i % 2 === 0 ? s.rowEven : s.rowOdd]}>
                        {['profile','name','displayName','displayJobTitle','party','affiliation'].map(h => (
                          <Text key={h} style={s.cell} numberOfLines={1}>{row[h] ?? '—'}</Text>
                        ))}
                      </View>
                    ))}
                    {csvParsed.length > 5 && (
                      <Text style={[s.dimText, { padding: 8 }]}>…and {csvParsed.length - 5} more</Text>
                    )}
                  </View>
                </ScrollView>
                <Pressable style={[s.saveBtn, csvImporting && s.saveBtnDisabled]} onPress={importCsv} disabled={csvImporting}>
                  <Text style={s.saveBtnText}>{csvImporting ? (csvProgress ?? 'Importing…') : `Import ${csvParsed.length} profiles`}</Text>
                </Pressable>
              </>
            )}
          </View>
        )}
      </View>

      {/* ── Account types management ── */}
      <View style={[s.section, { marginTop: spacing.xl }]}>
        <View style={s.sectionHeader}>
          <Text style={s.sectionTitle}>Account types ({accountTypes.length})</Text>
          <Pressable style={s.addBtn} onPress={() => { setShowTypes(v => !v); setTypesError(null); }}>
            <Text style={s.addBtnText}>{showTypes ? 'Close' : 'Manage'}</Text>
          </Pressable>
        </View>

        {showTypes && (
          <View style={s.addForm}>
            {typesError && <Text style={[s.errText, { marginBottom: spacing.sm }]}>{typesError}</Text>}

            {/* Existing types */}
            {accountTypes.map(t => (
              <View key={t.id} style={s.typeRow}>
                {renamingId === t.id ? (
                  <>
                    <TextInput
                      style={[s.formInput, { flex: 1, marginRight: 8 }]}
                      value={renameVal}
                      onChangeText={setRenameVal}
                      autoFocus
                    />
                    <Pressable style={[s.actionBtn, s.actionSave]} onPress={() => saveRename(t.id)} disabled={typesSaving}>
                      <Text style={s.actionBtnText}>Save</Text>
                    </Pressable>
                    <Pressable style={[s.actionBtn, s.actionCancel, { marginLeft: 4 }]} onPress={() => { setRenamingId(null); setRenameVal(''); }}>
                      <Text style={s.actionBtnText}>Cancel</Text>
                    </Pressable>
                  </>
                ) : (
                  <>
                    <Text style={[s.cell, { flex: 1, paddingHorizontal: 0 }]}>{t.name}</Text>
                    <Pressable style={s.actionBtn} onPress={() => { setRenamingId(t.id); setRenameVal(t.name); }}>
                      <Text style={s.actionBtnText}>Rename</Text>
                    </Pressable>
                    <Pressable style={[s.actionBtn, s.actionDelete, { marginLeft: 4 }]} onPress={() => deleteType(t.id)} disabled={typesSaving}>
                      <Text style={s.actionBtnText}>Delete</Text>
                    </Pressable>
                  </>
                )}
              </View>
            ))}

            {/* Add new type */}
            <View style={[s.typeRow, { marginTop: spacing.sm }]}>
              <TextInput
                style={[s.formInput, { flex: 1, marginRight: 8 }]}
                placeholder='New type name'
                placeholderTextColor={neutral.strokeHi}
                value={newTypeName}
                onChangeText={setNewTypeName}
              />
              <Pressable style={[s.actionBtn, s.actionSave]} onPress={addType} disabled={typesSaving || !newTypeName.trim()}>
                <Text style={s.actionBtnText}>Add</Text>
              </Pressable>
            </View>
          </View>
        )}
      </View>

    </ScrollView>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function FormField({ label, placeholder, value, onChangeText }: {
  label: string; placeholder: string; value: string; onChangeText: (v: string) => void;
}) {
  return (
    <View style={s.formField}>
      <Text style={s.fieldLabel}>{label}</Text>
      <TextInput style={s.formInput} placeholder={placeholder} placeholderTextColor={neutral.strokeHi} value={value} onChangeText={onChangeText} />
    </View>
  );
}

function TypeChip({ label, active, onPress, small }: {
  label: string; active: boolean; onPress: () => void; small?: boolean;
}) {
  return (
    <Pressable style={[s.typeChip, active && s.typeChipActive, small && s.typeChipSmall]} onPress={onPress}>
      <Text style={[s.typeChipText, small && s.typeChipTextSmall]}>{label}</Text>
    </Pressable>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const CELL_W    = 140;
const CELL_W_LG = 200;
const CELL_W_SM = 90;

const s = StyleSheet.create({
  root:    { flex: 1, backgroundColor: neutral.felt },
  content: { padding: spacing.md, paddingBottom: 100 },
  center:  { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: 12 },

  header:      { marginBottom: spacing.lg },
  backBtn:     { marginBottom: spacing.sm },
  backBtnText: { color: neutral.strokeHi, fontSize: 14 },
  heading:     { color: neutral.text, fontSize: 28, fontFamily: 'Figtree_700Bold', marginBottom: 4 },
  subheading:  { color: neutral.textMid, fontSize: 15 },

  successBanner: { backgroundColor: '#1B3A1B', borderRadius: 6, padding: spacing.sm, flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.md },
  successText:   { color: '#4CAF50', fontSize: 14 },

  section:        { marginBottom: spacing.md },
  sectionHeader:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm },
  sectionTitle:   { color: neutral.text, fontSize: 18, fontFamily: 'Figtree_600SemiBold' },
  sectionActions: { flexDirection: 'row', gap: 8 },

  filterBtn:         { borderRadius: 6, paddingHorizontal: spacing.sm, paddingVertical: 6, borderWidth: 1, borderColor: neutral.stroke },
  filterBtnActive:   { borderColor: knox.primaryOrange },
  filterBtnText:     { color: neutral.textMid, fontSize: 14, fontFamily: 'Figtree_600SemiBold' },
  filterBtnTextActive: { color: knox.primaryOrange },

  addBtn:     { backgroundColor: knox.accentPurple, borderRadius: 6, paddingHorizontal: spacing.sm, paddingVertical: 6 },
  addBtnText: { color: neutral.text, fontSize: 14, fontFamily: 'Figtree_600SemiBold' },

  addForm:    { backgroundColor: neutral.ink, borderRadius: 8, padding: spacing.md, marginBottom: spacing.md, borderWidth: 1, borderColor: neutral.stroke },
  formTitle:  { color: neutral.text, fontSize: 16, fontFamily: 'Figtree_600SemiBold', marginBottom: spacing.sm },
  formGrid:   { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.sm },
  formField:  { width: CELL_W_LG },
  fieldLabel: { color: neutral.textMid, fontSize: 12, marginBottom: 4 },
  formInput:  { backgroundColor: neutral.night, borderRadius: 6, borderWidth: 1, borderColor: neutral.stroke, color: neutral.text, padding: 8, fontSize: 14 },

  typeGrid:          { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: spacing.md },
  typeChip:          { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, borderWidth: 1, borderColor: neutral.stroke },
  typeChipActive:    { backgroundColor: knox.accentPurple, borderColor: knox.accentPurple },
  typeChipSmall:     { paddingHorizontal: 7, paddingVertical: 3 },
  typeChipText:      { color: neutral.textMid, fontSize: 13 },
  typeChipTextSmall: { fontSize: 11 },

  typeRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },

  saveBtn:        { backgroundColor: knox.primaryOrange, borderRadius: 6, paddingVertical: 10, alignItems: 'center', marginTop: 4 },
  saveBtnDisabled: { opacity: 0.5 },
  saveBtnText:    { color: '#1F1D1D', fontSize: 14, fontFamily: 'Figtree_700Bold' },
  errText:        { color: '#F44336', fontSize: 13, marginBottom: 8 },
  errTextSmall:   { color: '#F44336', fontSize: 11, marginTop: 2 },

  searchInput:        { backgroundColor: neutral.ink, borderRadius: 8, borderWidth: 1, borderColor: neutral.stroke, color: neutral.text, padding: 10, fontSize: 14, marginBottom: spacing.sm },

  filterRow:          { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: spacing.sm },
  filterChip:         { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, borderWidth: 1, borderColor: neutral.stroke },
  filterChipActive:   { backgroundColor: knox.accentPurple, borderColor: knox.accentPurple },
  filterChipText:     { color: neutral.textMid, fontSize: 12 },
  filterChipTextActive: { color: neutral.text },

  tableScroll:  { marginHorizontal: -spacing.md },
  row:          { flexDirection: 'row', alignItems: 'stretch', borderBottomWidth: 1, borderBottomColor: neutral.stroke },
  rowHeader:    { backgroundColor: neutral.ink },
  rowEven:      { backgroundColor: neutral.felt },
  rowOdd:       { backgroundColor: neutral.ink },
  rowInactive:  { opacity: 0.45 },

  cell:             { width: CELL_W, paddingHorizontal: 10, paddingVertical: 10, color: neutral.text, fontSize: 13 },
  cellHeader:       { color: neutral.textMid, fontSize: 12, fontFamily: 'Figtree_600SemiBold', paddingVertical: 8 },
  cellHeaderActive: { color: knox.primaryOrange },
  cellWide:    { width: CELL_W_LG },
  cellNarrow:  { width: CELL_W_SM },
  cellInput:   { backgroundColor: neutral.night, borderRadius: 4, borderWidth: 1, borderColor: neutral.strokeHi, color: neutral.text, paddingHorizontal: 6, paddingVertical: 6, fontSize: 13, height: 36 },
  cellTypes:        { width: CELL_W_LG, flexDirection: 'row', flexWrap: 'wrap', gap: 4, paddingVertical: 6 },
  cellTypeContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 3, alignItems: 'flex-start', paddingVertical: 8 },
  typeTag:           { backgroundColor: '#2A2352', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  typeTagText:       { color: '#A07DD6', fontSize: 11 },
  cellActionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, paddingVertical: 8, paddingHorizontal: 10, alignItems: 'flex-start' },
  dimCell:      { opacity: 0.5 },
  dimCellText:  { color: neutral.strokeHi },
  dimText:      { color: neutral.textMid, fontSize: 14, marginTop: 8 },

  toggleBtn:          { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4, borderWidth: 1, borderColor: neutral.stroke },
  toggleBtnActive:    { borderColor: '#4CAF50' },
  toggleBtnText:      { color: neutral.strokeHi, fontSize: 11, fontFamily: 'Figtree_600SemiBold' },
  toggleBtnTextActive: { color: '#4CAF50' },

  actionBtn:     { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 5, backgroundColor: neutral.stroke },
  actionSave:    { backgroundColor: knox.primaryOrange },
  actionCancel:  { backgroundColor: 'transparent', borderWidth: 1, borderColor: neutral.stroke },
  actionDelete:  { backgroundColor: '#3A1A1A', borderWidth: 1, borderColor: '#7A2A2A' },
  actionBtnText: { color: neutral.text, fontSize: 12, fontFamily: 'Figtree_600SemiBold' },
});
