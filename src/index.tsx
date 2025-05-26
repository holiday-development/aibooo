import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { register, unregisterAll } from '@tauri-apps/plugin-global-shortcut';
import { readText } from '@tauri-apps/plugin-clipboard-manager';
import { getVersion } from '@tauri-apps/api/app';
import { listen } from '@tauri-apps/api/event';
import './index.css';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PhysicalSize } from '@tauri-apps/api/window';
import { getCurrentWindow } from '@tauri-apps/api/window';

const appWindow = getCurrentWindow();

function App() {
  const [inputText, setInputText] = useState('');
  const [outputText, setOutputText] = useState('');
  const [statusMessage, setStatusMessage] = useState('');

  useEffect(() => {
    // バージョン情報を取得
    getVersion()
      .then((version) => {
        console.log('Tauriバージョン:', version);
      })
      .catch(console.error);

    // バックエンドからのイベントをリッスン
    const unlisten = listen('clipboard-processed', (event: any) => {
      console.log('clipboard-processedイベント受信:', event);

      const [originalText, improvedText] = event.payload as [string, string];

      // 元のテキストを「元の文章」に表示
      setInputText(originalText);

      // 改善されたテキストを「改善された文章」に表示
      setOutputText(improvedText);

      setStatusMessage('テキストが変換されました');
    });

    // アプリ起動時にグローバルショートカットを登録
    const registerShortcut = async () => {
      try {
        // Control+N ショートカットを登録
        await register('Control+N', () => {
          console.log('ショートカットが押されました: Control+N');
          setStatusMessage('ショートカットが押されました: Control+N');
          // Rustバックエンドのショートカットハンドラが処理を行い、
          // イベントで結果が返ってくるのでここでは何もしません
        });

        console.log('Control+N ショートカットを登録しました');
        setStatusMessage('Control+N ショートカットを登録しました');
      } catch (error) {
        console.error('ショートカット登録エラー:', error);
        setStatusMessage(`ショートカット登録エラー: ${error}`);
      }
    };

    registerShortcut();

    // クリーンアップ関数
    return () => {
      // アプリ終了時にショートカットとイベントリスナーを解除
      unregisterAll().catch(console.error);
      unlisten.then((fn) => fn()).catch(console.error);
    };
  }, []);

  // テスト用：明示的にprocess_clipboardを呼び出す
  async function testProcessClipboard() {
    try {
      setStatusMessage('process_clipboard関数を呼び出します...');

      // まずクリップボードの内容を確認
      const currentClipboardText = await readText();
      console.log('現在のクリップボード内容:', currentClipboardText);

      // Rustのprocess_clipboard関数を呼び出す
      const [originalText, improvedText] =
        await invoke<[string, string]>('process_clipboard');

      // 元のテキストと改善されたテキストを表示
      setInputText(originalText);
      setOutputText(improvedText);

      setStatusMessage('process_clipboard関数が成功しました');
    } catch (error) {
      console.error('process_clipboard呼び出しエラー:', error);
      setStatusMessage(`process_clipboard呼び出しエラー: ${error}`);
    }
  }

  async function improveText() {
    try {
      setStatusMessage('テキスト変換中...');

      // テキストを改善
      const improved = await invoke<string>('improve_text', {
        text: inputText,
      });

      // 結果を表示
      setOutputText(improved);
      // サイズを変更
      await resizeWindowForImprovedText(200);
      setStatusMessage('テキスト変換完了');
    } catch (error) {
      console.error(error);
      setStatusMessage(`テキスト変換エラー: ${error}`);
    }
  }

  async function resizeWindowForImprovedText(size: number) {
    // 現在のサイズを取得
    const currentSize = await appWindow.innerSize();
    console.log('現在のサイズ:', currentSize);

    // 高さを増加（例: 現在より200px高く）
    await appWindow.setSize(
      new PhysicalSize(currentSize.width, currentSize.height + size)
    );
    console.log('新しいサイズ:', await appWindow.innerSize());
  }

  // クリップボードからテキストを読み込む
  async function pasteFromClipboard() {
    try {
      setStatusMessage('クリップボードから読み込み中...');
      const text = await readText();
      if (text) {
        setInputText(text);
        setStatusMessage(
          `クリップボードからテキストを読み込みました (${text.length} 文字)`
        );
      } else {
        setStatusMessage('クリップボードが空か、テキストが含まれていません');
      }
    } catch (error) {
      console.error('クリップボード読み取りエラー:', error);
      setStatusMessage(`クリップボード読み取りエラー: ${error}`);
    }
  }

  return (
    <div className="flex flex-col items-center justify-center h-full p-2">
      <div className="w-full flex items-center justify-center gap-2">
        <Input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="元の文章"
          className="flex-1"
        />
        <Button onClick={improveText}>変換</Button>
      </div>
    </div>
  );
}

export default App;
