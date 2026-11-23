import { Camera, FileText, Image as ImageIcon } from "lucide-react-native";
import { View } from "react-native";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";
import { Icon } from "@/shared/ui/icon";
import { Text } from "@/shared/ui/text";
import type { UploadStrategy } from "../model/files";

export interface FilePickerCardProps {
  readonly strategy: UploadStrategy;
  readonly onStrategyChange: (strategy: UploadStrategy) => void;
  readonly onPickDocument: () => void;
  readonly onPickImage: () => void;
  readonly onCaptureCamera: () => void;
  readonly isPicking?: boolean;
  readonly pickerError?: string | null;
}

const STRATEGIES: ReadonlyArray<{
  readonly value: UploadStrategy;
  readonly label: string;
  readonly accessibilityLabel: string;
  readonly hint: string;
}> = [
  {
    value: "auto",
    label: "Auto",
    accessibilityLabel: "Auto strategy",
    hint: "Direct <= 10 MB, Presigned <= 100 MB",
  },
  {
    value: "direct",
    label: "Direct",
    accessibilityLabel: "Direct strategy",
    hint: "Single multipart POST (<= 10 MB)",
  },
  {
    value: "presigned",
    label: "Presigned",
    accessibilityLabel: "Presigned strategy",
    hint: "3-step S3 binary PUT (<= 100 MB)",
  },
];

export function FilePickerCard({
  strategy,
  onStrategyChange,
  onPickDocument,
  onPickImage,
  onCaptureCamera,
  isPicking = false,
  pickerError,
}: FilePickerCardProps) {
  const activeStrategy = STRATEGIES.find((s) => s.value === strategy) ?? STRATEGIES[0];

  return (
    <Card>
      <CardHeader>
        <View className="flex-row items-center justify-between gap-2">
          <CardTitle>Upload Files</CardTitle>
          <Badge variant="info">Max 2 concurrent</Badge>
        </View>
        <CardDescription>
          Stream documents, photos, or camera captures directly from disk without buffering bytes in
          memory.
        </CardDescription>
      </CardHeader>

      <CardContent className="gap-4">
        <View className="gap-2">
          <Text variant="label">Transfer Strategy</Text>
          <View className="flex-row flex-wrap gap-2">
            {STRATEGIES.map((item) => {
              const selected = item.value === strategy;
              return (
                <Button
                  key={item.value}
                  variant={selected ? "default" : "outline"}
                  size="sm"
                  accessibilityLabel={item.accessibilityLabel}
                  accessibilityState={{ selected }}
                  onPress={() => onStrategyChange(item.value)}
                >
                  {item.label}
                </Button>
              );
            })}
          </View>
          {activeStrategy ? <Text variant="caption">{activeStrategy.hint}</Text> : null}
        </View>

        <View className="flex-row flex-wrap gap-2">
          <Button
            variant="default"
            size="sm"
            disabled={isPicking}
            accessibilityLabel="Pick Document"
            onPress={onPickDocument}
          >
            <Icon as={FileText} size={16} className="text-primary-foreground" />
            <Text>Document</Text>
          </Button>

          <Button
            variant="secondary"
            size="sm"
            disabled={isPicking}
            accessibilityLabel="Pick Photo"
            onPress={onPickImage}
          >
            <Icon as={ImageIcon} size={16} className="text-on-secondary-container" />
            <Text>Photos</Text>
          </Button>

          <Button
            variant="outline"
            size="sm"
            disabled={isPicking}
            accessibilityLabel="Capture Camera"
            onPress={onCaptureCamera}
          >
            <Icon as={Camera} size={16} className="text-foreground" />
            <Text>Camera</Text>
          </Button>
        </View>

        {pickerError ? (
          <View
            accessibilityRole="alert"
            className="border-destructive bg-destructive-container rounded-xl border px-3 py-2"
          >
            <Text variant="caption" className="text-on-destructive-container">
              {pickerError}
            </Text>
          </View>
        ) : null}
      </CardContent>
    </Card>
  );
}
