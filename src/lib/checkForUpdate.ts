import { toast } from 'sonner';
import { check } from '@tauri-apps/plugin-updater';

export async function checkForUpdate() {
  const update = await check();
  if (update) {
    toast('新しいバージョンがあります', {
      description: 'アップデートを今すぐ適用しますか？',
      position: 'bottom-left',
      action: {
        label: 'アップデート',
        onClick: async () => {
          await update.downloadAndInstall();
          toast('アップデートが完了しました。アプリを再起動してください。');
        },
      },
    });
  }
}
