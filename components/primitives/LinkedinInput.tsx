import React from 'react';
import { PrefixedInput, PrefixedInputProps } from '@/components/primitives/PrefixedInput';
import { LINKEDIN_PREFIX, extractLinkedinHandle } from '@/lib/linkedin';

/**
 * LinkedinInput
 * --------------
 * Variant of PrefixedInput preset for LinkedIn profile handles. Renders the
 * fixed 'https://www.linkedin.com/in/' prefix and strips any pasted full
 * URL / regional subdomain / @-prefix down to just the handle via
 * extractLinkedinHandle. The bound value is the HANDLE only — callers
 * reconstruct the full URL with buildLinkedinUrl when saving.
 *
 * Add sibling variants (TwitterInput, GithubInput) alongside this file as
 * the need arises; each is a thin wrapper that supplies its own prefix and
 * sanitiser to PrefixedInput.
 *
 * One job: standardise the LinkedIn handle input across signup and prefs.
 */

type LinkedinInputProps = Omit<PrefixedInputProps, 'prefix' | 'sanitize' | 'keyboardType' | 'placeholder'> & {
  placeholder?: string;
};

export function LinkedinInput({ placeholder = 'janesmith', ...rest }: LinkedinInputProps) {
  return (
    <PrefixedInput
      prefix={LINKEDIN_PREFIX}
      sanitize={extractLinkedinHandle}
      placeholder={placeholder}
      keyboardType="url"
      {...rest}
    />
  );
}
