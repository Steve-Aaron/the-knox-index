import React from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Platform,
} from 'react-native';
import { MotiView } from 'moti';
import { Title } from '@/components/ui/Title';
import { neutral, glass, accent } from '@/theme/colors';
import { spacing, radius } from '@/theme/spacing';
import { type, font } from '@/theme/typography';
import { captureException } from '@/lib/sentry';

/**
 * ErrorBoundary
 * --------------
 * React class component that catches unhandled render-time errors in the
 * component tree below it. Shows a full-screen error card with a reload
 * button rather than a blank or crashed UI.
 *
 * Wrap any subtree you want protected:
 *   <ErrorBoundary>
 *     <DashboardScreen />
 *   </ErrorBoundary>
 *
 * One job: intercept render crashes and surface them gracefully.
 */

interface Props {
  children: React.ReactNode;
}

interface State {
  crashed:        boolean;
  isStaleBundle:  boolean;
}

function isChunkLoadError(error: Error): boolean {
  // Webpack / Metro chunk load failures surface as ChunkLoadError or a
  // message containing 'Loading chunk' / 'Loading CSS chunk'.
  return (
    error.name === 'ChunkLoadError' ||
    /loading (css )?chunk/i.test(error.message) ||
    /failed to fetch dynamically imported module/i.test(error.message)
  );
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { crashed: false, isStaleBundle: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { crashed: true, isStaleBundle: isChunkLoadError(error) };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    captureException(error, {
      componentStack: info.componentStack ?? undefined,
    });
  }

  handleReset = () => {
    if (Platform.OS === 'web') {
      (window as any).location.reload();
    } else {
      this.setState({ crashed: false, isStaleBundle: false });
    }
  };

  render() {
    if (this.state.crashed) {
      return (
        <ErrorCard
          onRetry={this.handleReset}
          isStaleBundle={this.state.isStaleBundle}
        />
      );
    }
    return this.props.children;
  }
}

/**
 * ErrorScreen
 * ------------
 * Standalone functional component for data-fetch errors (e.g. BigQuery
 * unreachable, bad HTTP response). Used by the dashboard when useLiveData
 * returns status === 'error' with an empty politicians array.
 */
interface ErrorScreenProps {
  message?:  string;
  onRetry?:  () => void;
}

export function ErrorScreen({ message, onRetry }: ErrorScreenProps) {
  return <ErrorCard message={message} onRetry={onRetry} />;
}

// ── Shared card UI ────────────────────────────────────────────────────────────

interface ErrorCardProps {
  message?:       string;
  onRetry?:       () => void;
  isStaleBundle?: boolean;
}

function ErrorCard({ message, onRetry, isStaleBundle }: ErrorCardProps) {
  const title = isStaleBundle ? 'New version available' : 'Data unavailable';
  const body  = isStaleBundle
    ? 'The Knox Index has been updated. Refresh the page to load the latest version.'
    : (message ?? 'The Knox Index could not reach its data source.');
  const hint  = isStaleBundle
    ? 'This happens when a new deployment lands while you have the page open.'
    : 'This is usually a temporary network issue or a BigQuery outage. Check the server logs for details.';
  const btnLabel = isStaleBundle ? 'Refresh now' : 'Try again';

  return (
    <View style={styles.root}>
      <MotiView
        from={{ opacity: 0, scale: 0.96, translateY: 12 }}
        animate={{ opacity: 1, scale: 1, translateY: 0 }}
        transition={{ type: 'timing', duration: 320 }}
        style={[styles.errorCard, isStaleBundle && styles.cardUpdate]}
      >
        {/* Icon */}
        <View style={[styles.iconWrap, isStaleBundle && styles.iconWrapUpdate]}>
          <Text style={[styles.icon, isStaleBundle && styles.iconUpdate]}>
            {isStaleBundle ? '↻' : '⚠'}
          </Text>
        </View>

        {/* Text */}
        <Title style={{ fontSize: 20, letterSpacing: -0.3, textAlign: 'center' }}>{title}</Title>
        <Text style={styles.body}>{body}</Text>
        <Text style={styles.hint}>{hint}</Text>

        {/* Actions */}
        {onRetry ? (
          <Pressable
            style={({ pressed }) => [styles.btn, isStaleBundle && styles.btnUpdate, pressed && { opacity: 0.8 }]}
            onPress={onRetry}
          >
            <Text style={styles.btnText}>{btnLabel}</Text>
          </Pressable>
        ) : null}
      </MotiView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    minHeight: 400,
  },
  errorCard: {
    width: '100%',
    maxWidth: 480,
    backgroundColor: 'rgba(14,14,20,0.92)',
    borderWidth: 1,
    borderColor: 'rgba(255,80,80,0.25)',
    borderRadius: radius.lg,
    padding: spacing.xl,
    alignItems: 'center',
    gap: spacing.md,
    ...Platform.select({
      web: { boxShadow: '0 24px 64px rgba(0,0,0,0.6)' } as any,
      default: {
        shadowColor: '#000',
        shadowOpacity: 0.5,
        shadowRadius: 24,
        shadowOffset: { width: 0, height: 8 },
      },
    }),
  },
  iconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(255,80,80,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,80,80,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  icon: {
    fontSize: 24,
    color: '#ff6060',
  },
  body: {
    ...type.body,
    fontSize: 16,
    color: neutral.textMid,
    textAlign: 'center',
    lineHeight: 20,
  },
  hint: {
    ...type.body,
    fontSize: 12,
    color: neutral.textDim,
    textAlign: 'center',
    lineHeight: 17,
  },
  btn: {
    marginTop: spacing.sm,
    backgroundColor: accent.indigo,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radius.pill,
    ...Platform.select({
      web: { cursor: 'pointer' } as any,
      default: {},
    }),
  },
  btnUpdate: {
    backgroundColor: accent.mint,
  },
  btnText: {
    fontFamily: font.bold,
    fontSize: 16,
    color: '#fff',
    letterSpacing: 0.2,
  },
  // Stale bundle variant — mint accent instead of red
  cardUpdate: {
    borderColor: 'rgba(63,230,177,0.25)',
  },
  iconWrapUpdate: {
    backgroundColor: 'rgba(63,230,177,0.1)',
    borderColor:     'rgba(63,230,177,0.3)',
  },
  iconUpdate: {
    color: accent.mint,
    fontSize: 28,
  },
});
