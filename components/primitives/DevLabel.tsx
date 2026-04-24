import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';

/**
 * DevLabel
 * ---------
 * In __DEV__ + web builds, walks up the DOM from a sentinel span and stamps
 * a `data-component="<Name>"` attribute on the first ancestor React Native
 * View element. This makes every component instantly identifiable in the
 * browser's Elements inspector without any visual impact on end users.
 *
 * In native dev builds it falls back to a console.log on mount.
 * In production builds it renders nothing and does nothing.
 *
 * Usage — place as the first child of any component's root View:
 *
 *   function MyComponent() {
 *     return (
 *       <View>
 *         <DevLabel name="MyComponent" />
 *         ...
 *       </View>
 *     );
 *   }
 */
interface Props {
  name: string;
}

export function DevLabel({ name }: Props) {
  const sentinelRef = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    if (!__DEV__) return;

    if (Platform.OS === 'web') {
      // Walk up from the sentinel span until we reach an RN View div,
      // then stamp the data-component attribute on it.
      const el = sentinelRef.current;
      if (el) {
        let node: HTMLElement | null = el.parentElement;
        while (node) {
          // React Native Web renders Views as <div> elements
          if (node.tagName === 'DIV') {
            node.setAttribute('data-component', name);
            break;
          }
          node = node.parentElement;
        }
      }
    } else {
      console.log(`[component] ${name} mounted`);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!__DEV__ || Platform.OS !== 'web') return null;

  // Invisible sentinel so we have a DOM anchor to walk up from
  return (
    <span
      ref={sentinelRef}
      data-dev-label={name}
      style={{ display: 'none' }}
    />
  );
}
