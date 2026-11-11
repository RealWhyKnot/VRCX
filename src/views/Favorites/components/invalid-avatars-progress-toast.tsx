import Button from "@/components/ui/button/Button.vue";
import Progress from "@/components/ui/progress/Progress.vue";

type InvalidAvatarsProgress = {
  current: number;
  total: number;
  percentage: number;
};

type InvalidAvatarsProgressToastProps = {
  t: (key: string, named?: { current: number; total: number }) => string;
  progress: InvalidAvatarsProgress;
  onDismiss: () => void;
};

export const InvalidAvatarsProgressToast = (props: InvalidAvatarsProgressToastProps) => (
  <div class="flex flex-col gap-2 pr-1">
    <div class="text-sm font-medium">
      {props.t("view.favorite.avatars.checking_progress", {
        current: props.progress.current,
        total: props.progress.total,
      })}
    </div>
    <Progress modelValue={props.progress.percentage} class="h-2 w-full" />
    <div class="flex justify-end">
      <Button size="sm" variant="secondary" onClick={props.onDismiss}>
        {props.t("view.favorite.avatars.dismiss")}
      </Button>
    </div>
  </div>
);
