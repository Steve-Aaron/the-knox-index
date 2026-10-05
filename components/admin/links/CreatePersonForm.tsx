import React, { useState, useMemo, useCallback } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, StyleSheet } from 'react-native';
import { DevLabel } from '@/components/primitives/DevLabel';
import type { Country } from '@/lib/people';
import { REGION_LABELS, type RegionKey } from '@/lib/regions';
import { neutral, knox } from '@/theme/colors';
import { spacing, radius } from '@/theme/spacing';

/**
 * CreatePersonForm
 * -----------------
 * Makes the person an account has nobody to point at. Prefilled from the
 * account itself, because the reviewer is looking straight at it: the name
 * with its titles stripped, and the bio as a first guess at a job title.
 *
 * Country is a picker rather than free text. Picking one fills the region,
 * continent and coordinates from the reference, which is what puts the person
 * on the globe. Type it and nothing plots.
 *
 * One job: capture a new person, then hand them back to be linked.
 */

export interface NewPersonDraft {
  name:            string;
  displayJobTitle: string;
  party:           string;
  countryIso2:     string;
  constituency:    string;
}

interface Props {
  /** The account's display name, used as the starting point for the name. */
  accountName: string | null;
  /** The account's bio, offered as a starting point for the job title. */
  accountBio:  string | null;
  countries:   readonly Country[];
  busy:        boolean;
  onCancel:    () => void;
  onCreate:    (draft: NewPersonDraft) => void;
}

