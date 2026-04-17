import type { ReactNode } from "react";
import { Pressable, View } from "react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import { X } from "lucide-react-native";

interface AttachmentPillProps {
  onOpen: () => void;
  onRemove: () => void;
  openAccessibilityLabel: string;
  removeAccessibilityLabel: string;
  testID?: string;
  children: ReactNode;
}

export function AttachmentPill({
  onOpen,
  onRemove,
  openAccessibilityLabel,
  removeAccessibilityLabel,
  testID,
  children,
}: AttachmentPillProps) {
  const { theme } = useUnistyles();
  return (
    <View style={styles.wrapper}>
      <Pressable
        testID={testID}
        onPress={onOpen}
        accessibilityRole="button"
        accessibilityLabel={openAccessibilityLabel}
        style={styles.body}
      >
        {children}
      </Pressable>
      <Pressable
        onPress={onRemove}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={removeAccessibilityLabel}
        style={styles.closeButton}
      >
        <X size={12} color={theme.colors.foregroundMuted} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  wrapper: {
    position: "relative",
  },
  body: {
    borderRadius: theme.borderRadius.md,
    borderWidth: theme.borderWidth[1],
    borderColor: theme.colors.borderAccent,
    overflow: "hidden",
  },
  closeButton: {
    position: "absolute",
    top: -8,
    left: -8,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: theme.colors.surface2,
    borderWidth: theme.borderWidth[1],
    borderColor: theme.colors.border,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1,
  },
}));
