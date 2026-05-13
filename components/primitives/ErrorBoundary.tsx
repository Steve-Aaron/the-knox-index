import React from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Platform,
} from 'react-native';
import { MotiView } from 'moti';
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
  crashed: boolean;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { crashed: false };
  }

  static getDerivedStateFromError(): State {
    return { crashed: true };
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
      this.setState({ crashed: false });
    }
  };

  render() {
    if (this.state.crashed) {
      return <ErrorCard onRetry={this.handleReset} />;
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
  message?: string;
  onRetry?: () => void;
}

function ErrorCard({ message, onRetry }: ErrorCardProps) {
  return (
    <View style={styles.root}>
      <MotiView
        from={{ opacity: 0, scale: 0.96, translateY: 12 }}
        animate={{ opacity: 1, scale: 1, translateY: 0 }}
        transition={{ type: 'timing', duration: 320 }}
        style={styles.card}
      >
        {/* Icon */}
        <View style={styles.iconWrap}>
          <Text style={styles.icon}>⚠</Text>
        </View>

        {/* Text */}
        <Text style={styles.title}>Data unavailable</Text>
        <Text style={styles.body}>
          {message ?? 'The Knox Index could not reach its data source.'}
        </Text>
        <Text style={styles.hint}>
          This is usually a temporary network issue or a BigQuery outage.
          Check the server logs for details.
        </Text>

        {/* Actions */}
        {onRetry ? (
          <Pressable
            style={({ pressed }) => [styles.btn, pressed && { opacity: 0.8 }]}
            onPress={onRetry}
          >
            <Text style={styles.btnText}>Try again</Text>
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
  card: {
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
    fontSize: 22,
    color: '#ff6060',
  },
  title: {
    fontFamily: font.bold,
    fontSize: 18,
    color: neutral.text,
    letterSpacing: -0.3,
    textAlign: 'center',
  },
  body: {
    ...type.body,
    fontSize: 13,
    color: neutral.textMid,
    textAlign: 'center',
    lineHeight: 20,
  },
  hint: {
    ...type.body,
    fontSize: 11,
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
  btnText: {
    fontFamily: font.bold,
    fontSize: 13,
    color: '#fff',
    letterSpacing: 0.2,
  },
});