/** 'Abiy Ahmed Ali 🇪🇹' -> 'Abiy Ahmed Ali'. Titles and flags are not names. */
function cleanName(raw: string | null): string {
  return (raw ?? '')
    .replace(/[\p{Extended_Pictographic}\u{1F1E6}-\u{1F1FF}]/gu, '')
    .replace(/\b(MP|MSP|MLA|MEP|AM|MS|OBE|MBE|CBE|PhD)\b\.?/gi, '')
    .replace(/\s*[|\-–—·]\s*.*$/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function CreatePersonForm({ accountName, accountBio, countries, busy, onCancel, onCreate }: Props) {
  const [name,         setName]         = useState(() => cleanName(accountName));
  const [jobTitle,     setJobTitle]     = useState(() => (accountBio ?? '').split(/[.|·]/)[0].trim().slice(0, 80));
  const [party,        setParty]        = useState('');
  const [constituency, setConstituency] = useState('');
  const [countryIso2,  setCountryIso2]  = useState('');
  const [countryTerm,  setCountryTerm]  = useState('');

  const chosen = useMemo(
    () => countries.find(c => c.country_iso2 === countryIso2),
    [countries, countryIso2],
  );

  const matches = useMemo(() => {
    const term = countryTerm.trim().toLowerCase();
    if (!term) return [];
    return countries.filter(c => c.country.toLowerCase().includes(term)).slice(0, 6);
  }, [countries, countryTerm]);

  const pickCountry = useCallback((c: Country) => {
    setCountryIso2(c.country_iso2);
    setCountryTerm('');
  }, []);

  const submit = useCallback(() => {
    onCreate({ name: name.trim(), displayJobTitle: jobTitle.trim(), party: party.trim(), countryIso2, constituency: constituency.trim() });
  }, [name, jobTitle, party, countryIso2, constituency, onCreate]);

  const field = (label: string, value: string, onChange: (v: string) => void, placeholder: string) => (
    <View style={styles.field} key={label}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={neutral.textMid}
        style={styles.input}
      />
    </View>
  );

  return (
    <View style={styles.form}>
      <DevLabel name="CreatePersonForm" />
      <Text style={styles.title}>New person</Text>
      <Text style={styles.blurb}>
        Prefilled from the account. Check the name, then pick a country so they plot on the globe.
      </Text>

      <View style={styles.grid}>
        {field('Name',      name,     setName,     'Abdoulkader Kamil Mohamed')}
        {field('Job title', jobTitle, setJobTitle, 'Prime Minister of Djibouti')}
        {field('Party',     party,    setParty,    'Optional')}
        {field('Constituency', constituency, setConstituency, 'Optional, for MPs')}
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Country</Text>
        {chosen ? (
          <Pressable onPress={() => setCountryIso2('')} style={styles.chosen}>
            <Text style={styles.chosenText}>
              {chosen.country} · {REGION_LABELS[chosen.region as RegionKey] ?? chosen.region} · {chosen.latitude}, {chosen.longitude}
            </Text>
            <Text style={styles.clear}>change</Text>
          </Pressable>
        ) : (
          <>
            <TextInput
              value={countryTerm}
              onChangeText={setCountryTerm}
              placeholder="Search countries"
              placeholderTextColor={neutral.textMid}
              style={styles.input}
            />
            {matches.length > 0 ? (
              <ScrollView style={styles.results}>
                {matches.map(c => (
                  <Pressable key={c.country_iso2} onPress={() => pickCountry(c)} style={styles.result}>
                    <Text style={styles.resultName}>{c.country}</Text>
                    <Text style={styles.resultMeta}>{REGION_LABELS[c.region as RegionKey] ?? c.region}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            ) : null}
          </>
        )}
      </View>

      <View style={styles.actions}>
        <Pressable
          disabled={busy || !name.trim()}
          onPress={submit}
          style={[styles.btn, styles.btnPrimary, (busy || !name.trim()) && styles.btnDisabled]}
        >
          <Text style={styles.btnPrimaryText}>Create and link</Text>
        </Pressable>
        <Pressable disabled={busy} onPress={onCancel} style={[styles.btn, busy && styles.btnDisabled]}>
          <Text style={styles.btnText}>Cancel</Text>
        </Pressable>
        {!chosen ? <Text style={styles.warn}>No country means no place on the globe</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  form:    { gap: spacing.md, borderTopWidth: 1, borderTopColor: neutral.stroke, paddingTop: spacing.base },
  title:   { color: neutral.text, fontSize: 15, fontWeight: '700' },
  blurb:   { color: neutral.textMid, fontSize: 12 },
  grid:    { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  field:   { gap: spacing.xs, flexGrow: 1, flexBasis: 240 },
  label:   { color: neutral.textMid, fontSize: 10, letterSpacing: 1, textTransform: 'uppercase' },
  input: {
    backgroundColor: neutral.felt, color: neutral.text,
    borderWidth: 1, borderColor: neutral.stroke, borderRadius: radius.sm,
    paddingVertical: spacing.sm, paddingHorizontal: spacing.md, fontSize: 14,
  },
  results:    { maxHeight: 180, borderWidth: 1, borderColor: neutral.stroke, borderRadius: radius.sm },
  result:     { paddingVertical: spacing.sm, paddingHorizontal: spacing.md },
  resultName: { color: neutral.text, fontSize: 14 },
  resultMeta: { color: neutral.textMid, fontSize: 12 },
  chosen: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: neutral.felt, borderWidth: 1, borderColor: knox.primaryOrange,
    borderRadius: radius.sm, paddingVertical: spacing.sm, paddingHorizontal: spacing.md,
  },
  chosenText: { color: neutral.text, fontSize: 13, flexShrink: 1 },
  clear:      { color: neutral.textMid, fontSize: 12, marginLeft: spacing.md },
  actions:    { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  btn: {
    paddingVertical: spacing.sm, paddingHorizontal: spacing.base,
    borderRadius: radius.pill, borderWidth: 1, borderColor: neutral.stroke,
  },
  btnPrimary:     { borderColor: knox.primaryOrange, backgroundColor: 'rgba(255, 147, 99, 0.12)' },
  btnPrimaryText: { color: neutral.text, fontSize: 13, fontWeight: '600' },
  btnText:        { color: neutral.textMid, fontSize: 13 },
  btnDisabled:    { opacity: 0.4 },
  warn:           { color: neutral.textMid, fontSize: 12 },
});
