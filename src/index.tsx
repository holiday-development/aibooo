import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { register, unregisterAll } from '@tauri-apps/plugin-global-shortcut';
import { readText } from '@tauri-apps/plugin-clipboard-manager';
import { getVersion } from '@tauri-apps/api/app';
import { listen } from '@tauri-apps/api/event';
import './index.css';
import { Button } from '@/components/ui/button';

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
      setStatusMessage('テキスト変換完了');
    } catch (error) {
      console.error(error);
      setStatusMessage(`テキスト変換エラー: ${error}`);
    }
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
    <div className="container">
      <h1>Write Better</h1>
      <p>メール文章を改善するツール</p>

      <div className="status-message">
        {statusMessage && <p>{statusMessage}</p>}
      </div>

      <div className="row">
        <div>
          <h2>元の文章</h2>
          <div className="textarea-container">
            <textarea
              id="input-text"
              onChange={(e) => setInputText(e.target.value)}
              value={inputText}
              rows={10}
              placeholder="ここに文章を入力してください"
            />
            <button
              type="button"
              onClick={pasteFromClipboard}
              className="paste-button"
            >
              貼り付け
            </button>
          </div>
        </div>

        <div className="buttons">
          <button type="button" onClick={improveText}>
            変換 →
          </button>
          <Button
            type="button"
            variant="outline"
            onClick={testProcessClipboard}
            className="test-button"
          >
            ショートカットテスト
          </Button>
        </div>

        <div>
          <h2>改善された文章</h2>
          <textarea
            id="output-text"
            value={outputText}
            rows={10}
            readOnly
            placeholder="ここに改善された文章が表示されます"
          />
        </div>
      </div>

      <p className="instruction">
        <b>使い方：</b> テキストを選択してコピーし、<kbd>Control+N</kbd>
        を押すと選択したテキストが変換され、画面に表示されます。
        <br />
        元のテキストは「元の文章」に、改善されたテキストは「改善された文章」に表示されます。
      </p>
    </div>
  );
}

export default App;
